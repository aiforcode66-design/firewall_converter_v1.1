# -*- coding: utf-8 -*-
"""
File ini berisi parser untuk konfigurasi Checkpoint.
UPDATED: Added Conversion Warning collection.
"""
import re
import csv
import io

from models import FirewallConfig, Address, Group, Service, ServiceGroup, Rule, NatRule, StaticRoute, Interface, ConversionWarning
from .base import BaseParser
from .checkpoint_csv_parser import CheckpointCSVParser


class CheckpointParser(BaseParser):
    """
    Parser untuk konfigurasi Checkpoint.
    Membutuhkan dua file utama:
    1. objects_5_0.c: Berisi definisi semua objek (host, network, service, group).
    2. policy.csv: Berisi aturan firewall yang diekspor dalam format CSV.
    3. nat.csv (opsional): Berisi aturan NAT.
    4. show_configuration.txt (opsional): Berisi output dari 'show configuration' untuk interface dan routing.
    5. CSV exports (opsional, via parse_csv_objects): Alternatif untuk definitions.
    """
    _RE_CP_INTERFACE = re.compile(r'set interface (\S+) ipv4-address (\S+) mask-length (\d+)')
    _RE_CP_INTERFACE_COMMENT = re.compile(r'set interface (\S+) comments "([^"]+)"')
    _RE_CP_STATIC_ROUTE = re.compile(r'set static-route (\S+) nexthop gateway address (\S+)')
    _RE_CP_DEFAULT_ROUTE = re.compile(r'set static-route default nexthop gateway address (\S+)')

    def parse(self, objects_content: str, policy_content: str, nat_content: str = None,
              config_content: str = None, csv_objects: dict = None) -> FirewallConfig:
        config = FirewallConfig()

        # Parse Objects jika konten tersedia (Prioritas ke objects_5_0.C, tapi bisa di-merge atau diganti)
        # Jika csv_objects ada, kita parse itu juga.
        if objects_content:
            self._parse_objects(objects_content, config)
        
        if csv_objects:
            self._parse_csv_objects(csv_objects, config)

        # Parse Policy jika konten tersedia
        if policy_content:
            self._parse_policy(policy_content, config)

        # Parse NAT jika konten tersedia
        if nat_content:
            self._parse_nat_policy(nat_content, config)

        # Parse CLI Config jika konten tersedia
        if config_content:
            self._parse_show_configuration(config_content, config)

        # Fallback jika tidak ada data interface eksplisit
        if not config.interfaces and (config.rules or config.nat_rules):
            all_zones = set()
            for rule in config.rules:
                all_zones.update(rule.source_interface)
                all_zones.update(rule.destination_interface)
            for nat_rule in config.nat_rules:
                all_zones.update(nat_rule.source_interface)
                all_zones.update(nat_rule.destination_interface)
            all_zones.discard('any')
            for zone_name in all_zones:
                config.interfaces.add(Interface(name=zone_name, zone=zone_name))

        return config

    def _parse_csv_objects(self, csv_files: dict, config: FirewallConfig):
        """Delegates parsing to the CSV parser for provided contents."""
        csv_parser = CheckpointCSVParser()
        temp_config = FirewallConfig()
        
        # Parse into temporary config first
        if 'hosts' in csv_files:
            csv_parser.parse_hosts(csv_files['hosts'], temp_config)
        
        if 'networks' in csv_files:
            csv_parser.parse_networks(csv_files['networks'], temp_config)
            
        if 'ranges' in csv_files:
            csv_parser.parse_address_ranges(csv_files['ranges'], temp_config)
            
        if 'groups' in csv_files:
            csv_parser.parse_groups(csv_files['groups'], temp_config)
            
        if 'services_tcp' in csv_files:
            csv_parser.parse_tcp_services(csv_files['services_tcp'], temp_config)
            
        if 'services_udp' in csv_files:
            csv_parser.parse_udp_services(csv_files['services_udp'], temp_config)
            
        if 'service_groups' in csv_files:
            csv_parser.parse_service_groups(csv_files['service_groups'], temp_config)
            
        # MERGE LOGIC: CSV is authoritative -> Overwrite existing objects from objects.C
        
        # 1. Addresses (Host, Network, Range)
        existing_addresses = {a.name: a for a in config.addresses}
        for addr in temp_config.addresses:
            if addr.name in existing_addresses:
                config.addresses.remove(existing_addresses[addr.name])
            config.addresses.add(addr)
            
        # 2. Address Groups
        existing_groups = {g.name: g for g in config.address_groups}
        for grp in temp_config.address_groups:
            if grp.name in existing_groups:
                config.address_groups.remove(existing_groups[grp.name])
            config.address_groups.add(grp)
            
        # 3. Services (TCP, UDP)
        existing_services = {s.name: s for s in config.services}
        for svc in temp_config.services:
            if svc.name in existing_services:
                config.services.remove(existing_services[svc.name])
            config.services.add(svc)
            
        # 4. Service Groups
        existing_svc_groups = {g.name: g for g in config.service_groups}
        for grp in temp_config.service_groups:
            if grp.name in existing_svc_groups:
                config.service_groups.remove(existing_svc_groups[grp.name])
            config.service_groups.add(grp)

    def _parse_show_configuration(self, content: str, config: FirewallConfig):
        """Mem-parsing output dari 'show configuration' untuk interface dan rute statis."""
        lines = content.splitlines()
        interface_map = {iface.name: iface for iface in config.interfaces}

        for line in lines:
            line = line.strip()
            if not line: continue

            if_match = self._RE_CP_INTERFACE.match(line)
            if if_match:
                if_name, ip_address, mask_length = if_match.groups()
                if if_name not in interface_map:
                    iface = Interface(name=if_name)
                    interface_map[if_name] = iface
                    config.interfaces.add(iface)
                else:
                    iface = interface_map[if_name]

                iface.ip_address = ip_address
                iface.mask_length = int(mask_length)
                iface.zone = if_name  # Di Gaia, nama interface seringkali berfungsi sebagai zona
                continue

            if_comment_match = self._RE_CP_INTERFACE_COMMENT.match(line)
            if if_comment_match:
                if_name, comment = if_comment_match.groups()
                if if_name in interface_map:
                    interface_map[if_name].description = comment
                continue

            def_route_match = self._RE_CP_DEFAULT_ROUTE.match(line)
            if def_route_match:
                next_hop = def_route_match.group(1)
                route = StaticRoute(destination="0.0.0.0/0", next_hop=next_hop)
                config.static_routes.append(route)
                continue

            route_match = self._RE_CP_STATIC_ROUTE.match(line)
            if route_match:
                destination, next_hop = route_match.groups()
                route = StaticRoute(destination=destination, next_hop=next_hop)
                config.static_routes.append(route)
                continue

    def _find_closing_paren(self, text: str, start_index: int) -> int:
        open_paren_count = 1
        for i in range(start_index + 1, len(text)):
            if text[i] == '(':
                open_paren_count += 1
            elif text[i] == ')':
                open_paren_count -= 1
                if open_paren_count == 0:
                    return i
        return -1

    def _extract_table_content(self, content: str, table_name: str) -> str:
        pattern = r':{}\s*\('.format(table_name)
        match = re.search(pattern, content, re.DOTALL)
        if not match:
            return ""
        start_index = match.end()
        end_index = self._find_closing_paren(content, start_index - 1)
        if end_index != -1:
            return content[start_index:end_index]
        return ""

    def _parse_objects(self, content: str, config: FirewallConfig):
        table_names = ["network_objects", "services"]
        for table_name in table_names:
            table_content = self._extract_table_content(content, table_name)
            if not table_content:
                continue
            object_blocks = []
            current_pos = 0
            while current_pos < len(table_content):
                start_match = re.search(r':\s*\(', table_content[current_pos:])
                if not start_match:
                    break
                block_start = current_pos + start_match.start()
                paren_start = current_pos + start_match.end() - 1
                block_end = self._find_closing_paren(table_content, paren_start)
                if block_end != -1:
                    object_blocks.append(table_content[block_start:block_end + 1])
                    current_pos = block_end + 1
                else:
                    current_pos = paren_start + 1
            for block in object_blocks:
                name = None
                admin_info_start_match = re.search(r':AdminInfo\s*\(', block)
                if admin_info_start_match:
                    admin_info_content_start = admin_info_start_match.end()
                    admin_info_paren_start = admin_info_content_start - 1
                    admin_info_content_end = self._find_closing_paren(block, admin_info_paren_start)
                    if admin_info_content_end != -1:
                        admin_info_content = block[admin_info_content_start:admin_info_content_end]
                        name_prop_match = re.search(r':name\s+\((?:"([^"]+)"|([^\s)]+))\)', admin_info_content)
                        if name_prop_match:
                            name = name_prop_match.group(1) or name_prop_match.group(2)
                if not name:
                    name_match = re.search(r':\s*\((?:"([^"]+)"|([^\s(]+))', block)
                    if name_match:
                        name = name_match.group(1) or name_match.group(2)
                if name:
                    class_name_match = re.search(r':ClassName\s+\(([^)]+)\)', block)
                    if class_name_match:
                        class_name = class_name_match.group(1).strip().strip('"')
                        self._create_object_from_block(name, class_name, block, config)

    def _get_prop(self, prop_name: str, block: str) -> str:
        match = re.search(r':{}\s+\((.*?)\)'.format(prop_name), block, re.DOTALL)
        if match:
            return match.group(1).strip().strip('"')
        return ""

    def _create_object_from_block(self, name: str, class_name: str, block: str, config: FirewallConfig):
        if class_name in ["host_plain", "host_ckp", "gateway_ckp", "gateway_plain"]:
            ip_addr = self._get_prop("ipaddr", block)
            if ip_addr:
                config.addresses.add(Address(name=name, type='host', value1=ip_addr))
        elif class_name == "network":
            ip_addr = self._get_prop("ipaddr", block)
            netmask = self._get_prop("netmask", block)
            if ip_addr and netmask:
                try:
                    cidr = self._mask_to_cidr(netmask)
                    config.addresses.add(Address(name=name, type='network', value1=ip_addr, value2=cidr))
                except (ValueError, AttributeError):
                    config.conversion_warnings.append(ConversionWarning(
                        category='Parser', message=f"Failed to convert netmask '{netmask}' for object '{name}'", severity='warning'
                    ))
        elif class_name == "address_range":
            ip_first = self._get_prop("ipaddr_first", block)
            ip_last = self._get_prop("ipaddr_last", block)
            if ip_first and ip_last:
                config.addresses.add(Address(name=name, type='range', value1=ip_first, value2=ip_last))
        elif class_name == "domain":
            fqdn_val = self._get_prop("fully_qualified_domain_name", block)
            if not fqdn_val or fqdn_val.lower() in ['true', 'false']:
                fqdn_val = name
            if fqdn_val.startswith('.'):
                fqdn_val = '*' + fqdn_val
            if fqdn_val:
                config.addresses.add(Address(name=name, type='fqdn', value1=fqdn_val))
        elif class_name == "network_object_group":
            member_matches = re.findall(r':\s*\(ReferenceObject.*?Name\s+\(([^)]+)\)', block, re.DOTALL)
            if member_matches:
                members = set(member_matches)
                config.address_groups.add(Group(name=name, members=members))
        elif class_name == "tcp_service":
            port = self._get_prop("port", block)
            if port:
                config.services.add(Service(name=name, protocol="tcp", port=f"eq {port}"))
        elif class_name == "udp_service":
            port = self._get_prop("port", block)
            if port:
                config.services.add(Service(name=name, protocol="udp", port=f"eq {port}"))
        elif class_name == "service_group":
            member_matches = re.findall(r':\s*\(ReferenceObject.*?Name\s+\(([^)]+)\)', block, re.DOTALL)
            if member_matches:
                members = set(member_matches)
                config.service_groups.add(ServiceGroup(name=name, members=members))
        elif class_name == "icmp_service" or class_name == "icmpv6_service":
            icmp_type = self._get_prop("type", block)
            icmp_code = self._get_prop("code", block)
            port_str = "icmp"
            if icmp_type:
                port_str += f" type {icmp_type}"
            if icmp_code:
                port_str += f" code {icmp_code}"
            config.services.add(Service(name=name, protocol="icmp", port=port_str))
        elif class_name == "rpc_service" or class_name == "dcerpc_service":
            # Map RPC to generic TCP high port or 135 usually, but for now just create a service object
            # Often has program number but mapping that is complex. Default to TCP/UDP dynamic.
            config.services.add(Service(name=name, protocol="tcp", port="dynamic-rpc"))
        elif class_name == "other_service":
            protocol = self._get_prop("protocol", block)
            exp = self._get_prop("exp", block) # Expression e.g. "high_udp_..."
            
            # Basic Protocol Mapping
            proto_map = {'1': 'icmp', '6': 'tcp', '17': 'udp', '58': 'icmpv6', '89': 'ospf'}
            proto_name = proto_map.get(protocol, 'ip')
            
            port_val = "any"
            if "udp" in exp.lower() or protocol == '17':
                proto_name = 'udp'
            elif "tcp" in exp.lower() or protocol == '6':
                proto_name = 'tcp'
                
            config.services.add(Service(name=name, protocol=proto_name, port=port_val))
        elif class_name == "edge_robo_interface_capabilities":
            # Extract Zone info if needed (Advanced: Mapping interface to zone)
            pass
            # Filter out common internal classes to reduce noise
            if class_name not in ['globals', 'table', 'rule', 'rule-cell', 'properties']:
                # We don't add warning here to avoid spamming, but could be enabled for debugging
                pass

    def _parse_policy(self, content: str, config: FirewallConfig):
        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            try:
                rule_num_str = row.get("Rule Number") or row.get("No.")
                if not rule_num_str or not rule_num_str.isdigit(): continue
                rule_num = int(rule_num_str)
                name = row.get("Name") or f"Rule_{rule_num}"

                action_raw = row.get("Action", "Drop").strip().lower()
                standardized_action = "allow" if "accept" in action_raw else "deny"

                is_disabled = "[disabled]" in name.lower() or row.get("Enabled", "true").lower() == "false"
                original_text_str = f"Rule {rule_num_str}: {row.get('Name', '')} | Src: {row.get('Source', '')} | Dst: {row.get('Destination', '')} | Svc: {row.get('Services & Applications', '')} | Act: {row.get('Action', '')}"

                rule = Rule(
                    sequence_id=rule_num, name=name, action=standardized_action,
                    remark=row.get("Comment"), enabled=not is_disabled, original_text=original_text_str
                )
                source = row.get("Source")
                if source: rule.source.update([s.strip() for s in source.split(';') if s.strip()])
                destination = row.get("Destination")
                if destination: rule.destination.update([d.strip() for d in destination.split(';') if d.strip()])
                service = row.get("Services & Applications") or row.get("Service")
                if service: rule.service.update([s.strip() for s in service.split(';') if s.strip()])

                if not rule.service: rule.service.add("Any")
                if not rule.source: rule.source.add("Any")
                if not rule.destination: rule.destination.add("Any")
                config.rules.append(rule)
            except (KeyError, ValueError, AttributeError) as e:
                config.conversion_warnings.append(ConversionWarning(
                    category='Parser', message=f"Skipped malformed policy row: {e}", original_line=str(row), severity='error'
                ))
                continue

    def _parse_nat_policy(self, content: str, config: FirewallConfig):
        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            try:
                rule_num_str = row.get("Rule Number") or row.get("No.")
                if not rule_num_str or not rule_num_str.isdigit(): continue
                rule_num = int(rule_num_str)
                original_text = f"NAT Rule {rule_num_str}: Orig Src: {row.get('Original Source', '')}, Orig Dst: {row.get('Original Destination', '')}, Trans Src: {row.get('Translated Source', '')}, Trans Dst: {row.get('Translated Destination', '')}"
                nat_rule = NatRule(
                    sequence_id=rule_num, name=f"NAT_Rule_{rule_num}",
                    enabled=row.get("Enabled", "true").lower() == "true", original_text=original_text
                )

                orig_src = row.get("Original Source")
                if orig_src: nat_rule.original_source.update([s.strip() for s in orig_src.split(';') if s.strip()])

                orig_dst = row.get("Original Destination")
                if orig_dst: nat_rule.original_destination.update([s.strip() for s in orig_dst.split(';') if s.strip()])

                orig_svc = row.get("Original Service")
                if orig_svc: nat_rule.original_service.update([s.strip() for s in orig_svc.split(';') if s.strip()])

                if not nat_rule.original_source: nat_rule.original_source.add("Any")
                if not nat_rule.original_destination: nat_rule.original_destination.add("Any")
                if not nat_rule.original_service: nat_rule.original_service.add("Any")

                trans_src = row.get("Translated Source", "").strip()
                method = row.get("Method", "").lower()

                if method == 'hide' or '(hide)' in trans_src.lower() or trans_src.lower() == 'hide':
                    nat_rule.translated_source = 'dynamic-ip-and-port'
                elif trans_src and trans_src.lower() != 'original':
                    nat_rule.translated_source = trans_src

                trans_dst = row.get("Translated Destination", "").strip()
                if trans_dst and trans_dst.lower() != 'original': nat_rule.translated_destination = trans_dst

                if row.get("Translated Service"): nat_rule.translated_service = row.get("Translated Service").strip()

                config.nat_rules.append(nat_rule)
            except (KeyError, ValueError, AttributeError) as e:
                config.conversion_warnings.append(ConversionWarning(
                    category='Parser', message=f"Skipped malformed NAT row: {e}", original_line=str(row), severity='error'
                ))
                continue
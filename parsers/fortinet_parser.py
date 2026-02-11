# -*- coding: utf-8 -*-
"""
File ini berisi parser untuk konfigurasi FortiGate.
Updated:
1. Support OSPF 'set prefix' with Mask to CIDR conversion.
2. Service Group naming convention changed to 'TCP-UDP_Name' for mixed services.
3. [FIX] Fixed Zone configuration detection to properly map member interfaces.
4. [FIX] Added support for FQDN Address Objects.
5. [NEW] Added Conversion Warning collection with expandable details.
6. [FIX] Improved nested config block skipping for warnings.
"""
import re
from typing import List, Tuple, Dict, Set

from models import FirewallConfig, Address, Group, Service, ServiceGroup, Rule, NatRule, StaticRoute, Interface, ConversionWarning
from .base import BaseParser


class FortinetParser(BaseParser):
    """Parser untuk konfigurasi FortiGate yang telah disempurnakan."""

    def __init__(self):
        super().__init__()
        self.split_services_map: Dict[str, List[str]] = {}
        self.interface_to_zone_map: Dict[str, str] = {}  # [NEW] Menyimpan mapping interface member ke zone

    def parse(self, content: str, **kwargs) -> FirewallConfig:
        config = FirewallConfig()
        self.split_services_map = {}
        self.interface_to_zone_map = {}  # Reset mapping setiap kali parse

        lines = [line.strip() for line in content.splitlines() if line.strip() and not line.strip().startswith('#')]

        policy_seq_counter = 1
        nat_seq_counter = 1

        i = 0
        while i < len(lines):
            line = lines[i]

            # --- Firewall Objects ---
            if line == "config firewall address":
                i, _ = self._parse_block(i, lines, config, self._parse_address_entry)
            elif line == "config firewall addrgrp":
                i, _ = self._parse_block(i, lines, config, self._parse_address_group_entry)
            elif line == "config firewall service custom":
                i, _ = self._parse_block(i, lines, config, self._parse_service_entry)
            elif line == "config firewall service group":
                i, _ = self._parse_block(i, lines, config, self._parse_service_group_entry)
            elif line == "config firewall policy":
                i, policy_seq_counter = self._parse_block(i, lines, config, self._parse_policy_entry,
                                                          policy_seq_counter)
            elif line == "config firewall vip":
                i, nat_seq_counter = self._parse_block(i, lines, config, self._parse_vip_entry, nat_seq_counter)
            elif line == "config firewall central-snat-map":
                i, nat_seq_counter = self._parse_block(i, lines, config, self._parse_central_snat_entry,
                                                       nat_seq_counter)

            # --- Network & Routing ---
            elif line == "config system zone":
                i, _ = self._parse_block(i, lines, config, self._parse_zone_entry)
            elif line == "config router static":
                i, _ = self._parse_block(i, lines, config, self._parse_static_route_entry)
            elif line == "config system interface":
                i, _ = self._parse_block(i, lines, config, self._parse_interface_entry)

            # --- Dynamic Routing (OSPF/BGP) ---
            elif line.startswith("config router ospf") or line.startswith("config router bgp"):
                i = self._parse_dynamic_routing_block(i, lines, config)

            # --- [NEW] Catch Unparsed Config Blocks with Details (Nested Support) ---
            elif line.startswith("config "):
                block_header = line
                block_content = []
                
                # Skip known ignored blocks to reduce noise if needed
                ignored_blocks = ['config system', 'config log', 'config user', 'config vpn', 'config ips', 'config application']
                is_ignored = any(line.startswith(b) for b in ignored_blocks)
                
                # Capture block content with nesting support
                i += 1
                depth = 1
                while i < len(lines) and depth > 0:
                    current_line = lines[i]
                    
                    if current_line.startswith("config "):
                        depth += 1
                    elif current_line == "end":
                        depth -= 1
                    
                    if depth > 0: # Don't include the final 'end' of the main block in content if you prefer
                         block_content.append(current_line)
                    
                    i += 1
                
                # 'i' is now after the final 'end'

                if not is_ignored:
                    config.conversion_warnings.append(ConversionWarning(
                        category='Parser', 
                        message='Skipped unsupported config block', 
                        original_line=block_header, 
                        severity='info',
                        details=block_content # Store content for expansion
                    ))
            else:
                i += 1

        self._update_references(config)
        self._apply_zone_mappings(config)  # [NEW] Terapkan mapping zone ke interface

        # Mengasosiasikan interface ke zona (Logic lama tetap dipertahankan sebagai fallback/cleanup)
        all_zones = {iface.name for iface in config.interfaces if iface.ip_address is None}
        for rule in config.rules:
            rule.source_interface = {z for z in rule.source_interface if z in all_zones} or rule.source_interface
            rule.destination_interface = {z for z in rule.destination_interface if
                                          z in all_zones} or rule.destination_interface

        return config

    def _apply_zone_mappings(self, config: FirewallConfig):
        """
        [NEW] Mengupdate objek Interface yang sudah ada dengan informasi Zone yang sesuai.
        """
        for iface in config.interfaces:
            if iface.name in self.interface_to_zone_map:
                iface.zone = self.interface_to_zone_map[iface.name]

    def _parse_dynamic_routing_block(self, index: int, lines: List[str], config: FirewallConfig) -> int:
        """
        Menangani blok routing dinamis (OSPF/BGP) dengan nesting support.
        Mengekstrak 'set prefix' dan mengonversinya ke format CIDR untuk dashboard.
        """
        routing_lines = []
        protocol = "OSPF" if "ospf" in lines[index] else "BGP"

        # Simpan header
        routing_lines.append(lines[index])

        i = index + 1
        depth = 1

        while i < len(lines) and depth > 0:
            line = lines[i]

            if line.startswith("config "):
                depth += 1
            elif line == "end":
                depth -= 1

            routing_lines.append(line)

            # --- LOGIKA UNTUK SET PREFIX ---
            clean_line = line.strip()
            if clean_line.startswith("set prefix"):
                parts = clean_line.split()
                destination = None

                # Case 1: Format IP Mask (Contoh: set prefix 10.12.9.40 255.255.255.252)
                if len(parts) >= 4:
                    ip = parts[2]
                    mask = parts[3]
                    try:
                        cidr = self._mask_to_cidr(mask)
                        destination = f"{ip}/{cidr}"
                    except:
                        # Fallback jika mask invalid
                        destination = f"{ip} {mask}"

                # Case 2: Format CIDR (Contoh: set prefix 192.168.1.0/24)
                elif len(parts) >= 3:
                    destination = parts[2]

                if destination:
                    config.static_routes.append(StaticRoute(
                        destination=destination,
                        next_hop=f"Dynamic-{protocol}",
                        interface=protocol.lower(),
                        distance=110 if protocol == "OSPF" else 20,
                        comment=f"Imported from {protocol} config: {clean_line}"
                    ))

            i += 1

        if routing_lines:
            config.dynamic_routing_config += "\n".join(routing_lines) + "\n\n"

        return i

    def _clean_service_name(self, name: str) -> str:
        clean = re.sub(r'^(TCP/UDP|UDP/TCP)[_\-\s]*', '', name, flags=re.IGNORECASE)
        clean = clean.replace('/', '').replace('\\', '')
        clean = clean.lstrip('_-. ')
        clean = clean.strip()
        if not clean:
            return name.replace('/', '_').replace('\\', '_')
        return clean

    def _update_references(self, config: FirewallConfig):
        if not self.split_services_map:
            return

        for grp in config.service_groups:
            new_members = set()
            for member in grp.members:
                if member in self.split_services_map:
                    new_members.update(self.split_services_map[member])
                else:
                    new_members.add(member)
            grp.members = new_members

        for rule in config.rules:
            new_services = set()
            for svc in rule.service:
                if svc in self.split_services_map:
                    new_services.update(self.split_services_map[svc])
                else:
                    new_services.add(svc)
            rule.service = new_services

        for nat in config.nat_rules:
            new_services = set()
            for svc in nat.original_service:
                if svc in self.split_services_map:
                    new_services.update(self.split_services_map[svc])
                else:
                    new_services.add(svc)
            nat.original_service = new_services

    def _parse_block(self, index: int, lines: List[str], config: FirewallConfig, entry_parser_func,
                     sequence_counter: int = None) -> Tuple[int, int]:
        i = index + 1
        current_entry_lines = []

        def process_entry():
            nonlocal sequence_counter
            if not current_entry_lines: return
            if sequence_counter is not None:
                entry_parser_func(current_entry_lines, config, sequence_counter)
                sequence_counter += 1
            else:
                entry_parser_func(current_entry_lines, config)

        while i < len(lines):
            line = lines[i]
            if line == "end":
                process_entry()
                return i + 1, sequence_counter
            if line.startswith("edit "):
                process_entry()
                current_entry_lines = [line]
            elif line.startswith("next"):
                process_entry()
                current_entry_lines = []
            else:
                current_entry_lines.append(line)
            i += 1
        process_entry()
        return i, sequence_counter

    def _get_edit_value(self, line: str) -> str:
        parts = line.split(" ", 1)
        if len(parts) < 2: return ""
        value = parts[1].strip()
        return value[1:-1] if value.startswith('"') and value.endswith('"') else value

    def _get_set_value(self, line: str) -> str:
        parts = line.split(" ", 2)
        if len(parts) < 3: return ""
        value = parts[2].strip()
        return value[1:-1] if value.startswith('"') and value.endswith('"') else value

    def _extract_multi_values(self, line: str) -> List[str]:
        parts = line.split(" ", 2)
        if len(parts) < 3: return []
        content = parts[2]
        matches = re.findall(r'(?:"([^"]+)"|(\S+))', content)
        return [m[0] or m[1] for m in matches]

    def _parse_interface_entry(self, entry_lines: List[str], config: FirewallConfig):
        if not entry_lines: return
        name = self._get_edit_value(entry_lines[0])
        if not name: return
        iface_data = {'name': name}
        for line in entry_lines[1:]:
            if line.startswith("set ip "):
                parts = self._get_set_value(line).split()
                if len(parts) == 2:
                    iface_data['ip_address'] = parts[0]
                    iface_data['mask_length'] = self._mask_to_cidr(parts[1])
            elif line.startswith("set alias "):
                iface_data['description'] = self._get_set_value(line)
            elif line.startswith("set vlanid "):
                iface_data['vlan_id'] = int(self._get_set_value(line))
        config.interfaces.add(Interface(**iface_data))

    def _parse_static_route_entry(self, entry_lines: List[str], config: FirewallConfig):
        if not entry_lines: return
        route_data = {'destination': '0.0.0.0/0', 'next_hop': None, 'interface': None}
        for line in entry_lines:
            if line.startswith("set dst "):
                parts = self._get_set_value(line).split()
                if len(parts) == 2:
                    ip, mask = parts
                    cidr = self._mask_to_cidr(mask)
                    route_data['destination'] = f"{ip}/{cidr}"
                elif len(parts) == 1 and '/' in parts[0]:
                    route_data['destination'] = parts[0]
            elif line.startswith("set gateway "):
                route_data['next_hop'] = self._get_set_value(line)
            elif line.startswith("set device "):
                route_data['interface'] = self._get_set_value(line)
            elif line.startswith("set distance "):
                route_data['distance'] = int(self._get_set_value(line))
            elif line.startswith("set comment "):
                route_data['comment'] = self._get_set_value(line)

        if route_data['next_hop'] or route_data['interface']:
            if not route_data['next_hop']: route_data['next_hop'] = "0.0.0.0"
            config.static_routes.append(StaticRoute(**route_data))

    def _parse_zone_entry(self, entry_lines: List[str], config: FirewallConfig):
        """
        [MODIFIED] Hanya mendeteksi member interface dan menyimpannya ke map.
        TIDAK LAGI menambahkan Zone sebagai Interface.
        """
        if not entry_lines: return
        zone_name = self._get_edit_value(entry_lines[0])
        if zone_name:
            # HAPUS BARIS INI:
            # config.interfaces.add(Interface(name=zone_name))  <-- Kita tidak mau Zone muncul di list interface

            # Cari member interface (set interface "port1" "port2" ...)
            for line in entry_lines[1:]:
                if line.strip().startswith("set interface"):
                    members = self._extract_multi_values(line)
                    for member in members:
                        # Simpan ke mapping: Nama Interface -> Nama Zone
                        self.interface_to_zone_map[member] = zone_name

    def _parse_address_entry(self, entry_lines: List[str], config: FirewallConfig):
        name = self._get_edit_value(entry_lines[0])
        addr = {"name": name, "type": None, "value1": None, "value2": None, "original_text": "\n".join(entry_lines)}
        for line in entry_lines[1:]:
            if line.startswith("set subnet"):
                parts = self._get_set_value(line).split()
                if len(parts) == 2:
                    ip, mask = parts
                    cidr = self._mask_to_cidr(mask)
                    addr["type"] = "host" if cidr == "32" else "network"
                    addr["value1"] = ip
                    if addr["type"] == "network": addr["value2"] = cidr
            elif line.startswith("set type iprange"):
                addr["type"] = "range"
            elif line.startswith("set start-ip"):
                addr["value1"] = self._get_set_value(line)
            elif line.startswith("set end-ip"):
                addr["value2"] = self._get_set_value(line)
            elif line.startswith("set type fqdn"):
                addr["type"] = "fqdn"
            elif line.startswith("set fqdn"):
                addr["value1"] = self._get_set_value(line)

        if addr["name"] and addr["type"] and addr["value1"]:
            config.addresses.add(Address(**addr))

    def _parse_address_group_entry(self, entry_lines: List[str], config: FirewallConfig):
        name = self._get_edit_value(entry_lines[0])
        members = set()
        for line in entry_lines[1:]:
            if line.startswith("set member"):
                members.update(self._extract_multi_values(line))
        if name and members:
            config.address_groups.add(Group(name=name, members=members, original_text="\n".join(entry_lines)))

    def _parse_service_group_entry(self, entry_lines: List[str], config: FirewallConfig):
        name = self._get_edit_value(entry_lines[0])
        members = set()
        for line in entry_lines[1:]:
            if line.startswith("set member"):
                members.update(self._extract_multi_values(line))
        if name and members:
            config.service_groups.add(ServiceGroup(name=name, members=members, original_text="\n".join(entry_lines)))

    def _parse_service_entry(self, entry_lines: List[str], config: FirewallConfig):
        name = self._get_edit_value(entry_lines[0])
        svc = {"tcp_port": None, "udp_port": None, "protocol": None}
        for line in entry_lines[1:]:
            if line.startswith("set tcp-portrange"):
                svc["tcp_port"] = self._get_set_value(line)
            elif line.startswith("set udp-portrange"):
                svc["udp_port"] = self._get_set_value(line)
            elif line.startswith("set protocol ICMP"):
                svc["protocol"] = "icmp"

        base_clean_name = self._clean_service_name(name)

        if svc["tcp_port"] and svc["udp_port"]:
            tcp_name = f"TCP-{base_clean_name}"
            udp_name = f"UDP-{base_clean_name}"

            tcp_port_str = f"eq {svc['tcp_port']}" if '-' not in svc[
                'tcp_port'] else f"range {svc['tcp_port'].replace('-', ' ')}"
            config.services.add(
                Service(name=tcp_name, protocol="tcp", port=tcp_port_str, original_text="\n".join(entry_lines)))

            udp_port_str = f"eq {svc['udp_port']}" if '-' not in svc[
                'udp_port'] else f"range {svc['udp_port'].replace('-', ' ')}"
            config.services.add(
                Service(name=udp_name, protocol="udp", port=udp_port_str, original_text="\n".join(entry_lines)))

            group_name = f"TCP-UDP_{base_clean_name}"

            config.service_groups.add(ServiceGroup(name=group_name, members={tcp_name, udp_name},
                                                   original_text=f"Group generated from mixed service {name}"))

            self.split_services_map[name] = [group_name]

        else:
            final_name = base_clean_name
            if re.match(r'^\d+$', final_name):
                if svc["tcp_port"]:
                    final_name = f"TCP-{final_name}"
                elif svc["udp_port"]:
                    final_name = f"UDP-{final_name}"
                elif svc["protocol"] == 'icmp':
                    final_name = f"ICMP-{final_name}"

            if final_name != name:
                self.split_services_map[name] = [final_name]

            if svc["tcp_port"]:
                port_str = f"eq {svc['tcp_port']}" if '-' not in svc[
                    'tcp_port'] else f"range {svc['tcp_port'].replace('-', ' ')}"
                config.services.add(
                    Service(name=final_name, protocol="tcp", port=port_str, original_text="\n".join(entry_lines)))
            elif svc["udp_port"]:
                port_str = f"eq {svc['udp_port']}" if '-' not in svc[
                    'udp_port'] else f"range {svc['udp_port'].replace('-', ' ')}"
                config.services.add(
                    Service(name=final_name, protocol="udp", port=port_str, original_text="\n".join(entry_lines)))
            elif svc["protocol"] == "icmp":
                config.services.add(
                    Service(name=final_name, protocol="icmp", port="", original_text="\n".join(entry_lines)))

    def _parse_policy_entry(self, entry_lines: List[str], config: FirewallConfig, sequence_id: int):
        original_seq_id = self._get_edit_value(entry_lines[0])
        rule = {
            "sequence_id": sequence_id, "name": f"Rule_{original_seq_id}", "action": "deny", "enabled": True,
            "source_interface": set(), "destination_interface": set(),
            "source": set(), "destination": set(), "service": set(), "remark": None,
            "original_text": "\n".join(entry_lines), "security_profiles": {}
        }
        is_nat_enabled = False
        nat_pool_name = None
        for line in entry_lines[1:]:
            if line.startswith("set name"):
                rule["name"] = self._get_set_value(line)
            elif line.startswith("set srcintf"):
                rule["source_interface"].update(self._extract_multi_values(line))
            elif line.startswith("set dstintf"):
                rule["destination_interface"].update(self._extract_multi_values(line))
            elif line.startswith("set srcaddr"):
                rule["source"].update(self._extract_multi_values(line))
            elif line.startswith("set dstaddr"):
                rule["destination"].update(self._extract_multi_values(line))
            elif line.startswith("set service"):
                rule["service"].update(self._extract_multi_values(line))
            elif line.startswith("set action"):
                rule["action"] = "allow" if self._get_set_value(line) == "accept" else "deny"
            elif line.startswith("set status"):
                rule["enabled"] = self._get_set_value(line) == "enable"
            elif line.startswith("set comments"):
                rule["remark"] = self._get_set_value(line)
            elif line.startswith("set nat enable"):
                is_nat_enabled = True
            elif line.startswith("set poolname"):
                nat_pool_name = self._get_set_value(line)
            elif line.startswith("set ips-sensor"):
                rule["security_profiles"]["ips"] = self._get_set_value(line)
            elif line.startswith("set av-profile"):
                rule["security_profiles"]["av"] = self._get_set_value(line)

        if not rule["source"]: rule["source"].add("all")
        if not rule["destination"]: rule["destination"].add("all")
        if not rule["service"]: rule["service"].add("ALL")

        config.rules.append(Rule(**rule))
        if is_nat_enabled and nat_pool_name:
            nat_rule = NatRule(
                sequence_id=sequence_id,
                name=f"NAT_{rule['name']}",
                original_source=rule['source'],
                translated_source=nat_pool_name,
                original_destination=rule['destination'],
                original_service=rule['service'],
                source_interface=rule['source_interface'],
                destination_interface=rule['destination_interface'],
                enabled=rule['enabled'],
                remark=rule['remark'],
                original_text="\n".join(entry_lines)
            )
            config.nat_rules.append(nat_rule)

    def _parse_vip_entry(self, entry_lines: List[str], config: FirewallConfig, sequence_id: int):
        name = self._get_edit_value(entry_lines[0])
        vip_data = {
            "extip": None, "mappedip": None, "is_twice_nat": False,
            "src_filter": set(), "nat_ippool": None
        }
        for line in entry_lines[1:]:
            if line.startswith("set type twice-nat"):
                vip_data["is_twice_nat"] = True
            elif line.startswith("set extip"):
                vip_data["extip"] = self._get_set_value(line)
            elif line.startswith("set mappedip"):
                vip_data["mappedip"] = self._get_set_value(line).split('-')[0].strip()
            elif line.startswith("set src-filter"):
                vip_data["src_filter"].update(self._extract_multi_values(line))
            elif line.startswith("set nat-ippool"):
                vip_data["nat_ippool"] = self._get_set_value(line)
        if name and vip_data["extip"] and vip_data["mappedip"]:
            ext_addr_name = name
            mapped_ip = vip_data["mappedip"]
            mapped_addr_obj = next((addr for addr in config.addresses if addr.value1 == mapped_ip), None)
            if mapped_addr_obj:
                mapped_addr_name = mapped_addr_obj.name
            else:
                mapped_addr_name = f"h-{mapped_ip}"
                if not any(addr.name == mapped_addr_name for addr in config.addresses):
                    config.addresses.add(Address(name=mapped_addr_name, type='host', value1=mapped_ip))
            if not any(addr.name == ext_addr_name for addr in config.addresses):
                config.addresses.add(Address(name=ext_addr_name, type='host', value1=vip_data["extip"]))

            original_source = vip_data["src_filter"] if vip_data["is_twice_nat"] else {"all"}
            translated_source = vip_data["nat_ippool"] if vip_data["is_twice_nat"] else None

            nat_rule = NatRule(
                sequence_id=sequence_id,
                name=f"NAT_{name}",
                original_source=original_source,
                translated_source=translated_source,
                original_destination={ext_addr_name},
                translated_destination=mapped_addr_name,
                original_text="\n".join(entry_lines)
            )
            config.nat_rules.append(nat_rule)

    def _parse_central_snat_entry(self, entry_lines: List[str], config: FirewallConfig, sequence_id: int):
        original_policy_id = self._get_edit_value(entry_lines[0])
        nat_rule_data = {
            "sequence_id": sequence_id,
            "name": f"CentralNAT_{original_policy_id}",
            "original_source": set(),
            "translated_source": None,
            "original_destination": set(),
            "source_interface": set(),
            "destination_interface": set(),
            "enabled": True,
            "remark": None,
            "original_text": "\n".join(entry_lines)
        }
        for line in entry_lines[1:]:
            if line.startswith("set srcintf"):
                nat_rule_data["source_interface"].update(self._extract_multi_values(line))
            elif line.startswith("set dstintf"):
                nat_rule_data["destination_interface"].update(self._extract_multi_values(line))
            elif line.startswith("set orig-addr"):
                nat_rule_data["original_source"].update(self._extract_multi_values(line))
            elif line.startswith("set dst-addr"):
                nat_rule_data["original_destination"].update(self._extract_multi_values(line))
            elif line.startswith("set nat-ippool"):
                pools = self._extract_multi_values(line)
                nat_rule_data["translated_source"] = " ".join(pools)
            elif line.startswith("set status"):
                nat_rule_data["enabled"] = self._get_set_value(line) == "enable"
            elif line.startswith("set comments"):
                nat_rule_data["remark"] = self._get_set_value(line)

        if not nat_rule_data["original_source"]: nat_rule_data["original_source"].add("all")
        if not nat_rule_data["original_destination"]: nat_rule_data["original_destination"].add("all")

        config.nat_rules.append(NatRule(**nat_rule_data))
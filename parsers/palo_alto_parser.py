# -*- coding: utf-8 -*-
"""
File ini berisi parser untuk konfigurasi Palo Alto (format SET).
UPDATED: Added Conversion Warning collection.
"""
import re
from typing import List, Dict

from models import FirewallConfig, Address, Group, Service, ServiceGroup, Rule, NatRule, StaticRoute, Interface, ConversionWarning
from .base import BaseParser


class PaloAltoSetParser(BaseParser):
    """Parser untuk konfigurasi Palo Alto dalam format perintah 'set'."""
    # Updated Regex: Mendukung nama Device Group dengan spasi (quoted)
    _RE_PANORAMA = re.compile(r'set device-group\s+("[^"]+"|\S+)')
    # Updated Regex: Mendukung nama Template/Vsys dengan spasi, menggunakan non-capturing group (?:...) agar tidak mengacaukan index group regex lain
    _RE_TEMPLATE_VSYS_PREFIX = r'(?:template (?:\"[^\"]+\"|\S+) config devices (?:\"[^\"]+\"|\S+) )?(?:vsys (?:\"[^\"]+\"|\S+) )?'

    # [UPDATED] Regex Address untuk menangkap 'fqdn'
    _RE_ADDRESS = re.compile(
        r'set ' + _RE_TEMPLATE_VSYS_PREFIX + r'address ("[^"]+"|(?:[^\s]+))\s+(ip-netmask|ip-range|fqdn)\s+(.*)')
    _RE_SERVICE = re.compile(
        r'set ' + _RE_TEMPLATE_VSYS_PREFIX + r'service ("[^"]+"|[\w.-]+) protocol (tcp|udp) port ([\d-]+)')
    _RE_ADDR_GROUP = re.compile(
        r'set ' + _RE_TEMPLATE_VSYS_PREFIX + r'address-group ("[^"]+"|[\w.-]+) static \[\s*(.*?)\s*\]')
    _RE_SVC_GROUP = re.compile(
        r'set ' + _RE_TEMPLATE_VSYS_PREFIX + r'service-group ("[^"]+"|[\w.-]+) members \[\s*(.*?)\s*\]')
    _RE_SEC_RULE = re.compile(
        r'set ' + _RE_TEMPLATE_VSYS_PREFIX + r'(?:pre-rulebase|post-rulebase|rulebase) security rules ("[^"]+"|[\w.-]+) ([\w-]+) (.*)')
    _RE_NAT_RULE = re.compile(
        r'set ' + _RE_TEMPLATE_VSYS_PREFIX + r'(?:pre-rulebase|post-rulebase|rulebase) nat rules ("[^"]+"|[\w.-]+) ([\w-]+) (.*)')
    _RE_ZONE = re.compile(r'set ' + _RE_TEMPLATE_VSYS_PREFIX + r'network zone ("[^"]+"|[\w.-]+)')
    _RE_INTERFACE = re.compile(
        r'set ' + _RE_TEMPLATE_VSYS_PREFIX + r'network interface ethernet ("[^"]+"|[\w.-/]+) layer3 (.*)')

    # FIX: Regex Route yang lebih fleksibel untuk menangkap nama route dulu
    _RE_STATIC_ROUTE_BASE = re.compile(
        r'set ' + _RE_TEMPLATE_VSYS_PREFIX + r'network virtual-router (\S+) routing-table ip static-route ("[^"]+"|[\w.-]+) (.*)')

    _RE_NAT_TRANS = re.compile(
        r'static-ip\s+.*translated-address\s+("[^"]+"|[\w.-]+)|'
        r'dynamic-ip-and-port\s+.*address\s+("[^"]+"|[\w.-]+)|'
        r'dynamic-ip-and-port\s+.*interface-address\s+.*interface\s+("[^"]+"|[\w.-]+)'
    )
    _RE_NAT_DEST_TRANS = re.compile(r'translated-address ("[^"]+"|[\w.-]+)')
    _RE_IS_IP = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
    _RE_MEMBER_PARSER = re.compile(r'"[^"]+"|\S+')

    _DEFAULT_SERVICES = {
        "service-http": Service(name="service-http", protocol="tcp", port="eq 80"),
        "service-https": Service(name="service-https", protocol="tcp", port="eq 443"),
        "service-ftp": Service(name="service-ftp", protocol="tcp", port="eq 21"),
        "service-ssh": Service(name="service-ssh", protocol="tcp", port="eq 22"),
    }

    def parse(self, content: str, **kwargs) -> FirewallConfig:
        config = FirewallConfig()
        lines = [line.strip() for line in content.splitlines() if line.strip() and not line.strip().startswith('#')]

        rules_data: Dict[str, Dict] = {}
        nat_rules_data: Dict[str, Dict] = {}
        interface_data: Dict[str, Dict] = {}
        routes_data: Dict[str, Dict] = {}

        for line in lines:
            panorama_match = self._RE_PANORAMA.match(line)
            if panorama_match:
                line_without_dg = line[len(panorama_match.group(0)):].strip()
                processed_line = "set {}".format(line_without_dg)
            else:
                processed_line = line

            if self._RE_ADDRESS.match(processed_line):
                self._parse_address(processed_line, config)
            elif self._RE_SERVICE.match(processed_line):
                self._parse_service(processed_line, config)
            elif self._RE_ADDR_GROUP.match(processed_line):
                self._parse_address_group(processed_line, config)
            elif self._RE_SVC_GROUP.match(processed_line):
                self._parse_service_group(processed_line, config)
            elif self._RE_ZONE.match(processed_line):
                self._parse_zone(processed_line, config)
            elif self._RE_INTERFACE.match(processed_line):
                self._parse_interface_line(processed_line, interface_data)
            elif self._RE_STATIC_ROUTE_BASE.match(processed_line):
                self._parse_static_route_line(processed_line, routes_data)
            elif self._RE_SEC_RULE.match(processed_line):
                self._parse_rule_line(processed_line, rules_data, config)
            elif self._RE_NAT_RULE.match(processed_line):
                self._parse_nat_rule_line(processed_line, nat_rules_data, config)
            
            # --- [NEW] Catch Unparsed Lines ---
            else:
                # Filter out common noise
                if not any(k in processed_line for k in ['set cli', 'set mgt-config', 'set deviceconfig', 'set network profiles', 'set shared']):
                    config.conversion_warnings.append(ConversionWarning(
                        category='Parser', message='Skipped unparsed line', original_line=line, severity='info'
                    ))

        self._create_interface_objects(interface_data, config)
        self._create_rule_objects(rules_data, config)
        self._create_nat_rule_objects(nat_rules_data, config)
        self._create_route_objects(routes_data, config)

        return config

    def _is_ip_address(self, value: str) -> bool:
        if not value: return False
        return bool(self._RE_IS_IP.match(value))

    def _get_quoted_or_unquoted(self, text: str) -> str:
        return text.strip('"')

    def _ensure_default_service_exists(self, service_name: str, config: FirewallConfig):
        if service_name in self._DEFAULT_SERVICES:
            existing_service_names = {s.name for s in config.services}
            if service_name not in existing_service_names:
                config.services.add(self._DEFAULT_SERVICES[service_name])

    def _parse_zone(self, line: str, config: FirewallConfig):
        # KITA NONAKTIFKAN FUNGSI INI AGAR ZONE TIDAK MASUK KE DAFTAR INTERFACE
        pass

        # Kode Lama:
        # match = self._RE_ZONE.search(line)
        # if match:
        #     zone_name = self._get_quoted_or_unquoted(match.group(1))
        #     config.interfaces.add(Interface(name=zone_name, zone=zone_name))

    def _parse_interface_line(self, line: str, interface_data: Dict[str, Dict]):
        match = self._RE_INTERFACE.search(line)
        if not match: return

        if_name = self._get_quoted_or_unquoted(match.group(1))
        rest_of_line = match.group(2)

        if if_name not in interface_data:
            interface_data[if_name] = {}

        if " ip " in rest_of_line:
            ip_match = re.search(r'ip\s+\[\s*(\S+)\s*\]', rest_of_line)
            if ip_match:
                ip_cidr = ip_match.group(1)
                if '/' in ip_cidr:
                    ip, cidr = ip_cidr.split('/')
                    interface_data[if_name]['ip_address'] = ip
                    interface_data[if_name]['mask_length'] = int(cidr)
        elif " comment " in rest_of_line:
            comment_match = re.search(r'comment\s+(\S+)', rest_of_line)
            if comment_match:
                interface_data[if_name]['description'] = self._get_quoted_or_unquoted(comment_match.group(1))

    def _create_interface_objects(self, interface_data: Dict[str, Dict], config: FirewallConfig):
        for name, data in interface_data.items():
            iface = Interface(name=name, zone=name, **data)
            config.interfaces.add(iface)

    def _parse_static_route_line(self, line: str, routes_data: Dict[str, Dict]):
        match = self._RE_STATIC_ROUTE_BASE.search(line)
        if not match: return

        vr_name = match.group(1)
        route_name = self._get_quoted_or_unquoted(match.group(2))
        remainder = match.group(3)

        unique_key = f"{vr_name}::{route_name}"

        if unique_key not in routes_data:
            routes_data[unique_key] = {
                "destination": "0.0.0.0/0",
                "next_hop": None,
                "interface": None,
                "distance": 10,
                "comment": None
            }

        if remainder.startswith("destination "):
            routes_data[unique_key]["destination"] = remainder.replace("destination ", "").strip()
        elif "nexthop ip-address" in remainder:
            parts = remainder.split("nexthop ip-address")
            if len(parts) > 1:
                routes_data[unique_key]["next_hop"] = parts[1].strip()
        elif "interface" in remainder and "nexthop" not in remainder:
            parts = remainder.split("interface")
            if len(parts) > 1:
                routes_data[unique_key]["interface"] = parts[1].strip()
        elif "nexthop next-vr" in remainder:
            parts = remainder.split("nexthop next-vr")
            if len(parts) > 1:
                routes_data[unique_key]["next_hop"] = f"VR:{parts[1].strip()}"
        elif "metric" in remainder:
            parts = remainder.split("metric")
            if len(parts) > 1:
                try:
                    routes_data[unique_key]["distance"] = int(parts[1].strip())
                except:
                    pass

    def _create_route_objects(self, routes_data: Dict[str, Dict], config: FirewallConfig):
        for key, data in routes_data.items():
            if data["next_hop"] or data["interface"]:
                route = StaticRoute(
                    destination=data["destination"],
                    next_hop=data["next_hop"] or "Connected",
                    interface=data["interface"],
                    distance=data["distance"]
                )
                config.static_routes.append(route)

    def _parse_address(self, line: str, config: FirewallConfig):
        match = self._RE_ADDRESS.search(line)
        if not match: return
        name = self._get_quoted_or_unquoted(match.group(1))
        addr_type = match.group(2)
        value = match.group(3).strip()
        if addr_type == 'ip-netmask':
            if '/' in value:
                ip, cidr = value.split('/')
                if cidr == '32':
                    config.addresses.add(Address(name=name, type='host', value1=ip))
                else:
                    config.addresses.add(Address(name=name, type='network', value1=ip, value2=cidr))
            else:
                config.addresses.add(Address(name=name, type='host', value1=value))
        elif addr_type == 'ip-range':
            if '-' in value:
                val1, val2 = value.split('-')
                config.addresses.add(Address(name=name, type='range', value1=val1, value2=val2))
        elif addr_type == 'fqdn':
            # [NEW] Support for FQDN
            config.addresses.add(Address(name=name, type='fqdn', value1=self._get_quoted_or_unquoted(value)))

    def _parse_service(self, line: str, config: FirewallConfig):
        match = self._RE_SERVICE.search(line)
        if match:
            name = self._get_quoted_or_unquoted(match.group(1))
            protocol = match.group(2)
            port = match.group(3)
            port_def = "eq {}".format(port) if '-' not in port else "range {}".format(port.replace('-', ' '))
            config.services.add(Service(name=name, protocol=protocol, port=port_def))

    def _parse_address_group(self, line: str, config: FirewallConfig):
        match = self._RE_ADDR_GROUP.search(line)
        if match:
            name = self._get_quoted_or_unquoted(match.group(1))
            members_str = match.group(2)
            members = {self._get_quoted_or_unquoted(m) for m in self._RE_MEMBER_PARSER.findall(members_str)}
            config.address_groups.add(Group(name=name, members=members))

    def _parse_service_group(self, line: str, config: FirewallConfig):
        match = self._RE_SVC_GROUP.search(line)
        if match:
            name = self._get_quoted_or_unquoted(match.group(1))
            members_str = match.group(2)
            members = {self._get_quoted_or_unquoted(m) for m in self._RE_MEMBER_PARSER.findall(members_str)}
            for member_name in members:
                self._ensure_default_service_exists(member_name, config)
            config.service_groups.add(ServiceGroup(name=name, members=members))

    def _parse_rule_line(self, line: str, rules_data: Dict[str, Dict], config: FirewallConfig):
        match = self._RE_SEC_RULE.search(line)
        if not match: return
        rule_name = self._get_quoted_or_unquoted(match.group(1))
        key = match.group(2)
        value_str = match.group(3)
        if rule_name not in rules_data:
            rules_data[rule_name] = {
                "original_text": [], "service": set(), "application": set(),
                "source_interface": set(), "destination_interface": set()
            }
        rules_data[rule_name]["original_text"].append(line)
        if key == 'from' or key == 'to':
            interface_key = 'source_interface' if key == 'from' else 'destination_interface'
            value_str_cleaned = value_str.strip('[ ]')
            members = {self._get_quoted_or_unquoted(m) for m in self._RE_MEMBER_PARSER.findall(value_str_cleaned)}
            rules_data[rule_name][interface_key].update(members)
        elif key in ['source', 'destination', 'service', 'application']:
            value_str_cleaned = value_str.strip('[ ]')
            members = {self._get_quoted_or_unquoted(m) for m in self._RE_MEMBER_PARSER.findall(value_str_cleaned)}
            if key == 'service':
                if value_str.strip() == 'application-default':
                    rules_data[rule_name]['service'].add('application-default')
                else:
                    for member_name in members:
                        self._ensure_default_service_exists(member_name, config)
                    rules_data[rule_name]['service'].update(members)
            elif key == 'application':
                rules_data[rule_name]['application'].update(members)
            else:
                rules_data[rule_name][key] = members
        elif key == 'disabled' and value_str == 'yes':
            rules_data[rule_name]['enabled'] = False
        elif key == 'description':
            rules_data[rule_name]['remark'] = self._get_quoted_or_unquoted(value_str)
        else:
            rules_data[rule_name][key] = value_str

    def _create_rule_objects(self, rules_data: Dict[str, Dict], config: FirewallConfig):
        seq_id = 1
        for name, data in rules_data.items():
            action = data.get('action', 'deny')
            rule = Rule(
                sequence_id=seq_id,
                name=name,
                action="allow" if action == "allow" else "deny",
                source=data.get('source', {'any'}),
                destination=data.get('destination', {'any'}),
                service=data.get('service', {'any'}),
                application=data.get('application', set()),
                source_interface=data.get('source_interface') or {'any'},
                destination_interface=data.get('destination_interface') or {'any'},
                enabled=data.get('enabled', True),
                remark=data.get('remark'),
                original_text="\n".join(data.get("original_text", []))
            )
            config.rules.append(rule)
            seq_id += 1

    def _parse_nat_rule_line(self, line: str, nat_rules_data: Dict[str, Dict], config: FirewallConfig):
        match = self._RE_NAT_RULE.search(line)
        if not match: return
        rule_name = self._get_quoted_or_unquoted(match.group(1))
        key = match.group(2)
        value_str = match.group(3).strip()
        if rule_name not in nat_rules_data:
            nat_rules_data[rule_name] = {
                "original_text": [], "source": set(), "translated_source": None,
                "destination": set(), "translated_destination": None, "service": None,
                "source_interface": set(), "destination_interface": set(),
                "enabled": True, "remark": None
            }
        nat_rules_data[rule_name]["original_text"].append(line)
        if key in ['source', 'destination']:
            members_str = value_str.strip('[ ]')
            final_members = set()
            for m_str in self._RE_MEMBER_PARSER.findall(members_str):
                member_name = self._get_quoted_or_unquoted(m_str)
                if self._is_ip_address(member_name):
                    obj_name = "h-{}".format(member_name)
                    if not any(addr.name == obj_name for addr in config.addresses):
                        config.addresses.add(Address(name=obj_name, type='host', value1=member_name))
                    final_members.add(obj_name)
                else:
                    final_members.add(member_name)
            nat_rules_data[rule_name][key] = final_members
        elif key == 'from' or key == 'to':
            interface_key = 'source_interface' if key == 'from' else 'destination_interface'
            value_str_cleaned = value_str.strip('[ ]')
            members = {self._get_quoted_or_unquoted(m) for m in self._RE_MEMBER_PARSER.findall(value_str_cleaned)}
            nat_rules_data[rule_name][interface_key].update(members)
        elif key == 'service':
            nat_rules_data[rule_name]['service'] = self._get_quoted_or_unquoted(value_str)
        elif key == 'source-translation':
            if 'bi-directional yes' in value_str:
                nat_rules_data[rule_name]['is_bidirectional'] = True
            translation_match = self._RE_NAT_TRANS.search(value_str)
            if translation_match:
                static_ip_val, dynamic_ip_addr_val, interface_addr = translation_match.groups()
                value_to_process = None
                if static_ip_val:
                    value_to_process = self._get_quoted_or_unquoted(static_ip_val)
                elif dynamic_ip_addr_val:
                    value_to_process = self._get_quoted_or_unquoted(dynamic_ip_addr_val)
                if value_to_process:
                    if self._is_ip_address(value_to_process):
                        obj_name = "h-{}".format(value_to_process)
                        if not any(addr.name == obj_name for addr in config.addresses):
                            config.addresses.add(Address(name=obj_name, type='host', value1=value_to_process))
                        nat_rules_data[rule_name]['translated_source'] = obj_name
                    else:
                        nat_rules_data[rule_name]['translated_source'] = value_to_process
                elif interface_addr:
                    nat_rules_data[rule_name]['translated_source'] = 'dynamic-ip-and-port'
            elif 'dynamic-ip-and-port' in value_str:
                nat_rules_data[rule_name]['translated_source'] = 'dynamic-ip-and-port'
        elif key == 'destination-translation':
            trans_addr_match = self._RE_NAT_DEST_TRANS.search(value_str)
            if trans_addr_match:
                value = self._get_quoted_or_unquoted(trans_addr_match.group(1))
                if self._is_ip_address(value):
                    obj_name = "h-{}".format(value)
                    if not any(addr.name == obj_name for addr in config.addresses):
                        config.addresses.add(Address(name=obj_name, type='host', value1=value))
                    nat_rules_data[rule_name]['translated_destination'] = obj_name
                else:
                    nat_rules_data[rule_name]['translated_destination'] = value
        elif key == 'disabled' and value_str == 'yes':
            nat_rules_data[rule_name]['enabled'] = False
        elif key == 'description':
            nat_rules_data[rule_name]['remark'] = self._get_quoted_or_unquoted(value_str)

    def _create_nat_rule_objects(self, nat_rules_data: Dict[str, Dict], config: FirewallConfig):
        seq_id = 1
        final_nat_rules = []
        for name, data in nat_rules_data.items():
            translated_source = data.get('translated_source') or None
            translated_destination = data.get('translated_destination') or None
            primary_rule = NatRule(
                sequence_id=seq_id, name=name,
                original_source=data.get('source') or {'any'},
                translated_source=translated_source,
                original_destination=data.get('destination') or {'any'},
                translated_destination=translated_destination,
                original_service={data.get('service') or 'any'},
                source_interface=data.get('source_interface') or {'any'},
                destination_interface=data.get('destination_interface') or {'any'},
                enabled=data.get('enabled', True), remark=data.get('remark'),
                original_text="\n".join(data.get("original_text", []))
            )
            final_nat_rules.append(primary_rule)
            seq_id += 1
            if data.get('is_bidirectional') and translated_source and data.get('source'):
                original_source_members = data.get('source')
                if original_source_members:
                    internal_object_name = list(original_source_members)[0]
                    dnat_rule = NatRule(
                        sequence_id=seq_id, name="DNAT_of_{}".format(name),
                        original_source={'any'}, original_destination={translated_source},
                        translated_destination=internal_object_name, translated_source=None,
                        original_service={data.get('service') or 'any'},
                        source_interface=data.get('destination_interface') or {'any'},
                        destination_interface=data.get('source_interface') or {'any'},
                        enabled=data.get('enabled', True),
                        remark="Auto-generated DNAT for bi-directional rule {}".format(name),
                        original_text=primary_rule.original_text
                    )
                    final_nat_rules.append(dnat_rule)
                    seq_id += 1
        config.nat_rules.extend(final_nat_rules)
# -*- coding: utf-8 -*-
"""
File ini berisi parser untuk konfigurasi Juniper SRX (format SET).
"""
import re
from typing import List, Dict

from models import FirewallConfig, Address, Group, Service, ServiceGroup, Rule, NatRule, StaticRoute, Interface
from .base import BaseParser


class JuniperSrxParser(BaseParser):
    """Parser untuk konfigurasi Juniper SRX."""
    _RE_STATIC_ROUTE = re.compile(r'set routing-options static route (\S+) next-hop (\S+)')
    _RE_ADDRESS = re.compile(r'set security address-book \S+ address (\S+) (\S+)')
    _RE_ADDR_SET = re.compile(r'set security address-book \S+ address-set (\S+) address (\S+)')
    _RE_APP = re.compile(r'set applications application (\S+) protocol (\S+) destination-port (\S+)')
    _RE_APP_SET = re.compile(r'set applications application-set (\S+) application (\S+)')
    _RE_POLICY = re.compile(r'set security policies from-zone (\S+) to-zone (\S+) policy (\S+) match')
    _RE_INTERFACE = re.compile(r'set interfaces (\S+) unit \d+ family inet address (\S+)')
    _RE_ZONE_INTERFACE = re.compile(r'set security zones security-zone (\S+) interfaces (\S+)')

    def parse(self, content: str, **kwargs) -> FirewallConfig:
        config = FirewallConfig()
        lines = [line.strip() for line in content.splitlines() if line.strip()]

        policy_data: Dict[str, Dict] = {}
        nat_rules_data: Dict[str, Dict] = {}

        # Pass 1: Kumpulkan semua data mentah
        for line in lines:
            if line.startswith("set security address-book"):
                self._parse_address_line(line, config)
            elif line.startswith("set applications application"):
                self._parse_app_line(line, config)
            elif line.startswith("set security policies"):
                self._parse_policy_line(line, policy_data)
            elif line.startswith("set security nat"):
                self._parse_nat_rule_line(line, nat_rules_data)
            elif line.startswith("set routing-options static route"):
                self._parse_static_route(line, config)
            elif line.startswith("set interfaces"):
                self._parse_interface(line, config)
            elif line.startswith("set security zones security-zone"):
                self._parse_zone_interface(line, config)

        self._create_policy_objects(policy_data, config)
        self._create_nat_rule_objects(nat_rules_data, config)

        return config

    def _get_quoted_or_unquoted(self, text: str) -> str:
        return text.strip('"')

    def _parse_interface(self, line: str, config: FirewallConfig):
        match = self._RE_INTERFACE.match(line)
        if match:
            if_name, ip_cidr = match.groups()
            ip, cidr = ip_cidr.split('/')

            iface_obj = next((i for i in config.interfaces if i.name == if_name), None)
            if not iface_obj:
                iface_obj = Interface(name=if_name)
                config.interfaces.add(iface_obj)

            iface_obj.ip_address = ip
            iface_obj.mask_length = int(cidr)

    def _parse_zone_interface(self, line: str, config: FirewallConfig):
        match = self._RE_ZONE_INTERFACE.match(line)
        if match:
            zone_name, if_name = match.groups()
            iface_obj = next((i for i in config.interfaces if i.name == if_name), None)
            if not iface_obj:
                iface_obj = Interface(name=if_name)
                config.interfaces.add(iface_obj)
            iface_obj.zone = zone_name

    def _parse_static_route(self, line: str, config: FirewallConfig):
        match = self._RE_STATIC_ROUTE.match(line)
        if match:
            destination, next_hop = match.groups()
            route = StaticRoute(destination=destination, next_hop=next_hop)
            config.static_routes.append(route)

    def _parse_address_line(self, line: str, config: FirewallConfig):
        addr_match = self._RE_ADDRESS.match(line)
        if addr_match:
            name, value = addr_match.groups()
            if '/' in value:
                ip, cidr = value.split('/')
                addr_type = 'host' if cidr == '32' else 'network'
                config.addresses.add(
                    Address(name=name, type=addr_type, value1=ip, value2=None if addr_type == 'host' else cidr))

        set_match = self._RE_ADDR_SET.match(line)
        if set_match:
            group_name, member_name = set_match.groups()
            group = next((g for g in config.address_groups if g.name == group_name), None)
            if not group:
                group = Group(name=group_name)
                config.address_groups.add(group)
            group.members.add(member_name)

    def _parse_app_line(self, line: str, config: FirewallConfig):
        app_match = self._RE_APP.match(line)
        if app_match:
            name, protocol, port = app_match.groups()
            port_def = f"eq {port}" if '-' not in port else f"range {port.replace('-', ' ')}"
            config.services.add(Service(name=name, protocol=protocol, port=port_def))

        set_match = self._RE_APP_SET.match(line)
        if set_match:
            group_name, member_name = set_match.groups()
            group = next((g for g in config.service_groups if g.name == group_name), None)
            if not group:
                group = ServiceGroup(name=group_name)
                config.service_groups.add(group)
            group.members.add(member_name)

    def _parse_policy_line(self, line: str, policy_data: Dict[str, Dict]):
        match = self._RE_POLICY.match(line)
        if not match: return

        from_zone, to_zone, name = match.groups()
        policy_key = f"{from_zone}_{to_zone}_{name}"

        if policy_key not in policy_data:
            policy_data[policy_key] = {
                "name": name, "source_interface": {from_zone}, "destination_interface": {to_zone},
                "source": set(), "destination": set(), "application": set()
            }

        rest_of_line = line.split("match ", 1)[1]
        parts = rest_of_line.split()
        if len(parts) >= 2:
            key = parts[0]
            values = [v for v in parts[1:] if v not in ['[', ']']]
            if key in ['source-address', 'destination-address', 'application']:
                policy_data[policy_key][key.replace('-address', '')].update(values)

        then_match = re.search(r'then (permit|deny)', line)
        if then_match:
            policy_data[policy_key]['action'] = "allow" if then_match.group(1) == 'permit' else 'deny'

    def _create_policy_objects(self, policy_data: Dict[str, Dict], config: FirewallConfig):
        seq_id = 1
        for key, data in policy_data.items():
            rule = Rule(
                sequence_id=seq_id,
                name=data.get('name'),
                source_interface=data.get('source_interface'),
                destination_interface=data.get('destination_interface'),
                action=data.get('action', 'deny'),
                source=data.get('source') or {'any'},
                destination=data.get('destination') or {'any'},
                service=data.get('application') or {'any'}
            )
            config.rules.append(rule)
            seq_id += 1

    def _parse_nat_rule_line(self, line: str, nat_rules_data: Dict[str, Dict]):
        match = re.search(r'set security nat (source|destination|static) rule-set (\S+) rule (\S+) (.*)', line)
        if not match: return

        nat_type, rule_set_name, rule_name, rest_of_line = match.groups()
        nat_rule_key = f"{nat_type}-{rule_set_name}-{rule_name}"

        if nat_rule_key not in nat_rules_data:
            nat_rules_data[nat_rule_key] = {"name": f"NAT_{rule_set_name}_{rule_name}", "original_text": [],
                                            "original_source": set(), "original_destination": set()}

        nat_rules_data[nat_rule_key]["original_text"].append(line)

        if rest_of_line.startswith("match"):
            if "source-address" in rest_of_line:
                addr_match = re.search(r'source-address (\S+)', rest_of_line)
                if addr_match: nat_rules_data[nat_rule_key]["original_source"].add(addr_match.group(1))
            elif "destination-address" in rest_of_line:
                addr_match = re.search(r'destination-address (\S+)', rest_of_line)
                if addr_match: nat_rules_data[nat_rule_key]["original_destination"].add(addr_match.group(1))

        elif rest_of_line.startswith("then"):
            if nat_type == "source":
                pool_match = re.search(r'source-nat pool (\S+)', rest_of_line)
                if pool_match: nat_rules_data[nat_rule_key]["translated_source"] = pool_match.group(1)
            elif nat_type == "destination":
                pool_match = re.search(r'destination-nat pool (\S+)', rest_of_line)
                if pool_match: nat_rules_data[nat_rule_key]["translated_destination"] = pool_match.group(1)
            elif nat_type == "static":
                static_match = re.search(r'static-nat prefix (\S+)', rest_of_line)
                if static_match: nat_rules_data[nat_rule_key]["translated_destination"] = static_match.group(1)

    def _create_nat_rule_objects(self, nat_rules_data: Dict[str, Dict], config: FirewallConfig):
        seq_id = 1
        for key, data in nat_rules_data.items():
            nat_rule = NatRule(
                sequence_id=seq_id,
                name=data.get('name'),
                original_source=data.get('original_source') or {'any'},
                translated_source=data.get('translated_source'),
                original_destination=data.get('original_destination') or {'any'},
                translated_destination=data.get('translated_destination'),
                original_text="\n".join(data.get("original_text", []))
            )
            config.nat_rules.append(nat_rule)
            seq_id += 1

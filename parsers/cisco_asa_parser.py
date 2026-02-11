# -*- coding: utf-8 -*-
"""
File ini berisi parser untuk konfigurasi Cisco ASA.
Updated: Fix 'router' keyword being consumed by object parsers.
Updated: Enhanced NAT regex to support 'service' keyword and better dynamic interface handling.
FIXED: Added support for 'group-object' inside service-groups to handle nested groups.
FIXED: Added support for FQDN objects.
UPDATED: Added Conversion Warning collection for unparsed lines.
"""
import re
from typing import List, Set, Dict

from models import FirewallConfig, Address, Group, Service, ServiceGroup, Rule, TimeRange, NatRule, StaticRoute, \
    Interface, ConversionWarning
from .base import BaseParser


class CiscoAsaParser(BaseParser):
    """Parser untuk konfigurasi Cisco ASA dengan dukungan pembersihan log PuTTY."""
    _RE_OBJ_NAME = re.compile(r'object(?:-group)? (?:network|service) (\S+)')
    _RE_TIME_RANGE = re.compile(r'time-range (\S+)')
    _RE_OBJ_NETWORK = re.compile(r'object network (\S+)')
    _RE_HOST = re.compile(r'host (\S+)')
    _RE_SUBNET = re.compile(r'subnet (\S+) (\S+)')
    _RE_RANGE = re.compile(r'range (\S+) (\S+)')
    _RE_FQDN = re.compile(r'fqdn (\S+)')  # [NEW] Regex for FQDN

    # UPDATED REGEX: Supports optional 'service' and 'unidirectional' at the end
    # Format: nat (src_intf,dst_intf) type mapped_obj [service proto real_port mapped_port] [unidirectional]
    _RE_OBJ_NAT = re.compile(
        r'nat \((.+?),(.+?)\) (dynamic|static) (\S+)(?: service (\S+) (\S+) (\S+))?(?: unidirectional)?')

    _RE_MANUAL_TWICE_NAT = re.compile(r'nat \((.+?),(.+?)\).*source static (\S+) (\S+) destination static (\S+) (\S+)')
    _RE_MANUAL_STATIC_NAT = re.compile(r'nat \((.+?),(.+?)\).*source static (\S+) (\S+?)( unidirectional)?$')
    _RE_MANUAL_DYNAMIC_PAT = re.compile(r'nat \((.+?),(.+?)\).*source dynamic (\S+) interface')
    _RE_MANUAL_DYNAMIC_NAT = re.compile(r'nat \((.+?),(.+?)\).*source dynamic (\S+) (\S+)')
    _RE_OBJ_SERVICE = re.compile(r'object service (\S+)')
    _RE_SERVICE_DEF = re.compile(r'service (tcp|udp) destination (eq|range) (.*)')
    _RE_ADDR_GROUP = re.compile(r'object-group network (\S+)')
    _RE_NET_OBJ = re.compile(r'network-object object (\S+)')
    _RE_NET_HOST = re.compile(r'network-object host (\S+)')
    _RE_NET_SUBNET = re.compile(r'network-object (\S+) (\S+)')
    _RE_GROUP_OBJ = re.compile(r'group-object (\S+)')
    _RE_IP_MASK = re.compile(r'\d{1,3}(\.\d{1,3}){3}')
    _RE_SVC_GROUP = re.compile(r'object-group service (\S+)(?: (tcp|udp|tcp-udp))?')
    _RE_SVC_OBJ_OBJ = re.compile(r'service-object object (\S+)')
    _RE_PORT_OBJ = re.compile(r'port-object (eq|range) (.*)')
    _RE_SVC_OBJ_MATCH = re.compile(r'service-object (\S+)(?: destination)? (eq|range) (.*)')
    _RE_SVC_OBJ_PROTO = re.compile(r'service-object (icmp|esp)(?: (echo|echo-reply|traceroute))?$')
    _RE_RULE_TIME_RANGE = re.compile(r'time-range (\S+)')
    _RE_CLEAN_RULE = re.compile(r'\s+log.*$|\s+inactive$|\s+time-range \S+$')

    _RE_INTERFACE_BLOCK = re.compile(r'^interface (\S+)')

    STOP_TOKENS = ('object', 'access-list', 'hostname', ': end', 'time-range', 'interface ', 'route ', 'router ',
                   'nat ')

    def _clean_line(self, line: str) -> str:
        """Membersihkan baris dari ANSI escape codes dan noise PuTTY."""
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        line = ansi_escape.sub('', line)
        line = line.replace('\xa0', ' ').replace('\t', ' ')
        return "".join(char for char in line if char.isprintable()).strip()

    def parse(self, content: str, **kwargs) -> FirewallConfig:
        config = FirewallConfig()
        raw_lines = content.splitlines()
        lines = [self._clean_line(l) for l in raw_lines]

        context_blocks = self._split_into_contexts(lines)
        duplicates = self._discover_duplicates(context_blocks)

        rule_seq_counter = 1
        nat_seq_counter = 1

        print(f"DEBUG: Memulai parsing Cisco ASA. Total baris: {len(lines)}")

        for context_name, block_lines in context_blocks.items():
            last_remark = None
            i = 0
            while i < len(block_lines):
                line = block_lines[i]
                line_lower = line.lower()

                if not line or line.startswith('!') or line.startswith(':'):
                    i += 1
                    continue

                if line_lower.startswith('access-list') and ' remark ' in line_lower:
                    try:
                        parts = re.split(r' remark ', line, flags=re.IGNORECASE)
                        if len(parts) > 1:
                            last_remark = parts[1].strip()
                    except IndexError:
                        pass
                    i += 1
                    continue

                # --- Routing (OSPF/BGP/Static) ---
                if line_lower.startswith('router ospf'):
                    i = self._parse_router_ospf(i, block_lines, config)
                elif line_lower.startswith('router bgp'):
                    i = self._parse_router_bgp(i, block_lines, config)
                elif line_lower.startswith('route '):
                    self._parse_static_route(line, config)
                    i += 1

                # --- Interfaces ---
                elif line_lower.startswith('interface '):
                    i = self._parse_interface_block(i, block_lines, config)

                # --- Objects & Groups ---
                elif line_lower.startswith('object network'):
                    i, nat_seq_counter = self._parse_object_network(i, block_lines, config, context_name, duplicates,
                                                                    nat_seq_counter)
                elif line_lower.startswith('object service'):
                    i = self._parse_object_service(i, block_lines, config, context_name, duplicates)
                elif line_lower.startswith('object-group network'):
                    i = self._parse_address_group(i, block_lines, config, context_name, duplicates)
                elif line_lower.startswith('object-group service'):
                    i = self._parse_service_group(i, block_lines, config, context_name, duplicates)
                elif line_lower.startswith('time-range'):
                    i = self._parse_time_range(i, block_lines, config, context_name, duplicates)

                # --- Rules & NAT ---
                elif line_lower.startswith('access-list'):
                    rule_seq_counter = self._parse_rule(line, config, context_name, duplicates, rule_seq_counter,
                                                        last_remark)
                    last_remark = None
                    i += 1
                elif line_lower.startswith('nat ('):
                    nat_seq_counter = self._parse_nat_rule_line(line, config, context_name, duplicates, nat_seq_counter)
                    i += 1
                
                # --- [NEW] Catch Unparsed Lines ---
                else:
                    # Filter out common noise
                    if not any(k in line_lower for k in ['hostname', 'domain-name', 'names', 'pager', 'logging', 'aaa', 'ssh', 'http', 'console', 'terminal', 'crypto', 'policy-map', 'class-map', 'service-policy']):
                        config.conversion_warnings.append(ConversionWarning(
                            category='Parser',
                            message='Skipped unparsed line',
                            original_line=line,
                            severity='info'
                        ))
                    i += 1

        print(f"DEBUG: Parsing selesai. Total Routes: {len(config.static_routes)}")
        return config

    def _parse_static_route(self, line: str, config: FirewallConfig):
        """Parsing baris rute statis Cisco ASA."""
        parts = line.split()
        if len(parts) < 5: return

        iface = parts[1]
        dest_ip = parts[2]
        dest_mask = parts[3]
        next_hop = parts[4]
        distance = 1

        if len(parts) > 5 and parts[5].isdigit():
            distance = int(parts[5])

        if dest_ip == "0.0.0.0" and dest_mask == "0.0.0.0":
            destination = "0.0.0.0/0"
        else:
            try:
                cidr = self._mask_to_cidr(dest_mask)
                destination = f"{dest_ip}/{cidr}"
            except:
                destination = f"{dest_ip}/{dest_mask}"

        config.static_routes.append(StaticRoute(
            destination=destination,
            next_hop=next_hop,
            interface=iface,
            distance=distance
        ))

    def _parse_router_ospf(self, index: int, lines: List[str], config: FirewallConfig) -> int:
        """Parsing blok OSPF."""
        ospf_block_lines = []
        i = index
        if i < len(lines):
            ospf_block_lines.append(lines[i])

        i += 1
        while i < len(lines):
            line = lines[i]
            line_lower = line.lower()

            if i > index and line_lower.startswith(self.STOP_TOKENS):
                break

            if line: ospf_block_lines.append(line)

            if line_lower.startswith("network"):
                parts = line.split()
                if len(parts) >= 3:
                    ip = parts[1]
                    mask = parts[2]
                    destination = f"{ip} {mask}"
                    try:
                        cidr = self._mask_to_cidr(mask)
                        destination = f"{ip}/{cidr}"
                    except:
                        pass

                    config.static_routes.append(StaticRoute(
                        destination=destination,
                        next_hop="Dynamic-OSPF",
                        interface="ospf",
                        distance=110,
                        metric=110,
                        route_type="ospf",
                        comment=f"Imported from OSPF: {line}"
                    ))
            i += 1

        if ospf_block_lines and hasattr(config, 'dynamic_routing_config'):
            config.dynamic_routing_config += "\n".join(ospf_block_lines) + "\n\n"

        return i

    def _parse_router_bgp(self, index: int, lines: List[str], config: FirewallConfig) -> int:
        bgp_block_lines = []
        if index < len(lines):
            bgp_block_lines.append(lines[index])

        i = index + 1
        while i < len(lines):
            line = lines[i]
            line_lower = line.lower()

            if i > index and line_lower.startswith(self.STOP_TOKENS):
                break

            if line: bgp_block_lines.append(line)

            if line_lower.startswith("network"):
                parts = line.split()
                if len(parts) >= 2:
                    ip = parts[1]
                    mask = "255.255.255.0"
                    if "mask" in parts:
                        try:
                            mask_idx = parts.index("mask")
                            if mask_idx + 1 < len(parts): mask = parts[mask_idx + 1]
                        except:
                            pass

                    destination = f"{ip} {mask}"
                    try:
                        cidr = self._mask_to_cidr(mask)
                        destination = f"{ip}/{cidr}"
                    except:
                        pass

                    config.static_routes.append(StaticRoute(
                        destination=destination,
                        next_hop="Dynamic-BGP",
                        interface="bgp",
                        distance=20,
                        metric=20,
                        route_type="bgp",
                        comment=f"Imported from BGP: {line}"
                    ))
            i += 1

        if bgp_block_lines and hasattr(config, 'dynamic_routing_config'):
            config.dynamic_routing_config += "\n".join(bgp_block_lines) + "\n\n"
        return i

    def _parse_interface_block(self, index: int, lines: List[str], config: FirewallConfig) -> int:
        match = self._RE_INTERFACE_BLOCK.match(lines[index])
        if not match: return index + 1
        iface_data = {'name': match.group(1)}
        i = index + 1
        while i < len(lines):
            line = lines[i]
            if line.lower().startswith(self.STOP_TOKENS): break
            if not line or line.startswith('!'): i += 1; continue

            if line.startswith("nameif "):
                iface_data['zone'] = line.split()[1]
            elif line.startswith("description "):
                parts = line.split(" ", 1)
                if len(parts) > 1: iface_data['description'] = parts[1]
            elif line.startswith("ip address "):
                parts = line.split()
                if len(parts) >= 3:
                    iface_data['ip_address'] = parts[2]
                    if len(parts) > 3: iface_data['mask_length'] = self._mask_to_cidr(parts[3])
            elif line.startswith("vlan "):
                try:
                    iface_data['vlan_id'] = int(line.split()[1])
                except:
                    pass
            i += 1
        config.interfaces.add(Interface(**iface_data))
        return i

    def _split_into_contexts(self, lines: List[str]) -> Dict[str, List[str]]:
        return {'default': lines}

    def _discover_duplicates(self, context_blocks: Dict[str, List[str]]) -> Set[str]:
        all_names = {}
        for context, blks in context_blocks.items():
            for line in blks:
                match = self._RE_OBJ_NAME.match(line)
                if match:
                    name = match.group(1)
                    all_names[name] = all_names.get(name, 0) + 1
        return {name for name, count in all_names.items() if count > 1}

    def _get_new_name(self, original_name, context_name, duplicates):
        if original_name in duplicates and context_name != 'default':
            return f"{original_name}_{context_name}"
        return original_name

    def _parse_time_range(self, index, lines, config, context_name, duplicates):
        match = self._RE_TIME_RANGE.search(lines[index])
        if not match: return index + 1
        original_name = match.group(1)
        new_name = self._get_new_name(original_name, context_name, duplicates)
        time_range = TimeRange(name=new_name, original_text=lines[index])
        i = index + 1
        while i < len(lines) and not lines[i].lower().startswith(self.STOP_TOKENS): i += 1
        config.time_ranges.add(time_range)
        return i

    def _parse_object_network(self, index, lines, config, context, duplicates, nat_counter):
        match = self._RE_OBJ_NETWORK.match(lines[index])
        if not match: return index + 1, nat_counter
        name = self._get_new_name(match.group(1), context, duplicates)
        i = index + 1

        while i < len(lines) and not lines[i].lower().startswith(self.STOP_TOKENS):
            line = lines[i]
            if line.startswith('host '):
                config.addresses.add(
                    Address(name=name, type='host', value1=line.split()[1], original_text=lines[index] + "\n" + line))
            elif line.startswith('subnet '):
                parts = line.split()
                if len(parts) >= 3:
                    config.addresses.add(
                        Address(name=name, type='network', value1=parts[1], value2=str(self._mask_to_cidr(parts[2])),
                                original_text=lines[index] + "\n" + line))
            elif line.startswith('range '):
                parts = line.split()
                if len(parts) >= 3:
                    config.addresses.add(Address(name=name, type='range', value1=parts[1], value2=parts[2],
                                                 original_text=lines[index] + "\n" + line))
            elif line.startswith('fqdn '):
                # [NEW] Support for FQDN
                parts = line.split()
                if len(parts) >= 2:
                    fqdn_val = parts[1]
                    config.addresses.add(Address(name=name, type='fqdn', value1=fqdn_val,
                                                 original_text=lines[index] + "\n" + line))

            elif line.startswith('nat ('):
                # Update: Gunakan regex baru yang mendukung 'service' dan 'interface'
                nat_match = self._RE_OBJ_NAT.search(line)
                if nat_match:
                    src_intf, dst_intf, nat_type, translated_val, svc_proto, svc_real, svc_mapped = nat_match.groups()

                    # Normalisasi translated_val
                    if translated_val == 'interface':
                        translated_source = 'dynamic-ip-and-port'
                    else:
                        translated_source = translated_val.strip()

                    # Handle Service Translation (PAT)
                    original_service = None
                    translated_service = None

                    if svc_proto and svc_real and svc_mapped:
                        original_service = {f"{svc_proto}/{svc_real}"}
                        translated_service = f"{svc_proto}/{svc_mapped}"

                    config.nat_rules.append(NatRule(
                        sequence_id=nat_counter,
                        name=f"NAT_{name}",
                        source_interface={src_intf.strip()},
                        destination_interface={dst_intf.strip()},
                        original_source={name},
                        translated_source=translated_source,
                        original_service=original_service,
                        translated_service=translated_service,
                        original_text=line
                    ))
                    nat_counter += 1
            i += 1
        return i, nat_counter

    def _parse_object_service(self, index, lines, config, context, duplicates):
        match = self._RE_OBJ_SERVICE.match(lines[index])
        if not match: return index + 1
        name = self._get_new_name(match.group(1), context, duplicates)
        i = index + 1
        while i < len(lines) and not lines[i].lower().startswith(self.STOP_TOKENS):
            line = lines[i]
            svc_match = self._RE_SERVICE_DEF.search(line)
            if svc_match:
                protocol, op, ports_raw = svc_match.groups()
                config.services.add(Service(name=name, protocol=protocol, port=f"{op} {ports_raw.strip()}",
                                            original_text=lines[index] + "\n" + line))
            i += 1
        return i

    def _parse_address_group(self, index, lines, config, context, duplicates):
        match = self._RE_ADDR_GROUP.match(lines[index])
        if not match: return index + 1
        group = Group(name=self._get_new_name(match.group(1), context, duplicates))
        i = index + 1
        while i < len(lines) and not lines[i].lower().startswith(self.STOP_TOKENS):
            line = lines[i]
            if 'network-object object' in line:
                parts = line.split()
                if len(parts) >= 3: group.members.add(self._get_new_name(parts[2], context, duplicates))
            elif 'network-object host' in line:
                parts = line.split()
                if len(parts) >= 3:
                    ip = parts[2]
                    config.addresses.add(Address(name=f"host_{ip}", type='host', value1=ip))
                    group.members.add(f"host_{ip}")
            elif 'network-object' in line:
                parts = line.split()
                if len(parts) >= 3:
                    ip, mask = parts[1], parts[2]
                    cidr = self._mask_to_cidr(mask)
                    net_name = f"net_{ip}_{cidr}"
                    config.addresses.add(Address(name=net_name, type='network', value1=ip, value2=str(cidr)))
                    group.members.add(net_name)
            i += 1
        config.address_groups.add(group)
        return i

    def _parse_service_group(self, index, lines, config, context, duplicates):
        match = self._RE_SVC_GROUP.match(lines[index])
        if not match: return index + 1
        group_name = self._get_new_name(match.group(1), context, duplicates)
        default_proto = match.group(2) if match.lastindex >= 2 else None
        group = ServiceGroup(name=group_name)
        i = index + 1
        while i < len(lines) and not lines[i].lower().startswith(self.STOP_TOKENS):
            line = lines[i]
            # [FIXED] Added support for group-object inside service groups
            if 'service-object object' in line:
                parts = line.split()
                if len(parts) >= 3: group.members.add(self._get_new_name(parts[2], context, duplicates))
            elif 'group-object' in line:
                parts = line.split()
                if len(parts) >= 2: group.members.add(self._get_new_name(parts[1], context, duplicates))
            elif 'port-object' in line and default_proto:
                po_match = self._RE_PORT_OBJ.search(line)
                if po_match:
                    op, val = po_match.group(1), po_match.group(2)
                    svc_name = f"{default_proto.upper()}_{val.replace(' ', '-')}"
                    config.services.add(Service(name=svc_name, protocol=default_proto, port=f"{op} {val}"))
                    group.members.add(svc_name)
            elif 'service-object' in line:
                so_match = self._RE_SVC_OBJ_MATCH.search(line)
                if so_match:
                    proto, op, val = so_match.group(1), so_match.group(2), so_match.group(3)
                    svc_name = f"{proto.upper()}_{val.replace(' ', '-')}"
                    config.services.add(Service(name=svc_name, protocol=proto, port=f"{op} {val}"))
                    group.members.add(svc_name)
            i += 1
        config.service_groups.add(group)
        return i

    def _consume_address(self, tokens: List[str]) -> (str, List[str]):
        if not tokens: return None, []
        kw = tokens[0]
        if kw in ['any', 'any4']: return 'any', tokens[1:]
        if kw == 'host' and len(tokens) >= 2: return f"host {tokens[1]}", tokens[2:]
        if kw == 'object-group' and len(tokens) >= 2: return f"object-group {tokens[1]}", tokens[2:]
        if kw == 'object' and len(tokens) >= 2: return f"object {tokens[1]}", tokens[2:]
        if self._RE_IP_MASK.match(kw):
            if len(tokens) >= 2 and self._RE_IP_MASK.match(tokens[1]):
                return f"{tokens[0]} {tokens[1]}", tokens[2:]
            else:
                return f"host {tokens[0]}", tokens[1:]
        return None, tokens

    def _parse_address_part(self, part_str: str, config: FirewallConfig, context_name: str,
                            duplicates: Set[str]) -> str:
        if not part_str: return None
        parts = part_str.strip().split()
        if parts[0] == 'any': return 'any'
        if parts[0] == 'host':
            ip = parts[1];
            host_name = f"host_{ip}"
            if not any(a.name == host_name for a in config.addresses): config.addresses.add(
                Address(name=host_name, type='host', value1=ip))
            return host_name
        if parts[0] in ['object-group', 'object']: return self._get_new_name(parts[1], context_name, duplicates)
        if len(parts) == 2:
            ip, mask = parts;
            cidr = self._mask_to_cidr(mask);
            net_name = f"net_{ip}_{cidr}"
            if not any(a.name == net_name for a in config.addresses): config.addresses.add(
                Address(name=net_name, type='network', value1=ip, value2=str(cidr)))
            return net_name
        return None

    def _parse_rule(self, line: str, config: FirewallConfig, context: str, duplicates: Set[str], seq_id: int,
                    remark: str = None):
        try:
            is_enabled = not line.strip().endswith('inactive')
            time_range_match = self._RE_RULE_TIME_RANGE.search(line)
            time_range_name = self._get_new_name(time_range_match.group(1), context,
                                                 duplicates) if time_range_match else None

            # [NEW] Extract Hit Count
            hit_count = 0
            hit_count_match = re.search(r'\(hitcnt=(\d+)\)', line)
            if hit_count_match:
                hit_count = int(hit_count_match.group(1))
                line = line.replace(hit_count_match.group(0), '') # Remove from line to avoid parsing interference

            clean_line = self._RE_CLEAN_RULE.sub('', line).strip()
            parts = clean_line.split()
            if len(parts) < 5 or 'extended' not in parts: return seq_id

            ext_index = parts.index('extended')
            acl_name = parts[1]
            action_raw = parts[ext_index + 1].lower()
            standardized_action = "allow" if action_raw == "permit" else "deny"

            tokens = parts[ext_index + 2:]
            src_interface = acl_name.replace('_access_in', '').replace('_in', '')
            if not tokens: return seq_id

            proto_or_grp = tokens.pop(0)
            svc_grp_name, proto = None, None

            if proto_or_grp in ['object-group', 'object']:
                svc_grp_name = self._get_new_name(tokens.pop(0), context, duplicates)
            else:
                proto = proto_or_grp

            src_str, tokens = self._consume_address(tokens)
            dst_str, tokens = self._consume_address(tokens)
            if not src_str or not dst_str: return seq_id

            rule = Rule(sequence_id=seq_id, name=f"{acl_name}-{seq_id}", action=standardized_action, context=context,
                        remark=remark, enabled=is_enabled, time_range=time_range_name, source_interface={src_interface},
                        original_text=line.strip(), hit_count=hit_count)

            s_val = self._parse_address_part(src_str, config, context, duplicates)
            if s_val: rule.source.add(s_val)
            d_val = self._parse_address_part(dst_str, config, context, duplicates)
            if d_val: rule.destination.add(d_val)

            if svc_grp_name:
                rule.service.add(svc_grp_name)
            else:
                svc_str = " ".join(tokens).strip()
                if svc_str:
                    if svc_str.startswith('object-group'):
                        rule.service.add(self._get_new_name(svc_str.split()[1], context, duplicates))
                    else:
                        svc_name = f"{proto.upper()}_{svc_str.replace(' ', '-')}"
                        if not any(s.name == svc_name for s in config.services): config.services.add(
                            Service(name=svc_name, protocol=proto, port=svc_str))
                        rule.service.add(svc_name)
                else:
                    if proto.lower() == 'ip':
                        if not any(s.name == "IP" for s in config.services): config.services.add(
                            Service(name="IP", protocol="ip", port=""))
                        rule.service.add("IP")
                    else:
                        if not any(s.name == proto.upper() for s in config.services): config.services.add(
                            Service(name=proto.upper(), protocol=proto, port=""))
                        rule.service.add(proto.upper())

            if rule.source and rule.destination and rule.service:
                config.rules.append(rule);
                return seq_id + 1
            return seq_id
        except:
            return seq_id

    def _parse_nat_rule_line(self, line: str, config: FirewallConfig, context_name: str, duplicates: Set[str],
                             nat_seq_counter: int):
        is_enabled = 'inactive' not in line
        twice_nat_match = self._RE_MANUAL_TWICE_NAT.search(line)
        if twice_nat_match:
            src_intf, dst_intf, orig_src, mapped_src, orig_dst, mapped_dst = twice_nat_match.groups()
            config.nat_rules.append(NatRule(
                sequence_id=nat_seq_counter, name=f"TwiceNAT_{orig_src}_{orig_dst}",
                source_interface={src_intf.strip()}, destination_interface={dst_intf.strip()},
                original_source={self._get_new_name(orig_src, context_name, duplicates)},
                translated_source=self._get_new_name(mapped_src, context_name, duplicates),
                original_destination={self._get_new_name(orig_dst, context_name, duplicates)},
                translated_destination=self._get_new_name(mapped_dst, context_name, duplicates),
                enabled=is_enabled, original_text=line
            ));
            return nat_seq_counter + 1

        static_nat_match = self._RE_MANUAL_STATIC_NAT.search(line)
        if static_nat_match:
            src_intf, dst_intf, orig_src, mapped_src, unidirectional = static_nat_match.groups()
            mapped_src = mapped_src.strip()
            config.nat_rules.append(NatRule(
                sequence_id=nat_seq_counter, name=f"StaticNAT_{orig_src}",
                source_interface={src_intf.strip()}, destination_interface={dst_intf.strip()},
                original_source={self._get_new_name(orig_src, context_name, duplicates)},
                translated_source=self._get_new_name(mapped_src, context_name, duplicates),
                enabled=is_enabled, original_text=line
            ));
            nat_seq_counter += 1
            if not unidirectional:
                config.nat_rules.append(NatRule(
                    sequence_id=nat_seq_counter, name=f"StaticNAT_Reverse_{orig_src}",
                    source_interface={dst_intf.strip()}, destination_interface={src_intf.strip()},
                    original_destination={self._get_new_name(mapped_src, context_name, duplicates)},
                    translated_destination=self._get_new_name(orig_src, context_name, duplicates),
                    enabled=is_enabled, original_text=f"! Auto-generated reverse NAT for {orig_src}"
                ));
                nat_seq_counter += 1
            return nat_seq_counter

        dynamic_pat_match = self._RE_MANUAL_DYNAMIC_PAT.search(line)
        if dynamic_pat_match:
            src_intf, dst_intf, orig_src = dynamic_pat_match.groups()
            config.nat_rules.append(NatRule(
                sequence_id=nat_seq_counter, name=f"DynamicPAT_{orig_src}",
                source_interface={src_intf.strip()}, destination_interface={dst_intf.strip()},
                original_source={self._get_new_name(orig_src, context_name, duplicates)},
                translated_source='dynamic-ip-and-port',
                enabled=is_enabled, original_text=line
            ));
            return nat_seq_counter + 1

        dynamic_nat_match = self._RE_MANUAL_DYNAMIC_NAT.search(line)
        if dynamic_nat_match:
            src_intf, dst_intf, orig_src, mapped_src = dynamic_nat_match.groups()
            config.nat_rules.append(NatRule(
                sequence_id=nat_seq_counter, name=f"DynamicNAT_{orig_src}",
                source_interface={src_intf.strip()}, destination_interface={dst_intf.strip()},
                original_source={self._get_new_name(orig_src, context_name, duplicates)},
                translated_source=self._get_new_name(mapped_src, context_name, duplicates),
                enabled=is_enabled, original_text=line
            ));
            return nat_seq_counter + 1

        return nat_seq_counter
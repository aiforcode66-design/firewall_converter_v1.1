# -*- coding: utf-8 -*-
"""
Generator untuk konfigurasi Fortinet (FortiGate).
Updated: Support Policy-based NAT (Merge) & Central NAT Modes.
Fixes: VIP logic only generates for actual DNAT (dest translation changes).
       Central NAT Policy destination fixed to use Real IP (Translated IP) instead of Original IP/VIP.
       Added deduplication for VIP generation to prevent duplicate config blocks.
       Central SNAT Map now correctly refers to NAT rules with source translation changes.
       Fixed: Central NAT Policy Destination now correctly resolves to Mapped IP Object Name (e.g. ECP_...) instead of DNAT string.
       Fixed: Policy Mode DNAT destination now correctly uses VIP Object Name.
       Updated: Added source_vendor awareness to handle vendor-specific NAT quirks.
       Updated: Added support for FQDN Address Objects.
       FIXED [CRITICAL]: VIP Port Forwarding now supports well-known ports (http, ssh, etc) via fallback map.
       FIXED: Address Objects now consistently use 'subnet' format instead of 'iprange' for single IPs or networks.
       UPDATED: VIP Naming now prioritizes Source NAT Rule Name to preserve existing naming conventions.
       UPDATED: Security Profiles now use user-defined names (string) instead of boolean flags.
       FIXED: Attribute name mismatch for security profiles (removed 'fortinet_' prefix).
       UPDATED: Service Mapping for generic protocols (IP->ALL, TCP->ALL_TCP, UDP->ALL_UDP, ICMP->PING).
       UPDATED: Extended Service Mapping (IKE, NFS, HTTP, HTTPS, LDAP, DHCP, GRE) including ASA artifacts (TCP_eq-http, etc).
       NEW: Deep Service Optimization (Detects duplicates by content, not just name).
       REVISED: Service Naming Format (TCP_eq- -> TCP-, UDP_eq- -> UDP-, No double dashes).
       UPDATED: Checkpoint 'icmp-proto' mapped to 'ALL_ICMP'.
       NEW: Support for Target Aggregate Interfaces (LACP).
"""
import io
import re
from collections import defaultdict
from .base import BaseGenerator


class FortinetGenerator(BaseGenerator):
    # Definisi Service Default Fortinet (Protocol, Port/Type)
    # Port disimpan sebagai string tunggal atau range.
    FORTINET_DEFAULTS = {
        'ALL': {'protocol': 'ip', 'port': None},
        'ALL_TCP': {'protocol': 'tcp', 'port': '1-65535'},
        'ALL_UDP': {'protocol': 'udp', 'port': '1-65535'},
        'ALL_ICMP': {'protocol': 'icmp', 'port': None},
        'PING': {'protocol': 'icmp', 'port': None}, # Simplified for matching
        'IKE': {'protocol': 'udp', 'port': '500'},
        'HTTP': {'protocol': 'tcp', 'port': '80'},
        'HTTPS': {'protocol': 'tcp', 'port': '443'},
        'SSH': {'protocol': 'tcp', 'port': '22'},
        'TELNET': {'protocol': 'tcp', 'port': '23'},
        'FTP': {'protocol': 'tcp', 'port': '21'},
        'SMTP': {'protocol': 'tcp', 'port': '25'},
        'DNS': {'protocol': 'udp', 'port': '53'},
        'NTP': {'protocol': 'udp', 'port': '123'},
        'SNMP': {'protocol': 'udp', 'port': '161'},
        'LDAP': {'protocol': 'tcp', 'port': '389'},
        'LDAPS': {'protocol': 'tcp', 'port': '636'},
        'BGP': {'protocol': 'tcp', 'port': '179'},
        'SYSLOG': {'protocol': 'udp', 'port': '514'},
        'NFS': {'protocol': 'tcp', 'port': '2049'}, # Common default, though can vary
        'GRE': {'protocol': 'ip', 'port': None}, # Protocol 47, handled as IP usually
        'DHCP': {'protocol': 'udp', 'port': '67'}, # Often covers 67-68
        'PPTP': {'protocol': 'tcp', 'port': '1723'},
        'RDP': {'protocol': 'tcp', 'port': '3389'},
        'NETBIOS-SSN': {'protocol': 'tcp', 'port': '139'},
        'ONC-RPC': {'protocol': 'tcp', 'port': '111'},
    }

    # Map untuk resolusi port bernama (misal: "eq isakmp" -> 500)
    PORT_NAME_MAP = {
        'isakmp': '500', 'bootps': '67', 'bootpc': '68', 'domain': '53',
        'www': '80', 'pop3': '110', 'imap4': '143', 'sunrpc': '111',
        'pptp': '1723', 'ldaps': '636', 'ms-wbt-server': '3389', 'rdp': '3389',
        'netbios-ssn': '139'
    }

    def __init__(self, config, nat_mode='policy', **kwargs):
        super().__init__(config, **kwargs)
        self.nat_mode = nat_mode
        self.vip_map = {}
        self.dnat_map = {}
        self.ippool_map = {}
        self.addr_map = {a.name: a for a in self.config.addresses}
        self.svc_map = {s.name: s for s in self.config.services}
        self.ip_to_obj_map = {}
        for a in self.config.addresses:
            if a.type == 'host':
                self.ip_to_obj_map[a.value1] = a.name
        
        # [NEW] Target Layout (Aggregates)
        self.target_layout = kwargs.get('target_layout', [])
        # [NEW] Store Interface Mapping for deduplication
        self.interface_mapping = kwargs.get('interface_mapping', {})

        # [FIX] WELL KNOWN PORTS FALLBACK (Used for VIPs)
        self.WELL_KNOWN_PORTS_MAP = {
            'http': {'protocol': 'tcp', 'port': '80'},
            'https': {'protocol': 'tcp', 'port': '443'},
            'ssh': {'protocol': 'tcp', 'port': '22'},
            'ftp': {'protocol': 'tcp', 'port': '21'},
            'telnet': {'protocol': 'tcp', 'port': '23'},
            'smtp': {'protocol': 'tcp', 'port': '25'},
            'dns': {'protocol': 'udp', 'port': '53'},
            'pop3': {'protocol': 'tcp', 'port': '110'},
            'imap': {'protocol': 'tcp', 'port': '143'},
            'ldap': {'protocol': 'tcp', 'port': '389'},
            'ldaps': {'protocol': 'tcp', 'port': '636'},
            'snmp': {'protocol': 'udp', 'port': '161'},
            'syslog': {'protocol': 'udp', 'port': '514'},
            'ntp': {'protocol': 'udp', 'port': '123'}
        }

    def _sanitize_name(self, name):
        if not name: return ""
        safe_name = re.sub(r'[^\w.\-]', '_', name)
        
        # [REVISED] Service Naming Cleanup
        safe_name = safe_name.replace('TCP_eq-', 'TCP-').replace('UDP_eq-', 'UDP-')
        safe_name = safe_name.replace('tcp_eq-', 'TCP-').replace('udp_eq-', 'UDP-')
        
        while '--' in safe_name:
            safe_name = safe_name.replace('--', '-')
            
        return safe_name.strip('_')[:79]

    def _mask_to_cidr(self, mask):
        if not mask: return 0
        try:
            return sum([bin(int(x)).count('1') for x in mask.split('.')])
        except:
            return 0

    def _get_network_broadcast(self, ip_str, mask_or_cidr):
        try:
            if '.' in mask_or_cidr and not '/' in mask_or_cidr:
                cidr = self._mask_to_cidr(mask_or_cidr)
            else:
                cidr = int(mask_or_cidr)
            if not (0 <= cidr <= 32): return ip_str
            ip_parts = [int(x) for x in ip_str.split('.')]
            if len(ip_parts) != 4: return ip_str
            broadcast_parts = []
            for i in range(4):
                bits_in_octet = min(8, max(0, cidr - i * 8))
                host_mask_octet = (1 << (8 - bits_in_octet)) - 1 if bits_in_octet < 8 else 0
                broadcast_parts.append(ip_parts[i] | host_mask_octet)
            return ".".join(map(str, broadcast_parts))
        except Exception:
            return ip_str

    def _map_service_name(self, name):
        """Legacy mapping based on name only. Kept for fallback."""
        if not name: return ""
        name_lower = name.lower()
        
        # --- 1. Generic Protocol Mapping ---
        if name_lower == 'ip': return 'ALL'
        if name_lower == 'tcp': return 'ALL_TCP'
        if name_lower == 'udp': return 'ALL_UDP'
        if name_lower == 'icmp': return 'PING'
        if name_lower == 'icmp-proto': return 'ALL_ICMP' # [NEW] Checkpoint specific
        
        # --- 2. Standard Service Mapping ---
        if name_lower == 'isakmp': return 'IKE'
        if name_lower == 'nfs': return 'NFS'
        if name_lower == 'http': return 'HTTP'
        if name_lower == 'https': return 'HTTPS'
        if name_lower == 'ldap': return 'LDAP'
        if name_lower in ['bootpc', 'bootps']: return 'DHCP'
        if name_lower == 'gre': return 'GRE'
        
        # [NEW] User Requested Mappings
        if name_lower in ['tcp-pptp', 'tcp_eq-pptp']: return 'PPTP'
        if name_lower in ['tcp-ldaps', 'tcp_eq-ldaps']: return 'LDAPS'
        if name_lower in ['rdp', 'tcp-rdp', 'tcp_eq-rdp', 'tcp-3389']: return 'RDP'
        if name_lower in ['tcp-netbios-ssn', 'tcp_eq-netbios-ssn']: return 'NETBIOS-SSN'
        if name_lower in ['tcp-sunrpc', 'tcp_eq-sunrpc']: return 'ONC-RPC'
        
        # --- 3. Cisco ASA Artifact Mapping (Optimization) ---
        if name_lower == 'tcp_eq-nfs': return 'NFS'
        if name_lower == 'tcp_eq-http': return 'HTTP'
        if name_lower == 'tcp_eq-www': return 'HTTP'
        if name_lower == 'tcp_eq-https': return 'HTTPS'
        if name_lower == 'tcp_eq-ldap': return 'LDAP'
        if name_lower == 'udp_eq-bootps': return 'DHCP'
        if name_lower == 'udp_eq-bootpc': return 'DHCP'
        if name_lower == 'udp_eq-isakmp': return 'IKE'
        if name_lower == 'udp_eq-ntp': return 'NTP'
        if name_lower == 'udp_eq-snmp': return 'SNMP'
        if name_lower == 'udp_eq-domain': return 'DNS'
        if name_lower == 'tcp_eq-ssh': return 'SSH'
        if name_lower == 'tcp_eq-telnet': return 'TELNET'
        if name_lower == 'tcp_eq-ftp': return 'FTP'
        if name_lower == 'tcp_eq-smtp': return 'SMTP'
        if name_lower == 'tcp_eq-bgp': return 'BGP'

        # ICMP Variants -> PING
        icmp_variants = ['icmp-requests', 'icmp-request', 'echo-request', 'echo-requests', 'icmp-echo-request', 'icmp-replies', 'icmp-reply', 'echo-reply']
        if name_lower in icmp_variants: return 'PING'
        if 'traceroute' in name_lower: return 'TRACEROUTE'
        
        return self._sanitize_name(name)

    def _is_ip_address(self, val):
        if not val: return False
        return re.match(r'^\d{1,3}(\.\d{1,3}){3}$', val) is not None

    def _extract_ip_from_string(self, val):
        match = re.search(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', val)
        if match: return match.group(1)
        return None

    def _resolve_single_ip(self, val):
        if not val: return None
        if self._is_ip_address(val): return val
        if val in self.addr_map:
            addr = self.addr_map[val]
            if addr.type in ['host', 'network', 'range']: return addr.value1
        extracted = self._extract_ip_from_string(val)
        if extracted: return extracted
        return None

    def _resolve_ip_range(self, val):
        if not val: return "0.0.0.0", "0.0.0.0"
        if '-' in val and not self.addr_map.get(val):
            parts = val.split('-')
            p1 = self._extract_ip_from_string(parts[0])
            p2 = self._extract_ip_from_string(parts[1])
            if p1 and p2: return p1, p2
        if val in self.addr_map:
            addr = self.addr_map[val]
            if addr.type == 'host': return addr.value1, addr.value1
            elif addr.type == 'range': return addr.value1, addr.value2
            elif addr.type == 'network':
                return addr.value1, self._get_network_broadcast(addr.value1, addr.value2)
        resolved_single = self._resolve_single_ip(val)
        if resolved_single: return resolved_single, resolved_single
        return "0.0.0.0", "0.0.0.0"

    # --- NEW: Service Optimization Logic ---
    def _normalize_port(self, port_str):
        """
        Mengubah string port (eq 80, range 80-90, isakmp) menjadi format standar (80, 80-90).
        """
        if not port_str: return None
        clean = port_str.lower().replace('eq ', '').replace('range ', '').strip()
        
        # Handle named ports (isakmp -> 500)
        if clean in self.PORT_NAME_MAP:
            return self.PORT_NAME_MAP[clean]
        
        # Handle ranges with space (80 90 -> 80-90)
        if ' ' in clean:
            return clean.replace(' ', '-')
            
        return clean

    def _optimize_configuration(self):
        """
        Memindai semua service custom. Jika isinya cocok dengan default Fortinet,
        ganti referensinya dan hapus objek custom tersebut.
        """
        # 1. Build Map of Custom Service -> Default Replacement
        replacement_map = {}
        services_to_remove = set()

        for svc in self.config.services:
            # Skip if already a default name (handled by _map_service_name)
            if svc.name in self.FORTINET_DEFAULTS: continue

            proto = svc.protocol.lower()
            port_norm = self._normalize_port(svc.port)

            # Check against defaults
            for def_name, def_val in self.FORTINET_DEFAULTS.items():
                if def_val['protocol'] == proto:
                    # Special case for ALL/IP/GRE/ICMP (no port check usually needed or port is None)
                    if def_val['port'] is None:
                        # Match!
                        replacement_map[svc.name] = def_name
                        services_to_remove.add(svc.name)
                        break
                    
                    # Port check
                    if port_norm == str(def_val['port']):
                        replacement_map[svc.name] = def_name
                        services_to_remove.add(svc.name)
                        break

        # 2. Apply Replacements
        if not replacement_map: return

        # Helper to replace in a set/list
        def replace_in_collection(collection):
            new_col = set()
            for item in collection:
                if item in replacement_map:
                    new_col.add(replacement_map[item])
                else:
                    new_col.add(item)
            return new_col

        # Update Rules
        for rule in self.config.rules:
            rule.service = replace_in_collection(rule.service)

        # Update NAT Rules
        for nat in self.config.nat_rules:
            nat.original_service = replace_in_collection(nat.original_service)
            if nat.translated_service and nat.translated_service in replacement_map:
                nat.translated_service = replacement_map[nat.translated_service]

        # Update Service Groups
        for grp in self.config.service_groups:
            grp.members = replace_in_collection(grp.members)

        # 3. Remove Optimized Services from Definition
        self.config.services = {s for s in self.config.services if s.name not in services_to_remove}

    def generate(self) -> str:
        # [NEW] Run optimization before generating anything
        self._optimize_configuration()

        f = io.StringIO()
        f.write("! Fortinet Configuration generated by Firewall Converter Pro\n")
        f.write(f"! Target: FortiGate (NAT Mode: {self.nat_mode.upper()})\n")

        src_vendor = getattr(self, 'source_vendor', 'generic')
        f.write(f"! Source Vendor: {src_vendor.upper()}\n\n")

        f.write("config system global\n")
        f.write("    set hostname \"Firewall-Migrated\"\n")
        f.write("end\n\n")

        f.write("config system settings\n")
        if self.nat_mode == 'central':
            f.write("    set central-nat enable\n")
        else:
            f.write("    set central-nat disable\n")
        f.write("end\n\n")

        f.write("! --- Interface ---\n")
        self._generate_interfaces(f)
        f.write("! --- Zone ---\n")
        self._generate_zones(f)
        f.write("! --- Object Address ---\n")
        self._generate_addresses(f)
        f.write("! --- Address Group ---\n")
        self._generate_address_groups(f)

        f.write("! --- Object Service ---\n")
        self._generate_services(f) 
        
        f.write("! --- Security Profiles ---\n")
        self._generate_security_profiles(f)

        f.write("! --- NAT ---\n")
        self._generate_ippools(f) # Part of NAT
        self._generate_vip(f) # DNAT

        if self.nat_mode == 'central':
            self._generate_central_snat(f) # SNAT

        f.write("! --- Security Policy ---\n")
        self._generate_policies(f)
        self._generate_dynamic_routing(f)

        f.write("! --- Routes ---\n")
        self._generate_routes(f)

        return f.getvalue()

    def _generate_interfaces(self, f):
        if not self.config.interfaces: return
        f.write("config system interface\n")
        processed = set()
        agg_re = re.compile(r'^(ae|agg|bond|lag|po|port-channel)[\d]+$', re.IGNORECASE)

        # [NEW] Helper to get mapped interface name
        def get_mapped_name(original_name):
            """Returns the mapped name if exists, otherwise the original."""
            if original_name in self.interface_mapping:
                val = self.interface_mapping[original_name]
                if isinstance(val, dict):
                     val = val.get('target_interface')
                
                if val and str(val).strip():
                    return val
            return original_name

        # [NEW] 1. Generate Aggregates from Target Layout
        for agg in self.target_layout:
            name = agg.get('name')
            members = agg.get('members', '')
            if not name: continue
            
            clean_name = self._sanitize_name(name)
            processed.add(clean_name)
            
            f.write(f"    edit \"{clean_name}\"\n")
            f.write("        set vdom \"root\"\n")
            f.write("        set type aggregate\n")
            
            # Process members
            member_list = [m.strip() for m in members.split(',') if m.strip()]
            if member_list:
                quoted_members = [f'"{m}"' for m in member_list]
                f.write(f"        set member {' '.join(quoted_members)}\n")
            
            f.write("        set lacp-mode active\n")
            f.write("    next\n")

        # 2. Generate Source Interfaces (with Mapping Applied)
        for iface in self.config.interfaces:
            if not iface.name or iface.name.lower() == 'any': continue
            
            # [FIXED] Interface name is ALREADY renamed by _apply_mappings() in app.py
            # We use it directly. NO need to lookup mapping again!
            clean = self._sanitize_name(iface.name)
            original_name = getattr(iface, 'original_name', iface.name)

            # Skip if already created as aggregate
            if clean in processed: continue
            processed.add(clean)

            f.write(f"    edit \"{clean}\"\n")
            f.write("        set vdom \"root\"\n")
            if iface.ip_address and iface.mask_length:
                try:
                    if int(iface.mask_length) <= 32:
                        f.write(f"        set ip {iface.ip_address}/{iface.mask_length}\n")
                    else:
                        f.write(f"        set ip {iface.ip_address} {iface.mask_length}\n")
                except:
                    f.write(f"        set ip {iface.ip_address} {iface.mask_length}\n")
                f.write("        set mode static\n")
            else:
                f.write("        set mode static\n")
                f.write("        set ip 0.0.0.0 0.0.0.0\n")

            f.write("        set allowaccess ping https ssh\n")

            # [FIXED] Handle VLAN interfaces - find renamed parent from config
            if '.' in original_name:
                f.write("        set type vlan\n")
                try:
                    parent_orig, vid = original_name.split('.', 1)
                    # Find the parent interface in config (it's also already renamed)
                    parent_iface = next((i for i in self.config.interfaces if getattr(i, 'original_name', i.name) == parent_orig), None)
                    if parent_iface:
                        parent_clean = self._sanitize_name(parent_iface.name)
                    else:
                        # Fallback: sanitize original parent name if not found
                        parent_clean = self._sanitize_name(parent_orig)
                    f.write(f"        set interface \"{parent_clean}\"\n")
                    f.write(f"        set vlanid {vid}\n")
                except:
                    pass
            elif agg_re.match(clean):
                # Fallback for source aggregates not in layout
                f.write("        set type aggregate\n")
                f.write("        set lacp-mode active\n")
            else:
                pass

            if iface.description:
                f.write(f"        set description \"{iface.description}\"\n")
            f.write("    next\n")
        f.write("end\n\n")

    def _generate_zones(self, f):
        # [NEW] Helper to get mapped interface name
        def get_mapped_name(original_name):
            if original_name in self.interface_mapping:
                val = self.interface_mapping[original_name]
                if isinstance(val, dict):
                     val = val.get('target_interface')
                
                if val and str(val).strip():
                    return val
            return original_name

        zmap = defaultdict(list)
        for i in self.config.interfaces:
            if i.zone and i.name:
                # [FIXED] Interface and zone names are ALREADY renamed by app.py
                # Use them directly, no need to lookup mapping again!
                zmap[self._sanitize_name(i.zone)].append(self._sanitize_name(i.name))
        
        if not zmap: return
        f.write("config system zone\n")
        for z, intfs in zmap.items():
            if not z: continue
            f.write(f"    edit \"{z}\"\n")
            if intfs:
                # Deduplicate interface list (in case multiple sources map to same target)
                unique_intfs = list(dict.fromkeys(intfs))
                quoted_intfs = ['"' + x + '"' for x in unique_intfs]
                f.write(f"        set interface {' '.join(quoted_intfs)}\n")
            f.write("    next\n")
        f.write("end\n\n")

    def _generate_addresses(self, f):
        if not self.config.addresses: return
        f.write("config firewall address\n")
        for addr in self.config.addresses:
            name = self._sanitize_name(addr.name)
            f.write(f"    edit \"{name}\"\n")
            if getattr(addr, 'description', None):
                f.write(f"        set comment \"{addr.description}\"\n")

            if addr.type == 'host':
                f.write(f"        set subnet {addr.value1} 255.255.255.255\n")
            elif addr.type == 'network':
                val2 = addr.value2
                try:
                    if int(val2) <= 32:
                        f.write(f"        set subnet {addr.value1}/{val2}\n")
                    else:
                        f.write(f"        set subnet {addr.value1} {val2}\n")
                except:
                    f.write(f"        set subnet {addr.value1} {val2}\n")
            elif addr.type == 'range':
                if addr.value1 == addr.value2:
                    f.write(f"        set subnet {addr.value1} 255.255.255.255\n")
                else:
                    f.write(f"        set type iprange\n")
                    f.write(f"        set start-ip {addr.value1}\n")
                    f.write(f"        set end-ip {addr.value2}\n")
            elif addr.type == 'fqdn':
                f.write(f"        set type fqdn\n")
                f.write(f"        set fqdn \"{addr.value1}\"\n")

            f.write("    next\n")
        f.write("end\n\n")

    def _generate_address_groups(self, f):
        if not self.config.address_groups: return
        f.write("config firewall addrgrp\n")
        for g in self.config.address_groups:
            name = self._sanitize_name(g.name)
            mems = [f"\"{self._sanitize_name(m)}\"" for m in g.members]
            f.write(f"    edit \"{name}\"\n")
            f.write(f"        set member {' '.join(mems)}\n")
            f.write("    next\n")
        f.write("end\n\n")

    def _generate_services(self, f):
        if self.config.services:
            f.write("config firewall service custom\n")
            for svc in self.config.services:
                mapped = self._map_service_name(svc.name)
                # Skip if mapped to a default Fortinet service
                # [UPDATED] Added new defaults to exclusion list
                if mapped in ['PING', 'TRACEROUTE', 'ALL', 'ALL_TCP', 'ALL_UDP', 
                              'IKE', 'NFS', 'HTTP', 'HTTPS', 'LDAP', 'DHCP', 'GRE',
                              'SSH', 'TELNET', 'FTP', 'SMTP', 'DNS', 'NTP', 'SNMP', 'BGP', 'SYSLOG',
                              'PPTP', 'LDAPS', 'RDP', 'NETBIOS-SSN', 'ONC-RPC']: continue
                
                name = self._sanitize_name(svc.name)
                f.write(f"    edit \"{name}\"\n")
                proto = svc.protocol.upper()
                ports = svc.port.replace("eq ", "").replace("range ", "") if svc.port else ""

                if proto == 'TCP':
                    f.write("        set protocol TCP/UDP/SCTP\n")
                    f.write(f"        set tcp-portrange {ports}\n")
                elif proto == 'UDP':
                    f.write("        set protocol TCP/UDP/SCTP\n")
                    f.write(f"        set udp-portrange {ports}\n")
                elif proto == 'ICMP':
                    f.write("        set protocol ICMP\n")
                f.write(f"        set comment \"Custom service for {name}\"\n")
                f.write("    next\n")
            f.write("end\n\n")

        if self.config.service_groups:
            f.write("! --- Service Group ---\n")
            f.write("config firewall service group\n")
            for g in self.config.service_groups:
                name = self._sanitize_name(g.name)
                mems = [f"\"{self._map_service_name(m)}\"" for m in g.members]
                f.write(f"    edit \"{name}\"\n")
                f.write(f"        set member {' '.join(mems)}\n")
                f.write("    next\n")
            f.write("end\n\n")

    def _generate_ippools(self, f):
        f.write("config firewall ippool\n")
        # Deduplication for pools
        processed_pools = set()

        for r in self.config.nat_rules:
            ts = r.translated_source
            if ts and ts.lower() not in ['dynamic-ip-and-port', 'original']:
                pname = self._sanitize_name(f"POOL_{ts}")
                # Check global map AND local processed set
                if pname in self.ippool_map.values() or pname in processed_pools: continue

                f.write(f"    edit \"{pname}\"\n")
                sip, eip = self._resolve_ip_range(ts)
                f.write(f"        set startip {sip}\n")
                f.write(f"        set endip {eip}\n")
                f.write("        set type overload\n")
                f.write("    next\n")
                self.ippool_map[ts] = pname
                processed_pools.add(pname)
        f.write("end\n\n")

    def _generate_vip(self, f):
        if not self.config.nat_rules: return
        f.write("config firewall vip\n")

        processed_vips = set()

        for r in self.config.nat_rules:
            is_dnat = False
            if r.translated_destination and r.translated_destination.lower() != 'original':
                orig_dst_raw = list(r.original_destination)[0] if r.original_destination else ""
                trans_dst_raw = r.translated_destination
                if orig_dst_raw and trans_dst_raw and orig_dst_raw != trans_dst_raw:
                    is_dnat = True

            if is_dnat:
                ext_ip = "0.0.0.0"
                original_obj_name = ""
                if r.original_destination:
                    raw = list(r.original_destination)[0]
                    original_obj_name = raw
                    resolved = self._resolve_single_ip(raw)
                    if resolved:
                        ext_ip = resolved

                # Naming Priority:
                # 1. Existing NAT Rule Name (if available)
                # 2. DNAT_<External_IP>
                # 3. VIP_<ID>
                
                candidate_name = None
                if r.name:
                    candidate_name = self._sanitize_name(r.name)
                
                if candidate_name:
                    # Check for collision with Address Objects
                    if candidate_name in self.addr_map:
                        candidate_name = f"{candidate_name}_VIP"
                    name = candidate_name
                elif ext_ip != "0.0.0.0":
                    name = f"DNAT_{ext_ip}"
                else:
                    name = f"VIP_{r.sequence_id}"

                if name in processed_vips:
                    if original_obj_name:
                        self.vip_map[original_obj_name] = name
                        if r.translated_destination:
                            self.dnat_map[original_obj_name] = r.translated_destination
                    continue
                processed_vips.add(name)

                if original_obj_name:
                    self.vip_map[original_obj_name] = name
                    if r.translated_destination:
                        self.dnat_map[original_obj_name] = r.translated_destination

                map_ip = "0.0.0.0"
                raw_map = r.translated_destination
                resolved_map = self._resolve_single_ip(raw_map)
                if resolved_map: map_ip = resolved_map

                f.write(f"    edit \"{name}\"\n")
                f.write(f"        set extip {ext_ip}\n")
                if ext_ip == "0.0.0.0":
                    f.write(f"        set comment \"Check extip. Original obj: {original_obj_name}\"\n")

                f.write("        set extintf \"any\"\n")
                f.write(f"        set mappedip \"{map_ip}\"\n")
                if map_ip == "0.0.0.0":
                    f.write(f"        set comment \"Check mappedip. Translated obj: {raw_map}\"\n")

                # --- NEW PORT FORWARDING LOGIC ---
                # [FIXED] Updated to handle well-known ports fallback
                orig_svc_name = list(r.original_service)[0] if r.original_service else None
                if orig_svc_name and orig_svc_name.lower() != 'any':
                    trans_svc_name = r.translated_service or orig_svc_name

                    # 1. Try to find in custom service objects
                    orig_svc = self.svc_map.get(orig_svc_name)
                    trans_svc = self.svc_map.get(trans_svc_name)

                    # Helper to get details from object OR fallback map
                    def get_svc_details(svc_obj, svc_name):
                        if svc_obj:
                            return svc_obj.protocol.lower(), svc_obj.port

                        # Fallback: Check well-known map
                        clean_name = svc_name.lower().replace('service-', '').replace('tcp-', '').replace('udp-', '')
                        if clean_name in self.WELL_KNOWN_PORTS_MAP:
                            return self.WELL_KNOWN_PORTS_MAP[clean_name]['protocol'], \
                            self.WELL_KNOWN_PORTS_MAP[clean_name]['port']
                        return None, None

                    orig_proto, orig_port_raw = get_svc_details(orig_svc, orig_svc_name)
                    trans_proto, trans_port_raw = get_svc_details(trans_svc, trans_svc_name)

                    if orig_proto and orig_proto in ['tcp', 'udp']:
                        # Clean port format (e.g. "eq 80" -> "80")
                        extport = orig_port_raw.replace('eq ', '').strip() if orig_port_raw else None
                        mappedport = trans_port_raw.replace('eq ', '').strip() if trans_port_raw else extport

                        if extport and mappedport:
                            f.write("        set portforward enable\n")
                            f.write(f"        set protocol {orig_proto}\n")
                            f.write(f"        set extport {extport}\n")
                            f.write(f"        set mappedport {mappedport}\n")

                f.write("    next\n")
        f.write("end\n\n")

    def _generate_central_snat(self, f):
        """Generate Central SNAT table refering to NAT rules with source translation changes."""
        if not self.config.nat_rules: return
        f.write("config firewall central-snat-map\n")

        # ID Counter untuk central-snat-map
        snat_id = 1

        for r in self.config.nat_rules:
            # Check if there is a Source Translation (SNAT)
            ts = r.translated_source
            # Skip jika tidak ada SNAT atau translation 'original'
            if not ts or ts.lower() == 'original': continue

            # Gunakan ID sequence asli jika mungkin, atau counter baru
            # Central SNAT map ID di Fortinet biasanya integer
            try:
                current_id = int(r.sequence_id)
            except:
                current_id = snat_id
                snat_id += 1

            f.write(f"    edit {current_id}\n")

            # Source Interface
            src_i = [f"\"{self._sanitize_name(i)}\"" for i in r.source_interface]
            if not src_i or 'any' in src_i: src_i = ["\"any\""]
            f.write(f"        set srcintf {' '.join(src_i)}\n")

            # Destination Interface
            dst_i = [f"\"{self._sanitize_name(i)}\"" for i in r.destination_interface]
            if not dst_i or 'any' in dst_i: dst_i = ["\"any\""]
            f.write(f"        set dstintf {' '.join(dst_i)}\n")

            # Original Source Address
            src_a = [f"\"{self._sanitize_name(s)}\"" for s in r.original_source]
            if not src_a or 'any' in [s.lower() for s in r.original_source]: src_a = ["\"all\""]
            f.write(f"        set orig-addr {' '.join(src_a)}\n")

            # Destination Address
            dst_a = [f"\"{self._sanitize_name(d)}\"" for d in r.original_destination]
            if not dst_a or 'any' in [d.lower() for d in r.original_destination]: dst_a = ["\"all\""]
            f.write(f"        set dst-addr {' '.join(dst_a)}\n")

            # NAT IP Pool Configuration
            if ts.lower() == 'dynamic-ip-and-port':
                # Interface NAT (Masquerade) - Usually means NO specific pool, use outgoing interface IP
                # Fortinet Central SNAT: set nat-ippool <name> is used for pools.
                # If using interface IP, simply don't set nat-ippool (default is use outgoing interface address if no pool specified but nat enabled? No, wait)
                # Actually, in central SNAT:
                # set nat-ippool is for Fixed Port/Dynamic/Static pools.
                # If we want interface IP, we typically don't set a pool but ensure NAT is happening.
                # However, central-snat-map entry implies NAT is happening.
                # If `dynamic-ip-and-port` corresponds to 'masquerade', we might leave pool empty.
                pass
            elif ts in self.ippool_map:
                # Use the mapped IP Pool object
                f.write(f"        set nat-ippool \"{self.ippool_map[ts]}\"\n")
            else:
                # Fallback if pool map missing but TS exists (maybe direct IP entered?)
                # This case should be handled by _generate_ippools creating a pool for it.
                # If missed, try to create a name.
                pass

            # Optional: Protocol/Service filtering if present in NAT rule
            # r.original_service could be used here if needed via `set protocol ...` but Central SNAT is often address-based.

            f.write("    next\n")
        f.write("end\n\n")

    def _match_snat_rule(self, policy_rule):
        """
        Mencoba menemukan aturan NAT SNAT yang cocok untuk policy rule.
        Matching lebih fleksibel: Hanya Source IP dan Destination IP.
        """
        for nat in self.config.nat_rules:
            # Skip if no SNAT (translated source is empty or original)
            if not nat.translated_source or nat.translated_source.lower() == 'original': continue

            # 1. Check Source Address
            nat_srcs = {s.lower() for s in nat.original_source}
            if 'any' not in nat_srcs and 'all' not in nat_srcs:
                pol_srcs = {s.lower() for s in policy_rule.source}
                # Intersection check
                if not nat_srcs.intersection(pol_srcs): continue

            # 2. Check Destination Address
            nat_dsts = {d.lower() for d in nat.original_destination}
            if 'any' not in nat_dsts and 'all' not in nat_dsts:
                pol_dsts = {d.lower() for d in policy_rule.destination}
                if not nat_dsts.intersection(pol_dsts): continue

            # If both source and destination match (or are 'any'), consider it a match
            return nat
        return None

    def _generate_policies(self, f):
        if not self.config.rules: return
        f.write("config firewall policy\n")

        # Retrieve Security Profiles from kwargs (String values)
        # FIX: Use non-prefixed keys because app.py strips 'fortinet_'
        ips_profile = getattr(self, 'ips', None)
        av_profile = getattr(self, 'av', None)
        web_profile = getattr(self, 'web', None)
        file_profile = getattr(self, 'file', None)
        ssl_profile = getattr(self, 'ssl', None)

        for r in self.config.rules:
            f.write(f"    edit {r.sequence_id}\n")
            f.write(f"        set name \"{self._sanitize_name(r.name)}\"\n")

            src_i = [f"\"{self._sanitize_name(i)}\"" for i in r.source_interface] or ["\"any\""]
            f.write(f"        set srcintf {' '.join(src_i)}\n")
            dst_i = [f"\"{self._sanitize_name(i)}\"" for i in r.destination_interface] or ["\"any\""]
            f.write(f"        set dstintf {' '.join(dst_i)}\n")

            src_a = [f"\"{self._sanitize_name(s)}\"" for s in r.source]
            if not src_a or 'any' in [s.lower() for s in r.source]: src_a = ["\"all\""]
            f.write(f"        set srcaddr {' '.join(src_a)}\n")

            # --- LOGIC DSTADDR (VIP or Real IP) ---
            dst_a = []
            is_dnat = False
            for d in r.destination:
                # Resolve Destination based on Mode
                final_dest = None

                # Check for VIP (which might have been created because of DNAT mapping)
                # But we need to distinguish:
                # 1. Is 'd' an Object Name or IP?
                # 2. Does this destination map to a VIP (based on original address)?

                # Find if 'd' corresponds to a created VIP based on original destination
                # 'vip_map' stores: Original Object Name -> VIP Name

                # Fix: Check if d is a VIP based on map
                potential_vip_name = self.vip_map.get(d)

                # Mode Policy: Prefer VIP
                if self.nat_mode == 'policy':
                    if potential_vip_name:
                        final_dest = potential_vip_name
                        is_dnat = True

                # Mode Central: Prefer Real IP (Translated Dst)
                elif self.nat_mode == 'central':
                    if d in self.dnat_map:
                        # Swap to Real IP Object
                        real_ip_obj_raw = self.dnat_map[d]
                        mapped_ip_val = self._resolve_single_ip(real_ip_obj_raw)
                        final_dst_obj = real_ip_obj_raw
                        if mapped_ip_val and mapped_ip_val in self.ip_to_obj_map:
                            final_dst_obj = self.ip_to_obj_map[mapped_ip_val]
                        final_dest = self._sanitize_name(final_dst_obj)

                # Fallback / No Change
                if not final_dest:
                    final_dest = self._sanitize_name(d)

                dst_a.append(f"\"{final_dest}\"")

            if not dst_a or 'any' in [d.lower() for d in r.destination]: dst_a = ["\"all\""]
            f.write(f"        set dstaddr {' '.join(dst_a)}\n")

            svcs = []
            for s in r.service:
                mapped = self._map_service_name(s)
                svcs.append(f"\"{mapped}\"")
            if not svcs or 'any' in [s.lower() for s in r.service]: svcs = ["\"ALL\""]
            f.write(f"        set service {' '.join(svcs)}\n")

            act = "accept" if r.action in ['allow', 'permit', 'accept'] else "deny"
            f.write(f"        set action {act}\n")
            f.write("        set schedule \"always\"\n")

            # --- NAT LOGIC ---
            if act == 'accept':
                if self.nat_mode == 'central':
                    # Central NAT: Policy NAT selalu disable
                    f.write("        set nat disable\n")

                elif self.nat_mode == 'policy':
                    if is_dnat:
                        # DNAT (VIP di dstaddr) -> NAT disable (VIP handles it)
                        f.write("        set nat disable\n")
                    else:
                        # Cek SNAT
                        snat = self._match_snat_rule(r)
                        if snat:
                            f.write("        set nat enable\n")
                            ts = snat.translated_source
                            if ts == 'dynamic-ip-and-port':
                                f.write("        set ippool disable\n")
                            elif ts in self.ippool_map:
                                f.write("        set ippool enable\n")
                                f.write(f"        set poolname \"{self.ippool_map[ts]}\"\n")
                        else:
                            # No DNAT, No SNAT -> NAT disable
                            f.write("        set nat disable\n")
            else:
                # Default disable for other cases
                f.write("        set nat disable\n")

            # Apply Profiles (UPDATED: Use user-defined strings)
            if act == 'accept':
                utm_enabled = False
                if ips_profile:
                    f.write(f"        set ips-sensor \"{ips_profile}\"\n")
                    utm_enabled = True
                if av_profile:
                    f.write(f"        set av-profile \"{av_profile}\"\n")
                    utm_enabled = True
                if web_profile:
                    f.write(f"        set webfilter-profile \"{web_profile}\"\n")
                    utm_enabled = True
                if file_profile:
                    f.write(f"        set file-filter-profile \"{file_profile}\"\n")
                    utm_enabled = True
                if ssl_profile:
                    f.write(f"        set ssl-ssh-profile \"{ssl_profile}\"\n")
                    utm_enabled = True
                
                if utm_enabled:
                    f.write("        set utm-status enable\n")

            f.write("        set logtraffic all\n")
            if not r.enabled: f.write("        set status disable\n")
            f.write("    next\n")
        f.write("end\n\n")

    def _generate_dynamic_routing(self, f):
        raw = getattr(self.config, 'dynamic_routing_config', '')
        if not raw: return

        if 'ospf' in raw.lower():
            f.write("config router ospf\n")
            rid = re.search(r'router-id\s+([\d\.]+)', raw, re.IGNORECASE)
            if rid: f.write(f"    set router-id {rid.group(1)}\n")

            nets = re.findall(r'network\s+([\d\.]+)\s+([\d\.]+)\s+area\s+([\d\.]+)', raw, re.IGNORECASE)
            if nets:
                f.write("    config area\n")
                areas = set(n[2] for n in nets)
                for a in areas:
                    af = f"0.0.0.{a}" if a.isdigit() else a
                    f.write(f"        edit {af}\n")
                    f.write("        next\n")
                f.write("    end\n")

                f.write("    config network\n")
                for i, (ip, mask, area) in enumerate(nets, 1):
                    nm = mask
                    try:
                        p = [int(x) for x in mask.split('.')]
                        if p[0] == 0: nm = ".".join([str(255 - x) for x in p])
                    except:
                        pass
                    af = f"0.0.0.{area}" if area.isdigit() else area
                    f.write(f"        edit {i}\n")
                    f.write(f"            set prefix {ip} {nm}\n")
                    f.write(f"            set area {af}\n")
                    f.write("        next\n")
                f.write("    end\n")
            f.write("end\n\n")

        bgp = re.search(r'router bgp\s+(\d+)', raw, re.IGNORECASE)
        if bgp:
            f.write("config router bgp\n")
            f.write(f"    set as {bgp.group(1)}\n")
            rid = re.search(r'bgp router-id\s+([\d\.]+)', raw, re.IGNORECASE)
            if rid: f.write(f"    set router-id {rid.group(1)}\n")

            neighs = re.findall(r'neighbor\s+([\d\.]+)\s+remote-as\s+(\d+)', raw, re.IGNORECASE)
            if neighs:
                f.write("    config neighbor\n")
                for ip, asn in neighs:
                    f.write(f"        edit \"{ip}\"\n")
                    f.write(f"            set remote-as {asn}\n")
                    f.write("        next\n")
                f.write("    end\n")
            f.write("end\n\n")

    def _generate_routes(self, f):
        if not self.config.static_routes: return
        f.write("config router static\n")
        i = 1
        for r in self.config.static_routes:
            if "dynamic" in str(r.next_hop).lower() or "ospf" in str(r.interface).lower(): continue
            f.write(f"    edit {i}\n")
            f.write(f"        set dst {r.destination}\n")
            f.write(f"        set gateway {r.next_hop}\n")
            if r.interface: f.write(f"        set device \"{self._sanitize_name(r.interface)}\"\n")
            if r.distance: f.write(f"        set distance {r.distance}\n")
            if r.comment: f.write(f"        set comment \"{r.comment}\"\n")
            f.write("    next\n")
            i += 1
        f.write("end\n\n")

    def _generate_security_profiles(self, f):
        """
        Generates Fortinet Security Profiles based on best practices.
        Uses the profile names provided by the user.
        """
        # Retrieve profile names from attributes (set via kwargs in BaseGenerator/init)
        ips_name = getattr(self, 'ips', None)
        av_name = getattr(self, 'av', None)
        web_name = getattr(self, 'web', None)
        file_name = getattr(self, 'file', None)
        ssl_name = getattr(self, 'ssl', None)

        # 1. IPS Sensor (Best Practice: Block Critical/High/Medium)
        if ips_name:
            f.write("config ips sensor\n")
            f.write(f"    edit \"{self._sanitize_name(ips_name)}\"\n")
            f.write("        set comment \"Generated by Converter - Best Practice\"\n")
            f.write("        config entries\n")
            f.write("            edit 1\n")
            f.write("                set location all\n")
            f.write("                set severity medium high critical\n")
            f.write("                set action block\n")
            f.write("                set log-packet enable\n")
            f.write("                set status enable\n")
            f.write("            next\n")
            f.write("        end\n")
            f.write("    next\n")
            f.write("end\n\n")

        # 2. Antivirus Profile (Flow Mode)
        if av_name:
            f.write("config antivirus profile\n")
            f.write(f"    edit \"{self._sanitize_name(av_name)}\"\n")
            f.write("        set comment \"Generated by Converter - Best Practice\"\n")
            f.write("        set feature-set flow\n")
            f.write("        config http\n")
            f.write("            set options scan\n")
            f.write("        end\n")
            f.write("        config smtp\n")
            f.write("            set options scan\n")
            f.write("        end\n")
            f.write("        config pop3\n")
            f.write("            set options scan\n")
            f.write("        end\n")
            f.write("        config imap\n")
            f.write("            set options scan\n")
            f.write("        end\n")
            f.write("        config ftp\n")
            f.write("            set options scan\n")
            f.write("        end\n")
            f.write("    next\n")
            f.write("end\n\n")

        # 3. Web Filter Profile
        if web_name:
            f.write("config webfilter profile\n")
            f.write(f"    edit \"{self._sanitize_name(web_name)}\"\n")
            f.write("        set comment \"Generated by Converter - Best Practice\"\n")
            f.write("        set feature-set flow\n")
            f.write("        config ftgd-wf\n")
            f.write("            set options error-allow\n") # Best practice: fail open or closed? usually allow to prevent outage on rating error
            f.write("            config filters\n")
            # Block Security Risks (Categories: 26=Malicious, 61=Phishing, 86=Spam, 88=DynamicDNS)
            f.write("                edit 1\n")
            f.write("                    set category 26\n") # Malicious Websites
            f.write("                    set action block\n")
            f.write("                next\n")
            f.write("                edit 2\n")
            f.write("                    set category 61\n") # Phishing
            f.write("                    set action block\n")
            f.write("                next\n")
            f.write("                edit 3\n")
            f.write("                    set category 86\n") # Spam URLs
            f.write("                    set action block\n")
            f.write("                next\n")
            f.write("                edit 4\n")
            f.write("                    set category 88\n") # Dynamic DNS
            f.write("                    set action block\n")
            f.write("                next\n")
            f.write("            end\n")
            f.write("        end\n")
            f.write("    next\n")
            f.write("end\n\n")

        # 4. File Filter (Optional Basic)
        if file_name:
            f.write("config firewall file-filter-profile\n")
            f.write(f"    edit \"{self._sanitize_name(file_name)}\"\n")
            f.write("        set comment \"Generated by Converter - Block Exe/Bat\"\n")
            f.write("        set feature-set flow\n")
            f.write("        config rules\n")
            f.write("            edit \"block-executables\"\n")
            f.write("                set protocol http ftp smtp pop3 imap\n")
            f.write("                set action block\n")
            f.write("                set file-type \"exe\" \"bat\" \"msi\"\n")
            f.write("            next\n")
            f.write("        end\n")
            f.write("    next\n")
            f.write("end\n\n")

        # 5. SSL Inspection (Only if custom name is provided and not default)
        if ssl_name and ssl_name.lower() not in ['certificate-inspection', 'deep-inspection', 'custom-deep-inspection', 'no-inspection']:
             # Create a clone of certificate-inspection for safety
            f.write("config firewall ssl-ssh-profile\n")
            f.write(f"    edit \"{self._sanitize_name(ssl_name)}\"\n")
            f.write("        set comment \"Generated by Converter - Certificate Inspection\"\n")
            f.write("        config https\n")
            f.write("            set ports 443\n")
            f.write("            set status certificate-inspection\n")
            f.write("        end\n")
            f.write("        config ftps\n")
            f.write("            set ports 990\n")
            f.write("            set status certificate-inspection\n")
            f.write("        end\n")
            f.write("        config imaps\n")
            f.write("            set ports 993\n")
            f.write("            set status certificate-inspection\n")
            f.write("        end\n")
            f.write("        config pop3s\n")
            f.write("            set ports 995\n")
            f.write("            set status certificate-inspection\n")
            f.write("        end\n")
            f.write("        config smtps\n")
            f.write("            set ports 465\n")
            f.write("            set status certificate-inspection\n")
            f.write("        end\n")
            f.write("    next\n")
            f.write("end\n\n")
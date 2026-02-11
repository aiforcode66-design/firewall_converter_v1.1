# -*- coding: utf-8 -*-
"""
File ini berisi generator untuk skrip Palo Alto (format SET).
Updated:
1. PAN-OS 11+ Syntax (profile-setting profiles, saas-list, rule-type)
2. Intelligent Rule Splitting (Service vs App)
3. Static Route Naming (IPnMask)
4. FIXED: Security Profiles now appear for 'permit'/'accept' actions too.
5. FIXED: Automatic Subinterface Generation & Safe Attribute Access.
6. ADDED: Aggregate Interface (ae) Support & Subinterface mapping.
7. ADDED: Commented script for adding physical interfaces to aggregate groups.
8. FIXED: Zone Resolution with Robust Normalization (Case-insensitive & Strip).
9. FIXED: Service Naming Cleanup (Remove '_eq' artifacts and double dashes).
10. FIXED: Replace '&' with 'n' in object names.
11. FIXED: Map 'all' to 'any' for Source, Destination, and Service (Security & NAT).
12. NEW: Auto-generate Custom Security Profiles (Cloned from Strict Best Practice).
13. FIXED: Auto-generate Address Objects for NAT Pools (SNAT/DNAT) if missing.
14. FIXED: Force 'service any' for ICMP/Traceroute in NAT Rules with Auto-Description.
15. NEW: Automatic BGP Configuration Generation (Fortinet & Cisco support).
16. FIXED: CLI Syntax Validation for Standalone vs Panorama (Restored 'rulebase' keyword for Standalone Rules/NAT).
17. FIXED: Flattened NAT translation commands (removed curly braces) for better CLI compatibility.
18. VALIDATED: Strict separation of Network (Template) vs Policy/Objects (Device Group) for Panorama.
19. NEW: Support for Target Aggregate Interfaces (LACP).
20. NEW: Wildcard FQDN support via Custom URL Category (PAN-OS 11+).
"""
import io
import re
from collections import defaultdict

from models import FirewallConfig, Address, Group, Service, ServiceGroup, Rule, TimeRange, NatRule, StaticRoute, \
    Interface
from .base import BaseGenerator


class PaloAltoSetGenerator(BaseGenerator):
    """Generator untuk skrip Palo Alto (format SET)."""
    WELL_KNOWN_PORTS = {
        'ftp': '21', 'ssh': '22', 'telnet': '23', 'smtp': '25',
        'domain': '53', 'www': '80', 'http': '80', 'https': '443',
        'pop3': '110', 'imap4': '143', 'ldap': '389', 'ldaps': '636',
        'rsh': '514', 'syslog': '514', 'netbios-ns': '137',
        'netbios-dgm': '138', 'netbios-ssn': '139',
        'snmp': '161', 'snmptrap': '162', 'nfs': '2049', 'sqlnet': '1521', 'ntp': '123',
        'isakmp': '500', 'traceroute': '33434-33534'
    }

    def __init__(self, config: FirewallConfig, **kwargs):
        super().__init__(config, **kwargs)
        self.intf_to_zone_map = {}
        self.output_mode = kwargs.get('output_mode', 'firewall')
        self.device_group = kwargs.get('device_group') or 'MyDeviceGroup'
        self.template = kwargs.get('template') or 'MyTemplate'
        # [NEW] Cache existing address names to avoid duplicates
        self.existing_address_names = {self._sanitize_name(a.name) for a in self.config.addresses}
        # [NEW] Target Layout (Aggregates)
        self.target_layout = kwargs.get('target_layout', [])
        # [NEW] Interface Mapping for renaming
        self.interface_mapping = kwargs.get('interface_mapping', {})
        # [NEW] Cache for Wildcard FQDNs (Custom URL Categories)
        self.wildcard_fqdns = {} # {object_name: url_value}

    def _get_cmd_prefix(self, context: str) -> str:
        """
        Mengembalikan prefix perintah berdasarkan mode (firewall/panorama).
        
        VALIDASI STRUKTUR PANORAMA:
        - context='network': Masuk ke Template (Interface, Zone, VR, Routing).
        - context='object'/'profile': Masuk ke Device Group (Address, Service, Profiles).
        - context='rule'/'nat': Masuk ke Device Group Pre-Rulebase (Security/NAT Policies).
        """
        if self.output_mode == 'panorama':
            dg = self.device_group
            tpl = self.template
            
            # [VALIDATION] Network Config -> Template
            if context == 'network':
                return f'set template "{tpl}" config devices localhost.localdomain vsys vsys1'
            
            # [VALIDATION] Objects & Profiles -> Device Group
            elif context == 'object' or context == 'profile':
                return f'set device-group "{dg}"'
            
            # [VALIDATION] Rules -> Device Group (Pre-Rulebase)
            elif context == 'rule' or context == 'nat':
                return f'set device-group "{dg}" pre-rulebase'
        
        # Firewall Mode Defaults (Standalone)
        if context == 'rule' or context == 'nat':
            # PAN-OS 10/11 Standalone uses 'set rulebase ...' for policies
            return 'set rulebase'
        
        # For objects, network, profiles in Standalone, it's just 'set ...'
        return 'set'

    def _sanitize_name(self, name: str) -> str:
        """
        Membersihkan nama objek agar sesuai dengan aturan penamaan Palo Alto.
        Mengubah '/' menjadi 'n'.
        Mengubah '&' menjadi 'n'.
        Membersihkan artefak 'eq' dari Cisco ASA dan menangani double dash.
        """
        if not name:
            return ""

        # Ganti '/' dan '&' dengan 'n'
        new_name = name.replace("/", "n").replace("&", "n")

        # --- FIX: Service Naming Cleanup ---
        # Menghapus '_eq' atau '-eq' yang biasa muncul dari parsing Cisco ASA
        # Contoh: TCP_eq-19780 -> TCP-19780
        new_name = new_name.replace("_eq", "").replace("-eq", "")

        # Mencegah double dashes (--) akibat penghapusan atau nama asli
        # Contoh: TCP--8080 -> TCP-8080
        while "--" in new_name:
            new_name = new_name.replace("--", "-")

        return new_name

    def _translate_port_string(self, port_def: str) -> str:
        if not port_def: return ""
        parts = port_def.split()
        translated_parts = [self.WELL_KNOWN_PORTS.get(p.lower(), p) for p in parts]
        if len(translated_parts) > 1:
            if translated_parts[0].lower() == 'eq': return translated_parts[1]
            if translated_parts[0].lower() == 'range': return f"{translated_parts[1]}-{translated_parts[2]}"
        return "-".join(translated_parts)

    def _resolve_zones(self, interfaces):
        """
        Mengubah list interface name menjadi list zone name unik.
        Proses:
        1. Cek apakah item adalah Interface Name (Case-insensitive) -> ambil Zone aslinya.
        2. Cek apakah item (atau hasil langkah 1) memiliki User Mapping -> ambil Target Zone.
        """
        zones = set()
        for i in interfaces:
            # Bersihkan input (remove spaces)
            i_clean = i.strip()

            # 1. Internal Map Lookup (Interface -> Original Zone)
            # Coba match persis, lalu coba lowercase untuk robustnes
            if i_clean in self.intf_to_zone_map:
                candidate = self.intf_to_zone_map[i_clean]
            elif i_clean.lower() in self.intf_to_zone_map:
                candidate = self.intf_to_zone_map[i_clean.lower()]
            else:
                # Jika tidak ketemu di map interface, asumsikan ini sudah nama Zone
                candidate = i_clean

            # 2. User Mapping Lookup (Original Zone -> Mapped Zone)
            # Ini akan menangani perubahan nama zone dari UI (misal: "rmp-data" -> "cdbs")
            # Pastikan candidate bersih sebelum lookup
            final = self.get_target_zone(candidate.strip())

            zones.add(final)
        return sorted(list(zones))

    def generate(self) -> str:
        output = io.StringIO()
        output.write("# Palo Alto SET commands generated by Firewall Converter Pro\n")
        output.write("# Target Version: PAN-OS 11+\n\n")

        output.write("set cli config-output-format set\n")
        output.write("configure\n")

        # --- PRE-PROCESSING: Build Interface -> Zone Map ---
        # Kita perlu ini karena Rule Palo Alto berbasis Zone, sedangkan config awal mungkin berbasis Interface.
        # Simpan versi lowercase juga untuk pencarian case-insensitive
        self.intf_to_zone_map = {}
        for iface in self.config.interfaces:
            if iface.name and iface.zone:
                clean_name = iface.name.strip()
                clean_zone = iface.zone.strip()
                self.intf_to_zone_map[clean_name] = clean_zone
                self.intf_to_zone_map[clean_name.lower()] = clean_zone  # Fallback key

        self._generate_interfaces_and_zones(output)
        self._generate_addresses(output)
        self._generate_services(output)
        self._generate_address_groups(output)
        self._generate_service_groups(output)
        
        # [NEW] Generate Security Profiles Definitions
        self._generate_security_profiles(output)
        
        self._generate_static_routes(output)
        
        # [NEW] Generate Dynamic Routing (BGP)
        self._generate_dynamic_routing(output)
        
        self._generate_rules(output)
        self._generate_nat_rules(output)

        output.write("exit\n")
        return output.getvalue()

    def _generate_security_profiles(self, f):
        """
        Men-generate definisi Security Profile jika user menginput nama custom.
        Menggunakan konfigurasi 'Strict' (Best Practice) sebagai template.
        """
        pfx = self._get_cmd_prefix('profile')
        
        # Helper untuk cek apakah perlu generate
        def should_generate(name):
            return name and name.lower() not in ['default', 'strict', 'none']

        # 1. Antivirus Profile
        av = getattr(self, 'av_profile', None)
        if should_generate(av):
            f.write(f"# Custom Antivirus Profile: {av} (Strict)\n")
            f.write(f'{pfx} profiles virus "{av}" decoder http action reset-both\n')
            f.write(f'{pfx} profiles virus "{av}" decoder ftp action reset-both\n')
            f.write(f'{pfx} profiles virus "{av}" decoder imap action reset-both\n')
            f.write(f'{pfx} profiles virus "{av}" decoder pop3 action reset-both\n')
            f.write(f'{pfx} profiles virus "{av}" decoder smb action reset-both\n')
            f.write(f'{pfx} profiles virus "{av}" decoder smtp action reset-both\n')
            f.write(f'{pfx} profiles virus "{av}" mlav-action reset-both\n')
            f.write(f'{pfx} profiles virus "{av}" wildfire-analysis-action reset-both\n')
            f.write("\n")

        # 2. Anti-Spyware Profile
        asp = getattr(self, 'as_profile', None)
        if should_generate(asp):
            f.write(f"# Custom Anti-Spyware Profile: {asp} (Strict)\n")
            # Botnet Domains -> Sinkhole
            f.write(f'{pfx} profiles spyware "{asp}" botnet-domains dns-security-categories "pan-dns-sec-benign" action allow\n')
            f.write(f'{pfx} profiles spyware "{asp}" botnet-domains dns-security-categories "pan-dns-sec-cc" action sinkhole\n')
            f.write(f'{pfx} profiles spyware "{asp}" botnet-domains dns-security-categories "pan-dns-sec-malware" action sinkhole\n')
            f.write(f'{pfx} profiles spyware "{asp}" botnet-domains sinkhole ipv4-address 127.0.0.1\n')
            f.write(f'{pfx} profiles spyware "{asp}" botnet-domains sinkhole ipv6-address ::1\n')
            # Severity Rules
            f.write(f'{pfx} profiles spyware "{asp}" rule "Critical" severity critical action reset-both\n')
            f.write(f'{pfx} profiles spyware "{asp}" rule "High" severity high action reset-both\n')
            f.write(f'{pfx} profiles spyware "{asp}" rule "Medium" severity medium action reset-both\n')
            f.write("\n")

        # 3. Vulnerability Protection Profile
        vp = getattr(self, 'vp_profile', None)
        if should_generate(vp):
            f.write(f"# Custom Vulnerability Profile: {vp} (Strict)\n")
            f.write(f'{pfx} profiles vulnerability "{vp}" rule "Critical" severity critical action reset-both\n')
            f.write(f'{pfx} profiles vulnerability "{vp}" rule "High" severity high action reset-both\n')
            f.write(f'{pfx} profiles vulnerability "{vp}" rule "Medium" severity medium action reset-both\n')
            f.write("\n")

        # 4. URL Filtering Profile
        url = getattr(self, 'url_profile', None)
        if should_generate(url):
            f.write(f"# Custom URL Filtering Profile: {url} (Strict)\n")
            f.write(f'{pfx} profiles url-filtering "{url}" block [ command-and-control malware phishing ]\n')
            f.write("\n")

        # 5. File Blocking Profile
        fb = getattr(self, 'fb_profile', None)
        if should_generate(fb):
            f.write(f"# Custom File Blocking Profile: {fb} (Strict)\n")
            f.write(f'{pfx} profiles file-blocking "{fb}" rule "Block-Dangerous" application any file-type [ 7z bat chm class cpl dll exe hlp hta jar ocx pif pl scr vbe vbs ws wsf wsh ] direction both action block\n')
            f.write(f'{pfx} profiles file-blocking "{fb}" rule "Alert-All" application any file-type any direction both action alert\n')
            f.write("\n")

        # 6. Wildfire Analysis Profile
        wf = getattr(self, 'wf_profile', None)
        if should_generate(wf):
            f.write(f"# Custom Wildfire Profile: {wf} (Strict)\n")
            f.write(f'{pfx} profiles wildfire-analysis "{wf}" rule "All-Files" application any file-type any direction both analysis public-cloud\n')
            f.write("\n")

    def _generate_interfaces_and_zones(self, f):
        """Men-generate perintah untuk membuat interface dan zona."""
        if not self.config.interfaces: return

        # [NEW] Helper to get mapped interface name
        def get_mapped_name(original_name):
            if original_name in self.interface_mapping:
                val = self.interface_mapping[original_name]
                if isinstance(val, dict):
                     val = val.get('target_interface')

                if val and str(val).strip():
                    return val
            return original_name

        zones_with_members = defaultdict(list)
        physical_interfaces = []
        aggregate_interfaces = []  # List baru untuk Aggregate Interface (ae)
        sub_interfaces = []
        processed_parents = set()
        all_zones = set()

        # [VALIDATION] Interfaces & Zones -> Template
        pfx = self._get_cmd_prefix('network')

        # [NEW] 1. Generate Aggregates from Target Layout
        for agg in self.target_layout:
            name = agg.get('name')
            members = agg.get('members', '')
            if not name: continue
            
            # Ensure name starts with 'ae' for Palo Alto
            if not name.lower().startswith('ae'):
                name = f"ae{name}"
            
            # Add to aggregate list for processing
            # We create a dummy interface object to fit existing logic
            agg_iface = Interface(name=name, description="LACP Aggregate")
            aggregate_interfaces.append(agg_iface)
            
            # Process members (Physical interfaces)
            member_list = [m.strip() for m in members.split(',') if m.strip()]
            for m in member_list:
                # Create physical interface config
                # In Palo Alto, physical interfaces are added to aggregate group
                # We add them to physical_interfaces list but mark them as part of aggregate
                phys_iface = Interface(name=m, description=f"Member of {name}")
                # We need a way to store the aggregate group association
                # Using a temporary attribute
                phys_iface.aggregate_group = name
                physical_interfaces.append(phys_iface)

        for iface in self.config.interfaces:
            # Skip interfaces named 'any' or 'all'
            if not iface.name or iface.name.lower() in ['any', 'all']:
                continue

            if iface.zone:
                # Apply User Mapping (Original Zone -> Target Zone)
                target_zone = self.get_target_zone(iface.zone)
                zones_with_members[target_zone].append(iface.name)
                all_zones.add(target_zone)

            # Check for subinterface pattern (e.g., ethernet1/1.100 or ae1.100)
            if '.' in iface.name:
                sub_interfaces.append(iface)
            elif iface.name.lower().startswith('ae'):
                # Check if already added via layout
                if not any(a.name == iface.name for a in aggregate_interfaces):
                    aggregate_interfaces.append(iface)
            else:
                # Check if already added via layout (as member)
                if not any(p.name == iface.name for p in physical_interfaces):
                    physical_interfaces.append(iface)

        f.write("# --- Interface ---\n")

        # 1. Generate Physical Interfaces
        for iface in sorted(physical_interfaces, key=lambda x: x.name):
            full_name = iface.name
            # Normalisasi nama ethernet (jika format 1/1, ubah jadi ethernet1/1)
            if not full_name.startswith('ethernet') and not full_name.startswith('ae') and not full_name.startswith(
                    'loopback') and not full_name.startswith('tunnel') and not full_name.startswith('vlan'):
                if re.match(r'\d+/\d+', full_name):
                    full_name = f"ethernet{full_name}"

            # Hindari duplikasi jika ternyata masuk ke physical padahal ae (backup check)
            if full_name.startswith('ae'):
                continue

            iface_name = f'"{full_name}"'

            # [NEW] Check if member of aggregate
            agg_group = getattr(iface, 'aggregate_group', None)
            
            if agg_group:
                # Member Interface Config with LACP Active Mode
                f.write(f"{pfx} network interface ethernet {iface_name} aggregate-group {agg_group}\n")
                f.write(f"{pfx} network interface ethernet {iface_name} lacp mode active\n")
            else:
                # Standard Layer 3 Interface
                f.write(f"{pfx} network interface ethernet {iface_name} layer3\n")
                if iface.ip_address and iface.mask_length:
                    f.write(
                        f"{pfx} network interface ethernet {iface_name} layer3 ip {iface.ip_address}/{iface.mask_length}\n")

            description = getattr(iface, 'description', None)
            if description:
                f.write(f'{pfx} network interface ethernet {iface_name} comment "{description}"\n')

            f.write("\n")

        # 1b. Generate Aggregate Interfaces (NEW Feature)
        for iface in sorted(aggregate_interfaces, key=lambda x: x.name):
            iface_name = iface.name
            # Default AE config with LACP Active Mode
            f.write(f"{pfx} network interface aggregate-ethernet {iface_name} layer3\n")
            f.write(
                f"{pfx} network interface aggregate-ethernet {iface_name} aggregate-config standard-lacp-offload no\n")
            # Enable LACP with Active Mode
            f.write(f"{pfx} network interface aggregate-ethernet {iface_name} lacp enable yes\n")
            f.write(f"{pfx} network interface aggregate-ethernet {iface_name} lacp mode active\n")

            if iface.ip_address and iface.mask_length:
                f.write(
                    f"{pfx} network interface aggregate-ethernet {iface_name} layer3 ip [ {iface.ip_address}/{iface.mask_length} ]\n")

            description = getattr(iface, 'description', None)
            if description:
                f.write(f'{pfx} network interface aggregate-ethernet {iface_name} comment "{description}"\n')
            f.write("\n")

        # 2. Generate Subinterfaces logic (Support Ethernet & Aggregate)
        for iface in sorted(sub_interfaces, key=lambda x: x.name):
            try:
                parent, unit = iface.name.split('.', 1)

                # Normalize parent name
                parent_lower = parent.lower()

                # Logic jika Parent adalah Ethernet Biasa
                if not parent_lower.startswith('ae'):
                    if not parent_lower.startswith('ethernet') and re.match(r'\d+/\d+', parent):
                        parent = f"ethernet{parent}"
                        parent_lower = parent.lower()

                    # Ensure parent is configured as layer3
                    if parent not in processed_parents and parent_lower.startswith('ethernet'):
                        # Only if NOT an aggregate member
                        is_member = any(p.name == parent and getattr(p, 'aggregate_group', None) for p in physical_interfaces)
                        if not is_member:
                            f.write(f"{pfx} network interface ethernet {parent} layer3 lldp enable yes\n")
                            f.write(f"{pfx} network interface ethernet {parent} layer3 lldp profile lldp\n")
                            processed_parents.add(parent)

                    if parent_lower.startswith('ethernet'):
                        base_cmd = f"{pfx} network interface ethernet {parent} layer3 units {iface.name}"
                        f.write(f"{base_cmd} tag {unit}\n")
                        if iface.ip_address and iface.mask_length:
                            f.write(f"{base_cmd} ip [ {iface.ip_address}/{iface.mask_length} ]\n")
                        description = getattr(iface, 'description', None)
                        if description:
                            f.write(f'{base_cmd} comment "{description}"\n')

                # Logic jika Parent adalah Aggregate Ethernet (ae)
                elif parent_lower.startswith('ae'):
                    # Ensure parent is configured (implicit creation if missing in definition)
                    if parent not in processed_parents:
                        f.write(f"{pfx} network interface aggregate-ethernet {parent} layer3\n")
                        f.write(
                            f"{pfx} network interface aggregate-ethernet {parent} aggregate-config standard-lacp-offload no\n")
                        processed_parents.add(parent)

                    base_cmd = f"{pfx} network interface aggregate-ethernet {parent} layer3 units {iface.name}"
                    f.write(f"{base_cmd} tag {unit}\n")

                    if iface.ip_address and iface.mask_length:
                        f.write(f"{base_cmd} ip [ {iface.ip_address}/{iface.mask_length} ]\n")

                    description = getattr(iface, 'description', None)
                    if description:
                        f.write(f'{base_cmd} comment "{description}"\n')

            except ValueError:
                # Fallback for weird names
                pass
            f.write("\n")

        f.write("\n")

        f.write("# --- Zone ---\n")
        for zone_name in sorted(list(all_zones)):
            f.write(f'{pfx} zone "{zone_name}" network layer3')
            members = zones_with_members.get(zone_name)
            if members:
                members_str = " ".join([f'"{m}"' for m in sorted(members)])
                f.write(f" [ {members_str} ]")
            f.write("\n")
        f.write("\n")

    def _generate_static_routes(self, f):
        """Generate static routes with naming based on destination."""
        if not self.config.static_routes: return
        
        # [VALIDATION] Static Routes -> Template
        pfx = self._get_cmd_prefix('network')
        
        f.write("# --- Routes ---\n")

        used_route_names = set()

        for i, route in enumerate(self.config.static_routes):
            if "Dynamic-" in str(route.next_hop):
                f.write(
                    f"# [DYNAMIC ROUTE DETECTED] Network: {route.destination} (Originally {route.interface.upper()}). Please configure OSPF/BGP profiles.\n")
                continue

            dest = route.destination.strip()

            if dest == "0.0.0.0/0" or dest == "0.0.0.0 0.0.0.0":
                base_name = "Default-Route"
            else:
                safe_dest = dest.replace('/', 'n').replace(' ', 'n')
                base_name = f"Route-{safe_dest}"

            route_name = base_name
            counter = 1
            while route_name in used_route_names:
                route_name = f"{base_name}_{counter}"
                counter += 1
            used_route_names.add(route_name)

            f.write(
                f"{pfx} network virtual-router default routing-table ip static-route {route_name} nexthop ip-address {route.next_hop}\n")
            if route.interface:
                f.write(
                    f"{pfx} network virtual-router default routing-table ip static-route {route_name} nexthop interface {route.interface}\n")
            f.write(
                f"{pfx} network virtual-router default routing-table ip static-route {route_name} destination {route.destination}\n")
            if route.distance and route.distance != 10:
                f.write(
                    f"{pfx} network virtual-router default routing-table ip static-route {route_name} metric {route.distance}\n")
        f.write("\n")

    def _generate_dynamic_routing(self, f):
        """
        [NEW] Generate BGP Configuration for Palo Alto.
        Parses the raw dynamic_routing_config string to extract BGP details.
        """
        raw_config = getattr(self.config, 'dynamic_routing_config', '')
        if not raw_config or 'bgp' not in raw_config.lower():
            return

        # [VALIDATION] BGP -> Template
        pfx = self._get_cmd_prefix('network')
        
        f.write("# --- Dynamic Routing ---\n")
        
        # --- 1. Parse Raw Config (Fortinet & Cisco Support) ---
        bgp_data = {
            'local_as': None,
            'router_id': None,
            'neighbors': [], # List of {ip, remote_as, description}
            'networks': []   # List of {ip, mask}
        }

        lines = raw_config.splitlines()
        
        # Heuristic: Detect Vendor Format
        is_fortinet = 'config router bgp' in raw_config
        
        if is_fortinet:
            # Fortinet Parsing Logic
            current_neighbor_ip = None
            in_neighbor_block = False
            in_network_block = False
            
            for line in lines:
                line = line.strip()
                if line.startswith('set as'):
                    bgp_data['local_as'] = line.split()[-1]
                elif line.startswith('set router-id'):
                    bgp_data['router_id'] = line.split()[-1]
                elif line == 'config neighbor':
                    in_neighbor_block = True
                elif line == 'config network':
                    in_network_block = True
                elif line == 'end':
                    in_neighbor_block = False
                    in_network_block = False
                    current_neighbor_ip = None
                
                if in_neighbor_block:
                    if line.startswith('edit'):
                        current_neighbor_ip = line.split()[1].strip('"')
                        bgp_data['neighbors'].append({'ip': current_neighbor_ip, 'remote_as': None, 'description': None})
                    elif line.startswith('set remote-as') and current_neighbor_ip:
                        bgp_data['neighbors'][-1]['remote_as'] = line.split()[-1]
                    elif line.startswith('set description') and current_neighbor_ip:
                        # Extract description inside quotes
                        desc_match = re.search(r'set description "(.*)"', line)
                        if desc_match:
                            bgp_data['neighbors'][-1]['description'] = desc_match.group(1)
                
                if in_network_block:
                    if line.startswith('set prefix'):
                        parts = line.split()
                        if len(parts) >= 4:
                            bgp_data['networks'].append({'ip': parts[2], 'mask': parts[3]})

        else:
            # Cisco/Generic Parsing Logic
            for line in lines:
                line = line.strip()
                if line.startswith('router bgp'):
                    bgp_data['local_as'] = line.split()[-1]
                elif line.startswith('bgp router-id'):
                    bgp_data['router_id'] = line.split()[-1]
                elif line.startswith('neighbor') and 'remote-as' in line:
                    parts = line.split()
                    # neighbor <IP> remote-as <AS>
                    if len(parts) >= 4:
                        bgp_data['neighbors'].append({'ip': parts[1], 'remote_as': parts[3], 'description': None})
                elif line.startswith('network') and 'mask' in line:
                    parts = line.split()
                    # network <IP> mask <MASK>
                    if len(parts) >= 4:
                        bgp_data['networks'].append({'ip': parts[1], 'mask': parts[3]})

        # --- 2. Generate Palo Alto Commands ---
        if not bgp_data['local_as']:
            f.write("# Warning: Could not detect Local AS Number. BGP config skipped.\n\n")
            return

        # Enable BGP
        f.write(f"{pfx} network virtual-router default protocol bgp enable yes\n")
        f.write(f"{pfx} network virtual-router default protocol bgp local-as {bgp_data['local_as']}\n")
        if bgp_data['router_id']:
            f.write(f"{pfx} network virtual-router default protocol bgp router-id {bgp_data['router_id']}\n")
        
        # Create Peer Groups (iBGP & eBGP)
        # We need to group neighbors first
        ibgp_peers = []
        ebgp_peers = []
        
        for neigh in bgp_data['neighbors']:
            if neigh['remote_as'] == bgp_data['local_as']:
                ibgp_peers.append(neigh)
            else:
                ebgp_peers.append(neigh)
        
        if ibgp_peers:
            f.write(f"{pfx} network virtual-router default protocol bgp peer-group PG-IBGP type ibgp\n")
            for peer in ibgp_peers:
                peer_name = f"Peer-{peer['ip'].replace('.', '_')}"
                f.write(f"{pfx} network virtual-router default protocol bgp peer-group PG-IBGP peer {peer_name} peer-address ip {peer['ip']}\n")
                f.write(f"{pfx} network virtual-router default protocol bgp peer-group PG-IBGP peer {peer_name} connection-options incoming-bgp-connection remote-port 179\n")
                f.write(f"{pfx} network virtual-router default protocol bgp peer-group PG-IBGP peer {peer_name} connection-options outgoing-bgp-connection local-port 0\n")
                if peer['remote_as']:
                    f.write(f"{pfx} network virtual-router default protocol bgp peer-group PG-IBGP peer {peer_name} peer-as {peer['remote_as']}\n")
        
        if ebgp_peers:
            f.write(f"{pfx} network virtual-router default protocol bgp peer-group PG-EBGP type ebgp\n")
            for peer in ebgp_peers:
                peer_name = f"Peer-{peer['ip'].replace('.', '_')}"
                f.write(f"{pfx} network virtual-router default protocol bgp peer-group PG-EBGP peer {peer_name} peer-address ip {peer['ip']}\n")
                f.write(f"{pfx} network virtual-router default protocol bgp peer-group PG-EBGP peer {peer_name} connection-options incoming-bgp-connection remote-port 179\n")
                f.write(f"{pfx} network virtual-router default protocol bgp peer-group PG-EBGP peer {peer_name} connection-options outgoing-bgp-connection local-port 0\n")
                if peer['remote_as']:
                    f.write(f"{pfx} network virtual-router default protocol bgp peer-group PG-EBGP peer {peer_name} peer-as {peer['remote_as']}\n")

        # Network Advertisement (Redistribution Profile)
        if bgp_data['networks']:
            f.write("\n# BGP Network Advertisements (via Redistribution Profile)\n")
            profile_name = "RP-BGP-Networks"
            
            # Create Profile
            f.write(f"{pfx} network virtual-router default redistribution-profile {profile_name} action redist\n")
            f.write(f"{pfx} network virtual-router default redistribution-profile {profile_name} priority 1\n")
            
            # Add Prefixes
            prefixes = []
            for net in bgp_data['networks']:
                # Convert mask to CIDR
                try:
                    cidr = sum([bin(int(x)).count('1') for x in net['mask'].split('.')])
                    prefixes.append(f"{net['ip']}/{cidr}")
                except:
                    prefixes.append(f"{net['ip']}/32") # Fallback
            
            prefix_str = " ".join(prefixes)
            f.write(f"{pfx} network virtual-router default redistribution-profile {profile_name} filter destination [ {prefix_str} ]\n")
            
            # Apply to BGP
            f.write(f"{pfx} network virtual-router default protocol bgp redistribution-rule {profile_name} enable yes\n")

        f.write("\n")

    def _generate_addresses(self, f):
        if not self.config.addresses: return
        
        # [VALIDATION] Objects -> Device Group
        pfx = self._get_cmd_prefix('object')
        
        f.write("# --- Object Address ---\n")
        for addr in sorted(self.config.addresses, key=lambda x: x.name):
            clean_name = self._sanitize_name(addr.name)
            name = f'"{clean_name}"'
            
            # [NEW] Wildcard FQDN Logic (PAN-OS 11+)
            # If FQDN starts with '*', treat as Custom URL Category, NOT Address Object
            if addr.type == 'fqdn' and addr.value1.startswith('*'):
                # Store for Rule generation later
                self.wildcard_fqdns[clean_name] = addr.value1
                # Do NOT generate address object command
                continue
                
            if addr.type == 'host':
                f.write(f"{pfx} address {name} ip-netmask {addr.value1}/32\n")
            elif addr.type == 'network':
                f.write(f"{pfx} address {name} ip-netmask {addr.value1}/{addr.value2}\n")
            elif addr.type == 'range':
                f.write(f"{pfx} address {name} ip-range {addr.value1}-{addr.value2}\n")
            elif addr.type == 'fqdn':
                f.write(f"{pfx} address {name} fqdn {addr.value1}\n")
        
        # [NEW] Generate Custom URL Categories for Wildcards
        if self.wildcard_fqdns:
            f.write("\n# --- Custom URL Categories ---\n")
            # Custom URL Categories are Profiles, so they go to Device Group in Panorama
            pfx_prof = self._get_cmd_prefix('profile')
            
            for name, url in self.wildcard_fqdns.items():
                # Remove leading '*' for URL category if needed, but usually *.example.com is valid
                # PAN-OS expects the pattern.
                # Note: name is already sanitized.
                f.write(f'{pfx_prof} profiles custom-url-category "{name}" list [ "{url}" ]\n')
                f.write(f'{pfx_prof} profiles custom-url-category "{name}" type "URL List"\n')
                f.write(f'{pfx_prof} profiles custom-url-category "{name}" description "Converted from Wildcard FQDN Address"\n')
        
        # [NEW] Auto-generate Address Objects for NAT Pools (SNAT/DNAT)
        f.write("\n# --- NAT Pool Objects ---\n")
        for nat in self.config.nat_rules:
            # Check Translated Source (SNAT Pool)
            ts = nat.translated_source
            if ts and ts.lower() not in ['dynamic-ip-and-port', 'original']:
                clean_ts = self._sanitize_name(ts)
                if clean_ts not in self.existing_address_names:
                    # Heuristic: Try to detect if it's IP, Range, or FQDN
                    # For pools, it's usually IP or Range.
                    # If it looks like an IP, create host object.
                    # If it looks like range (IP-IP), create range object.
                    # If it's a name, assume it's already an object (but we check existing_address_names).
                    
                    # Simple IP check regex
                    ip_pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'
                    range_pattern = r'^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})-(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$'
                    
                    if re.match(ip_pattern, ts):
                        f.write(f'{pfx} address "{clean_ts}" ip-netmask {ts}/32\n')
                        self.existing_address_names.add(clean_ts)
                    elif re.match(range_pattern, ts):
                        f.write(f'{pfx} address "{clean_ts}" ip-range {ts}\n')
                        self.existing_address_names.add(clean_ts)
                    else:
                        # Fallback: If it's a name like "POOL_10.12...", we might need to extract IP from name or just warn.
                        # But often in Fortinet, the pool name IS the object name we want.
                        # If we can't resolve value, we can't create it safely.
                        # However, if the user provided a name that implies an IP (e.g. POOL_1.1.1.1), we can try to extract.
                        extracted_ip = re.search(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', ts)
                        if extracted_ip:
                            ip_val = extracted_ip.group(1)
                            f.write(f'{pfx} address "{clean_ts}" ip-netmask {ip_val}/32\n')
                            self.existing_address_names.add(clean_ts)

            # Check Translated Destination (DNAT Pool)
            td = nat.translated_destination
            if td and td.lower() != 'original':
                clean_td = self._sanitize_name(td)
                if clean_td not in self.existing_address_names:
                     # Similar logic
                    ip_pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'
                    if re.match(ip_pattern, td):
                        f.write(f'{pfx} address "{clean_td}" ip-netmask {td}/32\n')
                        self.existing_address_names.add(clean_td)
                    
        f.write("\n")

    def _generate_services(self, f):
        if not self.config.services: return
        
        # [VALIDATION] Objects -> Device Group
        pfx = self._get_cmd_prefix('object')
        
        f.write("# --- Object Service ---\n")
        for svc in sorted(self.config.services, key=lambda x: x.name):
            clean_name = self._sanitize_name(svc.name)
            name = f'"{clean_name}"'
            protocol = svc.protocol.lower()
            if protocol in ["tcp", "udp"]:
                port_range = self._translate_port_string(svc.port)
                if port_range:
                    f.write(f'{pfx} service {name} protocol {protocol} port {port_range}\n')
            elif protocol == "icmp":
                f.write(f'{pfx} service {name} protocol {protocol}\n')
        f.write("\n")

    def _generate_address_groups(self, f):
        if not self.config.address_groups: return
        
        # [VALIDATION] Objects -> Device Group
        pfx = self._get_cmd_prefix('object')
        
        f.write("# --- Address Group ---\n")
        for grp in sorted(self.config.address_groups, key=lambda x: x.name):
            clean_grp_name = self._sanitize_name(grp.name)
            name = f'"{clean_grp_name}"'
            members_list = [f'"{self._sanitize_name(m)}"' for m in sorted(list(grp.members))]
            if members_list:
                members_str = " ".join(members_list)
                f.write(f"{pfx} address-group {name} static [ {members_str} ]\n")
        f.write("\n")

    def _generate_service_groups(self, f):
        if not self.config.service_groups: return
        
        # [VALIDATION] Objects -> Device Group
        pfx = self._get_cmd_prefix('object')
        
        f.write("# --- Service Group ---\n")
        for grp in sorted(self.config.service_groups, key=lambda x: x.name):
            clean_grp_name = self._sanitize_name(grp.name)
            name = f'"{clean_grp_name}"'
            members_list = [f'"{self._sanitize_name(m)}"' for m in sorted(list(grp.members))]
            if members_list:
                members_str = " ".join(members_list)
                f.write(f"{pfx} service-group {name} members [ {members_str} ]\n")
        f.write("\n")

    def _generate_rules(self, f):
        if not self.config.rules: return
        
        # [VALIDATION] Rules -> Device Group (Pre-Rulebase)
        pfx = self._get_cmd_prefix('rule')
        
        f.write("# --- Security Policy ---\n")

        # Params from kwargs (Security Profiles)
        av_profile = getattr(self, 'av_profile', None)
        as_profile = getattr(self, 'as_profile', None)
        vp_profile = getattr(self, 'vp_profile', None)
        url_profile = getattr(self, 'url_profile', None)
        wf_profile = getattr(self, 'wf_profile', None)
        fb_profile = getattr(self, 'fb_profile', None)
        log_profile = getattr(self, 'log_profile', None)

        dnat_reverse_map = {}
        for nat_rule in self.config.nat_rules:
            if nat_rule.translated_destination and nat_rule.original_destination:
                dnat_reverse_map[nat_rule.translated_destination] = list(nat_rule.original_destination)[0]

        for rule in self.config.rules:
            # Intelligent Rule Splitting Logic
            icmp_keywords = ['ICMP', 'PING', 'TRACEROUTE']
            regular_svcs = []
            icmp_apps = set(rule.application) if rule.application else set()

            for svc in rule.service:
                svc_upper = svc.upper()
                is_icmp_svc = False
                for k in icmp_keywords:
                    if k in svc_upper:
                        is_icmp_svc = True
                        break

                if is_icmp_svc:
                    if 'TRACEROUTE' in svc_upper:
                        icmp_apps.add('traceroute')
                    elif 'PING' in svc_upper:
                        icmp_apps.add('ping')
                    else:
                        icmp_apps.add('icmp')
                        icmp_apps.add('ping')
                else:
                    regular_svcs.append(svc)

            rules_to_generate = []

            # 1. Regular Service Rule
            if regular_svcs or (not icmp_apps and not regular_svcs):
                suffix = "_svc" if (icmp_apps and regular_svcs) else ""
                final_svcs = regular_svcs if regular_svcs else []
                rules_to_generate.append({
                    "suffix": suffix,
                    "services": final_svcs,
                    "applications": ['any'],
                    "service_setting": "explicit"
                })

            # 2. App-ID Rule (ICMP)
            if icmp_apps:
                suffix = "_app" if regular_svcs else ""
                rules_to_generate.append({
                    "suffix": suffix,
                    "services": [],
                    "applications": sorted(list(icmp_apps)),
                    "service_setting": "app-default"
                })

            for r_conf in rules_to_generate:
                name_suffix = r_conf["suffix"]
                base_name_len = 63 - len(name_suffix)
                r_name = f"{self._sanitize_name(rule.name)[:base_name_len]}{name_suffix}"

                name = f'"{r_name}"'
                base_cmd = f"{pfx} security rules {name}"

                # --- NORMALIZE ACTION ---
                # Check if action is 'allow', 'permit', or 'accept' (case-insensitive)
                is_allow = rule.action and rule.action.lower() in ['allow', 'permit', 'accept']

                # --- PROFILE SETTINGS ---
                # Hanya tulis profil jika action adalah allow/permit/accept
                if is_allow:
                    if av_profile: f.write(f'{base_cmd} profile-setting profiles virus "{av_profile}"\n')
                    if as_profile: f.write(f'{base_cmd} profile-setting profiles spyware "{as_profile}"\n')
                    if vp_profile: f.write(f'{base_cmd} profile-setting profiles vulnerability "{vp_profile}"\n')
                    if url_profile: f.write(f'{base_cmd} profile-setting profiles url-filtering "{url_profile}"\n')
                    if wf_profile: f.write(f'{base_cmd} profile-setting profiles wildfire-analysis "{wf_profile}"\n')
                    if fb_profile: f.write(f'{base_cmd} profile-setting profiles file-blocking "{fb_profile}"\n')

                # --- Zones Resolution (FIXED: Interface Name -> Zone Name) ---
                # Menggunakan helper _resolve_zones untuk memastikan kita menulis Zone, bukan Interface
                from_zones = self._resolve_zones(list(rule.source_interface))
                from_str = " ".join([f'"{z}"' for z in from_zones]) if from_zones else "any"

                to_zones = self._resolve_zones(list(rule.destination_interface))
                to_str = " ".join([f'"{z}"' for z in to_zones]) if to_zones else "any"

                f.write(f"{base_cmd} to [ {to_str} ]\n")
                f.write(f"{base_cmd} from [ {from_str} ]\n")

                # --- Source ---
                src_list = sorted(list(rule.source))
                # [FIXED] Check for 'all' as well
                if not src_list or any(s.lower() in ['any', 'all'] for s in src_list):
                    src_members_str = "any"
                else:
                    members = " ".join([f'"{self._sanitize_name(m)}"' for m in src_list])
                    src_members_str = f"[ {members} ]"
                f.write(f"{base_cmd} source {src_members_str}\n")

                # --- Destination ---
                final_destinations = set()
                custom_url_categories = set() # [NEW] Store wildcard FQDNs here
                
                for dest_object in rule.destination:
                    sanitized_dest = self._sanitize_name(dest_object)
                    
                    # [NEW] Check if this object is a Wildcard FQDN (Custom URL)
                    if sanitized_dest in self.wildcard_fqdns:
                        custom_url_categories.add(sanitized_dest)
                    elif dest_object in dnat_reverse_map:
                        final_destinations.add(dnat_reverse_map[dest_object])
                    else:
                        final_destinations.add(dest_object)
                        
                dst_list = sorted(list(final_destinations))
                # [FIXED] Check for 'all' as well
                if not dst_list or any(d.lower() in ['any', 'all'] for d in dst_list):
                    dst_members_str = "any"
                else:
                    members = " ".join([f'"{self._sanitize_name(m)}"' for m in dst_list])
                    dst_members_str = f"[ {members} ]"
                f.write(f"{base_cmd} destination {dst_members_str}\n")

                # --- PAN-OS 11+ DEFAULT PARAMETERS ---
                f.write(f"{base_cmd} source-user any\n")
                
                # [NEW] Category Logic (Standard + Custom URL)
                if custom_url_categories:
                    # If we have custom URLs, add them to category
                    cats = " ".join([f'"{c}"' for c in sorted(list(custom_url_categories))])
                    f.write(f"{base_cmd} category [ {cats} ]\n")
                else:
                    f.write(f"{base_cmd} category any\n")

                f.write(f"{base_cmd} saas-user-list any\n")
                f.write(f"{base_cmd} saas-tenant-list any\n")

                # --- Application ---
                app_list = r_conf["applications"]
                if 'any' in app_list:
                    f.write(f"{base_cmd} application any\n")
                else:
                    members = " ".join([f'"{a}"' for a in app_list])
                    f.write(f"{base_cmd} application [ {members} ]\n")

                # --- Service ---
                if r_conf["service_setting"] == "app-default":
                    f.write(f"{base_cmd} service application-default\n")
                else:
                    svc_list = r_conf["services"]
                    # [FIXED] Check for 'all' and map to 'any' instead of 'application-default'
                    if not svc_list or any(s.lower() in ['any', 'all'] for s in svc_list):
                        f.write(f"{base_cmd} service any\n")
                    else:
                        svc_list_filtered = [s for s in svc_list if s.lower() != 'application-default']
                        if not svc_list_filtered:
                            f.write(f"{base_cmd} service application-default\n")
                        else:
                            members = " ".join([f'"{self._sanitize_name(s)}"' for s in svc_list_filtered])
                            f.write(f"{base_cmd} service [ {members} ]\n")

                # --- HIP Profiles ---
                f.write(f"{base_cmd} source-hip any\n")
                f.write(f"{base_cmd} destination-hip any\n")

                # --- Action & Action Settings ---
                # Normalize action to 'allow' or 'deny' for Palo Alto
                action = "allow" if is_allow else "deny"
                f.write(f"{base_cmd} action {action}\n")

                f.write(f"{base_cmd} log-start no\n")
                f.write(f"{base_cmd} log-end yes\n")
                f.write(f"{base_cmd} target negate no\n")
                f.write(f"{base_cmd} rule-type universal\n")

                # --- Log Profile ---
                if log_profile:
                    f.write(f'{base_cmd} log-setting "{log_profile}"\n')

                # --- Extras ---
                if rule.remark:
                    clean_remark = rule.remark.replace('"', "'")
                    f.write(f'{base_cmd} description "{clean_remark}"\n')
                if not rule.enabled:
                    f.write(f"{base_cmd} disabled yes\n")
                if rule.time_range:
                    f.write(f'{base_cmd} schedule "{rule.time_range}"\n')

            f.write("\n")

    def _generate_nat_rules(self, f):
        if not self.config.nat_rules: return
        
        # [VALIDATION] NAT -> Device Group (Pre-Rulebase)
        pfx = self._get_cmd_prefix('nat')

        f.write("# --- NAT ---\n")
        for rule in self.config.nat_rules:
            name = f'"{rule.name}"'
            base_cmd = f"{pfx} nat rules {name}"

            # --- Zone Resolution for Matching ---
            # Gunakan _resolve_zones untuk 'from' dan 'to' agar matching menggunakan Zone
            from_zones = self._resolve_zones(list(rule.source_interface))
            from_str = " ".join([f'"{z}"' for z in from_zones]) if from_zones else "any"

            # Simpan interface asli untuk referensi di konfigurasi translation (interface-address)
            dest_intfs_original = sorted(list(rule.destination_interface))
            to_zones = self._resolve_zones(list(rule.destination_interface))
            to_str = " ".join([f'"{z}"' for z in to_zones]) if to_zones else "any"

            f.write(f"{base_cmd} from [ {from_str} ]\n")
            f.write(f"{base_cmd} to [ {to_str} ]\n")

            src_list = sorted(list(rule.original_source))
            # [FIXED] Check for 'all'
            if not src_list or any(s.lower() in ['any', 'all'] for s in src_list):
                src_members_str = "[ any ]"
            else:
                members = " ".join([f'"{self._sanitize_name(m)}"' for m in src_list])
                src_members_str = f"[ {members} ]"
            f.write(f"{base_cmd} source {src_members_str}\n")

            dst_list = sorted(list(rule.original_destination))
            # [FIXED] Check for 'all'
            if not dst_list or any(d.lower() in ['any', 'all'] for d in dst_list):
                dst_members_str = "[ any ]"
            else:
                members = " ".join([f'"{self._sanitize_name(m)}"' for m in dst_list])
                dst_members_str = f"[ {members} ]"
            f.write(f"{base_cmd} destination {dst_members_str}\n")

            # [FIXED] Force 'service any' for ICMP/Traceroute in NAT
            # NAT Policy in Palo Alto does NOT support App-ID (ping, traceroute).
            # It only supports Service (Ports).
            is_icmp_or_traceroute = False
            if rule.original_service:
                for s in rule.original_service:
                    s_lower = s.lower()
                    if 'icmp' in s_lower or 'ping' in s_lower or 'traceroute' in s_lower:
                        is_icmp_or_traceroute = True
                        break
            
            if is_icmp_or_traceroute:
                f.write(f'{base_cmd} service any\n')
                # [NEW] Add auto-description for clarity
                desc = rule.remark or ""
                auto_note = "[AUTO-FIX] Service changed to 'any' for ICMP/Traceroute compatibility in NAT."
                if desc:
                    desc += f" {auto_note}"
                else:
                    desc = auto_note
                f.write(f'{base_cmd} description "{desc}"\n')

            elif rule.original_service and not any(s.lower() in ['any', 'all'] for s in rule.original_service):
                svc = list(rule.original_service)[0]
                f.write(f'{base_cmd} service "{self._sanitize_name(svc)}"\n')
            else:
                f.write(f'{base_cmd} service any\n')

            if rule.translated_source:
                if rule.translated_source == 'dynamic-ip-and-port':
                    # Masquerade (Interface PAT)
                    # Penting: interface-address membutuhkan NAMA INTERFACE, bukan NAMA ZONE.
                    # Kita gunakan interface pertama dari list destination_interface (target mapping)
                    if dest_intfs_original:
                        intf_name = dest_intfs_original[0]
                        f.write(
                            f"{base_cmd} source-translation dynamic-ip-and-port interface-address interface {intf_name}\n")
                    else:
                        # Fallback jika tidak ada interface tujuan terdefinisi
                        f.write(
                            f"# WARNING: Destination Interface unknown. Please set manually:\n")
                        f.write(
                            f"# {base_cmd} source-translation dynamic-ip-and-port interface-address interface <OUTSIDE_INTERFACE>\n")
                else:
                    ts = self._sanitize_name(rule.translated_source)
                    # [FIXED] Flattened NAT syntax (no curly braces)
                    f.write(f'{base_cmd} source-translation static-ip translated-address "{ts}"\n')
                    f.write(f'{base_cmd} source-translation static-ip bi-directional no\n')

            if rule.translated_destination:
                td = self._sanitize_name(rule.translated_destination)
                f.write(f'{base_cmd} destination-translation translated-address "{td}"\n')

            if not rule.enabled:
                f.write(f"{base_cmd} disabled yes\n")
            if rule.remark and not is_icmp_or_traceroute: # Avoid double description
                clean_remark = rule.remark.replace('"', "'")
                f.write(f'{base_cmd} description "{clean_remark}"\n')

            f.write("\n")
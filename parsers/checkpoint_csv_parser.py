# -*- coding: utf-8 -*-
"""
Checkpoint CSV Parser - Parses CSV exports from SmartConsole.
"""
import csv
import io

from models import Address, Group, Service, ServiceGroup, FirewallConfig


class CheckpointCSVParser:
    """
    Parses Checkpoint object exports in CSV format.
    Expected files (matched by pattern):
    - *add-host*.csv
    - *add-network*.csv
    - *add-address-range*.csv
    - *add-group*.csv
    - *add-service-tcp*.csv
    - *add-service-udp*.csv
    - *add-service-group*.csv
    """

    def _get_reader(self, content: str):
        """
        Returns a DictReader with normalized headers (lowercase, stripped).
        """
        # Read content to list of lines to handle headers manually
        f = io.StringIO(content)
        try:
            # Read first line for headers
            header_line = next(csv.reader(f))
            # Normalize headers: strip whitespace and convert to lower case
            fieldnames = [h.strip().lower() for h in header_line]
            
            # Create DictReader with explicit fieldnames
            # We don't verify fieldnames here, just use them.
            # DictReader will consume subsequent lines as data.
            return csv.DictReader(f, fieldnames=fieldnames)
        except StopIteration:
            # Empty file
            return []

    def parse_hosts(self, content: str, config: FirewallConfig):
        """Parse host objects from CSV."""
        reader = self._get_reader(content)
        for row in reader:
            name = row.get('name', '').strip()
            ip_addr = row.get('ipv4-address', '').strip()
            if name and ip_addr:
                # Host = /32 mask
                config.addresses.add(Address(name=name, type='host', value1=ip_addr, value2='32'))

    def parse_networks(self, content: str, config: FirewallConfig):
        """Parse network objects from CSV."""
        reader = self._get_reader(content)
        for row in reader:
            name = row.get('name', '').strip()
            subnet = row.get('subnet4', '').strip()
            mask_length = row.get('mask-length4', '').strip()
            if name and subnet and mask_length:
                config.addresses.add(Address(name=name, type='network', value1=subnet, value2=mask_length))

    def parse_address_ranges(self, content: str, config: FirewallConfig):
        """Parse address range objects from CSV."""
        reader = self._get_reader(content)
        for row in reader:
            name = row.get('name', '').strip()
            ip_first = row.get('ipv4-address-first', '').strip()
            ip_last = row.get('ipv4-address-last', '').strip()
            if name and ip_first and ip_last:
                config.addresses.add(Address(name=name, type='range', value1=ip_first, value2=ip_last))

    def parse_groups(self, content: str, config: FirewallConfig):
        """
        Parse address group objects from CSV.
        CheckPoint exports use indexed columns: members.0, members.1, members.2, etc.
        """
        reader = self._get_reader(content)
        group_map = {}  # name -> set of members
        
        print(f"[DEBUG] Parsing group CSV...")
        row_count = 0
        
        for row in reader:
            row_count += 1
            name = row.get('name', '').strip()
            
            if not name:
                continue
            
            # Initialize group if new
            if name not in group_map:
                group_map[name] = set()
            
            # Collect members from indexed columns (members.0, members.1, members.2, ...)
            for key, value in row.items():
                if key.startswith('members.') and value and value.strip():
                    group_map[name].add(value.strip())
        
        # Convert map to Group objects
        for group_name, members in group_map.items():
            config.address_groups.add(Group(name=group_name, members=members))
        
        print(f"[DEBUG] Parsed {len(group_map)} groups from {row_count} rows")
        # Print all groups with member counts
        for name, members in group_map.items():
            print(f"[DEBUG]   Group '{name}': {len(members)} members")
            if len(members) > 0:
                # Show first 3 members as sample
                sample = list(members)[:3]
                print(f"[DEBUG]     Sample members: {sample}")


    def parse_tcp_services(self, content: str, config: FirewallConfig):
        """Parse TCP service objects from CSV."""
        reader = self._get_reader(content)
        for row in reader:
            name = row.get('name', '').strip()
            port = row.get('port', '').strip()
            if name and port:
                config.services.add(Service(name=name, protocol='tcp', port=f'eq {port}'))

    def parse_udp_services(self, content: str, config: FirewallConfig):
        """Parse UDP service objects from CSV."""
        reader = self._get_reader(content)
        for row in reader:
            name = row.get('name', '').strip()
            port = row.get('port', '').strip()
            if name and port:
                config.services.add(Service(name=name, protocol='udp', port=f'eq {port}'))

    def parse_service_groups(self, content: str, config: FirewallConfig):
        """
        Parse service group objects from CSV.
        CheckPoint exports use indexed columns: members.0, members.1, members.2, etc.
        """
        reader = self._get_reader(content)
        group_map = {}  # name -> set of members
        
        for row in reader:
            name = row.get('name', '').strip()
            
            if not name:
                continue
            
            # Initialize group if new
            if name not in group_map:
                group_map[name] = set()
            
            # Collect members from indexed columns (members.0, members.1, members.2, ...)
            for key, value in row.items():
                if key.startswith('members.') and value and value.strip():
                    group_map[name].add(value.strip())
        
        # Convert map to ServiceGroup objects
        for group_name, members in group_map.items():
            config.service_groups.add(ServiceGroup(name=group_name, members=members))

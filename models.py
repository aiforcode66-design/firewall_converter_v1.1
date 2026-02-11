# -*- coding: utf-8 -*-
"""
File ini berisi semua model data (dataclasses) yang digunakan di seluruh aplikasi.
Model-model ini berfungsi sebagai struktur data netral (Hub) dalam arsitektur Hub-and-Spoke.
"""
from dataclasses import dataclass, field
from typing import List, Set, Optional, Dict

@dataclass
class Interface:
    """Mewakili satu interface fisik atau logis (VLAN/subinterface)."""
    name: str
    zone: Optional[str] = None
    ip_address: Optional[str] = None
    mask_length: Optional[int] = None
    description: Optional[str] = None
    vlan_id: Optional[int] = None

    def __hash__(self):
        return hash(self.name)

@dataclass
class Address:
    """Mewakili objek alamat (host, network, atau range)."""
    name: str
    type: str
    value1: str
    value2: str = None
    original_text: str = ""

    def __hash__(self):
        return hash(self.name)

@dataclass
class Service:
    """Mewakili objek service (TCP, UDP, ICMP, dll.)."""
    name: str
    protocol: str
    port: str
    original_text: str = ""

    def __hash__(self):
        return hash(self.name)

@dataclass
class Group:
    """Mewakili grup alamat (address group)."""
    name: str
    members: Set[str] = field(default_factory=set)
    original_text: str = ""

    def __hash__(self):
        return hash(self.name)

@dataclass
class ServiceGroup:
    """Mewakili grup service (service group)."""
    name: str
    members: Set[str] = field(default_factory=set)
    original_text: str = ""

    def __hash__(self):
        return hash(self.name)

@dataclass
class TimeRange:
    """Mewakili objek jadwal/waktu."""
    name: str
    start_time: str = "00:00"
    start_date: str = "2000/01/01"
    end_time: str = "23:59"
    end_date: str = "2038/01/19"
    original_text: str = ""

    def __hash__(self):
        return hash(self.name)

@dataclass
class SecurityProfile:
    """Mewakili satu profil keamanan (IPS, AV, Web Filter, dll.)."""
    name: str
    type: str
    properties: Dict[str, str] = field(default_factory=dict)

    def __hash__(self):
        return hash(self.name)

@dataclass
class StaticRoute:
    """Mewakili satu baris rute statis."""
    destination: str
    next_hop: str
    interface: Optional[str] = None
    distance: int = 10
    metric: Optional[int] = None
    route_type: str = "static"  # static, ospf, bgp, eigrp, rip
    comment: Optional[str] = None

@dataclass
class Rule:
    """Mewakili satu baris aturan firewall (policy)."""
    sequence_id: int
    name: str
    action: str
    remark: str = None
    enabled: bool = True
    log: bool = False  # [NEW] Indicates if logging is enabled
    hit_count: int = 0 # [NEW] Rule hit count
    time_range: str = None
    source_interface: Set[str] = field(default_factory=set)
    destination_interface: Set[str] = field(default_factory=set)
    source: Set[str] = field(default_factory=set)
    destination: Set[str] = field(default_factory=set)
    service: Set[str] = field(default_factory=set)
    application: Set[str] = field(default_factory=set)
    security_profiles: Dict[str, str] = field(default_factory=dict)
    context: str = None
    vdom: str = None
    original_text: str = ""

@dataclass
class NatRule:
    """Mewakili satu baris aturan NAT."""
    sequence_id: int
    name: str
    original_source: Set[str] = field(default_factory=set)
    translated_source: Optional[str] = None
    original_destination: Set[str] = field(default_factory=set)
    translated_destination: Optional[str] = None
    original_service: Set[str] = field(default_factory=set)
    translated_service: Optional[str] = None
    source_interface: Set[str] = field(default_factory=set)
    destination_interface: Set[str] = field(default_factory=set)
    enabled: bool = True
    remark: str = None
    original_text: str = ""

@dataclass
class ConversionWarning:
    """Mewakili pesan peringatan atau error konversi."""
    category: str  # e.g., 'Parser', 'Generator', 'Unsupported'
    message: str
    rule_id: Optional[str] = None # [NEW] Rule ID related to warning
    suggestion: Optional[str] = None # [NEW] Suggestion for fix
    original_line: Optional[str] = None
    severity: str = "warning" # warning, error, info
    details: List[str] = field(default_factory=list) # [NEW] Stores detailed content (e.g. block content)

@dataclass
class FirewallConfig:
    """Kontainer utama yang menampung seluruh konfigurasi yang telah diparse."""
    addresses: Set[Address] = field(default_factory=set)
    services: Set[Service] = field(default_factory=set)
    address_groups: Set[Group] = field(default_factory=set)
    service_groups: Set[ServiceGroup] = field(default_factory=set)
    time_ranges: Set[TimeRange] = field(default_factory=set)
    rules: List[Rule] = field(default_factory=list)
    interfaces: Set[Interface] = field(default_factory=set)
    nat_rules: List[NatRule] = field(default_factory=list)
    security_profiles: Set[SecurityProfile] = field(default_factory=set)
    static_routes: List[StaticRoute] = field(default_factory=list)
    # Field baru untuk menyimpan raw config OSPF/BGP
    dynamic_routing_config: str = ""
    # [NEW] List untuk menampung warning/error konversi
    conversion_warnings: List[ConversionWarning] = field(default_factory=list)
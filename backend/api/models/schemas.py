# -*- coding: utf-8 -*-
"""
Pydantic schemas for API request/response validation.
These models align with TypeScript interfaces on the frontend.
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Set, Literal
from enum import Enum


# ============================================================================
# Enums
# ============================================================================

class Vendor(str, Enum):
    """Supported firewall vendors."""
    CISCO_ASA = "cisco_asa"
    CHECKPOINT = "checkpoint"
    FORTINET = "fortinet"
    PALO_ALTO = "palo_alto"


class ConversionStatus(str, Enum):
    """Status of a conversion job."""
    PENDING = "pending"
    ANALYZING = "analyzing"
    READY_FOR_MAPPING = "ready_for_mapping"
    CONVERTING = "converting"
    COMPLETED = "completed"
    FAILED = "failed"


class ExportFormat(str, Enum):
    """Export file formats."""
    TXT = "txt"
    XLSX = "xlsx"


# ============================================================================
# Domain Models
# ============================================================================

class InterfaceInfo(BaseModel):
    """Network interface information."""
    name: str
    zone: Optional[str] = None
    ip_address: Optional[str] = None
    mask_length: Optional[int] = None
    description: Optional[str] = None
    vlan_id: Optional[int] = None


class AddressObject(BaseModel):
    """Address object (host, network, or range)."""
    name: str
    type: str  # host, network, range, fqdn
    value1: str
    value2: Optional[str] = None
    original_text: str = ""


class ServiceObject(BaseModel):
    """Service object (TCP, UDP, ICMP, etc.)."""
    name: str
    protocol: str
    port: str
    original_text: str = ""


class GroupObject(BaseModel):
    """Address group object."""
    name: str
    members: Set[str] = set()
    original_text: str = ""


class ServiceGroupObject(BaseModel):
    """Service group object."""
    name: str
    members: Set[str] = set()
    original_text: str = ""


class TimeRange(BaseModel):
    """Time range/schedule object."""
    name: str
    start_time: str = "00:00"
    start_date: str = "2000/01/01"
    end_time: str = "23:59"
    end_date: str = "2038/01/19"
    original_text: str = ""


class SecurityProfile(BaseModel):
    """Security profile (IPS, AV, etc.)."""
    profile_type: str
    profile_name: str


class NATRule(BaseModel):
    """NAT rule."""
    id: Optional[str] = None
    original_source: Optional[str] = None
    original_destination: Optional[str] = None
    original_service: Optional[str] = None
    translated_source: Optional[str] = None
    translated_destination: Optional[str] = None
    translated_service: Optional[str] = None
    original_text: str = ""


class Route(BaseModel):
    """Static route."""
    destination: str
    gateway: str
    interface: Optional[str] = None
    original_text: str = ""


class SecurityRule(BaseModel):
    """Security/firewall rule."""
    id: Optional[str] = None
    source_zones: List[str] = []
    source_addresses: List[str] = []
    destination_zones: List[str] = []
    destination_addresses: List[str] = []
    services: List[str] = []
    action: str = ""  # allow, deny, reject
    logging: bool = False
    nat: Optional[str] = None
    time_range: Optional[str] = None
    security_profiles: List[SecurityProfile] = []
    original_text: str = ""
    position: int = 0
    is_disabled: bool = False
    description: Optional[str] = None


class ConfigStats(BaseModel):
    """Configuration statistics."""
    rule_count: int = 0
    object_count: int = 0
    service_count: int = 0
    group_count: int = 0
    nat_count: int = 0
    route_count: int = 0
    time_range_count: int = 0
    warning_count: int = 0


class ConversionWarning(BaseModel):
    """Conversion warning message."""
    rule_id: Optional[str] = None
    severity: str = "warning"  # info, warning, error
    category: str = ""
    message: str = ""
    suggestion: Optional[str] = None


class ComparisonItem(BaseModel):
    """Before/after comparison item."""
    item_type: str = ""
    source_value: str = ""
    target_value: str = ""
    status: str = ""  # converted, modified, not_converted, warning


# ============================================================================
# API Request Models
# ============================================================================

class AnalyzeConfigRequest(BaseModel):
    """Request to analyze a firewall configuration."""
    source_vendor: Vendor
    # File contents will be sent as multipart/form-data
    # Additional vendor-specific fields handled separately


class MappingData(BaseModel):
    """Interface and zone mapping data."""
    interface_mapping: Dict[str, str] = Field(default_factory=dict)
    zone_mapping: Dict[str, str] = Field(default_factory=dict)


class GeneratorOptions(BaseModel):
    """Vendor-specific generator options."""
    # Fortinet options
    fortinet_ips: Optional[str] = None
    fortinet_av: Optional[str] = None
    fortinet_web: Optional[str] = None
    fortinet_file: Optional[str] = None
    fortinet_ssl: Optional[str] = None
    fortinet_nat_mode: Optional[str] = None

    # Palo Alto options
    pa_av_profile: Optional[str] = None
    pa_as_profile: Optional[str] = None
    pa_vp_profile: Optional[str] = None
    pa_url_profile: Optional[str] = None
    pa_wf_profile: Optional[str] = None
    pa_fb_profile: Optional[str] = None
    pa_log_profile: Optional[str] = None
    pa_output_mode: Optional[str] = None
    pa_device_group: Optional[str] = None
    pa_template: Optional[str] = None


class ConvertRequest(BaseModel):
    """Request to convert configuration."""
    config_id: str
    dest_vendor: Vendor
    mapping: MappingData
    generator_options: Optional[GeneratorOptions] = None
    target_layout: List[Dict[str, str]] = Field(default_factory=list)
    exclude_unused: bool = False


# ============================================================================
# API Response Models
# ============================================================================

class VendorCapabilities(BaseModel):
    """Vendor capabilities and options."""
    vendor: Vendor
    display_name: str
    supports_zones: bool = True
    supports_interfaces: bool = True
    supports_aggregate_interfaces: bool = False
    generator_options_type: Optional[str] = None  # "mixed" or "string"
    generator_options_fields: List[str] = []


class AnalyzeConfigResponse(BaseModel):
    """Response from configuration analysis."""
    config_id: str
    source_vendor: Vendor
    interfaces: List[InterfaceInfo]
    zones: List[str] = []
    stats: ConfigStats
    warnings: List[ConversionWarning] = []
    raw_objects: List[AddressObject] = []
    raw_services: List[ServiceObject] = []
    raw_groups: List[GroupObject] = []
    raw_service_groups: List[ServiceGroupObject] = []
    raw_time_ranges: List[TimeRange] = []


class ConversionResults(BaseModel):
    """Results from configuration conversion."""
    conversion_id: str
    config_id: str
    source_vendor: Vendor
    dest_vendor: Vendor
    status: ConversionStatus
    script: str = ""
    stats: ConfigStats
    comparison_table: List[ComparisonItem] = []
    objects_table: List[AddressObject] = []
    rules_table: List[SecurityRule] = []
    nat_rules_table: List[NATRule] = []
    routes_table: List[Route] = []
    time_ranges_table: List[TimeRange] = []
    conversion_warnings: List[ConversionWarning] = []
    created_at: Optional[str] = None


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str
    detail: Optional[str] = None
    status_code: int = 400


# ============================================================================
# Database Models
# ============================================================================

class ConversionSessionCreate(BaseModel):
    """Create a conversion session record."""
    source_vendor: Vendor
    dest_vendor: Vendor
    file_name: str
    config_hash: Optional[str] = None


class ConversionSessionResponse(BaseModel):
    """Conversion session response."""
    id: str
    source_vendor: str
    dest_vendor: str
    created_at: str
    completed_at: Optional[str] = None
    status: str
    file_name: str
    stats: Optional[ConfigStats] = None


class SavedMappingCreate(BaseModel):
    """Create a saved mapping template."""
    name: str
    description: Optional[str] = None
    source_vendor: Vendor
    dest_vendor: Vendor
    interface_mapping: Dict[str, str]
    zone_mapping: Dict[str, str]
    is_default: bool = False


class SavedMappingResponse(BaseModel):
    """Saved mapping response."""
    id: int
    name: str
    description: Optional[str] = None
    source_vendor: str
    dest_vendor: str
    interface_mapping: Dict[str, str]
    zone_mapping: Dict[str, str]
    created_at: str
    is_default: bool


class SavedMappingUpdate(BaseModel):
    """Update a saved mapping template (all fields optional)."""
    name: Optional[str] = None
    description: Optional[str] = None
    interface_mapping: Optional[Dict[str, str]] = None
    zone_mapping: Optional[Dict[str, str]] = None

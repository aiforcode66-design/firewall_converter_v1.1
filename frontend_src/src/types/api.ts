/**
 * API type definitions matching backend Pydantic models
 */

// ============================================================================
// Enums
// ============================================================================

export type Vendor = 'cisco_asa' | 'checkpoint' | 'fortinet' | 'palo_alto';

export type ConversionStatus = 'pending' | 'analyzing' | 'ready_for_mapping' | 'converting' | 'completed' | 'failed';

export type ExportFormat = 'txt' | 'xlsx';

// ============================================================================
// Domain Models
// ============================================================================

export interface InterfaceInfo {
  name: string;
  zone?: string;
  ip_address?: string;
  mask_length?: number;
  description?: string;
  vlan_id?: number;
}

export interface AddressObject {
  name: string;
  type: string; // host, network, range, fqdn
  value1: string;
  value2?: string;
  original_text: string;
}

export interface ServiceObject {
  name: string;
  protocol: string;
  port: string;
  original_text: string;
}

export interface GroupObject {
  name: string;
  members: Set<string>;
  original_text: string;
}

export interface ServiceGroupObject {
  name: string;
  members: Set<string>;
  original_text: string;
}

export interface TimeRange {
  name: string;
  start_time: string;
  start_date: string;
  end_time: string;
  end_date: string;
  original_text: string;
}

export interface SecurityProfile {
  profile_type: string;
  profile_name: string;
}

export interface NATRule {
  id?: string;
  original_source?: string[];
  original_destination?: string[];
  original_service?: string[];
  translated_source?: string;
  translated_destination?: string;
  translated_service?: string;
  original_text: string;
}

export interface Route {
  destination: string;
  gateway: string;
  interface?: string;
  original_text: string;
}

export interface SecurityRule {
  id?: string;
  source_zones: string[];
  source_addresses: string[];
  destination_zones: string[];
  destination_addresses: string[];
  services: string[];
  action: string; // allow, deny, reject
  logging: boolean;
  nat?: string;
  time_range?: string;
  security_profiles: SecurityProfile[];
  original_text: string;
  position: number;
  is_disabled: boolean;
  description?: string;
}

export interface ConfigStats {
  rule_count: number;
  object_count: number;
  service_count: number;
  group_count: number;
  nat_count: number;
  route_count: number;
  time_range_count: number;
  warning_count: number;
}

export interface ConversionWarning {
  rule_id?: string;
  severity: string; // info, warning, error
  category: string;
  message: string;
  suggestion?: string;
}

export interface ComparisonItem {
  category: string;
  source: number;
  target: number;
  diff: number;
  details: string[];
}

// ============================================================================
// API Request Models
// ============================================================================

export interface MappingData {
  interface_mapping: Record<string, string>;
  zone_mapping: Record<string, string>;
}

export interface GeneratorOptions {
  // Fortinet options
  fortinet_ips?: string;
  fortinet_av?: string;
  fortinet_web?: string;
  fortinet_file?: string;
  fortinet_ssl?: string;
  fortinet_nat_mode?: string;

  // Palo Alto options
  pa_av_profile?: string;
  pa_as_profile?: string;
  pa_vp_profile?: string;
  pa_url_profile?: string;
  pa_wf_profile?: string;
  pa_fb_profile?: string;
  pa_log_profile?: string;
  pa_output_mode?: string;
  pa_device_group?: string;
  pa_template?: string;
}

export interface ConvertRequest {
  config_id: string;
  dest_vendor: Vendor;
  mapping: MappingData;
  generator_options?: GeneratorOptions;
  target_layout: TargetLayoutItem[];
  exclude_unused: boolean;
}

export interface TargetLayoutItem {
  name: string;
  members: string[];
}

// ============================================================================
// API Response Models
// ============================================================================

export interface VendorCapabilities {
  display_name: string;
  supports_zones: boolean;
  supports_interfaces: boolean;
  supports_aggregate_interfaces: boolean;
  generator_options_type: 'mixed' | 'string' | null;
  generator_options_fields: string[];
}

export interface AnalyzeConfigResponse {
  config_id: string;
  source_vendor: Vendor;
  interfaces: InterfaceInfo[];
  zones: string[];
  stats: ConfigStats;
  warnings: ConversionWarning[];
  raw_objects: AddressObject[];
  raw_services: ServiceObject[];
  raw_groups: GroupObject[];
  raw_service_groups: ServiceGroupObject[];
  raw_time_ranges: TimeRange[];
}

export interface ConversionResults {
  conversion_id: string;
  config_id: string;
  source_vendor: Vendor;
  dest_vendor: Vendor;
  status: ConversionStatus;
  script: string;
  stats: ConfigStats;
  comparison_table: ComparisonItem[];
  objects_table: ObjectsTableItem[];
  rules_table: RulesTableItem[];
  nat_rules_table: NATRulesTableItem[];
  routes_table: RoutesTableItem[];
  time_ranges_table: TimeRangeTableItem[];
  conversion_warnings: ConversionWarning[];
  created_at?: string;
}

export interface ObjectsTableItem {
  name: string;
  type: string;
  value: string;
  is_unused: boolean;
}

export interface RulesTableItem {
  id: number;
  name: string;
  source_interface: string;
  destination_interface: string;
  source: string;
  destination: string;
  service: string;
  application: string;
  action: string;
  profiles: string[];
  enabled: boolean;
}

export interface NATRulesTableItem {
  id: number;
  name: string;
  source_interface: string;
  destination_interface: string;
  original_source: string;
  translated_source: string;
  original_destination: string;
  translated_destination: string;
  original_service: string;
  translated_service: string;
  enabled: boolean;
}

export interface RoutesTableItem {
  destination: string;
  next_hop: string;
  interface: string;
  metric: string;
  type: string;
  distance: string;
  comment: string;
}

export interface TimeRangeTableItem {
  name: string;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string;
}

// ============================================================================
// API Client Types
// ============================================================================

export interface ApiError {
  error: string;
  detail?: string;
  status_code: number;
}

export interface AnalyzeFormData {
  source_vendor: Vendor;
  config_file?: File;
  checkpoint_objects?: File;
  checkpoint_policy?: File;
  checkpoint_nat?: File;
  checkpoint_config?: File;
  checkpoint_csv_zip?: File;
}

// ============================================================================
// Database Models (History & Saved Mappings)
// ============================================================================

export interface ConversionSession {
  id: string;
  source_vendor: string;
  dest_vendor: string;
  created_at: string;
  completed_at?: string;
  status: string;
  file_name: string;
  stats?: ConfigStats;
}

export interface SavedMapping {
  id: number;
  name: string;
  description?: string;
  source_vendor: string;
  dest_vendor: string;
  interface_mapping: Record<string, string>;
  zone_mapping: Record<string, string>;
  created_at: string;
  is_default: boolean;
}

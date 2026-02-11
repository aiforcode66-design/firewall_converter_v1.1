# -*- coding: utf-8 -*-
"""
Conversion service - handles conversion logic.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from models import FirewallConfig
from generators.checkpoint_generator import CheckpointGenerator
from generators.cisco_asa_generator import CiscoAsaGenerator
from generators.fortinet_generator import FortinetGenerator
from generators.palo_alto_generator import PaloAltoSetGenerator
from typing import Dict, List, Any, Optional
import json


class ConversionService:
    """Service for converting firewall configurations."""

    GENERATOR_MAP = {
        "cisco_asa": CiscoAsaGenerator,
        "checkpoint": CheckpointGenerator,
        "fortinet": FortinetGenerator,
        "palo_alto": PaloAltoSetGenerator,
    }

    @classmethod
    def convert_config(
        cls,
        source_config: FirewallConfig,
        dest_vendor: str,
        interface_mapping: Dict[str, str],
        zone_mapping: Dict[str, str],
        target_layout: List[Dict[str, Any]],
        generator_options: Optional[Dict[str, str]] = None,
        exclude_unused: bool = False,
        source_vendor: str = 'generic',
    ) -> tuple[str, Dict[str, Any]]:
        """
        Convert firewall configuration from source to destination format.

        Args:
            source_config: Parsed source configuration
            dest_vendor: Target vendor
            interface_mapping: Interface name mappings
            zone_mapping: Zone name mappings
            target_layout: Aggregate interface layout
            generator_options: Vendor-specific generator options
            exclude_unused: Whether to exclude unused objects

        Returns:
            Tuple of (generated_script, stats)
        """
        GeneratorClass = cls.GENERATOR_MAP.get(dest_vendor)
        if not GeneratorClass:
            raise ValueError(f"Destination vendor not supported: {dest_vendor}")

        # Prepare options for generator init
        gen_kwargs = generator_options.copy() if generator_options else {}
        nat_mode = gen_kwargs.pop('fortinet_nat_mode', 'policy')
        # Ensure nat_mode is not None (e.g. if explicitly passed as null/None)
        if not nat_mode:
            nat_mode = 'policy'

        # Prepare target layout format
        formatted_target_layout = []
        for item in target_layout:
            members = item.get("members", [])
            if isinstance(members, str):
                members = [m.strip() for m in members.split(",") if m.strip()]
            formatted_target_layout.append({
                "name": item.get("name", ""),
                "members": members,
            })

        if dest_vendor == 'fortinet':
            # Map API keys (fortinet_*) to generator attributes (*)
            # e.g. fortinet_ips -> ips
            gen_options_mapped = generator_options.copy() if generator_options else {}
            fortinet_keys = ['fortinet_ips', 'fortinet_av', 'fortinet_web', 'fortinet_file', 'fortinet_ssl']
            
            for key in fortinet_keys:
                if key in gen_options_mapped:
                    simple_key = key.replace('fortinet_', '')
                    gen_kwargs[simple_key] = gen_options_mapped[key]

            generator = GeneratorClass(
                source_config,
                nat_mode=nat_mode,
                interface_mapping=interface_mapping,
                zone_mapping=zone_mapping,
                target_layout=formatted_target_layout,
                generator_options=generator_options or {},
                exclude_unused=exclude_unused,
                source_vendor=source_vendor,
                **gen_kwargs
            )
        else:
            generator = GeneratorClass(
                source_config,
                interface_mapping=interface_mapping,
                zone_mapping=zone_mapping,
                target_layout=formatted_target_layout,
                generator_options=generator_options or {},
                exclude_unused=exclude_unused,
                source_vendor=source_vendor,
                **gen_kwargs
            )

        # Generate configuration
        script = generator.generate()

        # Calculate stats
        stats = {
            "rule_count": len(source_config.rules),
            "object_count": len(source_config.addresses) + len(source_config.address_groups),
            "service_count": len(source_config.services) + len(source_config.service_groups),
            "group_count": len(source_config.address_groups) + len(source_config.service_groups),
            "nat_count": len(source_config.nat_rules),
            "route_count": len(source_config.static_routes),
            "time_range_count": len(source_config.time_ranges),
            "warning_count": len(source_config.conversion_warnings),
            "unused_objects": 0,  # TODO: Calculate from generation
        }

        return script, stats

    @classmethod
    def build_comparison_table(
        cls,
        source_config: FirewallConfig,
        dest_vendor: str,
    ) -> List[Dict[str, Any]]:
        """Build before/after comparison table."""
        # This is a simplified version - can be expanded
        comparison = [
            {
                "category": "Rules",
                "source": len(source_config.rules),
                "target": len(source_config.rules),  # May change after conversion
                "diff": 0,
                "details": ["All rules processed"],
            },
            {
                "category": "Objects",
                "source": len(source_config.addresses) + len(source_config.address_groups),
                "target": len(source_config.addresses) + len(source_config.address_groups),
                "diff": 0,
                "details": ["All objects processed"],
            },
            {
                "category": "NAT Rules",
                "source": len(source_config.nat_rules),
                "target": len(source_config.nat_rules),
                "diff": 0,
                "details": ["NAT rules converted"],
            },
        ]
        return comparison

    @classmethod
    def build_objects_table(
        cls,
        source_config: FirewallConfig,
    ) -> List[Dict[str, Any]]:
        """Build objects table for display."""
        objects_table = []
        for obj in source_config.addresses:
            objects_table.append({
                "name": obj.name,
                "type": obj.type,
                "value1": obj.value1,
                "value2": obj.value2,
                "original_text": obj.original_text,
                # "is_unused": False, # Schema does not support this yet
            })
        return objects_table

    @classmethod
    def build_rules_table(
        cls,
        source_config: FirewallConfig,
    ) -> List[Dict[str, Any]]:
        """Build rules table for display."""
        rules_table = []
        for rule in source_config.rules:
            rules_table.append({
                "id": str(rule.sequence_id),
                "source_zones": list(rule.source_interface),
                "destination_zones": list(rule.destination_interface),
                "source_addresses": list(rule.source),
                "destination_addresses": list(rule.destination),
                "services": list(rule.service),
                "action": rule.action,
                "security_profiles": [], # TODO: Map profiles
                "is_disabled": not rule.enabled,
                "description": rule.name,
                "original_text": rule.original_text,
                "position": rule.sequence_id,
                # "logging": rule.log, # Add if supported by schema
            })
        return rules_table

    @classmethod
    def build_nat_rules_table(
        cls,
        source_config: FirewallConfig,
    ) -> List[Dict[str, Any]]:
        """Build NAT rules table for display."""
        nat_table = []
        for nat in source_config.nat_rules:
            nat_table.append({
                "id": str(nat.sequence_id),
                "original_source": ", ".join(nat.original_source or []),
                "translated_source": nat.translated_source or "",
                "original_destination": ", ".join(nat.original_destination or []),
                "translated_destination": nat.translated_destination or "",
                "original_service": ", ".join(nat.original_service or []),
                "translated_service": nat.translated_service or "",
                "original_text": nat.original_text,
            })
        return nat_table

    @classmethod
    def build_routes_table(
        cls,
        source_config: FirewallConfig,
    ) -> List[Dict[str, Any]]:
        """Build routes table for display."""
        routes_table = []
        for route in source_config.static_routes:
            routes_table.append({
                "destination": route.destination,
                "gateway": route.next_hop,
                "interface": route.interface or "",
                "original_text": route.comment or "",
            })
        return routes_table

    @classmethod
    def build_time_ranges_table(
        cls,
        source_config: FirewallConfig,
    ) -> List[Dict[str, Any]]:
        """Build time ranges table for display."""
        time_table = []
        for tr in source_config.time_ranges:
            time_table.append({
                "name": tr.name,
                "start_time": tr.start_time,
                "end_time": tr.end_time,
                "start_date": tr.start_date,
                "end_date": tr.end_date,
            })
        return time_table

    @classmethod
    def build_conversion_warnings(
        cls,
        source_config: FirewallConfig,
    ) -> List[Dict[str, Any]]:
        """Build conversion warnings list."""
        warnings = []
        for warning in source_config.conversion_warnings:
            warnings.append({
                "rule_id": warning.rule_id,
                "severity": warning.severity,
                "category": warning.category,
                "message": warning.message,
                "suggestion": warning.suggestion,
            })
        return warnings

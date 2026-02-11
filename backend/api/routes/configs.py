# -*- coding: utf-8 -*-
"""
Configuration analysis API routes.
"""
import sys
import os
import uuid
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from sqlalchemy.ext.asyncio import AsyncSession
from backend.api.models.schemas import (
    Vendor,
    AnalyzeConfigResponse,
    InterfaceInfo,
    ConfigStats,
    ConversionWarning,
    AddressObject,
    ServiceObject,
    GroupObject,
    ServiceGroupObject,
    TimeRange,
    ErrorResponse,
)
from backend.services.parser_service import ParserService
from backend.services.persistence_service import PersistenceService
from backend.api.models.database import get_db
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request, Depends

router = APIRouter(prefix="/api/v1/configs", tags=["configs"])


@router.post("/analyze", response_model=AnalyzeConfigResponse)
async def analyze_config(
    source_vendor: str = Form(...),
    config_file: Optional[UploadFile] = File(None),
    checkpoint_objects: Optional[UploadFile] = File(None),
    checkpoint_policy: Optional[UploadFile] = File(None),
    checkpoint_nat: Optional[UploadFile] = File(None),
    checkpoint_config: Optional[UploadFile] = File(None),
    checkpoint_csv_zip: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Analyze a firewall configuration and return interface/zone information.

    Supports vendors: cisco_asa, checkpoint, fortinet, palo_alto
    """
    try:
        # Validate source vendor
        try:
            vendor = Vendor(source_vendor)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid source vendor. Supported: {[v.value for v in Vendor]}"
            )

        # Build files dictionary
        files: Dict[str, Optional[UploadFile]] = {
            "config_file": config_file,
            "checkpoint_objects": checkpoint_objects,
            "checkpoint_policy": checkpoint_policy,
            "checkpoint_nat": checkpoint_nat,
            "checkpoint_config": checkpoint_config,
            "checkpoint_csv_zip": checkpoint_csv_zip,
        }

        # Parse configuration
        config_data = await ParserService.parse_config(source_vendor, files)

        # Save to database
        config_filename = config_file.filename if config_file else "unknown"
        if source_vendor == 'checkpoint' and checkpoint_policy:
             config_filename = checkpoint_policy.filename
        
        session_id = await PersistenceService.save_session(db, config_data, source_vendor, config_filename)

        # Extract interface details
        interfaces = [
            InterfaceInfo(
                name=iface.name,
                zone=iface.zone if iface.zone else "Unknown",
                ip_address=iface.ip_address,
                mask_length=iface.mask_length,
                description=iface.description,
                vlan_id=iface.vlan_id,
            )
            for iface in config_data.interfaces
        ]

        # Extract unique zones from Interfaces, Rules and NAT
        zones_set = {iface.zone for iface in config_data.interfaces if iface.zone}
        
        for rule in config_data.rules:
            if rule.source_interface: zones_set.update(rule.source_interface)
            if rule.destination_interface: zones_set.update(rule.destination_interface)

        for nat in config_data.nat_rules:
            if nat.source_interface: zones_set.update(nat.source_interface)
            if nat.destination_interface: zones_set.update(nat.destination_interface)
            
        # Clean up zones
        zones_set.discard(None)
        zones_set.discard("")
        zones_set.discard("any")
        zones = sorted(list(zones_set))

        # Build stats
        stats = ConfigStats(
            rule_count=len(config_data.rules),
            object_count=len(config_data.addresses) + len(config_data.address_groups),
            service_count=len(config_data.services) + len(config_data.service_groups),
            group_count=len(config_data.address_groups) + len(config_data.service_groups),
            nat_count=len(config_data.nat_rules),
            route_count=len(config_data.static_routes),
            time_range_count=len(config_data.time_ranges),
            warning_count=len(config_data.conversion_warnings),
        )

        # Convert warnings
        warnings = [
            ConversionWarning(
                rule_id=w.rule_id,
                severity=w.severity,
                category=w.category,
                message=w.message,
                suggestion=w.suggestion,
            )
            for w in config_data.conversion_warnings
        ]

        # Convert raw objects
        raw_objects = [
            AddressObject(
                name=obj.name,
                type=obj.type,
                value1=obj.value1,
                value2=obj.value2,
                original_text=obj.original_text,
            )
            for obj in config_data.addresses
        ]

        raw_services = [
            ServiceObject(
                name=obj.name,
                protocol=obj.protocol,
                port=obj.port,
                original_text=obj.original_text,
            )
            for obj in config_data.services
        ]

        raw_groups = [
            GroupObject(
                name=obj.name,
                members=set(obj.members),
                original_text=obj.original_text,
            )
            for obj in config_data.address_groups
        ]

        raw_service_groups = [
            ServiceGroupObject(
                name=obj.name,
                members=set(obj.members),
                original_text=obj.original_text,
            )
            for obj in config_data.service_groups
        ]

        raw_time_ranges = [
            TimeRange(
                name=obj.name,
                start_time=obj.start_time,
                start_date=obj.start_date,
                end_time=obj.end_time,
                end_date=obj.end_date,
                original_text=obj.original_text,
            )
            for obj in config_data.time_ranges
        ]

        return AnalyzeConfigResponse(
            config_id=session_id,
            source_vendor=vendor,
            interfaces=interfaces,
            zones=zones,
            stats=stats,
            warnings=warnings,
            raw_objects=raw_objects,
            raw_services=raw_services,
            raw_groups=raw_groups,
            raw_service_groups=raw_service_groups,
            raw_time_ranges=raw_time_ranges,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/vendors")
async def list_vendors():
    """List all supported firewall vendors."""
    return {
        "vendors": [
            {
                "id": v.value,
                "display_name": ParserService.get_vendor_capabilities()[v.value]["display_name"],
            }
            for v in Vendor
        ]
    }


@router.get("/vendors/{vendor_id}/capabilities")
async def get_vendor_capabilities(vendor_id: str):
    """Get capabilities for a specific vendor."""
    capabilities = ParserService.get_vendor_capabilities()
    if vendor_id not in capabilities:
        raise HTTPException(status_code=404, detail=f"Vendor {vendor_id} not found")
    return capabilities[vendor_id]

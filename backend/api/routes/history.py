# -*- coding: utf-8 -*-
"""
Conversion history API routes.
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from backend.api.models.database import get_db, ConversionRepository, ParsingSessionRepository
from backend.api.models.schemas import ConversionSessionResponse
from pydantic import BaseModel

class ParsingSessionResponse(BaseModel):
    id: str
    created_at: str
    source_vendor: str
    filename: str
    description: Optional[str] = None
    
    class Config:
        orm_mode = True

router = APIRouter(prefix="/api/v1/history", tags=["History"])


@router.get("", response_model=List[ConversionSessionResponse])
async def get_conversion_history(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all conversion sessions with pagination.

    Args:
        limit: Maximum number of records to return
        offset: Number of records to skip
        db: Database session

    Returns:
        List of conversion sessions
    """
    sessions = await ConversionRepository.get_all(db, limit=limit, offset=offset)
    return [session.to_response() for session in sessions]


@router.get("/{session_id}", response_model=ConversionSessionResponse)
async def get_conversion_session(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific conversion session by ID.

    Args:
        session_id: Unique session identifier
        db: Database session

    Returns:
        Conversion session details

    Raises:
        HTTPException 404: If session not found
    """
    session = await ConversionRepository.get_by_id(db, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversion session {session_id} not found"
        )
    return session.to_response()


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversion_session(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a conversion session by ID.

    Args:
        session_id: Unique session identifier
        db: Database session

    Raises:
        HTTPException 404: If session not found
    """
    deleted = await ConversionRepository.delete(db, session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversion session {session_id} not found"
        )
    return None


@router.get("/stats/summary")
async def get_conversion_stats(
    db: AsyncSession = Depends(get_db)
):
    """
    Get conversion statistics summary.

    Returns:
        Dictionary with total conversions, completed count, and breakdown by vendor
    """
    stats = await ConversionRepository.get_stats(db)
    return stats


@router.get("/uploads", response_model=List[ParsingSessionResponse])
async def get_upload_history(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all uploaded parsing sessions with pagination.
    """
    sessions = await ParsingSessionRepository.get_all(db, limit=limit, offset=offset)
    return [
        ParsingSessionResponse(
            id=session.id,
            created_at=str(session.created_at), # Ensure string format
            source_vendor=session.source_vendor or "unknown",
            filename=session.filename or "unknown",
            description=session.description
        )
        for session in sessions
    ]


# ============================================================================
# Session Rules Endpoint
# ============================================================================

class FirewallRuleResponse(BaseModel):
    id: str
    sequence_id: Optional[int] = None
    name: Optional[str] = None
    action: Optional[str] = None
    enabled: bool = True
    log: bool = False
    source_zone: List[str] = []
    destination_zone: List[str] = []
    source: List[str] = []
    destination: List[str] = []
    service: List[str] = []
    application: List[str] = []
    original_text: Optional[str] = None

    class Config:
        orm_mode = True


@router.get("/sessions/{session_id}/rules", response_model=List[FirewallRuleResponse])
async def get_session_rules(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all firewall rules for a specific parsing session.
    """
    from sqlalchemy import select
    from backend.api.models.database import FirewallRule
    
    result = await db.execute(
        select(FirewallRule)
        .where(FirewallRule.session_id == session_id)
        .order_by(FirewallRule.sequence_id)
    )
    rules = result.scalars().all()
    
    if not rules:
        return []
    
    return [
        FirewallRuleResponse(
            id=rule.id,
            sequence_id=rule.sequence_id,
            name=rule.name,
            action=rule.action,
            enabled=rule.enabled,
            log=rule.log,
            source_zone=rule.source_zone or [],
            destination_zone=rule.destination_zone or [],
            source=rule.source or [],
            destination=rule.destination or [],
            service=rule.service or [],
            application=rule.application or [],
            original_text=rule.original_text
        )
        for rule in rules
    ]


# ============================================================================
# Session Objects Endpoint
# ============================================================================

class NetworkObjectResponse(BaseModel):
    id: str
    name: Optional[str] = None
    type: Optional[str] = None  # host, network, range, group
    value1: Optional[str] = None
    value2: Optional[str] = None
    members: Optional[List[str]] = None
    original_text: Optional[str] = None

    class Config:
        orm_mode = True


@router.get("/sessions/{session_id}/objects", response_model=List[NetworkObjectResponse])
async def get_session_objects(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all network objects for a specific parsing session.
    """
    from sqlalchemy import select
    from backend.api.models.database import NetworkObject
    
    result = await db.execute(
        select(NetworkObject)
        .where(NetworkObject.session_id == session_id)
        .order_by(NetworkObject.name)
    )
    objects = result.scalars().all()
    
    if not objects:
        return []
    
    return [
        NetworkObjectResponse(
            id=obj.id,
            name=obj.name,
            type=obj.type,
            value1=obj.value1,
            value2=obj.value2,
            members=obj.members or [],
            original_text=obj.original_text
        )
        for obj in objects
    ]


# ============================================================================
# Session Services Endpoint
# ============================================================================

class ServiceObjectResponse(BaseModel):
    id: str
    name: Optional[str] = None
    protocol: Optional[str] = None
    port: Optional[str] = None
    members: Optional[List[str]] = None
    original_text: Optional[str] = None

    class Config:
        orm_mode = True


@router.get("/sessions/{session_id}/services", response_model=List[ServiceObjectResponse])
async def get_session_services(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all service objects for a specific parsing session.
    """
    from sqlalchemy import select
    from backend.api.models.database import ServiceObject
    
    result = await db.execute(
        select(ServiceObject)
        .where(ServiceObject.session_id == session_id)
        .order_by(ServiceObject.name)
    )
    services = result.scalars().all()
    
    if not services:
        return []
    
    return [
        ServiceObjectResponse(
            id=svc.id,
            name=svc.name,
            protocol=svc.protocol,
            port=svc.port,
            members=svc.members or [],
            original_text=svc.original_text
        )
        for svc in services
    ]


# ============================================================================
# Session NAT Rules Endpoint
# ============================================================================

class NatRuleResponse(BaseModel):
    id: str
    sequence_id: Optional[int] = None
    name: Optional[str] = None
    original_source: Optional[List[str]] = []
    translated_source: Optional[str] = None
    original_destination: Optional[List[str]] = []
    translated_destination: Optional[str] = None
    original_service: Optional[List[str]] = []
    translated_service: Optional[str] = None
    source_interface: Optional[List[str]] = []
    destination_interface: Optional[List[str]] = []
    original_text: Optional[str] = None

    class Config:
        orm_mode = True


@router.get("/sessions/{session_id}/nat", response_model=List[NatRuleResponse])
async def get_session_nat_rules(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all NAT rules for a specific parsing session.
    """
    from sqlalchemy import select
    from backend.api.models.database import NatRule
    
    result = await db.execute(
        select(NatRule)
        .where(NatRule.session_id == session_id)
        .order_by(NatRule.sequence_id)
    )
    nat_rules = result.scalars().all()
    
    if not nat_rules:
        return []
    
    return [
        NatRuleResponse(
            id=nat.id,
            sequence_id=nat.sequence_id,
            name=nat.name,
            original_source=nat.original_source or [],
            translated_source=nat.translated_source,
            original_destination=nat.original_destination or [],
            translated_destination=nat.translated_destination,
            original_service=nat.original_service or [],
            translated_service=nat.translated_service,
            source_interface=nat.source_interface or [],
            destination_interface=nat.destination_interface or [],
            original_text=nat.original_text
        )
        for nat in nat_rules
    ]


__all__ = ["router"]



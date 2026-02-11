# -*- coding: utf-8 -*-
"""
Saved mapping templates API routes.
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from backend.api.models.database import get_db, MappingRepository
from backend.api.models.schemas import (
    SavedMappingCreate,
    SavedMappingUpdate,
    SavedMappingResponse
)

router = APIRouter(prefix="/api/v1/mappings", tags=["Mappings"])


@router.get("", response_model=List[SavedMappingResponse])
async def get_saved_mappings(
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all saved mapping templates.

    Args:
        limit: Maximum number of records to return
        db: Database session

    Returns:
        List of saved mappings ordered by creation date (newest first)
    """
    mappings = await MappingRepository.get_all(db, limit=limit)
    return [mapping.to_response() for mapping in mappings]


@router.post("", response_model=SavedMappingResponse, status_code=status.HTTP_201_CREATED)
async def create_saved_mapping(
    mapping: SavedMappingCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new saved mapping template.

    Args:
        mapping: Mapping data to save
        db: Database session

    Returns:
        Created mapping with assigned ID
    """
    new_mapping = await MappingRepository.create(
        db,
        name=mapping.name,
        description=mapping.description,
        source_vendor=mapping.source_vendor,
        dest_vendor=mapping.dest_vendor,
        interface_mapping=mapping.interface_mapping,
        zone_mapping=mapping.zone_mapping,
        is_default=mapping.is_default
    )
    return new_mapping.to_response()


@router.get("/{mapping_id}", response_model=SavedMappingResponse)
async def get_saved_mapping(
    mapping_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific saved mapping by ID.

    Args:
        mapping_id: Mapping identifier
        db: Database session

    Returns:
        Saved mapping details

    Raises:
        HTTPException 404: If mapping not found
    """
    mapping = await MappingRepository.get_by_id(db, mapping_id)
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved mapping {mapping_id} not found"
        )
    return mapping.to_response()


@router.get("/vendors/{source_vendor}/{dest_vendor}", response_model=List[SavedMappingResponse])
async def get_mappings_by_vendors(
    source_vendor: str,
    dest_vendor: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get saved mappings filtered by source and destination vendors.

    Default mappings appear first in the list.

    Args:
        source_vendor: Source firewall vendor
        dest_vendor: Destination firewall vendor
        db: Database session

    Returns:
        List of matching mappings
    """
    mappings = await MappingRepository.get_by_vendors(db, source_vendor, dest_vendor)
    return [mapping.to_response() for mapping in mappings]


@router.put("/{mapping_id}", response_model=SavedMappingResponse)
async def update_saved_mapping(
    mapping_id: int,
    mapping_update: SavedMappingUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing saved mapping.

    Only provided fields will be updated. Null fields are ignored.

    Args:
        mapping_id: Mapping identifier
        mapping_update: Fields to update
        db: Database session

    Returns:
        Updated mapping

    Raises:
        HTTPException 404: If mapping not found
    """
    updated_mapping = await MappingRepository.update(
        db,
        mapping_id,
        name=mapping_update.name,
        description=mapping_update.description,
        interface_mapping=mapping_update.interface_mapping,
        zone_mapping=mapping_update.zone_mapping
    )

    if not updated_mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved mapping {mapping_id} not found"
        )

    return updated_mapping.to_response()


@router.delete("/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_mapping(
    mapping_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a saved mapping by ID.

    Args:
        mapping_id: Mapping identifier
        db: Database session

    Raises:
        HTTPException 404: If mapping not found
    """
    deleted = await MappingRepository.delete(db, mapping_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved mapping {mapping_id} not found"
        )
    return None


__all__ = ["router"]

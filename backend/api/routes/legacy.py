# -*- coding: utf-8 -*-
"""
Legacy API routes for backward compatibility with old frontend.
These routes maintain the old endpoint paths while routing to new services.
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Optional

from backend.api.routes.configs import analyze_config as new_analyze
from backend.api.routes.conversions import create_conversion as new_convert
from backend.api.routes.downloads import download_conversion as new_download
from backend.api.models.database import get_db

router = APIRouter(tags=["legacy"])


@router.post("/analyze")
async def analyze_legacy(
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
    Legacy analyze endpoint - redirects to new v1 API.
    Maintains compatibility with old frontend.
    """
    return await new_analyze(
        source_vendor=source_vendor,
        config_file=config_file,
        checkpoint_objects=checkpoint_objects,
        checkpoint_policy=checkpoint_policy,
        checkpoint_nat=checkpoint_nat,
        checkpoint_config=checkpoint_config,
        checkpoint_csv_zip=checkpoint_csv_zip,
        db=db,
    )


@router.post("/convert")
async def convert_legacy(
    source_vendor: str = Form(...),
    destination_vendor: str = Form(...),
    config_file: Optional[UploadFile] = File(None),
    checkpoint_objects: Optional[UploadFile] = File(None),
    checkpoint_policy: Optional[UploadFile] = File(None),
    checkpoint_nat: Optional[UploadFile] = File(None),
    checkpoint_config: Optional[UploadFile] = File(None),
    checkpoint_csv_zip: Optional[UploadFile] = File(None),
    interface_mapping_data: str = Form("{}"),
    target_layout_data: str = Form("[]"),
    target_ip_config: str = Form("{}"),
    exclude_unused: str = Form("off"),
    generator_options: str = Form("{}"),
    db: AsyncSession = Depends(get_db),
):
    """
    Legacy convert endpoint - redirects to new v1 API.
    Maintains compatibility with old frontend.
    """
    return await new_convert(
        source_vendor=source_vendor,
        destination_vendor=destination_vendor,
        config_file=config_file,
        checkpoint_objects=checkpoint_objects,
        checkpoint_policy=checkpoint_policy,
        checkpoint_nat=checkpoint_nat,
        checkpoint_config=checkpoint_config,
        checkpoint_csv_zip=checkpoint_csv_zip,
        interface_mapping_data=interface_mapping_data,
        target_layout_data=target_layout_data,
        target_ip_config=target_ip_config,
        exclude_unused=exclude_unused,
        generator_options=generator_options,
        db=db,
    )


@router.post("/download")
async def download_legacy(
    source_vendor: str = Form(...),
    destination_vendor: str = Form(...),
    format: str = Form("txt"),
    config_file: UploadFile = File(None),
    checkpoint_objects: UploadFile = File(None),
    checkpoint_policy: UploadFile = File(None),
    checkpoint_nat: UploadFile = File(None),
    checkpoint_config: UploadFile = File(None),
    interface_mapping_data: str = Form("{}"),
    target_layout_data: str = Form("[]"),
    exclude_unused: str = Form("off"),
    generator_options: str = Form("{}"),
):
    """
    Legacy download endpoint - redirects to new v1 API.
    Maintains compatibility with old frontend.
    """
    return await new_download(
        source_vendor=source_vendor,
        destination_vendor=destination_vendor,
        format=format,
        config_file=config_file,
        checkpoint_objects=checkpoint_objects,
        checkpoint_policy=checkpoint_policy,
        checkpoint_nat=checkpoint_nat,
        checkpoint_config=checkpoint_config,
        interface_mapping_data=interface_mapping_data,
        target_layout_data=target_layout_data,
        exclude_unused=exclude_unused,
        generator_options=generator_options,
    )


__all__ = ["router"]

# -*- coding: utf-8 -*-
"""
SQLAlchemy database models and session management.
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from sqlalchemy import Column, String, DateTime, JSON, Integer, Text, Boolean, create_engine, ForeignKey
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from typing import Optional, List, Dict, Any

from backend.core.config import settings

Base = declarative_base()


# ============================================================================
# Database Models
# ============================================================================

class ConversionSessionDB(Base):
    """Database model for conversion history."""
    __tablename__ = "conversion_sessions"

    id = Column(String, primary_key=True)
    source_vendor = Column(String, nullable=False)
    dest_vendor = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    config_hash = Column(String, nullable=True)
    stats = Column(JSON, nullable=True)
    status = Column(String, default="pending", nullable=False)
    file_name = Column(String, nullable=True)
    warnings = Column(JSON, nullable=True)

    def to_response(self):
        """Convert to response model."""
        from .schemas import ConfigStats, ConversionSessionResponse
        return ConversionSessionResponse(
            id=self.id,
            source_vendor=self.source_vendor,
            dest_vendor=self.dest_vendor,
            created_at=self.created_at.isoformat(),
            completed_at=self.completed_at.isoformat() if self.completed_at else None,
            status=self.status,
            file_name=self.file_name or "",
            stats=ConfigStats(**self.stats) if self.stats else None,
        )


class SavedMappingDB(Base):
    """Database model for saved mapping templates."""
    __tablename__ = "saved_mappings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    source_vendor = Column(String, nullable=False)
    dest_vendor = Column(String, nullable=False)
    interface_mapping = Column(JSON, nullable=False, default=lambda: {})
    zone_mapping = Column(JSON, nullable=False, default=lambda: {})
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)


    def to_response(self):
        """Convert to response model."""
        from .schemas import SavedMappingResponse
        return SavedMappingResponse(
            id=self.id,
            name=self.name,
            description=self.description,
            source_vendor=self.source_vendor,
            dest_vendor=self.dest_vendor,
            interface_mapping=self.interface_mapping,
            zone_mapping=self.zone_mapping,
            created_at=self.created_at.isoformat(),
            is_default=self.is_default,
        )


import uuid

def generate_uuid():
    return str(uuid.uuid4())

class ParsingSession(Base):
    __tablename__ = "parsing_sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    created_at = Column(String, server_default=func.now())
    source_vendor = Column(String)
    filename = Column(String)
    description = Column(String, nullable=True)

    # Relationships
    rules = relationship("FirewallRule", back_populates="session", cascade="all, delete-orphan")
    network_objects = relationship("NetworkObject", back_populates="session", cascade="all, delete-orphan")
    service_objects = relationship("ServiceObject", back_populates="session", cascade="all, delete-orphan")
    nat_rules = relationship("NatRule", back_populates="session", cascade="all, delete-orphan")

class NetworkObject(Base):
    __tablename__ = "network_objects"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("parsing_sessions.id"))
    
    name = Column(String)
    type = Column(String) # host, network, range, group
    value1 = Column(String, nullable=True)
    value2 = Column(String, nullable=True)
    members = Column(JSONB, nullable=True) # For groups
    original_text = Column(String, nullable=True)

    session = relationship("ParsingSession", back_populates="network_objects")

class ServiceObject(Base):
    __tablename__ = "service_objects"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("parsing_sessions.id"))

    name = Column(String)
    protocol = Column(String, nullable=True)
    port = Column(String, nullable=True)
    members = Column(JSONB, nullable=True) # For service groups
    original_text = Column(String, nullable=True)

    session = relationship("ParsingSession", back_populates="service_objects")

class FirewallRule(Base):
    __tablename__ = "firewall_rules"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("parsing_sessions.id"))

    sequence_id = Column(Integer)
    name = Column(String, nullable=True)
    action = Column(String) # allow, deny
    enabled = Column(Boolean, default=True)
    log = Column(Boolean, default=False)
    original_text = Column(String, nullable=True)

    # JSONB columns for lists
    source_zone = Column(JSONB, default=list)
    destination_zone = Column(JSONB, default=list)
    source = Column(JSONB, default=list)
    destination = Column(JSONB, default=list)
    service = Column(JSONB, default=list)
    application = Column(JSONB, default=list)
    
    session = relationship("ParsingSession", back_populates="rules")

class NatRule(Base):
    __tablename__ = "nat_rules"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("parsing_sessions.id"))

    sequence_id = Column(Integer)
    name = Column(String, nullable=True)
    original_text = Column(String, nullable=True)
    translated_source = Column(String, nullable=True)
    translated_destination = Column(String, nullable=True)
    translated_service = Column(String, nullable=True)

    # JSONB columns for lists
    original_source = Column(JSONB, default=list)
    original_destination = Column(JSONB, default=list)
    original_service = Column(JSONB, default=list)
    source_interface = Column(JSONB, default=list)
    destination_interface = Column(JSONB, default=list)

    session = relationship("ParsingSession", back_populates="nat_rules")


# ============================================================================
# Async Database Engine
# ============================================================================

engine = create_async_engine(
    settings.get_database_url(),
    echo=settings.DEBUG,
    future=True,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ============================================================================
# Database Functions
# ============================================================================

async def init_db():
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """Get database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ============================================================================
# Repository Classes
# ============================================================================

class ConversionRepository:
    """Repository for conversion session operations."""

    @staticmethod
    async def create(
        db: AsyncSession,
        id: str,
        source_vendor: str,
        dest_vendor: str,
        file_name: str,
        config_hash: Optional[str] = None,
    ) -> ConversionSessionDB:
        """Create a new conversion session."""
        session = ConversionSessionDB(
            id=id,
            source_vendor=source_vendor,
            dest_vendor=dest_vendor,
            file_name=file_name,
            config_hash=config_hash,
            status="pending",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    @staticmethod
    async def update_status(
        db: AsyncSession,
        id: str,
        status: str,
        stats: Optional[Dict[str, Any]] = None,
        warnings: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[ConversionSessionDB]:
        """Update conversion session status."""
        from sqlalchemy import select
        session_result = await db.execute(
            select(ConversionSessionDB).where(ConversionSessionDB.id == id)
        )
        session = session_result.scalar_one_or_none()
        if session:
            session.status = status
            session.completed_at = datetime.utcnow() if status == "completed" else None
            if stats:
                session.stats = stats
            if warnings:
                session.warnings = warnings
            await db.commit()
            await db.refresh(session)
        return session

    @staticmethod
    async def get_all(db: AsyncSession, limit: int = 50, offset: int = 0) -> List[ConversionSessionDB]:
        """Get all conversion sessions."""
        from sqlalchemy import select
        result = await db.execute(
            select(ConversionSessionDB)
            .order_by(ConversionSessionDB.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, id: str) -> Optional[ConversionSessionDB]:
        """Get conversion session by ID."""
        from sqlalchemy import select
        result = await db.execute(
            select(ConversionSessionDB).where(ConversionSessionDB.id == id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def delete(db: AsyncSession, id: str) -> bool:
        """Delete conversion session by ID."""
        from sqlalchemy import select, delete
        result = await db.execute(
            select(ConversionSessionDB).where(ConversionSessionDB.id == id)
        )
        session = result.scalar_one_or_none()
        if session:
            await db.execute(delete(ConversionSessionDB).where(ConversionSessionDB.id == id))
            await db.commit()
            return True
        return False

    @staticmethod
    async def get_stats(db: AsyncSession) -> Dict[str, Any]:
        """Get conversion statistics."""
        from sqlalchemy import select
        total = await db.execute(select(func.count(ConversionSessionDB.id)))
        completed = await db.execute(
            select(func.count(ConversionSessionDB.id))
            .where(ConversionSessionDB.status == "completed")
        )
        by_vendor = await db.execute(
            select(
                ConversionSessionDB.source_vendor,
                func.count(ConversionSessionDB.id).label('count')
            )
            .group_by(ConversionSessionDB.source_vendor)
        )
        return {
            "total": total.scalar(),
            "completed": completed.scalar(),
            "by_vendor": {row[0]: row[1] for row in by_vendor.all()},
        }


class MappingRepository:
    """Repository for saved mapping operations."""

    @staticmethod
    async def create(
        db: AsyncSession,
        name: str,
        description: Optional[str],
        source_vendor: str,
        dest_vendor: str,
        interface_mapping: Dict[str, str],
        zone_mapping: Dict[str, str],
        is_default: bool = False,
    ) -> SavedMappingDB:
        """Create a new saved mapping."""
        mapping = SavedMappingDB(
            name=name,
            description=description,
            source_vendor=source_vendor,
            dest_vendor=dest_vendor,
            interface_mapping=interface_mapping,
            zone_mapping=zone_mapping,
            is_default=is_default,
        )
        db.add(mapping)
        await db.commit()
        await db.refresh(mapping)
        return mapping

    @staticmethod
    async def get_all(db: AsyncSession, limit: int = 50) -> List[SavedMappingDB]:
        """Get all saved mappings."""
        from sqlalchemy import select
        result = await db.execute(
            select(SavedMappingDB)
            .order_by(SavedMappingDB.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, id: int) -> Optional[SavedMappingDB]:
        """Get saved mapping by ID."""
        from sqlalchemy import select
        result = await db.execute(
            select(SavedMappingDB).where(SavedMappingDB.id == id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_vendors(
        db: AsyncSession,
        source_vendor: str,
        dest_vendor: str,
    ) -> List[SavedMappingDB]:
        """Get saved mappings by source and destination vendors."""
        from sqlalchemy import select
        result = await db.execute(
            select(SavedMappingDB)
            .where(
                (SavedMappingDB.source_vendor == source_vendor) &
                (SavedMappingDB.dest_vendor == dest_vendor)
            )
            .order_by(SavedMappingDB.is_default.desc(), SavedMappingDB.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def update(
        db: AsyncSession,
        id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        interface_mapping: Optional[Dict[str, str]] = None,
        zone_mapping: Optional[Dict[str, str]] = None,
    ) -> Optional[SavedMappingDB]:
        """Update saved mapping."""
        from sqlalchemy import select
        result = await db.execute(
            select(SavedMappingDB).where(SavedMappingDB.id == id)
        )
        mapping = result.scalar_one_or_none()
        if mapping:
            if name is not None:
                mapping.name = name
            if description is not None:
                mapping.description = description
            if interface_mapping is not None:
                mapping.interface_mapping = interface_mapping
            if zone_mapping is not None:
                mapping.zone_mapping = zone_mapping
            await db.commit()
            await db.refresh(mapping)
        return mapping

    @staticmethod
    async def delete(db: AsyncSession, id: int) -> bool:
        """Delete saved mapping by ID."""
        from sqlalchemy import select, delete
        result = await db.execute(
            select(SavedMappingDB).where(SavedMappingDB.id == id)
        )
        mapping = result.scalar_one_or_none()
        if mapping:
            await db.execute(delete(SavedMappingDB).where(SavedMappingDB.id == id))
            await db.commit()
            return True
        return False


class ParsingSessionRepository:
    """Repository for parsing session operations."""

    @staticmethod
    async def get_all(db: AsyncSession, limit: int = 50, offset: int = 0) -> List[ParsingSession]:
        """Get all parsing sessions."""
        from sqlalchemy import select
        result = await db.execute(
            select(ParsingSession)
            .order_by(ParsingSession.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, id: str) -> Optional[ParsingSession]:
        """Get parsing session by ID."""
        from sqlalchemy import select
        result = await db.execute(
            select(ParsingSession).where(ParsingSession.id == id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def delete(db: AsyncSession, id: str) -> bool:
        """Delete parsing session by ID."""
        from sqlalchemy import select, delete
        result = await db.execute(
            select(ParsingSession).where(ParsingSession.id == id)
        )
        session = result.scalar_one_or_none()
        if session:
            await db.execute(delete(ParsingSession).where(ParsingSession.id == id))
            await db.commit()
            return True
        return False


__all__ = [
    "Base",
    "ConversionSessionDB",
    "SavedMappingDB",
    "engine",
    "async_session",
    "init_db",
    "get_db",
    "ConversionRepository",
    "MappingRepository",
    "ParsingSessionRepository",
]

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.api.models.database import ParsingSession, FirewallRule, NetworkObject, ServiceObject, NatRule
from models import FirewallConfig
import uuid
from typing import Dict, Any, List

class PersistenceService:
    """Service for persisting firewall configurations to the database."""

    @staticmethod
    async def save_session(db: AsyncSession, config: FirewallConfig, source_vendor: str, filename: str) -> str:
        """
        Save a parsed configuration to the database.
        
        Args:
            db: Database session
            config: Parsed FirewallConfig object
            source_vendor: Vendor of the source file
            filename: Name of the uploaded file
            
        Returns:
            session_id: The ID of the created session
        """
        # Create session
        session_id = str(uuid.uuid4())
        db_session = ParsingSession(
            id=session_id,
            source_vendor=source_vendor,
            filename=filename,
            description=f"Uploaded {source_vendor} config from {filename}"
        )
        db.add(db_session)
        
        # Save Network Objects (Addresses)
        for addr in config.addresses:
            db_obj = NetworkObject(
                session_id=session_id,
                name=addr.name,
                type=addr.type,
                value1=addr.value1,
                value2=addr.value2,
                original_text=addr.original_text
            )
            db.add(db_obj)
            
        # Save Network Objects (Groups)
        for group in config.address_groups:
            db_obj = NetworkObject(
                session_id=session_id,
                name=group.name,
                type="group",
                members=list(group.members),
                original_text=group.original_text
            )
            db.add(db_obj)

        # Save Service Objects
        for svc in config.services:
            db_obj = ServiceObject(
                session_id=session_id,
                name=svc.name,
                protocol=svc.protocol,
                port=svc.port,
                original_text=svc.original_text
            )
            db.add(db_obj)

        # Save Service Objects (Groups)
        for group in config.service_groups:
            db_obj = ServiceObject(
                session_id=session_id,
                name=group.name,
                members=list(group.members),
                original_text=group.original_text
            )
            db.add(db_obj)

        # Save Rules
        for rule in config.rules:
            db_rule = FirewallRule(
                session_id=session_id,
                sequence_id=rule.sequence_id,
                name=rule.name,
                action=rule.action,
                enabled=rule.enabled,
                log=rule.log,
                original_text=rule.original_text,
                source_zone=list(rule.source_interface),
                destination_zone=list(rule.destination_interface),
                source=list(rule.source),
                destination=list(rule.destination),
                service=list(rule.service),
                application=list(rule.application)
            )
            db.add(db_rule)

        # Save NAT Rules
        for nat in config.nat_rules:
            db_nat = NatRule(
                session_id=session_id,
                sequence_id=nat.sequence_id,
                name=nat.name,
                original_text=nat.original_text,
                translated_source=nat.translated_source,
                translated_destination=nat.translated_destination,
                translated_service=nat.translated_service,
                original_source=list(nat.original_source),
                original_destination=list(nat.original_destination),
                original_service=list(nat.original_service),
                source_interface=list(nat.source_interface),
                destination_interface=list(nat.destination_interface)
            )
            db.add(db_nat)

        await db.commit()
        await db.refresh(db_session)
        return session_id

    @staticmethod
    async def get_session(db: AsyncSession, session_id: str) -> ParsingSession:
        """Get a session by ID with all relationships eagerly loaded not strictly necessary if lazy loading works but usually good for async."""
        # For simplicity in this step, just returning the session object. 
        # In a real app we might want to return the full FirewallConfig object rebuilt from DB.
        result = await db.execute(select(ParsingSession).where(ParsingSession.id == session_id))
        return result.scalars().first()

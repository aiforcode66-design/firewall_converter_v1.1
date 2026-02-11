from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship, Mapped
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB

from .base import Base
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

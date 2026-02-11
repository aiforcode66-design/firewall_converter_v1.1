
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from backend.core.config import settings
from backend.db.base import Base
# Import models so they are registered with Base metadata
from backend.db.models import ParsingSession, FirewallRule, NetworkObject, ServiceObject, NatRule

engine = create_async_engine(settings.get_database_url(), echo=settings.DEBUG)

async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def init_db():
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    async with async_session() as session:
        yield session

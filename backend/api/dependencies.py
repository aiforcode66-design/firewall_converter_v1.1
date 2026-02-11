# -*- coding: utf-8 -*-
"""
Dependency injection for FastAPI routes.
"""
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import AsyncGenerator

from backend.api.models.database import init_db as db_init_db, async_session

# Security
security = HTTPBearer(auto_error=False)


async def init_db():
    """Initialize database tables."""
    await db_init_db()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str | None:
    """
    Get current authenticated user.
    For now, this is a placeholder for future authentication.
    """
    if credentials is None:
        return None
    # TODO: Validate token and return user
    return "user"

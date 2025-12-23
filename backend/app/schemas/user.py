"""
User Pydantic schemas
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Schema for user registration"""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=100)
    organization_domain: str = Field(..., min_length=1, max_length=255)


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user response"""
    user_id: UUID
    email: str
    name: str
    organization_id: UUID
    role: str
    created_at: datetime
    last_login: datetime | None = None

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    """Schema for token payload data"""
    user_id: UUID
    email: str
    organization_id: UUID
    role: str


# Password Reset Schemas

class PasswordResetRequest(BaseModel):
    """Schema for requesting a password reset email."""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Schema for confirming a password reset with new password."""
    token: str = Field(..., min_length=32, max_length=64)
    new_password: str = Field(..., min_length=8, max_length=100)


class PasswordResetResponse(BaseModel):
    """Schema for password reset response."""
    message: str
    # Note: We always return success to prevent email enumeration attacks

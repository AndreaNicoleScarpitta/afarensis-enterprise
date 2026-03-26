#!/usr/bin/env python3
"""
Create Admin User Script for Afarensis Enterprise

This script creates the initial administrative user for the system.
Run this after database initialization to bootstrap user access.

Usage:
    python scripts/create_admin.py --email admin@company.com --name "Admin User" --password secure_password
    python scripts/create_admin.py --interactive
"""

import sys
import os
import asyncio
import argparse
import getpass
from pathlib import Path

# Add the project root to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_async_session, engine
from app.core.security import get_password_hash
from app.models import User, UserRole
import uuid
from datetime import datetime


async def create_admin_user(email: str, full_name: str, password: str, organization: str = None):
    """Create an administrative user"""
    try:
        async with get_async_session() as db:
            # Check if user already exists
            from sqlalchemy import select
            result = await db.execute(select(User).where(User.email == email))
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                print(f"❌ User with email {email} already exists!")
                return False
            
            # Create new admin user
            hashed_password = get_password_hash(password)
            
            new_user = User(
                id=uuid.uuid4(),
                email=email,
                full_name=full_name,
                role=UserRole.ADMIN,
                hashed_password=hashed_password,
                is_active=True,
                organization=organization or "Afarensis Enterprise",
                department="Administration",
                expertise_areas=["regulatory_affairs", "system_administration"],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(new_user)
            await db.commit()
            
            print(f"✅ Successfully created admin user: {email}")
            print(f"   Name: {full_name}")
            print(f"   User ID: {new_user.id}")
            print(f"   Organization: {new_user.organization}")
            
            return True
            
    except Exception as e:
        print(f"❌ Failed to create admin user: {str(e)}")
        return False


async def check_database_connection():
    """Verify database connection and tables exist"""
    try:
        async with engine.begin() as conn:
            # Check if users table exists
            from sqlalchemy import text
            result = await conn.execute(
                text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')")
            )
            table_exists = result.scalar()
            
            if not table_exists:
                print("❌ Database tables not found. Please run database migrations first:")
                print("   alembic upgrade head")
                return False
                
            print("✅ Database connection successful")
            return True
            
    except Exception as e:
        print(f"❌ Database connection failed: {str(e)}")
        print("   Please check your database configuration and ensure PostgreSQL is running")
        return False


def get_interactive_input():
    """Get user input interactively"""
    print("\n🔧 Afarensis Enterprise Admin User Creation")
    print("=" * 50)
    
    email = input("Admin email address: ").strip()
    if not email or "@" not in email:
        print("❌ Please enter a valid email address")
        return None
    
    full_name = input("Full name: ").strip()
    if not full_name:
        print("❌ Please enter a full name")
        return None
        
    organization = input("Organization (optional): ").strip() or None
    
    print("\nPassword requirements:")
    print("- Minimum 8 characters")
    print("- Include uppercase, lowercase, numbers, and special characters")
    
    password = getpass.getpass("Admin password: ")
    if len(password) < 8:
        print("❌ Password must be at least 8 characters")
        return None
    
    password_confirm = getpass.getpass("Confirm password: ")
    if password != password_confirm:
        print("❌ Passwords do not match")
        return None
    
    return {
        "email": email,
        "full_name": full_name,
        "password": password,
        "organization": organization
    }


async def main():
    parser = argparse.ArgumentParser(description="Create Afarensis Enterprise admin user")
    parser.add_argument("--email", help="Admin email address")
    parser.add_argument("--name", help="Admin full name")
    parser.add_argument("--password", help="Admin password")
    parser.add_argument("--organization", help="Organization name")
    parser.add_argument("--interactive", action="store_true", help="Interactive mode")
    
    args = parser.parse_args()
    
    print("🚀 Afarensis Enterprise Admin Setup")
    print("=" * 40)
    
    # Check database connection first
    if not await check_database_connection():
        sys.exit(1)
    
    # Get user details
    if args.interactive or not all([args.email, args.name, args.password]):
        user_data = get_interactive_input()
        if not user_data:
            sys.exit(1)
    else:
        user_data = {
            "email": args.email,
            "full_name": args.name,
            "password": args.password,
            "organization": args.organization
        }
    
    # Create the admin user
    success = await create_admin_user(
        email=user_data["email"],
        full_name=user_data["full_name"],
        password=user_data["password"],
        organization=user_data.get("organization")
    )
    
    if success:
        print("\n🎉 Admin user created successfully!")
        print("\nNext steps:")
        print("1. Start the Afarensis Enterprise server")
        print("2. Login with the admin credentials")
        print("3. Configure system settings and create additional users")
        print("4. Import any initial data or projects")
    else:
        print("\n❌ Admin user creation failed")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

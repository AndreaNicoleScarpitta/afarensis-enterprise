#!/usr/bin/env python3
"""
Database Initialization Script for Afarensis Enterprise

This script initializes the database, runs migrations, and sets up initial data.

Usage:
    python scripts/init_database.py --fresh    # Drop and recreate all tables
    python scripts/init_database.py --migrate  # Run migrations only
    python scripts/init_database.py --seed     # Run migrations and seed data
"""

import sys
import os
import asyncio
import argparse
from pathlib import Path

# Add the project root to the path  
sys.path.insert(0, str(Path(__file__).parent.parent))

import subprocess
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import engine, Base, get_async_session
from app.core.config import settings
from app.models import *  # Import all models
import uuid
from datetime import datetime


async def check_database_exists():
    """Check if the database exists and is accessible"""
    try:
        async with engine.begin() as conn:
            await conn.execute("SELECT 1")
        print("✅ Database connection successful")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {str(e)}")
        return False


async def drop_all_tables():
    """Drop all existing tables (WARNING: This will delete all data!)"""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        print("✅ All tables dropped successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to drop tables: {str(e)}")
        return False


async def create_all_tables():
    """Create all tables using SQLAlchemy metadata"""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ All tables created successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to create tables: {str(e)}")
        return False


def run_alembic_migrations():
    """Run Alembic database migrations"""
    try:
        # Change to backend directory for alembic
        backend_dir = Path(__file__).parent.parent / "backend"
        os.chdir(backend_dir)
        
        print("🔄 Running Alembic migrations...")
        
        # Initialize Alembic if needed
        try:
            subprocess.run(["alembic", "current"], check=True, capture_output=True)
        except subprocess.CalledProcessError:
            print("🔧 Initializing Alembic...")
            subprocess.run(["alembic", "stamp", "head"], check=True)
        
        # Run migrations
        result = subprocess.run(
            ["alembic", "upgrade", "head"], 
            check=True, 
            capture_output=True, 
            text=True
        )
        
        print("✅ Database migrations completed successfully")
        if result.stdout:
            print(f"   Migration output: {result.stdout.strip()}")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Migration failed: {str(e)}")
        if e.stderr:
            print(f"   Error details: {e.stderr}")
        return False
    except Exception as e:
        print(f"❌ Migration error: {str(e)}")
        return False


async def seed_initial_data():
    """Seed the database with initial data"""
    try:
        async with get_async_session() as db:
            # Check if data already exists
            from sqlalchemy import select, func
            
            user_count = await db.scalar(select(func.count(User.id)))
            if user_count > 0:
                print("⚠️  Database already contains user data - skipping seeding")
                return True
            
            print("🌱 Seeding initial data...")
            
            # Create sample data
            initial_data = []
            
            # Create federated nodes
            federated_nodes = [
                FederatedNode(
                    id=uuid.uuid4(),
                    node_id="afarensis_central",
                    institution_name="Afarensis Central Hub",
                    endpoint_url="https://central.afarensis.ai/federated",
                    status="active",
                    available_data_types=["evidence_patterns", "bias_patterns"],
                    supported_queries=["comparability_analysis", "bias_detection"],
                    trust_score=1.0,
                    joined_at=datetime.utcnow(),
                    last_active=datetime.utcnow()
                )
            ]
            initial_data.extend(federated_nodes)
            
            # Create constraint patterns
            constraint_patterns = [
                ConstraintPattern(
                    id=uuid.uuid4(),
                    pattern_name="Selection Bias Detection",
                    pattern_type="bias_rule",
                    pattern_logic={
                        "rule": "check_randomization_method",
                        "parameters": {"acceptable_methods": ["computer_generated", "central_allocation"]},
                        "severity_threshold": 0.7
                    },
                    applicability_conditions={"study_type": "rct"},
                    severity_weight=0.8,
                    usage_count=0,
                    contributed_by_node="afarensis_central",
                    validated_by_nodes=["afarensis_central"],
                    created_at=datetime.utcnow()
                ),
                ConstraintPattern(
                    id=uuid.uuid4(),
                    pattern_name="Endpoint Comparability Rule",
                    pattern_type="comparability_rule",
                    pattern_logic={
                        "rule": "check_endpoint_alignment",
                        "parameters": {"minimum_overlap": 0.8},
                        "severity_threshold": 0.6
                    },
                    applicability_conditions={"analysis_type": "comparability"},
                    severity_weight=0.9,
                    usage_count=0,
                    contributed_by_node="afarensis_central",
                    validated_by_nodes=["afarensis_central"],
                    created_at=datetime.utcnow()
                )
            ]
            initial_data.extend(constraint_patterns)
            
            # Create evidence patterns
            evidence_patterns = [
                EvidencePattern(
                    id=uuid.uuid4(),
                    pattern_name="Oncology Efficacy Pattern",
                    indication_category="oncology",
                    evidence_structure={
                        "primary_evidence": ["phase3_rct", "phase2_dose_finding"],
                        "supportive_evidence": ["real_world_data", "biomarker_analysis"],
                        "required_endpoints": ["overall_survival", "progression_free_survival"]
                    },
                    regulatory_outcome="approved",
                    regulatory_agency="FDA",
                    approval_likelihood=0.75,
                    precedent_strength=0.85,
                    key_success_factors=[
                        "Strong Phase 3 efficacy signal",
                        "Acceptable safety profile", 
                        "Biomarker-driven patient selection"
                    ],
                    critical_evidence_types=["rct", "biomarker_data"],
                    common_pitfalls=["inadequate_safety_follow_up", "biomarker_validation_gaps"],
                    usage_count=0,
                    validation_score=0.9,
                    created_at=datetime.utcnow(),
                    source_submission_year=2023
                )
            ]
            initial_data.extend(evidence_patterns)
            
            # Add all initial data
            for item in initial_data:
                db.add(item)
            
            await db.commit()
            
            print(f"✅ Successfully seeded {len(initial_data)} initial records")
            print(f"   - {len(federated_nodes)} federated nodes")
            print(f"   - {len(constraint_patterns)} constraint patterns")
            print(f"   - {len(evidence_patterns)} evidence patterns")
            
            return True
            
    except Exception as e:
        print(f"❌ Failed to seed initial data: {str(e)}")
        return False


async def verify_installation():
    """Verify that the database is properly set up"""
    try:
        async with get_async_session() as db:
            from sqlalchemy import select, func, text
            
            # Check table existence
            tables_to_check = [
                'users', 'projects', 'evidence_records', 'comparability_scores',
                'bias_analyses', 'evidence_critiques', 'review_decisions',
                'regulatory_artifacts', 'federated_nodes', 'constraint_patterns',
                'evidence_patterns', 'audit_logs', 'session_tokens', 'parsed_specifications'
            ]
            
            print("🔍 Verifying database installation...")
            
            for table in tables_to_check:
                try:
                    result = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = result.scalar()
                    print(f"   ✅ {table}: {count} records")
                except Exception as e:
                    print(f"   ❌ {table}: Error - {str(e)}")
                    return False
            
            print("✅ Database verification successful")
            return True
            
    except Exception as e:
        print(f"❌ Database verification failed: {str(e)}")
        return False


async def main():
    parser = argparse.ArgumentParser(description="Initialize Afarensis Enterprise database")
    parser.add_argument("--fresh", action="store_true", help="Drop and recreate all tables (WARNING: Deletes all data)")
    parser.add_argument("--migrate", action="store_true", help="Run migrations only")
    parser.add_argument("--seed", action="store_true", help="Run migrations and seed initial data")
    parser.add_argument("--verify", action="store_true", help="Verify database installation")
    
    args = parser.parse_args()
    
    print("🗄️  Afarensis Enterprise Database Initialization")
    print("=" * 50)
    
    # Check database connection first
    if not await check_database_exists():
        print("\n💡 Troubleshooting tips:")
        print("   1. Ensure PostgreSQL is running")
        print("   2. Check DATABASE_URL in your .env file")
        print("   3. Verify database credentials and permissions")
        sys.exit(1)
    
    success = True
    
    if args.fresh:
        print("\n⚠️  WARNING: Fresh install will DELETE ALL EXISTING DATA!")
        confirm = input("Type 'YES' to confirm: ")
        if confirm != "YES":
            print("❌ Operation cancelled")
            sys.exit(1)
            
        success &= await drop_all_tables()
        success &= await create_all_tables()
        success &= await seed_initial_data()
        
    elif args.migrate or args.seed or not any([args.fresh, args.verify]):
        success &= run_alembic_migrations()
        
        if args.seed or not any([args.migrate, args.verify]):
            success &= await seed_initial_data()
    
    if args.verify or not any([args.fresh, args.migrate, args.seed]):
        success &= await verify_installation()
    
    if success:
        print("\n🎉 Database initialization completed successfully!")
        print("\nNext steps:")
        print("1. Create an admin user: python scripts/create_admin.py --interactive")
        print("2. Start the application server")
        print("3. Access the web interface and complete setup")
    else:
        print("\n❌ Database initialization failed")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

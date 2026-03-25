"""Pytest fixtures for Afarensis Enterprise tests"""
import pytest
import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, AsyncEngine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from httpx import AsyncClient, ASGITransport
import uuid
from datetime import datetime

from app.main import app
from app.core.database import get_db
from app.models import Base, User, UserRole, Project, ProjectStatus, EvidenceRecord, EvidenceSourceType
from app.core.security import get_password_hash, create_access_token, Roles

TEST_DATABASE_URL = "sqlite+aiosqlite://"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine() -> AsyncEngine:
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(test_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    async_session = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session
        # Clean up all data after each test (reverse dependency order)
        for table in [
            "user_presence", "notification_settings", "citation_relationships",
            "review_comments", "review_assignments", "workflow_steps",
            "evidence_embeddings", "saved_searches", "session_tokens",
            "audit_logs", "regulatory_artifacts", "evidence_critiques",
            "review_decisions", "bias_analyses", "comparability_scores",
            "evidence_records", "parsed_specifications", "evidence_patterns",
            "constraint_patterns", "federated_nodes", "projects", "users",
        ]:
            try:
                await session.execute(text(f"DELETE FROM {table}"))
            except Exception:
                pass
        await session.commit()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def make_token(user_id: str, email: str, full_name: str, role: str) -> str:
    """Generate a JWT for test fixtures without hitting the login endpoint."""
    role_permissions = {
        "admin": Roles.ADMIN["permissions"],
        "reviewer": Roles.REVIEWER["permissions"],
        "analyst": Roles.ANALYST["permissions"],
        "viewer": Roles.VIEWER["permissions"],
    }.get(role.lower(), [])
    return create_access_token({
        "sub": user_id,
        "email": email,
        "username": full_name,
        "role": role,
        "permissions": role_permissions,
    })


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    user = User(
        id=str(uuid.uuid4()),
        email="test@example.com",
        full_name="Test User",
        role=UserRole.REVIEWER,
        hashed_password=get_password_hash("Test@12345"),
        is_active=True,
        organization="Test Organization",
        department="Testing",
        expertise_areas=["regulatory_affairs"],
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = User(
        id=str(uuid.uuid4()),
        email="admin@example.com",
        full_name="Admin User",
        role=UserRole.ADMIN,
        hashed_password=get_password_hash("Admin@12345"),
        is_active=True,
        organization="Test Organization",
        department="Administration",
        expertise_areas=["system_administration"],
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_project(db_session: AsyncSession, test_user: User) -> Project:
    project = Project(
        id=str(uuid.uuid4()),
        title="Test Regulatory Project",
        description="A test project for regulatory evidence review",
        status=ProjectStatus.DRAFT,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        created_by=test_user.id,
        research_intent="Test the efficacy of novel therapeutic approach",
        max_pubmed_results=50,
        max_trials_results=50,
        processing_config={"test": True},
    )
    db_session.add(project)
    await db_session.commit()
    await db_session.refresh(project)
    return project


@pytest.fixture
async def test_evidence(db_session: AsyncSession, test_project: Project) -> EvidenceRecord:
    evidence = EvidenceRecord(
        id=str(uuid.uuid4()),
        project_id=test_project.id,
        source_type=EvidenceSourceType.PUBMED,
        source_id="PMID_12345678",
        source_url="https://pubmed.ncbi.nlm.nih.gov/12345678/",
        title="Test Clinical Study: Efficacy and Safety Analysis",
        abstract="This is a test abstract for clinical study evidence.",
        authors=["Smith, J.", "Doe, A."],
        journal="Journal of Test Medicine",
        publication_year=2023,
        structured_data={"study_type": "rct", "sample_size": 500},
        extraction_confidence=0.95,
        discovered_at=datetime.utcnow(),
    )
    db_session.add(evidence)
    await db_session.commit()
    await db_session.refresh(evidence)
    return evidence


@pytest.fixture
async def authenticated_client(client: AsyncClient, test_user: User) -> AsyncClient:
    token = make_token(
        str(test_user.id),
        test_user.email,
        test_user.full_name,
        test_user.role.value if hasattr(test_user.role, "value") else str(test_user.role),
    )
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture
async def admin_client(client: AsyncClient, admin_user: User) -> AsyncClient:
    token = make_token(
        str(admin_user.id),
        admin_user.email,
        admin_user.full_name,
        admin_user.role.value if hasattr(admin_user.role, "value") else str(admin_user.role),
    )
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


class TestDataFactory:
    @staticmethod
    def create_project_data(**kwargs):
        data = {
            "title": "Factory Test Project",
            "description": "A test project",
            "research_intent": "Test research intent",
        }
        data.update(kwargs)
        return data

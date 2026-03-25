"""Unit tests for database models and enums."""
import pytest
from app.models import (
    UserRole, ProjectStatus, EvidenceSourceType, BiasType, ReviewDecisionEnum,
)


class TestUserRoleEnum:
    def test_has_four_members(self):
        assert len(UserRole) == 4

    def test_values(self):
        assert UserRole.ADMIN.value == "admin"
        assert UserRole.REVIEWER.value == "reviewer"
        assert UserRole.ANALYST.value == "analyst"
        assert UserRole.VIEWER.value == "viewer"


class TestProjectStatusEnum:
    def test_has_five_members(self):
        assert len(ProjectStatus) == 5

    def test_values(self):
        names = {s.name for s in ProjectStatus}
        assert "DRAFT" in names
        assert "COMPLETED" in names


class TestEvidenceSourceTypeEnum:
    def test_has_members(self):
        assert len(EvidenceSourceType) >= 3

    def test_pubmed_exists(self):
        assert hasattr(EvidenceSourceType, "PUBMED")


class TestBiasTypeEnum:
    def test_has_members(self):
        assert len(BiasType) >= 3


class TestReviewDecisionEnum:
    def test_has_members(self):
        assert len(ReviewDecisionEnum) >= 3
        assert hasattr(ReviewDecisionEnum, "ACCEPTED")

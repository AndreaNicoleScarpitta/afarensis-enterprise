"""Unit tests for model enums defined in app.models."""
import pytest

from app.models import (
    ProjectStatus,
    EvidenceSourceType,
    ReviewDecisionEnum,
    BiasType,
    UserRole,
)


# ---------------------------------------------------------------------------
# ProjectStatus
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestProjectStatus:

    def test_has_five_members(self):
        assert len(ProjectStatus) == 5

    def test_member_names(self):
        names = {m.name for m in ProjectStatus}
        assert names == {"DRAFT", "PROCESSING", "REVIEW", "COMPLETED", "ARCHIVED"}

    def test_values_are_lowercase(self):
        for member in ProjectStatus:
            assert member.value == member.value.lower()

    def test_specific_values(self):
        assert ProjectStatus.DRAFT.value == "draft"
        assert ProjectStatus.PROCESSING.value == "processing"
        assert ProjectStatus.REVIEW.value == "review"
        assert ProjectStatus.COMPLETED.value == "completed"
        assert ProjectStatus.ARCHIVED.value == "archived"

    def test_lookup_by_value(self):
        assert ProjectStatus("draft") is ProjectStatus.DRAFT


# ---------------------------------------------------------------------------
# EvidenceSourceType
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestEvidenceSourceType:

    def test_has_five_members(self):
        assert len(EvidenceSourceType) == 5

    def test_member_names(self):
        names = {m.name for m in EvidenceSourceType}
        assert names == {
            "PUBMED",
            "CLINICALTRIALS",
            "UPLOADED_DOCUMENT",
            "INSTITUTIONAL_DATA",
            "FEDERATED_SOURCE",
        }

    def test_specific_values(self):
        assert EvidenceSourceType.PUBMED.value == "pubmed"
        assert EvidenceSourceType.CLINICALTRIALS.value == "clinicaltrials"
        assert EvidenceSourceType.UPLOADED_DOCUMENT.value == "uploaded_document"
        assert EvidenceSourceType.INSTITUTIONAL_DATA.value == "institutional_data"
        assert EvidenceSourceType.FEDERATED_SOURCE.value == "federated_source"

    def test_values_are_lowercase(self):
        for member in EvidenceSourceType:
            assert member.value == member.value.lower()


# ---------------------------------------------------------------------------
# ReviewDecisionEnum
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestReviewDecisionEnum:

    def test_has_four_members(self):
        assert len(ReviewDecisionEnum) == 4

    def test_member_names(self):
        names = {m.name for m in ReviewDecisionEnum}
        assert names == {"ACCEPTED", "REJECTED", "DEFERRED", "PENDING"}

    def test_specific_values(self):
        assert ReviewDecisionEnum.ACCEPTED.value == "accepted"
        assert ReviewDecisionEnum.REJECTED.value == "rejected"
        assert ReviewDecisionEnum.DEFERRED.value == "deferred"
        assert ReviewDecisionEnum.PENDING.value == "pending"

    def test_lookup_by_value(self):
        assert ReviewDecisionEnum("accepted") is ReviewDecisionEnum.ACCEPTED


# ---------------------------------------------------------------------------
# BiasType
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestBiasType:

    def test_has_five_members(self):
        assert len(BiasType) == 5

    def test_member_names(self):
        names = {m.name for m in BiasType}
        assert names == {
            "SELECTION_BIAS",
            "CONFOUNDING",
            "MEASUREMENT_BIAS",
            "TEMPORAL_BIAS",
            "PUBLICATION_BIAS",
        }

    def test_specific_values(self):
        assert BiasType.SELECTION_BIAS.value == "selection_bias"
        assert BiasType.CONFOUNDING.value == "confounding"
        assert BiasType.MEASUREMENT_BIAS.value == "measurement_bias"
        assert BiasType.TEMPORAL_BIAS.value == "temporal_bias"
        assert BiasType.PUBLICATION_BIAS.value == "publication_bias"

    def test_values_are_lowercase(self):
        for member in BiasType:
            assert member.value == member.value.lower()


# ---------------------------------------------------------------------------
# UserRole
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestUserRole:

    def test_has_four_members(self):
        assert len(UserRole) == 4

    def test_member_names(self):
        names = {m.name for m in UserRole}
        assert names == {"ADMIN", "REVIEWER", "ANALYST", "VIEWER"}

    def test_specific_values(self):
        assert UserRole.ADMIN.value == "admin"
        assert UserRole.REVIEWER.value == "reviewer"
        assert UserRole.ANALYST.value == "analyst"
        assert UserRole.VIEWER.value == "viewer"

    def test_lookup_by_value(self):
        assert UserRole("admin") is UserRole.ADMIN
        assert UserRole("viewer") is UserRole.VIEWER

    def test_values_are_lowercase(self):
        for member in UserRole:
            assert member.value == member.value.lower()

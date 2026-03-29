"""
Afarensis Enterprise Database Models

Comprehensive models implementing the 12-layer capability model:
1. Research Specification Layer
2. Evidence Discovery Layer
3. Evidence Extraction Layer
4. Anchor Candidate Generation Layer
5. Anchor Comparability Engine
6. Bias & Fragility Analysis Layer
7. Anchor Evaluation & Ranking Layer
8. Evidence Critique Layer
9. Reviewer Decision Layer
10. Regulatory Artifact Generation
11. Federated Evidence Network
12. Evidence Operating System
"""

from sqlalchemy import (
    Column, String, Integer, DateTime, Text, Boolean, JSON,
    ForeignKey, Float, Enum, Index, UniqueConstraint, func
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum as PyEnum
import uuid


Base = declarative_base()


# Enums
class ProjectStatus(PyEnum):
    DRAFT = "draft"
    PROCESSING = "processing"
    REVIEW = "review"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class EvidenceSourceType(PyEnum):
    PUBMED = "pubmed"
    CLINICALTRIALS = "clinicaltrials"
    UPLOADED_DOCUMENT = "uploaded_document"
    INSTITUTIONAL_DATA = "institutional_data"
    FEDERATED_SOURCE = "federated_source"


class ReviewDecisionEnum(PyEnum):
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    DEFERRED = "deferred"
    PENDING = "pending"


class BiasType(PyEnum):
    SELECTION_BIAS = "selection_bias"
    CONFOUNDING = "confounding"
    MEASUREMENT_BIAS = "measurement_bias"
    TEMPORAL_BIAS = "temporal_bias"
    PUBLICATION_BIAS = "publication_bias"


class UserRole(PyEnum):
    ADMIN = "admin"
    REVIEWER = "reviewer"
    ANALYST = "analyst"
    VIEWER = "viewer"


# MULTI-TENANCY: Organization / Tenant Model

class Organization(Base):
    """Organization / tenant for multi-tenancy isolation."""
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), unique=True, nullable=False)
    slug = Column(String(100), unique=True, nullable=False)  # URL-safe short name
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="org")
    projects = relationship("Project", back_populates="org")


# 1. RESEARCH SPECIFICATION LAYER MODELS

class Project(Base):
    """Central project entity managing the complete review workflow"""
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(500), nullable=False)
    description = Column(Text)
    status = Column(String(20), default="draft")

    # Multi-tenancy
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))

    # Research specification
    research_intent = Column(Text, nullable=False, default="")
    source_filename = Column(String(255))
    source_text = Column(Text)

    # Processing configuration
    max_pubmed_results = Column(Integer, default=50)
    max_trials_results = Column(Integer, default=50)
    processing_config = Column(JSON)

    # Optimistic locking — prevents lost-update on concurrent processing_config writes.
    # Every update must SET config_version = config_version + 1 WHERE config_version = <expected>.
    config_version = Column(Integer, default=0, nullable=False, server_default="0")

    # Relationships
    org = relationship("Organization", back_populates="projects")
    parsed_specifications = relationship("ParsedSpecification", back_populates="project")
    evidence_records = relationship("EvidenceRecord", back_populates="project")
    review_decisions = relationship("ReviewDecision", back_populates="project")
    audit_logs = relationship("AuditLog", back_populates="project")

    # Indexes
    __table_args__ = (
        Index("idx_projects_status", "status"),
        Index("idx_projects_created_at", "created_at"),
        Index("idx_projects_created_by", "created_by"),
        Index("idx_projects_organization", "organization_id"),
    )


class ParsedSpecification(Base):
    """Structured representation of research protocol/SAP"""
    __tablename__ = "parsed_specifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    # Protocol details
    indication = Column(String(255))
    population_definition = Column(Text)
    primary_endpoint = Column(Text)
    secondary_endpoints = Column(JSON)
    inclusion_criteria = Column(JSON)
    exclusion_criteria = Column(JSON)
    follow_up_period = Column(String(100))

    # Statistical details
    sample_size = Column(Integer)
    statistical_plan = Column(Text)
    covariates = Column(JSON)

    # Assumptions identified
    assumptions = Column(JSON)
    clarifications = Column(JSON)

    # Processing metadata
    parsed_at = Column(DateTime, default=datetime.utcnow)
    parsing_model = Column(String(100))
    confidence_score = Column(Float)

    # Relationships
    project = relationship("Project", back_populates="parsed_specifications")


# 2-3. EVIDENCE DISCOVERY & EXTRACTION LAYER MODELS

class EvidenceRecord(Base):
    """Individual evidence record from any source"""
    __tablename__ = "evidence_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    # Source information
    source_type = Column(String(50))
    source_id = Column(String(255))  # PMID, NCT number, etc.
    source_url = Column(String(1000))

    # Content
    title = Column(String(1000))
    abstract = Column(Text)
    full_text = Column(Text)
    authors = Column(JSON)
    journal = Column(String(255))
    publication_year = Column(Integer)

    # Structured extraction
    structured_data = Column(JSON)
    extraction_model = Column(String(100))
    extraction_confidence = Column(Float)

    # Discovery metadata
    discovered_at = Column(DateTime, default=datetime.utcnow)
    query_used = Column(Text)
    retrieval_rank = Column(Integer)

    # Relationships
    project = relationship("Project", back_populates="evidence_records")
    comparability_scores = relationship("ComparabilityScore", back_populates="evidence_record")
    review_decisions = relationship("ReviewDecision", back_populates="evidence_record")

    # Indexes
    __table_args__ = (
        Index("idx_evidence_records_project", "project_id"),
        Index("idx_evidence_records_source", "source_type", "source_id"),
        UniqueConstraint("project_id", "source_type", "source_id", name="uq_evidence_project_source"),
    )


# 4-5. ANCHOR CANDIDATE GENERATION & COMPARABILITY ENGINE

class ComparabilityScore(Base):
    """Multi-dimensional comparability assessment"""
    __tablename__ = "comparability_scores"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    evidence_record_id = Column(String(36), ForeignKey("evidence_records.id", ondelete="CASCADE"), nullable=False)

    # Core scoring dimensions
    population_similarity = Column(Float)
    endpoint_alignment = Column(Float)
    covariate_coverage = Column(Float)
    temporal_alignment = Column(Float)
    evidence_quality = Column(Float)
    provenance_score = Column(Float)

    # Composite scores
    overall_score = Column(Float)
    regulatory_viability = Column(Float)

    # Detailed analysis
    dimension_details = Column(JSON)
    scoring_rationale = Column(Text)

    # Processing metadata
    scored_at = Column(DateTime, default=datetime.utcnow)
    scoring_model = Column(String(100))
    scoring_version = Column(String(50))

    # Relationships
    evidence_record = relationship("EvidenceRecord", back_populates="comparability_scores")
    bias_analyses = relationship("BiasAnalysis", back_populates="comparability_score")


# 6. BIAS & FRAGILITY ANALYSIS LAYER

class BiasAnalysis(Base):
    """Bias detection and fragility assessment"""
    __tablename__ = "bias_analyses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    comparability_score_id = Column(String(36), ForeignKey("comparability_scores.id", ondelete="CASCADE"), nullable=False)

    # Bias detection
    bias_type = Column(String(50))
    bias_severity = Column(Float)  # 0-1 scale
    bias_description = Column(Text)

    # Fragility analysis
    fragility_score = Column(Float)
    sensitivity_flags = Column(JSON)
    regulatory_risk = Column(Float)

    # Mitigation recommendations
    mitigation_strategies = Column(JSON)
    adjustment_recommendations = Column(Text)

    # Analysis metadata
    analyzed_at = Column(DateTime, default=datetime.utcnow)
    analysis_model = Column(String(100))

    # Relationships
    comparability_score = relationship("ComparabilityScore", back_populates="bias_analyses")


# 8. EVIDENCE CRITIQUE LAYER

class EvidenceCritique(Base):
    """AI-generated regulatory critique"""
    __tablename__ = "evidence_critiques"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    # Critique content
    overall_assessment = Column(Text)
    strengths = Column(JSON)
    weaknesses = Column(JSON)
    regulatory_concerns = Column(JSON)

    # Recommendations
    recommendations = Column(JSON)
    alternative_approaches = Column(Text)
    additional_evidence_needed = Column(JSON)

    # FDA-specific analysis
    fda_acceptance_likelihood = Column(Float)
    regulatory_precedents = Column(JSON)

    # Generation metadata
    generated_at = Column(DateTime, default=datetime.utcnow)
    critique_model = Column(String(100))
    reviewer_persona = Column(String(100))  # "fda_statistical_reviewer", etc.


# 9. REVIEWER DECISION LAYER

class User(Base):
    """System users with role-based access"""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)

    # Multi-tenancy
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)

    # Authentication
    hashed_password = Column(String(255))
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    last_login = Column(DateTime)

    # Profile
    organization = Column(String(255))
    department = Column(String(255))
    expertise_areas = Column(JSON)

    # Audit
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    org = relationship("Organization", back_populates="users")

    # Indexes
    __table_args__ = (
        Index("idx_users_email", "email"),
        Index("idx_users_role", "role"),
        Index("idx_users_organization", "organization_id"),
    )


class ReviewDecision(Base):
    """Human reviewer decisions on evidence"""
    __tablename__ = "review_decisions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    evidence_record_id = Column(String(36), ForeignKey("evidence_records.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Decision details
    decision = Column(String(20), nullable=False)
    confidence_level = Column(Float)  # 0-1 scale
    rationale = Column(Text)
    notes = Column(Text)

    # Review context
    review_criteria = Column(JSON)
    alternative_considerations = Column(Text)

    # Timing
    decided_at = Column(DateTime, default=datetime.utcnow)
    review_duration_seconds = Column(Integer)

    # Relationships
    project = relationship("Project", back_populates="review_decisions")
    evidence_record = relationship("EvidenceRecord", back_populates="review_decisions")
    reviewer = relationship("User")

    # Constraints
    __table_args__ = (
        UniqueConstraint("project_id", "evidence_record_id", "reviewer_id", name="uq_review_decision"),
        Index("idx_review_decisions_project", "project_id"),
        Index("idx_review_decisions_reviewer", "reviewer_id"),
    )


# 10. REGULATORY ARTIFACT GENERATION

class RegulatoryArtifact(Base):
    """Generated regulatory documents and reports"""
    __tablename__ = "regulatory_artifacts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    # Artifact details
    artifact_type = Column(String(100))  # "fda_reviewer_packet", "ema_report", etc.
    title = Column(String(500))
    format = Column(String(50))  # "html", "pdf", "json", "docx"

    # Content
    content = Column(Text)  # JSON or HTML content
    template_version = Column(String(50))

    # File storage
    file_path = Column(String(1000))
    file_size = Column(Integer)
    checksum = Column(String(64))

    # Generation metadata
    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    generation_model = Column(String(100))

    # Regulatory context
    regulatory_agency = Column(String(100))
    submission_context = Column(Text)

    # Indexes
    __table_args__ = (
        Index("idx_regulatory_artifacts_project", "project_id"),
        Index("idx_regulatory_artifacts_type", "artifact_type"),
    )


# 11-12. FEDERATED EVIDENCE NETWORK & EVIDENCE OPERATING SYSTEM

class FederatedNode(Base):
    """Federated network participant nodes"""
    __tablename__ = "federated_nodes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id = Column(String(100), unique=True, nullable=False)
    institution_name = Column(String(255), nullable=False)

    # Connection details
    endpoint_url = Column(String(1000))
    public_key = Column(Text)
    status = Column(String(50))  # "active", "inactive", "pending"

    # Capabilities
    available_data_types = Column(JSON)
    supported_queries = Column(JSON)

    # Trust & security
    trust_score = Column(Float, default=0.5)
    last_verified = Column(DateTime)

    # Metadata
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_active = Column(DateTime)


class ConstraintPattern(Base):
    """Shared constraint library for the evidence operating system"""
    __tablename__ = "constraint_patterns"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pattern_name = Column(String(255), nullable=False)
    pattern_type = Column(String(100))  # "bias_rule", "comparability_rule", etc.

    # Pattern definition
    pattern_logic = Column(JSON)
    applicability_conditions = Column(JSON)
    severity_weight = Column(Float)

    # Usage statistics
    usage_count = Column(Integer, default=0)
    success_rate = Column(Float)

    # Provenance
    contributed_by_node = Column(String(100))
    validated_by_nodes = Column(JSON)

    # Lifecycle
    created_at = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EvidencePattern(Base):
    """Successful evidence structures for pattern library"""
    __tablename__ = "evidence_patterns"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pattern_name = Column(String(255), nullable=False)

    # Pattern characteristics
    indication_category = Column(String(100))
    evidence_structure = Column(JSON)
    regulatory_outcome = Column(String(100))  # "approved", "rejected", etc.

    # Success metrics
    regulatory_agency = Column(String(100))
    approval_likelihood = Column(Float)
    precedent_strength = Column(Float)

    # Pattern details
    key_success_factors = Column(JSON)
    critical_evidence_types = Column(JSON)
    common_pitfalls = Column(JSON)

    # Usage and validation
    usage_count = Column(Integer, default=0)
    validation_score = Column(Float)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    source_submission_year = Column(Integer)


# AUDIT & COMPLIANCE

class AuditLog(Base):
    """Comprehensive audit trail for regulatory compliance"""
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Action details
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100))
    resource_id = Column(String(36))

    # Request context
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    request_id = Column(String(36))

    # Data changes
    old_values = Column(JSON)
    new_values = Column(JSON)
    change_summary = Column(Text)

    # Timing
    timestamp = Column(DateTime, default=datetime.utcnow)
    duration_ms = Column(Integer)

    # Compliance
    regulatory_significance = Column(Boolean, default=False)
    retention_period_years = Column(Integer, default=7)

    # Relationships
    project = relationship("Project", back_populates="audit_logs")

    # Indexes for performance and compliance queries
    __table_args__ = (
        Index("idx_audit_logs_timestamp", "timestamp"),
        Index("idx_audit_logs_user", "user_id"),
        Index("idx_audit_logs_project", "project_id"),
        Index("idx_audit_logs_action", "action"),
        Index("idx_audit_logs_regulatory", "regulatory_significance"),
    )


# Cache and session management
class SessionToken(Base):
    """User session / reset-token management.

    token_type values:
      - "access"  : (reserved, not currently stored)
      - "refresh" : refresh-token JTI hash for rotation detection
      - "reset"   : password-reset flow token
    """
    __tablename__ = "session_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    token_type = Column(String(50))  # "access", "refresh", "reset"

    # Expiration
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    last_used = Column(DateTime)

    # Security
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    is_revoked = Column(Boolean, default=False)

    # Password-reset verification code hash (SHA-256).
    # Only populated for token_type="reset". Stored separately from user_agent
    # so the column semantics are clean.
    code_hash = Column(String(255), nullable=True)

    # Relationships
    user = relationship("User")

    # Indexes
    __table_args__ = (
        Index("idx_session_tokens_user", "user_id"),
        Index("idx_session_tokens_expires", "expires_at"),
        Index("idx_session_tokens_hash", "token_hash"),
    )


class PasswordResetToken(Base):
    """DB-backed password reset tokens for the forgot-password flow."""
    __tablename__ = "password_reset_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), nullable=False, index=True)
    code_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    reset_token_hash = Column(String(255), nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailVerificationToken(Base):
    """Token for email verification during self-registration."""
    __tablename__ = "email_verification_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================================
# NEW MODELS FOR ADVANCED SEARCH AND COLLABORATIVE REVIEW
# ============================================================================

class SavedSearch(Base):
    __tablename__ = 'saved_searches'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    query = Column(Text, nullable=False)
    search_type = Column(String(50))  # semantic, keyword, hybrid
    filters = Column(JSON)
    alert_frequency = Column(String(50))  # daily, weekly, monthly
    created_at = Column(DateTime, default=func.now())
    last_run = Column(DateTime)
    is_active = Column(Boolean, default=True)

    # Relationships
    user = relationship("User", back_populates="saved_searches")


class EvidenceEmbedding(Base):
    __tablename__ = 'evidence_embeddings'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    evidence_id = Column(String(36), ForeignKey('evidence_records.id', ondelete="CASCADE"), nullable=False)
    embedding_vector = Column(JSON)  # Store embeddings as JSON array (SQLite-compatible)
    embedding_model = Column(String(100))  # Model used to generate embeddings
    text_source = Column(String(50))  # title, abstract, full_text
    created_at = Column(DateTime, default=func.now())

    # Relationships
    evidence = relationship("EvidenceRecord")


class ReviewAssignment(Base):
    __tablename__ = 'review_assignments'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    evidence_id = Column(String(36), ForeignKey('evidence_records.id', ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(String(36), ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    assigned_by = Column(String(36), ForeignKey('users.id', ondelete="SET NULL"))
    role = Column(String(50))  # reviewer, senior_reviewer, approver
    status = Column(String(50))  # pending, in_progress, completed
    assigned_at = Column(DateTime, default=func.now())
    due_date = Column(DateTime)
    completed_at = Column(DateTime)
    weight = Column(Float, default=1.0)  # Voting weight
    workflow_id = Column(String(36))

    # Relationships
    evidence = relationship("EvidenceRecord")
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    assigner = relationship("User", foreign_keys=[assigned_by])


class ReviewComment(Base):
    __tablename__ = 'review_comments'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    evidence_id = Column(String(36), ForeignKey('evidence_records.id', ondelete="CASCADE"), nullable=False)
    author_id = Column(String(36), ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    parent_comment_id = Column(String(36), ForeignKey('review_comments.id', ondelete="SET NULL"))
    content = Column(Text, nullable=False)
    comment_type = Column(String(50))  # general, bias_concern, methodology, etc.
    mentions = Column(JSON)  # User IDs mentioned in comment (stored as JSON array)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    resolved_at = Column(DateTime)
    resolved_by = Column(String(36), ForeignKey('users.id', ondelete="SET NULL"))

    # Relationships
    evidence = relationship("EvidenceRecord")
    author = relationship("User", foreign_keys=[author_id])
    parent_comment = relationship("ReviewComment", remote_side=[id])
    resolver = relationship("User", foreign_keys=[resolved_by])


class WorkflowStep(Base):
    __tablename__ = 'workflow_steps'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id = Column(String(36))
    step_type = Column(String(50))  # initial_review, peer_review, senior_review, etc.
    step_order = Column(Integer)
    required_reviewers = Column(Integer)
    duration_hours = Column(Integer)
    status = Column(String(50))  # pending, active, completed
    started_at = Column(DateTime)
    completed_at = Column(DateTime)


class UserPresence(Base):
    __tablename__ = 'user_presence'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    resource_type = Column(String(50))  # evidence, project, comment
    resource_id = Column(String(36))
    activity = Column(String(100))  # viewing, editing, commenting
    last_seen = Column(DateTime, default=func.now())
    cursor_position = Column(JSON)  # For real-time cursor tracking

    # Relationships
    user = relationship("User")


class NotificationSettings(Base):
    __tablename__ = 'notification_settings'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    notification_type = Column(String(100))  # assignment, mention, deadline, etc.
    email_enabled = Column(Boolean, default=True)
    push_enabled = Column(Boolean, default=True)
    frequency = Column(String(50))  # immediate, daily, weekly

    # Relationships
    user = relationship("User")


class CitationRelationship(Base):
    __tablename__ = 'citation_relationships'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    citing_evidence_id = Column(String(36), ForeignKey('evidence_records.id', ondelete="CASCADE"), nullable=False)
    cited_evidence_id = Column(String(36), ForeignKey('evidence_records.id', ondelete="CASCADE"), nullable=False)
    citation_context = Column(Text)  # Context where citation appears
    relationship_type = Column(String(50))  # direct, indirect, co_citation
    confidence_score = Column(Float)
    detected_at = Column(DateTime, default=func.now())

    # Relationships
    citing_evidence = relationship("EvidenceRecord", foreign_keys=[citing_evidence_id])
    cited_evidence = relationship("EvidenceRecord", foreign_keys=[cited_evidence_id])


# ============================================================================
# CDISC ADaM ANALYSIS DATASETS
# ============================================================================

class AdamDataset(Base):
    """CDISC ADaM Analysis Dataset specification and data storage."""
    __tablename__ = "adam_datasets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    dataset_name = Column(String(50), nullable=False)     # ADSL, ADAE, ADTTE, ADLB
    dataset_label = Column(String(200))                    # "Subject-Level Analysis Dataset"
    structure = Column(String(100))                        # "One record per subject"
    variables = Column(JSON)                               # Array of variable specs
    records_count = Column(Integer, default=0)
    data_content = Column(JSON)                            # Actual dataset rows
    validation_status = Column(String(50), default="pending")  # pending, valid, invalid
    validation_report = Column(JSON)                       # Validation results
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project")

    # Indexes
    __table_args__ = (
        Index("idx_adam_datasets_project", "project_id"),
        Index("idx_adam_datasets_name", "dataset_name"),
    )


class ConsentLog(Base):
    """HIPAA consent attestation log for patient-level data uploads."""
    __tablename__ = "consent_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    protocol_id = Column(String(100))
    consent_version = Column(String(50), default="HIPAA-SH-v1.2")
    timestamp_utc = Column(DateTime, nullable=False, default=datetime.utcnow)
    ip_address = Column(String(50))
    session_token = Column(String(255))
    attestation_hash = Column(String(64), nullable=False)  # SHA-256
    attestation_text = Column(Text)
    status = Column(String(20), default="confirmed")  # confirmed, revoked
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    project = relationship("Project")

    __table_args__ = (
        Index("idx_consent_logs_project", "project_id"),
        Index("idx_consent_logs_user", "user_id"),
    )


class IngestionReport(Base):
    """Regulatory compliance report for uploaded patient-level data."""
    __tablename__ = "ingestion_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    consent_log_id = Column(String(36), ForeignKey("consent_logs.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False)  # SHA-256
    file_size_bytes = Column(Integer)
    upload_timestamp = Column(DateTime, default=datetime.utcnow)
    uploader_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Compliance status: CLEARED, BLOCKED, CLEARED_WITH_WARNINGS
    compliance_status = Column(String(30), nullable=False)

    # Dataset summary
    total_rows = Column(Integer)
    n_by_arm = Column(JSON)  # {"TRT": 150, "EC": 300}
    columns_detected = Column(JSON)  # ["USUBJID", "ARM", ...]
    key_variables_present = Column(JSON)  # {"USUBJID": true, "ARM": true, ...}
    missingness_summary = Column(JSON)

    # Findings
    findings = Column(JSON)  # Array of finding objects
    critical_count = Column(Integer, default=0)
    major_count = Column(Integer, default=0)
    warning_count = Column(Integer, default=0)

    # User acknowledgment (for CLEARED_WITH_WARNINGS)
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String(36))
    acknowledged_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    consent_log = relationship("ConsentLog")
    uploader = relationship("User", foreign_keys=[uploader_id])

    __table_args__ = (
        Index("idx_ingestion_reports_project", "project_id"),
    )


class PatientDataset(Base):
    """Uploaded patient-level dataset (encrypted at rest)."""
    __tablename__ = "patient_datasets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    ingestion_report_id = Column(String(36), ForeignKey("ingestion_reports.id", ondelete="CASCADE"), nullable=False)
    dataset_name = Column(String(255))
    source_type = Column(String(20))  # csv, xpt, xlsx, sas7bdat
    records_count = Column(Integer)
    columns = Column(JSON)
    data_content = Column(JSON)  # The actual rows (encrypted in production)
    row_hashes = Column(JSON)  # SHA-256 hash of each row for audit
    status = Column(String(20), default="active")  # active, quarantined, purged
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    ingestion_report = relationship("IngestionReport")

    __table_args__ = (
        Index("idx_patient_datasets_project", "project_id"),
        # Only one active dataset per project — prevents duplicate uploads
        Index(
            "uq_one_active_dataset_per_project",
            "project_id",
            unique=True,
            postgresql_where=Column("status") == "active",
            sqlite_where=Column("status") == "active",
        ),
    )


class ComparabilityProtocol(Base):
    """Prespecified comparability protocol — locked before outcome analysis."""
    __tablename__ = "comparability_protocols"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, default=1, nullable=False)

    # Trial population criteria
    trial_population_criteria = Column(JSON, nullable=True)  # inclusion/exclusion criteria

    # External control source specification
    external_source_description = Column(Text, nullable=True)
    external_source_type = Column(String(100), nullable=True)  # e.g., "registry", "ehr", "natural_history"

    # Covariates for adjustment
    covariates = Column(JSON, nullable=True)  # [{name, role, type, threshold}]

    # Statistical methodology
    adjustment_method = Column(String(100), nullable=True)  # "iptw", "ps_matching", "overlap_weighting"
    primary_estimand = Column(String(50), nullable=True)  # "ATT", "ATE"

    # Feasibility thresholds
    feasibility_thresholds = Column(JSON, nullable=True)  # {min_n_per_arm, max_smd, min_overlap, min_events}

    # Lock state
    is_locked = Column(Boolean, default=False, nullable=False)
    locked_at = Column(DateTime, nullable=True)
    locked_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    protocol_hash = Column(String(64), nullable=True)  # SHA-256 of locked content

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    project = relationship("Project", backref="comparability_protocols")


class ReferencePopulation(Base):
    """Validated reference population for cross-study comparison."""
    __tablename__ = "reference_populations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    disease_area = Column(String(255), nullable=True, index=True)
    source_type = Column(String(100), nullable=True)  # registry, ehr, natural_history, trial

    # Population characteristics
    n_subjects = Column(Integer, nullable=True)
    demographics_summary = Column(JSON, nullable=True)  # {mean_age, pct_female, race_dist, ...}
    outcome_types = Column(JSON, nullable=True)  # ["OS", "PFS", "ORR"]
    covariate_profile = Column(JSON, nullable=True)  # [{name, mean, sd, type}]
    inclusion_criteria = Column(JSON, nullable=True)

    # Provenance
    created_from_project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)

    # Validation
    validated = Column(Boolean, default=False)
    validated_at = Column(DateTime, nullable=True)
    validation_hash = Column(String(64), nullable=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class ProjectRetentionLog(Base):
    """Data retention decision log for project archival."""
    __tablename__ = "project_retention_log"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    decision = Column(String(10), nullable=False)  # PERSIST or PURGE
    timestamp_utc = Column(DateTime, default=datetime.utcnow)
    purge_scope = Column(JSON)  # What was purged
    purge_certificate_hash = Column(String(64))  # SHA-256 of purge event
    confirmed = Column(Boolean, default=False)
    confirmation_text = Column(Text)

    project = relationship("Project")
    user = relationship("User")


# ============================================================================
# BLOCKING-FIX 3: Persisted Validation Records
# ============================================================================

class ValidationRecord(Base):
    """Persisted pre-analysis validation verdict.

    Every dataset validation run is recorded here.  The analyze-dataset
    endpoint MUST reference a PASS verdict before executing models.
    """
    __tablename__ = "validation_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(String(36), ForeignKey("patient_datasets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Verdict
    verdict = Column(String(20), nullable=False)  # PASS, BLOCKED
    block_reasons = Column(JSON)                   # list[str] if BLOCKED
    phase_results = Column(JSON)                   # full 6-phase breakdown

    # Data fingerprint
    dataset_row_count = Column(Integer)
    dataset_hash = Column(String(64))              # SHA-256 of data_content

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("Project")
    dataset = relationship("PatientDataset")

    __table_args__ = (
        Index("idx_validation_records_project", "project_id"),
        Index("idx_validation_records_dataset", "dataset_id"),
        Index("idx_validation_records_verdict", "verdict"),
    )


# ============================================================================
# BLOCKING-FIX 5: Analysis Result Storage with Reproducibility Metadata
# ============================================================================

class AnalysisResult(Base):
    """Immutable analysis result record with full reproducibility metadata.

    Stores the link between: dataset → validation → analysis output
    so every result can be traced to its validated input.
    """
    __tablename__ = "analysis_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(String(36), ForeignKey("patient_datasets.id", ondelete="CASCADE"), nullable=False)
    validation_record_id = Column(String(36), ForeignKey("validation_records.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Input fingerprint
    dataset_hash = Column(String(64), nullable=False)          # SHA-256 of data_content
    column_mapping = Column(JSON)                               # exact mapping used
    dataset_row_count = Column(Integer)

    # Computation metadata
    random_seed = Column(Integer)
    software_version = Column(String(100))                     # e.g. "afarensis-2.1"
    engine_versions = Column(JSON)                             # scipy, numpy, etc.
    convergence_info = Column(JSON)                            # Newton-Raphson iters, status

    # Results (full output)
    results = Column(JSON, nullable=False)                     # complete analysis output

    # Timing
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow)
    duration_ms = Column(Integer)

    # Relationships
    project = relationship("Project")
    dataset = relationship("PatientDataset")
    validation_record = relationship("ValidationRecord")

    __table_args__ = (
        Index("idx_analysis_results_project", "project_id"),
        Index("idx_analysis_results_dataset", "dataset_id"),
        Index("idx_analysis_results_validation", "validation_record_id"),
        # One analysis result per (dataset hash + validation record) — prevents
        # duplicate results from retried requests on the same validated input.
        UniqueConstraint(
            "dataset_id", "dataset_hash", "validation_record_id",
            name="uq_analysis_per_validated_dataset",
        ),
    )


# ============================================================================
# STUDY DAG MODELS
# ============================================================================

class DAGNode(Base):
    """Individual step in a study-specific analysis workflow"""
    __tablename__ = "dag_nodes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    key = Column(String(100), nullable=False)  # e.g., "primary_analysis_mmse"
    label = Column(String(255), nullable=False)  # e.g., "Primary: MMSE Change from Baseline (ANCOVA)"
    category = Column(String(50), nullable=False)  # data_ingestion, population, primary, secondary, sensitivity, subgroup, safety, output
    description = Column(Text)
    status = Column(String(20), default="pending")  # pending, in_progress, completed, blocked
    order_index = Column(Integer, default=0)
    config = Column(JSON)  # analysis-specific config (endpoint, method, population, etc.)
    page_route = Column(String(255))  # frontend route this node links to
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("Project", backref="dag_nodes")

    __table_args__ = (
        Index("idx_dag_nodes_project", "project_id"),
        UniqueConstraint("project_id", "key", name="uq_dag_node_project_key"),
    )


class DAGEdge(Base):
    """Dependency edge between DAG nodes"""
    __tablename__ = "dag_edges"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    from_node_key = Column(String(100), nullable=False)
    to_node_key = Column(String(100), nullable=False)
    edge_type = Column(String(20), default="dependency")  # dependency, optional, conditional

    project_rel = relationship("Project", backref="dag_edges")

    __table_args__ = (
        Index("idx_dag_edges_project", "project_id"),
    )


# ============================================================================
# BACKGROUND TASK PERSISTENCE (Fix 9 — survive process restarts)
# ============================================================================

class BackgroundTask(Base):
    """Persisted task metadata — mirrors in-memory TaskResult to the DB.

    This table allows:
    * Task status queries to survive process restarts.
    * Orphaned-task detection on startup (tasks stuck in ``running``).
    * Historical audit of long-running operations.
    * Checkpoint data for multi-phase tasks (Fix 10).
    """
    __tablename__ = "background_tasks"

    id = Column(String(36), primary_key=True)  # = task_id from TaskResult
    task_type = Column(String(100), nullable=False, index=True)
    state = Column(String(20), nullable=False, default="pending", index=True)
    progress = Column(Float, default=0.0)
    message = Column(Text, default="Queued")
    error = Column(Text, nullable=True)
    error_traceback = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Fix 10: Checkpoint data — JSON dict of {phase_name: {completed_at, data}}
    checkpoints = Column(JSON, default=dict)
    current_phase = Column(String(100), nullable=True)

    __table_args__ = (
        Index("idx_bg_tasks_type_state", "task_type", "state"),
        Index("idx_bg_tasks_created", "created_at"),
    )


# ============================================================================
# EXECUTION EVENT STREAM (Causal DAG — first-class audit trail)
# ============================================================================

class ExecutionEventType(PyEnum):
    DATA_PREPARATION = "data_preparation"
    TRANSFORMATION = "transformation"
    MODEL_FIT = "model_fit"
    DIAGNOSTIC = "diagnostic"
    ARTIFACT_GENERATION = "artifact_generation"
    WARNING = "warning"
    ERROR = "error"


class ExecutionEventStatus(PyEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    WARNING = "warning"
    FAILED = "failed"


class ExecutionEvent(Base):
    """
    Unified execution event stream — every analysis step, transformation,
    diagnostic check, and artifact generation is logged here.

    Events are grouped by run_id (one analysis execution = one run).
    Each event optionally references a causal DAG node, linking the
    execution trace back to the scientific model.
    """
    __tablename__ = "execution_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    run_id = Column(String(36), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Event classification
    event_type = Column(String(30), nullable=False)
    step_name = Column(String(200), nullable=False)
    step_index = Column(Integer, nullable=True)
    total_steps = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False)

    # Human-readable summary
    summary = Column(Text, nullable=False)

    # Structured details (JSON dict of arbitrary metadata)
    details = Column(JSON, default=dict)

    # I/O tracking
    inputs = Column(JSON, default=list)   # list of input identifiers
    outputs = Column(JSON, default=list)  # list of output identifiers / artifact keys

    # Link back to the causal DAG node that this step relates to
    dag_node_ref = Column(String(100), nullable=True)

    # Timing
    duration_ms = Column(Integer, nullable=True)

    __table_args__ = (
        Index("idx_exec_events_project_run", "project_id", "run_id"),
        Index("idx_exec_events_project_ts", "project_id", "timestamp"),
        Index("idx_exec_events_run_step", "run_id", "step_index"),
    )


# ============================================================================
# UPDATE EXISTING MODELS WITH NEW RELATIONSHIPS
# ============================================================================

# Update User model to include new relationships
User.saved_searches = relationship("SavedSearch", back_populates="user")
User.review_assignments = relationship("ReviewAssignment", foreign_keys="ReviewAssignment.reviewer_id")
User.review_comments = relationship("ReviewComment", foreign_keys="ReviewComment.author_id")

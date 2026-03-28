"""
Afarensis Enterprise API Schemas

Pydantic models for request/response validation, implementing the complete
12-layer capability model for regulatory evidence review.
"""

from pydantic import BaseModel, Field, validator  # noqa: F401
from typing import List, Dict, Optional, Any, Union  # noqa: F401
from datetime import datetime
from enum import Enum
import uuid


# Base schemas
class TimestampMixin(BaseModel):
    """Mixin for timestamp fields"""
    created_at: datetime
    updated_at: datetime


class IdMixin(BaseModel):
    """Mixin for ID fields"""
    id: uuid.UUID


# Enums
class ProjectStatusEnum(str, Enum):
    DRAFT = "draft"
    PROCESSING = "processing"
    REVIEW = "review"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class EvidenceSourceEnum(str, Enum):
    PUBMED = "pubmed"
    CLINICALTRIALS = "clinicaltrials"
    UPLOADED_DOCUMENT = "uploaded_document"
    INSTITUTIONAL_DATA = "institutional_data"
    FEDERATED_SOURCE = "federated_source"


class UserRoleEnum(str, Enum):
    VIEWER = "viewer"
    ANALYST = "analyst"
    REVIEWER = "reviewer"
    ADMIN = "admin"


class BiasTypeEnum(str, Enum):
    SELECTION_BIAS = "selection_bias"
    INFORMATION_BIAS = "information_bias"
    CONFOUNDING = "confounding"
    TEMPORAL_BIAS = "temporal_bias"
    MEASUREMENT_BIAS = "measurement_bias"


class CritiqueSeverityEnum(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# Health and System schemas
class HealthResponse(BaseModel):
    """System health check response"""
    status: str = Field(..., description="Overall system health status")
    timestamp: datetime = Field(..., description="Health check timestamp")
    database: Dict[str, Any] = Field(..., description="Database health information")
    dependencies: Dict[str, Any] = Field(..., description="External dependencies status")
    version: str = Field(default="2.0.0", description="API version")


# User schemas
class UserBase(BaseModel):
    """Base user schema"""
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
    full_name: Optional[str] = Field(None, max_length=200)
    organization: Optional[str] = Field(None, max_length=200)
    role: UserRoleEnum


class UserCreate(UserBase):
    """User creation schema"""
    password: str = Field(..., min_length=8, max_length=128)


class UserResponse(UserBase, IdMixin, TimestampMixin):
    """User response schema"""
    is_active: bool
    last_login: Optional[datetime]
    expertise_areas: List[str] = []

    class Config:
        from_attributes = True


# Authentication schemas
class LoginRequest(BaseModel):
    """Login request schema"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)


class LoginResponse(BaseModel):
    """Login response schema"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    """Refresh token request"""
    refresh_token: str = Field(..., min_length=10)


# ── Password Reset Request Models ──
class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255, pattern=r'^[^@]+@[^@]+\.[^@]+$')

class VerifyResetCodeRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    code: str = Field(..., min_length=6, max_length=6, pattern=r'^\d{6}$')

class ResetPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    reset_token: str = Field(..., min_length=10)
    new_password: str = Field(..., min_length=8, max_length=128)


# ── Search Request Models ──
class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    limit: int = Field(default=20, ge=1, le=100)
    threshold: float = Field(default=0.5, ge=0.0, le=1.0)

class HybridSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    limit: int = Field(default=20, ge=1, le=100)
    semantic_weight: float = Field(default=0.5, ge=0.0, le=1.0)

class SaveSearchRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    query: str = Field(..., min_length=1, max_length=1000)
    filters: Optional[dict] = None

class CitationNetworkRequest(BaseModel):
    evidence_ids: List[str] = Field(..., min_length=1)
    depth: int = Field(default=2, ge=1, le=5)


# ── Review Request Models ──
class ReviewWorkflowRequest(BaseModel):
    project_id: str = Field(..., min_length=1)
    name: str = Field(default="Review Workflow", max_length=255)
    evidence_ids: Optional[List[str]] = None

class ReviewAssignmentRequest(BaseModel):
    evidence_id: str = Field(..., min_length=1)
    reviewer_id: str = Field(..., min_length=1)
    priority: str = Field(default="normal", pattern=r'^(low|normal|high|urgent)$')

class ReviewCommentRequest(BaseModel):
    evidence_id: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1, max_length=5000)
    parent_id: Optional[str] = None
    mentions: Optional[List[str]] = None

class ReviewDecisionSubmitRequest(BaseModel):
    evidence_id: str = Field(..., min_length=1)
    decision: str = Field(..., pattern=r'^(accepted|rejected|deferred|pending)$')
    confidence_level: float = Field(default=0.8, ge=0.0, le=1.0)
    rationale: str = Field(default="", max_length=5000)

class ConflictResolveRequest(BaseModel):
    evidence_id: str = Field(..., min_length=1)
    resolution: str = Field(..., pattern=r'^(accepted|rejected|deferred)$')
    rationale: str = Field(..., min_length=1, max_length=5000)

class PresenceUpdateRequest(BaseModel):
    cursor_position: Optional[dict] = None
    active_section: Optional[str] = None


# ── Data Classification ──
class DataClassifyRequest(BaseModel):
    data_type: str = Field(..., min_length=1, max_length=100)
    content_sample: Optional[str] = Field(default=None, max_length=5000)
    metadata: Optional[dict] = None


# ── SAR Pipeline ──
class SarPipelineInitRequest(BaseModel):
    project_id: str = Field(..., min_length=1)

class SarStageRunRequest(BaseModel):
    stage: str = Field(..., min_length=1, max_length=50)


# ── Semantic Scholar ──
class SemanticScholarRecommendRequest(BaseModel):
    paper_ids: List[str] = Field(..., min_length=1)

class RareDiseaseSearchRequest(BaseModel):
    disease_name: str = Field(..., min_length=2, max_length=255)
    evidence_types: Optional[List[str]] = None
    max_results: int = Field(default=20, ge=1, le=100)


# ── Study Configuration Section Schemas ──
# These validate the JSON blobs saved to project.processing_config sections.
# They use Optional fields because the frontend sends partial updates.

class StudyDefinitionPayload(BaseModel):
    """Payload for PUT /projects/{id}/study/definition"""
    study_title: Optional[str] = Field(None, max_length=500)
    indication: Optional[str] = Field(None, max_length=500)
    population: Optional[str] = Field(None, max_length=1000)
    intervention: Optional[str] = Field(None, max_length=1000)
    comparator: Optional[str] = Field(None, max_length=1000)
    primary_endpoint: Optional[str] = Field(None, max_length=500)
    secondary_endpoints: Optional[List[str]] = None
    study_design: Optional[str] = Field(None, max_length=200)
    estimand_framework: Optional[Dict[str, Any]] = None
    class Config:
        extra = "allow"  # Allow additional fields for flexibility

class StudyCovariatesPayload(BaseModel):
    """Payload for PUT /projects/{id}/study/covariates"""
    covariates: Optional[List[Dict[str, Any]]] = None
    unmeasured: Optional[List[Dict[str, Any]]] = None
    class Config:
        extra = "allow"

class StudyDataSourcesPayload(BaseModel):
    """Payload for PUT /projects/{id}/study/data-sources"""
    sources: Optional[List[Dict[str, Any]]] = None
    checks: Optional[List[Dict[str, Any]]] = None
    class Config:
        extra = "allow"

class StudyCohortPayload(BaseModel):
    """Payload for PUT /projects/{id}/study/cohort"""
    inclusion: Optional[List[Dict[str, Any]]] = None
    exclusion: Optional[List[Dict[str, Any]]] = None
    weighting_methods: Optional[List[Dict[str, Any]]] = None
    class Config:
        extra = "allow"

class StudyReproducibilityPayload(BaseModel):
    """Payload for PUT /projects/{id}/study/reproducibility"""
    manifest: Optional[List[Dict[str, Any]]] = None
    packages: Optional[List[Dict[str, Any]]] = None
    class Config:
        extra = "allow"

class InviteUserRequest(BaseModel):
    """Payload for POST /org/users/invite"""
    email: str = Field(..., min_length=3, max_length=255, pattern=r'^[^@]+@[^@]+\.[^@]+$')
    full_name: str = Field(..., min_length=1, max_length=255)
    role: str = Field(default="VIEWER", pattern=r'^(ADMIN|REVIEWER|ANALYST|VIEWER)$')

class UpdateUserRoleRequest(BaseModel):
    """Payload for PUT /org/users/{user_id}/role"""
    role: str = Field(..., pattern=r'^(ADMIN|REVIEWER|ANALYST|VIEWER)$')


# Project schemas
class ProjectBase(BaseModel):
    """Base project schema"""
    name: Optional[str] = Field(None, max_length=200)
    title: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = Field(None, max_length=1000)
    indication: Optional[str] = Field(None, max_length=200)
    therapeutic_area: Optional[str] = Field(None, max_length=100)


class ProjectCreateRequest(ProjectBase):
    """Project creation request"""
    research_intent: Optional[str] = Field(None, description="Research intent / protocol text")
    protocol_text: Optional[str] = Field(None, description="Protocol or SAP text content")
    phase: Optional[str] = Field(None, description="Clinical trial phase (e.g. Phase 1, Phase 2, Phase 3)")
    agency: Optional[str] = Field(None, description="Regulatory agency (e.g. FDA, EMA, PMDA)")
    evidence_sources: List[EvidenceSourceEnum] = Field(
        default=[EvidenceSourceEnum.PUBMED, EvidenceSourceEnum.CLINICALTRIALS],
        description="Evidence sources to search"
    )
    processing_config: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Custom processing configuration"
    )


class ProjectResponse(ProjectBase, IdMixin, TimestampMixin):
    """Project response schema"""
    status: ProjectStatusEnum = ProjectStatusEnum.DRAFT
    owner_id: Optional[uuid.UUID] = None
    created_by: Optional[str] = None
    research_intent: Optional[str] = None
    evidence_count: int = 0
    anchor_candidate_count: int = 0
    review_decisions_count: int = 0

    class Config:
        from_attributes = True


class ProjectDetailResponse(ProjectResponse):
    """Detailed project response with nested data"""
    parsed_specification: Optional[Dict[str, Any]] = None
    processing_config: Dict[str, Any] = {}
    recent_activity: List[Dict[str, Any]] = []
    capability_layer_status: Dict[str, str] = {}


class ProjectUpdateRequest(BaseModel):
    """Project update request"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    status: Optional[ProjectStatusEnum] = None
    processing_config: Optional[Dict[str, Any]] = None


# Evidence schemas
class EvidenceRecordBase(BaseModel):
    """Base evidence record schema"""
    title: Optional[str] = Field(None, max_length=500)
    abstract: Optional[str] = Field(None, max_length=5000)
    source_type: Optional[EvidenceSourceEnum] = None
    source_id: Optional[str] = Field(None, max_length=255)
    external_id: Optional[str] = Field(None, max_length=200)
    source_url: Optional[str] = None
    publication_date: Optional[datetime] = None
    publication_year: Optional[int] = None
    authors: Optional[List[str]] = []
    journal: Optional[str] = Field(None, max_length=200)
    doi: Optional[str] = Field(None, max_length=200)


class EvidenceRecordResponse(EvidenceRecordBase, IdMixin):
    """Evidence record response"""
    project_id: Optional[uuid.UUID] = None
    structured_data: Optional[Dict[str, Any]] = None
    extracted_data: Dict[str, Any] = {}
    extraction_confidence: Optional[float] = None
    quality_score: Optional[float] = Field(None, ge=0, le=1)
    is_anchor_candidate: bool = False
    discovered_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EvidenceSearchRequest(BaseModel):
    """Evidence search/discovery request"""
    query_terms: List[str] = Field(..., min_items=1)
    max_results_per_source: int = Field(default=50, ge=1, le=200)
    date_range_start: Optional[datetime] = None
    date_range_end: Optional[datetime] = None
    include_trial_registries: bool = True
    include_literature: bool = True


# Comparability schemas
class ComparabilityDimension(BaseModel):
    """Single comparability dimension score"""
    dimension_name: str
    score: float = Field(..., ge=0, le=1)
    confidence: float = Field(..., ge=0, le=1)
    details: Dict[str, Any] = {}


class ComparabilityScoreResponse(IdMixin):
    """Comparability score response"""
    project_id: Optional[uuid.UUID] = None
    evidence_record_id: Optional[uuid.UUID] = None
    population_similarity: Optional[float] = None
    endpoint_alignment: Optional[float] = None
    covariate_coverage: Optional[float] = None
    temporal_alignment: Optional[float] = None
    evidence_quality: Optional[float] = None
    provenance_score: Optional[float] = None
    overall_score: Optional[float] = None
    regulatory_viability: Optional[float] = None
    composite_score: Optional[float] = None
    dimensions: List[ComparabilityDimension] = []
    dimension_details: Optional[Dict[str, Any]] = None
    scoring_rationale: Optional[str] = None
    analysis_details: Dict[str, Any] = {}
    scored_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ComparabilityAnalysisRequest(BaseModel):
    """Request to run comparability analysis"""
    evidence_record_ids: List[uuid.UUID] = Field(..., min_items=1)
    analysis_config: Optional[Dict[str, Any]] = Field(default_factory=dict)


# Bias Analysis schemas
class BiasAnalysisResponse(IdMixin):
    """Bias analysis response"""
    project_id: Optional[uuid.UUID] = None
    evidence_record_id: Optional[uuid.UUID] = None
    comparability_score_id: Optional[uuid.UUID] = None
    bias_type: Optional[str] = None
    bias_types: Optional[List[BiasTypeEnum]] = None
    bias_severity: Optional[float] = None
    severity_score: Optional[float] = None
    bias_description: Optional[str] = None
    fragility_score: Optional[float] = None
    sensitivity_flags: Optional[Dict[str, Any]] = None
    regulatory_risk: Optional[float] = None
    mitigation_strategies: Optional[List] = []
    adjustment_recommendations: Optional[str] = None
    detected_issues: List[Dict[str, Any]] = []
    regulatory_risk_level: Optional[str] = None
    analysis_details: Dict[str, Any] = {}
    analyzed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BiasAnalysisRequest(BaseModel):
    """Request to run bias analysis"""
    evidence_record_ids: List[uuid.UUID] = Field(..., min_items=1)
    analysis_type: str = Field(default="comprehensive")
    sensitivity_threshold: float = Field(default=0.1, ge=0, le=1)


# Review Decision schemas
class ReviewDecisionRequest(BaseModel):
    """Review decision request"""
    evidence_record_id: uuid.UUID
    decision: str = Field(..., pattern=r'^(accept|reject|request_more_info)$')
    confidence_level: float = Field(..., ge=0, le=1)
    rationale: str = Field(..., min_length=10, max_length=2000)
    regulatory_notes: Optional[str] = Field(None, max_length=1000)
    follow_up_required: bool = False


class ReviewDecisionResponse(IdMixin):
    """Review decision response"""
    project_id: Optional[uuid.UUID] = None
    evidence_record_id: Optional[uuid.UUID] = None
    reviewer_id: Optional[uuid.UUID] = None
    decision: Optional[str] = None
    confidence_level: Optional[float] = None
    rationale: Optional[str] = None
    notes: Optional[str] = None
    regulatory_notes: Optional[str] = None
    follow_up_required: bool = False
    is_final: bool = False
    decided_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Evidence Critique schemas
class EvidenceCritiqueResponse(IdMixin, TimestampMixin):
    """Evidence critique response"""
    project_id: uuid.UUID
    evidence_record_id: uuid.UUID
    critique_text: str
    severity: CritiqueSeverityEnum
    fda_acceptance_likelihood: float = Field(..., ge=0, le=1)
    identified_risks: List[str] = []
    improvement_suggestions: List[str] = []
    regulatory_concerns: List[str] = []

    class Config:
        from_attributes = True


class CritiqueGenerationRequest(BaseModel):
    """Request to generate evidence critique"""
    evidence_record_ids: List[uuid.UUID] = Field(..., min_items=1)
    critique_type: str = Field(default="regulatory", pattern=r'^(regulatory|statistical|clinical)$')
    focus_areas: List[str] = []


# Regulatory Artifact schemas
class RegulatoryArtifactResponse(IdMixin):
    """Regulatory artifact response"""
    project_id: Optional[uuid.UUID] = None
    artifact_type: str = ""
    title: str = ""
    description: Optional[str] = None
    format: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    file_hash: Optional[str] = None
    checksum: Optional[str] = None
    generated_by: Optional[uuid.UUID] = None
    template_version: Optional[str] = None
    regulatory_context: Dict[str, Any] = {}
    regulatory_agency: Optional[str] = None
    submission_context: Optional[str] = None
    generated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ArtifactGenerationRequest(BaseModel):
    """Request to generate regulatory artifact"""
    artifact_type: str = Field(..., pattern=r'^(fda_reviewer_packet|ema_assessment|summary_report|evidence_table)$')
    template_id: Optional[str] = None
    include_sections: List[str] = []
    output_format: str = Field(default="pdf", pattern=r'^(pdf|docx|html)$')
    custom_parameters: Dict[str, Any] = Field(default_factory=dict)


# Audit schemas
class AuditLogResponse(IdMixin, TimestampMixin):
    """Audit log response"""
    audit_type: str
    action: str
    resource_type: str
    resource_id: Optional[uuid.UUID]
    user_id: Optional[uuid.UUID]
    details: Dict[str, Any] = {}
    ip_address: Optional[str]
    user_agent: Optional[str]
    regulatory_significance: bool = False

    class Config:
        from_attributes = True


class AuditQueryRequest(BaseModel):
    """Audit log query request"""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    user_id: Optional[uuid.UUID] = None
    resource_type: Optional[str] = None
    regulatory_significance_only: bool = False
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)


# File Upload schemas
class FileUploadResponse(BaseModel):
    """File upload response"""
    file_id: uuid.UUID
    filename: str
    file_size: int
    file_hash: str
    content_type: str
    upload_url: str
    status: str = "uploaded"


class DocumentParseResponse(BaseModel):
    """Document parsing response"""
    file_id: uuid.UUID
    parsed_content: Dict[str, Any]
    extraction_confidence: float = Field(..., ge=0, le=1)
    identified_sections: List[str] = []
    parsing_warnings: List[str] = []


# Federated Network schemas (Beta)
class FederatedNodeResponse(BaseModel):
    """Federated network node response"""
    node_id: str
    institution_name: str
    node_url: str
    capabilities: List[str] = []
    is_active: bool = True
    last_ping: datetime
    shared_constraints_count: int = 0


class FederatedQueryRequest(BaseModel):
    """Federated network query request"""
    query_type: str = Field(..., pattern=r'^(evidence|constraints|patterns)$')
    query_parameters: Dict[str, Any]
    target_nodes: Optional[List[str]] = None
    privacy_level: str = Field(default="aggregate", pattern=r'^(aggregate|summary|detailed)$')


# Evidence Pattern schemas (Beta)
class EvidencePatternResponse(BaseModel):
    """Evidence pattern response"""
    pattern_id: str
    pattern_name: str
    description: str
    success_rate: float = Field(..., ge=0, le=1)
    regulatory_precedents: List[str] = []
    usage_count: int = 0
    pattern_template: Dict[str, Any] = {}


# Pagination schemas
class PaginationMeta(BaseModel):
    """Pagination metadata"""
    total: int
    page: int
    per_page: int
    pages: int


class PaginatedResponse(BaseModel):
    """Generic paginated response"""
    data: List[Any]
    meta: PaginationMeta


# Error schemas
class ErrorDetail(BaseModel):
    """Error detail schema"""
    type: str
    message: str
    code: Optional[str] = None
    correlation_id: str
    timestamp: datetime
    details: Optional[Dict[str, Any]] = None


class ValidationError(BaseModel):
    """Validation error schema"""
    field: str
    message: str
    type: str
    input: Optional[Any] = None


# Search and Filter schemas
class ProjectSearchRequest(BaseModel):
    """Project search request"""
    query: Optional[str] = None
    status: Optional[ProjectStatusEnum] = None
    therapeutic_area: Optional[str] = None
    owner_id: Optional[uuid.UUID] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class EvidenceSearchFilter(BaseModel):
    """Evidence search filter"""
    source_types: Optional[List[EvidenceSourceEnum]] = None
    min_quality_score: Optional[float] = Field(None, ge=0, le=1)
    publication_date_start: Optional[datetime] = None
    publication_date_end: Optional[datetime] = None
    is_anchor_candidate: Optional[bool] = None


# Analytics schemas
class ProjectAnalytics(BaseModel):
    """Project analytics response"""
    total_projects: int
    projects_by_status: Dict[str, int]
    projects_by_therapeutic_area: Dict[str, int]
    evidence_processing_stats: Dict[str, Any]
    review_completion_rate: float
    average_processing_time: Optional[float]


class SystemMetrics(BaseModel):
    """System-wide metrics"""
    active_users: int
    total_evidence_records: int
    total_reviews_completed: int
    average_comparability_score: float
    bias_detection_rate: float
    regulatory_artifacts_generated: int


# Configuration schemas
class SystemConfigResponse(BaseModel):
    """System configuration response"""
    max_upload_size: int
    supported_file_types: List[str]
    evidence_sources: List[str]
    processing_limits: Dict[str, int]
    feature_flags: Dict[str, bool]


class ProcessingConfigUpdate(BaseModel):
    """Processing configuration update"""
    max_evidence_per_source: Optional[int] = Field(None, ge=1, le=500)
    ai_model_preferences: Optional[Dict[str, str]] = None
    quality_thresholds: Optional[Dict[str, float]] = None
    automation_settings: Optional[Dict[str, bool]] = None

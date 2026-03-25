# Afarensis Enterprise v2.1 — Entity Relationship Diagram

## Document Control

| Field | Value |
|-------|-------|
| Version | 2.1.0 |
| Date | 2026-03-24 |
| Format | Mermaid erDiagram (render with any Mermaid-compatible viewer) |
| Total Models | 30 |

---

## Complete Entity Relationship Diagram

```mermaid
erDiagram
    %% ═══════════════════════════════════════════════════════════════
    %% MULTI-TENANCY & IDENTITY
    %% ═══════════════════════════════════════════════════════════════

    Organization {
        String_36 id PK
        String_255 name UK "NOT NULL"
        String_100 slug UK "NOT NULL"
        Boolean is_active "DEFAULT true"
        DateTime created_at
        DateTime updated_at
    }

    User {
        String_36 id PK
        String_255 email UK "NOT NULL"
        String_255 full_name "NOT NULL"
        Enum role "NOT NULL (admin, reviewer, analyst, viewer)"
        String_36 organization_id FK "SET NULL -> organizations.id"
        String_255 hashed_password
        Boolean is_active "DEFAULT true"
        Boolean email_verified "DEFAULT false"
        DateTime last_login
        String_255 organization "profile field"
        String_255 department
        JSON expertise_areas
        DateTime created_at
        DateTime updated_at
    }

    Organization ||--o{ User : "has members"

    %% ═══════════════════════════════════════════════════════════════
    %% SESSION & TOKEN MANAGEMENT
    %% ═══════════════════════════════════════════════════════════════

    SessionToken {
        String_36 id PK
        String_36 user_id FK "CASCADE -> users.id, NOT NULL"
        String_255 token_hash "NOT NULL"
        String_50 token_type "access | refresh | reset"
        DateTime created_at
        DateTime expires_at "NOT NULL"
        DateTime last_used
        String_45 ip_address
        String_500 user_agent
        Boolean is_revoked "DEFAULT false"
        String_255 code_hash "SHA-256 of reset code, nullable"
    }

    User ||--o{ SessionToken : "has sessions"

    PasswordResetToken {
        String_36 id PK
        String_255 email "NOT NULL, indexed"
        String_255 code_hash "NOT NULL"
        DateTime expires_at "NOT NULL"
        Boolean used "DEFAULT false"
        String_255 reset_token_hash
        DateTime token_expires_at
        DateTime created_at
    }

    EmailVerificationToken {
        String_36 id PK
        String_36 user_id FK "CASCADE -> users.id, NOT NULL"
        String_255 token_hash "NOT NULL"
        DateTime expires_at "NOT NULL"
        Boolean used "DEFAULT false"
        DateTime created_at
    }

    User ||--o{ EmailVerificationToken : "has verification tokens"

    %% ═══════════════════════════════════════════════════════════════
    %% RESEARCH SPECIFICATION LAYER (Layer 1)
    %% ═══════════════════════════════════════════════════════════════

    Project {
        String_36 id PK
        String_500 title "NOT NULL"
        Text description
        Enum status "draft | processing | review | completed | archived"
        String_36 organization_id FK "SET NULL -> organizations.id"
        DateTime created_at
        DateTime updated_at
        String_36 created_by FK "SET NULL -> users.id"
        Text research_intent "NOT NULL, DEFAULT ''"
        String_255 source_filename
        Text source_text
        Integer max_pubmed_results "DEFAULT 50"
        Integer max_trials_results "DEFAULT 50"
        JSON processing_config "Central JSON config for all study workflow state"
    }

    Organization ||--o{ Project : "owns projects"
    User ||--o{ Project : "created by"

    ParsedSpecification {
        String_36 id PK
        String_36 project_id FK "CASCADE -> projects.id, NOT NULL"
        String_255 indication
        Text population_definition
        Text primary_endpoint
        JSON secondary_endpoints
        JSON inclusion_criteria
        JSON exclusion_criteria
        String_100 follow_up_period
        Integer sample_size
        Text statistical_plan
        JSON covariates
        JSON assumptions
        JSON clarifications
        DateTime parsed_at
        String_100 parsing_model
        Float confidence_score
    }

    Project ||--o{ ParsedSpecification : "has parsed specs"

    %% ═══════════════════════════════════════════════════════════════
    %% EVIDENCE DISCOVERY & EXTRACTION LAYERS (Layers 2-3)
    %% ═══════════════════════════════════════════════════════════════

    EvidenceRecord {
        String_36 id PK
        String_36 project_id FK "CASCADE -> projects.id, NOT NULL"
        Enum source_type "pubmed | clinicaltrials | uploaded_document | institutional_data | federated_source"
        String_255 source_id "PMID, NCT number, openalex_*, ss_*"
        String_1000 source_url
        String_1000 title
        Text abstract
        Text full_text
        JSON authors
        String_255 journal
        Integer publication_year
        JSON structured_data
        String_100 extraction_model
        Float extraction_confidence
        DateTime discovered_at
        Text query_used
        Integer retrieval_rank
    }

    Project ||--o{ EvidenceRecord : "has evidence"

    %% ═══════════════════════════════════════════════════════════════
    %% ANCHOR COMPARABILITY ENGINE (Layers 4-5)
    %% ═══════════════════════════════════════════════════════════════

    ComparabilityScore {
        String_36 id PK
        String_36 evidence_record_id FK "CASCADE -> evidence_records.id, NOT NULL"
        Float population_similarity
        Float endpoint_alignment
        Float covariate_coverage
        Float temporal_alignment
        Float evidence_quality
        Float provenance_score
        Float overall_score
        Float regulatory_viability
        JSON dimension_details
        Text scoring_rationale
        DateTime scored_at
        String_100 scoring_model
        String_50 scoring_version
    }

    EvidenceRecord ||--o{ ComparabilityScore : "has comparability scores"

    %% ═══════════════════════════════════════════════════════════════
    %% BIAS & FRAGILITY ANALYSIS (Layer 6)
    %% ═══════════════════════════════════════════════════════════════

    BiasAnalysis {
        String_36 id PK
        String_36 comparability_score_id FK "CASCADE -> comparability_scores.id, NOT NULL"
        Enum bias_type "selection_bias | confounding | measurement_bias | temporal_bias | publication_bias"
        Float bias_severity "0-1 scale"
        Text bias_description
        Float fragility_score
        JSON sensitivity_flags
        Float regulatory_risk
        JSON mitigation_strategies
        Text adjustment_recommendations
        DateTime analyzed_at
        String_100 analysis_model
    }

    ComparabilityScore ||--o{ BiasAnalysis : "has bias analyses"

    %% ═══════════════════════════════════════════════════════════════
    %% EVIDENCE CRITIQUE (Layer 8)
    %% ═══════════════════════════════════════════════════════════════

    EvidenceCritique {
        String_36 id PK
        String_36 project_id FK "CASCADE -> projects.id, NOT NULL"
        Text overall_assessment
        JSON strengths
        JSON weaknesses
        JSON regulatory_concerns
        JSON recommendations
        Text alternative_approaches
        JSON additional_evidence_needed
        Float fda_acceptance_likelihood
        JSON regulatory_precedents
        DateTime generated_at
        String_100 critique_model
        String_100 reviewer_persona "e.g. fda_statistical_reviewer"
    }

    Project ||--o{ EvidenceCritique : "has critiques"

    %% ═══════════════════════════════════════════════════════════════
    %% REVIEWER DECISION (Layer 9)
    %% ═══════════════════════════════════════════════════════════════

    ReviewDecision {
        String_36 id PK
        String_36 project_id FK "CASCADE -> projects.id, NOT NULL"
        String_36 evidence_record_id FK "CASCADE -> evidence_records.id, NOT NULL"
        String_36 reviewer_id FK "CASCADE -> users.id, NOT NULL"
        Enum decision "NOT NULL (accepted | rejected | deferred | pending)"
        Float confidence_level "0-1 scale"
        Text rationale
        Text notes
        JSON review_criteria
        Text alternative_considerations
        DateTime decided_at
        Integer review_duration_seconds
    }

    Project ||--o{ ReviewDecision : "has decisions"
    EvidenceRecord ||--o{ ReviewDecision : "reviewed via"
    User ||--o{ ReviewDecision : "decided by"

    %% ═══════════════════════════════════════════════════════════════
    %% REGULATORY ARTIFACT GENERATION (Layer 10)
    %% ═══════════════════════════════════════════════════════════════

    RegulatoryArtifact {
        String_36 id PK
        String_36 project_id FK "CASCADE -> projects.id, NOT NULL"
        String_100 artifact_type "safety_assessment_report | adrg | csr_* | ectd"
        String_500 title
        String_50 format "html | pdf | json | docx"
        Text content
        String_50 template_version
        String_1000 file_path
        Integer file_size
        String_64 checksum
        DateTime generated_at
        String_36 generated_by FK "SET NULL -> users.id"
        String_100 generation_model
        String_100 regulatory_agency
        Text submission_context
    }

    Project ||--o{ RegulatoryArtifact : "has artifacts"
    User ||--o{ RegulatoryArtifact : "generated by"

    %% ═══════════════════════════════════════════════════════════════
    %% AUDIT & COMPLIANCE
    %% ═══════════════════════════════════════════════════════════════

    AuditLog {
        String_36 id PK
        String_36 project_id FK "SET NULL -> projects.id"
        String_36 user_id FK "SET NULL -> users.id"
        String_100 action "NOT NULL"
        String_100 resource_type
        String_36 resource_id
        String_45 ip_address
        String_500 user_agent
        String_36 request_id
        JSON old_values
        JSON new_values
        Text change_summary
        DateTime timestamp
        Integer duration_ms
        Boolean regulatory_significance "DEFAULT false"
        Integer retention_period_years "DEFAULT 7"
    }

    Project ||--o{ AuditLog : "has audit logs"
    User ||--o{ AuditLog : "performed by"

    %% ═══════════════════════════════════════════════════════════════
    %% ADVANCED SEARCH
    %% ═══════════════════════════════════════════════════════════════

    SavedSearch {
        String_36 id PK
        String_36 user_id FK "CASCADE -> users.id, NOT NULL"
        String_255 name "NOT NULL"
        Text query "NOT NULL"
        String_50 search_type "semantic | keyword | hybrid"
        JSON filters
        String_50 alert_frequency "daily | weekly | monthly"
        DateTime created_at
        DateTime last_run
        Boolean is_active "DEFAULT true"
    }

    User ||--o{ SavedSearch : "has saved searches"

    EvidenceEmbedding {
        String_36 id PK
        String_36 evidence_id FK "CASCADE -> evidence_records.id, NOT NULL"
        JSON embedding_vector "float array stored as JSON"
        String_100 embedding_model
        String_50 text_source "title | abstract | full_text"
        DateTime created_at
    }

    EvidenceRecord ||--o{ EvidenceEmbedding : "has embeddings"

    CitationRelationship {
        String_36 id PK
        String_36 citing_evidence_id FK "CASCADE -> evidence_records.id, NOT NULL"
        String_36 cited_evidence_id FK "CASCADE -> evidence_records.id, NOT NULL"
        Text citation_context
        String_50 relationship_type "direct | indirect | co_citation"
        Float confidence_score
        DateTime detected_at
    }

    EvidenceRecord ||--o{ CitationRelationship : "cites (as citing)"
    EvidenceRecord ||--o{ CitationRelationship : "cited by (as cited)"

    %% ═══════════════════════════════════════════════════════════════
    %% COLLABORATIVE REVIEW
    %% ═══════════════════════════════════════════════════════════════

    ReviewAssignment {
        String_36 id PK
        String_36 evidence_id FK "CASCADE -> evidence_records.id, NOT NULL"
        String_36 reviewer_id FK "CASCADE -> users.id, NOT NULL"
        String_36 assigned_by FK "SET NULL -> users.id"
        String_50 role "reviewer | senior_reviewer | approver"
        String_50 status "pending | in_progress | completed"
        DateTime assigned_at
        DateTime due_date
        DateTime completed_at
        Float weight "DEFAULT 1.0, voting weight"
        String_36 workflow_id
    }

    EvidenceRecord ||--o{ ReviewAssignment : "assigned for review"
    User ||--o{ ReviewAssignment : "assigned to (reviewer)"
    User ||--o{ ReviewAssignment : "assigned by"

    ReviewComment {
        String_36 id PK
        String_36 evidence_id FK "CASCADE -> evidence_records.id, NOT NULL"
        String_36 author_id FK "CASCADE -> users.id, NOT NULL"
        String_36 parent_comment_id FK "SET NULL -> review_comments.id (self-ref)"
        Text content "NOT NULL"
        String_50 comment_type "general | bias_concern | methodology"
        JSON mentions "user IDs mentioned"
        DateTime created_at
        DateTime updated_at
        DateTime resolved_at
        String_36 resolved_by FK "SET NULL -> users.id"
    }

    EvidenceRecord ||--o{ ReviewComment : "has comments"
    User ||--o{ ReviewComment : "authored by"
    ReviewComment ||--o{ ReviewComment : "has replies (parent_comment_id)"
    User ||--o{ ReviewComment : "resolved by"

    WorkflowStep {
        String_36 id PK
        String_36 workflow_id
        String_50 step_type "initial_review | peer_review | senior_review"
        Integer step_order
        Integer required_reviewers
        Integer duration_hours
        String_50 status "pending | active | completed"
        DateTime started_at
        DateTime completed_at
    }

    UserPresence {
        String_36 id PK
        String_36 user_id FK "CASCADE -> users.id, NOT NULL"
        String_50 resource_type "evidence | project | comment"
        String_36 resource_id
        String_100 activity "viewing | editing | commenting"
        DateTime last_seen
        JSON cursor_position
    }

    User ||--o{ UserPresence : "has presence records"

    NotificationSettings {
        String_36 id PK
        String_36 user_id FK "CASCADE -> users.id, NOT NULL"
        String_100 notification_type "assignment | mention | deadline"
        Boolean email_enabled "DEFAULT true"
        Boolean push_enabled "DEFAULT true"
        String_50 frequency "immediate | daily | weekly"
    }

    User ||--o{ NotificationSettings : "has notification prefs"

    %% ═══════════════════════════════════════════════════════════════
    %% CDISC ADaM ANALYSIS DATASETS
    %% ═══════════════════════════════════════════════════════════════

    AdamDataset {
        String_36 id PK
        String_36 project_id FK "CASCADE -> projects.id, NOT NULL"
        String_50 dataset_name "NOT NULL (ADSL, ADAE, ADTTE, ADLB)"
        String_200 dataset_label
        String_100 structure "e.g. One record per subject"
        JSON variables "Array of variable specs"
        Integer records_count "DEFAULT 0"
        JSON data_content "Actual dataset rows"
        String_50 validation_status "DEFAULT 'pending' (pending | valid | invalid)"
        JSON validation_report
        DateTime created_at
        DateTime updated_at
    }

    Project ||--o{ AdamDataset : "has ADaM datasets"

    %% ═══════════════════════════════════════════════════════════════
    %% PATIENT DATA INGESTION & CONSENT
    %% ═══════════════════════════════════════════════════════════════

    ConsentLog {
        String_36 id PK
        String_36 user_id FK "CASCADE -> users.id, NOT NULL"
        String_36 project_id FK "CASCADE -> projects.id, NOT NULL"
        String_100 protocol_id
        String_50 consent_version "DEFAULT 'HIPAA-SH-v1.2'"
        DateTime timestamp_utc "NOT NULL"
        String_50 ip_address
        String_255 session_token
        String_64 attestation_hash "NOT NULL, SHA-256"
        Text attestation_text
        String_20 status "DEFAULT 'confirmed' (confirmed | revoked)"
        DateTime created_at
    }

    User ||--o{ ConsentLog : "attested by"
    Project ||--o{ ConsentLog : "for project"

    IngestionReport {
        String_36 id PK
        String_36 project_id FK "CASCADE -> projects.id, NOT NULL"
        String_36 consent_log_id FK "CASCADE -> consent_logs.id, NOT NULL"
        String_255 file_name "NOT NULL"
        String_64 file_hash "NOT NULL, SHA-256"
        Integer file_size_bytes
        DateTime upload_timestamp
        String_36 uploader_id FK "CASCADE -> users.id, NOT NULL"
        String_30 compliance_status "NOT NULL (CLEARED | BLOCKED | CLEARED_WITH_WARNINGS)"
        Integer total_rows
        JSON n_by_arm "e.g. {TRT: 150, EC: 300}"
        JSON columns_detected
        JSON key_variables_present
        JSON missingness_summary
        JSON findings "Array of finding objects"
        Integer critical_count "DEFAULT 0"
        Integer major_count "DEFAULT 0"
        Integer warning_count "DEFAULT 0"
        Boolean acknowledged "DEFAULT false"
        String_36 acknowledged_by
        DateTime acknowledged_at
        DateTime created_at
    }

    Project ||--o{ IngestionReport : "has ingestion reports"
    ConsentLog ||--o{ IngestionReport : "authorized by consent"
    User ||--o{ IngestionReport : "uploaded by"

    PatientDataset {
        String_36 id PK
        String_36 project_id FK "CASCADE -> projects.id, NOT NULL"
        String_36 ingestion_report_id FK "CASCADE -> ingestion_reports.id, NOT NULL"
        String_255 dataset_name
        String_20 source_type "csv | xpt | xlsx | sas7bdat"
        Integer records_count
        JSON columns
        JSON data_content "Actual rows (encrypted in production)"
        JSON row_hashes "SHA-256 hash per row for audit"
        String_20 status "DEFAULT 'active' (active | quarantined | purged)"
        DateTime created_at
    }

    Project ||--o{ PatientDataset : "has patient datasets"
    IngestionReport ||--|{ PatientDataset : "produced dataset"

    %% ═══════════════════════════════════════════════════════════════
    %% VALIDATION & ANALYSIS RESULTS
    %% ═══════════════════════════════════════════════════════════════

    ValidationRecord {
        String_36 id PK
        String_36 project_id FK "CASCADE -> projects.id, NOT NULL"
        String_36 dataset_id FK "CASCADE -> patient_datasets.id, NOT NULL"
        String_36 user_id FK "CASCADE -> users.id, NOT NULL"
        String_20 verdict "NOT NULL (PASS | BLOCKED)"
        JSON block_reasons "list of strings if BLOCKED"
        JSON phase_results "full 6-phase breakdown"
        Integer dataset_row_count
        String_64 dataset_hash "SHA-256 of data_content"
        DateTime created_at
    }

    Project ||--o{ ValidationRecord : "has validations"
    PatientDataset ||--o{ ValidationRecord : "validated via"
    User ||--o{ ValidationRecord : "run by"

    AnalysisResult {
        String_36 id PK
        String_36 project_id FK "CASCADE -> projects.id, NOT NULL"
        String_36 dataset_id FK "CASCADE -> patient_datasets.id, NOT NULL"
        String_36 validation_record_id FK "CASCADE -> validation_records.id, NOT NULL"
        String_36 user_id FK "CASCADE -> users.id, NOT NULL"
        String_64 dataset_hash "NOT NULL, SHA-256"
        JSON column_mapping
        Integer dataset_row_count
        Integer random_seed
        String_100 software_version "e.g. afarensis-2.1"
        JSON engine_versions "scipy, numpy versions"
        JSON convergence_info "Newton-Raphson iterations, status"
        JSON results "NOT NULL, complete analysis output"
        DateTime started_at "NOT NULL"
        DateTime completed_at
        Integer duration_ms
    }

    Project ||--o{ AnalysisResult : "has analysis results"
    PatientDataset ||--o{ AnalysisResult : "analyzed from"
    ValidationRecord ||--o{ AnalysisResult : "gated by validation"
    User ||--o{ AnalysisResult : "run by"

    %% ═══════════════════════════════════════════════════════════════
    %% DATA RETENTION
    %% ═══════════════════════════════════════════════════════════════

    ProjectRetentionLog {
        String_36 id PK
        String_36 project_id FK "CASCADE -> projects.id, NOT NULL"
        String_36 user_id FK "CASCADE -> users.id, NOT NULL"
        String_10 decision "NOT NULL (PERSIST | PURGE)"
        DateTime timestamp_utc
        JSON purge_scope "What was purged"
        String_64 purge_certificate_hash "SHA-256 of purge event"
        Boolean confirmed "DEFAULT false"
        Text confirmation_text
    }

    Project ||--o{ ProjectRetentionLog : "has retention decisions"
    User ||--o{ ProjectRetentionLog : "decided by"

    %% ═══════════════════════════════════════════════════════════════
    %% FEDERATED EVIDENCE NETWORK (Layer 11)
    %% ═══════════════════════════════════════════════════════════════

    FederatedNode {
        String_36 id PK
        String_100 node_id UK "NOT NULL"
        String_255 institution_name "NOT NULL"
        String_1000 endpoint_url
        Text public_key
        String_50 status "active | inactive | pending"
        JSON available_data_types
        JSON supported_queries
        Float trust_score "DEFAULT 0.5"
        DateTime last_verified
        DateTime joined_at
        DateTime last_active
    }

    %% ═══════════════════════════════════════════════════════════════
    %% EVIDENCE OPERATING SYSTEM (Layer 12)
    %% ═══════════════════════════════════════════════════════════════

    ConstraintPattern {
        String_36 id PK
        String_255 pattern_name "NOT NULL"
        String_100 pattern_type "bias_rule | comparability_rule"
        JSON pattern_logic
        JSON applicability_conditions
        Float severity_weight
        Integer usage_count "DEFAULT 0"
        Float success_rate
        String_100 contributed_by_node
        JSON validated_by_nodes
        DateTime created_at
        DateTime last_updated
    }

    EvidencePattern {
        String_36 id PK
        String_255 pattern_name "NOT NULL"
        String_100 indication_category
        JSON evidence_structure
        String_100 regulatory_outcome "approved | rejected"
        String_100 regulatory_agency
        Float approval_likelihood
        Float precedent_strength
        JSON key_success_factors
        JSON critical_evidence_types
        JSON common_pitfalls
        Integer usage_count "DEFAULT 0"
        Float validation_score
        DateTime created_at
        Integer source_submission_year
    }
```

---

## Relationship Summary

### One-to-Many Relationships

| Parent | Child | FK Column | ON DELETE |
|--------|-------|-----------|-----------|
| Organization | User | `user.organization_id` | SET NULL |
| Organization | Project | `project.organization_id` | SET NULL |
| User | Project | `project.created_by` | SET NULL |
| User | SessionToken | `session_token.user_id` | CASCADE |
| User | EmailVerificationToken | `email_verification_token.user_id` | CASCADE |
| User | SavedSearch | `saved_search.user_id` | CASCADE |
| User | ReviewAssignment (as reviewer) | `review_assignment.reviewer_id` | CASCADE |
| User | ReviewAssignment (as assigner) | `review_assignment.assigned_by` | SET NULL |
| User | ReviewComment (as author) | `review_comment.author_id` | CASCADE |
| User | ReviewComment (as resolver) | `review_comment.resolved_by` | SET NULL |
| User | ReviewDecision | `review_decision.reviewer_id` | CASCADE |
| User | ConsentLog | `consent_log.user_id` | CASCADE |
| User | IngestionReport | `ingestion_report.uploader_id` | CASCADE |
| User | ValidationRecord | `validation_record.user_id` | CASCADE |
| User | AnalysisResult | `analysis_result.user_id` | CASCADE |
| User | UserPresence | `user_presence.user_id` | CASCADE |
| User | NotificationSettings | `notification_settings.user_id` | CASCADE |
| User | RegulatoryArtifact | `regulatory_artifact.generated_by` | SET NULL |
| User | AuditLog | `audit_log.user_id` | SET NULL |
| User | ProjectRetentionLog | `project_retention_log.user_id` | CASCADE |
| Project | ParsedSpecification | `parsed_specification.project_id` | CASCADE |
| Project | EvidenceRecord | `evidence_record.project_id` | CASCADE |
| Project | EvidenceCritique | `evidence_critique.project_id` | CASCADE |
| Project | ReviewDecision | `review_decision.project_id` | CASCADE |
| Project | RegulatoryArtifact | `regulatory_artifact.project_id` | CASCADE |
| Project | AuditLog | `audit_log.project_id` | SET NULL |
| Project | AdamDataset | `adam_dataset.project_id` | CASCADE |
| Project | ConsentLog | `consent_log.project_id` | CASCADE |
| Project | IngestionReport | `ingestion_report.project_id` | CASCADE |
| Project | PatientDataset | `patient_dataset.project_id` | CASCADE |
| Project | ValidationRecord | `validation_record.project_id` | CASCADE |
| Project | AnalysisResult | `analysis_result.project_id` | CASCADE |
| Project | ProjectRetentionLog | `project_retention_log.project_id` | CASCADE |
| EvidenceRecord | ComparabilityScore | `comparability_score.evidence_record_id` | CASCADE |
| EvidenceRecord | ReviewDecision | `review_decision.evidence_record_id` | CASCADE |
| EvidenceRecord | EvidenceEmbedding | `evidence_embedding.evidence_id` | CASCADE |
| EvidenceRecord | ReviewAssignment | `review_assignment.evidence_id` | CASCADE |
| EvidenceRecord | ReviewComment | `review_comment.evidence_id` | CASCADE |
| EvidenceRecord | CitationRelationship (citing) | `citation_relationship.citing_evidence_id` | CASCADE |
| EvidenceRecord | CitationRelationship (cited) | `citation_relationship.cited_evidence_id` | CASCADE |
| ComparabilityScore | BiasAnalysis | `bias_analysis.comparability_score_id` | CASCADE |
| ConsentLog | IngestionReport | `ingestion_report.consent_log_id` | CASCADE |
| IngestionReport | PatientDataset | `patient_dataset.ingestion_report_id` | CASCADE |
| PatientDataset | ValidationRecord | `validation_record.dataset_id` | CASCADE |
| PatientDataset | AnalysisResult | `analysis_result.dataset_id` | CASCADE |
| ValidationRecord | AnalysisResult | `analysis_result.validation_record_id` | CASCADE |

### Self-Referencing Relationship

| Model | FK Column | Description |
|-------|-----------|-------------|
| ReviewComment | `parent_comment_id` | Thread replies reference parent comment |

### Unique Constraints

| Table | Columns | Constraint Name |
|-------|---------|-----------------|
| evidence_records | `(project_id, source_type, source_id)` | `uq_evidence_project_source` |
| review_decisions | `(project_id, evidence_record_id, reviewer_id)` | `uq_review_decision` |
| organizations | `name` | (column-level unique) |
| organizations | `slug` | (column-level unique) |
| users | `email` | (column-level unique) |
| federated_nodes | `node_id` | (column-level unique) |

### Standalone Tables (No Foreign Keys)

| Table | Purpose |
|-------|---------|
| `password_reset_tokens` | Legacy password reset flow (email-indexed, no user FK) |
| `federated_nodes` | External federated network participants |
| `constraint_patterns` | Shared constraint library for the Evidence Operating System |
| `evidence_patterns` | Successful evidence structures for pattern matching |
| `workflow_steps` | Workflow step definitions (linked by `workflow_id` string, not FK) |

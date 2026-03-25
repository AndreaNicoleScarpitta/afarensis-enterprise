# Afarensis Enterprise v2.1 — Data Flow Diagrams

## Document Control

| Field | Value |
|-------|-------|
| Version | 2.1.0 |
| Date | 2026-03-24 |
| Format | Mermaid (render with any Mermaid-compatible viewer) |

---

## 1. End-to-End System Data Flow

```mermaid
flowchart TD
    A[User Browser] -->|POST /auth/login| B[Auth Module]
    B -->|JWT access_token + refresh_token| A
    A -->|POST /projects| C[ProjectService]
    C -->|INSERT Project| D[(projects table)]
    A -->|PUT /projects/:id/study/definition| E[Study Workflow]
    E -->|UPDATE processing_config.study_definition| D
    A -->|POST /projects/:id/discover-evidence| F[TaskQueue]
    F -->|Background worker| G[ExternalAPIService]
    G -->|E-Utils API| H[PubMed]
    G -->|v2 API| I[ClinicalTrials.gov]
    G -->|REST API| J[OpenAlex]
    G -->|Graph API| K[Semantic Scholar]
    G -->|INSERT EvidenceRecord| L[(evidence_records table)]
    A -->|POST /projects/:id/study/balance/compute| M[StatisticalAnalysisService]
    M -->|compute_propensity_scores + compute_iptw + compute_smd| N[processing_config.balance]
    A -->|GET /projects/:id/study/results/forest-plot| O[routes.py]
    O -->|run_full_analysis| M
    M -->|Cox PH + KM + E-value + subgroup analyses| P[processing_config.results]
    O -->|Forest Plot JSON| A
    A -->|POST /projects/:id/study/regulatory/generate| Q[DocumentGenerator]
    Q -->|READ processing_config.results + evidence_records| P
    Q -->|generate_sar_html / generate_sar_docx| R[(regulatory_artifacts table)]
    R -->|GET .../regulatory/download/:artifact_id| A
    A -->|POST /submission/ectd/generate| S[ECTDPackager]
    S -->|generate_package| T[eCTD Module 5 Package]
    A -->|POST /projects/:id/adam/generate/adsl| U[AdamService]
    U -->|create_adsl / create_adae / create_adtte| V[(adam_datasets table)]
    A -->|POST /projects/:id/ingestion/upload| W[IngestionService]
    W -->|run_all_checks 8 regulatory checks| X[IngestionReport]
    X -->|CLEARED| Y[(patient_datasets table)]
    X -->|BLOCKED| Z[(patient_datasets quarantined)]
    A -->|POST /projects/:id/study/analyze-dataset| AA[PreAnalysisValidator + StatisticalAnalysisService]
    AA -->|6-phase validation + full analysis| AB[(analysis_results table)]
    AB -->|UPDATE processing_config| D
```

---

## 2. Authentication Flow

```mermaid
sequenceDiagram
    participant Browser
    participant API as routes.py /auth/*
    participant DB as users table
    participant ST as session_tokens table
    participant EVT as email_verification_tokens table
    participant Email as EmailService

    Note over Browser,Email: Login Flow
    Browser->>API: POST /auth/login {email, password}
    API->>DB: SELECT User WHERE email = ?
    API->>API: verify_password(password, hashed_password)
    API->>API: check email_verified == True
    API->>API: create_access_token(sub, email, role, org_id, permissions)
    API->>API: create_refresh_token(sub, email, role, org_id, jti)
    API-->>Browser: {access_token, refresh_token, user}

    Note over Browser,Email: Refresh Token Rotation
    Browser->>API: POST /auth/refresh {refresh_token}
    API->>API: verify_token(refresh_token) -> payload
    API->>ST: SELECT SessionToken WHERE token_hash = SHA256(jti)
    alt Token found and is_revoked == True
        API->>ST: UPDATE SET is_revoked=True WHERE user_id=? AND token_type='refresh'
        API-->>Browser: 401 "Refresh token reuse detected. All sessions revoked."
    else Token valid
        API->>ST: UPDATE existing SET is_revoked = True
        API->>API: create_access_token(new) + create_refresh_token(new)
        API->>ST: INSERT new SessionToken(token_hash=SHA256(new_jti), is_revoked=False)
        API-->>Browser: {access_token, refresh_token}
    end

    Note over Browser,Email: Password Reset Flow
    Browser->>API: POST /auth/forgot-password {email}
    API->>DB: SELECT User WHERE email = ?
    API->>ST: DELETE SessionToken WHERE user_id=? AND token_type='reset'
    API->>ST: INSERT SessionToken(token_type='reset', code_hash=SHA256(6-digit-code), token_hash=SHA256(token))
    API->>Email: send_password_reset_code(email, 6-digit code)
    API-->>Browser: {message: "If account exists, code sent"}

    Browser->>API: POST /auth/verify-reset-code {email, code}
    API->>DB: SELECT User WHERE email = ?
    API->>ST: SELECT SessionToken WHERE user_id=? AND token_type='reset' AND is_revoked=False
    API->>API: verify code_hash == SHA256(code)
    API->>ST: UPDATE token_hash = SHA256(new_token), code_hash = 'verified'
    API-->>Browser: {reset_token: new_token}

    Browser->>API: POST /auth/reset-password {email, reset_token, new_password}
    API->>API: verify_password_strength(new_password)
    API->>ST: SELECT SessionToken WHERE token_hash=SHA256(reset_token) AND code_hash='verified'
    API->>DB: UPDATE User SET hashed_password = hash(new_password)
    API->>ST: UPDATE SET is_revoked=True (reset token + all refresh tokens)
    API-->>Browser: {message: "Password reset successfully"}

    Note over Browser,Email: Email Verification Flow
    Browser->>API: POST /auth/register {email, password, full_name, organization_name}
    API->>API: verify_password_strength + validate email format
    API->>DB: INSERT User(email_verified=False, role=ANALYST)
    API->>EVT: INSERT EmailVerificationToken(token_hash=SHA256(token))
    API->>Email: send_verification_email(verification_url with token)
    API-->>Browser: {message: "Check email", user_id}

    Browser->>API: POST /auth/verify-email {email, token}
    API->>EVT: SELECT WHERE user_id=? AND token_hash=SHA256(token) AND used=False
    API->>EVT: UPDATE SET used = True
    API->>DB: UPDATE User SET email_verified = True
    API-->>Browser: {message: "Email verified"}
```

---

## 3. Evidence Discovery Flow

```mermaid
sequenceDiagram
    participant Browser
    participant API as routes.py
    participant TQ as TaskQueue
    participant Worker as Background Worker
    participant ExtAPI as ExternalAPIService
    participant SS as SemanticScholarService
    participant DB as evidence_records table

    Browser->>API: POST /projects/:id/discover-evidence?max_pubmed_results=50&max_trials_results=50
    API->>API: get_project_with_org_check(project_id)
    API->>API: search_query = project.research_intent || project.title
    API->>TQ: enqueue(_discover_evidence, task_type="evidence_discovery")
    API-->>Browser: 202 {task_id, message: "Evidence discovery started"}

    Note over TQ,DB: Background execution
    TQ->>Worker: execute _discover_evidence(task_status)

    Worker->>Worker: task_status.progress = 25%, "Searching PubMed..."
    Worker->>ExtAPI: search_pubmed(query, max_results)
    ExtAPI-->>Worker: pubmed_results[]
    loop Each PubMed result
        Worker->>DB: SELECT WHERE project_id=? AND source_type=PUBMED AND source_id=pmid
        alt Not duplicate
            Worker->>DB: INSERT EvidenceRecord(source_type=PUBMED, source_id=pmid, retrieval_rank)
        end
    end

    Worker->>Worker: task_status.progress = 45%, "Searching ClinicalTrials.gov..."
    Worker->>ExtAPI: search_clinical_trials(condition=query, max_results)
    ExtAPI-->>Worker: ct_results[]
    loop Each CT.gov result
        Worker->>DB: SELECT WHERE project_id=? AND source_type=CLINICALTRIALS AND source_id=nct_id
        alt Not duplicate
            Worker->>DB: INSERT EvidenceRecord(source_type=CLINICALTRIALS, source_id=nct_id)
        end
    end

    Worker->>Worker: task_status.progress = 65%, "Searching OpenAlex..."
    Worker->>ExtAPI: search_openalex(query, max_results)
    ExtAPI-->>Worker: openalex_results[]
    loop Each OpenAlex result
        Worker->>DB: SELECT WHERE project_id=? AND source_id='openalex_'+oa_id
        alt Not duplicate
            Worker->>DB: INSERT EvidenceRecord(source_id='openalex_'+oa_id)
        end
    end

    Worker->>Worker: task_status.progress = 80%, "Searching Semantic Scholar..."
    Worker->>Worker: sleep(3s) — rate-limit guard
    Worker->>SS: search_papers(query, limit=min(max,10))
    SS-->>Worker: {papers: [...]}
    loop Each SS result
        Worker->>DB: SELECT WHERE project_id=? AND source_id='ss_'+paperId
        alt Not duplicate
            Worker->>DB: INSERT EvidenceRecord(source_id='ss_'+paperId, structured_data={citation_count, influential_citation_count})
        end
    end
    Worker->>SS: close()

    Worker->>Worker: task_status.progress = 90%, "Saving results..."
    Worker->>DB: COMMIT
    Worker-->>TQ: {records_created, sources: [pubmed, clinicaltrials, openalex, semantic_scholar]}

    Browser->>API: GET /tasks/:task_id
    API->>TQ: get_status(task_id)
    API-->>Browser: {state, progress, message, result}
```

---

## 4. Statistical Analysis Pipeline

```mermaid
flowchart TD
    subgraph Input
        A[Patient Dataset<br/>patient_datasets.data_content] -->|column_mapping| B[PreAnalysisValidator]
        A2[Simulated Data<br/>StatisticalAnalysisService.generate_simulation_data] -->|if no real data| C
    end

    subgraph Validation ["Pre-Analysis Validation (6 Phases)"]
        B -->|Phase 1| B1[Schema Check<br/>USUBJID, ARM, TIME, EVENT required]
        B1 -->|Phase 2| B2[Data Quality<br/>missingness, duplicates, ranges]
        B2 -->|Phase 3| B3[Treatment Arm Validation<br/>min 2 arms, balance check]
        B3 -->|Phase 4| B4[Event Rate Check<br/>min events for convergence]
        B4 -->|Phase 5| B5[Covariate Assessment<br/>collinearity, variance]
        B5 -->|Phase 6| B6[Regulatory Compliance<br/>audit trail, consent check]
        B6 -->|PASS / BLOCKED| B7{Verdict}
        B7 -->|BLOCKED| B8[(validation_records<br/>verdict=BLOCKED)]
        B7 -->|PASS| B9[(validation_records<br/>verdict=PASS)]
    end

    B9 --> C

    subgraph Analysis ["StatisticalAnalysisService.run_full_analysis()"]
        C[Data Preparation] -->|generate_simulation_data| D[Propensity Score Estimation<br/>compute_propensity_scores<br/>Logistic Regression]
        D -->|PS vector| E[IPTW Computation<br/>compute_iptw<br/>Trimming at 1st/99th percentile]
        E -->|weights| F[Covariate Balance<br/>compute_standardized_mean_difference<br/>SMD threshold < 0.1]
        F --> G[Primary Analysis<br/>Cox Proportional Hazards<br/>IPTW-weighted]
        G --> H[Kaplan-Meier Estimation<br/>compute_kaplan_meier<br/>Survival curves by arm]
        G --> I[E-value Sensitivity<br/>compute_e_value<br/>Unmeasured confounding bound]
    end

    subgraph Sensitivity ["Sensitivity Analyses"]
        G --> J[Unweighted Cox PH]
        G --> K[Trimmed PS Cox PH<br/>Exclude extreme PS]
        G --> L[Stratified Analysis<br/>PS quintile strata]
        G --> M2[Meta-Analysis<br/>compute_meta_analysis<br/>Random-effects DerSimonian-Laird]
    end

    subgraph Subgroup ["Subgroup Analyses"]
        G --> N[Age Subgroups<br/>age < 65 vs >= 65]
        G --> O[Sex Subgroups<br/>Male vs Female]
        G --> P[Severity Subgroups<br/>Mild vs Severe]
    end

    subgraph Output
        G --> Q[Forest Plot Assembly<br/>Primary + Sensitivity + Subgroups]
        Q --> R[processing_config.results.forest_plot]
        H --> R
        I --> R
        J --> R
        K --> R
        L --> R
        M2 --> R
        N --> R
        O --> R
        P --> R
        R --> S[(analysis_results table<br/>dataset_hash, random_seed,<br/>engine_versions, convergence_info)]
    end
```

---

## 5. Patient Data Ingestion Flow

```mermaid
sequenceDiagram
    participant Browser
    participant API as routes.py
    participant Svc as IngestionService
    participant DB as Database

    Note over Browser,DB: Step 1 — Consent Attestation
    Browser->>API: GET /ingestion/attestation
    API-->>Browser: {attestation_text: HIPAA-SH-v1.2, requires_confirmation: true}
    Browser->>API: POST /projects/:id/ingestion/consent
    API->>Svc: generate_attestation_hash(text, user_id, timestamp)
    API->>DB: INSERT ConsentLog(attestation_hash, consent_version='HIPAA-SH-v1.2', status='confirmed')
    API-->>Browser: {consent_id, attestation_hash, status: "confirmed"}

    Note over Browser,DB: Step 2 — File Upload & Validation
    Browser->>API: POST /projects/:id/ingestion/upload (multipart/form-data)
    API->>DB: SELECT consent_logs WHERE project_id=? AND user_id=? AND status='confirmed'
    alt No consent on file
        API-->>Browser: 400 "No consent on file"
    end
    API->>API: Validate file extension (.csv, .xlsx, .xpt, .sas7bdat)
    API->>API: Validate file size <= 100MB

    Note over API,Svc: Magic Byte Validation
    API->>Svc: parse_file(file_content, filename)
    Svc-->>API: (DataFrame, parse_warnings, parse_error)
    API->>Svc: generate_file_hash(file_content) -> SHA-256

    Note over API,Svc: 8 Regulatory Checks
    API->>Svc: run_all_checks(DataFrame, parse_warnings)
    Note right of Svc: Check 1: Required Variables (USUBJID, ARM)
    Note right of Svc: Check 2: Unique Subject IDs
    Note right of Svc: Check 3: Treatment Arm Validity
    Note right of Svc: Check 4: Missingness Assessment
    Note right of Svc: Check 5: Data Type Validation
    Note right of Svc: Check 6: Value Range Checks
    Note right of Svc: Check 7: Temporal Consistency
    Note right of Svc: Check 8: Regulatory Format Compliance
    Svc-->>API: {compliance_status, findings[], critical_count, major_count, warning_count, dataset_summary}

    API->>Svc: generate_row_hashes(DataFrame) -> SHA-256 per row

    Note over API,DB: Step 3 — Storage Decision
    API->>DB: INSERT IngestionReport(compliance_status, findings, file_hash)
    alt compliance_status == CLEARED or CLEARED_WITH_WARNINGS
        API->>DB: INSERT PatientDataset(status='active', data_content, row_hashes)
    else compliance_status == BLOCKED
        API->>DB: INSERT PatientDataset(status='quarantined', data_content=NULL)
    end
    API->>DB: INSERT AuditLog(action='upload_patient_data', regulatory_significance=True)
    API-->>Browser: {report_id, dataset_id, compliance_status, findings, next_step}
```

---

## 6. Regulatory Document Generation Flow

```mermaid
flowchart TD
    subgraph Inputs ["Data Sources"]
        A[processing_config.study_definition]
        B[processing_config.results<br/>primary_hr, ci, p_value, sensitivity]
        C[processing_config.balance<br/>propensity_summary, smd_data]
        D[processing_config.bias<br/>e_value]
        E[(evidence_records table)]
        F[(parsed_specifications table)]
    end

    subgraph SAR ["SAR Generation"]
        A & B & C & D & E --> G[DocumentGenerator.generate_sar_html<br/>or generate_sar_docx]
        G -->|HTML or DOCX bytes| H[DocumentGenerator.save_artifact]
        H -->|file_path, file_size, checksum| I[(regulatory_artifacts table<br/>artifact_type='safety_assessment_report')]
    end

    subgraph eCTD ["eCTD Packaging"]
        I --> J[ECTDPackager.generate_package]
        J --> J1[Module 1: Regional Admin]
        J --> J2[Module 2: Summaries]
        J --> J3[Module 3: Quality]
        J --> J4[Module 4: Nonclinical]
        J --> J5[Module 5: Clinical Study Reports]
        J1 & J2 & J3 & J4 & J5 --> K[eCTD Package with manifest]
        K --> L[ECTDPackager.validate_package]
    end

    subgraph DefineXML ["Define-XML Generation"]
        M[(adam_datasets table)] --> N[DefineXMLGenerator.generate]
        N --> O[Define-XML 2.1 document<br/>Variable metadata, ValueLists, CodeLists]
        O --> P[DefineXMLGenerator.validate_define_xml]
    end

    subgraph ADRG ["ADRG Generation"]
        A & F --> Q[ADRGGenerator.generate_adrg_docx]
        Q --> R[DOCX document]
        R --> S[DocumentGenerator.save_artifact]
        S --> T[(regulatory_artifacts table<br/>artifact_type='adrg')]
    end

    subgraph CSR ["CSR Generation"]
        A & B & E --> U[CSRGenerator]
        U --> U1[generate_synopsis_docx]
        U --> U2[generate_section_11_docx<br/>Efficacy Evaluation]
        U --> U3[generate_section_12_docx<br/>Safety Evaluation]
        U --> U4[generate_appendix_16_docx<br/>Subject Narratives]
        U --> U5[generate_full_csr_docx<br/>All sections combined]
        U1 & U2 & U3 & U4 & U5 --> V[(regulatory_artifacts table<br/>artifact_type='csr_*')]
    end

    subgraph Download
        I & T & V --> W[GET /projects/:id/study/regulatory/download/:artifact_id]
        W -->|StreamingResponse or FileResponse| X[Browser Download]
    end
```

---

## 7. ADaM Dataset Generation Flow

```mermaid
sequenceDiagram
    participant Browser
    participant API as routes.py
    participant Adam as AdamService
    participant DB as Database

    Note over Browser,DB: ADSL Generation
    Browser->>API: POST /projects/:id/adam/generate/adsl
    API->>Adam: create_adsl(db, project_id)
    Adam->>DB: SELECT patient_datasets WHERE project_id=? AND status='active'
    Adam->>Adam: Map source columns -> ADSL variables<br/>(STUDYID, USUBJID, SUBJID, SITEID, ARM,<br/>TRT01P, TRT01A, ITTFL, SAFFL, AGE, SEX, RACE)
    Adam-->>API: {dataset_name: "ADSL", variables[], data[], records_count}
    API->>DB: INSERT AdamDataset(dataset_name='ADSL', validation_status='pending')
    API-->>Browser: {id, dataset_name, records_count, variables_count}

    Note over Browser,DB: ADAE Generation
    Browser->>API: POST /projects/:id/adam/generate/adae
    API->>Adam: create_adae(db, project_id)
    Adam->>Adam: Map source -> ADAE variables<br/>(AESEQ, AEBODSYS, AEDECOD, AESEV, TRTEMFL,<br/>ASTDT, AENDT, AEDUR)
    Adam-->>API: {dataset_name: "ADAE", variables[], data[]}
    API->>DB: INSERT AdamDataset(dataset_name='ADAE')
    API-->>Browser: {id, dataset_name, records_count}

    Note over Browser,DB: ADTTE Generation
    Browser->>API: POST /projects/:id/adam/generate/adtte
    API->>Adam: create_adtte(db, project_id)
    Adam->>Adam: Map source -> ADTTE variables<br/>(PARAMCD, PARAM, AVAL, CNSR, STARTDT, ADT,<br/>EVNTDESC, SRCDOM, SRCVAR)
    Adam-->>API: {dataset_name: "ADTTE", variables[], data[]}
    API->>DB: INSERT AdamDataset(dataset_name='ADTTE')
    API-->>Browser: {id, dataset_name, records_count}

    Note over Browser,DB: Validation
    Browser->>API: POST /projects/:id/adam/validate
    API->>DB: SELECT * FROM adam_datasets WHERE project_id=?
    loop Each AdamDataset
        API->>Adam: validate_adam({dataset_name, variables, data})
        Adam->>Adam: Check required variables per domain<br/>Check data types, value ranges, referential integrity
        Adam-->>API: {valid: true/false, findings[], warnings[]}
        API->>DB: UPDATE AdamDataset SET validation_status='valid'/'invalid', validation_report=?
    end
    API-->>Browser: {datasets_validated, reports[]}

    Note over Browser,DB: Metadata Export (Define-XML style)
    Browser->>API: GET /projects/:id/adam/metadata
    API->>DB: SELECT * FROM adam_datasets WHERE project_id=?
    loop Each AdamDataset
        API->>Adam: export_adam_metadata({dataset_name, label, structure, variables})
        Adam-->>API: {OID, Name, Label, Structure, ItemDefs[]}
    end
    API-->>Browser: {datasets: [metadata...], total_datasets}
```

---

## 8. Collaborative Review Flow

```mermaid
sequenceDiagram
    participant Admin
    participant API as routes.py /review/*
    participant CRS as CollaborativeReviewService
    participant DB as Database

    Note over Admin,DB: Workflow Creation
    Admin->>API: POST /review/workflows {project_id, evidence_ids}
    API->>CRS: create_review_workflow(project_id, evidence_ids, workflow_config)
    CRS->>DB: INSERT WorkflowStep(step_type='initial_review', step_order=1, status='pending')
    CRS->>DB: INSERT WorkflowStep(step_type='peer_review', step_order=2, status='pending')
    CRS->>DB: INSERT WorkflowStep(step_type='senior_review', step_order=3, status='pending')
    CRS-->>API: workflow_id
    API-->>Admin: {workflow_id, status: "created"}

    Note over Admin,DB: Reviewer Assignment
    Admin->>API: POST /review/assignments {evidence_id, reviewer_id}
    API->>CRS: assign_reviewer(evidence_id, reviewer_id, role='reviewer', weight=1.0)
    CRS->>DB: INSERT ReviewAssignment(status='pending', workflow_id)
    CRS-->>API: assignment_id
    API-->>Admin: {assignment_id, status: "assigned"}

    Note over Admin,DB: Comment Threading
    participant Reviewer
    Reviewer->>API: POST /review/comments {evidence_id, content, comment_type}
    API->>CRS: add_comment(evidence_id, content, comment_type, parent_comment_id=null)
    CRS->>DB: INSERT ReviewComment(author_id, comment_type, mentions[])
    API-->>Reviewer: {comment_id}

    Reviewer->>API: POST /review/comments {evidence_id, content, parent_comment_id=above}
    API->>CRS: add_comment(..., parent_comment_id)
    CRS->>DB: INSERT ReviewComment(parent_comment_id -> self-referencing FK)
    API-->>Reviewer: {comment_id} (threaded reply)

    Note over Admin,DB: Decision Submission
    Reviewer->>API: POST /review/decisions {evidence_id, decision, confidence_level, rationale}
    API->>CRS: submit_decision(evidence_id, decision, confidence, rationale)
    CRS->>DB: INSERT ReviewDecision(decision=ACCEPTED/REJECTED/DEFERRED, confidence_level)
    API-->>Reviewer: {decision_id}

    Note over Admin,DB: Conflict Resolution
    Admin->>API: POST /review/conflicts/resolve {evidence_id, resolution, rationale}
    API->>CRS: resolve_conflict(evidence_id, resolution, rationale)
    CRS->>DB: UPDATE ReviewAssignment SET status='completed'
    CRS->>DB: INSERT AuditLog(action='conflict_resolved', regulatory_significance=True)
    API-->>Admin: {status: "resolved"}

    Note over Admin,DB: Real-Time Presence
    Reviewer->>API: POST /review/presence/:evidence_id {activity, cursor_position}
    API->>DB: UPSERT UserPresence(user_id, resource_type='evidence', activity, last_seen, cursor_position)
    Reviewer->>API: GET /review/presence/:evidence_id
    API->>DB: SELECT UserPresence WHERE resource_id=? AND last_seen > (now - 5min)
    API-->>Reviewer: {active_users: [{user_id, activity, cursor_position}]}
```

---

## 9. 10-Step Study Workflow

The study workflow stores all state in `projects.processing_config` (a JSON column). Each step reads from and writes to specific keys within this JSON document.

```mermaid
flowchart TD
    subgraph Step1 ["Step 1: Study Definition"]
        S1_IN[User Input] -->|PUT /study/definition| S1[Save study_definition]
        S1 -->|WRITES| S1_OUT[processing_config.study_definition<br/><i>protocol, indication, primary_endpoint,<br/>secondary_endpoints, statistical_method, estimand</i>]
    end

    subgraph Step2 ["Step 2: Protocol Lock"]
        S1_OUT -->|READS study_definition| S2[PUT /study/lock]
        S2 -->|WRITES| S2_OUT[processing_config.protocol_locked = true<br/>processing_config.protocol_locked_at<br/>processing_config.protocol_locked_by]
        S2 -->|INSERT| S2_AUD[(audit_logs: protocol_locked)]
    end

    subgraph Step3 ["Step 3: Covariates"]
        S2_OUT -->|READS protocol_locked| S3[PUT /study/covariates]
        S3 -->|WRITES| S3_OUT[processing_config.covariates<br/><i>covariate names, types, categories</i>]
    end

    subgraph Step4 ["Step 4: Data Sources"]
        S3_OUT --> S4[PUT /study/data-sources]
        S4 -->|WRITES| S4_OUT[processing_config.data_sources<br/><i>source databases, registries, RWD feeds</i>]
    end

    subgraph Step5 ["Step 5: Cohort Definition"]
        S3_OUT & S4_OUT --> S5[PUT /study/cohort]
        S5 -->|WRITES| S5_OUT[processing_config.cohort<br/><i>inclusion_criteria, exclusion_criteria,<br/>index_date_definition, washout_period</i>]
    end

    subgraph Step6 ["Step 6: Cohort Run"]
        S5_OUT -->|READS cohort + data_sources| S6[POST /study/cohort/run]
        S6 -->|WRITES| S6_OUT[processing_config.cohort_result<br/><i>total_screened, total_eligible,<br/>by_arm counts, attrition_table</i>]
    end

    subgraph Step7 ["Step 7: Balance Computation"]
        S3_OUT & S6_OUT -->|READS covariates + cohort_result| S7[POST /study/balance/compute]
        S7 -->|StatisticalAnalysisService| S7_PS[compute_propensity_scores]
        S7_PS --> S7_IPTW[compute_iptw]
        S7_IPTW --> S7_SMD[compute_standardized_mean_difference]
        S7_SMD -->|WRITES| S7_OUT[processing_config.balance<br/><i>smd_data[], propensity_summary{<br/>c_statistic, mean_ps_treated,<br/>mean_ps_control, n_trimmed}</i>]
    end

    subgraph Step8 ["Step 8: Results / Forest Plot"]
        S7_OUT -->|READS balance| S8[GET /study/results/forest-plot]
        S8 -->|run_full_analysis| S8_ANA[Cox PH + KM + E-value + Subgroups]
        S8_ANA -->|WRITES| S8_OUT[processing_config.results<br/><i>forest_plot[], primary_hr,<br/>ci_lower, ci_upper, p_value,<br/>sensitivity[], subgroup[]</i>]
    end

    subgraph Step9 ["Step 9: Bias Assessment"]
        S8_OUT -->|READS results| S9[POST /study/bias/run or GET /study/bias]
        S9 -->|WRITES| S9_OUT[processing_config.bias<br/><i>e_value{point, ci_lower},<br/>bias_domains[], risk_of_bias,<br/>interpretation</i>]
    end

    subgraph Step10 ["Step 10: Regulatory Generation"]
        S1_OUT & S7_OUT & S8_OUT & S9_OUT -->|READS all sections| S10[POST /study/regulatory/generate]
        S10 -->|DocumentGenerator| S10_DOC[SAR HTML/DOCX]
        S10_DOC -->|INSERT| S10_OUT[(regulatory_artifacts table)]
        S10_OUT -->|GET .../download/:id| S10_DL[Browser Download]
    end

    subgraph Reproducibility ["Reproducibility & Audit"]
        S8_OUT -->|GET /study/reproducibility| REPRO[processing_config.reproducibility<br/><i>random_seed, software_version, lock_hash</i>]
        S2_AUD --> AUDIT[GET /study/audit<br/>Full audit trail from audit_logs]
    end

    style Step1 fill:#e1f5fe
    style Step2 fill:#e1f5fe
    style Step3 fill:#e8f5e9
    style Step4 fill:#e8f5e9
    style Step5 fill:#e8f5e9
    style Step6 fill:#fff3e0
    style Step7 fill:#fff3e0
    style Step8 fill:#fce4ec
    style Step9 fill:#fce4ec
    style Step10 fill:#f3e5f5
```

### processing_config Key Reference

| Step | Endpoint | Key Written | Key(s) Read |
|------|----------|-------------|-------------|
| 1 | `PUT /study/definition` | `study_definition` | -- |
| 2 | `PUT /study/lock` | `protocol_locked`, `protocol_locked_at`, `protocol_locked_by` | `study_definition` |
| 3 | `PUT /study/covariates` | `covariates` | `protocol_locked` |
| 4 | `PUT /study/data-sources` | `data_sources` | -- |
| 5 | `PUT /study/cohort` | `cohort` | `covariates`, `data_sources` |
| 6 | `POST /study/cohort/run` | `cohort_result` | `cohort`, `data_sources` |
| 7 | `POST /study/balance/compute` | `balance` | `covariates` |
| 8 | `GET /study/results/forest-plot` | `results` | `balance` |
| 9 | `POST /study/bias/run` | `bias` | `results` |
| 10 | `POST /study/regulatory/generate` | *(regulatory_artifacts table)* | `study_definition`, `covariates`, `cohort`, `balance`, `results`, `bias` |

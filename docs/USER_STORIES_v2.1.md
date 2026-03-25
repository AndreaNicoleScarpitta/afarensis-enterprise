# Afarensis Enterprise v2.1 — User Stories & Acceptance Criteria

## Document Control
| Field | Value |
|-------|-------|
| Version | 2.1.0 |
| Date | 2026-03-24 |
| Coverage | Complete application surface |
| Format | User Story + Gherkin Acceptance Criteria |
| Endpoints Covered | 146+ API endpoints |
| Pages Covered | 20+ frontend pages |

---

## 1. Authentication & Account Management

**US-001**: As a new user, I want to register with my email, name, password, and organization name so that I can create my own workspace.

```gherkin
Given I am on the login page and click "Create account"
When I submit my full name, email, password, and organization name via the registration form
Then a new Organization is created, my account is assigned the "admin" role within it, a verification email is sent, and I see the "Check your inbox" confirmation view
```

**US-002**: As a registered user, I want to verify my email address so that I can activate my account.

```gherkin
Given I received a verification email with a unique token link
When I click the verification link and the /auth/verify-email endpoint processes my token
Then my account's email_verified flag is set to true, I see the "Email verified" success page with a "Go to sign in" button
```

**US-003**: As a registered user, I want to resend the verification email so that I can complete activation if the original expired.

```gherkin
Given I am on the verification-pending view and my email is not yet verified
When I click "Resend verification email" and the POST /auth/resend-verification request succeeds
Then a new verification token is generated and emailed to me, and a confirmation toast is displayed
```

**US-004**: As a registered user, I want to log in with my email and password so that I can access my projects.

```gherkin
Given I have a verified, active account
When I submit valid email and password on the login form and POST /auth/login returns 200
Then I receive JWT access_token and refresh_token, my user profile (id, email, full_name, role, organization_id) is stored in context, and I am redirected to the dashboard
```

**US-005**: As a logged-in user, I want my session to persist via token refresh so that I am not logged out unexpectedly.

```gherkin
Given my access token is about to expire and I hold a valid refresh_token
When the frontend interceptor calls POST /auth/refresh with my refresh_token
Then a new access_token is returned, the Authorization header is updated transparently, and my session continues without interruption
```

**US-006**: As a logged-in user, I want to log out so that my session is terminated.

```gherkin
Given I am authenticated and viewing any page
When I click the "Logout" button in the sidebar footer and POST /auth/logout is called
Then my JWT tokens are removed from local storage, I am redirected to the login page, and subsequent API calls return 401
```

**US-007**: As a logged-in user, I want to revoke all my sessions so that no other device remains authenticated.

```gherkin
Given I am authenticated and suspect unauthorized access on another device
When I trigger POST /auth/revoke-all-sessions
Then all session_tokens rows for my user_id are marked is_revoked=true, a count of revoked sessions is returned, and all other devices are logged out
```

**US-008**: As a user who forgot my password, I want to request a password reset so that I can regain access to my account.

```gherkin
Given I am on the login page and click "Forgot password?"
When I enter my email and submit the forgot-password form (POST /auth/forgot-password, rate-limited to 3/5min)
Then a 6-digit verification code is emailed to me (or logged in dev mode), and I am shown the code-entry view regardless of whether the email exists (preventing enumeration)
```

**US-009**: As a user resetting my password, I want to verify the 6-digit code so that I can proceed to set a new password.

```gherkin
Given I received a 6-digit reset code via email and am on the code-entry view
When I enter the correct code and submit (POST /auth/verify-reset-code)
Then the code_hash is marked "verified", a fresh reset_token is returned, and I am advanced to the new-password form
```

**US-010**: As a user resetting my password, I want to set a new password so that I can log in again.

```gherkin
Given I have a verified reset_token and am on the reset-password form
When I enter a new password meeting strength requirements (8+ chars, uppercase, lowercase, digit, special char), confirm it, and submit (POST /auth/reset-password)
Then my hashed_password is updated, the reset token is revoked, and I see the "Password reset successful" view with a "Back to sign in" link
```

**US-011**: As a user, I want to view my profile information so that I can confirm my account details.

```gherkin
Given I am authenticated
When I navigate to my profile or the frontend calls GET /auth/me
Then I see my id, email, fullName, role, organizationId, and organizationName in camelCase format
```

**US-012**: As the system, I want to enforce role-based access control so that users only access permitted resources.

```gherkin
Given a user with role "viewer" attempts to call an admin-only endpoint (e.g., POST /org/users/invite)
When the require_role("admin") dependency checks the JWT role claim
Then the API returns HTTP 403 "Only admins can invite users" and the request is blocked
```

---

## 2. Project Management

**US-013**: As an analyst, I want to create a new evidence review project so that I can organize my RWE study.

```gherkin
Given I am authenticated and on the dashboard
When I click "New Project", fill in a title, description, and optional research intent, and submit (POST /projects)
Then a new Project is created with status "draft", an audit log entry "project_created" is recorded, the project list cache is invalidated, and I am redirected to the project detail view
```

**US-014**: As an analyst, I want to list all projects in my organization so that I can find and manage existing studies.

```gherkin
Given I am authenticated and on the dashboard
When the frontend calls GET /projects with optional status filter and pagination parameters
Then I see a paginated list of projects (id, title, description, status, created_at) filtered to my organization_id, with total count and page metadata
```

**US-015**: As an analyst, I want to filter the project list by status so that I can find projects in a specific phase.

```gherkin
Given I am on the project list page and there are projects with statuses "draft", "in_progress", and "completed"
When I select "in_progress" from the status filter dropdown and the GET /projects?status=in_progress call is made
Then only projects with status "in_progress" are displayed in the list
```

**US-016**: As an analyst, I want to view detailed project information so that I can review its current state.

```gherkin
Given I am on the project list and a project exists
When I click on a project row and GET /projects/{project_id} is called
Then I see the project title, description, status, research_intent, evidence_count, review_decisions_count, parsed_specification (indication, population, endpoint, sample_size, follow_up_period), and timestamps
```

**US-017**: As an analyst, I want to upload a protocol document (PDF/DOCX/TXT) to a project so that the system can parse study specifications.

```gherkin
Given I am viewing a project detail page
When I select a PDF file (validated by magic bytes, max 100MB) and submit via POST /projects/{project_id}/upload
Then the file is uploaded, the project's source_filename is updated, and a success response with filename and status "uploaded" is returned
```

---

## 3. Study Definition

**US-018**: As an analyst, I want to define the study protocol (indication, population, endpoint, estimand, study design) so that the analysis framework is established.

```gherkin
Given I am on the Study Definition page (step 1) for a project
When I fill in the indication, population_definition, primary_endpoint, estimand, and study_design fields and click "Save" (PUT /projects/{project_id}/study/definition)
Then the study_definition section is saved in processing_config and a "saved" status is returned
```

**US-019**: As an analyst, I want to retrieve the saved study definition so that I can review or continue editing.

```gherkin
Given I navigate to the Study Definition page for a project that has a saved definition
When the frontend calls GET /projects/{project_id}/study/definition
Then the saved indication, population_definition, primary_endpoint, estimand, and study_design fields are populated in the form
```

**US-020**: As a regulatory lead, I want to lock the study protocol so that no further edits can be made before submission.

```gherkin
Given I am on the Study Definition page and all required fields are completed
When I click "Lock Protocol" and confirm (PUT /projects/{project_id}/study/lock)
Then protocol_locked is set to true in processing_config, protocol_locked_at and protocol_locked_by are recorded, an AuditLog entry with action "protocol_locked" and regulatory_significance=true is created, and all definition fields become read-only in the UI
```

**US-021**: As an analyst, I want to generate a Statistical Analysis Plan (SAP) so that I have a regulatory-ready analysis plan document.

```gherkin
Given I am on the Study Definition page with a completed protocol
When I click "Generate SAP" (POST /projects/{project_id}/study/sap/generate)
Then a SAP document is generated from the study definition, cohort, and covariates configuration, and is available for download
```

---

## 4. Causal Framework

**US-022**: As an analyst, I want to define covariates and their roles in a directed acyclic graph (DAG) so that confounders are properly identified.

```gherkin
Given I am on the Causal Framework page (step 2) for a project
When I add covariates with names and assigned roles (confounder, mediator, collider, instrumental variable) and click "Save" (PUT /projects/{project_id}/study/covariates)
Then the covariates section is saved in processing_config with the list of covariates and their role assignments
```

**US-023**: As an analyst, I want to retrieve saved covariates so that I can review the DAG structure.

```gherkin
Given I navigate to the Causal Framework page for a project with saved covariates
When the frontend calls GET /projects/{project_id}/study/covariates
Then the covariate names and their assigned roles are populated in the DAG editor
```

---

## 5. Data Provenance

**US-024**: As an analyst, I want to configure data sources (EHR databases, registries, claims) so that the system knows where patient data originates.

```gherkin
Given I am on the Data Provenance page (step 3) for a project
When I add one or more data sources with name, type, population_size, and quality_tier, then click "Save" (PUT /projects/{project_id}/study/data-sources)
Then the data_sources section is saved in processing_config with the sources list
```

**US-025**: As an analyst, I want to retrieve saved data source configurations so that I can review or update them.

```gherkin
Given I navigate to the Data Provenance page for a project with configured sources
When the frontend calls GET /projects/{project_id}/study/data-sources
Then each data source's name, type, population_size, and quality_tier is populated in the form
```

**US-026**: As an analyst, I want to view the HIPAA consent attestation text so that I understand compliance requirements before uploading data.

```gherkin
Given I am on the Data Provenance or Ingestion page
When the frontend calls GET /ingestion/attestation
Then the full HIPAA/IRB attestation text is displayed, including the mandatory consent statement and regulatory references
```

---

## 6. Data Ingestion

**US-027**: As an analyst, I want to provide HIPAA consent before uploading patient-level data so that regulatory compliance is documented.

```gherkin
Given I am on the data ingestion page for a project and have read the attestation
When I check the consent checkbox and submit (POST /projects/{project_id}/ingestion/consent) with consented=true, consenter_name, and IRB protocol number
Then a HIPAA consent record is created with timestamp, IP address, and user agent, an audit log entry is written, and the file upload form becomes enabled
```

**US-028**: As an analyst, I want to upload a patient-level dataset (CSV/SAS7BDAT/XPT) so that the system can analyze it.

```gherkin
Given I have provided HIPAA consent for the project
When I select a CSV file and submit via POST /projects/{project_id}/ingestion/upload with the file
Then the file is validated (size limit, format, encoding), parsed into a structured dataset, a compliance report is generated with column-level PHI detection, the dataset is stored, and a dataset_id with summary statistics is returned
```

**US-029**: As an analyst, I want to view ingestion compliance reports so that I can verify data quality and PHI handling.

```gherkin
Given datasets have been uploaded to a project
When I call GET /projects/{project_id}/ingestion/reports
Then I see a list of compliance reports with report_id, dataset name, upload timestamp, PHI columns detected, and compliance status
```

**US-030**: As an analyst, I want to view a specific compliance report so that I can review detailed findings.

```gherkin
Given a compliance report exists for an uploaded dataset
When I call GET /projects/{project_id}/ingestion/reports/{report_id}
Then I see the full report including column-level analysis, PHI detection results, data quality metrics, and recommended actions
```

**US-031**: As an analyst, I want to acknowledge a compliance report so that it is marked as reviewed.

```gherkin
Given I am viewing an unacknowledged compliance report
When I click "Acknowledge" (POST /projects/{project_id}/ingestion/reports/{report_id}/acknowledge)
Then the report is marked as acknowledged with my user_id and timestamp
```

**US-032**: As an analyst, I want to list all ingested datasets for a project so that I can manage them.

```gherkin
Given one or more datasets have been uploaded to a project
When I call GET /projects/{project_id}/ingestion/datasets
Then I see a list of datasets with dataset_id, filename, row_count, column_count, upload_date, and compliance status
```

**US-033**: As a data steward, I want to decide on data retention policy for a project so that regulatory retention requirements are met.

```gherkin
Given a project has ingested datasets and I am reviewing retention options
When I submit a retention decision via POST /projects/{project_id}/retention/decide with retention_years and justification
Then the retention policy is recorded, an audit log entry is created, and the datasets are flagged with the retention expiry date
```

---

## 7. Cohort Construction

**US-034**: As an analyst, I want to define inclusion and exclusion criteria so that the analytic cohort is properly specified.

```gherkin
Given I am on the Cohort Construction page (step 4) for a project
When I add inclusion criteria (e.g., "Age >= 18", "Diagnosed with condition X") and exclusion criteria (e.g., "Prior treatment with Y"), then click "Save" (PUT /projects/{project_id}/study/cohort)
Then the cohort section is saved in processing_config with the inclusion_criteria and exclusion_criteria arrays
```

**US-035**: As an analyst, I want to retrieve the saved cohort criteria so that I can review the current specifications.

```gherkin
Given I navigate to the Cohort Construction page for a project with saved criteria
When the frontend calls GET /projects/{project_id}/study/cohort
Then the inclusion and exclusion criteria are populated in the form along with any previous attrition funnel results
```

**US-036**: As an analyst, I want to run an attrition simulation so that I can visualize how each criterion reduces the study population.

```gherkin
Given I have defined inclusion and exclusion criteria and configured data sources
When I click "Run Attrition" (POST /projects/{project_id}/study/cohort/run)
Then the system simulates the attrition funnel starting from the initial population (summed from data source population_sizes), applies each criterion sequentially with realistic attrition rates, and returns a funnel array with step name, remaining n, criterion label, and type for each step, ending with the "Final analytic cohort"
```

---

## 8. Comparability & Balance

**US-037**: As an analyst, I want to view covariate balance data so that I can assess whether treatment groups are comparable.

```gherkin
Given covariates have been defined for the project
When I navigate to the Comparability & Balance page (step 5) and GET /projects/{project_id}/study/balance is called
Then I see a list of covariates with their smd_raw, smd_weighted values, and a pass/fail indicator (pass if |SMD_weighted| < 0.1) suitable for rendering a Love plot
```

**US-038**: As an analyst, I want to compute propensity scores and IPTW weights so that I can achieve covariate balance between groups.

```gherkin
Given covariates and cohort have been defined for the project
When I click "Compute Balance" (POST /projects/{project_id}/study/balance/compute) with selected method (e.g., "logistic", "gbm")
Then propensity scores are computed via the StatisticalAnalysisService, IPTW weights are derived, SMD before/after weighting is calculated for each covariate, an overlap assessment (AUC, c-statistic) is generated, and results are stored in processing_config["balance"]
```

**US-039**: As an analyst, I want to view comparability scores for evidence records so that I can assess study quality.

```gherkin
Given evidence records exist for a project
When I call GET /projects/{project_id}/comparability-scores
Then I receive a list of evidence records with their comparability_score, relevance_score, and quality_assessment ratings
```

---

## 9. Effect Estimation

**US-040**: As an analyst, I want to view the primary treatment effect estimate so that I can interpret the study result.

```gherkin
Given propensity score analysis has been completed for the project
When I navigate to the Effect Estimation page (step 6) and view the primary result panel
Then I see the treatment effect estimate (HR, OR, or RD), 95% confidence interval, p-value, and the estimand definition
```

**US-041**: As an analyst, I want to view a forest plot of subgroup analyses so that I can assess effect heterogeneity.

```gherkin
Given the primary analysis and subgroup definitions exist
When I call GET /projects/{project_id}/study/results/forest-plot
Then I receive forest plot data with subgroup labels, point estimates, confidence intervals, interaction p-values, and I-squared heterogeneity statistics for each subgroup
```

**US-042**: As an analyst, I want to run a full statistical analysis on an uploaded dataset so that I get comprehensive results.

```gherkin
Given a dataset has been uploaded and ingested for the project
When I click "Analyze Dataset" (POST /projects/{project_id}/study/analyze-dataset) with selected treatment, outcome, and covariate columns
Then the system runs propensity score estimation, IPTW weighting, outcome modeling, sensitivity analyses, and returns the complete analysis results including effect estimates, balance diagnostics, and validation metrics
```

**US-043**: As an analyst, I want to view the analysis results for a project so that I can review the statistical output.

```gherkin
Given an analysis has been completed for the project
When I call GET /projects/{project_id}/study/analysis-results
Then I see the effect estimate, confidence intervals, p-values, balance diagnostics, and sensitivity analysis results
```

**US-044**: As an analyst, I want to view the validation report so that I can verify statistical assumptions were met.

```gherkin
Given an analysis has been completed for the project
When I call GET /projects/{project_id}/study/validation-report
Then I see the positivity check results, overlap assessment, balance diagnostics pass/fail, and model specification tests
```

---

## 10. Bias & Sensitivity

**US-045**: As an analyst, I want to view bias analysis results (E-values, fragility index) so that I can assess the robustness of findings.

```gherkin
Given the primary analysis has been completed
When I navigate to the Bias & Sensitivity page (step 7) and GET /projects/{project_id}/study/bias is called
Then I see E-values (point estimate and CI bound), fragility index, quantitative bias analysis results, and unmeasured confounding sensitivity parameters
```

**US-046**: As an analyst, I want to run bias stress tests so that I can evaluate how findings hold under different assumptions.

```gherkin
Given the primary analysis exists with effect estimates
When I click "Run Stress Tests" (POST /projects/{project_id}/study/bias/run) specifying scenario parameters
Then the system runs unmeasured confounding simulations, tipping point analysis, and outcome misclassification scenarios, returning results for each stress test with a pass/fail determination
```

**US-047**: As an analyst, I want to request a bias analysis for a specific evidence record so that I can evaluate individual study quality.

```gherkin
Given an evidence record exists for the project
When I call POST /projects/{project_id}/analyze-bias with the evidence record ID
Then the system performs ROBINS-I assessment, calculates study-level bias indicators, and stores the results linked to the evidence record
```

**US-048**: As an analyst, I want to view detailed bias analysis results for a project so that I can review all bias assessments.

```gherkin
Given bias analyses have been performed for the project
When I call GET /projects/{project_id}/bias-analysis
Then I see all bias assessment results including ROBINS-I domains, overall risk-of-bias judgment, and direction-of-bias indicators
```

---

## 11. Missing Data

**US-049**: As an analyst, I want to run multiple imputation so that missing data is handled appropriately.

```gherkin
Given a dataset with missing values has been uploaded and analyzed
When I click "Run Multiple Imputation" (POST /projects/{project_id}/study/missing-data/impute) with imputation method (e.g., MICE) and number of imputations
Then the system generates multiple imputed datasets, pools the results using Rubin's rules, and returns the pooled estimate with appropriate variance
```

**US-050**: As an analyst, I want to run a tipping point analysis so that I can assess how missing data assumptions affect conclusions.

```gherkin
Given the primary analysis is complete and there are missing outcomes
When I click "Tipping Point Analysis" (POST /projects/{project_id}/study/missing-data/tipping) specifying a range of delta values
Then the system computes the treatment effect under each delta assumption, identifies the tipping point where significance is lost, and returns a tipping point plot dataset
```

**US-051**: As an analyst, I want to run MMRM analysis so that I can model repeated measures with missing data.

```gherkin
Given a longitudinal dataset with repeated measures exists for the project
When I click "Run MMRM" (POST /projects/{project_id}/study/missing-data/mmrm) with visit structure and covariance pattern
Then the system fits a mixed-model repeated measures model, returns parameter estimates with standard errors, and provides model fit statistics (AIC, BIC)
```

**US-052**: As an analyst, I want to view a missing data summary so that I understand the extent and pattern of missingness.

```gherkin
Given a dataset has been uploaded to the project
When I call GET /projects/{project_id}/study/missing-data/summary
Then I see the percentage missing per variable, missing data pattern (MCAR/MAR/MNAR assessment), and Little's MCAR test result
```

---

## 12. Reproducibility

**US-053**: As an analyst, I want to view the reproducibility manifest so that I can verify the analysis is fully traceable.

```gherkin
Given I am on the Reproducibility page (step 8) for a project
When the frontend calls GET /projects/{project_id}/study/reproducibility
Then I see the software versions, random seeds, data checksums, algorithm parameters, and execution timestamps that define the analysis environment
```

**US-054**: As an analyst, I want to save reproducibility configuration so that the analysis can be exactly replicated.

```gherkin
Given I am on the Reproducibility page and have reviewed the manifest
When I update reproducibility settings (random_seed, software_versions, notes) and click "Save" (PUT /projects/{project_id}/study/reproducibility)
Then the reproducibility section is saved in processing_config
```

**US-055**: As an analyst, I want to export a trace pack so that a complete reproducibility package is available for regulatory review.

```gherkin
Given I am on the Trace Pack Export page and a project has completed analysis
When I click "Export Trace Pack"
Then the system generates a ZIP file containing the reproducibility manifest, data checksums, analysis code, configuration files, and an HTML lineage report, and initiates a download
```

**US-056**: As an analyst, I want to explore analysis inputs so that I understand what data entered each analysis step.

```gherkin
Given I am on the Input Explorer page for a project
When I select an analysis step from the lineage graph
Then I see the input datasets, parameters, and transformations that were applied at that step, with links to upstream and downstream steps
```

**US-057**: As an analyst, I want to view the variable notebook so that I can trace each variable from source to analysis.

```gherkin
Given I am on the Variable Notebook page for a project
When I select a variable from the list
Then I see the variable's source column, transformations applied, derivation logic, and all analysis steps where it was used
```

---

## 13. Audit Trail

**US-058**: As a regulatory lead, I want to view the project audit trail so that I can demonstrate regulatory compliance.

```gherkin
Given I am on the Audit Trail page (step 9) for a project
When the frontend calls GET /projects/{project_id}/study/audit
Then I see a chronological list of audit events including action, user_id, timestamp, resource_type, resource_id, change_summary, and regulatory_significance flag
```

**US-059**: As an admin, I want to view global audit logs with filtering so that I can monitor system-wide activity.

```gherkin
Given I am on the Admin Audit Logs page
When I call GET /audit/logs with optional filters (user_id, action, date_range, resource_type) and pagination
Then I see a paginated list of audit events across all projects, with each entry showing timestamp, user, action, resource, and details
```

---

## 14. Regulatory Output

**US-060**: As a regulatory lead, I want to check submission readiness so that I know which requirements are still outstanding.

```gherkin
Given I am on the Regulatory Output page (step 10) for a project
When the frontend calls GET /projects/{project_id}/study/regulatory
Then I see a checklist of SAR sections (study_definition, causal_framework, data_provenance, cohort_construction, etc.) with completion status, the overall report_status (pending/draft/final), ICTRP compliance flag, and ICH E9(R1) compliance flag
```

**US-061**: As a regulatory lead, I want to generate a Study Assessment Report (SAR) so that I have a submission-ready document.

```gherkin
Given all SAR sections are marked complete on the regulatory checklist
When I click "Generate SAR" (POST /projects/{project_id}/study/regulatory/generate) selecting format (PDF/DOCX/HTML/eCTD) and sections to include
Then the system generates the SAR document with all selected sections, returns an artifact_id, and the document is available for download
```

**US-062**: As a regulatory lead, I want to download a generated regulatory artifact so that I can submit it to authorities.

```gherkin
Given a regulatory artifact has been generated for the project
When I click the download button (GET /projects/{project_id}/study/regulatory/download/{artifact_id})
Then the artifact file (PDF, DOCX, or ZIP) is downloaded to my local machine with the correct filename and content-type headers
```

**US-063**: As an analyst, I want to generate a generic regulatory artifact (SAR, eCTD, ADRG, CSR) from the project page so that I can produce submission materials at any time.

```gherkin
Given I am on a project detail page with evidence and analysis results
When I click "Generate Artifact" (POST /projects/{project_id}/generate-artifact) selecting artifact type and format
Then the DocumentGenerator or appropriate service creates the artifact, stores it with a unique artifact_id, records an audit log entry, and the artifact appears in the project's artifact list
```

**US-064**: As a user, I want to download any generated artifact by its ID so that I can access the file directly.

```gherkin
Given a regulatory artifact with a known artifact_id exists
When I call GET /artifacts/{artifact_id}/download
Then the file is served as a StreamingResponse with correct Content-Disposition and MIME type headers
```

**US-065**: As an analyst, I want to list all artifacts for a project so that I can track what has been generated.

```gherkin
Given artifacts have been generated for a project
When I call GET /projects/{project_id}/artifacts
Then I see a list of artifacts with artifact_id, type, format, generated_at, generated_by, and file_size
```

---

## 15. Literature Search & Evidence Discovery

**US-066**: As an analyst, I want to discover evidence from PubMed and ClinicalTrials.gov so that relevant literature is gathered.

```gherkin
Given I am on the Literature Search page and the project has a research intent
When I click "Discover Evidence" (POST /projects/{project_id}/discover-evidence with max_pubmed_results and max_trials_results)
Then a background task is enqueued (returns 202 with task_id), PubMed and ClinicalTrials.gov are searched, evidence records are created with source, title, abstract, relevance_score, and I can poll GET /tasks/{task_id} for progress
```

**US-067**: As an analyst, I want to view discovered evidence records for a project so that I can review the literature.

```gherkin
Given evidence discovery has completed for a project
When I call GET /projects/{project_id}/evidence with pagination
Then I see a paginated list of evidence records with id, title, abstract, source_type, relevance_score, quality_assessment, and processing_status
```

**US-068**: As an analyst, I want to perform a semantic search across evidence so that I find conceptually relevant papers.

```gherkin
Given evidence records exist in the system
When I submit a natural language query via POST /search/semantic with query text and optional filters
Then the system returns semantically ranked evidence records using embedding-based similarity, with relevance scores and highlighted matching passages
```

**US-069**: As an analyst, I want to perform a hybrid keyword+semantic search so that I get both exact matches and conceptual results.

```gherkin
Given evidence records exist in the system
When I submit a query via POST /search/hybrid with query text and weight parameters (keyword_weight, semantic_weight)
Then the system returns results combining BM25 keyword matching and embedding similarity, ranked by the weighted composite score
```

**US-070**: As an analyst, I want to save a search configuration so that I can re-run it later.

```gherkin
Given I have performed a search with specific parameters and filters
When I click "Save Search" (POST /search/save) with a name and the search configuration
Then the search is saved and appears in my saved searches list (GET /search/saved) for future retrieval
```

**US-071**: As an analyst, I want to view saved searches so that I can re-run previous queries.

```gherkin
Given I have saved one or more search configurations
When I call GET /search/saved
Then I see a list of my saved searches with name, query parameters, created_at, and a "Run" action
```

**US-072**: As an analyst, I want to build a citation network from evidence so that I can visualize how studies reference each other.

```gherkin
Given multiple evidence records exist for a project
When I submit POST /search/citation-network with a list of evidence IDs
Then the system returns a network graph with nodes (papers) and edges (citations), including citation direction and strength
```

**US-073**: As an analyst, I want to view AI-generated search recommendations so that I discover related evidence I may have missed.

```gherkin
Given an evidence record exists
When I call GET /search/recommendations/{evidence_id}
Then the system returns a ranked list of recommended related papers based on semantic similarity and citation patterns
```

**US-074**: As an analyst, I want to search Semantic Scholar so that I can find academic papers from an additional source.

```gherkin
Given I am on the Literature Search page
When I submit a query via GET /search/semantic-scholar with search parameters
Then results from Semantic Scholar API are returned with title, authors, abstract, citation_count, year, and venue
```

**US-075**: As an analyst, I want to view a specific paper from Semantic Scholar so that I can read its details.

```gherkin
Given I found a paper in Semantic Scholar search results
When I click on the paper and GET /search/semantic-scholar/paper/{paper_id} is called
Then I see the full paper details including abstract, authors, references, citations, and fieldsOfStudy
```

**US-076**: As an analyst, I want to get paper recommendations from Semantic Scholar so that I find similar studies.

```gherkin
Given I am viewing a paper's details
When I click "Find Similar" (POST /search/semantic-scholar/recommendations) with the paper_id
Then I receive a list of recommended papers ranked by relevance
```

**US-077**: As an analyst, I want to search for rare disease evidence across multiple sources so that I find specialized literature.

```gherkin
Given I am researching a rare disease indication
When I submit POST /search/rare-disease-evidence with the disease name and parameters
Then the system searches specialized rare disease databases, patient registries, and standard literature sources, returning consolidated results with source attribution
```

**US-078**: As an analyst, I want to view an evidence network visualization so that I understand relationships between studies.

```gherkin
Given evidence records with citation data exist for a project
When I navigate to the evidence network view (GET /projects/{project_id}/evidence/network)
Then I see an interactive network graph with study nodes colored by source type, edges showing citations, and node sizes reflecting relevance scores
```

**US-079**: As an analyst, I want to generate anchor evidence summaries so that key studies are highlighted.

```gherkin
Given evidence records exist for a project
When I click "Generate Anchors" (POST /projects/{project_id}/generate-anchors)
Then the system identifies the most relevant and highly-cited studies as anchors and generates summary cards for each
```

**US-080**: As an analyst, I want to generate an AI critique of the evidence base so that I get an automated quality assessment.

```gherkin
Given evidence records exist for a project
When I click "Generate Critique" (POST /projects/{project_id}/generate-critique)
Then the EnhancedAIService analyzes the evidence base and returns a structured critique covering strength of evidence, gaps, potential biases, and recommendations
```

---

## 16. ADaM Dataset Generation

**US-081**: As a biostatistician, I want to generate an ADSL (Subject-Level Analysis Dataset) so that I have a regulatory-compliant analysis dataset.

```gherkin
Given patient-level data has been ingested for the project
When I click "Generate ADSL" (POST /projects/{project_id}/adam/generate/adsl)
Then the ADaM service generates an ADSL dataset with standard CDISC variables (STUDYID, USUBJID, TRTA, AGE, SEX, RACE, etc.), and returns the dataset_id and variable metadata
```

**US-082**: As a biostatistician, I want to generate ADAE and ADTTE datasets so that I have adverse event and time-to-event analysis datasets.

```gherkin
Given ADSL has been generated for the project
When I click "Generate ADAE" or "Generate ADTTE" (POST /projects/{project_id}/adam/generate/{dataset_type})
Then the corresponding ADaM dataset is generated with CDISC-standard variables and linked to ADSL via USUBJID
```

**US-083**: As a biostatistician, I want to list all ADaM datasets for a project so that I can track what has been generated.

```gherkin
Given one or more ADaM datasets have been generated
When I call GET /projects/{project_id}/adam/datasets
Then I see a list of datasets with dataset_type (ADSL, ADAE, ADTTE), generation_date, row_count, variable_count, and validation_status
```

**US-084**: As a biostatistician, I want to validate ADaM datasets against CDISC rules so that I can ensure regulatory compliance.

```gherkin
Given ADaM datasets exist for the project
When I click "Validate" (POST /projects/{project_id}/adam/validate)
Then the system runs CDISC validation checks (required variables, value-level metadata, controlled terminology) and returns a validation report with errors, warnings, and notes
```

**US-085**: As a biostatistician, I want to view ADaM dataset metadata so that I can generate Define-XML from it.

```gherkin
Given ADaM datasets have been generated for the project
When I call GET /projects/{project_id}/adam/metadata
Then I see the complete metadata including dataset-level attributes, variable-level attributes (name, label, type, length, format, controlled_terminology), and value-level metadata
```

---

## 17. TFL Generation

**US-086**: As a biostatistician, I want to generate a demographics table so that I have a Table 14.1.1 for the CSR.

```gherkin
Given ADSL dataset exists for the project
When I click "Generate Demographics Table" (POST /projects/{project_id}/study/tfl/demographics)
Then the TFL generator produces a demographics summary table with treatment groups, n, mean/SD for continuous variables, and n/% for categorical variables, in a regulatory-standard format
```

**US-087**: As a biostatistician, I want to generate an adverse events table so that I have AE summaries for the CSR.

```gherkin
Given ADAE dataset exists for the project
When I click "Generate AE Table" (POST /projects/{project_id}/study/tfl/ae-table)
Then the TFL generator produces an AE summary table with System Organ Class, Preferred Term, treatment group counts and percentages, and relative risk
```

**US-088**: As a biostatistician, I want to generate a Kaplan-Meier survival curve so that I can visualize time-to-event outcomes.

```gherkin
Given ADTTE dataset exists for the project
When I click "Generate KM Curve" (POST /projects/{project_id}/study/tfl/km-curve)
Then the TFL generator produces KM curve data with survival probabilities, confidence intervals, number-at-risk table, and log-rank p-value
```

**US-089**: As a biostatistician, I want to generate a forest plot so that I can visualize subgroup analysis results.

```gherkin
Given analysis results with subgroup estimates exist for the project
When I click "Generate Forest Plot" (POST /projects/{project_id}/study/tfl/forest-plot)
Then the TFL generator produces forest plot data with subgroup labels, point estimates, confidence intervals, and interaction test p-values
```

**US-090**: As a biostatistician, I want to generate a Love plot so that I can visualize covariate balance before and after weighting.

```gherkin
Given propensity score analysis with SMD data exists for the project
When I click "Generate Love Plot" (POST /projects/{project_id}/study/tfl/love-plot)
Then the TFL generator produces Love plot data with covariate names, raw SMD, weighted SMD, and the 0.1 threshold reference line
```

**US-091**: As a biostatistician, I want to view TFL shell templates so that I can plan the tables, figures, and listings.

```gherkin
Given I am on the TFL Generation page
When I call GET /projects/{project_id}/study/tfl/shells
Then I see a list of standard TFL shells (demographics, AE summary, KM curve, forest plot, Love plot) with their template structure and required data mappings
```

**US-092**: As a biostatistician, I want to generate all TFLs at once so that I can produce a complete TFL package.

```gherkin
Given all required ADaM datasets exist for the project
When I click "Generate All TFLs" (POST /projects/{project_id}/study/tfl/generate-all)
Then the system generates demographics table, AE table, KM curve, forest plot, and Love plot, and returns a summary of generated outputs with any errors
```

---

## 18. Submission Packaging

**US-093**: As a regulatory lead, I want to generate an eCTD submission package so that I can submit to regulatory authorities.

```gherkin
Given all required study components are complete (protocol locked, analysis done, TFLs generated)
When I click "Generate eCTD" (POST /projects/{project_id}/submission/ectd/generate)
Then the eCTD packager creates the folder structure (m1-m5), generates the backbone XML, places datasets and documents in correct modules, and returns the package manifest
```

**US-094**: As a regulatory lead, I want to view the eCTD manifest so that I can verify package contents before submission.

```gherkin
Given an eCTD package has been generated
When I call GET /projects/{project_id}/submission/ectd/manifest
Then I see the complete file listing with module paths, document titles, checksums, and validation status
```

**US-095**: As a regulatory lead, I want to validate the eCTD package so that I can ensure it meets submission requirements.

```gherkin
Given an eCTD package has been generated
When I click "Validate eCTD" (POST /projects/{project_id}/submission/ectd/validate)
Then the system runs eCTD validation rules (file naming, XML schema, required documents) and returns a pass/fail result with detailed findings
```

**US-096**: As a regulatory lead, I want to generate Define-XML so that dataset metadata is documented per CDISC requirements.

```gherkin
Given ADaM datasets with metadata exist for the project
When I click "Generate Define-XML" (POST /projects/{project_id}/submission/define-xml/generate)
Then the Define-XML generator creates a valid Define-XML 2.0 document with ItemGroupDefs, ItemDefs, CodeLists, and ValueListDefs for all datasets
```

**US-097**: As a regulatory lead, I want to validate Define-XML so that it meets CDISC standards.

```gherkin
Given a Define-XML document has been generated
When I click "Validate Define-XML" (POST /projects/{project_id}/submission/define-xml/validate)
Then the system validates against the Define-XML 2.0 schema and CDISC business rules, returning errors, warnings, and conformance status
```

**US-098**: As a regulatory lead, I want to generate an ADRG (Analysis Data Reviewer's Guide) so that reviewers understand the analysis datasets.

```gherkin
Given ADaM datasets and analysis results exist for the project
When I click "Generate ADRG" (POST /projects/{project_id}/submission/adrg/generate)
Then the ADRG generator creates a document with dataset descriptions, derivation methods, analysis conventions, and references to the Define-XML
```

**US-099**: As a regulatory lead, I want to generate a CSR synopsis so that I have a summary for the Clinical Study Report.

```gherkin
Given the study definition and primary results are complete
When I click "Generate CSR Synopsis" (POST /projects/{project_id}/submission/csr/synopsis)
Then the CSR generator creates Section 1 (Synopsis) with study title, objectives, methodology, key results, and conclusions
```

**US-100**: As a regulatory lead, I want to generate CSR Section 11 (Efficacy) so that efficacy results are documented.

```gherkin
Given the primary analysis and subgroup analyses are complete
When I click "Generate Section 11" (POST /projects/{project_id}/submission/csr/section-11)
Then the CSR generator creates the efficacy section with primary endpoint analysis, secondary endpoints, subgroup analyses, and supporting figures
```

**US-101**: As a regulatory lead, I want to generate CSR Section 12 (Safety) so that safety results are documented.

```gherkin
Given ADAE dataset and safety analysis are complete
When I click "Generate Section 12" (POST /projects/{project_id}/submission/csr/section-12)
Then the CSR generator creates the safety section with AE summaries, SAE listings, laboratory findings, and vital signs analyses
```

**US-102**: As a regulatory lead, I want to generate CSR Appendix 16 (Individual Patient Data) so that patient-level listings are included.

```gherkin
Given ADSL dataset exists with patient-level data
When I click "Generate Appendix 16" (POST /projects/{project_id}/submission/csr/appendix-16)
Then the CSR generator creates Appendix 16 with individual patient listings, narrative summaries for SAE patients, and per-patient efficacy data
```

**US-103**: As a regulatory lead, I want to generate a full CSR so that the complete Clinical Study Report is produced.

```gherkin
Given all study components, analyses, and datasets are complete
When I click "Generate Full CSR" (POST /projects/{project_id}/submission/csr/full)
Then the CSR generator produces the complete CSR document including synopsis, all numbered sections, appendices, TFLs, and returns a downloadable artifact
```

**US-104**: As a regulatory lead, I want to view the overall submission status so that I can track readiness across all components.

```gherkin
Given I am on the submission packaging page
When I call GET /projects/{project_id}/submission/status
Then I see the status of each submission component (eCTD, Define-XML, ADRG, CSR sections) with completion percentage, validation results, and outstanding items
```

---

## 19. SDTM Dataset Generation

**US-105**: As a data manager, I want to generate SDTM domain datasets so that source data is standardized per CDISC SDTM.

```gherkin
Given patient-level data has been ingested for the project
When I select a domain (e.g., DM, AE, LB) and click "Generate" (POST /projects/{project_id}/sdtm/generate/{domain})
Then the SDTM service maps source variables to SDTM standard variables, applies controlled terminology, and generates the domain dataset with CDISC-compliant variable names and formats
```

**US-106**: As a data manager, I want to generate all SDTM domains at once so that the full SDTM package is created.

```gherkin
Given patient-level data has been ingested
When I click "Generate All SDTM" (POST /projects/{project_id}/sdtm/generate-all)
Then the system generates all applicable SDTM domains (DM, AE, LB, VS, CM, etc.) and returns a summary with domain names, row counts, and any generation errors
```

**US-107**: As a data manager, I want to validate SDTM datasets so that I can verify compliance with CDISC standards.

```gherkin
Given SDTM datasets have been generated for the project
When I click "Validate SDTM" (POST /projects/{project_id}/sdtm/validate)
Then the system runs Pinnacle 21 / OpenCDISC-style validation rules and returns a report with errors, warnings, and notices per domain
```

**US-108**: As a data manager, I want to view the annotated CRF (aCRF) so that I can see how CRF fields map to SDTM variables.

```gherkin
Given SDTM datasets have been generated
When I call GET /projects/{project_id}/sdtm/acrf
Then I see an HTML representation of the annotated CRF with source fields linked to SDTM domains and variables
```

---

## 20. SAR Pipeline

**US-109**: As an analyst, I want to initialize a SAR pipeline so that automated analysis stages are configured.

```gherkin
Given I am starting a new systematic assessment
When I call POST /sar-pipeline/init with project configuration
Then a new SAR pipeline is created with defined stages (search, screen, extract, analyze, report) and the pipeline_id is returned
```

**US-110**: As an analyst, I want to check the SAR pipeline status so that I can monitor progress through stages.

```gherkin
Given a SAR pipeline has been initialized for a project
When I call GET /sar-pipeline/{project_id}/status
Then I see the current stage, completion percentage, stage-level statuses, and any errors or warnings
```

**US-111**: As an analyst, I want to run a specific SAR pipeline stage so that I can advance the analysis.

```gherkin
Given the SAR pipeline is at a particular stage
When I call POST /sar-pipeline/{project_id}/run-stage with the stage name
Then the specified stage executes, progress is updated, and results are stored for that stage
```

**US-112**: As an analyst, I want to view SAR pipeline results so that I can review the output of each stage.

```gherkin
Given SAR pipeline stages have completed
When I call GET /sar-pipeline/{project_id}/results
Then I see the results for each completed stage including counts, quality metrics, and extracted data summaries
```

**US-113**: As an analyst, I want to view the SAR pipeline report so that I have a consolidated summary of the entire assessment.

```gherkin
Given the SAR pipeline has completed all stages
When I call GET /sar-pipeline/{project_id}/report
Then I see a comprehensive report with study flow diagram data, evidence summary, quality assessment, and conclusions
```

---

## 21. Bayesian & Interim Analysis

**US-114**: As a biostatistician, I want to run a Bayesian analysis so that I can incorporate prior information into the treatment effect estimation.

```gherkin
Given analysis data exists for the project
When I call POST /projects/{project_id}/study/bayesian/analyze with prior specification and likelihood model
Then the Bayesian methods service computes the posterior distribution, returns the posterior mean, credible intervals, Bayes factor, and posterior probability of benefit
```

**US-115**: As a biostatistician, I want to perform prior elicitation so that expert knowledge is formally incorporated.

```gherkin
Given I am planning a Bayesian analysis
When I call POST /projects/{project_id}/study/bayesian/prior-elicitation with expert assessments and historical data
Then the system fits a prior distribution to the elicited information and returns the prior parameters with visualization data
```

**US-116**: As a biostatistician, I want to design an adaptive trial so that sample size can be adjusted based on interim results.

```gherkin
Given study design parameters have been specified
When I call POST /projects/{project_id}/study/bayesian/adaptive with design parameters (max_n, interim_looks, decision_boundaries)
Then the system simulates the adaptive design, returns operating characteristics (power, type I error, expected sample size), and provides the decision rules
```

**US-117**: As a biostatistician, I want to compute group sequential boundaries so that interim analyses have proper alpha spending.

```gherkin
Given the number of interim analyses and overall alpha have been specified
When I call POST /projects/{project_id}/study/interim/boundaries with spending function (O'Brien-Fleming, Pocock) and number of looks
Then the system computes the stopping boundaries (efficacy and futility) at each interim analysis and returns the boundary values with cumulative alpha spent
```

**US-118**: As a biostatistician, I want to evaluate interim analysis results against boundaries so that a go/no-go decision can be made.

```gherkin
Given interim boundaries have been computed and interim data is available
When I call POST /projects/{project_id}/study/interim/evaluate with the current test statistic and information fraction
Then the system compares the test statistic to the boundaries and returns the decision (continue, stop for efficacy, stop for futility) with conditional power
```

**US-119**: As a biostatistician, I want to generate a DSMB report so that the Data Safety Monitoring Board has proper documentation.

```gherkin
Given interim analysis has been evaluated
When I call POST /projects/{project_id}/study/interim/dsmb-report
Then the system generates a DSMB report with unblinded efficacy results, safety summaries, boundary crossing status, and recommendations, formatted for board review
```

---

## 22. Collaborative Review

**US-120**: As a review lead, I want to create a review workflow so that evidence review follows a structured process.

```gherkin
Given a project has evidence records requiring review
When I call POST /review/workflows with workflow name, stages, and reviewer requirements
Then a review workflow is created with defined stages (screening, full-text review, data extraction, quality assessment), and a workflow_id is returned
```

**US-121**: As a review lead, I want to assign reviewers to evidence records so that review work is distributed.

```gherkin
Given a review workflow exists and evidence records need assignment
When I call POST /review/assignments with reviewer user_ids, evidence_ids, and review stage
Then review assignments are created, assigned reviewers are notified, and the assignment status is tracked
```

**US-122**: As a reviewer, I want to view my review assignments so that I know which evidence I need to review.

```gherkin
Given I have been assigned evidence records to review
When I call GET /review/assignments with my user_id filter
Then I see my pending, in-progress, and completed assignments with evidence titles, due dates, and review stage
```

**US-123**: As a reviewer, I want to add comments to an evidence record so that my observations are documented.

```gherkin
Given I am reviewing an assigned evidence record
When I type a comment and submit via POST /review/comments with evidence_id, comment_text, and optional section_reference
Then the comment is saved with my user_id and timestamp, and is visible to other reviewers on the same evidence
```

**US-124**: As a reviewer, I want to view all comments on an evidence record so that I can see the review discussion.

```gherkin
Given comments have been added to an evidence record
When I call GET /review/comments/{evidence_id}
Then I see all comments in chronological order with commenter name, role, timestamp, and comment text
```

**US-125**: As a reviewer, I want to submit a review decision (include/exclude/uncertain) so that the evidence is adjudicated.

```gherkin
Given I have reviewed an evidence record and formed a judgment
When I submit my decision via POST /review/decisions with evidence_id, decision (include/exclude/uncertain), and rationale
Then my decision is recorded, the evidence record's review status is updated, and if dual review is required, conflict detection is triggered
```

**US-126**: As a review lead, I want to resolve reviewer conflicts so that disagreements are adjudicated.

```gherkin
Given two reviewers have submitted conflicting decisions for the same evidence record
When I call POST /review/conflicts/resolve with the evidence_id, final_decision, and resolution_rationale
Then the conflict is resolved, the final decision is recorded with the adjudicator's identity, and an audit log entry is created
```

**US-127**: As a reviewer, I want to see who else is currently viewing an evidence record so that I am aware of concurrent reviewers.

```gherkin
Given I am viewing an evidence record
When I call GET /review/presence/{evidence_id}
Then I see a list of users currently viewing the same evidence with their names and last_active timestamps
```

**US-128**: As a reviewer, I want to update my presence on an evidence record so that other reviewers know I am active.

```gherkin
Given I am actively reviewing an evidence record
When the frontend periodically calls POST /review/presence/{evidence_id} with my user info
Then my presence is updated with the current timestamp, visible to other concurrent reviewers
```

**US-129**: As a review lead, I want to track workflow progress so that I can monitor review completion.

```gherkin
Given a review workflow is active with assignments
When I call GET /workflows/{workflow_id}/progress
Then I see the total assignments, completed count, in-progress count, pending count, conflict count, and completion percentage for each review stage
```

**US-130**: As a reviewer, I want to make an include/exclude decision on an evidence record from the project view so that I can quickly adjudicate evidence.

```gherkin
Given I am viewing evidence records for a project
When I click "Include" or "Exclude" on an evidence record (POST /projects/{project_id}/evidence/{evidence_id}/decision) with my decision and rationale
Then the decision is recorded, the evidence record's status is updated, an audit log is written, and the UI reflects the new decision
```

---

## 23. BioGPT & AI Integration

**US-131**: As an analyst, I want to check BioGPT service status so that I know if AI features are available.

```gherkin
Given I am using the application with AI features enabled
When the frontend calls GET /biogpt/status
Then I see whether the BioGPT service is available, the model version, and supported capabilities
```

**US-132**: As an analyst, I want to generate AI text for clinical summaries so that I can accelerate report writing.

```gherkin
Given I need to draft a clinical summary section
When I submit a prompt via POST /biogpt/generate with context and generation parameters
Then the BioGPT service returns generated text that I can review, edit, and incorporate into my documents
```

**US-133**: As an analyst, I want AI to explain a biological mechanism so that I can include mechanism-of-action context.

```gherkin
Given I am reviewing evidence related to a treatment's mechanism
When I submit POST /biogpt/explain-mechanism with the drug/treatment name and target
Then the system returns a structured explanation of the mechanism of action, relevant pathways, and supporting evidence
```

**US-134**: As an analyst, I want AI to summarize a collection of evidence so that I get a concise overview.

```gherkin
Given multiple evidence records have been collected for a project
When I submit POST /biogpt/summarize with evidence_ids or text content
Then the system returns a structured summary covering key findings, consistency across studies, and evidence gaps
```

**US-135**: As an analyst, I want to run a comprehensive AI analysis so that all aspects of the evidence are evaluated.

```gherkin
Given evidence records and analysis results exist for a project
When I click "AI Analysis" (POST /projects/{project_id}/ai/comprehensive-analysis)
Then the EnhancedAIService performs multi-dimensional analysis (quality, relevance, bias, consistency) and returns structured insights with confidence scores
```

---

## 24. Program Dashboard & Portfolio

**US-136**: As a program manager, I want to view a cross-study program overview so that I can monitor all studies.

```gherkin
Given my organization has multiple projects in various stages
When I call GET /program/overview
Then I see aggregate metrics: total projects, projects by status, overall completion rate, and timeline summaries across all studies in my organization
```

**US-137**: As a program manager, I want to view a portfolio summary with readiness scores so that I can prioritize submissions.

```gherkin
Given my organization has multiple projects
When I call GET /program/portfolio
Then I see each project with its title, status, readiness score (0-100%), key milestones, and submission target date
```

**US-138**: As a program manager, I want to view submission readiness for a specific project so that I know what remains to be done.

```gherkin
Given I am reviewing a specific project's regulatory preparedness
When I call GET /program/{project_id}/readiness
Then I see a detailed checklist of submission requirements (protocol locked, datasets complete, TFLs generated, CSR drafted, eCTD packaged) with pass/fail status for each
```

**US-139**: As a program manager, I want to view milestone timelines for a project so that I can track progress against deadlines.

```gherkin
Given a project has defined milestones
When I call GET /program/{project_id}/milestones
Then I see a timeline of milestones with planned dates, actual completion dates, status (on-track, delayed, completed), and dependencies
```

---

## 25. Admin & Organization Management

**US-140**: As an admin, I want to view organization information so that I can manage my organization's settings.

```gherkin
Given I am an admin user assigned to an organization
When I call GET /org/info
Then I see the organization name, slug, is_active status, user_count, project_count, and timestamps
```

**US-141**: As an admin, I want to list all users in my organization so that I can manage team access.

```gherkin
Given I am an admin and my organization has multiple users
When I call GET /org/users
Then I see a list of users with id, email, full_name, role, is_active, department, and last_login, ordered by name
```

**US-142**: As an admin, I want to invite a new user to the organization so that team members can access the platform.

```gherkin
Given I am an admin and need to add a team member
When I call POST /org/users/invite with email, full_name, and role
Then a new user account is created with a temporary password, assigned to my organization, and the temporary password is returned for secure distribution
```

**US-143**: As an admin, I want to update a user's role so that permissions are adjusted as responsibilities change.

```gherkin
Given I am an admin and a user's responsibilities have changed
When I call PUT /org/users/{user_id}/role with the new role (ADMIN, REVIEWER, ANALYST, VIEWER)
Then the user's role is updated, and a confirmation with the new role is returned
```

**US-144**: As an admin, I want to deactivate a user so that their access is revoked without deleting their account.

```gherkin
Given I am an admin and a team member has left the organization
When I call PUT /org/users/{user_id}/deactivate
Then the user's is_active flag is set to false, they can no longer log in, but their audit trail and review history are preserved
```

**US-145**: As an admin, I want to reactivate a deactivated user so that they can regain access.

```gherkin
Given I am an admin and a previously deactivated user needs access restored
When I call PUT /org/users/{user_id}/activate
Then the user's is_active flag is set to true and they can log in again
```

**US-146**: As an admin, I want to view the admin dashboard with analytics so that I can monitor platform usage.

```gherkin
Given I am an admin on the Admin Dashboard page
When the frontend calls GET /analytics/dashboard
Then I see usage analytics including active users, projects created over time, API call volumes, storage usage, and error rates
```

**US-147**: As an admin, I want to view system settings so that I can configure platform behavior.

```gherkin
Given I am on the System Settings admin page
When I view the settings panel
Then I see configurable options for email service, rate limiting, storage quotas, AI model selection, and data retention policies
```

**US-148**: As an admin, I want to view user management so that I can manage users from a dedicated admin page.

```gherkin
Given I am on the User Management admin page
When the page loads with the user list from GET /users
Then I see all users with their email, full_name, role, active status, and actions to edit role, activate, or deactivate
```

---

## 26. System & Infrastructure

**US-149**: As a DevOps engineer, I want to check system health so that I can monitor service availability.

```gherkin
Given the application is deployed
When I call GET /health (no authentication required)
Then I receive the system status ("healthy" or "degraded"), timestamp, database health check result, pool status, and dependency statuses (database, redis, openai)
```

**US-150**: As an admin, I want to view detailed system health so that I can diagnose infrastructure issues.

```gherkin
Given I am an authenticated admin
When I call GET /system/health/detailed
Then I see detailed health metrics including database connection pool status, query latency, cache hit rates, background task queue depth, and memory usage
```

**US-151**: As an admin, I want to view storage statistics so that I can manage disk usage.

```gherkin
Given I am an authenticated admin
When I call GET /system/storage-stats
Then I see total storage used, storage per project, file counts, and storage quota utilization
```

**US-152**: As an admin, I want to view cache statistics so that I can monitor caching effectiveness.

```gherkin
Given I am an authenticated admin
When I call GET /system/cache-stats
Then I see cache hit/miss rates, current cache size, eviction counts, and cache key counts by category
```

**US-153**: As an admin, I want to view system metrics so that I can track performance over time.

```gherkin
Given I am an authenticated admin
When I call GET /system/metrics
Then I see request rates, response times (p50, p95, p99), error rates, and active connection counts
```

---

## 27. Background Tasks

**US-154**: As an analyst, I want to check the status of a background task so that I know when long-running operations complete.

```gherkin
Given I initiated a background task (e.g., evidence discovery) and received a task_id
When I poll GET /tasks/{task_id}
Then I see the task status (pending, running, completed, failed), progress percentage, and status message
```

**US-155**: As an analyst, I want to retrieve the result of a completed task so that I can use the output.

```gherkin
Given a background task has completed successfully
When I call GET /tasks/{task_id}/result
Then I receive the task's output data (e.g., number of evidence records discovered, analysis results)
```

**US-156**: As an analyst, I want to list all my tasks so that I can monitor multiple operations.

```gherkin
Given I have initiated multiple background tasks
When I call GET /tasks
Then I see a list of my tasks with task_id, type, status, progress, created_at, and completed_at
```

**US-157**: As an analyst, I want to cancel a running task so that I can stop unnecessary computations.

```gherkin
Given a task is currently running and I no longer need its results
When I call POST /tasks/{task_id}/cancel
Then the task is marked as cancelled, the background worker is signaled to stop, and the task status is updated
```

---

## 28. Workflow Intelligence

**US-158**: As an analyst, I want to receive AI-guided workflow recommendations so that I follow best practices for each analysis step.

```gherkin
Given I am working on a project at a specific workflow stage
When I call GET /projects/{project_id}/workflow/guidance
Then the IntelligentWorkflowService returns contextual guidance for the current step, recommended next actions, common pitfalls to avoid, and references to regulatory guidelines
```

**US-159**: As an analyst, I want to execute a recommended workflow step so that the analysis progresses automatically.

```gherkin
Given I have received workflow guidance with a recommended action
When I click "Execute" (POST /projects/{project_id}/workflow/execute-step) with the step name
Then the system executes the recommended analysis step, updates the project state, and returns the next recommended action
```

**US-160**: As an analyst, I want personalized workflow optimization so that the system adapts to my usage patterns.

```gherkin
Given I have used the platform for multiple projects
When I call POST /user/{user_id}/workflow/optimize
Then the system analyzes my historical workflow patterns and returns optimized step ordering, suggested shortcuts, and personalized templates
```

---

## 29. Security & Threat Detection

**US-161**: As an admin, I want the system to perform threat detection on project activity so that security incidents are identified.

```gherkin
Given a project has active users and API calls
When I call POST /projects/{project_id}/security/threat-detection
Then the ZeroTrustSecurityService analyzes access patterns, flags anomalous behavior (unusual IP, off-hours access, bulk downloads), and returns a threat assessment with severity levels
```

**US-162**: As an admin, I want to classify data sensitivity so that appropriate security controls are applied.

```gherkin
Given data needs to be classified before processing
When I call POST /data/classify with the data payload
Then the system returns the sensitivity classification (public, internal, confidential, restricted) with the classification rationale and recommended handling procedures
```

---

## 30. Real-Time Collaboration

**US-163**: As a reviewer, I want to collaborate on evidence review in real-time via WebSocket so that I can work simultaneously with team members.

```gherkin
Given multiple reviewers need to review the same evidence record simultaneously
When I connect to the WebSocket endpoint /evidence/{evidence_id}/collaborate
Then I receive real-time updates of other reviewers' cursors, highlights, and comments, and my own actions are broadcast to connected peers
```

---

## 31. Statistics & Analysis

**US-164**: As an analyst, I want to run a full statistical analysis so that I get comprehensive results for the project.

```gherkin
Given a project has evidence records and configured parameters
When I call GET /statistics/full-analysis with the project_id
Then the StatisticalAnalysisService returns the complete analysis including effect estimates, confidence intervals, heterogeneity assessment, and meta-analytic summaries
```

**US-165**: As an analyst, I want to view a statistical summary so that I get key metrics at a glance.

```gherkin
Given analysis has been performed on the project
When I call GET /statistics/summary
Then I see summary statistics including sample size, effect size, p-value, I-squared, and overall quality rating
```

**US-166**: As an analyst, I want to view dataset information so that I understand the uploaded data structure.

```gherkin
Given datasets have been uploaded and processed for a project
When I call GET /projects/{project_id}/study/dataset-info
Then I see dataset metadata including column names, data types, row counts, missingness rates, and summary statistics per variable
```

**US-167**: As an analyst, I want to list all datasets associated with a project so that I can manage data assets.

```gherkin
Given datasets have been ingested via multiple uploads or generations (SDTM, ADaM)
When I call GET /projects/{project_id}/datasets
Then I see a unified list of all datasets with type (raw, SDTM, ADaM), name, row_count, column_count, creation_date, and source
```

---

## 32. Evidence Patterns & Federated Nodes

**US-168**: As an analyst, I want to view evidence patterns so that I can identify trends across the evidence base.

```gherkin
Given evidence records have been collected across multiple projects
When I call GET /evidence-patterns
Then I see identified patterns including common endpoints, recurring populations, evidence gaps, and emerging therapeutic areas
```

**US-169**: As a platform admin, I want to view federated data nodes so that I can monitor distributed data sources.

```gherkin
Given the platform is configured with federated data nodes
When I call GET /federated/nodes
Then I see a list of connected nodes with node_id, status (online/offline), last_sync timestamp, and dataset counts
```

---

## 33. Error Handling & UX

**US-170**: As a user, I want the application to display an error boundary page when a component crashes so that I can recover gracefully.

```gherkin
Given I am navigating the application and a React component throws an unhandled error
When the ErrorBoundary catches the render error
Then I see an error page with "Something went wrong" heading, error details in a collapsible section, a "Try Again" button (up to 3 attempts), "Go to Dashboard" and "Reload Page" buttons, and a toast notification is dispatched
```

**US-171**: As a user, I want toast notifications for API errors so that I am informed of issues without losing context.

```gherkin
Given I am performing an action that triggers an API call
When the API returns an error (4xx or 5xx status code)
Then a toast notification appears in the corner with the error message, status code, and affected endpoint, and auto-dismisses after a configurable duration
```

**US-172**: As a user, I want demo data to be clearly indicated so that I can distinguish between real and simulated results.

```gherkin
Given I am viewing a page that displays demo/simulated data (e.g., attrition funnel without real data)
When the page renders with generated placeholder data
Then a "Demo Data" badge or banner is prominently displayed, indicating that the results are illustrative and not based on real patient data
```

---

## 34. Legal & Policy Pages

**US-173**: As a user, I want to view the Terms of Use so that I understand the platform's usage terms.

```gherkin
Given I am on any page with a footer link to legal documents
When I click "Terms of Use" and navigate to the /terms page
Then I see the full Terms of Use document rendered in a readable format
```

**US-174**: As a user, I want to view the Privacy Policy so that I understand how my data is handled.

```gherkin
Given I am on any page with a footer link to legal documents
When I click "Privacy Policy" and navigate to the /privacy page
Then I see the full Privacy Policy document rendered in a readable format
```

**US-175**: As a user, I want to view the AI Use Policy so that I understand how AI is used in the platform.

```gherkin
Given I am on any page with a footer link to policy documents
When I click "AI Use Policy" and navigate to the /ai-policy page
Then I see the full AI Use Policy document explaining how AI models are used, data handling for AI features, and limitations
```

---

## 35. Dashboard & Navigation

**US-176**: As an analyst, I want to view an enhanced dashboard so that I have an overview of my work.

```gherkin
Given I am authenticated and have projects in my organization
When I navigate to the dashboard (/dashboard)
Then I see project summary cards, recent activity, workflow progress indicators, and quick-action buttons for creating new projects or accessing recent studies
```

**US-177**: As a user, I want a sidebar navigation with the 10-step study workflow so that I can move between analysis steps.

```gherkin
Given I am viewing a project
When I look at the sidebar navigation
Then I see the 10 workflow steps (Study Definition, Causal Framework, Data Provenance, Cohort Construction, Comparability & Balance, Effect Estimation, Bias & Sensitivity, Reproducibility, Audit Trail, Regulatory Output) plus Literature Search, each with a completion indicator, and clicking a step navigates to that page
```

---

*End of User Stories Document. Total: 177 user stories covering the complete Afarensis Enterprise v2.1 application surface.*

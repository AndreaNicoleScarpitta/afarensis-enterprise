# Afarensis Enterprise v2.1 — Product Guide

## Document Control

| Field   | Value           |
|---------|-----------------|
| Version | 2.1.0           |
| Date    | 2026-03-24      |
| Status  | Current Release |

---

## 1. Product Overview

Afarensis Enterprise is a regulatory-grade evidence synthesis and statistical analysis platform for clinical research. It guides users through a structured 10-step workflow from study definition through regulatory submission, performing real causal inference computations validated against R/lifelines reference implementations.

### Key Capabilities

- **Protocol parsing and study design** — structured definition of research questions, endpoints, estimands, and regulatory context.
- **Multi-source evidence discovery** — unified search across PubMed, ClinicalTrials.gov, OpenAlex, and Semantic Scholar.
- **Real statistical analysis engine** — Cox proportional hazards (Newton-Raphson solver), propensity score estimation, IPTW, AIPW (doubly robust), Kaplan-Meier survival estimation, E-values (VanderWeele-Ding), DerSimonian-Laird meta-analysis, and stratified subgroup analyses. All computations are validated against R `survival` and Python `lifelines` reference implementations.
- **CDISC ADaM dataset generation** — produces ADSL (Subject-Level), ADAE (Adverse Events), and ADTTE (Time-to-Event) datasets conforming to CDISC standards.
- **Regulatory document generation** — SAR (Statistical Analysis Report), eCTD Module 5 packages, Define-XML 2.1, ADRG (Analysis Data Reviewer's Guide), and CSR sections (Synopsis, Section 11: Efficacy, Section 12: Safety, Appendix 16).
- **HIPAA-compliant patient data ingestion** — consent gate, encrypted upload, and 8 regulatory compliance checks on every data ingestion event.
- **Collaborative multi-reviewer workflows** — role-based access with Admin, Reviewer, Analyst, and Viewer tiers.
- **Full audit trail with regulatory retention** — immutable, append-only event log with 7-year retention for regulatory inspection readiness.

---

## 2. Getting Started

### 2.1 Login and Registration

The login screen accepts an email address and password. On first-time deployment, the system auto-creates an admin account using the credentials provided during setup. Subsequent users can self-register: registration creates a new organization, assigns the registering user as its admin, and sends an email verification link that must be confirmed before access is granted.

Password reset follows a 6-digit email code flow. The user requests a reset, receives a time-limited 6-digit code via email, enters it on the verification screen, and then sets a new password.

#### Roles

| Role     | Description                                                                 |
|----------|-----------------------------------------------------------------------------|
| Admin    | Full access. Manages users, organizations, system settings, and all projects. |
| Reviewer | Can view, comment on, and approve analyses. Cannot modify statistical configurations. |
| Analyst  | Can create projects, configure analyses, run computations, and generate documents. |
| Viewer   | Read-only access to projects they are invited to. Cannot modify anything.    |

### 2.2 Dashboard

The landing page (`/dashboard`) displays all projects the current user has access to in a card grid layout. Each project card shows:

- **Project title** — the name assigned at creation.
- **Status badge** — one of Draft, Processing, Review, Completed, or Archived, rendered as a colored pill.
- **Creation date** — when the project was first created.
- **Evidence count** — the number of literature items or data sources attached.

#### Dashboard Actions

- **Filter by status**: A row of tab buttons across the top of the grid lets users filter to All, Draft, In Review, Completed, or Archived projects.
- **Create a new project**: The "New Project" button opens a modal where users enter a project title, select an indication, and optionally provide a description. Submitting the modal creates a new project in Draft status and navigates to its Step 1.
- **Enter a project**: Clicking any project card navigates into that project's 10-step workflow, resuming at the last visited step.

---

## 3. The 10-Step Workflow

The left sidebar displays all 10 steps as a vertical navigation list. Each step shows a status indicator:

- **Not started** (gray circle) — no data has been entered for this step.
- **In progress** (amber circle) — partial data exists but the step is not complete.
- **Complete** (green checkmark) — all required fields and computations for the step are finished.

Steps can be visited in any order by clicking on them in the sidebar, but the intended flow is sequential from Step 1 through Step 10. Some steps depend on outputs from earlier steps (for example, Step 5 requires covariates defined in Step 2 and cohort data from Step 4).

---

### Step 1: Study Definition

**Route**: `/projects/:id/study`

**Purpose**: Define the research question, protocol parameters, and study design. This step establishes the foundational context that all subsequent steps build upon.

#### UI Elements

| Element                        | Type            | Description                                                                                             |
|--------------------------------|-----------------|---------------------------------------------------------------------------------------------------------|
| Protocol name                  | Text field      | Free-text name for the study protocol (e.g., "KEYNOTE-042 RWE Replication").                           |
| Indication                     | Dropdown        | Clinical indication: Oncology, Cardiology, Rare Disease, Neurology, Immunology, Infectious Disease, etc. |
| Primary endpoint               | Selector        | Choose one: OS (Overall Survival), PFS (Progression-Free Survival), ORR (Overall Response Rate), DFS (Disease-Free Survival), EFS (Event-Free Survival), or custom. |
| Estimand type                  | Radio buttons   | ATT (Average Treatment Effect on the Treated), ATE (Average Treatment Effect), ITT (Intent-to-Treat), PP (Per-Protocol). |
| Phase                          | Selector        | Study phase: II, III, or IV.                                                                            |
| Regulatory body                | Selector        | Target regulatory authority: FDA, EMA, PMDA, Health Canada.                                             |
| Treatment name                 | Text field      | Name of the treatment arm (e.g., "Pembrolizumab 200 mg Q3W").                                          |
| Comparator name                | Text field      | Name of the comparator arm (e.g., "Platinum-based chemotherapy").                                       |
| Secondary endpoints            | Multi-select    | Select one or more secondary endpoints from the available list.                                          |
| "Lock Protocol" button         | Action button   | Freezes the study definition. Once locked, no fields on this page can be edited. The lock event is recorded in the audit trail. |

#### Side Panels

- **Literature Evidence panel**: Displays publications and evidence items that are contextually relevant to the defined protocol. Pulls from the project's saved evidence base.
- **Show Your Work panel**: Displays computational transparency information — the formulas, parameters, and intermediate values used in any automated suggestions or validations.

#### Data Storage

All study definition fields are persisted to `Project.processing_config["study_definition"]` as a JSON object.

---

### Step 2: Causal Framework

**Route**: `/projects/:id/causal-framework`

**Purpose**: Define the causal model that underpins the analysis. Select covariates for adjustment and assign their roles in the causal structure.

#### UI Elements

- **DAG (Directed Acyclic Graph) visualization**: An interactive graph showing the causal relationships. The default structure shows Treatment leading to Outcome, with confounders branching into both. Users can inspect the graph to understand the assumed causal structure.
- **Estimand selection**: Linked from Step 1. Displays the chosen estimand (ATT, ATE, ITT, or PP) and allows modification if the protocol is not yet locked.
- **Covariate checklist**: A list of available covariates, each with a checkbox to include it in the analysis:
  - Age
  - Sex
  - Baseline severity
  - Comorbidities
  - Prior therapy
  - Biomarkers
  - Region
  - BMI
  - Smoking status
  - Disease stage

Each selected covariate has a **role tag** dropdown with the following options:

| Role               | Meaning                                                                                   |
|--------------------|-------------------------------------------------------------------------------------------|
| Confounder         | Affects both treatment assignment and outcome. Must be adjusted for.                      |
| Effect modifier    | Changes the magnitude of the treatment effect across its levels. Used in subgroup analyses.|
| Mediator           | Lies on the causal pathway between treatment and outcome. Adjusting for it may introduce bias. |
| Precision variable | Predicts the outcome but not treatment assignment. Improves precision without introducing bias. |

#### Data Storage

Selected covariates and their roles are persisted to `processing_config["covariates"]`.

---

### Step 3: Data Provenance

**Route**: `/projects/:id/data-provenance`

**Purpose**: Configure data sources, map variables, and assess data quality before analysis begins.

#### UI Elements

- **Data source cards**: Each configured data source appears as a card displaying:
  - Source name (e.g., "Flatiron Health EHR Extract")
  - Source type (e.g., EHR, Claims, Registry, Clinical Trial)
  - Record count
  - Date range covered
  - Coverage score (percentage of required variables present)

- **Data quality metrics**: For each source, three quality dimensions are scored:
  - **Completeness** — percentage of non-missing values across required fields.
  - **Consistency** — cross-field validation pass rate (e.g., death date after diagnosis date).
  - **Timeliness** — how recent the most current records are relative to the analysis date.

- **Variable mapping table**: A two-column table mapping source column names to standardized analysis variable names. Users can manually adjust mappings or accept auto-suggested mappings.

- **HIPAA compliance status indicators**: Green/amber/red indicators showing whether each data source has passed HIPAA compliance validation.

- **Patient Data section** (when patient-level data ingestion is active):
  - **Consent gate**: A mandatory confirmation dialog requiring the user to attest that proper patient consent and IRB approval are in place before any data upload proceeds.
  - **Upload dropzone**: Drag-and-drop area for CSV, SAS7BDAT, or XPT files.
  - **Compliance report**: After upload, a report listing the results of all 8 regulatory compliance checks (de-identification verification, consent documentation, minimum necessary standard, access logging, encryption verification, audit trail creation, retention policy assignment, breach notification readiness).

#### Data Storage

Source configurations and mappings are persisted to `processing_config["data_sources"]`.

---

### Step 4: Cohort Construction

**Route**: `/projects/:id/cohort`

**Purpose**: Define inclusion and exclusion criteria that select the analysis population, then visualize the attrition funnel showing how each criterion reduces the available patient pool.

#### UI Elements

- **Inclusion criteria editor**: An interactive list where users add criteria. Each criterion has a description field (e.g., "Age >= 18 years", "Confirmed histological diagnosis of NSCLC", "At least one prior line of therapy"). Criteria can be reordered, edited, or removed.

- **Exclusion criteria editor**: Same interface as inclusion criteria, but for exclusion rules (e.g., "Active CNS metastases", "Prior immunotherapy exposure", "ECOG PS > 2").

- **"Run Cohort Simulation" button**: Triggers a server-side computation that simulates applying each criterion sequentially to an initial patient pool and returns the attrition funnel data.

- **Attrition funnel visualization**: A horizontal funnel chart showing:
  - The initial pool size at the top.
  - Each criterion as a step, with the number of patients remaining after application.
  - Dropout counts and percentages at each step (e.g., "Excluded 342 patients (8.2%) — Age < 18").
  - The final cohort size at the bottom, split into treatment arm (n) and comparator arm (n).

- **Final cohort summary**: A summary card showing:
  - Total N (final cohort)
  - Treatment arm n
  - Comparator arm n
  - Median follow-up time
  - Event rate

#### Computation

The server simulates an attrition funnel by starting with an initial pool (derived from data sources in Step 3 or from sample data) and sequentially applying each inclusion and exclusion criterion, tracking the count at each stage.

#### Data Storage

Criteria and cohort results are persisted to `processing_config["cohort"]`.

---

### Step 5: Comparability and Balance

**Route**: `/projects/:id/comparability`

**Purpose**: Assess whether the treatment and comparator arms are balanced on measured covariates, both before and after statistical adjustment. Imbalance suggests confounding that must be addressed.

#### UI Elements

##### Love Plot

A horizontal bar chart displaying the Standardized Mean Difference (SMD) for each covariate selected in Step 2:

- **Blue bars**: Unadjusted SMD — the raw difference between arms before any statistical correction.
- **Green bars**: IPTW-adjusted SMD — the difference after applying Inverse Probability of Treatment Weighting.
- **Red dashed vertical line**: The |SMD| = 0.1 threshold. Covariates with adjusted SMD below this line are considered well-balanced. Covariates above the line may still be confounding the estimate.

The goal is for all green bars to fall within the red threshold lines, indicating that IPTW has successfully balanced the arms.

##### Propensity Score Diagnostics

- **PS distribution overlap histogram**: Two overlapping histograms (one per arm) showing the distribution of estimated propensity scores. Good overlap indicates that patients in both arms have comparable likelihoods of receiving treatment, supporting the positivity assumption.
- **C-statistic**: The area under the ROC curve for the propensity score model. Values between 0.6 and 0.8 are typical; values above 0.9 may indicate near-deterministic treatment assignment (positivity concern).
- **Effective sample size (ESS) after weighting**: The effective number of patients contributing to the weighted analysis. Large reductions from the nominal sample size indicate that a few patients dominate the weights (instability concern).

##### Summary Statistics Table

A table showing, for each covariate: the mean/proportion in the treatment arm, the mean/proportion in the comparator arm, the unadjusted SMD, the adjusted SMD, and a pass/fail indicator against the 0.1 threshold.

#### Computation

The platform runs a full propensity score estimation pipeline:

1. Fits a logistic regression model predicting treatment assignment from the selected covariates.
2. Computes IPTW weights (inverse of the estimated propensity score for the treated, inverse of 1 minus the propensity score for the comparator).
3. Calculates SMDs for each covariate before and after weighting.
4. Reports the C-statistic and effective sample size.

All computations are real and validated against R reference implementations.

#### Data Storage

Balance assessment results are persisted to `processing_config["balance"]`.

---

### Step 6: Effect Estimation

**Route**: `/projects/:id/effect-estimation`

**Purpose**: Present the primary treatment effect estimate along with sensitivity analyses from multiple statistical methods, displayed in a forest plot.

#### UI Elements

##### Primary Result Card

A prominent card at the top of the page displaying:

- **Hazard Ratio (HR)** with 95% confidence interval (e.g., HR = 0.73, 95% CI: 0.61-0.88).
- **P-value** with a significance indicator (green if p < 0.05, amber if 0.05 <= p < 0.10, red if p >= 0.10).
- **Number Needed to Treat (NNT)** — the estimated number of patients who must receive treatment for one additional patient to benefit.

##### Forest Plot

A standard forest plot showing effect estimates from multiple analytic approaches, arranged as horizontal rows:

| Row Label                  | Method Description                                                              |
|----------------------------|---------------------------------------------------------------------------------|
| Primary (IPTW Cox PH)     | The pre-specified primary analysis: Cox proportional hazards with IPTW weights. |
| Unadjusted Cox PH         | Crude Cox PH without any covariate adjustment.                                  |
| Propensity Score Matched   | Cox PH on a 1:5 nearest-neighbor propensity score matched cohort.              |
| Overlap Weighted           | Cox PH with overlap (entropy) weights — emphasizes the equipoise population.   |
| Trimmed IPTW              | IPTW with extreme weights trimmed (e.g., at the 1st and 99th percentiles).      |
| AIPW (Doubly Robust)      | Augmented Inverse Probability Weighting — consistent if either the PS model or the outcome model is correct. |
| Subgroup: [Covariate]     | Stratified Cox PH for each level of each effect modifier covariate.             |

Each row displays:
- A point estimate (square, sized by weight or sample size).
- 95% CI whiskers extending left and right.
- Numeric annotation of the HR and CI.

At the bottom, a **diamond** shows the pooled meta-analytic estimate across methods (DerSimonian-Laird random effects).

##### Computation Details

The full statistical pipeline includes:

- **Cox PH**: Partial likelihood maximized via Newton-Raphson iteration. Handles ties using the Efron method.
- **Kaplan-Meier estimator**: Non-parametric survival curve estimation for each arm.
- **IPTW**: Weights derived from propensity scores (see Step 5).
- **PS matching**: 1:5 nearest-neighbor matching without replacement on the logit of the propensity score, with a caliper of 0.2 standard deviations.
- **Overlap weighting**: Each patient weighted by the probability of being assigned to the opposite arm.
- **AIPW**: Combines an outcome regression model with IPTW for doubly robust estimation.
- **Meta-analysis**: DerSimonian-Laird random-effects model pooling estimates across methods.
- **Subgroup analyses**: Stratified Cox PH run separately within each level of each effect modifier covariate, producing method-specific HRs and CIs.

All computations are validated against the R `survival` package and Python `lifelines` library.

---

### Step 7: Bias and Sensitivity

**Route**: `/projects/:id/bias-sensitivity`

**Purpose**: Assess how robust the findings are to unmeasured confounding, misspecification, and other sources of bias.

#### UI Elements

##### E-Value Display

- **Point E-value**: The minimum strength of association (on the risk ratio scale) that an unmeasured confounder would need to have with both treatment and outcome to fully explain away the observed effect. Computed using the VanderWeele-Ding formula.
- **CI E-value**: The E-value for the confidence interval limit closest to the null. If this value is large, even the uncertainty bound is robust to unmeasured confounding.
- **Interpretation text**: A plain-language sentence generated automatically, e.g., "An unmeasured confounder would need to have a risk ratio of at least 2.4 with both treatment assignment and the outcome to explain away the observed HR of 0.73. To move the confidence interval to include the null, the confounder would need a risk ratio of at least 1.8."

##### Bias Domain Assessment

Four gauge visualizations (semicircular meters), one for each bias domain:

| Domain             | What It Assesses                                                                |
|--------------------|---------------------------------------------------------------------------------|
| Selection bias     | Whether the cohort selection process systematically distorts the treatment-outcome relationship. |
| Confounding        | Whether unmeasured or residual confounding threatens the validity of the causal estimate. |
| Measurement bias   | Whether outcome ascertainment, exposure classification, or covariate measurement is differential between arms. |
| Temporal bias      | Whether immortal time, time-lag, or depletion-of-susceptibles bias is present.   |

Each gauge shows a severity level: Low, Moderate, or High.

##### Fragility Index

The number of outcome events in the less-frequent-event arm that would need to be changed (from event to non-event or vice versa) to make the primary result statistically non-significant (p >= 0.05). A low fragility index indicates a result that is sensitive to small perturbations in the data.

##### Stress Test Results

- **Tipping-point analysis**: Shows how many unmeasured confounder events at various effect sizes would be required to tip the result to non-significance.
- **Pattern-mixture models**: Sensitivity analysis for missing data assumptions — shows how the treatment effect changes under different assumptions about the missing data mechanism (MCAR, MAR, MNAR).

#### Computation

E-values are computed using the validated VanderWeele-Ding formula. The fragility index is found by an iterative search algorithm that flips one event at a time and re-tests significance.

---

### Step 8: Reproducibility

**Route**: `/projects/:id/reproducibility`

**Purpose**: Document the complete analysis environment and provide cryptographic verification that results can be reproduced.

#### UI Elements

- **Analysis manifest**: A structured listing of all software versions (Python, R, key package versions), random seeds used (if any), algorithmic parameters (convergence thresholds, caliper widths, trimming percentiles), and configuration hashes.

- **File hash table**: A table listing every input file and generated output, with its SHA-256 hash, file size, and timestamp. This allows independent verification that the same inputs produce the same outputs.

- **Lineage graph**: A visual directed graph tracing the data flow from raw input files through each transformation step (cleaning, variable derivation, cohort filtering, propensity scoring, effect estimation) to the final results. Each node is clickable and shows the transformation applied and the hash of its output.

- **Reproducibility score**: A percentage indicating what fraction of the analysis pipeline is deterministically reproducible (100% means all steps can be re-run from inputs to produce identical outputs; lower values indicate steps that depend on external services or non-deterministic processes).

- **Export button**: Downloads a complete reproducibility package as a ZIP archive containing all input data, configuration files, analysis scripts, intermediate outputs, and final results with their hashes.

---

### Step 9: Audit Trail

**Route**: `/projects/:id/audit`

**Purpose**: Provide an immutable, chronological record of every action taken on the project, suitable for regulatory inspection.

#### UI Elements

- **Timeline view**: Events displayed in reverse chronological order (newest first). Each event card shows:
  - **Timestamp** — date and time in ISO 8601 format, displayed in the user's local timezone.
  - **User** — the name and email of the user who performed the action.
  - **Action type** — a categorized label (e.g., "Protocol Locked", "Computation Run", "Document Generated", "Cohort Updated", "Data Uploaded", "User Invited").
  - **Resource affected** — which object was changed (e.g., project, step, document, user).
  - **Change summary** — a brief description of what changed (e.g., "Primary endpoint changed from PFS to OS").

- **Filters**: Users can filter the timeline by:
  - Action type (dropdown of all action categories)
  - User (dropdown of project members)
  - Date range (start and end date pickers)

- **Regulatory significance badges**: Events that are relevant to regulatory submission (protocol locks, computation runs, document generation, data uploads) are marked with a blue "Regulatory" badge, making them easy to identify during inspection.

- **Immutability guarantee**: Audit events are read-only. They cannot be modified, backdated, or deleted by any user, including admins. The UI does not present any edit or delete controls for audit entries.

- **Retention indicator**: A notice at the bottom of the audit trail states the 7-year retention period and the earliest date at which records may be purged.

---

### Step 10: Regulatory Output

**Route**: `/projects/:id/regulatory-output`

**Purpose**: Generate submission-ready regulatory documents and packages. This is the final step in the workflow and depends on the completeness of all prior steps.

#### UI Elements

##### Readiness Checklist

A vertical checklist showing the completion status of every prerequisite step:

- Each step is listed with its name and a status icon:
  - **Green checkmark** — the step is complete and its outputs are available for document generation.
  - **Red X** — the step is incomplete; the user must go back and finish it before generating documents.
- An **overall readiness percentage** is shown at the top (e.g., "8 of 10 steps complete — 80% ready").
- Steps marked incomplete are clickable links that navigate directly to the incomplete step.

##### Document Generation

A set of document generation cards, each with a "Generate" button:

| Document                       | Format         | Description                                                                     |
|--------------------------------|----------------|---------------------------------------------------------------------------------|
| SAR (Statistical Analysis Report) | HTML or DOCX | Comprehensive statistical report covering methods, results, and interpretation. |
| eCTD Module 5 package          | XML + PDF      | Complete electronic Common Technical Document Module 5 (Clinical Study Reports). |
| Define-XML 2.1                 | XML            | Machine-readable dataset metadata conforming to CDISC Define-XML 2.1 standard.  |
| ADRG (Analysis Data Reviewer's Guide) | PDF     | Guide for regulatory reviewers explaining dataset structure and derivations.     |
| CSR — Synopsis                 | DOCX           | Clinical Study Report synopsis section.                                          |
| CSR — Section 11: Efficacy     | DOCX           | Efficacy results section of the CSR.                                             |
| CSR — Section 12: Safety       | DOCX           | Safety results section of the CSR.                                               |
| CSR — Appendix 16              | DOCX           | Individual patient data listings appendix.                                       |

##### Artifact List

A table of previously generated documents with:
- Document name and type
- Generation timestamp
- File size
- Download link
- Hash (SHA-256) for integrity verification

##### Protocol Lock Status

A status indicator showing whether the protocol (Step 1) has been locked. Document generation may warn or block if the protocol is not locked, since regulatory submissions require a frozen protocol.

---

## 4. Analysis Lineage Pages

These pages provide detailed transparency into the data and computations underlying the analysis. They are accessible from the project navigation and complement the 10-step workflow.

### Input Explorer

**Route**: `/projects/:id/input-explorer`

Explore the input datasets used in the analysis. Displays data source cards with column-level metadata including column name, data type, cardinality, percentage of missing values, and example values. Users can inspect schemas and quality metrics for each dataset.

When the project is using sample or simulated data rather than real patient data, a **demo data banner** is displayed prominently at the top of the page.

### Variable Notebook

**Route**: `/projects/:id/variable-notebook`

A machine-readable data dictionary documenting every variable used in the analysis. For each variable, the notebook records:

- **Name** — the standardized variable name used in computations.
- **Label** — a human-readable description.
- **Type** — data type (continuous, categorical, binary, date, etc.).
- **Derivation rule** — how the variable is computed from source data (e.g., "Age = analysis date minus birth date, in years").
- **Source** — which data source(s) the variable originates from.
- **Role in the causal model** — confounder, effect modifier, mediator, precision variable, treatment, outcome, or not used.

### Trace Pack Export

**Route**: `/projects/:id/trace-pack`

Export a complete trace package as a downloadable archive for external review or regulatory submission. The trace pack contains:

- All input datasets (de-identified if applicable)
- Intermediate computation outputs (propensity scores, weights, matched cohorts)
- Final analysis results
- Audit logs for the project
- Configuration and parameter files
- File integrity hashes

---

## 5. Literature Search

**Route**: `/projects/:id/literature-search`

**Purpose**: Search multiple academic and clinical trial databases from a single unified interface, saving time and ensuring comprehensive evidence coverage.

#### UI Elements

- **Search bar**: A text input for entering search queries (supports Boolean operators, MeSH terms for PubMed, and natural language).

- **Source tabs**: Toggle between databases:
  - **PubMed** — biomedical literature from the National Library of Medicine.
  - **ClinicalTrials.gov** — registered clinical trials and their results.
  - **OpenAlex** — open scholarly metadata covering 250M+ works.
  - **Semantic Scholar** — AI-powered academic search with citation context.

- **Filter panel**: Refine results by:
  - Year range (start year to end year slider)
  - Study type (RCT, observational, meta-analysis, systematic review, case report, etc.)
  - Open access only (toggle)
  - Minimum citation count (numeric input)

- **Results list**: Each result shows:
  - Title (linked to the paper viewer)
  - Authors (first three, with "et al." for longer lists)
  - Journal name
  - Publication year
  - Abstract preview (first 200 characters)
  - Citation count

- **Paper viewer**: Clicking a result opens a detail view with the full abstract, complete author list, DOI, publication metadata, and an **"Add to Evidence"** button that saves the paper to the project's evidence base for use in Step 1 and the regulatory outputs.

- **Saved searches**: Users can save search queries and re-run them later. Optionally, alerts can be configured to notify the user when new results match a saved query.

---

## 6. Admin Pages

Admin pages are accessible only to users with the Admin role. They provide organization-level management capabilities.

### User Management

**Route**: `/admin/users`

A paginated table listing all users within the admin's organization:

| Column       | Description                                           |
|--------------|-------------------------------------------------------|
| Name         | User's full name.                                     |
| Email        | Login email address.                                  |
| Role         | Current role (Admin, Reviewer, Analyst, Viewer).      |
| Organization | The organization the user belongs to.                 |
| Status       | Active or Deactivated.                                |
| Last Login   | Timestamp of the user's most recent login.            |

Admins can:
- **Change a user's role** by selecting a new role from a dropdown in the table row.
- **Deactivate an account** to revoke access without deleting the user record (preserves audit trail integrity).

Organization-scoped: admins only see and manage users within their own organization. There is no cross-organization visibility.

### Audit Logs

**Route**: `/admin/audit`

A system-wide audit log viewer that aggregates events across all projects in the organization. Supports filtering by:

- Project (dropdown of all organization projects)
- User (dropdown of all organization users)
- Action type (dropdown of all action categories)
- Date range (start and end date pickers)

Each log entry shows:
- Timestamp
- User name and email
- Action type and description
- IP address of the request origin
- User agent string (browser/client identification)
- Duration (how long the action took to process)
- Regulatory significance flag (boolean, highlighted when true)

### System Settings

**Route**: `/admin/settings`

Configure system-level parameters that affect the entire deployment:

- **API keys**: Manage keys for external service integrations (PubMed, OpenAlex, Semantic Scholar, LLM providers).
- **Email settings**: SMTP server configuration for verification emails, password resets, and alert notifications.
- **Security policies**: Password complexity requirements, session timeout duration, MFA configuration.
- **Cache TTLs**: Time-to-live settings for cached API responses and computed results.
- **Rate limits**: Request rate limits for API endpoints (defaults: 5 login attempts per minute, 100 API requests per minute per user).
- **Retention policies**: Configure audit log retention period (default: 7 years) and data archival rules.

---

## 7. Cross-Cutting UX Features

These features apply across the entire application and define the consistent user experience.

### Demo Data Indicators

Every page that can display sample or simulated data shows an amber banner at the top of the content area:

> **SAMPLE DATA** — [context-specific message]

The context-specific message varies by page. Examples:
- Step 5: "SAMPLE DATA — Balance diagnostics shown are computed from simulated covariates for demonstration purposes."
- Step 6: "SAMPLE DATA — Effect estimates are computed from simulated survival data and do not represent real clinical outcomes."
- Input Explorer: "SAMPLE DATA — These datasets are auto-generated samples. Connect real data sources in Step 3."

This ensures users always know when they are seeing illustrative data versus real analysis results, preventing accidental misinterpretation of demo outputs as genuine findings.

### Error Handling

#### ErrorBoundary

A React ErrorBoundary component wraps all routed content. When a rendering error occurs:

1. The error message is displayed in a styled error panel.
2. A **collapsible stack trace** section is available for debugging (collapsed by default).
3. Three action buttons are shown:
   - **"Try Again"** — re-renders the component. This button is hidden after 3 consecutive failures to prevent infinite retry loops.
   - **"Go to Dashboard"** — navigates back to `/dashboard`.
   - **"Reload Page"** — performs a full browser page reload.
4. The ErrorBoundary automatically resets its error state on route changes, so navigating to a different step clears the error.

#### Toast Notifications

A global notification system displays transient messages in the top-right corner of the viewport:

- **Error toasts (red)**: Displayed for server errors (HTTP 5xx responses). Show the error message from the API response.
- **Warning toasts (amber)**: Displayed for client errors (HTTP 4xx responses) such as validation failures or permission denials.
- **Success toasts (green)**: Displayed when actions complete successfully (e.g., "Document generated", "Protocol locked").
- **Info toasts (blue)**: Displayed for informational messages (e.g., "Computation started, results will appear shortly").

Toasts auto-dismiss after 5 seconds. A maximum of 5 toasts are visible simultaneously; additional toasts queue and appear as earlier ones dismiss.

### Navigation

#### Sidebar

The sidebar is always visible on the left side of the screen when inside a project. It contains:

- **Project selector dropdown** at the top — switch between projects without returning to the dashboard.
- **10-step workflow list** — each step displayed with its name and completion indicator. Clicking a step navigates to it.
- **User menu** at the bottom — shows the current user's name and avatar, with a dropdown containing:
  - **Theme toggle** — switch between dark mode and light mode.
  - **Logout** — ends the session and returns to the login screen.

#### Breadcrumbs

A breadcrumb trail is displayed at the top of the main content area, showing the user's current position in the navigation hierarchy. Example: `Dashboard > KEYNOTE-042 Replication > Step 6: Effect Estimation`.

### Theme

The application supports two themes:

- **Dark mode** (default): Uses a slate/zinc base palette with blue and emerald accent colors. Designed for extended use in clinical research settings where analysts may work for long hours.
- **Light mode**: A high-contrast light theme for users who prefer it or for presentation contexts.

Theme preference is toggled via the user menu in the sidebar and persists across sessions.

---

## 8. Data Security and Compliance

Afarensis Enterprise implements multiple layers of security and compliance controls appropriate for handling clinical research data.

### Authentication and Authorization

- **JWT Bearer tokens**: All API requests (except authentication endpoints) require a valid JWT token in the Authorization header. Tokens are issued on login and have a configurable expiration.
- **Token rotation**: Refresh tokens are rotated on each use. The server detects token reuse (a sign of token theft) and invalidates the entire token family.
- **Rate limiting on auth endpoints**: Login attempts are limited to 5 per minute per IP address to mitigate brute-force attacks.

### Access Control

- **Role-based access control (RBAC)**: Four roles (Admin > Reviewer > Analyst > Viewer) with hierarchical permissions. Each API endpoint enforces the minimum required role.
- **Organization-scoped data isolation**: Users can only access data belonging to their organization. All database queries are scoped by `org_id`.
- **Multi-tenant cache keys**: Cached data includes the `org_id` in the cache key, preventing cross-organization data leakage through the caching layer.

### Data Protection

- **HIPAA consent gate**: Before any patient-level data can be uploaded, users must pass through a consent gate confirming IRB approval and patient consent.
- **8 regulatory compliance checks**: Every data ingestion event triggers 8 automated checks: de-identification verification, consent documentation, minimum necessary standard, access logging, encryption verification, audit trail creation, retention policy assignment, and breach notification readiness.
- **AES-256 encryption at rest**: Patient data and sensitive outputs are encrypted using AES-256. Encryption is configurable and can be enabled or disabled at the deployment level.

### Audit and Retention

- **Immutable audit logs**: All significant actions are logged to an append-only audit trail that cannot be modified or deleted.
- **7-year retention**: Audit logs are retained for a minimum of 7 years, consistent with FDA 21 CFR Part 11 and ICH E6(R2) requirements.
- **Cascade delete rules**: Database relationships enforce cascade delete rules to maintain referential integrity when projects or organizations are removed, while preserving audit records.

---

*END OF PRODUCT GUIDE v2.1.0*

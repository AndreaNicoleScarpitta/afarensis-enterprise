"""
Afarensis Enterprise — Study DAG Generator

Generates study-specific Directed Acyclic Graphs (DAGs) from parsed
specifications or default templates.
"""

import uuid
from datetime import datetime


def _node(project_id: str, key: str, label: str, category: str,
          order_index: int, description: str = "", config: dict = None,
          page_route: str = None, status: str = "pending") -> dict:
    """Helper to build a DAG node dict."""
    return {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "key": key,
        "label": label,
        "category": category,
        "description": description or "",
        "status": status,
        "order_index": order_index,
        "config": config or {},
        "page_route": page_route or "",
        "created_at": datetime.utcnow().isoformat(),
    }


def _edge(project_id: str, from_key: str, to_key: str,
          edge_type: str = "dependency") -> dict:
    """Helper to build a DAG edge dict."""
    return {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "from_node_key": from_key,
        "to_node_key": to_key,
        "edge_type": edge_type,
    }


# ---------------------------------------------------------------------------
# Default DAG
# ---------------------------------------------------------------------------

def generate_default_dag(project_id: str) -> dict:
    """Generate a minimal default DAG for projects without a SAP."""
    nodes = [
        _node(project_id, "data_ingestion", "Data Ingestion", "data_ingestion", 0,
              "Ingest and validate source datasets"),
        _node(project_id, "population_definition", "Population Definition", "population", 1,
              "Define target and source populations"),
        _node(project_id, "cohort_construction", "Cohort Construction", "population", 2,
              "Build treatment and comparator cohorts"),
        _node(project_id, "ps_estimation", "Propensity Score Estimation", "population", 3,
              "Estimate propensity scores and assess overlap"),
        _node(project_id, "primary_analysis", "Primary Analysis", "primary", 4,
              "Execute primary endpoint analysis"),
        _node(project_id, "sensitivity_analysis", "Sensitivity Analyses", "sensitivity", 5,
              "Run pre-specified sensitivity analyses"),
        _node(project_id, "regulatory_output", "Regulatory Output Generation", "output", 6,
              "Generate tables, figures, and listings"),
        _node(project_id, "evidence_package", "Evidence Package Export", "output", 7,
              "Compile final evidence package for submission"),
    ]

    edges = [
        _edge(project_id, "data_ingestion", "population_definition"),
        _edge(project_id, "population_definition", "cohort_construction"),
        _edge(project_id, "cohort_construction", "ps_estimation"),
        _edge(project_id, "ps_estimation", "primary_analysis"),
        _edge(project_id, "primary_analysis", "sensitivity_analysis"),
        _edge(project_id, "sensitivity_analysis", "regulatory_output"),
        _edge(project_id, "regulatory_output", "evidence_package"),
    ]

    return {"nodes": nodes, "edges": edges}


# ---------------------------------------------------------------------------
# Spec-driven DAG
# ---------------------------------------------------------------------------

async def generate_dag_from_specification(project_id: str, parsed_spec: dict, db) -> dict:
    """Generate a study-specific DAG from a parsed specification.

    Takes the parsed SAP fields (indication, population_definition, primary_endpoint,
    secondary_endpoints, sample_size, follow_up_period, subgroups, sensitivity_analyses)
    and generates appropriate DAG nodes and edges.
    """
    from sqlalchemy import delete as sa_delete
    from app.models import DAGNode, DAGEdge

    # Delete existing DAG for this project
    await db.execute(sa_delete(DAGEdge).where(DAGEdge.project_id == project_id))
    await db.execute(sa_delete(DAGNode).where(DAGNode.project_id == project_id))

    nodes = []
    edges = []
    order = 0

    # --- Always present: ingestion → population → cohort → PS ---
    nodes.append(_node(project_id, "data_ingestion", "Data Ingestion", "data_ingestion", order,
                       "Ingest and validate source datasets"))
    order += 1

    pop_label = "Population Definition"
    pop_desc = parsed_spec.get("population_definition", "Define target and source populations")
    nodes.append(_node(project_id, "population_definition", pop_label, "population", order,
                       description=pop_desc))
    order += 1

    nodes.append(_node(project_id, "cohort_construction", "Cohort Construction", "population", order,
                       "Build treatment and comparator cohorts"))
    order += 1

    nodes.append(_node(project_id, "ps_estimation", "Propensity Score Estimation", "population", order,
                       "Estimate propensity scores and assess covariate balance"))
    order += 1

    edges.append(_edge(project_id, "data_ingestion", "population_definition"))
    edges.append(_edge(project_id, "population_definition", "cohort_construction"))
    edges.append(_edge(project_id, "cohort_construction", "ps_estimation"))

    # --- Primary endpoint ---
    analysis_keys = []
    primary_ep = parsed_spec.get("primary_endpoint", "")
    if primary_ep:
        key = "primary_analysis"
        nodes.append(_node(project_id, key, f"Primary: {primary_ep[:80]}", "primary", order,
                           description=primary_ep,
                           config={"endpoint": primary_ep}))
        edges.append(_edge(project_id, "ps_estimation", key))
        analysis_keys.append(key)
        order += 1

    # --- Secondary endpoints ---
    secondary_eps = parsed_spec.get("secondary_endpoints", [])
    if isinstance(secondary_eps, str):
        import json as _json
        try:
            secondary_eps = _json.loads(secondary_eps)
        except Exception:
            secondary_eps = [secondary_eps]

    for idx, ep in enumerate(secondary_eps or []):
        ep_text = ep if isinstance(ep, str) else str(ep)
        key = f"secondary_{idx}"
        nodes.append(_node(project_id, key, f"Secondary: {ep_text[:80]}", "secondary", order,
                           description=ep_text,
                           config={"endpoint": ep_text}))
        edges.append(_edge(project_id, "ps_estimation", key))
        analysis_keys.append(key)
        order += 1

    # --- Subgroup analyses ---
    subgroups = parsed_spec.get("subgroups", [])
    if isinstance(subgroups, str):
        import json as _json
        try:
            subgroups = _json.loads(subgroups)
        except Exception:
            subgroups = [subgroups]

    for idx, sg in enumerate(subgroups or []):
        sg_text = sg if isinstance(sg, str) else str(sg)
        key = f"subgroup_{idx}"
        nodes.append(_node(project_id, key, f"Subgroup: {sg_text[:80]}", "subgroup", order,
                           description=sg_text,
                           config={"subgroup": sg_text}))
        # Subgroups depend on primary
        parent = "primary_analysis" if "primary_analysis" in [n["key"] for n in nodes] else "ps_estimation"
        edges.append(_edge(project_id, parent, key))
        analysis_keys.append(key)
        order += 1

    # --- Sensitivity analyses ---
    sensitivity = parsed_spec.get("sensitivity_analyses", [])
    if isinstance(sensitivity, str):
        import json as _json
        try:
            sensitivity = _json.loads(sensitivity)
        except Exception:
            sensitivity = [sensitivity]

    if not sensitivity:
        # Create a default sensitivity node
        sensitivity = ["Standard Sensitivity Analysis"]

    for idx, sa in enumerate(sensitivity):
        sa_text = sa if isinstance(sa, str) else str(sa)
        key = f"sensitivity_{idx}"
        nodes.append(_node(project_id, key, f"Sensitivity: {sa_text[:80]}", "sensitivity", order,
                           description=sa_text,
                           config={"analysis": sa_text}))
        parent = "primary_analysis" if "primary_analysis" in [n["key"] for n in nodes] else "ps_estimation"
        edges.append(_edge(project_id, parent, key))
        analysis_keys.append(key)
        order += 1

    # --- Safety analysis ---
    indication = parsed_spec.get("indication", "")
    safety_key = "safety_analysis"
    nodes.append(_node(project_id, safety_key, "Safety Analysis", "safety", order,
                       description=f"Safety evaluation for {indication}" if indication else "Safety evaluation",
                       config={"indication": indication}))
    edges.append(_edge(project_id, "ps_estimation", safety_key))
    analysis_keys.append(safety_key)
    order += 1

    # --- Outputs ---
    nodes.append(_node(project_id, "regulatory_output", "Regulatory Output Generation", "output", order,
                       "Generate tables, figures, and listings for regulatory submission"))
    order += 1
    nodes.append(_node(project_id, "evidence_package", "Evidence Package Export", "output", order,
                       "Compile final evidence package for submission"))

    # All analysis nodes feed into regulatory output
    for akey in analysis_keys:
        edges.append(_edge(project_id, akey, "regulatory_output"))
    edges.append(_edge(project_id, "regulatory_output", "evidence_package"))

    # --- Persist to DB ---
    for n in nodes:
        node = DAGNode(
            id=n["id"],
            project_id=n["project_id"],
            key=n["key"],
            label=n["label"],
            category=n["category"],
            description=n["description"],
            status=n["status"],
            order_index=n["order_index"],
            config=n["config"],
            page_route=n["page_route"],
        )
        db.add(node)

    for e in edges:
        edge = DAGEdge(
            id=e["id"],
            project_id=e["project_id"],
            from_node_key=e["from_node_key"],
            to_node_key=e["to_node_key"],
            edge_type=e["edge_type"],
        )
        db.add(edge)

    await db.flush()

    return {"nodes": nodes, "edges": edges}


# ---------------------------------------------------------------------------
# Clarity AD demo DAG
# ---------------------------------------------------------------------------

def generate_clarity_ad_dag(project_id: str) -> dict:
    """Generate a realistic Clarity AD (lecanemab) DAG for demo purposes."""
    nodes = [
        _node(project_id, "data_ingestion", "Data Ingestion: CLARITY AD Phase 3 Dataset",
              "data_ingestion", 0,
              "Ingest CLARITY AD Phase 3 clinical trial data (N=1795)",
              config={"dataset": "CLARITY-AD Phase 3", "n_subjects": 1795}),

        _node(project_id, "population_definition",
              "Population Definition: Early AD with confirmed amyloid pathology",
              "population", 1,
              "Adults aged 50-90 with confirmed amyloid pathology, CDR global 0.5 or 1, MMSE 22-30",
              config={"age_range": "50-90", "cdrsb_range": "0.5-1.0", "mmse_range": "22-30"}),

        _node(project_id, "cohort_construction",
              "Cohort Construction: Treatment (Lecanemab 10mg/kg biweekly) vs Placebo",
              "population", 2,
              "Construct treatment (lecanemab 10 mg/kg IV biweekly) and placebo cohorts from randomized arms",
              config={"treatment": "Lecanemab 10mg/kg IV biweekly", "comparator": "Placebo", "randomization": "1:1"}),

        _node(project_id, "ps_estimation",
              "Propensity Score Estimation",
              "population", 3,
              "Estimate propensity scores using IPTW; balance on age, sex, ApoE4 status, baseline CDR-SB, baseline MMSE",
              config={"method": "IPTW", "covariates": ["age", "sex", "apoe4_carrier", "baseline_cdrsb", "baseline_mmse", "race", "education_years"]}),

        _node(project_id, "primary_cdrsb",
              "Primary: CDR-SB Change from Baseline at 18 months (MMRM)",
              "primary", 4,
              "Mixed-effects model for repeated measures analysis of CDR-SB change from baseline at 18 months",
              config={"endpoint": "CDR-SB", "method": "MMRM", "timepoint": "18 months", "estimand": "ITT"}),

        _node(project_id, "secondary_adas_cog",
              "Secondary: ADAS-Cog14 Change from Baseline",
              "secondary", 5,
              "ADAS-Cog14 change from baseline at 18 months using MMRM",
              config={"endpoint": "ADAS-Cog14", "method": "MMRM", "timepoint": "18 months"}),

        _node(project_id, "secondary_adcoms",
              "Secondary: ADCOMS Change from Baseline",
              "secondary", 6,
              "AD Composite Score (ADCOMS) change from baseline at 18 months",
              config={"endpoint": "ADCOMS", "method": "MMRM", "timepoint": "18 months"}),

        _node(project_id, "secondary_adl",
              "Secondary: ADCS-MCI-ADL Change from Baseline",
              "secondary", 7,
              "ADCS-MCI-ADL functional scale change from baseline at 18 months",
              config={"endpoint": "ADCS-MCI-ADL", "method": "MMRM", "timepoint": "18 months"}),

        _node(project_id, "subgroup_apoe4",
              "Subgroup: APOE4 Carrier Status",
              "subgroup", 8,
              "Pre-specified subgroup analysis by APOE4 carrier vs non-carrier status on CDR-SB primary endpoint",
              config={"subgroup_variable": "apoe4_carrier", "endpoint": "CDR-SB"}),

        _node(project_id, "subgroup_disease_stage",
              "Subgroup: Disease Stage (MCI vs Mild AD)",
              "subgroup", 9,
              "Pre-specified subgroup analysis by disease stage: MCI due to AD vs mild AD dementia",
              config={"subgroup_variable": "disease_stage", "levels": ["MCI due to AD", "Mild AD dementia"], "endpoint": "CDR-SB"}),

        _node(project_id, "sensitivity_pp",
              "Sensitivity: Per-Protocol Population",
              "sensitivity", 10,
              "Repeat primary analysis in per-protocol population (excluding major protocol deviations)",
              config={"population": "per_protocol", "endpoint": "CDR-SB"}),

        _node(project_id, "sensitivity_mi",
              "Sensitivity: Multiple Imputation for Missing Data",
              "sensitivity", 11,
              "Multiple imputation sensitivity analysis for missing data under MAR and MNAR assumptions",
              config={"method": "multiple_imputation", "assumptions": ["MAR", "MNAR"], "n_imputations": 50}),

        _node(project_id, "safety_aria",
              "Safety: ARIA-E and ARIA-H Incidence Analysis",
              "safety", 12,
              "Amyloid-related imaging abnormalities (ARIA) incidence, severity, and outcomes analysis",
              config={"events": ["ARIA-E", "ARIA-H"], "monitoring_schedule": "baseline, weeks 5, 14, 52"}),

        _node(project_id, "regulatory_output",
              "Regulatory Output Generation",
              "output", 13,
              "Generate TFLs, CSR sections, and regulatory submission artifacts"),

        _node(project_id, "evidence_package",
              "Evidence Package Export",
              "output", 14,
              "Compile final evidence package including eCTD modules for FDA submission"),
    ]

    edges = [
        # Core pipeline
        _edge(project_id, "data_ingestion", "population_definition"),
        _edge(project_id, "population_definition", "cohort_construction"),
        _edge(project_id, "cohort_construction", "ps_estimation"),

        # PS → all analyses
        _edge(project_id, "ps_estimation", "primary_cdrsb"),
        _edge(project_id, "ps_estimation", "secondary_adas_cog"),
        _edge(project_id, "ps_estimation", "secondary_adcoms"),
        _edge(project_id, "ps_estimation", "secondary_adl"),
        _edge(project_id, "ps_estimation", "safety_aria"),

        # Primary → subgroups & sensitivity
        _edge(project_id, "primary_cdrsb", "subgroup_apoe4"),
        _edge(project_id, "primary_cdrsb", "subgroup_disease_stage"),
        _edge(project_id, "primary_cdrsb", "sensitivity_pp"),
        _edge(project_id, "primary_cdrsb", "sensitivity_mi"),

        # All analysis nodes → regulatory output
        _edge(project_id, "primary_cdrsb", "regulatory_output"),
        _edge(project_id, "secondary_adas_cog", "regulatory_output"),
        _edge(project_id, "secondary_adcoms", "regulatory_output"),
        _edge(project_id, "secondary_adl", "regulatory_output"),
        _edge(project_id, "subgroup_apoe4", "regulatory_output"),
        _edge(project_id, "subgroup_disease_stage", "regulatory_output"),
        _edge(project_id, "sensitivity_pp", "regulatory_output"),
        _edge(project_id, "sensitivity_mi", "regulatory_output"),
        _edge(project_id, "safety_aria", "regulatory_output"),

        # Output → evidence package
        _edge(project_id, "regulatory_output", "evidence_package"),
    ]

    return {"nodes": nodes, "edges": edges}

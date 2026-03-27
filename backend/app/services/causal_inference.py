"""
Causal Inference Service — Backdoor criterion, d-separation, adjustment set derivation.

Implements Pearl's do-calculus fundamentals for computing valid adjustment sets
from a user-specified causal DAG. This is the engine that turns a causal
specification into actionable analysis decisions.
"""
from __future__ import annotations

import hashlib
import json
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any

# ── Node roles in the causal DAG ──────────────────────────────────────────

VALID_ROLES = {
    "treatment",
    "outcome",
    "confounder",
    "mediator",
    "collider",
    "effect_modifier",
    "instrument",
    "competing_risk",
    "censoring",
    "selection",
    "auxiliary",       # precision variable, not on causal path
    "time_zero",       # index date definition node
}

VALID_EDGE_RELATIONSHIPS = {
    "causes",
    "mediates",
    "confounds",
    "collides",
    "modifies",
    "selects",
    "censors",
    "associates",
}

VALID_EDGE_STRENGTHS = {"strong", "moderate", "weak", "assumed"}

VALID_ESTIMAND_TYPES = {"ATT", "ATE", "ATEN", "CATE"}

VALID_OUTCOME_TYPES = {"time-to-event", "continuous", "binary", "count", "composite"}


# ── Graph helpers ─────────────────────────────────────────────────────────

def _build_adjacency(edges: list[dict]) -> tuple[dict, dict]:
    """Build parent→children and child→parents adjacency lists."""
    children: dict[str, set[str]] = defaultdict(set)
    parents: dict[str, set[str]] = defaultdict(set)
    for e in edges:
        src = e["from_node"]
        dst = e["to_node"]
        children[src].add(dst)
        parents[dst].add(src)
    return dict(children), dict(parents)


def find_ancestors(node_id: str, parents: dict[str, set[str]]) -> set[str]:
    """Find all ancestors of a node (transitive parents)."""
    visited: set[str] = set()
    queue = deque([node_id])
    while queue:
        n = queue.popleft()
        for p in parents.get(n, set()):
            if p not in visited:
                visited.add(p)
                queue.append(p)
    return visited


def find_descendants(node_id: str, children: dict[str, set[str]]) -> set[str]:
    """Find all descendants of a node (transitive children)."""
    visited: set[str] = set()
    queue = deque([node_id])
    while queue:
        n = queue.popleft()
        for c in children.get(n, set()):
            if c not in visited:
                visited.add(c)
                queue.append(c)
    return visited


def validate_dag_acyclicity(nodes: list[dict], edges: list[dict]) -> tuple[bool, list[str]]:
    """
    Check that the graph is a valid DAG (no cycles) using Kahn's algorithm.
    Returns (is_acyclic, topological_order).
    """
    node_ids = {n["id"] for n in nodes}
    children, parents = _build_adjacency(edges)

    in_degree: dict[str, int] = {nid: 0 for nid in node_ids}
    for e in edges:
        if e["to_node"] in in_degree:
            in_degree[e["to_node"]] += 1

    queue = deque([n for n, d in in_degree.items() if d == 0])
    order: list[str] = []

    while queue:
        n = queue.popleft()
        order.append(n)
        for c in children.get(n, set()):
            if c in in_degree:
                in_degree[c] -= 1
                if in_degree[c] == 0:
                    queue.append(c)

    is_acyclic = len(order) == len(node_ids)
    return is_acyclic, order


# ── Backdoor criterion ───────────────────────────────────────────────────

def compute_adjustment_set(
    nodes: list[dict],
    edges: list[dict],
    treatment_id: str,
    outcome_id: str,
) -> dict[str, Any]:
    """
    Compute the adjustment set using the backdoor criterion.

    Given a causal DAG with treatment T and outcome Y:
    1. The adjustment set must block all backdoor (non-causal) paths from T to Y
    2. Must not include descendants of T that are on the causal path (mediators)
    3. Must not condition on colliders that open non-causal paths
    4. Must not include instruments (only affect T, not Y directly)

    Returns:
        {
            "adjustment_set": [node_ids...],
            "adjustment_labels": [labels...],
            "excluded_mediators": [node_ids...],
            "excluded_colliders": [node_ids...],
            "excluded_instruments": [node_ids...],
            "explanation": str,
            "warnings": [str...]
        }
    """
    node_map = {n["id"]: n for n in nodes}
    children, parents = _build_adjacency(edges)

    # Validate
    if treatment_id not in node_map:
        return {"error": f"Treatment node '{treatment_id}' not found in DAG"}
    if outcome_id not in node_map:
        return {"error": f"Outcome node '{outcome_id}' not found in DAG"}

    # Descendants of treatment (includes mediators — don't adjust for these)
    treatment_descendants = find_descendants(treatment_id, children)

    # Ancestors of outcome (only need to worry about nodes that can reach Y)
    outcome_ancestors = find_ancestors(outcome_id, parents)

    # Classify each node
    adjustment_set: list[str] = []
    excluded_mediators: list[str] = []
    excluded_colliders: list[str] = []
    excluded_instruments: list[str] = []
    explanations: list[str] = []
    warnings: list[str] = []

    for n in nodes:
        nid = n["id"]
        role = n.get("role", "")

        # Skip treatment and outcome themselves
        if nid in (treatment_id, outcome_id):
            continue

        # Skip time_zero — not a variable to adjust for
        if role == "time_zero":
            continue

        # Mediators: descendants of treatment on the causal path to outcome
        if role == "mediator" or (nid in treatment_descendants and nid in outcome_ancestors):
            excluded_mediators.append(nid)
            explanations.append(
                f"'{n.get('label', nid)}' excluded: mediator on causal path from treatment to outcome. "
                "Adjusting would block the causal effect we're estimating."
            )
            continue

        # Colliders: conditioning on a collider opens a non-causal path
        if role == "collider":
            excluded_colliders.append(nid)
            explanations.append(
                f"'{n.get('label', nid)}' excluded: collider. "
                "Conditioning on a collider opens spurious associations (collider bias)."
            )
            continue

        # Instruments: affect treatment but not outcome directly
        if role == "instrument":
            excluded_instruments.append(nid)
            explanations.append(
                f"'{n.get('label', nid)}' excluded: instrument. "
                "Instruments affect treatment assignment but not outcome directly — "
                "useful for IV analysis but not adjustment."
            )
            continue

        # Competing risks: special handling
        if role == "competing_risk":
            warnings.append(
                f"'{n.get('label', nid)}' is a competing risk. "
                "Consider competing risk analysis (Fine-Gray) in addition to standard adjustment."
            )
            continue

        # Confounders and effect modifiers: INCLUDE in adjustment set
        if role in ("confounder", "effect_modifier", "auxiliary", "censoring", "selection"):
            adjustment_set.append(nid)
            reason = {
                "confounder": "common cause of treatment and outcome — must adjust to remove confounding",
                "effect_modifier": "modifies the treatment effect — include for stratum-specific estimates",
                "auxiliary": "precision variable — improves efficiency without introducing bias",
                "censoring": "associated with censoring mechanism — adjust to reduce informative censoring bias",
                "selection": "selection variable — adjust to correct for selection bias",
            }.get(role, "included in adjustment set")
            explanations.append(f"'{n.get('label', nid)}' included: {reason}.")

    # Build adjustment labels
    adjustment_labels = [node_map[nid].get("label", nid) for nid in adjustment_set if nid in node_map]

    # Check for unmeasured confounders
    unmeasured = [
        n for n in nodes
        if n.get("role") == "confounder"
        and n.get("measurement_status") == "unmeasured"
    ]
    if unmeasured:
        for u in unmeasured:
            warnings.append(
                f"'{u.get('label', u['id'])}' is an unmeasured confounder. "
                "Residual confounding may bias the estimate. "
                "Consider sensitivity analysis (E-value) to quantify robustness."
            )

    # Summary
    summary = (
        f"Adjustment set contains {len(adjustment_set)} variable(s). "
        f"Excluded: {len(excluded_mediators)} mediator(s), "
        f"{len(excluded_colliders)} collider(s), "
        f"{len(excluded_instruments)} instrument(s). "
    )
    if warnings:
        summary += f"{len(warnings)} warning(s) issued."

    return {
        "adjustment_set": adjustment_set,
        "adjustment_labels": adjustment_labels,
        "excluded_mediators": excluded_mediators,
        "excluded_colliders": excluded_colliders,
        "excluded_instruments": excluded_instruments,
        "explanation": summary,
        "explanations": explanations,
        "warnings": warnings,
    }


# ── Causal specification validation ──────────────────────────────────────

def validate_causal_specification(spec: dict) -> dict[str, Any]:
    """
    Validate a causal specification for completeness and consistency.
    Returns {valid: bool, errors: [...], warnings: [...]}.
    """
    errors: list[str] = []
    warnings: list[str] = []

    # Required top-level fields
    if not spec.get("treatment"):
        errors.append("Treatment definition is required.")
    if not spec.get("outcome"):
        errors.append("Outcome definition is required.")
    if not spec.get("estimand"):
        errors.append("Estimand definition is required.")

    nodes = spec.get("nodes", [])
    edges = spec.get("edges", [])

    if len(nodes) < 2:
        errors.append("DAG must have at least treatment and outcome nodes.")

    # Check for treatment and outcome nodes
    node_ids = {n["id"] for n in nodes}
    roles = {n.get("role") for n in nodes}

    if "treatment" not in roles:
        errors.append("DAG must contain at least one node with role='treatment'.")
    if "outcome" not in roles:
        errors.append("DAG must contain at least one node with role='outcome'.")

    # Validate edges reference existing nodes
    for e in edges:
        if e.get("from_node") not in node_ids:
            errors.append(f"Edge references unknown source node '{e.get('from_node')}'.")
        if e.get("to_node") not in node_ids:
            errors.append(f"Edge references unknown target node '{e.get('to_node')}'.")

    # Check acyclicity
    if nodes and edges:
        is_acyclic, _ = validate_dag_acyclicity(nodes, edges)
        if not is_acyclic:
            errors.append("Graph contains a cycle — must be a directed acyclic graph (DAG).")

    # Check for isolated nodes (no edges)
    connected = set()
    for e in edges:
        connected.add(e.get("from_node"))
        connected.add(e.get("to_node"))
    isolated = node_ids - connected
    # Treatment and outcome being isolated is an error; others are warnings
    for nid in isolated:
        node = next((n for n in nodes if n["id"] == nid), None)
        if node and node.get("role") in ("treatment", "outcome"):
            errors.append(f"'{node.get('label', nid)}' ({node.get('role')}) has no edges — must be connected in the DAG.")
        elif node:
            warnings.append(f"'{node.get('label', nid)}' has no edges — consider if it should be connected.")

    # Estimand validation
    estimand = spec.get("estimand", {})
    if estimand.get("type") and estimand["type"] not in VALID_ESTIMAND_TYPES:
        errors.append(f"Invalid estimand type '{estimand['type']}'. Must be one of {VALID_ESTIMAND_TYPES}.")

    # Outcome type validation
    outcome = spec.get("outcome", {})
    if outcome.get("type") and outcome["type"] not in VALID_OUTCOME_TYPES:
        warnings.append(f"Unusual outcome type '{outcome['type']}'. Expected one of {VALID_OUTCOME_TYPES}.")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "node_count": len(nodes),
        "edge_count": len(edges),
    }


# ── Content hashing ──────────────────────────────────────────────────────

def compute_spec_hash(spec: dict) -> str:
    """Compute a deterministic SHA-256 hash of the causal specification content."""
    # Only hash the substantive fields, not metadata
    hashable = {
        "estimand": spec.get("estimand"),
        "treatment": spec.get("treatment"),
        "outcome": spec.get("outcome"),
        "time_zero": spec.get("time_zero"),
        "nodes": sorted(spec.get("nodes", []), key=lambda n: n.get("id", "")),
        "edges": sorted(
            spec.get("edges", []),
            key=lambda e: (e.get("from_node", ""), e.get("to_node", "")),
        ),
        "assumptions": spec.get("assumptions"),
        "censoring_logic": spec.get("censoring_logic"),
    }
    raw = json.dumps(hashable, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Template causal specs for common designs ─────────────────────────────

def generate_template_spec(design_type: str) -> dict:
    """Generate a template causal specification for common RWE study designs."""
    templates = {
        "cohort_tte": {
            "estimand": {"type": "ATT", "summary": "Average treatment effect on the treated for time-to-event outcome"},
            "treatment": {"variable": "", "levels": ["treatment", "comparator"], "reference_arm": "comparator"},
            "outcome": {"variable": "", "type": "time-to-event", "definition": ""},
            "time_zero": {"definition": "Date of first treatment exposure", "rationale": "Target trial emulation anchor"},
            "nodes": [
                {"id": "T", "label": "Treatment", "role": "treatment", "variable_name": "", "rationale": "Exposure of interest"},
                {"id": "Y", "label": "Outcome", "role": "outcome", "variable_name": "", "rationale": "Primary endpoint"},
                {"id": "age", "label": "Age", "role": "confounder", "variable_name": "AGE", "rationale": "Common cause of treatment selection and outcome risk"},
                {"id": "sex", "label": "Sex", "role": "confounder", "variable_name": "SEX", "rationale": "May influence treatment choice and outcome"},
                {"id": "baseline_severity", "label": "Baseline Severity", "role": "confounder", "variable_name": "", "rationale": "Disease severity at index date affects both treatment and prognosis"},
            ],
            "edges": [
                {"from_node": "age", "to_node": "T", "relationship": "confounds", "strength": "moderate"},
                {"from_node": "age", "to_node": "Y", "relationship": "causes", "strength": "strong"},
                {"from_node": "sex", "to_node": "T", "relationship": "confounds", "strength": "weak"},
                {"from_node": "sex", "to_node": "Y", "relationship": "causes", "strength": "moderate"},
                {"from_node": "baseline_severity", "to_node": "T", "relationship": "confounds", "strength": "strong"},
                {"from_node": "baseline_severity", "to_node": "Y", "relationship": "causes", "strength": "strong"},
                {"from_node": "T", "to_node": "Y", "relationship": "causes", "strength": "moderate"},
            ],
            "assumptions": [
                {"id": "a1", "description": "No unmeasured confounding (conditional exchangeability)", "testable": False, "rationale": "Core identification assumption — adjustment set blocks all backdoor paths"},
                {"id": "a2", "description": "Positivity: all covariate strata have nonzero probability of receiving each treatment", "testable": True, "rationale": "Required for propensity score weighting to be well-defined"},
                {"id": "a3", "description": "Consistency: treatment is well-defined with no interference between units", "testable": False, "rationale": "SUTVA — one version of treatment, no spillover"},
                {"id": "a4", "description": "Independent censoring conditional on covariates", "testable": True, "rationale": "Non-informative censoring required for valid survival analysis"},
            ],
            "censoring_logic": {"mechanism": "Administrative end of follow-up or loss to follow-up", "assumption": "independent", "handling": "Inverse probability of censoring weighting (IPCW) if informative censoring suspected"},
        },
    }
    return templates.get(design_type, templates["cohort_tte"])

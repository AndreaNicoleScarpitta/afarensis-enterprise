"""
Assumption Traceability & Evidence Binding Service.

Tracks the four core causal identifiability assumptions required for valid
causal inference from observational data, evaluates each against diagnostic
outputs, models the impact of assumption violations on the hazard ratio,
and binds traceable evidence citations to every claim.

Mathematical foundations:
- Rubin Causal Model (potential outcomes framework)
- Pearl's do-calculus and backdoor criterion
- VanderWeele & Ding E-value methodology
- Rosenbaum sensitivity analysis bounds

References:
    Hernan MA, Robins JM. Causal Inference: What If. 2020.
    VanderWeele TJ, Ding P. Sensitivity analysis in observational research.
        Ann Intern Med. 2017;167(4):268-274.
"""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# ── Assumption type constants ────────────────────────────────────────────

ASSUMPTION_TYPES = {
    "exchangeability",
    "positivity",
    "consistency",
    "independent_censoring",
}

# ── Evaluation status levels (ordered by severity) ───────────────────────

STATUS_SUPPORTED = "supported"
STATUS_PARTIAL = "partial"
STATUS_UNSUPPORTED = "unsupported"
STATUS_VIOLATED = "violated"

STATUS_SEVERITY = {
    STATUS_SUPPORTED: 0,
    STATUS_PARTIAL: 1,
    STATUS_UNSUPPORTED: 2,
    STATUS_VIOLATED: 3,
}

REGULATORY_RISK_LEVELS = ("low", "medium", "high", "critical")


# ── Data classes ─────────────────────────────────────────────────────────

@dataclass
class EvidenceBinding:
    """Traceable link between an assumption and a specific diagnostic output.

    Each binding creates an auditable chain from a causal claim to the
    metric that supports (or refutes) it.
    """
    assumption_id: str
    evidence_type: str          # "diagnostic", "sensitivity", "balance", "simulation"
    metric_name: str
    metric_value: Any
    interpretation: str
    source_section: str         # report section where the metric appears
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class AssumptionRecord:
    """Registry entry for a single identifiability assumption."""
    id: str
    type: str                   # one of ASSUMPTION_TYPES
    math_definition: str
    description: str
    testable: bool
    evaluation_status: str = "pending"
    confidence_level: float = 0.0
    severity: int = 0
    evidence_bindings: List[EvidenceBinding] = field(default_factory=list)
    sensitivity_impact: Dict[str, Any] = field(default_factory=dict)
    supporting_metrics: Dict[str, Any] = field(default_factory=dict)
    regulatory_risk: str = "medium"

    def to_dict(self) -> dict:
        d = asdict(self)
        d["evidence_bindings"] = [eb.to_dict() if isinstance(eb, EvidenceBinding) else eb
                                  for eb in self.evidence_bindings]
        return d


# ══════════════════════════════════════════════════════════════════════════
# Main service
# ══════════════════════════════════════════════════════════════════════════

class AssumptionTraceabilityService:
    """Tracks, evaluates, and binds evidence to causal identifiability assumptions.

    The four core assumptions for valid causal inference from observational
    data are:

    1. **Exchangeability** (no unmeasured confounding):
       Y(1), Y(0) independent of T | X
       The potential outcomes are independent of treatment assignment
       conditional on measured covariates X.

    2. **Positivity** (overlap):
       0 < P(T=1 | X=x) < 1 for all x with P(X=x) > 0
       Every stratum of covariates has a nonzero probability of receiving
       each treatment level.

    3. **Consistency** (SUTVA):
       Y = Y(T) — the observed outcome equals the potential outcome under
       the treatment actually received. Requires well-defined treatment
       with no interference between units.

    4. **Independent censoring** (for survival outcomes):
       C independent of {T(a), Y(a)} | X
       Censoring is independent of potential outcomes and treatment
       conditional on measured covariates.
    """

    # ── 1. Assumption Registry ───────────────────────────────────────────

    def build_assumption_registry(
        self,
        causal_spec: dict,
    ) -> List[AssumptionRecord]:
        """Build a registry of identifiability assumptions from a causal specification.

        Extracts user-declared assumptions from the spec and merges them with
        the four canonical assumptions.  Each assumption gets a unique ID,
        mathematical definition, and testability flag.

        Parameters
        ----------
        causal_spec : dict
            Causal specification containing ``assumptions``, ``nodes``,
            ``edges``, ``outcome``, and ``estimand`` keys.  Matches the
            format produced by ``causal_inference.generate_template_spec``.

        Returns
        -------
        List[AssumptionRecord]
            One record per assumption, ready for evaluation.
        """
        outcome_type = causal_spec.get("outcome", {}).get("type", "time-to-event")
        estimand_type = causal_spec.get("estimand", {}).get("type", "ATT")

        # Canonical definitions
        canonical = [
            AssumptionRecord(
                id="A1_EXCHANGEABILITY",
                type="exchangeability",
                math_definition="Y(1), Y(0) \u22a5 T | X",
                description=(
                    "Conditional exchangeability (no unmeasured confounding). "
                    "All common causes of treatment and outcome are measured "
                    "and included in the adjustment set."
                ),
                testable=False,
            ),
            AssumptionRecord(
                id="A2_POSITIVITY",
                type="positivity",
                math_definition="0 < P(T=1 | X=x) < 1  for all x with P(X=x) > 0",
                description=(
                    "Every covariate stratum has a nonzero probability of "
                    "receiving each treatment level. Required for IPTW weights "
                    "to be finite and propensity score models to be well-defined."
                ),
                testable=True,
            ),
            AssumptionRecord(
                id="A3_CONSISTENCY",
                type="consistency",
                math_definition="Y_i = Y_i(T_i)  (SUTVA: no interference, one version of treatment)",
                description=(
                    "The observed outcome equals the potential outcome under "
                    "the treatment actually received. Requires a well-defined "
                    "treatment with no multiple versions and no interference "
                    "between subjects (Stable Unit Treatment Value Assumption)."
                ),
                testable=False,
            ),
        ]

        # Add independent censoring for survival outcomes
        if outcome_type in ("time-to-event", "composite"):
            canonical.append(
                AssumptionRecord(
                    id="A4_INDEPENDENT_CENSORING",
                    type="independent_censoring",
                    math_definition="C \u22a5 {Y(a), T} | X",
                    description=(
                        "Censoring is independent of potential outcomes and "
                        "treatment conditional on measured covariates. Required "
                        "for Kaplan-Meier and Cox PH validity."
                    ),
                    testable=True,
                )
            )

        # Merge with user-declared assumptions from the spec
        user_assumptions = causal_spec.get("assumptions", [])
        for ua in user_assumptions:
            ua_id = ua.get("id", "")
            # Match user assumptions to canonical ones by keyword
            matched = False
            for rec in canonical:
                if ua_id == rec.id or rec.type in ua.get("description", "").lower():
                    rec.description += f"  [User note: {ua.get('rationale', '')}]"
                    matched = True
                    break
            if not matched:
                # Add as supplementary assumption
                canonical.append(
                    AssumptionRecord(
                        id=ua.get("id", f"A_USER_{len(canonical)}"),
                        type="supplementary",
                        math_definition=ua.get("description", ""),
                        description=ua.get("rationale", ua.get("description", "")),
                        testable=ua.get("testable", False),
                    )
                )

        logger.info(
            "Built assumption registry with %d assumptions (outcome=%s, estimand=%s)",
            len(canonical), outcome_type, estimand_type,
        )
        return canonical

    # ── 2. Assumption Evaluation ─────────────────────────────────────────

    def evaluate_assumption(
        self,
        assumption: AssumptionRecord,
        analysis_results: dict,
        attack_report: Optional[dict] = None,
    ) -> AssumptionRecord:
        """Evaluate a single assumption against diagnostic outputs.

        Dispatches to type-specific evaluators that pull relevant metrics
        from ``analysis_results`` (the output of ``run_full_analysis`` or
        ``run_analysis_from_data``) and the optional ``attack_report``
        (adversarial robustness checks).

        Parameters
        ----------
        assumption : AssumptionRecord
            The assumption to evaluate.
        analysis_results : dict
            Full analysis output from ``StatisticalAnalysisService``.
        attack_report : dict, optional
            Adversarial analysis / sensitivity report.

        Returns
        -------
        AssumptionRecord
            Updated with ``evaluation_status``, ``confidence_level``,
            ``supporting_metrics``, and ``evidence_bindings``.
        """
        evaluators = {
            "exchangeability": self._evaluate_exchangeability,
            "positivity": self._evaluate_positivity,
            "consistency": self._evaluate_consistency,
            "independent_censoring": self._evaluate_independent_censoring,
        }

        evaluator = evaluators.get(assumption.type)
        if evaluator is not None:
            evaluator(assumption, analysis_results, attack_report or {})
        else:
            # Supplementary assumptions — no automated evaluation
            assumption.evaluation_status = STATUS_PARTIAL
            assumption.confidence_level = 0.5
            assumption.supporting_metrics = {
                "note": "Supplementary assumption requires manual review."
            }

        # Derive severity from status
        assumption.severity = STATUS_SEVERITY.get(assumption.evaluation_status, 1)
        assumption.regulatory_risk = self._derive_regulatory_risk(assumption)

        return assumption

    def _evaluate_exchangeability(
        self,
        assumption: AssumptionRecord,
        results: dict,
        attack: dict,
    ) -> None:
        """Evaluate conditional exchangeability (no unmeasured confounding).

        Metrics consulted:
        - E-value (VanderWeele & Ding): quantifies robustness to unmeasured
          confounders.  E = HR + sqrt(HR * (HR - 1)).
        - Covariate balance (max |SMD| across covariates after weighting).
        - DAG completeness: fraction of confounders that are measured.
        - Unmeasured confounding simulations from the attack report.
        """
        metrics: Dict[str, Any] = {}
        bindings: List[EvidenceBinding] = []
        scores: List[float] = []

        # --- E-value ---
        e_value_data = results.get("e_value", {})
        if e_value_data:
            e_point = e_value_data.get("e_value_point", 1.0)
            e_ci = e_value_data.get("e_value_ci", 1.0)
            metrics["e_value_point"] = e_point
            metrics["e_value_ci"] = e_ci

            # Score: E-value CI > 3 → strong, > 2 → moderate, > 1.5 → weak
            if e_ci > 3.0:
                scores.append(0.9)
            elif e_ci > 2.0:
                scores.append(0.7)
            elif e_ci > 1.5:
                scores.append(0.5)
            elif e_ci > 1.0:
                scores.append(0.3)
            else:
                scores.append(0.1)

            bindings.append(EvidenceBinding(
                assumption_id=assumption.id,
                evidence_type="sensitivity",
                metric_name="e_value_ci",
                metric_value=e_ci,
                interpretation=e_value_data.get(
                    "interpretation",
                    f"E-value (CI bound) = {e_ci:.2f}",
                ),
                source_section="sensitivity_analyses.e_value",
            ))

        # --- Covariate balance (SMD) ---
        balance_data = results.get("balance", results.get("covariate_balance", {}))
        if isinstance(balance_data, dict):
            max_smd = balance_data.get("max_abs_smd_weighted",
                      balance_data.get("max_abs_smd", None))
            if max_smd is None:
                # Try to compute from individual SMDs
                smds = balance_data.get("weighted_smds", balance_data.get("smds", {}))
                if isinstance(smds, dict) and smds:
                    max_smd = max(abs(v) if isinstance(v, (int, float))
                                  else abs(v.get("abs_smd", 0))
                                  for v in smds.values())
            if max_smd is not None:
                metrics["max_abs_smd_weighted"] = float(max_smd)
                # Score: |SMD| < 0.05 excellent, < 0.1 good, < 0.2 fair
                if max_smd < 0.05:
                    scores.append(0.95)
                elif max_smd < 0.1:
                    scores.append(0.8)
                elif max_smd < 0.2:
                    scores.append(0.5)
                else:
                    scores.append(0.2)

                bindings.append(EvidenceBinding(
                    assumption_id=assumption.id,
                    evidence_type="balance",
                    metric_name="max_abs_smd_weighted",
                    metric_value=float(max_smd),
                    interpretation=(
                        f"Maximum |SMD| after weighting = {max_smd:.3f}. "
                        f"{'Well balanced (< 0.1).' if max_smd < 0.1 else 'Imbalance detected.'}"
                    ),
                    source_section="covariate_balance",
                ))

        # --- DAG completeness (fraction of confounders measured) ---
        dag_info = results.get("dag", results.get("causal_spec", {}))
        nodes = dag_info.get("nodes", [])
        confounders = [n for n in nodes if n.get("role") == "confounder"]
        if confounders:
            measured = sum(1 for n in confounders
                          if n.get("measurement_status", "measured") != "unmeasured")
            completeness = measured / len(confounders)
            metrics["dag_completeness"] = float(completeness)
            scores.append(completeness)
            bindings.append(EvidenceBinding(
                assumption_id=assumption.id,
                evidence_type="diagnostic",
                metric_name="dag_completeness",
                metric_value=float(completeness),
                interpretation=(
                    f"{measured}/{len(confounders)} confounders measured "
                    f"({completeness:.0%} completeness)."
                ),
                source_section="causal_dag",
            ))

        # --- Attack report: unmeasured confounding simulation ---
        unmeasured_sim = attack.get("unmeasured_confounding_simulation", {})
        if unmeasured_sim:
            bias_factor = unmeasured_sim.get("bias_factor", None)
            if bias_factor is not None:
                metrics["simulated_bias_factor"] = float(bias_factor)
                scores.append(max(0.0, 1.0 - float(bias_factor)))
                bindings.append(EvidenceBinding(
                    assumption_id=assumption.id,
                    evidence_type="simulation",
                    metric_name="unmeasured_confounding_bias_factor",
                    metric_value=float(bias_factor),
                    interpretation=f"Simulated bias factor = {bias_factor:.3f}.",
                    source_section="attack_report.unmeasured_confounding",
                ))

        # --- Aggregate ---
        assumption.supporting_metrics = metrics
        assumption.evidence_bindings.extend(bindings)
        assumption.confidence_level = float(np.mean(scores)) if scores else 0.5
        assumption.evaluation_status = self._confidence_to_status(assumption.confidence_level)

    def _evaluate_positivity(
        self,
        assumption: AssumptionRecord,
        results: dict,
        attack: dict,
    ) -> None:
        """Evaluate positivity (treatment overlap across covariate strata).

        Metrics consulted:
        - Propensity score range and overlap region.
        - Effective sample size (ESS) from IPTW weights.
        - Percentage of extreme weights (> 99th percentile).
        - Near-violation count: strata with P(T=1|X) near 0 or 1.
        """
        metrics: Dict[str, Any] = {}
        bindings: List[EvidenceBinding] = []
        scores: List[float] = []

        # --- Propensity score overlap ---
        ps_data = results.get("propensity_scores", {})
        if ps_data:
            ps_min = ps_data.get("min", 0.0)
            ps_max = ps_data.get("max", 1.0)
            auc = ps_data.get("auc", 0.5)

            metrics["ps_range"] = [float(ps_min), float(ps_max)]
            metrics["ps_auc"] = float(auc)

            # Overlap: both groups need PS in a common region
            # Good overlap if PS range spans [~0.1, ~0.9]
            overlap_width = min(ps_max, 0.95) - max(ps_min, 0.05)
            overlap_score = np.clip(overlap_width / 0.8, 0.0, 1.0)
            metrics["overlap_width"] = float(overlap_width)
            scores.append(float(overlap_score))

            bindings.append(EvidenceBinding(
                assumption_id=assumption.id,
                evidence_type="diagnostic",
                metric_name="ps_overlap",
                metric_value={"min": float(ps_min), "max": float(ps_max)},
                interpretation=(
                    f"PS range [{ps_min:.3f}, {ps_max:.3f}]. "
                    f"Overlap region width = {overlap_width:.3f}."
                ),
                source_section="propensity_scores",
            ))

        # --- Effective sample size ---
        iptw_data = results.get("iptw", {})
        ess_data = iptw_data.get("effective_sample_size", {})
        if ess_data:
            ess_treated = ess_data.get("treated", 0.0)
            ess_control = ess_data.get("control", 0.0)
            ess_total = ess_data.get("total", ess_treated + ess_control)
            metrics["ess_treated"] = float(ess_treated)
            metrics["ess_control"] = float(ess_control)
            metrics["ess_total"] = float(ess_total)

            # ESS ratio: ESS / nominal N — closer to 1 means better positivity
            nominal_n = results.get("n_total", ess_total * 2)
            if nominal_n > 0:
                ess_ratio = ess_total / nominal_n
                metrics["ess_ratio"] = float(ess_ratio)
                scores.append(float(np.clip(ess_ratio, 0.0, 1.0)))

            bindings.append(EvidenceBinding(
                assumption_id=assumption.id,
                evidence_type="diagnostic",
                metric_name="effective_sample_size",
                metric_value=ess_data,
                interpretation=(
                    f"ESS: treated={ess_treated:.1f}, control={ess_control:.1f}, "
                    f"total={ess_total:.1f}."
                ),
                source_section="iptw.effective_sample_size",
            ))

        # --- Extreme weight percentage ---
        weight_stats = iptw_data.get("weight_statistics", {})
        if weight_stats:
            pct_extreme = weight_stats.get("pct_extreme", 0.0)
            metrics["extreme_weight_pct"] = float(pct_extreme)

            # Score: < 2% extreme → good, < 5% fair, > 10% poor
            if pct_extreme < 2.0:
                scores.append(0.9)
            elif pct_extreme < 5.0:
                scores.append(0.7)
            elif pct_extreme < 10.0:
                scores.append(0.4)
            else:
                scores.append(0.15)

            bindings.append(EvidenceBinding(
                assumption_id=assumption.id,
                evidence_type="diagnostic",
                metric_name="extreme_weight_pct",
                metric_value=float(pct_extreme),
                interpretation=f"{pct_extreme:.1f}% of weights are extreme (beyond 1st/99th percentile).",
                source_section="iptw.weight_statistics",
            ))

        # --- Near-violation count ---
        trimming = iptw_data.get("trimming", {})
        n_trimmed = trimming.get("n_trimmed", 0)
        if trimming:
            metrics["n_trimmed"] = int(n_trimmed)
            bindings.append(EvidenceBinding(
                assumption_id=assumption.id,
                evidence_type="diagnostic",
                metric_name="n_ps_trimmed",
                metric_value=int(n_trimmed),
                interpretation=f"{n_trimmed} observations had PS trimmed due to near-violations.",
                source_section="iptw.trimming",
            ))

        # --- Aggregate ---
        assumption.supporting_metrics = metrics
        assumption.evidence_bindings.extend(bindings)
        assumption.confidence_level = float(np.mean(scores)) if scores else 0.5
        assumption.evaluation_status = self._confidence_to_status(assumption.confidence_level)

    def _evaluate_consistency(
        self,
        assumption: AssumptionRecord,
        results: dict,
        attack: dict,
    ) -> None:
        """Evaluate consistency / SUTVA.

        This assumption is generally untestable from data alone, but we can
        look for indirect evidence:
        - Treatment definition sensitivity: does the effect change under
          alternative treatment definitions?
        - Protocol deviation rate: high deviations suggest multiple
          treatment versions.
        """
        metrics: Dict[str, Any] = {}
        bindings: List[EvidenceBinding] = []
        scores: List[float] = []

        # --- Treatment sensitivity from attack report ---
        treatment_sens = attack.get("treatment_definition_sensitivity", {})
        if treatment_sens:
            hr_range = treatment_sens.get("hr_range", [])
            if isinstance(hr_range, (list, tuple)) and len(hr_range) >= 2:
                hr_spread = abs(hr_range[1] - hr_range[0])
                metrics["treatment_definition_hr_spread"] = float(hr_spread)
                # Small spread → consistent treatment definition
                if hr_spread < 0.1:
                    scores.append(0.9)
                elif hr_spread < 0.3:
                    scores.append(0.6)
                else:
                    scores.append(0.3)

                bindings.append(EvidenceBinding(
                    assumption_id=assumption.id,
                    evidence_type="sensitivity",
                    metric_name="treatment_definition_hr_spread",
                    metric_value=float(hr_spread),
                    interpretation=(
                        f"HR range across treatment definitions: "
                        f"[{hr_range[0]:.3f}, {hr_range[1]:.3f}] "
                        f"(spread = {hr_spread:.3f})."
                    ),
                    source_section="attack_report.treatment_definition_sensitivity",
                ))

        # --- Protocol deviation rate ---
        deviation_rate = results.get("protocol_deviation_rate",
                         results.get("data_quality", {}).get("protocol_deviation_rate"))
        if deviation_rate is not None:
            metrics["protocol_deviation_rate"] = float(deviation_rate)
            if deviation_rate < 0.05:
                scores.append(0.9)
            elif deviation_rate < 0.15:
                scores.append(0.6)
            else:
                scores.append(0.3)

            bindings.append(EvidenceBinding(
                assumption_id=assumption.id,
                evidence_type="diagnostic",
                metric_name="protocol_deviation_rate",
                metric_value=float(deviation_rate),
                interpretation=(
                    f"Protocol deviation rate = {deviation_rate:.1%}. "
                    f"{'Acceptable.' if deviation_rate < 0.1 else 'Elevated — consider treatment version heterogeneity.'}"
                ),
                source_section="data_quality",
            ))

        # If no metrics available, flag as requiring expert judgment
        if not scores:
            scores.append(0.6)  # prior: moderate confidence by default
            metrics["note"] = (
                "Consistency/SUTVA is generally untestable. "
                "Evaluation relies on study design and expert judgment."
            )

        assumption.supporting_metrics = metrics
        assumption.evidence_bindings.extend(bindings)
        assumption.confidence_level = float(np.mean(scores))
        assumption.evaluation_status = self._confidence_to_status(assumption.confidence_level)

    def _evaluate_independent_censoring(
        self,
        assumption: AssumptionRecord,
        results: dict,
        attack: dict,
    ) -> None:
        """Evaluate independent censoring for survival outcomes.

        Metrics consulted:
        - Censoring balance across treatment arms.
        - Censoring pattern analysis: is the censoring distribution similar
          across arms?
        - KM censoring curve comparison.
        """
        metrics: Dict[str, Any] = {}
        bindings: List[EvidenceBinding] = []
        scores: List[float] = []

        # --- Censoring rates by arm ---
        km_data = results.get("kaplan_meier", {})
        treated_km = km_data.get("treated", km_data.get("treatment", {}))
        control_km = km_data.get("control", km_data.get("comparator", {}))

        if treated_km and control_km:
            censor_treated = treated_km.get("n_censored", 0)
            total_treated = treated_km.get("n_total", treated_km.get("n_at_risk_initial", 1))
            censor_control = control_km.get("n_censored", 0)
            total_control = control_km.get("n_total", control_km.get("n_at_risk_initial", 1))

            rate_treated = censor_treated / max(total_treated, 1)
            rate_control = censor_control / max(total_control, 1)
            rate_diff = abs(rate_treated - rate_control)

            metrics["censoring_rate_treated"] = float(rate_treated)
            metrics["censoring_rate_control"] = float(rate_control)
            metrics["censoring_rate_difference"] = float(rate_diff)

            # Score: small difference → independent censoring likely
            if rate_diff < 0.05:
                scores.append(0.9)
            elif rate_diff < 0.10:
                scores.append(0.7)
            elif rate_diff < 0.20:
                scores.append(0.4)
            else:
                scores.append(0.15)

            bindings.append(EvidenceBinding(
                assumption_id=assumption.id,
                evidence_type="diagnostic",
                metric_name="censoring_rate_balance",
                metric_value={
                    "treated": float(rate_treated),
                    "control": float(rate_control),
                    "difference": float(rate_diff),
                },
                interpretation=(
                    f"Censoring rates: treated={rate_treated:.1%}, "
                    f"control={rate_control:.1%} (diff={rate_diff:.1%}). "
                    f"{'Balanced.' if rate_diff < 0.1 else 'Imbalanced — informative censoring possible.'}"
                ),
                source_section="kaplan_meier",
            ))

        # --- Censoring pattern from sensitivity analyses ---
        censoring_analysis = results.get("sensitivity_analyses", {}).get(
            "censoring_analysis", attack.get("censoring_analysis", {})
        )
        if censoring_analysis:
            informative_flag = censoring_analysis.get("informative_censoring_detected", False)
            metrics["informative_censoring_detected"] = informative_flag
            scores.append(0.2 if informative_flag else 0.85)

            bindings.append(EvidenceBinding(
                assumption_id=assumption.id,
                evidence_type="sensitivity",
                metric_name="informative_censoring_flag",
                metric_value=informative_flag,
                interpretation=(
                    "Informative censoring detected."
                    if informative_flag else
                    "No strong evidence of informative censoring."
                ),
                source_section="sensitivity_analyses.censoring",
            ))

        if not scores:
            scores.append(0.6)
            metrics["note"] = "No censoring diagnostics available for evaluation."

        assumption.supporting_metrics = metrics
        assumption.evidence_bindings.extend(bindings)
        assumption.confidence_level = float(np.mean(scores))
        assumption.evaluation_status = self._confidence_to_status(assumption.confidence_level)

    # ── 3. Impact Modeling ───────────────────────────────────────────────

    def model_assumption_violation_impact(
        self,
        assumption: AssumptionRecord,
        violation_params: dict,
        base_results: dict,
    ) -> Dict[str, Any]:
        """Simulate the impact of an assumption violation on the hazard ratio.

        For each assumption type, this applies a specific bias model to
        compute the plausible range of the HR under violation.

        Parameters
        ----------
        assumption : AssumptionRecord
            The assumption being violated.
        violation_params : dict
            Type-specific parameters controlling violation severity.
            - exchangeability: ``{"confounding_rr": float}`` — risk ratio of
              an unmeasured confounder with both treatment and outcome.
            - positivity: ``{"truncation_range": [float, float]}`` — PS range
              to truncate to.
            - consistency: ``{"noise_sd": float}`` — standard deviation of
              noise added to treatment assignment.
        base_results : dict
            Analysis results containing ``hazard_ratio``, ``ci_lower``,
            ``ci_upper``.

        Returns
        -------
        dict
            ``bias_adjusted_hr``, ``bias_adjusted_ci``, ``bias_magnitude``,
            ``regulatory_risk``, ``interpretation``.

        Mathematical Details
        --------------------
        **Exchangeability breach (Cornfield-type bias formula)**:
            HR_biased = HR_observed * B
            where B = (RR_UD * RR_UY) / (RR_UD * RR_UY - RR_UD - RR_UY + 1)
            simplified for equal confounding: B ≈ gamma^2 / (2*gamma - 1)
            where gamma = confounding_rr.

        **Positivity violation**:
            Truncate propensity scores to [a, b] and recompute IPTW weights.
            HR shifts proportional to lost effective sample size.

        **Consistency violation**:
            Add Gaussian noise to treatment indicator (misclassification).
            HR attenuates toward null by factor (1 - 2*error_rate).
        """
        base_hr = base_results.get("hazard_ratio", base_results.get("hr", 1.0))
        base_ci_lower = base_results.get("ci_lower", base_hr * 0.8)
        base_ci_upper = base_results.get("ci_upper", base_hr * 1.2)
        log_hr = float(np.log(base_hr)) if base_hr > 0 else 0.0

        impact: Dict[str, Any] = {
            "assumption_id": assumption.id,
            "assumption_type": assumption.type,
            "base_hr": float(base_hr),
            "base_ci": [float(base_ci_lower), float(base_ci_upper)],
        }

        if assumption.type == "exchangeability":
            impact.update(self._impact_exchangeability_breach(
                log_hr, base_hr, base_ci_lower, base_ci_upper, violation_params,
            ))

        elif assumption.type == "positivity":
            impact.update(self._impact_positivity_violation(
                log_hr, base_hr, base_ci_lower, base_ci_upper,
                violation_params, base_results,
            ))

        elif assumption.type == "consistency":
            impact.update(self._impact_consistency_violation(
                log_hr, base_hr, base_ci_lower, base_ci_upper, violation_params,
            ))

        elif assumption.type == "independent_censoring":
            impact.update(self._impact_censoring_violation(
                log_hr, base_hr, base_ci_lower, base_ci_upper, violation_params,
            ))

        else:
            impact["bias_adjusted_hr"] = float(base_hr)
            impact["bias_adjusted_ci"] = [float(base_ci_lower), float(base_ci_upper)]
            impact["bias_magnitude"] = 0.0
            impact["regulatory_risk"] = "low"
            impact["interpretation"] = "No violation model for this assumption type."

        # Sensitivity impact stored on the assumption record
        assumption.sensitivity_impact = {
            "hr_shift": impact.get("bias_adjusted_hr", base_hr) - base_hr,
            "ci_shift": [
                impact.get("bias_adjusted_ci", [base_ci_lower])[0] - base_ci_lower,
                impact.get("bias_adjusted_ci", [0, base_ci_upper])[1] - base_ci_upper,
            ],
        }

        return impact

    def _impact_exchangeability_breach(
        self, log_hr: float, base_hr: float,
        ci_lower: float, ci_upper: float,
        params: dict,
    ) -> dict:
        """Cornfield-type bias formula for unmeasured confounding.

        Bias factor B = gamma^2 / (2*gamma - 1) where gamma is the
        confounding risk ratio (assumed equal association with T and Y).
        """
        gamma = float(params.get("confounding_rr", 2.0))
        gamma = max(gamma, 1.01)  # must be > 1

        # Bias factor: B = gamma^2 / (2*gamma - 1)
        bias_factor = (gamma ** 2) / (2.0 * gamma - 1.0)

        # Direction: bias pushes HR toward null if confounder is protective,
        # away from null if confounder inflates the effect.
        # For a harmful confounder, observed HR is biased away from null:
        #   HR_true = HR_observed / B  (if HR < 1, this moves toward 1)
        adjusted_hr = base_hr / bias_factor if base_hr >= 1.0 else base_hr * bias_factor
        adjusted_ci_lower = ci_lower / bias_factor if base_hr >= 1.0 else ci_lower * bias_factor
        adjusted_ci_upper = ci_upper / bias_factor if base_hr >= 1.0 else ci_upper * bias_factor

        # Ensure CI ordering
        adj_ci = sorted([float(adjusted_ci_lower), float(adjusted_ci_upper)])

        bias_mag = abs(adjusted_hr - base_hr) / max(abs(base_hr), 1e-9)

        # Regulatory risk: does the adjusted CI cross the null?
        null_crossed = adj_ci[0] <= 1.0 <= adj_ci[1]

        if null_crossed and bias_mag > 0.3:
            reg_risk = "critical"
        elif null_crossed:
            reg_risk = "high"
        elif bias_mag > 0.2:
            reg_risk = "medium"
        else:
            reg_risk = "low"

        return {
            "bias_adjusted_hr": float(adjusted_hr),
            "bias_adjusted_ci": adj_ci,
            "bias_factor": float(bias_factor),
            "confounding_rr_used": float(gamma),
            "bias_magnitude": float(bias_mag),
            "null_crossed": null_crossed,
            "regulatory_risk": reg_risk,
            "interpretation": (
                f"Under unmeasured confounding with RR={gamma:.1f}, "
                f"the bias-adjusted HR = {adjusted_hr:.3f} "
                f"(95% CI [{adj_ci[0]:.3f}, {adj_ci[1]:.3f}]). "
                f"{'The CI now crosses the null — finding is fragile.' if null_crossed else 'Finding remains directionally consistent.'}"
            ),
        }

    def _impact_positivity_violation(
        self, log_hr: float, base_hr: float,
        ci_lower: float, ci_upper: float,
        params: dict, base_results: dict,
    ) -> dict:
        """Model positivity violation via PS truncation and ESS loss.

        When positivity is violated, extreme weights inflate variance and
        the effective sample size drops.  We model the CI widening as:
            SE_adjusted = SE_base * sqrt(N / ESS_adjusted)
        """
        trunc_range = params.get("truncation_range", [0.05, 0.95])
        trunc_lower, trunc_upper = float(trunc_range[0]), float(trunc_range[1])

        # Estimate ESS reduction from truncation
        original_ess = base_results.get("iptw", {}).get(
            "effective_sample_size", {}
        ).get("total", 100.0)
        n_total = base_results.get("n_total", original_ess * 1.5)

        # Narrower truncation → more data excluded → lower ESS
        coverage = trunc_upper - trunc_lower
        ess_adjusted = original_ess * coverage  # simplified linear model
        ess_adjusted = max(ess_adjusted, 5.0)

        # SE inflation factor
        se_inflation = float(np.sqrt(max(n_total, 1.0) / max(ess_adjusted, 1.0)))
        base_se = (float(np.log(ci_upper)) - float(np.log(max(ci_lower, 1e-9)))) / (2 * 1.96)
        adjusted_se = base_se * se_inflation

        adjusted_ci_lower = float(np.exp(log_hr - 1.96 * adjusted_se))
        adjusted_ci_upper = float(np.exp(log_hr + 1.96 * adjusted_se))

        bias_mag = abs(adjusted_se - base_se) / max(base_se, 1e-9)
        null_crossed = adjusted_ci_lower <= 1.0 <= adjusted_ci_upper

        base_ci_crosses = (ci_lower <= 1.0 <= ci_upper)
        if null_crossed and base_ci_crosses:
            reg_risk = "medium"
        elif null_crossed:
            reg_risk = "high"
        elif se_inflation > 2.0:
            reg_risk = "medium"
        else:
            reg_risk = "low"

        return {
            "bias_adjusted_hr": float(base_hr),  # point estimate unchanged
            "bias_adjusted_ci": [float(adjusted_ci_lower), float(adjusted_ci_upper)],
            "ess_original": float(original_ess),
            "ess_adjusted": float(ess_adjusted),
            "se_inflation_factor": float(se_inflation),
            "truncation_range": [trunc_lower, trunc_upper],
            "bias_magnitude": float(bias_mag),
            "null_crossed": null_crossed,
            "regulatory_risk": reg_risk,
            "interpretation": (
                f"Under PS truncation to [{trunc_lower:.2f}, {trunc_upper:.2f}], "
                f"ESS drops from {original_ess:.0f} to {ess_adjusted:.0f}. "
                f"CI widens to [{adjusted_ci_lower:.3f}, {adjusted_ci_upper:.3f}] "
                f"(SE inflation = {se_inflation:.2f}x)."
            ),
        }

    def _impact_consistency_violation(
        self, log_hr: float, base_hr: float,
        ci_lower: float, ci_upper: float,
        params: dict,
    ) -> dict:
        """Model consistency violation as treatment misclassification.

        Under non-differential misclassification with error rate epsilon,
        the observed HR attenuates toward the null:
            log(HR_observed) = log(HR_true) * (1 - 2*epsilon)

        This means the true HR is further from null than observed:
            log(HR_true) = log(HR_observed) / (1 - 2*epsilon)
        """
        noise_sd = float(params.get("noise_sd", 0.1))
        # Convert noise SD to misclassification rate (epsilon ~ Phi(-1/noise_sd))
        # Simplified: epsilon ≈ min(noise_sd, 0.49)
        epsilon = min(noise_sd, 0.49)

        attenuation = 1.0 - 2.0 * epsilon
        if abs(attenuation) < 1e-9:
            attenuation = 1e-9  # prevent division by zero

        # True HR (de-attenuated)
        log_hr_true = log_hr / attenuation
        hr_true = float(np.exp(log_hr_true))

        # CI also de-attenuates
        log_ci_lower = float(np.log(max(ci_lower, 1e-9))) / attenuation
        log_ci_upper = float(np.log(max(ci_upper, 1e-9))) / attenuation
        adj_ci = sorted([float(np.exp(log_ci_lower)), float(np.exp(log_ci_upper))])

        bias_mag = abs(hr_true - base_hr) / max(abs(base_hr), 1e-9)

        if bias_mag > 0.5:
            reg_risk = "high"
        elif bias_mag > 0.2:
            reg_risk = "medium"
        else:
            reg_risk = "low"

        return {
            "bias_adjusted_hr": float(hr_true),
            "bias_adjusted_ci": adj_ci,
            "misclassification_rate": float(epsilon),
            "attenuation_factor": float(attenuation),
            "bias_magnitude": float(bias_mag),
            "regulatory_risk": reg_risk,
            "interpretation": (
                f"Under treatment misclassification (error rate = {epsilon:.1%}), "
                f"the de-attenuated HR = {hr_true:.3f} "
                f"(95% CI [{adj_ci[0]:.3f}, {adj_ci[1]:.3f}]). "
                f"The true effect may be {'stronger' if abs(log_hr_true) > abs(log_hr) else 'similar'} "
                f"than observed."
            ),
        }

    def _impact_censoring_violation(
        self, log_hr: float, base_hr: float,
        ci_lower: float, ci_upper: float,
        params: dict,
    ) -> dict:
        """Model informative censoring bias.

        If sicker patients are censored more (informative censoring), the
        observed HR is biased.  We model this as a shift proportional to
        the censoring imbalance:
            log(HR_adjusted) = log(HR) + delta * sign(imbalance)
        where delta is the censoring bias parameter.
        """
        censoring_bias = float(params.get("censoring_bias", 0.1))
        direction = float(params.get("direction", 1.0))  # +1 or -1

        log_hr_adjusted = log_hr + censoring_bias * direction
        hr_adjusted = float(np.exp(log_hr_adjusted))

        base_se = (float(np.log(max(ci_upper, 1e-9))) - float(np.log(max(ci_lower, 1e-9)))) / (2 * 1.96)
        adj_ci_lower = float(np.exp(log_hr_adjusted - 1.96 * base_se))
        adj_ci_upper = float(np.exp(log_hr_adjusted + 1.96 * base_se))

        bias_mag = abs(hr_adjusted - base_hr) / max(abs(base_hr), 1e-9)
        null_crossed = adj_ci_lower <= 1.0 <= adj_ci_upper

        if null_crossed and not (ci_lower <= 1.0 <= ci_upper):
            reg_risk = "critical"
        elif bias_mag > 0.3:
            reg_risk = "high"
        elif bias_mag > 0.1:
            reg_risk = "medium"
        else:
            reg_risk = "low"

        return {
            "bias_adjusted_hr": float(hr_adjusted),
            "bias_adjusted_ci": [float(adj_ci_lower), float(adj_ci_upper)],
            "censoring_bias_param": float(censoring_bias),
            "bias_magnitude": float(bias_mag),
            "null_crossed": null_crossed,
            "regulatory_risk": reg_risk,
            "interpretation": (
                f"Under informative censoring (bias = {censoring_bias:.3f}), "
                f"HR shifts to {hr_adjusted:.3f} "
                f"(95% CI [{adj_ci_lower:.3f}, {adj_ci_upper:.3f}]). "
                f"{'Null now included in CI.' if null_crossed else 'Directional conclusion unchanged.'}"
            ),
        }

    # ── 4. Evidence Binding ──────────────────────────────────────────────

    def bind_evidence(
        self,
        assumption_id: str,
        evidence_entries: List[Dict[str, Any]],
    ) -> List[EvidenceBinding]:
        """Create traceable links between an assumption and diagnostic outputs.

        Each entry in ``evidence_entries`` must contain:
        - ``evidence_type``: "diagnostic", "sensitivity", "balance", "simulation"
        - ``metric_name``: name of the metric (e.g., "e_value_ci")
        - ``metric_value``: the computed value
        - ``interpretation``: human-readable interpretation
        - ``source_section``: report section where this metric appears

        Parameters
        ----------
        assumption_id : str
            ID of the assumption to bind evidence to.
        evidence_entries : list of dict
            Evidence records to bind.

        Returns
        -------
        List[EvidenceBinding]
            Created bindings with timestamps.
        """
        bindings: List[EvidenceBinding] = []
        for entry in evidence_entries:
            binding = EvidenceBinding(
                assumption_id=assumption_id,
                evidence_type=entry.get("evidence_type", "diagnostic"),
                metric_name=entry.get("metric_name", "unknown"),
                metric_value=entry.get("metric_value"),
                interpretation=entry.get("interpretation", ""),
                source_section=entry.get("source_section", ""),
            )
            bindings.append(binding)

        logger.info("Bound %d evidence entries to assumption %s", len(bindings), assumption_id)
        return bindings

    # ── 5. Traceability Matrix ───────────────────────────────────────────

    def generate_traceability_matrix(
        self,
        assumptions: List[AssumptionRecord],
        evaluations: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        """Generate an N x M traceability matrix: assumptions x evidence sources.

        Each cell is colored by the evaluation result:
        - green: metric supports the assumption
        - yellow: partial support / inconclusive
        - red: metric contradicts / violates the assumption
        - grey: no data available

        Parameters
        ----------
        assumptions : list of AssumptionRecord
            Evaluated assumptions with evidence bindings.
        evaluations : list of dict, optional
            Pre-computed evaluation dicts (unused if assumptions already evaluated).

        Returns
        -------
        dict
            ``matrix`` (list of rows), ``assumption_ids``, ``evidence_sources``,
            ``cell_details``.
        """
        # Collect all unique evidence sources across all assumptions
        all_sources: List[str] = []
        for a in assumptions:
            for eb in a.evidence_bindings:
                src = eb.source_section if isinstance(eb, EvidenceBinding) else eb.get("source_section", "")
                if src and src not in all_sources:
                    all_sources.append(src)

        if not all_sources:
            all_sources = ["(no evidence)"]

        assumption_ids = [a.id for a in assumptions]
        matrix: List[List[str]] = []
        cell_details: Dict[str, Dict[str, Any]] = {}

        for a in assumptions:
            row: List[str] = []
            binding_map: Dict[str, EvidenceBinding] = {}
            for eb in a.evidence_bindings:
                src = eb.source_section if isinstance(eb, EvidenceBinding) else eb.get("source_section", "")
                binding_map[src] = eb

            for src in all_sources:
                if src in binding_map:
                    eb = binding_map[src]
                    color = self._evidence_to_color(a.evaluation_status, eb)
                    row.append(color)
                    cell_key = f"{a.id}|{src}"
                    cell_details[cell_key] = {
                        "metric_name": eb.metric_name if isinstance(eb, EvidenceBinding) else eb.get("metric_name"),
                        "metric_value": eb.metric_value if isinstance(eb, EvidenceBinding) else eb.get("metric_value"),
                        "interpretation": eb.interpretation if isinstance(eb, EvidenceBinding) else eb.get("interpretation"),
                        "color": color,
                    }
                else:
                    row.append("grey")

            matrix.append(row)

        return {
            "matrix": matrix,
            "assumption_ids": assumption_ids,
            "evidence_sources": all_sources,
            "cell_details": cell_details,
            "dimensions": {"rows": len(assumption_ids), "cols": len(all_sources)},
        }

    # ── 6. Full Report ───────────────────────────────────────────────────

    def generate_assumption_report(
        self,
        causal_spec: dict,
        analysis_results: dict,
        attack_report: Optional[dict] = None,
    ) -> Dict[str, Any]:
        """Orchestrate the full assumption traceability report.

        This is the primary entry point.  It:
        1. Builds the assumption registry from the causal specification.
        2. Evaluates each assumption against analysis diagnostics.
        3. Models violation impacts for each assumption.
        4. Generates the traceability matrix.
        5. Computes overall health and recommendations.

        Parameters
        ----------
        causal_spec : dict
            Causal specification (from ``causal_inference.generate_template_spec``
            or user-defined).
        analysis_results : dict
            Full output from ``StatisticalAnalysisService.run_full_analysis``
            or ``run_analysis_from_data``.
        attack_report : dict, optional
            Adversarial robustness / sensitivity report.

        Returns
        -------
        dict
            Complete assumption report with structure:
            ``assumptions``, ``traceability_matrix``, ``overall_health``,
            ``recommendations``, ``metadata``.
        """
        attack = attack_report or {}

        # 1. Build registry
        assumptions = self.build_assumption_registry(causal_spec)

        # 2. Evaluate each assumption
        for assumption in assumptions:
            self.evaluate_assumption(assumption, analysis_results, attack)

        # 3. Model violation impacts
        violation_impacts: List[Dict] = []
        default_violation_params = {
            "exchangeability": {"confounding_rr": 2.0},
            "positivity": {"truncation_range": [0.05, 0.95]},
            "consistency": {"noise_sd": 0.1},
            "independent_censoring": {"censoring_bias": 0.15, "direction": 1.0},
        }
        for assumption in assumptions:
            if assumption.type in default_violation_params:
                impact = self.model_assumption_violation_impact(
                    assumption,
                    default_violation_params[assumption.type],
                    analysis_results,
                )
                violation_impacts.append(impact)

        # 4. Traceability matrix
        traceability_matrix = self.generate_traceability_matrix(assumptions)

        # 5. Overall health
        overall_health = self._compute_overall_health(assumptions)

        # 6. Recommendations
        recommendations = self._generate_recommendations(assumptions, violation_impacts)

        report = {
            "assumptions": [a.to_dict() for a in assumptions],
            "violation_impacts": violation_impacts,
            "traceability_matrix": traceability_matrix,
            "overall_health": overall_health,
            "recommendations": recommendations,
            "metadata": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "n_assumptions": len(assumptions),
                "n_evidence_bindings": sum(len(a.evidence_bindings) for a in assumptions),
                "spec_hash": self._hash_spec(causal_spec),
            },
        }

        logger.info(
            "Generated assumption report: %d assumptions, health=%.2f, %d recommendations",
            len(assumptions), overall_health["score"], len(recommendations),
        )
        return report

    # ── Helper methods ───────────────────────────────────────────────────

    @staticmethod
    def _confidence_to_status(confidence: float) -> str:
        """Map a confidence level [0, 1] to an evaluation status string.

        Thresholds:
            >= 0.75 → supported
            >= 0.50 → partial
            >= 0.25 → unsupported
            <  0.25 → violated
        """
        if confidence >= 0.75:
            return STATUS_SUPPORTED
        elif confidence >= 0.50:
            return STATUS_PARTIAL
        elif confidence >= 0.25:
            return STATUS_UNSUPPORTED
        else:
            return STATUS_VIOLATED

    @staticmethod
    def _derive_regulatory_risk(assumption: AssumptionRecord) -> str:
        """Derive regulatory risk level from assumption evaluation status.

        Risk escalation rules:
        - Violated core assumption → critical
        - Unsupported non-testable assumption → high
        - Partial with low confidence → medium
        - Supported → low
        """
        status = assumption.evaluation_status
        testable = assumption.testable
        confidence = assumption.confidence_level

        if status == STATUS_VIOLATED:
            return "critical"
        elif status == STATUS_UNSUPPORTED:
            return "high" if not testable else "high"
        elif status == STATUS_PARTIAL:
            return "medium" if confidence < 0.6 else "low"
        else:
            return "low"

    @staticmethod
    def _evidence_to_color(status: str, binding: Any) -> str:
        """Map an evaluation status + evidence binding to a matrix cell color."""
        if status == STATUS_SUPPORTED:
            return "green"
        elif status == STATUS_PARTIAL:
            return "yellow"
        elif status in (STATUS_UNSUPPORTED, STATUS_VIOLATED):
            return "red"
        return "grey"

    @staticmethod
    def _compute_overall_health(assumptions: List[AssumptionRecord]) -> Dict[str, Any]:
        """Compute aggregate health score across all assumptions.

        Score formula:
            health = mean(confidence_levels) weighted by assumption criticality.
            Core assumptions (exchangeability, positivity, consistency,
            independent_censoring) receive 2x weight.

        Returns
        -------
        dict
            ``score``, ``critical_violations``, ``verdict``,
            ``status_counts``.
        """
        if not assumptions:
            return {
                "score": 0.0,
                "critical_violations": 0,
                "verdict": "No assumptions to evaluate.",
                "status_counts": {},
            }

        core_types = ASSUMPTION_TYPES
        weights: List[float] = []
        confidences: List[float] = []

        status_counts: Dict[str, int] = {
            STATUS_SUPPORTED: 0,
            STATUS_PARTIAL: 0,
            STATUS_UNSUPPORTED: 0,
            STATUS_VIOLATED: 0,
        }

        critical_violations = 0

        for a in assumptions:
            w = 2.0 if a.type in core_types else 1.0
            weights.append(w)
            confidences.append(a.confidence_level)
            status_counts[a.evaluation_status] = status_counts.get(a.evaluation_status, 0) + 1

            if a.evaluation_status == STATUS_VIOLATED:
                critical_violations += 1
            elif a.evaluation_status == STATUS_UNSUPPORTED and a.type in core_types:
                critical_violations += 1

        weights_arr = np.array(weights, dtype=np.float64)
        conf_arr = np.array(confidences, dtype=np.float64)
        score = float(np.average(conf_arr, weights=weights_arr))

        if critical_violations > 0:
            verdict = (
                f"CAUTION: {critical_violations} critical assumption violation(s) detected. "
                "Results should not be used for regulatory decision-making without "
                "addressing these violations."
            )
        elif score >= 0.75:
            verdict = (
                "Assumptions are generally well-supported. Results are suitable "
                "for regulatory submission with standard caveats."
            )
        elif score >= 0.50:
            verdict = (
                "Assumptions are partially supported. Additional sensitivity "
                "analyses or robustness checks are recommended before submission."
            )
        else:
            verdict = (
                "Assumptions are poorly supported. Substantial additional work "
                "is needed to establish the validity of causal claims."
            )

        return {
            "score": round(score, 4),
            "critical_violations": critical_violations,
            "verdict": verdict,
            "status_counts": status_counts,
        }

    @staticmethod
    def _generate_recommendations(
        assumptions: List[AssumptionRecord],
        violation_impacts: List[Dict],
    ) -> List[str]:
        """Generate actionable recommendations based on assumption evaluations.

        Returns a prioritized list of recommendations addressing the weakest
        assumptions first.
        """
        recs: List[str] = []

        # Sort by severity (highest first)
        sorted_assumptions = sorted(assumptions, key=lambda a: -a.severity)

        for a in sorted_assumptions:
            if a.evaluation_status == STATUS_VIOLATED:
                if a.type == "exchangeability":
                    recs.append(
                        "CRITICAL: Exchangeability appears violated. Consider: "
                        "(1) adding unmeasured confounders to the DAG and data collection, "
                        "(2) instrumental variable analysis, "
                        "(3) negative control outcome analysis, "
                        "(4) reporting E-value prominently in the submission."
                    )
                elif a.type == "positivity":
                    recs.append(
                        "CRITICAL: Positivity violation detected. Consider: "
                        "(1) restricting the study population to the region of overlap, "
                        "(2) using matching instead of IPTW, "
                        "(3) trimming extreme propensity scores more aggressively, "
                        "(4) reporting ESS alongside nominal sample size."
                    )
                elif a.type == "consistency":
                    recs.append(
                        "CRITICAL: Consistency/SUTVA concern. Consider: "
                        "(1) tightening the treatment definition, "
                        "(2) per-protocol sensitivity analysis, "
                        "(3) investigating treatment version heterogeneity."
                    )
                elif a.type == "independent_censoring":
                    recs.append(
                        "CRITICAL: Informative censoring detected. Consider: "
                        "(1) IPCW (inverse probability of censoring weighting), "
                        "(2) worst-case imputation for censored observations, "
                        "(3) tipping point analysis for censoring."
                    )

            elif a.evaluation_status == STATUS_UNSUPPORTED:
                recs.append(
                    f"HIGH: {a.type.replace('_', ' ').title()} assumption is unsupported "
                    f"(confidence = {a.confidence_level:.2f}). "
                    "Collect additional evidence or perform targeted sensitivity analyses."
                )

            elif a.evaluation_status == STATUS_PARTIAL:
                recs.append(
                    f"MEDIUM: {a.type.replace('_', ' ').title()} assumption has partial support "
                    f"(confidence = {a.confidence_level:.2f}). "
                    "Document limitations and include sensitivity analysis results."
                )

        # Add impact-based recommendations
        for impact in violation_impacts:
            if impact.get("regulatory_risk") in ("critical", "high"):
                a_type = impact.get("assumption_type", "unknown")
                bias_hr = impact.get("bias_adjusted_hr", 0)
                recs.append(
                    f"IMPACT: Under {a_type.replace('_', ' ')} violation, "
                    f"HR shifts to {bias_hr:.3f}. "
                    "Include this bias-adjusted estimate in the regulatory submission."
                )

        # Deduplicate while preserving order
        seen: set = set()
        unique_recs: List[str] = []
        for r in recs:
            if r not in seen:
                seen.add(r)
                unique_recs.append(r)

        return unique_recs

    @staticmethod
    def _hash_spec(spec: dict) -> str:
        """Compute a deterministic hash of the causal specification for audit trail."""
        raw = json.dumps(spec, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

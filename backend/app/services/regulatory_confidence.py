"""
Regulatory Confidence Engine
Generates per-step attack signals and inline warnings from analysis results.
Runs across all workflow steps, surfacing fragility indicators and challenges.
"""
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Any
from enum import Enum


class SignalSeverity(str, Enum):
    CRITICAL = "critical"    # Would likely cause FDA rejection
    WARNING = "warning"      # Needs attention, could be challenged
    INFO = "info"            # Advisory, worth noting


@dataclass
class AttackSignal:
    """A single regulatory pressure signal."""
    step: str                      # Which workflow step this belongs to (e.g., "comparability", "effect_estimation")
    severity: str                  # critical / warning / info
    title: str                     # Short headline (e.g., "Covariate Removal Shifts HR")
    message: str                   # Detailed message (e.g., "Removing Charlson Index shifts HR by +0.21")
    metric_name: Optional[str]     # The metric being challenged
    metric_value: Optional[float]  # Current value
    threshold: Optional[float]     # Threshold that triggers this signal
    source: str                    # Where the signal came from (e.g., "regulatory_attack", "assumption_traceability", "statistical_analysis")


class RegulatoryConfidenceEngine:
    """
    Scans all analysis results stored in a project's processing_config
    and generates per-step attack signals.

    This engine powers:
    - Inline warnings on steps 03-07
    - Step-level risk indicators in the sidebar
    - The overall regulatory readiness score
    """

    def __init__(self, processing_config: Dict[str, Any]):
        self.config = processing_config or {}
        self.signals: List[AttackSignal] = []

    def run(self) -> Dict[str, Any]:
        """Run all signal generators and return structured results."""
        self.signals = []

        self._scan_data_provenance()
        self._scan_cohort()
        self._scan_comparability()
        self._scan_effect_estimation()
        self._scan_bias_sensitivity()

        return self._build_report()

    def _scan_data_provenance(self):
        """Step 03: Data source coverage, missing data, quality signals."""
        # Check data_sources section of processing_config
        data_sources = self.config.get("data_sources", {})

        # Missing data rate
        missing_rate = data_sources.get("overall_missing_rate")
        if missing_rate is not None:
            if missing_rate > 0.20:
                self.signals.append(AttackSignal(
                    step="data_provenance", severity="critical",
                    title="High Missing Data Rate",
                    message=f"Overall missing data rate is {missing_rate:.1%} — exceeds 20% threshold. Multiple imputation sensitivity required.",
                    metric_name="missing_rate", metric_value=missing_rate, threshold=0.20,
                    source="data_quality"
                ))
            elif missing_rate > 0.10:
                self.signals.append(AttackSignal(
                    step="data_provenance", severity="warning",
                    title="Elevated Missing Data",
                    message=f"Missing data rate is {missing_rate:.1%} — may require sensitivity analysis under MNAR assumptions.",
                    metric_name="missing_rate", metric_value=missing_rate, threshold=0.10,
                    source="data_quality"
                ))

        # Data source count
        source_count = data_sources.get("source_count", 0)
        if source_count == 1:
            self.signals.append(AttackSignal(
                step="data_provenance", severity="warning",
                title="Single Data Source",
                message="Analysis relies on a single data source — no external validation possible. FDA may question generalizability.",
                metric_name="source_count", metric_value=source_count, threshold=2,
                source="data_quality"
            ))

        # Sample size
        n_total = data_sources.get("total_patients") or data_sources.get("n_total")
        if n_total is not None and n_total < 200:
            self.signals.append(AttackSignal(
                step="data_provenance", severity="warning",
                title="Small Sample Size",
                message=f"N={n_total} — small samples increase fragility of causal estimates. Bootstrap CIs may be unstable.",
                metric_name="n_total", metric_value=n_total, threshold=200,
                source="data_quality"
            ))

        # Check for PII/compliance issues from ingestion
        ingestion = self.config.get("ingestion_report", {})
        critical_findings = [f for f in ingestion.get("findings", []) if f.get("severity") == "CRITICAL"]
        if critical_findings:
            self.signals.append(AttackSignal(
                step="data_provenance", severity="critical",
                title="Unresolved Compliance Findings",
                message=f"{len(critical_findings)} critical compliance finding(s) from data ingestion remain unresolved.",
                metric_name="critical_findings", metric_value=len(critical_findings), threshold=0,
                source="ingestion"
            ))

    def _scan_cohort(self):
        """Step 04: Cohort construction, attrition, selection bias signals."""
        cohort = self.config.get("cohort", {})

        # Attrition rate
        attrition = cohort.get("attrition_rate") or cohort.get("exclusion_rate")
        if attrition is not None:
            if attrition > 0.50:
                self.signals.append(AttackSignal(
                    step="cohort", severity="critical",
                    title="Extreme Attrition",
                    message=f"Cohort attrition is {attrition:.1%} — over half the eligible population excluded. Selection bias is near-certain.",
                    metric_name="attrition_rate", metric_value=attrition, threshold=0.50,
                    source="cohort_construction"
                ))
            elif attrition > 0.30:
                self.signals.append(AttackSignal(
                    step="cohort", severity="warning",
                    title="High Attrition Rate",
                    message=f"Cohort attrition is {attrition:.1%} — FDA will likely question representativeness.",
                    metric_name="attrition_rate", metric_value=attrition, threshold=0.30,
                    source="cohort_construction"
                ))

        # Arm imbalance
        arm_sizes = cohort.get("arm_sizes", {})
        if len(arm_sizes) >= 2:
            sizes = list(arm_sizes.values())
            ratio = min(sizes) / max(sizes) if max(sizes) > 0 else 0
            if ratio < 0.25:
                self.signals.append(AttackSignal(
                    step="cohort", severity="warning",
                    title="Severe Arm Size Imbalance",
                    message=f"Treatment arm ratio is {ratio:.2f} — extreme imbalance reduces effective sample size and inflates weights.",
                    metric_name="arm_ratio", metric_value=ratio, threshold=0.25,
                    source="cohort_construction"
                ))

    def _scan_comparability(self):
        """Step 05: Covariate balance, PS diagnostics, weighting signals."""
        balance = self.config.get("balance", {})
        attack = self.config.get("regulatory_attack", {})

        # Max SMD (post-weighting)
        max_smd = balance.get("max_weighted_smd") or balance.get("max_smd_after")
        if max_smd is not None:
            if max_smd > 0.20:
                self.signals.append(AttackSignal(
                    step="comparability", severity="critical",
                    title="Residual Imbalance After Weighting",
                    message=f"Max weighted SMD = {max_smd:.3f} — exceeds 0.20 threshold. Weighting failed to achieve balance.",
                    metric_name="max_weighted_smd", metric_value=max_smd, threshold=0.20,
                    source="balance_diagnostics"
                ))
            elif max_smd > 0.10:
                self.signals.append(AttackSignal(
                    step="comparability", severity="warning",
                    title="Marginal Balance",
                    message=f"Max weighted SMD = {max_smd:.3f} — exceeds conventional 0.10 threshold. Residual confounding possible.",
                    metric_name="max_weighted_smd", metric_value=max_smd, threshold=0.10,
                    source="balance_diagnostics"
                ))

        # Covariate sensitivity from attack report
        stability = attack.get("stability_envelope", {})
        perturbations = stability.get("perturbations", [])
        for p in perturbations:
            if p.get("type") == "covariate_removal" and abs(p.get("delta", 0)) > 0.15:
                self.signals.append(AttackSignal(
                    step="comparability", severity="warning",
                    title=f"Removing {p.get('name', 'covariate')} Shifts HR",
                    message=f"Removing {p.get('name', 'this covariate')} shifts HR by {p.get('delta', 0):+.3f} — result depends on this covariate.",
                    metric_name="covariate_sensitivity", metric_value=p.get("delta"), threshold=0.15,
                    source="regulatory_attack"
                ))

        # PS overlap / positivity
        positivity = attack.get("positivity_diagnostics", {}) or balance.get("positivity", {})
        overlap = positivity.get("overlap_coefficient") or positivity.get("ps_overlap")
        if overlap is not None and overlap < 0.30:
            self.signals.append(AttackSignal(
                step="comparability", severity="critical",
                title="Poor Propensity Score Overlap",
                message=f"PS overlap coefficient = {overlap:.3f} — structural positivity violation likely. Consider overlap weights.",
                metric_name="ps_overlap", metric_value=overlap, threshold=0.30,
                source="positivity_diagnostics"
            ))

        # ESS collapse
        ess = positivity.get("ess_ratio") or positivity.get("min_ess_ratio")
        if ess is not None and ess < 0.50:
            self.signals.append(AttackSignal(
                step="comparability", severity="warning",
                title="Effective Sample Size Collapse",
                message=f"ESS ratio = {ess:.1%} — weighting has dramatically reduced effective sample size. Variance inflation likely.",
                metric_name="ess_ratio", metric_value=ess, threshold=0.50,
                source="positivity_diagnostics"
            ))

    def _scan_effect_estimation(self):
        """Step 06: Primary result fragility, method sensitivity signals."""
        effect = self.config.get("effect_estimation", {})
        attack = self.config.get("regulatory_attack", {})

        # Primary HR
        hr = effect.get("hr") or effect.get("hazard_ratio")
        ci_lower = effect.get("ci_lower")
        ci_upper = effect.get("ci_upper")
        p_value = effect.get("p_value")

        # Marginal significance
        if p_value is not None and 0.01 < p_value < 0.05:
            self.signals.append(AttackSignal(
                step="effect_estimation", severity="warning",
                title="Marginally Significant Result",
                message=f"p = {p_value:.4f} — barely crosses 0.05 threshold. Any sensitivity analysis may flip significance.",
                metric_name="p_value", metric_value=p_value, threshold=0.05,
                source="statistical_analysis"
            ))

        # CI width
        if ci_lower is not None and ci_upper is not None:
            ci_width = ci_upper - ci_lower
            if hr is not None and ci_width / abs(hr) > 1.0:
                self.signals.append(AttackSignal(
                    step="effect_estimation", severity="warning",
                    title="Wide Confidence Interval",
                    message=f"CI width ({ci_lower:.3f}–{ci_upper:.3f}) is large relative to HR. Precision is insufficient for strong conclusions.",
                    metric_name="ci_relative_width", metric_value=ci_width / abs(hr) if hr else None, threshold=1.0,
                    source="statistical_analysis"
                ))

        # Method sensitivity from attack
        weighting = attack.get("weighting_comparison", {})
        methods = weighting.get("methods", [])
        if len(methods) >= 2:
            hrs = [m.get("hr") for m in methods if m.get("hr") is not None]
            if hrs:
                hr_range = max(hrs) - min(hrs)
                # Check if any method flips significance
                any_nonsig = any(
                    m.get("ci_lower", 0) <= 1.0 <= m.get("ci_upper", 0)
                    for m in methods
                )
                primary_sig = ci_lower is not None and ci_upper is not None and not (ci_lower <= 1.0 <= ci_upper)

                if primary_sig and any_nonsig:
                    self.signals.append(AttackSignal(
                        step="effect_estimation", severity="critical",
                        title="Result Non-Significant Under Alternative Weighting",
                        message="Primary result becomes non-significant under at least one alternative weighting method.",
                        metric_name="method_sensitivity", metric_value=hr_range, threshold=None,
                        source="regulatory_attack"
                    ))
                elif hr_range > 0.15:
                    self.signals.append(AttackSignal(
                        step="effect_estimation", severity="warning",
                        title="Weighting Method Sensitivity",
                        message=f"HR varies by {hr_range:.3f} across weighting methods — moderate model dependence detected.",
                        metric_name="hr_range_across_methods", metric_value=hr_range, threshold=0.15,
                        source="regulatory_attack"
                    ))

        # Stability envelope
        stability = attack.get("stability_envelope", {})
        if not stability.get("sign_consistent"):
            self.signals.append(AttackSignal(
                step="effect_estimation", severity="critical",
                title="Direction of Effect Unstable",
                message="HR crosses null (1.0) under perturbation — the direction of treatment effect is not robust.",
                metric_name="sign_consistency", metric_value=0, threshold=1,
                source="regulatory_attack"
            ))

    def _scan_bias_sensitivity(self):
        """Step 07: E-value, unmeasured confounding, fragility signals."""
        bias = self.config.get("bias", {})
        attack = self.config.get("regulatory_attack", {})
        assumptions = self.config.get("assumption_traceability", {})

        # E-value
        e_value = bias.get("e_value") or attack.get("e_value", {}).get("point")
        e_value_ci = bias.get("e_value_ci") or attack.get("e_value", {}).get("ci_bound")

        if e_value is not None:
            if e_value < 1.5:
                self.signals.append(AttackSignal(
                    step="bias_sensitivity", severity="critical",
                    title="E-value Indicates High Vulnerability",
                    message=f"E-value = {e_value:.2f} — a weak unmeasured confounder (RR ≈ {e_value:.1f}) could explain the entire effect.",
                    metric_name="e_value", metric_value=e_value, threshold=1.5,
                    source="sensitivity_analysis"
                ))
            elif e_value < 2.5:
                self.signals.append(AttackSignal(
                    step="bias_sensitivity", severity="warning",
                    title="Moderate E-value",
                    message=f"E-value = {e_value:.2f} — plausible confounder risk is moderate. Document why unmeasured confounding is unlikely.",
                    metric_name="e_value", metric_value=e_value, threshold=2.5,
                    source="sensitivity_analysis"
                ))

        if e_value_ci is not None and e_value_ci < 1.2:
            self.signals.append(AttackSignal(
                step="bias_sensitivity", severity="critical",
                title="E-value CI Bound Near Null",
                message=f"E-value for CI bound = {e_value_ci:.2f} — even a trivial confounder could make the CI cross null.",
                metric_name="e_value_ci", metric_value=e_value_ci, threshold=1.2,
                source="sensitivity_analysis"
            ))

        # Unmeasured confounding tipping points
        confounding = attack.get("unmeasured_confounding", {})
        tipping = confounding.get("tipping_points", [])
        easy_tipping = [t for t in tipping if t.get("rr_tu", 99) < 2.0 and t.get("rr_yu", 99) < 2.0]
        if easy_tipping:
            self.signals.append(AttackSignal(
                step="bias_sensitivity", severity="warning",
                title="Low-Threshold Tipping Point",
                message=f"Result nullified with confounder RRs < 2.0 — {len(easy_tipping)} plausible tipping point(s) identified.",
                metric_name="tipping_point_count", metric_value=len(easy_tipping), threshold=0,
                source="regulatory_attack"
            ))

        # Assumption health
        overall_health = assumptions.get("overall_health", {})
        health_score = overall_health.get("score")
        if health_score is not None and health_score < 50:
            self.signals.append(AttackSignal(
                step="bias_sensitivity", severity="critical",
                title="Assumption Health Score Below 50",
                message=f"Overall causal assumption health = {health_score:.0f}/100 — multiple assumptions are poorly supported.",
                metric_name="assumption_health", metric_value=health_score, threshold=50,
                source="assumption_traceability"
            ))

        # Fragility index
        fragility = bias.get("fragility_index")
        if fragility is not None and fragility < 5:
            self.signals.append(AttackSignal(
                step="bias_sensitivity", severity="warning",
                title="Low Fragility Index",
                message=f"Fragility index = {fragility} — changing only {fragility} event(s) would flip significance.",
                metric_name="fragility_index", metric_value=fragility, threshold=5,
                source="sensitivity_analysis"
            ))

    def _build_report(self) -> Dict[str, Any]:
        """Build the final structured report with per-step signals and overall score."""
        # Group by step
        by_step: Dict[str, List[Dict]] = {}
        for sig in self.signals:
            by_step.setdefault(sig.step, []).append(asdict(sig))

        # Compute per-step risk levels
        step_risk: Dict[str, str] = {}
        for step, sigs in by_step.items():
            severities = [s["severity"] for s in sigs]
            if "critical" in severities:
                step_risk[step] = "critical"
            elif "warning" in severities:
                step_risk[step] = "warning"
            else:
                step_risk[step] = "info"

        # Overall confidence score (0-100)
        # Start at 100, subtract for each signal
        score = 100.0
        for sig in self.signals:
            if sig.severity == "critical":
                score -= 15
            elif sig.severity == "warning":
                score -= 5
            else:
                score -= 1
        score = max(0, min(100, score))

        # Verdict
        if score >= 80:
            verdict = "HIGH_CONFIDENCE"
            verdict_label = "High Regulatory Confidence"
        elif score >= 60:
            verdict = "MODERATE_CONFIDENCE"
            verdict_label = "Moderate — Address Warnings"
        elif score >= 40:
            verdict = "LOW_CONFIDENCE"
            verdict_label = "Low — Significant Risks Present"
        else:
            verdict = "CRITICAL"
            verdict_label = "Critical — Likely Regulatory Challenge"

        return {
            "signals_by_step": by_step,
            "step_risk": step_risk,
            "total_signals": len(self.signals),
            "critical_count": sum(1 for s in self.signals if s.severity == "critical"),
            "warning_count": sum(1 for s in self.signals if s.severity == "warning"),
            "info_count": sum(1 for s in self.signals if s.severity == "info"),
            "confidence_score": round(score, 1),
            "verdict": verdict,
            "verdict_label": verdict_label,
        }

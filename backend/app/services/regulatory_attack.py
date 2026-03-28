"""
Afarensis Enterprise -- Regulatory Attack Service
===================================================

Adversarial statistical review engine that systematically probes the
robustness of causal-inference results from observational studies.

Composes with ``StatisticalAnalysisService`` from ``statistical_models.py``
and runs a battery of sensitivity analyses, positivity diagnostics,
stability perturbations, and failure-mode detection to produce a
comprehensive attack report suitable for regulatory submission defence.

All computations use **numpy only** — no scipy or sklearn dependencies —
so the module is fully self-contained and auditable.

Mathematical notation follows the conventions of Hernán & Robins (2020),
VanderWeele & Ding (2017), and Li, Morgan & Zaslavsky (2018).
"""

import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime
import logging
import copy

logger = logging.getLogger(__name__)


# ======================================================================
# Configuration
# ======================================================================

@dataclass
class AttackConfig:
    """Tunable parameters for the regulatory attack engine.

    Controls thresholds, grid resolutions, and perturbation strategies
    used throughout the adversarial review.
    """

    # ── Overlap / ATO weights ──────────────────────────────────────────
    ato_clip_eps: float = 1e-8

    # ── Positivity diagnostics ─────────────────────────────────────────
    positivity_n_bins: int = 10
    positivity_min_prevalence: float = 0.05
    positivity_near_violation_threshold: float = 0.025
    positivity_ess_warn_ratio: float = 0.5

    # ── Unmeasured confounding grid ────────────────────────────────────
    confounding_rr_range: Tuple[float, float] = (1.0, 5.0)
    confounding_grid_steps: int = 10

    # ── Stability envelope ─────────────────────────────────────────────
    trim_thresholds: List[Tuple[float, float]] = field(
        default_factory=lambda: [
            (0.01, 0.99),
            (0.02, 0.98),
            (0.05, 0.95),
            (0.10, 0.90),
        ]
    )

    # ── Model dependence ───────────────────────────────────────────────
    model_dependence_max_variation: float = 0.20

    # ── Failure-mode thresholds ────────────────────────────────────────
    smd_threshold: float = 0.10
    hr_sign_change_null: float = 1.0
    robustness_weights: Dict[str, float] = field(
        default_factory=lambda: {
            "stability": 0.25,
            "e_value": 0.25,
            "positivity": 0.20,
            "model_dependence": 0.15,
            "balance": 0.15,
        }
    )


# ======================================================================
# RegulatoryAttackService
# ======================================================================

class RegulatoryAttackService:
    """Adversarial statistical review engine for regulatory submissions.

    Wraps ``StatisticalAnalysisService`` and systematically attacks the
    primary causal estimate to identify fragile conclusions, positivity
    violations, excessive model dependence, and other threats to internal
    validity.

    Parameters
    ----------
    stat_service : StatisticalAnalysisService
        An already-instantiated statistical analysis service from
        ``statistical_models.py``.
    config : AttackConfig, optional
        Override default attack parameters.

    Example
    -------
    >>> from statistical_models import StatisticalAnalysisService
    >>> svc = StatisticalAnalysisService()
    >>> attack = RegulatoryAttackService(svc)
    >>> report = attack.run_full_attack(data_config)
    """

    def __init__(
        self,
        stat_service,
        config: Optional[AttackConfig] = None,
    ):
        self.stat = stat_service
        self.cfg = config or AttackConfig()

    # ==================================================================
    # 1. Overlap (ATO) Weights
    # ==================================================================

    def compute_overlap_weights(
        self,
        treatment: np.ndarray,
        ps: np.ndarray,
    ) -> Dict[str, Any]:
        r"""Compute Average Treatment effect on the Overlap population (ATO) weights.

        The overlap (or tilting) weights target the ATO estimand and are
        defined as:

        .. math::

            w_i =
            \begin{cases}
                1 - e(X_i) & \text{if } Z_i = 1 \\
                e(X_i)     & \text{if } Z_i = 0
            \end{cases}

        where :math:`e(X_i)` is the propensity score.  Equivalently, for
        both arms, the weight is :math:`e(X)(1 - e(X))`, which places the
        greatest emphasis on subjects in the region of clinical equipoise.

        Reference: Li, Morgan & Zaslavsky (2018), *JASA* 113(521): 390-400.

        Parameters
        ----------
        treatment : np.ndarray, shape (n,)
            Binary treatment indicator (1 = treated, 0 = control).
        ps : np.ndarray, shape (n,)
            Estimated propensity scores.

        Returns
        -------
        dict
            ``weights``: np.ndarray of ATO weights.
            ``effective_sample_size``: ESS for each arm and total.
            ``weight_statistics``: descriptive statistics of the weights.
            ``target_estimand``: ``"ATO"``.
        """
        eps = self.cfg.ato_clip_eps
        ps_safe = np.clip(ps, eps, 1.0 - eps)

        # ATO weights: treated get (1-ps), controls get ps
        # Equivalently h(x) = ps*(1-ps) for both arms in the
        # weighting-by-tilting formulation
        weights = np.where(treatment == 1, 1.0 - ps_safe, ps_safe)

        # Effective sample size per arm
        w_t = weights[treatment == 1]
        w_c = weights[treatment == 0]
        ess_treated = (w_t.sum() ** 2) / (w_t ** 2).sum() if len(w_t) > 0 else 0.0
        ess_control = (w_c.sum() ** 2) / (w_c ** 2).sum() if len(w_c) > 0 else 0.0

        # Tilting function values for diagnostics
        h = ps_safe * (1.0 - ps_safe)

        return {
            "weights": weights,
            "tilting_function": h,
            "effective_sample_size": {
                "treated": float(ess_treated),
                "control": float(ess_control),
                "total": float(ess_treated + ess_control),
            },
            "weight_statistics": {
                "mean": float(weights.mean()),
                "std": float(weights.std()),
                "min": float(weights.min()),
                "max": float(weights.max()),
                "median": float(np.median(weights)),
                "cv": float(weights.std() / weights.mean()) if weights.mean() > 0 else float("inf"),
            },
            "target_estimand": "ATO",
        }

    # ==================================================================
    # 2. Positivity Diagnostics
    # ==================================================================

    def run_positivity_diagnostics(
        self,
        treatment: np.ndarray,
        covariates: np.ndarray,
        ps: np.ndarray,
        covariate_names: List[str],
    ) -> Dict[str, Any]:
        r"""Systematic positivity (overlap) diagnostics.

        Positivity requires that for every covariate stratum :math:`x`,

        .. math::

            0 < P(Z = 1 \mid X = x) < 1

        This method checks for practical (near-)violations by:

        1. **PS distribution overlap**: histogram-based overlap coefficient
           between treated and control PS distributions.
        2. **Covariate-stratum treatment prevalence**: within quantile bins
           of each covariate, compute the treatment prevalence and flag
           strata where :math:`P(Z=1 \mid \text{stratum}) < \epsilon` or
           :math:`> 1 - \epsilon`.
        3. **Near-violation flags**: strata where prevalence is close to 0
           or 1 but not quite, indicating practical positivity issues.
        4. **Effective sample size (ESS)**: ratio of ESS to nominal N as
           a diagnostic for weight extremity.

        Parameters
        ----------
        treatment : np.ndarray, shape (n,)
            Binary treatment indicator.
        covariates : np.ndarray, shape (n, p)
            Covariate matrix.
        ps : np.ndarray, shape (n,)
            Estimated propensity scores.
        covariate_names : list of str
            Names for each covariate column.

        Returns
        -------
        dict
            Comprehensive positivity diagnostics report.
        """
        n = len(treatment)
        n_bins = self.cfg.positivity_n_bins
        min_prev = self.cfg.positivity_min_prevalence
        near_thresh = self.cfg.positivity_near_violation_threshold

        # --- 1. PS distribution overlap ---
        ps_treated = ps[treatment == 1]
        ps_control = ps[treatment == 0]

        bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
        hist_t, _ = np.histogram(ps_treated, bins=bin_edges, density=True)
        hist_c, _ = np.histogram(ps_control, bins=bin_edges, density=True)

        # Overlap coefficient: sum of min of normalised densities
        # Normalise so each histogram sums to 1
        hist_t_norm = hist_t / (hist_t.sum() + 1e-12)
        hist_c_norm = hist_c / (hist_c.sum() + 1e-12)
        overlap_coeff = float(np.minimum(hist_t_norm, hist_c_norm).sum())

        # Common support region
        ps_min_treated = float(ps_treated.min()) if len(ps_treated) > 0 else 0.0
        ps_max_treated = float(ps_treated.max()) if len(ps_treated) > 0 else 1.0
        ps_min_control = float(ps_control.min()) if len(ps_control) > 0 else 0.0
        ps_max_control = float(ps_control.max()) if len(ps_control) > 0 else 1.0
        common_support = (
            max(ps_min_treated, ps_min_control),
            min(ps_max_treated, ps_max_control),
        )
        n_outside_support = int(
            np.sum((ps < common_support[0]) | (ps > common_support[1]))
        )

        # --- 2. Covariate-stratum treatment prevalence ---
        stratum_diagnostics = []
        violations = []
        near_violations = []

        for j, cov_name in enumerate(covariate_names):
            col = covariates[:, j] if covariates.ndim > 1 else covariates
            # Quantile-based binning
            try:
                quantiles = np.percentile(col, np.linspace(0, 100, n_bins + 1))
                quantiles = np.unique(quantiles)
                bin_indices = np.digitize(col, quantiles[1:-1]) if len(quantiles) > 2 else np.zeros(n, dtype=int)
            except Exception:
                bin_indices = np.zeros(n, dtype=int)

            strata_info = []
            for b in np.unique(bin_indices):
                mask = bin_indices == b
                n_stratum = int(mask.sum())
                if n_stratum == 0:
                    continue
                prev = float(treatment[mask].mean())
                strata_info.append({
                    "bin": int(b),
                    "n": n_stratum,
                    "treatment_prevalence": prev,
                })
                if prev < near_thresh or prev > (1.0 - near_thresh):
                    if prev < 1e-10 or prev > (1.0 - 1e-10):
                        violations.append({
                            "covariate": cov_name,
                            "bin": int(b),
                            "n": n_stratum,
                            "prevalence": prev,
                            "type": "structural",
                        })
                    else:
                        near_violations.append({
                            "covariate": cov_name,
                            "bin": int(b),
                            "n": n_stratum,
                            "prevalence": prev,
                            "type": "practical",
                        })

            stratum_diagnostics.append({
                "covariate": cov_name,
                "strata": strata_info,
            })

        # --- 3. ESS computation for IPTW ---
        eps = 1e-8
        ps_clip = np.clip(ps, eps, 1.0 - eps)
        iptw_w = np.where(treatment == 1, 1.0 / ps_clip, 1.0 / (1.0 - ps_clip))
        ess_iptw_t = float(
            (iptw_w[treatment == 1].sum() ** 2) / ((iptw_w[treatment == 1] ** 2).sum())
        ) if (treatment == 1).any() else 0.0
        ess_iptw_c = float(
            (iptw_w[treatment == 0].sum() ** 2) / ((iptw_w[treatment == 0] ** 2).sum())
        ) if (treatment == 0).any() else 0.0

        n_treated = int(treatment.sum())
        n_control = int(n - n_treated)
        ess_ratio_treated = ess_iptw_t / n_treated if n_treated > 0 else 0.0
        ess_ratio_control = ess_iptw_c / n_control if n_control > 0 else 0.0

        ess_warnings = []
        if ess_ratio_treated < self.cfg.positivity_ess_warn_ratio:
            ess_warnings.append(
                f"Treated ESS ratio {ess_ratio_treated:.2f} < "
                f"{self.cfg.positivity_ess_warn_ratio} — extreme weights detected."
            )
        if ess_ratio_control < self.cfg.positivity_ess_warn_ratio:
            ess_warnings.append(
                f"Control ESS ratio {ess_ratio_control:.2f} < "
                f"{self.cfg.positivity_ess_warn_ratio} — extreme weights detected."
            )

        # --- 4. Overall assessment ---
        positivity_ok = len(violations) == 0 and len(near_violations) == 0
        severity = "none"
        if len(violations) > 0:
            severity = "severe"
        elif len(near_violations) > 0:
            severity = "moderate"
        elif len(ess_warnings) > 0:
            severity = "mild"

        return {
            "ps_overlap": {
                "overlap_coefficient": overlap_coeff,
                "common_support": {
                    "lower": float(common_support[0]),
                    "upper": float(common_support[1]),
                },
                "n_outside_common_support": n_outside_support,
                "ps_range_treated": {"min": ps_min_treated, "max": ps_max_treated},
                "ps_range_control": {"min": ps_min_control, "max": ps_max_control},
            },
            "stratum_diagnostics": stratum_diagnostics,
            "violations": violations,
            "near_violations": near_violations,
            "effective_sample_size": {
                "iptw_treated": ess_iptw_t,
                "iptw_control": ess_iptw_c,
                "ess_ratio_treated": float(ess_ratio_treated),
                "ess_ratio_control": float(ess_ratio_control),
                "warnings": ess_warnings,
            },
            "overall": {
                "positivity_holds": positivity_ok,
                "severity": severity,
                "n_structural_violations": len(violations),
                "n_practical_violations": len(near_violations),
            },
        }

    # ==================================================================
    # 3. Unmeasured Confounding Simulation
    # ==================================================================

    def simulate_unmeasured_confounding(
        self,
        hr: float,
        ci_lower: float,
        ci_upper: float,
        confounding_grid: Optional[List[Tuple[float, float]]] = None,
    ) -> Dict[str, Any]:
        r"""Parametric bias analysis for unmeasured confounding.

        For each hypothetical unmeasured confounder characterised by the
        pair :math:`(\text{RR}_{TU}, \text{RR}_{YU})`:

        - :math:`\text{RR}_{TU}` = association of confounder with treatment
        - :math:`\text{RR}_{YU}` = association of confounder with outcome

        the bias factor is (Ding & VanderWeele, 2016):

        .. math::

            B(\text{RR}_{TU}, \text{RR}_{YU}) =
            \frac{\text{RR}_{YU} \cdot \text{RR}_{TU}}
                 {\text{RR}_{YU} + \text{RR}_{TU} - 1}

        and the bias-adjusted HR is:

        .. math::

            \text{HR}_{\text{adj}} = \frac{\text{HR}_{\text{obs}}}{B}

        The tipping point is the smallest bias factor :math:`B^*` such that
        :math:`\text{HR}_{\text{adj}}` crosses the null (HR = 1).

        Parameters
        ----------
        hr : float
            Observed hazard ratio (point estimate).
        ci_lower : float
            Lower bound of the confidence interval.
        ci_upper : float
            Upper bound of the confidence interval.
        confounding_grid : list of (RR_TU, RR_YU) tuples, optional
            Specific confounder strength pairs to evaluate.  If None,
            a default grid is generated from ``confounding_rr_range``.

        Returns
        -------
        dict
            ``simulations``: list of bias-adjusted results for each grid point.
            ``tipping_point``: the confounder strength that tips the result.
            ``e_value``: E-value for comparison.
        """
        if confounding_grid is None:
            rr_vals = np.linspace(
                self.cfg.confounding_rr_range[0],
                self.cfg.confounding_rr_range[1],
                self.cfg.confounding_grid_steps,
            )
            confounding_grid = [
                (float(rr_tu), float(rr_yu))
                for rr_tu in rr_vals
                for rr_yu in rr_vals
                if rr_tu >= 1.0 and rr_yu >= 1.0
            ]

        simulations = []
        tipping_point = None
        min_tipping_product = float("inf")

        for rr_tu, rr_yu in confounding_grid:
            # Bias factor (Ding-VanderWeele formula)
            denom = rr_yu + rr_tu - 1.0
            if denom <= 0:
                bias_factor = 1.0
            else:
                bias_factor = (rr_yu * rr_tu) / denom

            # Bias-adjusted estimates
            if bias_factor > 0:
                hr_adj = hr / bias_factor
                ci_lower_adj = ci_lower / bias_factor
                ci_upper_adj = ci_upper / bias_factor
            else:
                hr_adj = hr
                ci_lower_adj = ci_lower
                ci_upper_adj = ci_upper

            # Does the adjusted CI cross the null?
            crosses_null = bool(ci_lower_adj <= 1.0 <= ci_upper_adj)
            # Does the point estimate cross the null?
            sign_flipped = bool(
                (hr < 1.0 and hr_adj >= 1.0) or (hr > 1.0 and hr_adj <= 1.0)
            )

            sim = {
                "rr_tu": float(rr_tu),
                "rr_yu": float(rr_yu),
                "bias_factor": float(bias_factor),
                "hr_adjusted": float(hr_adj),
                "ci_lower_adjusted": float(ci_lower_adj),
                "ci_upper_adjusted": float(ci_upper_adj),
                "crosses_null": crosses_null,
                "sign_flipped": sign_flipped,
            }
            simulations.append(sim)

            # Track tipping point (smallest RR product that flips sign)
            if sign_flipped and (rr_tu * rr_yu) < min_tipping_product:
                min_tipping_product = rr_tu * rr_yu
                tipping_point = {
                    "rr_tu": float(rr_tu),
                    "rr_yu": float(rr_yu),
                    "bias_factor": float(bias_factor),
                    "hr_adjusted": float(hr_adj),
                    "rr_product": float(rr_tu * rr_yu),
                }

        # E-value computation (VanderWeele & Ding 2017)
        def _e_val(ratio: float) -> float:
            if ratio < 1.0:
                ratio = 1.0 / ratio
            return float(ratio + np.sqrt(ratio * (ratio - 1.0)))

        e_value_point = _e_val(hr)
        if hr >= 1.0:
            e_value_ci = _e_val(ci_lower) if ci_lower > 1.0 else 1.0
        else:
            e_value_ci = _e_val(ci_upper) if ci_upper < 1.0 else 1.0

        # Interpretation
        n_crossing = sum(1 for s in simulations if s["crosses_null"])
        n_flipped = sum(1 for s in simulations if s["sign_flipped"])

        return {
            "simulations": simulations,
            "tipping_point": tipping_point,
            "e_value": {
                "point": e_value_point,
                "ci_bound": e_value_ci,
            },
            "summary": {
                "n_scenarios": len(simulations),
                "n_crossing_null": n_crossing,
                "n_sign_flipped": n_flipped,
                "pct_robust": float(
                    (len(simulations) - n_flipped) / max(len(simulations), 1) * 100.0
                ),
            },
        }

    # ==================================================================
    # 4. Stability Envelope
    # ==================================================================

    def compute_stability_envelope(
        self,
        base_result: Dict[str, Any],
        perturbation_configs: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        r"""Compute the stability envelope of the primary HR estimate.

        Perturbs the analysis along multiple axes and records the range of
        resulting hazard ratios.  Perturbation axes include:

        - **PS trimming thresholds**: :math:`(\alpha, 1-\alpha)` for varying
          :math:`\alpha`.
        - **Weighting methods**: IPTW, stabilised IPTW, ATO (overlap).
        - **Covariate subsets**: leave-one-out covariate perturbation.

        The stability envelope is defined as:

        .. math::

            \mathcal{E} = [\min_k \widehat{HR}_k,\; \max_k \widehat{HR}_k]

        and the maximum delta:

        .. math::

            \Delta_{\max} = \max_k |\widehat{HR}_k - \widehat{HR}_{\text{base}}|

        Parameters
        ----------
        base_result : dict
            Must contain ``hr``, ``ci_lower``, ``ci_upper``, ``method``.
        perturbation_configs : list of dict, optional
            Each dict specifies a perturbation with keys ``name``,
            ``hr``, ``ci_lower``, ``ci_upper``.  If None, an empty
            envelope is returned (caller should populate via
            ``run_full_attack``).

        Returns
        -------
        dict
            ``stability_range``, ``max_delta``, ``perturbations``,
            ``sign_consistent``, ``all_significant``.
        """
        base_hr = base_result.get("hr", 1.0)

        if perturbation_configs is None or len(perturbation_configs) == 0:
            return {
                "stability_range": {
                    "hr_min": base_hr,
                    "hr_max": base_hr,
                    "ci_range": [
                        base_result.get("ci_lower", base_hr),
                        base_result.get("ci_upper", base_hr),
                    ],
                },
                "max_delta": 0.0,
                "perturbations": [],
                "sign_consistent": True,
                "all_significant": True,
            }

        hrs = [base_hr]
        ci_lowers = [base_result.get("ci_lower", base_hr)]
        ci_uppers = [base_result.get("ci_upper", base_hr)]

        for p in perturbation_configs:
            hrs.append(p.get("hr", base_hr))
            ci_lowers.append(p.get("ci_lower", base_hr))
            ci_uppers.append(p.get("ci_upper", base_hr))

        hrs_arr = np.array(hrs)
        ci_lowers_arr = np.array(ci_lowers)
        ci_uppers_arr = np.array(ci_uppers)

        hr_min = float(hrs_arr.min())
        hr_max = float(hrs_arr.max())
        max_delta = float(np.max(np.abs(hrs_arr - base_hr)))

        # Sign consistency: all HRs on the same side of 1.0
        all_below = bool(np.all(hrs_arr < 1.0))
        all_above = bool(np.all(hrs_arr > 1.0))
        sign_consistent = all_below or all_above

        # All significant: no CI crosses 1.0
        all_significant = bool(
            np.all((ci_lowers_arr > 1.0) | (ci_uppers_arr < 1.0))
        )

        return {
            "stability_range": {
                "hr_min": hr_min,
                "hr_max": hr_max,
                "ci_range": [float(ci_lowers_arr.min()), float(ci_uppers_arr.max())],
            },
            "max_delta": max_delta,
            "perturbations": perturbation_configs,
            "sign_consistent": sign_consistent,
            "all_significant": all_significant,
        }

    # ==================================================================
    # 5. Model Dependence
    # ==================================================================

    def compute_model_dependence(
        self,
        results_by_method: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Any]:
        r"""Quantify model dependence across estimation methods.

        Compares hazard ratios across IPTW, stabilised IPTW, overlap (ATO)
        weights, and (optionally) matching.  Model dependence is measured
        as the maximum pairwise variation:

        .. math::

            V_{\max} = \max_{j,k} |\log(\widehat{HR}_j) - \log(\widehat{HR}_k)|

        A large :math:`V_{\max}` (e.g., > 0.20 on the log scale) indicates
        that the causal conclusion is sensitive to the choice of estimator.

        Parameters
        ----------
        results_by_method : dict
            Keys are method names (e.g., ``"iptw"``, ``"stabilized"``,
            ``"overlap"``), values are dicts with ``hr``, ``ci_lower``,
            ``ci_upper``.

        Returns
        -------
        dict
            ``max_variation``: max absolute pairwise log-HR difference.
            ``sign_consistent``: whether all methods agree on direction.
            ``methods``: list of per-method summaries.
            ``dependence_level``: categorical assessment.
        """
        if not results_by_method:
            return {
                "max_variation": 0.0,
                "sign_consistent": True,
                "methods": [],
                "dependence_level": "undetermined",
            }

        method_summaries = []
        log_hrs = []

        for method_name, res in results_by_method.items():
            hr_val = res.get("hr", 1.0)
            log_hr = float(np.log(max(hr_val, 1e-12)))
            log_hrs.append(log_hr)
            ci_lo = res.get("ci_lower", hr_val)
            ci_hi = res.get("ci_upper", hr_val)
            significant = bool(ci_lo > 1.0 or ci_hi < 1.0)

            method_summaries.append({
                "method": method_name,
                "hr": float(hr_val),
                "log_hr": log_hr,
                "ci_lower": float(ci_lo),
                "ci_upper": float(ci_hi),
                "significant": significant,
            })

        log_hrs_arr = np.array(log_hrs)
        hrs_arr = np.array([m["hr"] for m in method_summaries])

        # Maximum pairwise variation on log scale
        max_variation = 0.0
        if len(log_hrs_arr) > 1:
            for i in range(len(log_hrs_arr)):
                for j in range(i + 1, len(log_hrs_arr)):
                    diff = abs(log_hrs_arr[i] - log_hrs_arr[j])
                    max_variation = max(max_variation, diff)

        # Sign consistency
        all_below = bool(np.all(hrs_arr < 1.0))
        all_above = bool(np.all(hrs_arr > 1.0))
        sign_consistent = all_below or all_above

        # Categorical assessment
        if max_variation < 0.05:
            dependence_level = "negligible"
        elif max_variation < 0.10:
            dependence_level = "low"
        elif max_variation < 0.20:
            dependence_level = "moderate"
        else:
            dependence_level = "high"

        return {
            "max_variation": float(max_variation),
            "sign_consistent": sign_consistent,
            "methods": method_summaries,
            "dependence_level": dependence_level,
        }

    # ==================================================================
    # 6. Failure-Mode Identification
    # ==================================================================

    def identify_failure_modes(
        self,
        attack_results: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        r"""Identify conditions under which the primary conclusion fails.

        Scans the attack report for:

        - **Sign change**: any perturbation flips the HR across the null.
        - **CI crosses null**: any perturbation widens the CI to include 1.0.
        - **Large model dependence**: :math:`V_{\max} > 0.20` (log scale).
        - **Positivity violations**: structural or practical violations.
        - **Low E-value**: E-value for CI bound < 2.0.
        - **Poor balance**: post-weighting SMD > threshold.
        - **ESS collapse**: effective sample size < 50% of nominal.

        Parameters
        ----------
        attack_results : dict
            Partial or complete attack report dictionary.

        Returns
        -------
        list of dict
            Each entry has ``type``, ``description``, ``severity``
            (``"critical"``, ``"major"``, ``"minor"``), and ``details``.
        """
        failures = []

        # --- Sign change in stability envelope ---
        stability = attack_results.get("stability_range", {})
        hr_min = stability.get("hr_min", 1.0)
        hr_max = stability.get("hr_max", 1.0)
        base_hr = attack_results.get("primary_estimate", {}).get("hr", 1.0)

        if hr_min < 1.0 < hr_max:
            failures.append({
                "type": "sign_change",
                "description": (
                    f"HR range [{hr_min:.3f}, {hr_max:.3f}] spans the null (1.0). "
                    "The direction of effect is not robust to analytic perturbations."
                ),
                "severity": "critical",
                "details": {"hr_min": hr_min, "hr_max": hr_max},
            })

        # --- CI crosses null ---
        ci_range = stability.get("ci_range", [])
        if len(ci_range) == 2 and ci_range[0] <= 1.0 <= ci_range[1]:
            primary_ci_lo = attack_results.get("primary_estimate", {}).get("ci_lower", 1.0)
            primary_ci_hi = attack_results.get("primary_estimate", {}).get("ci_upper", 1.0)
            # Only flag if the primary was significant but perturbations aren't
            if primary_ci_lo > 1.0 or primary_ci_hi < 1.0:
                failures.append({
                    "type": "ci_crosses_null",
                    "description": (
                        "Under some perturbations the confidence interval includes "
                        "the null, undermining statistical significance."
                    ),
                    "severity": "major",
                    "details": {"ci_range": ci_range},
                })

        # --- Model dependence ---
        model_dep = attack_results.get("model_dependence", {})
        max_var = model_dep.get("max_variation", 0.0)
        if max_var > self.cfg.model_dependence_max_variation:
            failures.append({
                "type": "high_model_dependence",
                "description": (
                    f"Maximum log-HR variation across methods is {max_var:.3f} "
                    f"(threshold {self.cfg.model_dependence_max_variation:.2f}). "
                    "Results are sensitive to estimator choice."
                ),
                "severity": "major",
                "details": {
                    "max_variation": max_var,
                    "methods": model_dep.get("methods", []),
                },
            })

        if not model_dep.get("sign_consistent", True):
            failures.append({
                "type": "sign_inconsistency_across_methods",
                "description": (
                    "Different estimation methods disagree on the direction of "
                    "the treatment effect."
                ),
                "severity": "critical",
                "details": {"methods": model_dep.get("methods", [])},
            })

        # --- Positivity ---
        pos_diag = attack_results.get("positivity_diagnostics", {})
        pos_overall = pos_diag.get("overall", {})
        if pos_overall.get("severity") == "severe":
            failures.append({
                "type": "positivity_violation",
                "description": (
                    f"Structural positivity violations detected in "
                    f"{pos_overall.get('n_structural_violations', 0)} strata. "
                    "Causal estimates may be extrapolating beyond the data."
                ),
                "severity": "critical",
                "details": {
                    "violations": pos_diag.get("violations", []),
                },
            })
        elif pos_overall.get("severity") == "moderate":
            failures.append({
                "type": "near_positivity_violation",
                "description": (
                    f"Practical positivity concerns in "
                    f"{pos_overall.get('n_practical_violations', 0)} strata."
                ),
                "severity": "major",
                "details": {
                    "near_violations": pos_diag.get("near_violations", []),
                },
            })

        # --- E-value ---
        e_val = attack_results.get("e_value", {})
        e_ci = e_val.get("ci_bound", float("inf"))
        if e_ci < 1.5:
            failures.append({
                "type": "low_e_value",
                "description": (
                    f"E-value for CI bound is {e_ci:.2f} — very small unmeasured "
                    "confounding could explain the result."
                ),
                "severity": "critical",
                "details": {"e_value_point": e_val.get("point", 0), "e_value_ci": e_ci},
            })
        elif e_ci < 2.0:
            failures.append({
                "type": "weak_e_value",
                "description": (
                    f"E-value for CI bound is {e_ci:.2f} — moderate unmeasured "
                    "confounding could shift the CI to include the null."
                ),
                "severity": "major",
                "details": {"e_value_point": e_val.get("point", 0), "e_value_ci": e_ci},
            })

        # --- Balance ---
        balance = attack_results.get("balance_summary", {})
        covs_above = balance.get("covariates_above_threshold", [])
        if len(covs_above) > 0:
            failures.append({
                "type": "residual_imbalance",
                "description": (
                    f"{len(covs_above)} covariate(s) have post-weighting SMD above "
                    f"threshold: {', '.join(str(c) for c in covs_above[:5])}."
                ),
                "severity": "major" if len(covs_above) > 2 else "minor",
                "details": {"covariates": covs_above},
            })

        # --- ESS warnings ---
        ess_info = pos_diag.get("effective_sample_size", {})
        ess_warnings = ess_info.get("warnings", [])
        if ess_warnings:
            failures.append({
                "type": "ess_collapse",
                "description": (
                    "Effective sample size is substantially lower than nominal "
                    "sample size, indicating extreme weight concentration."
                ),
                "severity": "major",
                "details": {"warnings": ess_warnings},
            })

        # --- Unmeasured confounding tipping point ---
        uc = attack_results.get("unmeasured_confounding", {})
        tp = uc.get("tipping_point")
        if tp is not None and tp.get("rr_product", float("inf")) < 4.0:
            failures.append({
                "type": "fragile_to_confounding",
                "description": (
                    f"A confounder with RR_TU={tp['rr_tu']:.2f} and "
                    f"RR_YU={tp['rr_yu']:.2f} (product={tp['rr_product']:.2f}) "
                    "would tip the result past the null."
                ),
                "severity": "major" if tp["rr_product"] < 2.5 else "minor",
                "details": tp,
            })

        # Sort by severity
        severity_order = {"critical": 0, "major": 1, "minor": 2}
        failures.sort(key=lambda f: severity_order.get(f["severity"], 99))

        return failures

    # ==================================================================
    # 7. Full Attack Orchestration
    # ==================================================================

    def run_full_attack(
        self,
        data_config: Dict[str, Any],
    ) -> Dict[str, Any]:
        r"""Orchestrate a comprehensive adversarial review of the primary analysis.

        Runs the full battery of attack analyses and assembles them into a
        single structured report.  The ``data_config`` must provide the raw
        arrays needed for re-analysis:

        .. code-block:: python

            data_config = {
                "time_to_event": np.ndarray,  # shape (n,)
                "event_indicator": np.ndarray, # shape (n,)  0/1
                "treatment": np.ndarray,       # shape (n,)  0/1
                "covariates": np.ndarray,      # shape (n, p)
                "covariate_names": List[str],  # length p
                "primary_result": {            # optional override
                    "hr": float,
                    "ci_lower": float,
                    "ci_upper": float,
                    "p_value": float,
                    "method": str,
                },
            }

        Parameters
        ----------
        data_config : dict
            See above for required keys.

        Returns
        -------
        dict
            The complete attack report.  See module docstring for schema.
        """
        timestamp = datetime.utcnow().isoformat() + "Z"

        # ── Extract arrays ────────────────────────────────────────────
        time_to_event = np.asarray(data_config["time_to_event"], dtype=np.float64)
        event_indicator = np.asarray(data_config["event_indicator"], dtype=np.float64)
        treatment = np.asarray(data_config["treatment"], dtype=np.float64)
        covariates = np.asarray(data_config["covariates"], dtype=np.float64)
        covariate_names = data_config.get("covariate_names", [
            f"X{i}" for i in range(covariates.shape[1])
        ])

        n = len(treatment)
        n_treated = int(treatment.sum())
        n_control = n - n_treated

        # ── Step 1: Propensity scores ─────────────────────────────────
        try:
            ps_results = self.stat.compute_propensity_scores(
                treatment, covariates, covariate_names
            )
            ps = np.array(ps_results["propensity_scores"])
        except Exception as exc:
            logger.warning("Propensity score estimation failed: %s", exc)
            ps = np.full(n, treatment.mean())
            ps_results = {"propensity_scores": ps.tolist(), "error": str(exc)}

        # ── Step 2: Primary estimate (weighted Cox) ───────────────────
        primary_override = data_config.get("primary_result")
        if primary_override:
            primary_estimate = {
                "hr": float(primary_override["hr"]),
                "ci_lower": float(primary_override["ci_lower"]),
                "ci_upper": float(primary_override["ci_upper"]),
                "p_value": float(primary_override.get("p_value", 0.0)),
                "method": primary_override.get("method", "user_supplied"),
            }
        else:
            try:
                iptw_res = self.stat.compute_iptw(treatment, ps, stabilized=True)
                weights = iptw_res["weights"]
                cox_res = self.stat.compute_weighted_cox(
                    time_to_event, event_indicator, treatment, weights
                )
                primary_estimate = {
                    "hr": float(cox_res.get("hazard_ratio", 1.0)),
                    "ci_lower": float(cox_res.get("ci_lower", 1.0)),
                    "ci_upper": float(cox_res.get("ci_upper", 1.0)),
                    "p_value": float(cox_res.get("p_value", 1.0)),
                    "method": "iptw_stabilized_cox",
                }
            except Exception as exc:
                logger.warning("Primary Cox estimation failed: %s", exc)
                primary_estimate = {
                    "hr": 1.0, "ci_lower": 1.0, "ci_upper": 1.0,
                    "p_value": 1.0, "method": "failed",
                }

        hr = primary_estimate["hr"]
        ci_lo = primary_estimate["ci_lower"]
        ci_hi = primary_estimate["ci_upper"]

        # ── Step 3: Weighting comparison ──────────────────────────────
        weighting_comparison = {}
        perturbation_results = []

        # 3a. Standard IPTW
        try:
            iptw_raw = self.stat.compute_iptw(treatment, ps, stabilized=False)
            cox_iptw = self.stat.compute_weighted_cox(
                time_to_event, event_indicator, treatment, iptw_raw["weights"]
            )
            iptw_summary = {
                "hr": float(cox_iptw.get("hazard_ratio", 1.0)),
                "ci_lower": float(cox_iptw.get("ci_lower", 1.0)),
                "ci_upper": float(cox_iptw.get("ci_upper", 1.0)),
                "ess": iptw_raw["effective_sample_size"],
            }
            weighting_comparison["iptw"] = iptw_summary
            perturbation_results.append({"name": "iptw", **iptw_summary})
        except Exception as exc:
            logger.warning("IPTW comparison failed: %s", exc)
            weighting_comparison["iptw"] = {"error": str(exc)}

        # 3b. Stabilised IPTW
        try:
            iptw_stab = self.stat.compute_iptw(treatment, ps, stabilized=True)
            cox_stab = self.stat.compute_weighted_cox(
                time_to_event, event_indicator, treatment, iptw_stab["weights"]
            )
            stab_summary = {
                "hr": float(cox_stab.get("hazard_ratio", 1.0)),
                "ci_lower": float(cox_stab.get("ci_lower", 1.0)),
                "ci_upper": float(cox_stab.get("ci_upper", 1.0)),
                "ess": iptw_stab["effective_sample_size"],
            }
            weighting_comparison["stabilized"] = stab_summary
            perturbation_results.append({"name": "stabilized", **stab_summary})
        except Exception as exc:
            logger.warning("Stabilised IPTW comparison failed: %s", exc)
            weighting_comparison["stabilized"] = {"error": str(exc)}

        # 3c. Overlap (ATO) weights
        try:
            ato_res = self.compute_overlap_weights(treatment, ps)
            cox_ato = self.stat.compute_weighted_cox(
                time_to_event, event_indicator, treatment, ato_res["weights"]
            )
            ato_summary = {
                "hr": float(cox_ato.get("hazard_ratio", 1.0)),
                "ci_lower": float(cox_ato.get("ci_lower", 1.0)),
                "ci_upper": float(cox_ato.get("ci_upper", 1.0)),
                "ess": ato_res["effective_sample_size"],
            }
            weighting_comparison["overlap"] = ato_summary
            perturbation_results.append({"name": "overlap", **ato_summary})
        except Exception as exc:
            logger.warning("Overlap weighting comparison failed: %s", exc)
            weighting_comparison["overlap"] = {"error": str(exc)}

        # 3d. Trimming sensitivity
        for trim in self.cfg.trim_thresholds:
            try:
                iptw_trim = self.stat.compute_iptw(
                    treatment, ps, stabilized=True, trim_percentile=trim
                )
                cox_trim = self.stat.compute_weighted_cox(
                    time_to_event, event_indicator, treatment, iptw_trim["weights"]
                )
                trim_summary = {
                    "name": f"trim_{trim[0]:.2f}_{trim[1]:.2f}",
                    "hr": float(cox_trim.get("hazard_ratio", 1.0)),
                    "ci_lower": float(cox_trim.get("ci_lower", 1.0)),
                    "ci_upper": float(cox_trim.get("ci_upper", 1.0)),
                }
                perturbation_results.append(trim_summary)
            except Exception:
                pass

        # ── Step 4: Stability envelope ────────────────────────────────
        stability_envelope = self.compute_stability_envelope(
            primary_estimate, perturbation_results
        )

        # ── Step 5: E-value ───────────────────────────────────────────
        e_value_result = self._compute_e_value_internal(hr, ci_lo, ci_hi)

        # ── Step 6: Positivity diagnostics ────────────────────────────
        positivity = self.run_positivity_diagnostics(
            treatment, covariates, ps, covariate_names
        )

        # ── Step 7: Balance summary ───────────────────────────────────
        balance_summary = self._compute_balance_summary(
            treatment, covariates, covariate_names, ps
        )

        # ── Step 8: Model dependence ─────────────────────────────────
        methods_for_dep = {}
        for key in ["iptw", "stabilized", "overlap"]:
            entry = weighting_comparison.get(key, {})
            if "hr" in entry:
                methods_for_dep[key] = entry
        model_dependence = self.compute_model_dependence(methods_for_dep)

        # ── Step 9: Unmeasured confounding ────────────────────────────
        unmeasured = self.simulate_unmeasured_confounding(hr, ci_lo, ci_hi)

        # ── Step 10: Subgroup robustness ──────────────────────────────
        subgroup_robustness = self._assess_subgroup_robustness(
            time_to_event, event_indicator, treatment, covariates,
            covariate_names, ps
        )

        # ── Assemble partial report for failure-mode detection ────────
        partial_report = {
            "primary_estimate": primary_estimate,
            "stability_range": stability_envelope.get("stability_range", {}),
            "e_value": e_value_result,
            "positivity_diagnostics": positivity,
            "balance_summary": balance_summary,
            "model_dependence": model_dependence,
            "unmeasured_confounding": unmeasured,
        }

        # ── Step 11: Failure modes ────────────────────────────────────
        failure_modes = self.identify_failure_modes(partial_report)

        # ── Step 12: Overall verdict ──────────────────────────────────
        overall_verdict = self._compute_overall_verdict(
            stability_envelope, e_value_result, positivity,
            model_dependence, balance_summary, failure_modes
        )

        # ── Final report ──────────────────────────────────────────────
        report = {
            "timestamp": timestamp,
            "sample_size": {
                "total": n,
                "treated": n_treated,
                "control": n_control,
            },
            "primary_estimate": primary_estimate,
            "weighting_comparison": weighting_comparison,
            "stability_range": stability_envelope["stability_range"],
            "max_delta": stability_envelope["max_delta"],
            "e_value": e_value_result,
            "positivity_diagnostics": positivity,
            "balance_summary": balance_summary,
            "model_dependence": model_dependence,
            "unmeasured_confounding": unmeasured,
            "subgroup_robustness": subgroup_robustness,
            "failure_modes": failure_modes,
            "overall_verdict": overall_verdict,
        }

        return report

    # ==================================================================
    # Internal helpers
    # ==================================================================

    def _compute_e_value_internal(
        self,
        hr: float,
        ci_lower: float,
        ci_upper: float,
    ) -> Dict[str, Any]:
        r"""Compute E-value without depending on scipy.

        .. math::

            E\text{-value} = \text{HR} + \sqrt{\text{HR} \times (\text{HR} - 1)}

        for :math:`\text{HR} \ge 1`; invert first if :math:`\text{HR} < 1`.

        The CI-bound E-value uses the bound closest to the null.
        """
        def _e_val(ratio: float) -> float:
            if ratio < 1.0:
                ratio = 1.0 / ratio
            return float(ratio + np.sqrt(ratio * (ratio - 1.0)))

        e_point = _e_val(hr)

        if hr >= 1.0:
            e_ci = _e_val(ci_lower) if ci_lower > 1.0 else 1.0
        else:
            e_ci = _e_val(ci_upper) if ci_upper < 1.0 else 1.0

        # Interpretation
        if e_ci > 3.0:
            interp = (
                f"Strong robustness: an unmeasured confounder would need RR >= "
                f"{e_ci:.2f} with both treatment and outcome to explain away the "
                f"observed association."
            )
        elif e_ci > 2.0:
            interp = (
                f"Moderate robustness to unmeasured confounding (E-value CI = "
                f"{e_ci:.2f})."
            )
        elif e_ci > 1.0:
            interp = (
                f"Weak robustness: a relatively small unmeasured confounder "
                f"(E-value CI = {e_ci:.2f}) could shift the CI to include the null."
            )
        else:
            interp = (
                "The confidence interval already includes the null. No unmeasured "
                "confounding is needed to explain the result away."
            )

        return {
            "point": float(e_point),
            "ci_bound": float(e_ci),
            "interpretation": interp,
        }

    def _compute_balance_summary(
        self,
        treatment: np.ndarray,
        covariates: np.ndarray,
        covariate_names: List[str],
        ps: np.ndarray,
    ) -> Dict[str, Any]:
        r"""Compute pre- and post-weighting covariate balance via SMD.

        The standardised mean difference is:

        .. math::

            \text{SMD}_j = \frac{\bar{X}_{j,1} - \bar{X}_{j,0}}
            {\sqrt{(s_{j,1}^2 + s_{j,0}^2) / 2}}

        Post-weighting SMD uses IPTW-weighted means and variances.

        Parameters
        ----------
        treatment : np.ndarray
        covariates : np.ndarray
        covariate_names : list of str
        ps : np.ndarray

        Returns
        -------
        dict with pre_weighting, post_weighting, covariates_above_threshold.
        """
        eps = 1e-8
        ps_clip = np.clip(ps, eps, 1.0 - eps)
        weights = np.where(treatment == 1, 1.0 / ps_clip, 1.0 / (1.0 - ps_clip))

        t_mask = treatment == 1
        c_mask = treatment == 0

        pre_smds = {}
        post_smds = {}
        above_threshold = []

        for j, name in enumerate(covariate_names):
            col = covariates[:, j] if covariates.ndim > 1 else covariates

            # Pre-weighting SMD
            mean_t = col[t_mask].mean() if t_mask.any() else 0.0
            mean_c = col[c_mask].mean() if c_mask.any() else 0.0
            var_t = col[t_mask].var(ddof=1) if t_mask.sum() > 1 else 0.0
            var_c = col[c_mask].var(ddof=1) if c_mask.sum() > 1 else 0.0
            pooled_sd = np.sqrt((var_t + var_c) / 2.0)
            pre_smd = float((mean_t - mean_c) / pooled_sd) if pooled_sd > eps else 0.0
            pre_smds[name] = round(pre_smd, 4)

            # Post-weighting SMD (weighted means/variances)
            w_t = weights[t_mask]
            w_c = weights[c_mask]
            col_t = col[t_mask]
            col_c = col[c_mask]

            w_mean_t = float(np.average(col_t, weights=w_t)) if len(w_t) > 0 else 0.0
            w_mean_c = float(np.average(col_c, weights=w_c)) if len(w_c) > 0 else 0.0

            # Weighted variance
            def _wvar(x, w):
                if len(x) < 2:
                    return 0.0
                mu = np.average(x, weights=w)
                return float(np.average((x - mu) ** 2, weights=w))

            w_var_t = _wvar(col_t, w_t)
            w_var_c = _wvar(col_c, w_c)
            w_pooled = np.sqrt((w_var_t + w_var_c) / 2.0)
            post_smd = float((w_mean_t - w_mean_c) / w_pooled) if w_pooled > eps else 0.0
            post_smds[name] = round(post_smd, 4)

            if abs(post_smd) > self.cfg.smd_threshold:
                above_threshold.append(name)

        return {
            "pre_weighting": pre_smds,
            "post_weighting": post_smds,
            "covariates_above_threshold": above_threshold,
            "threshold": self.cfg.smd_threshold,
        }

    def _assess_subgroup_robustness(
        self,
        time_to_event: np.ndarray,
        event_indicator: np.ndarray,
        treatment: np.ndarray,
        covariates: np.ndarray,
        covariate_names: List[str],
        ps: np.ndarray,
    ) -> List[Dict[str, Any]]:
        r"""Assess whether the treatment effect is consistent across subgroups.

        For each covariate, splits the sample at the median and estimates
        the HR within each subgroup.  Flags subgroups where the direction
        or significance differs from the overall estimate.

        .. math::

            \text{Interaction contrast} =
            |\log(\widehat{HR}_{\text{above}}) - \log(\widehat{HR}_{\text{below}})|

        Parameters
        ----------
        time_to_event, event_indicator, treatment, covariates :
            Standard analysis arrays.
        covariate_names : list of str
        ps : np.ndarray

        Returns
        -------
        list of dict
            Per-covariate subgroup analysis results.
        """
        results = []

        for j, cov_name in enumerate(covariate_names):
            col = covariates[:, j] if covariates.ndim > 1 else covariates
            median_val = float(np.median(col))

            subgroup_results = {}
            for label, mask in [
                ("below_median", col <= median_val),
                ("above_median", col > median_val),
            ]:
                n_sub = int(mask.sum())
                n_events = int(event_indicator[mask].sum())
                n_treat_sub = int(treatment[mask].sum())

                if n_sub < 10 or n_events < 3 or n_treat_sub < 2 or n_treat_sub >= n_sub - 1:
                    subgroup_results[label] = {
                        "hr": None, "n": n_sub, "events": n_events,
                        "note": "Insufficient data for subgroup analysis.",
                    }
                    continue

                try:
                    # Use stabilised IPTW within subgroup
                    ps_sub = ps[mask]
                    iptw_sub = self.stat.compute_iptw(
                        treatment[mask], ps_sub, stabilized=True
                    )
                    cox_sub = self.stat.compute_weighted_cox(
                        time_to_event[mask], event_indicator[mask],
                        treatment[mask], iptw_sub["weights"]
                    )
                    subgroup_results[label] = {
                        "hr": float(cox_sub.get("hazard_ratio", 1.0)),
                        "ci_lower": float(cox_sub.get("ci_lower", 1.0)),
                        "ci_upper": float(cox_sub.get("ci_upper", 1.0)),
                        "n": n_sub,
                        "events": n_events,
                    }
                except Exception as exc:
                    subgroup_results[label] = {
                        "hr": None, "n": n_sub, "events": n_events,
                        "note": f"Estimation failed: {exc}",
                    }

            # Interaction contrast
            hr_below = (subgroup_results.get("below_median", {}) or {}).get("hr")
            hr_above = (subgroup_results.get("above_median", {}) or {}).get("hr")
            interaction = None
            if hr_below is not None and hr_above is not None and hr_below > 0 and hr_above > 0:
                interaction = float(abs(np.log(hr_above) - np.log(hr_below)))

            results.append({
                "covariate": cov_name,
                "median_split": float(median_val),
                "subgroups": subgroup_results,
                "interaction_contrast": interaction,
                "qualitative_interaction": bool(
                    hr_below is not None and hr_above is not None
                    and ((hr_below < 1.0 and hr_above > 1.0)
                         or (hr_below > 1.0 and hr_above < 1.0))
                ),
            })

        return results

    def _compute_overall_verdict(
        self,
        stability: Dict[str, Any],
        e_value: Dict[str, Any],
        positivity: Dict[str, Any],
        model_dependence: Dict[str, Any],
        balance: Dict[str, Any],
        failure_modes: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        r"""Compute an overall robustness score and categorical verdict.

        The robustness score is a weighted composite:

        .. math::

            R = \sum_{k} w_k \cdot s_k

        where each component score :math:`s_k \in [0, 1]` reflects the
        quality of that diagnostic dimension:

        - **Stability** (:math:`s_1`): 1 if sign-consistent and max_delta
          < 0.10, graded down otherwise.
        - **E-value** (:math:`s_2`): min(e_ci / 3, 1).
        - **Positivity** (:math:`s_3`): 1 if no violations, 0.5 if near,
          0 if structural.
        - **Model dependence** (:math:`s_4`): 1 - min(max_var / 0.30, 1).
        - **Balance** (:math:`s_5`): fraction of covariates with
          post-weighting SMD < threshold.

        Returns
        -------
        dict
            ``robustness_score``, ``verdict``, ``critical_flags``,
            ``component_scores``.
        """
        w = self.cfg.robustness_weights

        # S1: stability
        s_range = stability.get("stability_range", {})
        max_d = stability.get("max_delta", 0.0)
        sign_ok = stability.get("sign_consistent", True)
        if sign_ok and max_d < 0.05:
            s1 = 1.0
        elif sign_ok and max_d < 0.10:
            s1 = 0.8
        elif sign_ok and max_d < 0.20:
            s1 = 0.6
        elif sign_ok:
            s1 = 0.4
        else:
            s1 = 0.1

        # S2: e-value
        e_ci = e_value.get("ci_bound", 1.0)
        s2 = min(e_ci / 3.0, 1.0)

        # S3: positivity
        pos_sev = positivity.get("overall", {}).get("severity", "none")
        if pos_sev == "none":
            s3 = 1.0
        elif pos_sev == "mild":
            s3 = 0.8
        elif pos_sev == "moderate":
            s3 = 0.5
        else:
            s3 = 0.1

        # S4: model dependence
        max_var = model_dependence.get("max_variation", 0.0)
        s4 = max(1.0 - max_var / 0.30, 0.0)

        # S5: balance
        covs_above = balance.get("covariates_above_threshold", [])
        post_smds = balance.get("post_weighting", {})
        n_covs = max(len(post_smds), 1)
        s5 = 1.0 - len(covs_above) / n_covs

        # Composite
        robustness_score = (
            w["stability"] * s1
            + w["e_value"] * s2
            + w["positivity"] * s3
            + w["model_dependence"] * s4
            + w["balance"] * s5
        )
        robustness_score = round(float(robustness_score), 3)

        # Verdict
        if robustness_score >= 0.80:
            verdict = "robust"
        elif robustness_score >= 0.60:
            verdict = "moderately_robust"
        elif robustness_score >= 0.40:
            verdict = "fragile"
        else:
            verdict = "unreliable"

        # Critical flags
        critical_flags = [
            f["description"]
            for f in failure_modes
            if f["severity"] == "critical"
        ]

        return {
            "robustness_score": robustness_score,
            "verdict": verdict,
            "critical_flags": critical_flags,
            "component_scores": {
                "stability": round(float(s1), 3),
                "e_value": round(float(s2), 3),
                "positivity": round(float(s3), 3),
                "model_dependence": round(float(s4), 3),
                "balance": round(float(s5), 3),
            },
        }

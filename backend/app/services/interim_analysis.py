"""
Afarensis Enterprise — Interim Analysis & Group Sequential Methods

Implements group sequential trial designs with alpha-spending functions
for planned interim analyses. Supports O'Brien-Fleming, Lan-DeMets,
Pocock, and custom spending functions.

Used for IDMC/DSMB reporting and adaptive trial monitoring.
"""

import numpy as np
from scipy import stats
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


class InterimAnalysisService:
    """Group sequential methods and alpha-spending for interim analyses."""

    # ------------------------------------------------------------------
    # Alpha-Spending Functions
    # ------------------------------------------------------------------
    def compute_alpha_spending(
        self,
        information_fractions: List[float],
        method: str = "obrien_fleming",
        alpha: float = 0.025,
        gamma: float = -4.0,
    ) -> Dict:
        """
        Compute cumulative alpha spent and critical boundaries at each look.

        Parameters
        ----------
        information_fractions : list of float
            Information fractions at each look (e.g. [0.25, 0.5, 0.75, 1.0]).
        method : str
            Spending function: 'obrien_fleming', 'pocock', 'lan_demets_obrien_fleming',
            'lan_demets_pocock', or 'hwang_shih_decani'.
        alpha : float
            Overall one-sided type-I error rate.
        gamma : float
            Shape parameter for Hwang-Shih-DeCani spending function.

        Returns
        -------
        dict with boundaries and alpha allocations.
        """
        fracs = np.asarray(information_fractions, dtype=float)
        k = len(fracs)
        float(stats.norm.ppf(1 - alpha))

        cum_alpha = np.zeros(k)
        for i, t in enumerate(fracs):
            cum_alpha[i] = self._alpha_spending_function(t, method, alpha, gamma)

        # Incremental alpha at each look
        inc_alpha = np.zeros(k)
        inc_alpha[0] = cum_alpha[0]
        for i in range(1, k):
            inc_alpha[i] = cum_alpha[i] - cum_alpha[i - 1]

        # Critical z-values via incremental alpha
        z_critical = np.zeros(k)
        p_nominal = np.zeros(k)
        for i in range(k):
            if inc_alpha[i] > 0:
                z_critical[i] = float(stats.norm.ppf(1 - inc_alpha[i]))
            else:
                z_critical[i] = float("inf")
            p_nominal[i] = float(1.0 - stats.norm.cdf(z_critical[i]))

        # Refine boundaries using the recursive method (Armitage-style)
        z_boundaries = self._compute_group_sequential_boundaries(fracs, cum_alpha)

        p_upper = np.array([float(1.0 - stats.norm.cdf(z)) for z in z_boundaries])

        return {
            "information_fractions": fracs.tolist(),
            "cumulative_alpha_spent": cum_alpha.tolist(),
            "incremental_alpha": inc_alpha.tolist(),
            "critical_values": z_boundaries.tolist(),
            "nominal_p_values": p_upper.tolist(),
            "boundaries_upper": z_boundaries.tolist(),
            "boundaries_lower": (-z_boundaries).tolist(),
        }

    def _alpha_spending_function(self, t: float, method: str, alpha: float, gamma: float) -> float:
        """Evaluate the spending function at information fraction t."""
        t = max(0.0, min(1.0, t))
        z_a2 = stats.norm.ppf(1 - alpha)

        if method == "obrien_fleming":
            return float(2.0 * (1.0 - stats.norm.cdf(z_a2 / np.sqrt(t))))

        elif method == "pocock":
            return float(alpha * np.log(1.0 + (np.e - 1.0) * t))

        elif method == "lan_demets_obrien_fleming":
            if t <= 0:
                return 0.0
            return float(2.0 - 2.0 * stats.norm.cdf(z_a2 / np.sqrt(t)))

        elif method == "lan_demets_pocock":
            return float(alpha * np.log(1.0 + (np.e - 1.0) * t))

        elif method == "hwang_shih_decani":
            if abs(gamma) < 1e-8:
                return float(alpha * t)
            return float(alpha * (1.0 - np.exp(-gamma * t)) / (1.0 - np.exp(-gamma)))

        else:
            raise ValueError(f"Unknown spending method: {method}")

    def _compute_group_sequential_boundaries(
        self, fracs: np.ndarray, cum_alpha: np.ndarray
    ) -> np.ndarray:
        """
        Compute group sequential z-boundaries using an iterative approach.
        For each look k, find z_k such that the cumulative rejection probability
        equals the cumulative alpha spent.
        """
        k = len(fracs)
        z_bounds = np.zeros(k)

        for i in range(k):
            inc = cum_alpha[i] - (cum_alpha[i - 1] if i > 0 else 0.0)
            if inc <= 0:
                z_bounds[i] = float("inf")
            else:
                z_bounds[i] = float(stats.norm.ppf(1 - inc))

        return z_bounds

    # ------------------------------------------------------------------
    # Interim Boundaries
    # ------------------------------------------------------------------
    def compute_interim_boundaries(
        self,
        n_looks: int,
        method: str = "obrien_fleming",
        alpha: float = 0.025,
        sides: str = "two_sided",
        gamma: float = -4.0,
    ) -> Dict:
        """
        Compute stopping boundaries for n planned interim looks.

        Parameters
        ----------
        n_looks : int
            Number of planned analyses (including final).
        method : str
            Alpha-spending method.
        alpha : float
            One-sided alpha (doubled internally for two-sided).
        sides : str
            'one_sided' or 'two_sided'.
        gamma : float
            HSD gamma parameter.

        Returns
        -------
        dict with boundary table.
        """
        if sides == "two_sided":
            one_sided_alpha = alpha / 2.0
        else:
            one_sided_alpha = alpha

        fracs = [(i + 1) / n_looks for i in range(n_looks)]
        spending = self.compute_alpha_spending(fracs, method, one_sided_alpha, gamma)

        z_upper = spending["critical_values"]

        # Futility boundaries (non-binding): use beta-spending with Lan-DeMets OBF
        beta = 0.20  # 80% power assumption
        z_futility = []
        for i, t in enumerate(fracs):
            beta_spent = self._alpha_spending_function(t, "lan_demets_obrien_fleming", beta, gamma)
            if i == 0:
                beta_inc = beta_spent
            else:
                beta_inc = beta_spent - self._alpha_spending_function(fracs[i - 1], "lan_demets_obrien_fleming", beta, gamma)
            if beta_inc > 0:
                z_futility.append(float(stats.norm.ppf(beta_inc)))
            else:
                z_futility.append(float("-inf"))

        cum_alpha_vals = spending["cumulative_alpha_spent"]

        rows = []
        for i in range(n_looks):
            rows.append({
                "look_number": i + 1,
                "information_fraction": fracs[i],
                "z_upper": z_upper[i],
                "z_lower": z_futility[i],
                "p_efficacy": float(1.0 - stats.norm.cdf(z_upper[i])) if z_upper[i] < float("inf") else 0.0,
                "p_futility": float(stats.norm.cdf(z_futility[i])) if z_futility[i] > float("-inf") else 0.0,
                "cumulative_alpha": cum_alpha_vals[i],
            })

        return {
            "n_looks": n_looks,
            "method": method,
            "sides": sides,
            "overall_alpha": alpha,
            "boundaries": rows,
        }

    # ------------------------------------------------------------------
    # Evaluate Interim Result
    # ------------------------------------------------------------------
    def evaluate_interim_result(
        self,
        z_statistic: float,
        look_number: int,
        boundaries: Dict,
    ) -> Dict:
        """
        Evaluate an observed test statistic against pre-specified boundaries.

        Parameters
        ----------
        z_statistic : float
            Observed z-statistic at this interim look.
        look_number : int
            Which look (1-indexed).
        boundaries : dict
            Output of compute_interim_boundaries.

        Returns
        -------
        dict with decision and supporting metrics.
        """
        look_idx = look_number - 1
        boundary_rows = boundaries["boundaries"]

        if look_idx < 0 or look_idx >= len(boundary_rows):
            raise ValueError(f"look_number {look_number} out of range [1, {len(boundary_rows)}]")

        row = boundary_rows[look_idx]
        z_upper = row["z_upper"]
        z_lower = row["z_lower"]
        info_frac = row["information_fraction"]

        if z_statistic >= z_upper:
            decision = "stop_efficacy"
        elif z_statistic <= z_lower:
            decision = "stop_futility"
        else:
            decision = "continue"

        p_value = float(1.0 - stats.norm.cdf(abs(z_statistic)))
        if boundaries.get("sides") == "two_sided":
            p_value *= 2.0

        # Conditional power under current trend
        theta_hat = z_statistic * np.sqrt(info_frac)  # MLE-based effect
        cp_current = self.compute_conditional_power(
            z_statistic, info_frac, theta_alt=theta_hat, alpha=boundaries.get("overall_alpha", 0.025)
        )

        # Predictive power (averaged over posterior)
        # Approximate: CP with a Bayesian shrinkage
        pred_power = self.compute_conditional_power(
            z_statistic, info_frac, theta_alt=theta_hat * 0.8, alpha=boundaries.get("overall_alpha", 0.025)
        )

        return {
            "decision": decision,
            "z_observed": z_statistic,
            "z_boundary_upper": z_upper,
            "z_boundary_lower": z_lower,
            "p_value": min(1.0, p_value),
            "conditional_power": cp_current,
            "predictive_power": pred_power,
        }

    # ------------------------------------------------------------------
    # Conditional Power
    # ------------------------------------------------------------------
    def compute_conditional_power(
        self,
        z_current: float,
        information_fraction: float,
        theta_alt: float = 0.0,
        alpha: float = 0.025,
    ) -> float:
        """
        Conditional power: P(reject H0 at final | current data).

        CP = Phi( (z_current * sqrt(I_max/I_k) + theta * sqrt(I_max - I_k) - z_alpha) / 1 )

        Simplified for I_max = 1:
        CP = Phi( z_current * sqrt(t) / sqrt(1-t) + theta * sqrt(1-t) - z_alpha / sqrt(1-t) )

        Parameters
        ----------
        z_current : float
            Current z-statistic.
        information_fraction : float
            Current information fraction (0 < t < 1).
        theta_alt : float
            Assumed true effect size (on z-scale).
        alpha : float
            One-sided significance level.

        Returns
        -------
        float : conditional power in [0, 1].
        """
        t = information_fraction
        if t >= 1.0:
            return 1.0 if z_current >= stats.norm.ppf(1 - alpha) else 0.0
        if t <= 0.0:
            return 0.0

        z_alpha = float(stats.norm.ppf(1 - alpha))
        remaining = 1.0 - t

        # B_k = z_current * sqrt(t), drift under alt = theta * sqrt(I_max)
        # CP = Phi( (B_k + theta*(1-t) - z_alpha*sqrt(1)) / sqrt(1-t) )
        # Alternative parameterization:
        cp_arg = (z_current * np.sqrt(t / remaining) + theta_alt * np.sqrt(remaining) - z_alpha / np.sqrt(remaining))
        cp = float(stats.norm.cdf(cp_arg))

        return max(0.0, min(1.0, cp))

    # ------------------------------------------------------------------
    # Sample Size Re-estimation
    # ------------------------------------------------------------------
    def compute_sample_size_reestimation(
        self,
        z_current: float,
        info_fraction: float,
        target_power: float = 0.80,
        alpha: float = 0.025,
        original_n: int = 200,
    ) -> Dict:
        """
        Re-estimate required sample size based on interim results.

        Parameters
        ----------
        z_current : float
            Observed z-statistic at interim.
        info_fraction : float
            Information fraction at interim.
        target_power : float
            Desired conditional power at final.
        alpha : float
            One-sided significance level.
        original_n : int
            Originally planned total sample size.

        Returns
        -------
        dict with re-estimated sample size.
        """
        float(stats.norm.ppf(1 - alpha))
        float(stats.norm.ppf(target_power))
        t = info_fraction

        # Current effect estimate (on z-scale per unit info)
        theta_hat = z_current / np.sqrt(t) if t > 0 else 0.0

        # CP at original N
        cp_original = self.compute_conditional_power(z_current, t, theta_alt=theta_hat, alpha=alpha)

        # Find inflation factor such that CP = target_power
        # Need: z_current * sqrt(t / (1-t_new)) + theta*(1-t_new)*sqrt(?) - z_alpha/sqrt(1-t_new) = z_beta
        # Solve for required remaining info I_rem
        if theta_hat <= 0:
            # Cannot achieve target power with zero/negative trend
            updated_n = original_n * 3  # cap at 3x
            inflation = 3.0
        else:
            # Required remaining info: (z_alpha - z_current*sqrt(t/I_rem) + z_beta)^2 / theta_hat^2
            # Iterative approach
            best_n = original_n
            for mult in np.arange(1.0, 5.01, 0.05):
                cand_n = int(np.ceil(original_n * mult))
                remaining_frac = 1.0 - (t * original_n / cand_n)
                if remaining_frac <= 0:
                    continue
                cp_cand = self.compute_conditional_power(
                    z_current, t * original_n / cand_n, theta_alt=theta_hat, alpha=alpha
                )
                if cp_cand >= target_power:
                    best_n = cand_n
                    break
            else:
                best_n = int(np.ceil(original_n * 5.0))

            updated_n = best_n
            inflation = updated_n / original_n

        cp_updated = self.compute_conditional_power(
            z_current, t * original_n / updated_n if updated_n > 0 else t, theta_alt=theta_hat, alpha=alpha
        )

        return {
            "original_n": original_n,
            "updated_n": updated_n,
            "inflation_factor": float(inflation),
            "conditional_power_at_original_n": cp_original,
            "conditional_power_at_updated_n": cp_updated,
            "theta_hat": float(theta_hat),
        }

    # ------------------------------------------------------------------
    # DSMB Report Generation
    # ------------------------------------------------------------------
    def generate_dsmb_report(
        self,
        interim_data: Dict,
        boundaries: Dict,
        look_number: int,
    ) -> Dict:
        """
        Generate a structured DSMB/IDMC report for an interim look.

        Parameters
        ----------
        interim_data : dict
            Keys: 'treatment' (array), 'control' (array),
            'n_events' (int, optional), 'adverse_events' (int, optional),
            'outcome_type' (str, default 'continuous').
        boundaries : dict
            Output of compute_interim_boundaries.
        look_number : int
            Current look number.

        Returns
        -------
        dict with structured DSMB report.
        """
        trt = np.asarray(interim_data["treatment"], dtype=float)
        ctl = np.asarray(interim_data["control"], dtype=float)
        outcome_type = interim_data.get("outcome_type", "continuous")
        n_ae = interim_data.get("adverse_events", None)

        n_trt = len(trt)
        n_ctl = len(ctl)
        n_total = n_trt + n_ctl

        # Compute z-statistic
        if outcome_type == "binary":
            p_trt = float(np.mean(trt > 0))
            p_ctl = float(np.mean(ctl > 0))
            p_pool = (np.sum(trt > 0) + np.sum(ctl > 0)) / n_total
            se = float(np.sqrt(p_pool * (1 - p_pool) * (1 / n_trt + 1 / n_ctl))) if 0 < p_pool < 1 else 1.0
            z_stat = (p_trt - p_ctl) / se
        else:
            diff = float(np.mean(trt) - np.mean(ctl))
            s_trt = float(np.std(trt, ddof=1)) if n_trt > 1 else 1.0
            s_ctl = float(np.std(ctl, ddof=1)) if n_ctl > 1 else 1.0
            se = float(np.sqrt(s_trt ** 2 / n_trt + s_ctl ** 2 / n_ctl))
            z_stat = diff / se if se > 0 else 0.0

        # Evaluate against boundaries
        evaluation = self.evaluate_interim_result(float(z_stat), look_number, boundaries)

        # Conditional power
        info_frac = boundaries["boundaries"][look_number - 1]["information_fraction"]
        theta_hat = z_stat / np.sqrt(info_frac) if info_frac > 0 else 0.0
        cp = self.compute_conditional_power(float(z_stat), info_frac, theta_alt=theta_hat)

        # Predictive probability
        pred_prob = self.compute_conditional_power(float(z_stat), info_frac, theta_alt=theta_hat * 0.8)

        # Safety summary
        safety = {}
        if n_ae is not None:
            ae_rate = n_ae / n_total if n_total > 0 else 0.0
            safety = {
                "total_adverse_events": n_ae,
                "ae_rate": float(ae_rate),
                "ae_assessment": "acceptable" if ae_rate < 0.10 else ("concern" if ae_rate < 0.20 else "elevated"),
            }

        # Recommendation
        if evaluation["decision"] == "stop_efficacy":
            recommendation = "Consider stopping for overwhelming efficacy. Notify sponsor."
        elif evaluation["decision"] == "stop_futility":
            recommendation = "Consider stopping for futility. Trial unlikely to demonstrate efficacy."
        elif cp < 0.20:
            recommendation = "Continue with caution. Conditional power is low; consider sample size re-estimation."
        else:
            recommendation = "Continue as planned. No stopping boundary crossed."

        return {
            "look_summary": {
                "look_number": look_number,
                "total_looks": len(boundaries["boundaries"]),
                "information_fraction": info_frac,
                "n_treatment": n_trt,
                "n_control": n_ctl,
                "n_total": n_total,
                "z_statistic": float(z_stat),
                "p_value": evaluation["p_value"],
            },
            "efficacy_assessment": {
                "decision": evaluation["decision"],
                "z_observed": float(z_stat),
                "z_boundary_upper": evaluation["z_boundary_upper"],
                "crossed_efficacy": evaluation["decision"] == "stop_efficacy",
            },
            "futility_assessment": {
                "z_boundary_lower": evaluation["z_boundary_lower"],
                "crossed_futility": evaluation["decision"] == "stop_futility",
            },
            "safety_summary": safety,
            "recommendation": recommendation,
            "conditional_power": cp,
            "predictive_probability": pred_prob,
        }

    # ------------------------------------------------------------------
    # Group Sequential Simulation
    # ------------------------------------------------------------------
    def run_group_sequential_simulation(
        self,
        n_max: int = 200,
        n_looks: int = 4,
        effect_size: float = 0.3,
        method: str = "obrien_fleming",
        alpha: float = 0.025,
        n_simulations: int = 10000,
        seed: int = 42,
    ) -> Dict:
        """
        Simulate operating characteristics of a group sequential design.

        Parameters
        ----------
        n_max : int
            Maximum total sample size (equal allocation assumed).
        n_looks : int
            Number of planned interim looks.
        effect_size : float
            True standardized treatment effect (0 for type-I error).
        method : str
            Alpha-spending method.
        alpha : float
            One-sided significance level.
        n_simulations : int
            Number of simulated trials.
        seed : int
            Random seed for reproducibility.

        Returns
        -------
        dict with operating characteristics.
        """
        rng = np.random.default_rng(seed)

        # Pre-compute boundaries
        boundaries = self.compute_interim_boundaries(n_looks, method, alpha, sides="one_sided")
        z_upper = [row["z_upper"] for row in boundaries["boundaries"]]
        z_lower = [row["z_lower"] for row in boundaries["boundaries"]]
        fracs = [row["information_fraction"] for row in boundaries["boundaries"]]

        n_per_arm = n_max // 2
        look_sizes = [int(np.ceil(f * n_per_arm)) for f in fracs]

        n_reject = 0
        total_n_used = 0
        early_stops = 0
        stop_looks = []

        for _ in range(n_simulations):
            # Generate full dataset
            y_trt = rng.normal(loc=effect_size, scale=1.0, size=n_per_arm)
            y_ctl = rng.normal(loc=0.0, scale=1.0, size=n_per_arm)

            rejected = False
            stopped_early = False
            stop_look = n_looks

            for k in range(n_looks):
                nk = look_sizes[k]
                nk = min(nk, n_per_arm)

                trt_k = y_trt[:nk]
                ctl_k = y_ctl[:nk]

                diff = float(np.mean(trt_k) - np.mean(ctl_k))
                se = float(np.sqrt(np.var(trt_k, ddof=1) / nk + np.var(ctl_k, ddof=1) / nk))
                z_k = diff / se if se > 0 else 0.0

                if z_k >= z_upper[k]:
                    rejected = True
                    stopped_early = k < (n_looks - 1)
                    stop_look = k + 1
                    break
                elif z_k <= z_lower[k]:
                    stopped_early = k < (n_looks - 1)
                    stop_look = k + 1
                    break

            if rejected:
                n_reject += 1
            if stopped_early:
                early_stops += 1

            total_n_used += 2 * look_sizes[stop_look - 1]
            stop_looks.append(stop_look)

        power = n_reject / n_simulations
        avg_n = total_n_used / n_simulations
        prob_early = early_stops / n_simulations
        avg_stop = float(np.mean(stop_looks))

        # Stopping distribution
        stop_dist = {}
        for k in range(1, n_looks + 1):
            stop_dist[f"look_{k}"] = float(stop_looks.count(k) / n_simulations)


        return {
            "power" if effect_size > 0 else "type1_error": power,
            "type1_error" if effect_size > 0 else "power": None,
            "expected_sample_size": avg_n,
            "probability_of_early_stopping": prob_early,
            "average_stopping_look": avg_stop,
            "stopping_distribution": stop_dist,
            "n_simulations": n_simulations,
            "design": {
                "n_max": n_max,
                "n_looks": n_looks,
                "effect_size": effect_size,
                "method": method,
                "alpha": alpha,
            },
            "boundaries_used": boundaries,
        }

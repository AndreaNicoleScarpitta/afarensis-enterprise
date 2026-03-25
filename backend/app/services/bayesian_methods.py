"""
Afarensis Enterprise — Bayesian Statistical Methods

Implements Bayesian analysis methods per FDA's January 2026 draft guidance
"Use of Bayesian Methodology in Clinical Trials of Drugs and Biologics".
Supports prior elicitation, posterior computation, credible intervals,
Bayesian adaptive designs, and historical data borrowing.

Uses scipy.stats for distributions and numerical integration.
"""

import numpy as np
from scipy import stats, integrate
from typing import Dict, List, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class BayesianAnalysisService:
    """Bayesian statistical analysis for regulatory submissions."""

    # ------------------------------------------------------------------
    # Core Bayesian Analysis (conjugate + grid approximation)
    # ------------------------------------------------------------------
    def compute_bayesian_analysis(
        self,
        data: np.ndarray,
        prior_type: str = "non_informative",
        prior_params: Optional[Dict] = None,
        likelihood_type: str = "normal",
    ) -> Dict:
        """
        Compute posterior distribution given data, prior, and likelihood.
        Uses conjugate analysis when available, grid approximation otherwise.

        Parameters
        ----------
        data : array-like
            Observed data values.
        prior_type : str
            One of 'normal', 'beta', 'gamma', 'non_informative'.
        prior_params : dict, optional
            Parameters for the prior distribution.
        likelihood_type : str
            One of 'normal', 'binomial', 'poisson'.

        Returns
        -------
        dict with posterior summary statistics.
        """
        data = np.asarray(data, dtype=float)
        if prior_params is None:
            prior_params = {}

        try:
            # ---- Conjugate: Normal likelihood, Normal prior ----
            if likelihood_type == "normal" and prior_type in ("normal", "non_informative"):
                return self._conjugate_normal(data, prior_type, prior_params)

            # ---- Conjugate: Binomial likelihood, Beta prior ----
            if likelihood_type == "binomial" and prior_type in ("beta", "non_informative"):
                return self._conjugate_beta_binomial(data, prior_type, prior_params)

            # ---- Conjugate: Poisson likelihood, Gamma prior ----
            if likelihood_type == "poisson" and prior_type in ("gamma", "non_informative"):
                return self._conjugate_gamma_poisson(data, prior_type, prior_params)

            # ---- Fallback: grid approximation ----
            return self._grid_approximation(data, prior_type, prior_params, likelihood_type)

        except Exception as exc:
            logger.error("Bayesian analysis failed: %s", exc)
            raise

    # ---- conjugate helpers ----

    def _conjugate_normal(self, data: np.ndarray, prior_type: str, prior_params: Dict) -> Dict:
        n = len(data)
        x_bar = float(np.mean(data))
        s2 = float(np.var(data, ddof=1)) if n > 1 else 1.0

        if prior_type == "non_informative":
            # Jeffreys / reference prior -> posterior is normal
            mu0, tau0_sq = 0.0, 1e10
        else:
            mu0 = float(prior_params.get("mean", 0.0))
            sd0 = float(prior_params.get("sd", 1.0))
            tau0_sq = sd0 ** 2

        # Posterior precision
        prec0 = 1.0 / tau0_sq
        prec_data = n / s2
        prec_post = prec0 + prec_data
        tau_post_sq = 1.0 / prec_post
        mu_post = (prec0 * mu0 + prec_data * x_bar) / prec_post
        sd_post = float(np.sqrt(tau_post_sq))

        post_dist = stats.norm(loc=mu_post, scale=sd_post)
        ci95 = tuple(float(v) for v in post_dist.interval(0.95))
        ci99 = tuple(float(v) for v in post_dist.interval(0.99))
        prob_superiority = float(1.0 - post_dist.cdf(0.0))

        # Bayes factor (BF10): point null H0: mu=0
        # Savage-Dickey ratio: BF10 = prior(0) / posterior(0)
        prior_at_0 = stats.norm.pdf(0.0, loc=mu0, scale=float(np.sqrt(tau0_sq)))
        post_at_0 = post_dist.pdf(0.0)
        bayes_factor = float(prior_at_0 / post_at_0) if post_at_0 > 1e-300 else float("inf")

        ess = float(prec_data / prec_post * n)

        return {
            "prior_type": prior_type,
            "prior_params": {"mean": mu0, "sd": float(np.sqrt(tau0_sq))},
            "posterior_params": {"mean": mu_post, "sd": sd_post},
            "posterior_mean": mu_post,
            "posterior_median": mu_post,
            "credible_interval_95": ci95,
            "credible_interval_99": ci99,
            "posterior_probability_of_superiority": prob_superiority,
            "bayes_factor": bayes_factor,
            "effective_sample_size": ess,
        }

    def _conjugate_beta_binomial(self, data: np.ndarray, prior_type: str, prior_params: Dict) -> Dict:
        n = len(data)
        successes = int(np.sum(data > 0))

        if prior_type == "non_informative":
            a0, b0 = 0.5, 0.5  # Jeffreys prior
        else:
            a0 = float(prior_params.get("alpha", 1.0))
            b0 = float(prior_params.get("beta", 1.0))

        a_post = a0 + successes
        b_post = b0 + (n - successes)
        post_dist = stats.beta(a_post, b_post)

        post_mean = float(post_dist.mean())
        post_median = float(post_dist.median())
        ci95 = tuple(float(v) for v in post_dist.interval(0.95))
        ci99 = tuple(float(v) for v in post_dist.interval(0.99))
        prob_superiority = float(1.0 - post_dist.cdf(0.5))

        prior_at_half = stats.beta.pdf(0.5, a0, b0)
        post_at_half = post_dist.pdf(0.5)
        bayes_factor = float(prior_at_half / post_at_half) if post_at_half > 1e-300 else float("inf")

        ess = float(a_post + b_post)

        return {
            "prior_type": prior_type,
            "prior_params": {"alpha": a0, "beta": b0},
            "posterior_params": {"alpha": a_post, "beta": b_post},
            "posterior_mean": post_mean,
            "posterior_median": post_median,
            "credible_interval_95": ci95,
            "credible_interval_99": ci99,
            "posterior_probability_of_superiority": prob_superiority,
            "bayes_factor": bayes_factor,
            "effective_sample_size": ess,
        }

    def _conjugate_gamma_poisson(self, data: np.ndarray, prior_type: str, prior_params: Dict) -> Dict:
        n = len(data)
        total = float(np.sum(data))

        if prior_type == "non_informative":
            a0, b0 = 0.001, 0.001  # vague gamma
        else:
            a0 = float(prior_params.get("shape", 1.0))
            b0 = float(prior_params.get("rate", 1.0))

        a_post = a0 + total
        b_post = b0 + n
        post_dist = stats.gamma(a=a_post, scale=1.0 / b_post)

        post_mean = float(post_dist.mean())
        post_median = float(post_dist.median())
        ci95 = tuple(float(v) for v in post_dist.interval(0.95))
        ci99 = tuple(float(v) for v in post_dist.interval(0.99))

        # Superiority: P(lambda > 1)
        prob_superiority = float(1.0 - post_dist.cdf(1.0))

        prior_at_1 = stats.gamma.pdf(1.0, a=a0, scale=1.0 / b0) if b0 > 0 else 0.0
        post_at_1 = post_dist.pdf(1.0)
        bayes_factor = float(prior_at_1 / post_at_1) if post_at_1 > 1e-300 else float("inf")

        ess = float(a_post)

        return {
            "prior_type": prior_type,
            "prior_params": {"shape": a0, "rate": b0},
            "posterior_params": {"shape": a_post, "rate": b_post},
            "posterior_mean": post_mean,
            "posterior_median": post_median,
            "credible_interval_95": ci95,
            "credible_interval_99": ci99,
            "posterior_probability_of_superiority": prob_superiority,
            "bayes_factor": bayes_factor,
            "effective_sample_size": ess,
        }

    def _grid_approximation(
        self, data: np.ndarray, prior_type: str, prior_params: Dict, likelihood_type: str
    ) -> Dict:
        """Grid approximation for non-conjugate combinations."""
        n_grid = 2000
        x_bar = float(np.mean(data))
        x_sd = float(np.std(data, ddof=1)) if len(data) > 1 else 1.0

        grid_lo = x_bar - 5 * x_sd
        grid_hi = x_bar + 5 * x_sd
        theta = np.linspace(grid_lo, grid_hi, n_grid)
        d_theta = theta[1] - theta[0]

        # Prior
        if prior_type == "normal":
            log_prior = stats.norm.logpdf(theta, loc=prior_params.get("mean", 0), scale=prior_params.get("sd", 1))
        elif prior_type == "gamma":
            log_prior = stats.gamma.logpdf(theta, a=prior_params.get("shape", 1), scale=1.0 / prior_params.get("rate", 1))
        elif prior_type == "beta":
            theta_01 = np.clip((theta - grid_lo) / (grid_hi - grid_lo), 1e-10, 1 - 1e-10)
            log_prior = stats.beta.logpdf(theta_01, prior_params.get("alpha", 1), prior_params.get("beta", 1))
        else:
            log_prior = np.zeros(n_grid)  # flat

        # Log-likelihood
        log_lik = np.zeros(n_grid)
        for obs in data:
            if likelihood_type == "normal":
                log_lik += stats.norm.logpdf(obs, loc=theta, scale=x_sd)
            elif likelihood_type == "binomial":
                p_clip = np.clip(theta, 1e-10, 1 - 1e-10)
                log_lik += obs * np.log(p_clip) + (1 - obs) * np.log(1 - p_clip)
            elif likelihood_type == "poisson":
                lam = np.clip(theta, 1e-10, None)
                log_lik += obs * np.log(lam) - lam

        log_post = log_prior + log_lik
        log_post -= log_post.max()
        post_unnorm = np.exp(log_post)
        post_norm = post_unnorm / (np.sum(post_unnorm) * d_theta)

        # Summaries
        post_mean = float(np.sum(theta * post_norm * d_theta))
        cum = np.cumsum(post_norm * d_theta)
        post_median = float(theta[np.searchsorted(cum, 0.5)])

        ci95_lo = float(theta[np.searchsorted(cum, 0.025)])
        ci95_hi = float(theta[np.searchsorted(cum, 0.975)])
        ci99_lo = float(theta[np.searchsorted(cum, 0.005)])
        ci99_hi = float(theta[np.searchsorted(cum, 0.995)])

        prob_superiority = float(np.sum(post_norm[theta > 0] * d_theta))

        return {
            "prior_type": prior_type,
            "prior_params": prior_params,
            "posterior_params": {"grid_mean": post_mean, "grid_sd": float(np.sqrt(np.sum((theta - post_mean) ** 2 * post_norm * d_theta)))},
            "posterior_mean": post_mean,
            "posterior_median": post_median,
            "credible_interval_95": (ci95_lo, ci95_hi),
            "credible_interval_99": (ci99_lo, ci99_hi),
            "posterior_probability_of_superiority": prob_superiority,
            "bayes_factor": None,
            "effective_sample_size": float(len(data)),
        }

    # ------------------------------------------------------------------
    # Prior Elicitation
    # ------------------------------------------------------------------
    def compute_prior_elicitation(
        self,
        historical_data: np.ndarray,
        method: str = "power_prior",
        alpha0: float = 0.5,
    ) -> Dict:
        """
        Derive an informative prior from historical data.

        Parameters
        ----------
        historical_data : array-like
            Summary or individual-level historical data.
        method : str
            'power_prior', 'meta_analytic_predictive', or 'robust_mixture'.
        alpha0 : float
            Discount factor for power prior (0 = ignore, 1 = full weight).

        Returns
        -------
        dict with prior specification and diagnostics.
        """
        historical_data = np.asarray(historical_data, dtype=float)
        n_hist = len(historical_data)
        mu_hist = float(np.mean(historical_data))
        sd_hist = float(np.std(historical_data, ddof=1)) if n_hist > 1 else 1.0

        try:
            if method == "power_prior":
                return self._elicit_power_prior(historical_data, alpha0)
            elif method == "meta_analytic_predictive":
                return self._elicit_map_prior(historical_data)
            elif method == "robust_mixture":
                return self._elicit_robust_mixture(historical_data)
            else:
                raise ValueError(f"Unknown elicitation method: {method}")
        except Exception as exc:
            logger.error("Prior elicitation failed: %s", exc)
            raise

    def _elicit_power_prior(self, hist: np.ndarray, alpha0: float) -> Dict:
        n = len(hist)
        mu = float(np.mean(hist))
        sd = float(np.std(hist, ddof=1)) if n > 1 else 1.0

        # Power prior: effective n = alpha0 * n
        eff_n = alpha0 * n
        prior_sd = sd / np.sqrt(eff_n) if eff_n > 0 else 1e6

        recommendation = "strong" if alpha0 > 0.7 else ("moderate" if alpha0 > 0.3 else "weak")

        return {
            "prior_type": "normal",
            "prior_params": {"mean": mu, "sd": float(prior_sd)},
            "effective_historical_n": float(eff_n),
            "discount_factor": float(alpha0),
            "recommendation": f"Power prior with {recommendation} borrowing (alpha0={alpha0:.2f})",
        }

    def _elicit_map_prior(self, hist: np.ndarray) -> Dict:
        """Meta-Analytic Predictive prior: treat historical studies as exchangeable."""
        n = len(hist)
        mu = float(np.mean(hist))
        sd = float(np.std(hist, ddof=1)) if n > 1 else 1.0

        # MAP approximation: normal with inflated variance to account for between-study heterogeneity
        tau_est = sd / np.sqrt(n)
        # Predictive SD combines within and between study variance
        map_sd = float(np.sqrt(sd ** 2 + tau_est ** 2))

        eff_n = (sd / map_sd) ** 2 * n

        return {
            "prior_type": "normal",
            "prior_params": {"mean": mu, "sd": map_sd},
            "effective_historical_n": float(eff_n),
            "discount_factor": float(eff_n / n),
            "recommendation": f"MAP prior centred at {mu:.3f} with SD {map_sd:.3f}",
        }

    def _elicit_robust_mixture(self, hist: np.ndarray) -> Dict:
        """Mixture of informative (from data) and vague component."""
        n = len(hist)
        mu = float(np.mean(hist))
        sd = float(np.std(hist, ddof=1)) if n > 1 else 1.0

        w_informative = 0.8
        w_vague = 0.2
        informative_sd = sd / np.sqrt(n)
        vague_sd = 10.0 * sd

        # Effective mixture SD (moment-matching)
        mix_var = w_informative * informative_sd ** 2 + w_vague * vague_sd ** 2
        mix_sd = float(np.sqrt(mix_var))
        eff_n = (sd / mix_sd) ** 2 * n

        return {
            "prior_type": "robust_mixture_normal",
            "prior_params": {
                "mean": mu,
                "sd_informative": float(informative_sd),
                "sd_vague": float(vague_sd),
                "weight_informative": w_informative,
                "weight_vague": w_vague,
                "mixture_sd_approx": mix_sd,
            },
            "effective_historical_n": float(eff_n),
            "discount_factor": float(eff_n / n) if n > 0 else 0.0,
            "recommendation": f"Robust mixture prior (80% informative / 20% vague), effective N={eff_n:.1f}",
        }

    # ------------------------------------------------------------------
    # Posterior Predictive
    # ------------------------------------------------------------------
    def compute_posterior_predictive(
        self,
        posterior_params: Dict,
        n_future: int = 100,
        threshold: float = 0.0,
    ) -> Dict:
        """
        Posterior predictive distribution for future observations.

        Parameters
        ----------
        posterior_params : dict
            Must contain 'mean' and 'sd' of the posterior.
        n_future : int
            Number of future observations to predict.
        threshold : float
            Success threshold for go/no-go probability.

        Returns
        -------
        dict with predictive summary.
        """
        mu_post = float(posterior_params["mean"])
        sd_post = float(posterior_params["sd"])

        # Predictive distribution for the mean of n_future observations
        pred_mean = mu_post
        pred_sd = float(np.sqrt(sd_post ** 2 + sd_post ** 2 / n_future))

        pred_dist = stats.norm(loc=pred_mean, scale=pred_sd)
        pred_interval = tuple(float(v) for v in pred_dist.interval(0.95))

        # Probability that future mean exceeds threshold
        prob_success = float(1.0 - pred_dist.cdf(threshold))

        return {
            "predictive_mean": pred_mean,
            "predictive_sd": pred_sd,
            "predictive_interval_95": pred_interval,
            "probability_of_success": prob_success,
            "n_future": n_future,
            "threshold": threshold,
        }

    # ------------------------------------------------------------------
    # Bayesian Adaptive Design
    # ------------------------------------------------------------------
    def compute_bayesian_adaptive(
        self,
        interim_data: Dict,
        decision_rules: Optional[Dict] = None,
    ) -> Dict:
        """
        Evaluate Bayesian adaptive decision at an interim analysis.

        Parameters
        ----------
        interim_data : dict
            Keys: 'treatment' (array), 'control' (array), 'outcome_type' ('binary' or 'continuous').
        decision_rules : dict, optional
            Thresholds: 'stop_efficacy' (default 0.99), 'stop_futility' (default 0.05).

        Returns
        -------
        dict with decision and supporting probabilities.
        """
        if decision_rules is None:
            decision_rules = {}

        thr_efficacy = float(decision_rules.get("stop_efficacy", 0.99))
        thr_futility = float(decision_rules.get("stop_futility", 0.05))

        trt = np.asarray(interim_data["treatment"], dtype=float)
        ctl = np.asarray(interim_data["control"], dtype=float)
        outcome_type = interim_data.get("outcome_type", "continuous")

        if outcome_type == "binary":
            # Beta-binomial model for each arm
            a_t = 1 + np.sum(trt > 0)
            b_t = 1 + np.sum(trt <= 0)
            a_c = 1 + np.sum(ctl > 0)
            b_c = 1 + np.sum(ctl <= 0)

            # Monte Carlo P(p_trt > p_ctl)
            n_mc = 50000
            rng = np.random.default_rng(42)
            p_trt = rng.beta(a_t, b_t, n_mc)
            p_ctl = rng.beta(a_c, b_c, n_mc)
            post_prob = float(np.mean(p_trt > p_ctl))
        else:
            # Normal model
            diff_mean = float(np.mean(trt) - np.mean(ctl))
            n_t, n_c = len(trt), len(ctl)
            s_t = float(np.std(trt, ddof=1)) if n_t > 1 else 1.0
            s_c = float(np.std(ctl, ddof=1)) if n_c > 1 else 1.0
            se_diff = float(np.sqrt(s_t ** 2 / n_t + s_c ** 2 / n_c))
            post_prob = float(1.0 - stats.norm.cdf(0, loc=diff_mean, scale=se_diff))

        # Decision
        if post_prob >= thr_efficacy:
            decision = "stop_efficacy"
        elif post_prob <= thr_futility:
            decision = "stop_futility"
        else:
            decision = "continue"

        # Predictive probability of success at final analysis (rough estimate)
        n_current = len(trt) + len(ctl)
        n_planned = n_current * 2  # assume halfway
        info_frac = n_current / n_planned
        z_curr = stats.norm.ppf(post_prob)
        pred_prob_success = float(stats.norm.cdf(
            z_curr * np.sqrt(1 / info_frac) - stats.norm.ppf(1 - 0.025) * np.sqrt((1 - info_frac) / info_frac)
        ))

        return {
            "posterior_probability": post_prob,
            "decision": decision,
            "decision_rules": {"stop_efficacy": thr_efficacy, "stop_futility": thr_futility},
            "expected_sample_size": n_current if decision != "continue" else n_planned,
            "predictive_probability_of_success": max(0.0, min(1.0, pred_prob_success)),
        }

    # ------------------------------------------------------------------
    # Bayesian Historical Borrowing
    # ------------------------------------------------------------------
    def compute_bayesian_borrowing(
        self,
        current_data: np.ndarray,
        historical_data: np.ndarray,
        method: str = "power_prior",
        alpha0: float = 0.5,
    ) -> Dict:
        """
        Borrow strength from historical data to augment the current trial.

        Parameters
        ----------
        current_data : array-like
            Current trial data.
        historical_data : array-like
            Historical trial data.
        method : str
            'commensurate_prior', 'power_prior', or 'robust_map'.
        alpha0 : float
            Discount factor (used by power_prior and commensurate_prior).

        Returns
        -------
        dict comparing posteriors with and without borrowing.
        """
        current_data = np.asarray(current_data, dtype=float)
        historical_data = np.asarray(historical_data, dtype=float)

        n_cur = len(current_data)
        n_hist = len(historical_data)
        mu_cur = float(np.mean(current_data))
        sd_cur = float(np.std(current_data, ddof=1)) if n_cur > 1 else 1.0
        mu_hist = float(np.mean(historical_data))
        sd_hist = float(np.std(historical_data, ddof=1)) if n_hist > 1 else 1.0

        # Posterior WITHOUT borrowing (flat prior)
        post_no_borrow_mean = mu_cur
        post_no_borrow_sd = sd_cur / np.sqrt(n_cur)

        if method == "power_prior":
            borrowed_weight = float(alpha0)
            eff_n = alpha0 * n_hist
            prior_prec = eff_n / (sd_hist ** 2)
            data_prec = n_cur / (sd_cur ** 2)
            post_prec = prior_prec + data_prec
            post_mean = (prior_prec * mu_hist + data_prec * mu_cur) / post_prec
            post_sd = float(np.sqrt(1.0 / post_prec))

        elif method == "commensurate_prior":
            # Commensurate prior: tau controls similarity
            # Use data-driven tau based on conflict
            conflict = abs(mu_cur - mu_hist) / np.sqrt(sd_cur ** 2 / n_cur + sd_hist ** 2 / n_hist)
            # Dynamic discount: less borrowing when conflict is high
            tau = float(np.exp(-0.5 * conflict ** 2))
            borrowed_weight = tau
            eff_n = tau * n_hist

            prior_prec = eff_n / (sd_hist ** 2)
            data_prec = n_cur / (sd_cur ** 2)
            post_prec = prior_prec + data_prec
            post_mean = (prior_prec * mu_hist + data_prec * mu_cur) / post_prec
            post_sd = float(np.sqrt(1.0 / post_prec))

        elif method == "robust_map":
            # Robust MAP: mixture of informative and vague
            w_info = 0.8
            info_prec = n_hist / (sd_hist ** 2)
            vague_prec = 1.0 / (100 * sd_hist) ** 2
            data_prec = n_cur / (sd_cur ** 2)

            # Informative component posterior
            prec_i = info_prec + data_prec
            mu_i = (info_prec * mu_hist + data_prec * mu_cur) / prec_i
            sd_i = np.sqrt(1.0 / prec_i)
            ll_i = stats.norm.logpdf(mu_cur, loc=mu_hist, scale=np.sqrt(sd_hist ** 2 / n_hist + sd_cur ** 2 / n_cur))

            # Vague component posterior
            prec_v = vague_prec + data_prec
            mu_v = (vague_prec * mu_hist + data_prec * mu_cur) / prec_v
            sd_v = np.sqrt(1.0 / prec_v)
            ll_v = stats.norm.logpdf(mu_cur, loc=mu_hist, scale=np.sqrt(1.0 / vague_prec + sd_cur ** 2 / n_cur))

            # Update weights via marginal likelihood
            log_w_i = np.log(w_info) + ll_i
            log_w_v = np.log(1 - w_info) + ll_v
            max_lw = max(log_w_i, log_w_v)
            w_i_post = np.exp(log_w_i - max_lw) / (np.exp(log_w_i - max_lw) + np.exp(log_w_v - max_lw))
            w_v_post = 1.0 - w_i_post

            # Mixture posterior (moment-matching)
            post_mean = float(w_i_post * mu_i + w_v_post * mu_v)
            post_var = float(w_i_post * (sd_i ** 2 + mu_i ** 2) + w_v_post * (sd_v ** 2 + mu_v ** 2) - post_mean ** 2)
            post_sd = float(np.sqrt(max(post_var, 1e-20)))
            borrowed_weight = float(w_i_post)
            eff_n = borrowed_weight * n_hist
        else:
            raise ValueError(f"Unknown borrowing method: {method}")

        return {
            "method": method,
            "borrowed_weight": float(borrowed_weight),
            "effective_n_borrowed": float(eff_n),
            "posterior_with_borrowing": {
                "mean": float(post_mean),
                "sd": float(post_sd),
                "ci_95": (
                    float(post_mean - 1.96 * post_sd),
                    float(post_mean + 1.96 * post_sd),
                ),
            },
            "posterior_without_borrowing": {
                "mean": float(post_no_borrow_mean),
                "sd": float(post_no_borrow_sd),
                "ci_95": (
                    float(post_no_borrow_mean - 1.96 * post_no_borrow_sd),
                    float(post_no_borrow_mean + 1.96 * post_no_borrow_sd),
                ),
            },
            "comparison": {
                "mean_shift": float(post_mean - post_no_borrow_mean),
                "precision_gain": float((post_no_borrow_sd / post_sd) ** 2) if post_sd > 0 else float("inf"),
                "ci_width_reduction_pct": float(
                    (1 - post_sd / post_no_borrow_sd) * 100
                ) if post_no_borrow_sd > 0 else 0.0,
            },
        }

    # ------------------------------------------------------------------
    # Full Bayesian Pipeline
    # ------------------------------------------------------------------
    def run_bayesian_pipeline(
        self,
        treatment: np.ndarray,
        control: np.ndarray,
        outcome_type: str = "continuous",
        historical_data: Optional[np.ndarray] = None,
    ) -> Dict:
        """
        End-to-end Bayesian analysis pipeline.

        Steps: prior elicitation -> posterior computation -> credible intervals
               -> predictive -> decision.

        Parameters
        ----------
        treatment : array-like
            Treatment arm data.
        control : array-like
            Control arm data.
        outcome_type : str
            'binary', 'continuous', or 'time_to_event'.
        historical_data : array-like, optional
            Historical control data for borrowing.

        Returns
        -------
        dict with comprehensive analysis results.
        """
        treatment = np.asarray(treatment, dtype=float)
        control = np.asarray(control, dtype=float)

        results: Dict[str, Any] = {"outcome_type": outcome_type}

        # Step 1: Prior elicitation
        if historical_data is not None:
            historical_data = np.asarray(historical_data, dtype=float)
            prior_info = self.compute_prior_elicitation(historical_data, method="robust_mixture")
            borrowing_info = self.compute_bayesian_borrowing(
                control, historical_data, method="robust_map"
            )
            results["prior_elicitation"] = prior_info
            results["historical_borrowing"] = borrowing_info
            prior_type = "normal"
            prior_params = {
                "mean": prior_info["prior_params"]["mean"],
                "sd": prior_info["prior_params"].get("mixture_sd_approx", prior_info["prior_params"].get("sd", 1.0)),
            }
        else:
            prior_type = "non_informative"
            prior_params = {}
            results["prior_elicitation"] = {"prior_type": "non_informative", "recommendation": "No historical data; using non-informative prior"}

        # Step 2: Posterior computation
        if outcome_type == "binary":
            likelihood = "binomial"
            diff = treatment - control  # individual-level difference not meaningful for binary; use effect
            effect_data = treatment  # analyse treatment arm with prior from control/historical
        elif outcome_type == "time_to_event":
            # Log-transform for approximate normality
            likelihood = "normal"
            diff = np.log(treatment + 0.5) - np.log(control + 0.5)
            effect_data = diff
        else:
            likelihood = "normal"
            effect_data = treatment - np.mean(control)  # centre on control mean

        posterior = self.compute_bayesian_analysis(effect_data, prior_type, prior_params, likelihood)
        results["posterior"] = posterior

        # Step 3: Posterior predictive
        predictive = self.compute_posterior_predictive(
            posterior["posterior_params"] if "mean" in posterior["posterior_params"] else {"mean": posterior["posterior_mean"], "sd": posterior["posterior_params"].get("grid_sd", 1.0)},
            n_future=len(treatment),
        )
        results["predictive"] = predictive

        # Step 4: Adaptive decision
        adaptive = self.compute_bayesian_adaptive(
            {"treatment": treatment, "control": control, "outcome_type": outcome_type}
        )
        results["adaptive_decision"] = adaptive

        # Step 5: Summary
        results["summary"] = {
            "posterior_mean": posterior["posterior_mean"],
            "credible_interval_95": posterior["credible_interval_95"],
            "probability_of_superiority": posterior["posterior_probability_of_superiority"],
            "decision": adaptive["decision"],
            "predictive_success_probability": predictive["probability_of_success"],
        }

        return results

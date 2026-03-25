"""Unit tests for StatisticalAnalysisService from app.services.statistical_models."""
import pytest
import numpy as np

from app.services.statistical_models import StatisticalAnalysisService


@pytest.fixture
def svc():
    return StatisticalAnalysisService()


@pytest.fixture
def sim_data(svc):
    """Generate reproducible simulation data."""
    return svc.generate_simulation_data(seed=42)


# ---------------------------------------------------------------------------
# Cox Proportional Hazards
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestCoxPH:

    def test_cox_returns_required_keys(self, svc, sim_data):
        result = svc.compute_cox_proportional_hazards(
            sim_data["time_to_event"],
            sim_data["event_indicator"],
            sim_data["treatment"],
            sim_data["covariates"],
            sim_data["covariate_names"],
        )
        assert "coefficients" in result
        assert "concordance_index" in result
        assert "n_subjects" in result
        assert "n_events" in result
        assert "converged" in result

    def test_cox_treatment_coefficient_present(self, svc, sim_data):
        result = svc.compute_cox_proportional_hazards(
            sim_data["time_to_event"],
            sim_data["event_indicator"],
            sim_data["treatment"],
            sim_data["covariates"],
            sim_data["covariate_names"],
        )
        assert "treatment" in result["coefficients"]
        coef = result["coefficients"]["treatment"]
        assert "hazard_ratio" in coef
        assert "ci_lower" in coef
        assert "ci_upper" in coef
        assert "p_value" in coef
        assert coef["hazard_ratio"] > 0

    def test_concordance_index_range(self, svc, sim_data):
        result = svc.compute_cox_proportional_hazards(
            sim_data["time_to_event"],
            sim_data["event_indicator"],
            sim_data["treatment"],
            sim_data["covariates"],
            sim_data["covariate_names"],
        )
        c = result["concordance_index"]
        assert 0.0 <= c <= 1.0


# ---------------------------------------------------------------------------
# Propensity Scores
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestPropensityScores:

    def test_propensity_scores_returns_keys(self, svc, sim_data):
        result = svc.compute_propensity_scores(
            sim_data["treatment"],
            sim_data["covariates"],
            sim_data["covariate_names"],
        )
        assert "propensity_scores" in result
        assert "c_statistic" in result
        assert "covariate_balance" in result
        assert "converged" in result

    def test_propensity_scores_range_0_1(self, svc, sim_data):
        result = svc.compute_propensity_scores(
            sim_data["treatment"],
            sim_data["covariates"],
        )
        ps = np.array(result["propensity_scores"])
        assert ps.min() >= 0.0
        assert ps.max() <= 1.0

    def test_c_statistic_range(self, svc, sim_data):
        result = svc.compute_propensity_scores(
            sim_data["treatment"],
            sim_data["covariates"],
        )
        c = result["c_statistic"]
        assert 0.0 <= c <= 1.0


# ---------------------------------------------------------------------------
# IPTW
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestIPTW:

    def test_iptw_returns_weights(self, svc, sim_data):
        n = len(sim_data["treatment"])
        ps = np.random.RandomState(0).uniform(0.2, 0.8, size=n)
        result = svc.compute_iptw(sim_data["treatment"], ps)
        assert "weights" in result
        assert len(result["weights"]) == n

    def test_iptw_effective_sample_size(self, svc, sim_data):
        n = len(sim_data["treatment"])
        ps = np.random.RandomState(0).uniform(0.2, 0.8, size=n)
        result = svc.compute_iptw(sim_data["treatment"], ps)
        ess = result["effective_sample_size"]
        assert ess["total"] > 0
        assert ess["treated"] > 0
        assert ess["control"] > 0

    def test_iptw_weights_positive(self, svc, sim_data):
        n = len(sim_data["treatment"])
        ps = np.random.RandomState(0).uniform(0.2, 0.8, size=n)
        result = svc.compute_iptw(sim_data["treatment"], ps)
        assert np.all(result["weights"] > 0)


# ---------------------------------------------------------------------------
# Kaplan-Meier
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestKaplanMeier:

    def test_km_returns_curves(self, svc, sim_data):
        result = svc.compute_kaplan_meier(
            sim_data["time_to_event"],
            sim_data["event_indicator"],
        )
        assert "curves" in result
        assert "n_subjects" in result

    def test_km_survival_starts_at_one(self, svc, sim_data):
        result = svc.compute_kaplan_meier(
            sim_data["time_to_event"],
            sim_data["event_indicator"],
        )
        curve = list(result["curves"].values())[0]
        assert curve["survival_probabilities"][0] == 1.0

    def test_km_survival_monotonically_decreasing(self, svc, sim_data):
        result = svc.compute_kaplan_meier(
            sim_data["time_to_event"],
            sim_data["event_indicator"],
        )
        curve = list(result["curves"].values())[0]
        probs = curve["survival_probabilities"]
        for i in range(1, len(probs)):
            assert probs[i] <= probs[i - 1]

    def test_km_two_group_log_rank(self, svc, sim_data):
        result = svc.compute_kaplan_meier(
            sim_data["time_to_event"],
            sim_data["event_indicator"],
            groups=sim_data["treatment"].astype(int),
            group_labels=["Treatment", "Control"],
        )
        assert result["log_rank_test"] is not None
        assert "p_value" in result["log_rank_test"]


# ---------------------------------------------------------------------------
# E-value
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestEValue:

    def test_e_value_ge_one(self, svc):
        result = svc.compute_e_value(0.82, 0.51, 1.30)
        assert result["e_value_point"] >= 1.0

    def test_e_value_ci_returned(self, svc):
        result = svc.compute_e_value(0.82, 0.51, 1.30)
        assert "e_value_ci" in result
        assert isinstance(result["e_value_ci"], float)

    def test_e_value_interpretation_string(self, svc):
        result = svc.compute_e_value(2.0, 1.5, 2.8)
        assert isinstance(result["interpretation"], str)
        assert len(result["interpretation"]) > 0


# ---------------------------------------------------------------------------
# Fragility Index
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestFragilityIndex:

    def test_fragility_index_positive_for_significant(self, svc):
        result = svc.compute_fragility_index(
            events_treatment=5, n_treatment=50,
            events_control=20, n_control=50,
        )
        assert result["fragility_index"] >= 0

    def test_fragility_quotient_range(self, svc):
        result = svc.compute_fragility_index(
            events_treatment=5, n_treatment=50,
            events_control=20, n_control=50,
        )
        assert 0.0 <= result["fragility_quotient"] <= 1.0

    def test_nonsignificant_result_returns_zero(self, svc):
        result = svc.compute_fragility_index(
            events_treatment=10, n_treatment=50,
            events_control=11, n_control=50,
        )
        assert result["fragility_index"] == 0


# ---------------------------------------------------------------------------
# Meta-Analysis
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestMetaAnalysis:

    def test_meta_analysis_pooled_effect(self, svc):
        effects = np.array([0.5, 0.6, 0.7, 0.55])
        ses = np.array([0.1, 0.12, 0.15, 0.11])
        result = svc.compute_meta_analysis(effects, ses)
        assert "pooled_effect" in result
        assert "ci_lower" in result
        assert "ci_upper" in result
        assert result["ci_lower"] < result["pooled_effect"] < result["ci_upper"]

    def test_meta_analysis_heterogeneity(self, svc):
        effects = np.array([0.5, 0.6, 0.7, 0.55])
        ses = np.array([0.1, 0.12, 0.15, 0.11])
        result = svc.compute_meta_analysis(effects, ses)
        het = result["heterogeneity"]
        assert "I_squared" in het
        assert 0.0 <= het["I_squared"] <= 100.0
        assert "tau_squared" in het
        assert het["tau_squared"] >= 0.0


# ---------------------------------------------------------------------------
# Standardized Mean Difference
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestSMD:

    def test_smd_identical_groups(self, svc):
        g = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        result = svc.compute_standardized_mean_difference(g, g)
        assert abs(result["smd"]) < 1e-10

    def test_smd_different_groups(self, svc):
        g1 = np.array([10.0, 11.0, 12.0, 13.0, 14.0])
        g2 = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        result = svc.compute_standardized_mean_difference(g1, g2)
        assert abs(result["smd"]) > 1.0


# ---------------------------------------------------------------------------
# Simulation data generation
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestSimulationData:

    def test_generate_simulation_data_keys(self, svc):
        data = svc.generate_simulation_data(seed=99)
        assert "time_to_event" in data
        assert "event_indicator" in data
        assert "treatment" in data
        assert "covariates" in data
        assert "covariate_names" in data

    def test_generate_simulation_data_shapes(self, svc):
        data = svc.generate_simulation_data(seed=99)
        n = len(data["time_to_event"])
        assert len(data["event_indicator"]) == n
        assert len(data["treatment"]) == n
        assert data["covariates"].shape[0] == n


# ---------------------------------------------------------------------------
# Full analysis pipeline
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestRunFullAnalysis:

    def test_run_full_analysis_returns_dict(self, svc):
        result = svc.run_full_analysis(seed=42)
        assert isinstance(result, dict)
        # Should contain major result sections
        assert len(result) > 0

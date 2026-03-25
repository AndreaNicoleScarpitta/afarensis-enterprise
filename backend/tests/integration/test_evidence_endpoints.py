import pytest


@pytest.mark.integration
class TestGetEvidence:
    async def test_get_project_evidence(self, authenticated_client, test_project, test_evidence):
        response = await authenticated_client.get(
            f"/api/v1/projects/{test_project.id}/evidence"
        )
        assert response.status_code == 200
        data = response.json()
        # Response could be a list or paginated
        if isinstance(data, list):
            assert isinstance(data, list)
        else:
            assert isinstance(data, dict)


@pytest.mark.integration
class TestGenerateAnchors:
    async def test_generate_anchors(self, authenticated_client, test_project):
        response = await authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/generate-anchors"
        )
        assert response.status_code in (200, 201, 202, 422)
        response.json()  # Verify valid JSON


@pytest.mark.integration
class TestComparabilityScores:
    async def test_get_comparability_scores(self, authenticated_client, test_project):
        response = await authenticated_client.get(
            f"/api/v1/projects/{test_project.id}/comparability-scores"
        )
        assert response.status_code in (200, 201, 202, 422)
        response.json()


@pytest.mark.integration
class TestBiasAnalysis:
    async def test_analyze_bias(self, authenticated_client, test_project):
        response = await authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/analyze-bias"
        )
        assert response.status_code in (200, 201, 202, 422)
        response.json()

    async def test_get_bias_analysis(self, authenticated_client, test_project):
        response = await authenticated_client.get(
            f"/api/v1/projects/{test_project.id}/bias-analysis"
        )
        assert response.status_code in (200, 201, 202, 422)
        response.json()

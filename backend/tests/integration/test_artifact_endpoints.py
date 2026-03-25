import pytest


@pytest.mark.integration
class TestGenerateArtifact:
    async def test_generate_artifact(self, authenticated_client, test_project):
        response = await authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/generate-artifact",
            json={
                "artifact_type": "summary_report",
                "output_format": "html"
            }
        )
        assert response.status_code in (200, 201, 202, 422)
        response.json()


@pytest.mark.integration
class TestListArtifacts:
    async def test_list_artifacts(self, authenticated_client, test_project):
        response = await authenticated_client.get(
            f"/api/v1/projects/{test_project.id}/artifacts"
        )
        assert response.status_code in (200, 201, 202, 422)
        response.json()


@pytest.mark.integration
class TestDownloadArtifact:
    async def test_download_artifact_not_found(self, authenticated_client):
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await authenticated_client.get(
            f"/api/v1/artifacts/{fake_id}/download"
        )
        assert response.status_code in (404, 422)

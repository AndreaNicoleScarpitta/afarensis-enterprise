"""Integration tests for project endpoints."""
import pytest


class TestCreateProject:
    @pytest.mark.asyncio
    async def test_create_project(self, authenticated_client):
        response = await authenticated_client.post("/api/v1/projects", json={
            "title": "Test Study XY-999",
            "description": "A test project",
            "research_intent": "Test drug efficacy",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Study XY-999"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_create_project_unauthenticated(self, client):
        response = await client.post("/api/v1/projects", json={
            "title": "Should Fail",
            "research_intent": "Test",
        })
        assert response.status_code in (401, 403)


class TestListProjects:
    @pytest.mark.asyncio
    async def test_list_projects(self, authenticated_client, test_project):
        response = await authenticated_client.get("/api/v1/projects")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_projects_unauthenticated(self, client):
        response = await client.get("/api/v1/projects")
        assert response.status_code in (401, 403)


class TestGetProject:
    @pytest.mark.asyncio
    async def test_get_project_by_id(self, authenticated_client, test_project):
        project_id = test_project.id
        response = await authenticated_client.get(f"/api/v1/projects/{project_id}")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_nonexistent_project(self, authenticated_client):
        response = await authenticated_client.get("/api/v1/projects/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404

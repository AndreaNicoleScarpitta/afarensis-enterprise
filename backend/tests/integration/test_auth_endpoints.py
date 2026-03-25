"""Integration tests for authentication endpoints."""
import pytest


class TestHealth:
    @pytest.mark.asyncio
    async def test_health_returns_200(self, client):
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestLogin:
    @pytest.mark.asyncio
    async def test_login_success(self, client, test_user):
        response = await client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "Test@12345",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "test@example.com"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client, test_user):
        response = await client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "WrongPassword1!",
        })
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_email(self, client):
        response = await client.post("/api/v1/auth/login", json={
            "email": "nobody@example.com",
            "password": "Test@12345",
        })
        assert response.status_code == 401


class TestAuthMe:
    @pytest.mark.asyncio
    async def test_me_authenticated(self, authenticated_client):
        response = await authenticated_client.get("/api/v1/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"

    @pytest.mark.asyncio
    async def test_me_unauthenticated(self, client):
        response = await client.get("/api/v1/auth/me")
        assert response.status_code in (401, 403)


class TestLogout:
    @pytest.mark.asyncio
    async def test_logout(self, authenticated_client):
        response = await authenticated_client.post("/api/v1/auth/logout")
        assert response.status_code == 200


class TestRevokeAll:
    @pytest.mark.asyncio
    async def test_revoke_all_sessions(self, authenticated_client):
        response = await authenticated_client.post("/api/v1/auth/revoke-all-sessions")
        assert response.status_code == 200
        data = response.json()
        assert "revoked_count" in data

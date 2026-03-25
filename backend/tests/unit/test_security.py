"""Unit tests for core security functions."""
import pytest
from app.core.security import (
    get_password_hash,
    verify_password,
    verify_password_strength,
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user_from_token,
)


class TestPasswordHashing:
    def test_hash_returns_bcrypt_format(self):
        h = get_password_hash("Test@12345")
        assert h.startswith("$2b$")

    def test_verify_correct_password(self):
        h = get_password_hash("Test@12345")
        assert verify_password("Test@12345", h) is True

    def test_verify_wrong_password(self):
        h = get_password_hash("Test@12345")
        assert verify_password("WrongPassword", h) is False

    def test_hash_different_each_time(self):
        h1 = get_password_hash("Test@12345")
        h2 = get_password_hash("Test@12345")
        assert h1 != h2  # Different salts


class TestPasswordStrength:
    def test_strong_password_passes(self):
        is_valid, issues = verify_password_strength("Str0ng!Pass")
        assert is_valid is True
        assert len(issues) == 0

    def test_too_short(self):
        is_valid, issues = verify_password_strength("Ab1!")
        assert is_valid is False
        assert any("8 characters" in i for i in issues)

    def test_no_uppercase(self):
        is_valid, issues = verify_password_strength("lowercase1!")
        assert is_valid is False

    def test_no_digit(self):
        is_valid, issues = verify_password_strength("NoDigits!Here")
        assert is_valid is False

    def test_common_pattern_rejected(self):
        is_valid, issues = verify_password_strength("Password1!")
        assert is_valid is False
        assert any("common" in i.lower() for i in issues)


class TestJWT:
    def test_create_access_token(self):
        token = create_access_token({"sub": "user-123", "role": "admin"})
        assert isinstance(token, str)
        assert len(token) > 50

    def test_verify_valid_token(self):
        token = create_access_token({"sub": "user-123", "role": "admin"})
        payload = verify_token(token)
        assert payload["sub"] == "user-123"
        assert payload["type"] == "access"

    def test_access_token_has_required_claims(self):
        token = create_access_token({"sub": "user-123"})
        payload = verify_token(token)
        assert payload["iss"] == "afarensis-enterprise"
        assert payload["aud"] == "afarensis-api"
        assert "jti" in payload
        assert "exp" in payload

    def test_refresh_token_type(self):
        token = create_refresh_token({"sub": "user-123"})
        payload = verify_token(token)
        assert payload["type"] == "refresh"

    def test_get_current_user_rejects_refresh_token(self):
        token = create_refresh_token({"sub": "user-123"})
        with pytest.raises(Exception):
            get_current_user_from_token(token)

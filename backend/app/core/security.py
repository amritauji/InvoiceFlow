import time
from jose import jwt as jose_jwt, JWTError, ExpiredSignatureError
import jose.jwk as jwk
import httpx
from supabase import create_client, Client
from app.config import get_settings

_supabase_admin: Client | None = None
_jwks_cache: dict | None = None
_jwks_cache_time: float = 0
_JWKS_TTL = 3600  # re-fetch every hour


def get_supabase_client() -> Client:
    """Return a Supabase client with service role key (admin operations)."""
    global _supabase_admin
    if _supabase_admin is None:
        settings = get_settings()
        _supabase_admin = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY,
        )
    return _supabase_admin


def _get_jwks() -> dict:
    """Fetch and cache Supabase JWKS (JSON Web Key Set)."""
    global _jwks_cache, _jwks_cache_time
    if _jwks_cache is None or (time.time() - _jwks_cache_time) > _JWKS_TTL:
        settings = get_settings()
        url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        resp = httpx.get(url, timeout=5)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_cache_time = time.time()
    return _jwks_cache


def _get_signing_key(token: str):
    """Get the public key matching the token's kid from Supabase JWKS."""
    header = jose_jwt.get_unverified_header(token)
    kid = header.get("kid")
    alg = header.get("alg")

    if not kid or not alg:
        raise ValueError("Token missing kid or alg in header")

    jwks = _get_jwks()
    key_data = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)

    if not key_data:
        raise ValueError(f"No matching key found for kid: {kid}")

    return jwk.construct(key_data)


def decode_jwt_token(token: str) -> dict:
    """Decode and verify a Supabase JWT token using JWKS."""
    try:
        signing_key = _get_signing_key(token)
        header = jose_jwt.get_unverified_header(token)
        alg = header.get("alg", "ES256")

        payload = jose_jwt.decode(
            token,
            signing_key,
            algorithms=[alg],
            audience="authenticated",
        )
        return payload
    except ExpiredSignatureError:
        raise ValueError("Token has expired")
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")
    except Exception as e:
        raise ValueError(f"Token verification failed: {e}")

import time
from jose import jwt as jose_jwt, JWTError, ExpiredSignatureError
import jose.jwk as jwk
import httpx
from supabase import create_client, Client
from app.config import get_settings

_supabase_admin: Client | None = None
_supabase_anon: Client | None = None
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


def get_auth_client() -> Client:
    """Return a Supabase client with the anon key (user-facing auth flows).

    Sign-in/session operations must NOT use the service role key — it is a
    superuser credential intended for trusted server-side admin calls.
    """
    global _supabase_anon
    if _supabase_anon is None:
        settings = get_settings()
        _supabase_anon = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_ANON_KEY,
        )
    return _supabase_anon


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

    if not kid:
        raise ValueError("Token missing kid in header")

    alg = header.get("alg")
    if alg not in ALLOWED_ALGORITHMS:
        raise ValueError(f"Unsupported algorithm: {alg}")

    jwks = _get_jwks()
    key_data = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)

    if not key_data:
        raise ValueError(f"No matching key found for kid: {kid}")

    return jwk.construct(key_data)


ALLOWED_ALGORITHMS = ["ES256"]


def decode_jwt_token(token: str) -> dict:
    """Decode and verify a Supabase JWT token using JWKS.

    The algorithm is hardcoded to ES256 to prevent algorithm confusion attacks.
    The token header is only used to look up the correct signing key (kid).
    """
    try:
        signing_key = _get_signing_key(token)

        payload = jose_jwt.decode(
            token,
            signing_key,
            algorithms=ALLOWED_ALGORITHMS,
            audience="authenticated",
        )
        return payload
    except ExpiredSignatureError:
        raise ValueError("Token has expired")
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")
    except Exception as e:
        raise ValueError(f"Token verification failed: {e}")

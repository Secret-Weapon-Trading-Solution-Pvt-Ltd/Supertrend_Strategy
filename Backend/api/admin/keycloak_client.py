"""
api/admin/keycloak_client.py — Thin async wrapper around the Keycloak Admin REST API.

Role model:
  STATUS_ROLES  = (approve, revoke, pending)  — mutually exclusive, one at a time
  admin         — additive, independent of status roles

When a status role is assigned, all other status roles are removed automatically.
New users auto-receive 'pending' via Keycloak's default-roles composite.
"""

import logging

import httpx
from fastapi import HTTPException

from config.settings import settings

log = logging.getLogger(__name__)

MANAGED_ROLES = ("admin", "approve", "revoke", "pending")
STATUS_ROLES  = ("approve", "revoke", "pending")   # mutually exclusive
_SKIP_ROLE_PREFIXES = ("default-roles-", "offline_access", "uma_authorization")


# ── Token ──────────────────────────────────────────────────────────────────────

async def get_admin_token() -> str:
    """Obtain a short-lived admin token from the Keycloak master realm."""
    url = f"{settings.keycloak_url}/realms/master/protocol/openid-connect/token"
    async with httpx.AsyncClient() as client:
        r = await client.post(url, data={
            "grant_type": "password",
            "client_id":  "admin-cli",
            "username":   settings.keycloak_admin_user,
            "password":   settings.keycloak_admin_password,
        })
        if not r.is_success:
            log.error("Keycloak admin token failed: %s", r.text)
            raise HTTPException(status_code=502, detail="Could not obtain Keycloak admin token")
        return r.json()["access_token"]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _base() -> str:
    return f"{settings.keycloak_url}/admin/realms/{settings.keycloak_realm}"


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Realm setup ────────────────────────────────────────────────────────────────

async def ensure_pending_default_role(token: str) -> dict:
    """
    Add 'pending' to the realm's default-roles composite so every new
    registered user automatically receives the pending role.
    """
    base = _base()
    h    = _headers(token)

    async with httpx.AsyncClient() as client:
        # Fetch the pending role representation
        r = await client.get(f"{base}/roles/pending", headers=h)
        if not r.is_success:
            raise HTTPException(status_code=404, detail="Role 'pending' not found — create it in Keycloak first")
        pending_rep = r.json()

        # Fetch the default-roles-{realm} composite role (Keycloak uses lowercase realm name here)
        default_role_name = f"default-roles-{settings.keycloak_realm.lower()}"
        r = await client.get(f"{base}/roles/{default_role_name}", headers=h)
        if not r.is_success:
            raise HTTPException(status_code=404, detail=f"Default roles composite '{default_role_name}' not found")
        default_role_id = r.json()["id"]

        # Check if pending is already a composite of default-roles
        r = await client.get(f"{base}/roles-by-id/{default_role_id}/composites", headers=h)
        existing = [c["name"] for c in r.json()] if r.is_success else []
        if "pending" in existing:
            return {"status": "already_set", "message": "'pending' is already a default role"}

        # Add pending to the default-roles composite
        rr = await client.post(
            f"{base}/roles-by-id/{default_role_id}/composites",
            json=[pending_rep],
            headers=h,
        )
        if not rr.is_success:
            raise HTTPException(status_code=rr.status_code, detail=rr.text)

    log.info("Realm setup: 'pending' set as default role for new registrations")
    return {"status": "ok", "message": "'pending' is now the default role for new users"}


# ── User operations ────────────────────────────────────────────────────────────

def _filter_roles(roles: list[dict]) -> list[str]:
    """Filter out Keycloak internal roles, return only meaningful role names."""
    result = []
    for rm in roles:
        name = rm["name"]
        if any(name == skip or name.startswith("default-roles-") for skip in _SKIP_ROLE_PREFIXES):
            continue
        result.append(name)
    return result


async def list_users(token: str) -> list[dict]:
    """
    Return all realm users with their effective realm roles.
    Uses /composite endpoint so roles assigned via default-roles (e.g. pending)
    are included even when not directly assigned.
    """
    base = _base()
    h    = _headers(token)

    async with httpx.AsyncClient() as client:
        r = await client.get(f"{base}/users?max=200", headers=h)
        r.raise_for_status()
        users: list[dict] = r.json()

        result = []
        for u in users:
            uid = u["id"]
            # Use direct roles only — composite would bleed inherited 'pending' onto approved users
            rr = await client.get(f"{base}/users/{uid}/role-mappings/realm", headers=h)
            roles = _filter_roles(rr.json()) if rr.is_success else []
            result.append({
                "id":        uid,
                "username":  u.get("username"),
                "email":     u.get("email", ""),
                "firstName": u.get("firstName", ""),
                "lastName":  u.get("lastName", ""),
                "enabled":   u.get("enabled", True),
                "roles":     roles,
                "createdAt": u.get("createdTimestamp"),
            })

    return result


async def assign_role(token: str, user_id: str, role_name: str) -> None:
    """
    Assign a realm role to a user.
    If the role is a status role (approve/revoke/pending), all other
    status roles are removed first — they are mutually exclusive.
    """
    _validate_role(role_name)
    base = _base()
    h    = _headers(token)

    async with httpx.AsyncClient() as client:
        # Mutually exclusive: remove all other status roles before assigning
        if role_name in STATUS_ROLES:
            for other in STATUS_ROLES:
                if other == role_name:
                    continue
                try:
                    r = await client.get(f"{base}/roles/{other}", headers=h)
                    if r.is_success:
                        rr = await client.request(
                            "DELETE",
                            f"{base}/users/{user_id}/role-mappings/realm",
                            json=[r.json()],
                            headers=h,
                        )
                        if rr.is_success:
                            log.info("assign_role: removed conflicting role '%s' from user %s", other, user_id)
                except Exception as exc:
                    log.warning("assign_role: could not remove '%s' from %s: %s", other, user_id, exc)

        # Assign the requested role
        role_rep = await _fetch_role(client, base, h, role_name)
        rr = await client.post(
            f"{base}/users/{user_id}/role-mappings/realm",
            json=[role_rep],
            headers=h,
        )
        if not rr.is_success:
            raise HTTPException(status_code=rr.status_code, detail=rr.text)

    log.info("assign_role: '%s' assigned to user %s", role_name, user_id)


async def remove_role(token: str, user_id: str, role_name: str) -> None:
    """Remove a realm role from a user."""
    _validate_role(role_name)
    base = _base()
    h    = _headers(token)

    async with httpx.AsyncClient() as client:
        role_rep = await _fetch_role(client, base, h, role_name)
        rr = await client.request(
            "DELETE",
            f"{base}/users/{user_id}/role-mappings/realm",
            json=[role_rep],
            headers=h,
        )
        if not rr.is_success:
            raise HTTPException(status_code=rr.status_code, detail=rr.text)


async def set_user_enabled(token: str, user_id: str, enabled: bool) -> None:
    """Enable or disable a Keycloak user account."""
    base = _base()
    h    = _headers(token)

    async with httpx.AsyncClient() as client:
        rr = await client.put(
            f"{base}/users/{user_id}",
            json={"enabled": enabled},
            headers=h,
        )
        if not rr.is_success:
            raise HTTPException(status_code=rr.status_code, detail=rr.text)


async def delete_user(token: str, user_id: str) -> None:
    """Permanently delete a Keycloak user."""
    base = _base()
    h    = _headers(token)

    async with httpx.AsyncClient() as client:
        rr = await client.delete(f"{base}/users/{user_id}", headers=h)
        if not rr.is_success:
            raise HTTPException(status_code=rr.status_code, detail=rr.text)

    log.info("delete_user: user %s permanently deleted", user_id)


# ── Private helpers ────────────────────────────────────────────────────────────

def _validate_role(role_name: str) -> None:
    if role_name not in MANAGED_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of: {MANAGED_ROLES}")


async def _fetch_role(client: httpx.AsyncClient, base: str, headers: dict, role_name: str) -> dict:
    r = await client.get(f"{base}/roles/{role_name}", headers=headers)
    if not r.is_success:
        raise HTTPException(status_code=404, detail=f"Role '{role_name}' not found in realm")
    return r.json()

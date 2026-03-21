"""
api/routes_admin.py — Admin REST endpoints (thin router, logic in api/admin/).

All routes are protected — caller must have the 'admin' Keycloak realm role.

  GET    /api/admin/users                         list all users + their roles
  POST   /api/admin/users/{user_id}/roles         assign a role  {role: str}
  DELETE /api/admin/users/{user_id}/roles/{role}  remove a role
  PUT    /api/admin/users/{user_id}/status        enable/disable {enabled: bool}
"""

from fastapi import APIRouter, Depends

from api.admin.auth           import require_admin
from api.admin.keycloak_client import (
    assign_role,
    delete_user,
    ensure_pending_default_role,
    get_admin_token,
    list_users,
    remove_role,
    set_user_enabled,
)

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/users")
async def api_list_users():
    token = await get_admin_token()
    return await list_users(token)


@router.post("/users/{user_id}/roles")
async def api_assign_role(user_id: str, body: dict):
    token = await get_admin_token()
    await assign_role(token, user_id, body.get("role", ""))
    return {"assigned": body.get("role"), "user_id": user_id}


@router.delete("/users/{user_id}/roles/{role_name}")
async def api_remove_role(user_id: str, role_name: str):
    token = await get_admin_token()
    await remove_role(token, user_id, role_name)
    return {"removed": role_name, "user_id": user_id}


@router.put("/users/{user_id}/status")
async def api_set_status(user_id: str, body: dict):
    enabled = bool(body.get("enabled", True))
    token   = await get_admin_token()
    await set_user_enabled(token, user_id, enabled)
    return {"user_id": user_id, "enabled": enabled}


@router.delete("/users/{user_id}")
async def api_delete_user(user_id: str):
    token = await get_admin_token()
    await delete_user(token, user_id)
    return {"deleted": user_id}


@router.post("/setup-realm")
async def api_setup_realm():
    """
    One-time setup: adds 'pending' as the default realm role so every
    new registered user automatically receives the pending role.
    """
    token = await get_admin_token()
    return await ensure_pending_default_role(token)

"""
SWTS — Super Trend Trading System
FastAPI entry point — handles Zerodha OAuth login flow.
"""

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
import zeroda

app = FastAPI(title="SWTS")
templates = Jinja2Templates(directory="templates")

# In-memory token store (will move to DB later)
_access_token: str | None = None


@app.get("/", response_class=HTMLResponse)
async def index(request: Request, request_token: str | None = None, status: str | None = None):
    """
    - No params   → show login page
    - ?request_token=xxx (Zerodha redirect) → exchange token, show success
    """
    if request_token and status == "success":
        global _access_token
        try:
            _access_token = zeroda.exchange_token(request_token)
            profile = zeroda.kite.profile()
            return templates.TemplateResponse("index.html", {
                "request":      request,
                "logged_in":    True,
                "user_name":    profile["user_name"],
                "user_id":      profile["user_id"],
                "access_token": _access_token,
            })
        except Exception as e:
            return templates.TemplateResponse("index.html", {
                "request":   request,
                "logged_in": False,
                "error":     str(e),
                "login_url": zeroda.get_login_url(),
            })

    return templates.TemplateResponse("index.html", {
        "request":   request,
        "logged_in": False,
        "login_url": zeroda.get_login_url(),
    })


@app.get("/logout")
async def logout():
    global _access_token
    if _access_token:
        try:
            zeroda.kite.invalidate_access_token()
        except Exception:
            pass
        _access_token = None
    return RedirectResponse(url="/")


@app.get("/status")
async def status():
    """Quick API check — returns login state."""
    if _access_token:
        profile = zeroda.kite.profile()
        return {"logged_in": True, "user": profile["user_name"], "user_id": profile["user_id"]}
    return {"logged_in": False}

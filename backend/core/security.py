"""Auth & password helpers."""
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_DAYS
from .db import db

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_DAYS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


async def require_dealer(user=Depends(get_current_user)):
    """Allows: dealer, admin, OR manager with `warranty` permission (so a
    manager can use the same Dealer Portal UI to assign warranties)."""
    role = user.get("role")
    if role in ("dealer", "admin"):
        return user
    if role == "manager" and (user.get("manager_perms") or {}).get("warranty"):
        return user
    raise HTTPException(status_code=403, detail="Dealer / warranty-manager / admin required")


async def require_manager_leads(user=Depends(get_current_user)):
    role = user.get("role")
    if role == "admin":
        return user
    if role == "manager" and (user.get("manager_perms") or {}).get("leads"):
        return user
    raise HTTPException(status_code=403, detail="Leads management permission required")


async def require_manager_service(user=Depends(get_current_user)):
    role = user.get("role")
    if role == "admin":
        return user
    if role == "manager" and (user.get("manager_perms") or {}).get("service"):
        return user
    raise HTTPException(status_code=403, detail="Service management permission required")


async def require_manager_warranty(user=Depends(get_current_user)):
    role = user.get("role")
    if role == "admin":
        return user
    if role == "manager" and (user.get("manager_perms") or {}).get("warranty"):
        return user
    raise HTTPException(status_code=403, detail="Warranty management permission required")


async def require_manager_points(user=Depends(get_current_user)):
    role = user.get("role")
    if role == "admin":
        return user
    if role == "manager" and (user.get("manager_perms") or {}).get("points"):
        return user
    raise HTTPException(status_code=403, detail="Points management permission required")


async def require_dealer_or_assignee(user=Depends(get_current_user)):
    """Dealer-portal dashboard endpoints. Allows dealer, admin, or manager
    with warranty perm."""
    role = user.get("role")
    if role in ("dealer", "admin"):
        return user
    if role == "manager" and (user.get("manager_perms") or {}).get("warranty"):
        return user
    raise HTTPException(status_code=403, detail="Dealer access required")

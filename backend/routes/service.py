"""Customer-facing service-request routes + media upload (photos, short videos).

Files are saved to /app/backend/uploads/ and served via /api/uploads/<file>.
Max video size: ~25 MB (per FastAPI default; we cap at 30 MB defensively).
Max photo size: ~5 MB.
"""
import os
import uuid
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse

from core.db import db
from core.security import get_current_user
from sms import send_sms

router = APIRouter(tags=["service"])

UPLOAD_DIR = Path("/app/backend/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_PHOTO_BYTES = 5 * 1024 * 1024     # 5 MB
MAX_VIDEO_BYTES = 30 * 1024 * 1024    # 30 MB
ALLOWED_PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
ALLOWED_VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm"}


async def _save_upload(file: UploadFile, kind: str) -> dict | None:
    if not file or not file.filename:
        return None
    ext = Path(file.filename).suffix.lower() or (".jpg" if kind == "photo" else ".mp4")
    if kind == "photo" and ext not in ALLOWED_PHOTO_EXT:
        raise HTTPException(status_code=400, detail=f"Photo type {ext} not allowed")
    if kind == "video" and ext not in ALLOWED_VIDEO_EXT:
        raise HTTPException(status_code=400, detail=f"Video type {ext} not allowed")
    name = f"{uuid.uuid4().hex}{ext}"
    path = UPLOAD_DIR / name
    cap = MAX_PHOTO_BYTES if kind == "photo" else MAX_VIDEO_BYTES
    size = 0
    with path.open("wb") as out:
        while chunk := await file.read(64 * 1024):
            size += len(chunk)
            if size > cap:
                out.close()
                path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail=f"{kind} too large (>{cap // (1024*1024)} MB)")
            out.write(chunk)
    return {"filename": name, "url": f"/api/uploads/{name}", "size": size, "kind": kind}


@router.post("/service-requests")
async def create_service_request(
    title: str = Form(...),
    description: str = Form(...),
    product_id: Optional[str] = Form(None),
    order_id: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
    user=Depends(get_current_user),
):
    if not title.strip() or not description.strip():
        raise HTTPException(status_code=400, detail="Title and description are required")
    photo_meta = await _save_upload(photo, "photo") if photo else None
    video_meta = await _save_upload(video, "video") if video else None

    product = None
    if product_id:
        product = await db.products.find_one({"id": product_id}, {"_id": 0})

    sr = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "customer_name": user.get("name", ""),
        "customer_phone": user.get("phone", ""),
        "title": title.strip(),
        "description": description.strip(),
        "product_id": product_id,
        "product_name": product["name"] if product else None,
        "order_id": order_id,
        "photo": photo_meta,
        "video": video_meta,
        "status": "open",
        "timeline": [{
            "at": datetime.now(timezone.utc).isoformat(),
            "by": user["id"],
            "role": "customer",
            "action": "created",
            "note": "Service request raised",
        }],
        "resolution": "",
        "assigned_manager": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.service_requests.insert_one(sr)
    sr.pop("_id", None)
    try:
        send_sms(
            user.get("phone", ""),
            f"HANSA: Service request {sr['id'][:8]} received. Our team will contact you within 24 hrs. Track in app.",
        )
    except Exception:
        pass
    return sr


@router.get("/service-requests/mine")
async def my_service_requests(user=Depends(get_current_user)):
    items = await db.service_requests.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@router.get("/service-requests/{sr_id}")
async def get_service_request(sr_id: str, user=Depends(get_current_user)):
    sr = await db.service_requests.find_one({"id": sr_id}, {"_id": 0})
    if not sr:
        raise HTTPException(status_code=404, detail="Not found")
    # Only owner / admin / manager-with-service can view
    if sr["user_id"] != user["id"]:
        role = user.get("role")
        if role not in ("admin",) and not (role == "manager" and (user.get("manager_perms") or {}).get("service")):
            raise HTTPException(status_code=403, detail="Forbidden")
    return sr


@router.get("/uploads/{filename}")
async def serve_upload(filename: str):
    # Defensive: only serve files inside uploads dir
    path = (UPLOAD_DIR / filename).resolve()
    if not str(path).startswith(str(UPLOAD_DIR.resolve())) or not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(str(path))

"""Social media routes - links + YouTube RSS + FB/Instagram public scraping fallback."""
from fastapi import APIRouter

from core.config import SOCIAL
from services.social_scraper import (
    fetch_youtube, fetch_instagram, fetch_facebook,
)

router = APIRouter(prefix="/social", tags=["social"])


@router.get("")
async def social_root():
    return SOCIAL


@router.get("/youtube")
async def youtube_latest():
    return await fetch_youtube()


@router.get("/instagram")
async def instagram_latest():
    return await fetch_instagram()


@router.get("/facebook")
async def facebook_latest():
    return await fetch_facebook()


@router.get("/feed")
async def aggregated_feed():
    """Combined feed - returns all sources in one call."""
    yt = await fetch_youtube()
    ig = await fetch_instagram()
    fb = await fetch_facebook()
    return {
        "youtube": yt,
        "instagram": ig,
        "facebook": fb,
        "links": SOCIAL,
    }

"""Public social-media scraping helpers (FB/IG fallback) + YouTube RSS.

No auth required for any of these. Best-effort scraping; gracefully
returns an empty list if a platform blocks/changes its HTML.
Results cached in-memory for 10 minutes to stay polite & fast.
"""
import asyncio
import html
import logging
import re
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

from core.config import SOCIAL

logger = logging.getLogger("hansa.social")

_USER_AGENT = (
    "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
)
_DESKTOP_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
_GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
_TIMEOUT = 10
_CACHE_TTL = 60 * 10  # 10 minutes default
_FB_CACHE_TTL = 60 * 60 * 6  # 6 hours - FB changes rarely & rate-limits hard
_cache: dict = {}


def _cache_get(key: str, ttl: int = _CACHE_TTL):
    rec = _cache.get(key)
    if not rec:
        return None
    if time.time() - rec["t"] > ttl:
        return None
    return rec["v"]


def _cache_set(key: str, value):
    _cache[key] = {"t": time.time(), "v": value}


def _http_get(url: str, headers: dict = None) -> str:
    h = {"User-Agent": _USER_AGENT, "Accept-Language": "en-IN,en;q=0.9"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        raw = resp.read()
    try:
        return raw.decode("utf-8", errors="replace")
    except Exception:
        return raw.decode("latin-1", errors="replace")


def _meta(html_str: str, prop: str) -> str:
    """Extract <meta property="prop" content="..."> value (og:* or twitter:*)."""
    pattern = (
        rf'<meta[^>]+(?:property|name)=["\']{re.escape(prop)}["\'][^>]*content=["\']([^"\']+)["\']'
    )
    pattern_alt = (
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']{re.escape(prop)}["\']'
    )
    m = re.search(pattern, html_str, re.IGNORECASE)
    if not m:
        m = re.search(pattern_alt, html_str, re.IGNORECASE)
    return html.unescape(m.group(1)) if m else ""


# ---------------- YouTube ----------------
async def fetch_youtube() -> dict:
    cached = _cache_get("yt")
    if cached:
        return cached
    try:
        url = f"https://www.youtube.com/feeds/videos.xml?channel_id={SOCIAL['youtube_channel_id']}"
        raw = await asyncio.to_thread(_http_get, url)
        root = ET.fromstring(raw)
        ns = {"a": "http://www.w3.org/2005/Atom", "m": "http://search.yahoo.com/mrss/"}
        videos = []
        for e in root.findall("a:entry", ns)[:12]:
            vid = e.find("{http://www.youtube.com/xml/schemas/2015}videoId")
            title = e.find("a:title", ns)
            link = e.find("a:link", ns)
            published = e.find("a:published", ns)
            thumb = e.find("m:group/m:thumbnail", ns)
            videos.append({
                "video_id": vid.text if vid is not None else "",
                "title": title.text if title is not None else "",
                "url": link.attrib.get("href") if link is not None else "",
                "published_at": published.text if published is not None else "",
                "thumbnail": thumb.attrib.get("url") if thumb is not None else "",
            })
        result = {
            "channel": "Ramkishan Agri Innovate Pvt. ltd.",
            "handle": SOCIAL["youtube_handle"],
            "profile_url": SOCIAL["youtube"],
            "videos": videos,
            "source": "rss",
        }
        _cache_set("yt", result)
        return result
    except Exception as e:
        logger.warning("YouTube fetch failed: %s", e)
        return {"channel": "HANSA", "videos": [], "error": str(e), "source": "rss"}


# ---------------- Instagram ----------------
async def fetch_instagram() -> dict:
    """Public Instagram fallback: parse profile page meta + try public posts API.

    Strategy:
      1) Hit https://www.instagram.com/<handle>/ to read og:image, og:description.
      2) Try the unauthenticated public profile JSON endpoint.
         (May break or return 401; we tolerate failures.)
    """
    cached = _cache_get("ig")
    if cached:
        return cached
    handle = SOCIAL["instagram_handle"]
    profile_url = f"https://www.instagram.com/{handle}/"
    profile = {
        "handle": handle,
        "profile_url": SOCIAL["instagram"],
        "name": "",
        "bio": "",
        "avatar": "",
        "followers": None,
        "posts": [],
        "source": "og",
    }
    try:
        raw = await asyncio.to_thread(_http_get, profile_url)
        profile["name"] = _meta(raw, "og:title") or handle
        profile["bio"] = _meta(raw, "og:description")
        profile["avatar"] = _meta(raw, "og:image")
        # Try to extract followers from description: "123 Followers, 45 Following..."
        m = re.search(r"([\d,\.]+[KMm]?)\s+Followers", profile["bio"])
        if m:
            profile["followers"] = m.group(1)
    except Exception as e:
        logger.info("IG profile fetch failed: %s", e)

    # Attempt public timeline via web_profile_info (works without login on many regions)
    try:
        api_url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={handle}"
        raw = await asyncio.to_thread(
            _http_get, api_url,
            {"x-ig-app-id": "936619743392459", "Accept": "application/json"},
        )
        import json
        data = json.loads(raw)
        user = (data.get("data") or {}).get("user") or {}
        if user:
            profile["name"] = user.get("full_name") or profile["name"]
            profile["bio"] = user.get("biography") or profile["bio"]
            profile["avatar"] = user.get("profile_pic_url_hd") or profile["avatar"]
            profile["followers"] = (user.get("edge_followed_by") or {}).get("count")
        edges = (((user or {}).get("edge_owner_to_timeline_media") or {}).get("edges")) or []
        for ed in edges[:12]:
            n = ed.get("node") or {}
            caption_edges = ((n.get("edge_media_to_caption") or {}).get("edges")) or []
            caption = caption_edges[0]["node"]["text"] if caption_edges else ""
            shortcode = n.get("shortcode")
            profile["posts"].append({
                "id": n.get("id"),
                "shortcode": shortcode,
                "caption": caption,
                "thumbnail": n.get("thumbnail_src") or n.get("display_url"),
                "image": n.get("display_url"),
                "is_video": bool(n.get("is_video")),
                "likes": (n.get("edge_liked_by") or n.get("edge_media_preview_like") or {}).get("count"),
                "comments": (n.get("edge_media_to_comment") or {}).get("count"),
                "taken_at": n.get("taken_at_timestamp"),
                "url": f"https://www.instagram.com/p/{shortcode}/" if shortcode else profile_url,
            })
        if profile["posts"]:
            profile["source"] = "web_profile_info"
    except Exception as e:
        logger.info("IG api fallback failed: %s", e)

    _cache_set("ig", profile)
    return profile


# ---------------- Facebook ----------------
async def fetch_facebook() -> dict:
    """Public Facebook fallback: parse page meta tags.

    Facebook aggressively blocks unauthenticated scraping for post lists,
    so we focus on reliably surfacing the page name, photo, description &
    the canonical link. Useful for showing a 'card' that opens the page.
    """
    cached = _cache_get("fb", _FB_CACHE_TTL)
    if cached:
        return cached
    page_url = SOCIAL["facebook"]
    page_username = SOCIAL.get("facebook_page", "")
    out = {
        "page_url": page_url,
        "name": "Ram Kishan Agri Innovate Pvt Ltd",
        "description": "Legacy of 65 years · Expert of Agriculture Implements Manufacturer · Meerut, Uttar Pradesh.",
        "avatar": "https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=61577013162366",
        "posts": [],
        "source": "static",
    }
    candidates = []
    if page_username:
        candidates += [
            f"https://www.facebook.com/{page_username}",
            f"https://m.facebook.com/{page_username}",
        ]
    candidates.append(page_url)
    if "facebook.com" in page_url:
        candidates.append(page_url.replace("www.facebook.com", "m.facebook.com"))
        candidates.append(page_url.replace("www.facebook.com", "mbasic.facebook.com"))
    for url in candidates:
        try:
            raw = await asyncio.to_thread(
                _http_get, url,
                {"User-Agent": _GOOGLEBOT_UA, "Accept": "text/html,application/xhtml+xml"},
            )
            name = _meta(raw, "og:title")
            desc = _meta(raw, "og:description")
            img = _meta(raw, "og:image")
            if name:
                out["name"] = name
            if desc:
                out["description"] = desc
            if img:
                out["avatar"] = img
            if name or img:
                out["page_url"] = url
                break
        except Exception as e:
            logger.info("FB fetch failed for %s: %s", url, e)
    _cache_set("fb", out)
    return out

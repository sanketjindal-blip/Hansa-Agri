"""App configuration & singletons (env, JWT, razorpay)."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@rkai.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_DAYS = 30

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")

try:
    import razorpay  # noqa: F401
except Exception:
    razorpay = None

RAZORPAY_ENABLED = bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET and razorpay)
rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_ENABLED else None

SOCIAL = {
    "facebook": "https://www.facebook.com/share/14abV8caEJo/?mibextid=wwXIfr",
    "facebook_page": "ramkishanagriinnovate",  # used for scraping fallback
    "instagram": "https://www.instagram.com/ramkishanagri_innovate?igsh=MTY4cnB0c2M5eHR4Zg%3D%3D&utm_source=qr",
    "instagram_handle": "ramkishanagri_innovate",
    "youtube": "https://youtube.com/@ramkishanagri_innovate",
    "youtube_channel_id": "UCzfzCnxvo7nz4UkQolSqijA",
    "youtube_handle": "@ramkishanagri_innovate",
}

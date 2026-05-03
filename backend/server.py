"""HANSA backend - slim entrypoint that wires modular routers.

All business logic lives under:
  - core/       config, db, security helpers
  - models/     pydantic schemas
  - routes/     API routers grouped by domain (auth, catalog, orders, ...)
  - services/   shared services (seed, warranty, social scraping)
"""
import logging

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

# Load .env BEFORE importing modules that read os.environ
from core import config  # noqa: F401  (side-effect: load_dotenv)
from core.db import client as mongo_client

from routes import (
    auth as auth_routes,
    catalog as catalog_routes,
    orders as orders_routes,
    support as support_routes,
    dealers as dealers_routes,
    admin as admin_routes,
    social as social_routes,
    payments as payments_routes,
    loyalty as loyalty_routes,
    service as service_routes,
    manager as manager_routes,
    notifications as notifications_routes,
    billing as billing_routes,
)
from services import seed as seed_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rkai")

app = FastAPI(title="HANSA Customer App API")

api = APIRouter(prefix="/api")
api.include_router(auth_routes.router)
api.include_router(catalog_routes.router)
api.include_router(orders_routes.router)
api.include_router(support_routes.router)
api.include_router(dealers_routes.router)
api.include_router(admin_routes.router)
api.include_router(social_routes.router)
api.include_router(payments_routes.router)
api.include_router(loyalty_routes.router)
api.include_router(service_routes.router)
api.include_router(manager_routes.router)
api.include_router(notifications_routes.router)
api.include_router(billing_routes.router)


@api.get("/")
async def root():
    return {"status": "ok", "app": "RKAI Customer App"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await seed_service.run_all()
    logger.info("RKAI app startup complete")


@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()

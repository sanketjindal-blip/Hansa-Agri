"""Public products & catalog routes."""
from typing import Optional
from fastapi import APIRouter, HTTPException

from core.db import db

router = APIRouter(tags=["catalog"])


@router.get("/products")
async def list_products(category: Optional[str] = None, q: Optional[str] = None):
    query = {}
    if category and category != "all":
        query["category"] = category
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    items = await db.products.find(query, {"_id": 0}).sort([("sort_order", 1), ("created_at", -1)]).to_list(500)
    return items


@router.get("/products/categories")
async def list_categories():
    """Legacy: distinct categories from products. Kept for backwards compat."""
    cats = await db.products.distinct("category")
    return sorted(cats)


@router.get("/categories")
async def list_category_config():
    """New: configurable categories with icon/label/sort_order, managed in admin."""
    items = await db.categories.find({"active": {"$ne": False}}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    return items


@router.get("/products/featured")
async def featured_products():
    items = await db.products.find({"featured": True}, {"_id": 0}).to_list(20)
    return items


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


@router.get("/news")
async def list_news():
    items = await db.news.find({}, {"_id": 0}).sort("published_at", -1).to_list(50)
    return items


@router.get("/offers")
async def list_offers():
    items = await db.offers.find({}, {"_id": 0}).to_list(50)
    return items

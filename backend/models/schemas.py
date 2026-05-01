"""Pydantic request/response schemas."""
from typing import List, Optional
from pydantic import BaseModel, Field, EmailStr


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    phone: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class PhoneIn(BaseModel):
    phone: str
    name: Optional[str] = None


class OtpVerifyIn(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None


class AuthOut(BaseModel):
    access_token: str
    user: dict


class OrderItemIn(BaseModel):
    product_id: str
    quantity: int = 1


class CheckoutIn(BaseModel):
    items: List[OrderItemIn]
    full_name: str
    phone: str
    address: str
    city: str
    state: str
    pincode: str
    payment_method: str = "cod"
    promo_code: Optional[str] = None
    redeem_points: int = 0


class LeadIn(BaseModel):
    name: str
    phone: str
    equipment_interest: Optional[str] = ""
    notes: Optional[str] = ""


class LeadStatusIn(BaseModel):
    status: str  # new | contacted | purchased | lost
    notes: Optional[str] = ""


class PointsAdjustIn(BaseModel):
    user_id: str
    delta: int  # positive to add, negative to deduct
    reason: str


class SupportTicketIn(BaseModel):
    subject: str
    message: str
    product_id: Optional[str] = None


class RazorpayOrderIn(BaseModel):
    amount_inr: float


class RazorpayVerifyIn(BaseModel):
    order_id: str
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


class AdminProductIn(BaseModel):
    name: str
    category: str
    price: float
    warranty_months: int = 12
    description: str
    image: str
    features: List[str] = []
    specifications: dict = {}
    recommended_hp: str = ""
    featured: bool = False


class AdminNewsIn(BaseModel):
    title: str
    summary: str
    body: str
    image: str
    tag: str = "Update"


class AdminOfferIn(BaseModel):
    code: str
    title: str
    description: str
    discount_percent: int
    banner_color: str = "#FF6600"
    valid_until: str


class DealerIn(BaseModel):
    name: str
    address: str
    phone: str
    whatsapp: str
    state: str
    type: str = "Authorised Dealer"


class CompanyIn(BaseModel):
    name: str
    tagline: str
    address: str
    phone: str
    phone_2: Optional[str] = ""
    whatsapp: str
    email: str
    website: Optional[str] = ""


class AssignWarrantyIn(BaseModel):
    phone: str
    product_id: str
    quantity: int = 1
    purchase_date: Optional[str] = None
    customer_name: Optional[str] = None
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    pincode: Optional[str] = ""
    bill_image_base64: Optional[str] = None


class DealerLoginIn(BaseModel):
    phone: str
    dealer_id: str


class CategoryIn(BaseModel):
    key: str
    label: str
    icon: str = "cube"
    sort_order: int = 100
    active: bool = True


class CategoryReorderIn(BaseModel):
    ids: List[str]


class ManagerPromoteIn(BaseModel):
    phone: str
    name: Optional[str] = None
    perms_leads: bool = True
    perms_service: bool = True


class ManagerPermsIn(BaseModel):
    perms_leads: bool
    perms_service: bool


class ServiceUpdateIn(BaseModel):
    status: str  # open | in_progress | resolved | closed | cancelled
    note: Optional[str] = ""
    resolution: Optional[str] = ""


class WarrantyItemIn(BaseModel):
    product_id: str
    quantity: int = 1


class MultiAssignWarrantyIn(BaseModel):
    phone: str
    items: List[WarrantyItemIn] = []
    # Single-product fallback (kept for backwards compatibility)
    product_id: Optional[str] = None
    quantity: int = 1
    purchase_date: Optional[str] = None
    customer_name: Optional[str] = None
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    pincode: Optional[str] = ""
    bill_image_base64: Optional[str] = None


class AssignManagersIn(BaseModel):
    """Body for assign-to-manager endpoints. If `all_managers` is True, the
    item is broadcast to every active manager with the relevant permission and
    `manager_ids` is ignored. If `all_managers` is False AND `manager_ids` is
    empty, the assignment is cleared (no specific manager → visible to admins
    only)."""
    manager_ids: List[str] = []
    all_managers: bool = False
    note: Optional[str] = ""


class AdminLeadIn(BaseModel):
    """Admin-created lead (from a phone call / walk-in)."""
    name: str
    phone: str
    equipment_interest: Optional[str] = ""
    notes: Optional[str] = ""
    source: Optional[str] = "call"  # call | walk_in | website | other
    manager_ids: List[str] = []
    all_managers: bool = False


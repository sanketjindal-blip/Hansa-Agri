"""Seed data for RKAI (Ramkishan Agri Innovate Pvt Ltd) customer app.

Products sourced from the official catalogue. Prices are indicative INR list prices
for demo purposes (actual pricing to be confirmed with dealer).
"""
import uuid

# Brand image pool (Unsplash, approved via design guidelines)
IMG_TRACTOR_SUNSET = "https://images.unsplash.com/photo-1745850783543-a29c3f3869ee?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80"
IMG_FARMERS_TRACTOR = "https://images.unsplash.com/photo-1575015592069-453a1f1b814a?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80"
IMG_HEAVY_MACHINERY = "https://images.unsplash.com/photo-1765921383366-0c895f6cb54f?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80"
IMG_ABSTRACT = "https://images.unsplash.com/photo-1707134657501-fbae0098f6e5?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80"

# Category-wise image mapping
IMG_TILLER = "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80"
IMG_HARROW = "https://images.unsplash.com/photo-1574943320219-5630bb4c2872?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80"
IMG_PLOUGH = "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80"
IMG_CULTIVATOR = "https://images.unsplash.com/photo-1464226184884-fa280b87c399?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80"
IMG_FIELD = "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80"


def _p(name, category, price, warranty_months, description, image, specs, features, hp, featured=False):
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "category": category,
        "price": price,
        "mrp": round(price * 1.15),
        "warranty_months": warranty_months,
        "description": description,
        "image": image,
        "images": [image],
        "specifications": specs,
        "features": features,
        "recommended_hp": hp,
        "in_stock": True,
        "featured": featured,
        "rating": 4.6,
    }


SEED_PRODUCTS = [
    _p(
        "Medium Tiller (7/8/9 Tine)", "Tiller", 48500, 24,
        "Heavy-duty tiller with bolt-fitted non-welded frame for easy maintenance. Ideal for soil loosening, weed removal & seedbed preparation.",
        IMG_TILLER,
        {
            "Frame": "Square Pipe 60mm x 60mm x 6mm (Bolt-fitted)",
            "Tine": "25\" Long, 1\" Thick Forged",
            "Tine Spacing": "9\" adjustable",
            "Spring": "28 Coil, 50mm Dia with Toggle",
            "Shovel": "Boron Steel - Wear Resistant",
            "Linkage": "CAT II & CAT III",
            "Weight": "180 Kg (7 Tine)",
            "Coating": "Powder Coated / Heat Resistant",
        },
        ["Loosens hard soil & breaks clods", "Effective weed removal between rows", "Uniform seedbed preparation", "Mixes fertilizer in topsoil", "Low HP tractor friendly"],
        "35 HP & above", featured=True,
    ),
    _p(
        "Tiller Fix Type 72x6 (9-17 Tine)", "Tiller", 72500, 24,
        "Super heavy-duty fix-type tiller with 72x72x6mm frame. Bolt-fitted design, available in 9/11/13/15/17 tine configurations.",
        IMG_TILLER,
        {
            "Frame": "72mm x 72mm x 6mm Heavy Duty Square Pipe",
            "Tine": "25\" Long, 1\" Thick Forged",
            "Weight": "265 Kg (9 Tine)",
            "Linkage": "CAT II & CAT III",
            "Coating": "Heat Resistant Powder Coating",
        },
        ["Maximum durability for tough fields", "Bolt-fitted for easy maintenance", "Tractor-friendly low load design", "Available in 5 tine configurations"],
        "45 HP & above",
    ),
    _p(
        "Folding Tiller (11-17 Tine)", "Tiller", 95000, 24,
        "2-tine side folding tiller for reduced transport width. Heavy-duty 72x72x6mm frame.",
        IMG_TILLER,
        {
            "Folding": "2-tine side folding (both sides)",
            "Frame": "72x72x6mm Heavy Duty Square Pipe",
            "Weight": "305 Kg (11 Tine)",
            "Linkage": "CAT II & CAT III",
        },
        ["Foldable for easy transport on roads", "Reduced width for narrow gates", "Heavy-duty construction", "Forged 25\" tines"],
        "50 HP & above", featured=True,
    ),
    _p(
        "Rotary Tiller 6ft (1.75m)", "Tiller", 165000, 24,
        "Multi-speed gearbox rotary tiller for fine seedbed preparation. Side gear drive, dual PTO compatible.",
        IMG_TILLER,
        {
            "Working Width": "1760 mm",
            "No. of Blades": "42 (L-Type, Boron Steel)",
            "Gearbox": "Multi-speed (7L capacity)",
            "PTO": "540 / 1000 rpm",
            "Weight": "495 Kg",
        },
        ["Fine uniform seedbed in single pass", "Works on all soil types", "Dual PTO speed compatibility", "8mm heavy-duty hitch"],
        "45-55 HP",
    ),
    _p(
        "Rotary Tiller 7ft (2.00m)", "Tiller", 185000, 24,
        "7ft rotary tiller with 48 blades, multi-speed gearbox for medium-to-large farms.",
        IMG_TILLER,
        {"Working Width": "2050 mm", "No. of Blades": "48", "Weight": "545 Kg"},
        ["Higher productivity", "Fine seedbed quality", "Low maintenance"],
        "55-65 HP",
    ),
    _p(
        "Mounted Disc Harrow - Medium Duty (14 Disc)", "Harrow", 82000, 18,
        "14-disc medium duty harrow for breaking clods & seedbed preparation. 22\" high-carbon steel discs.",
        IMG_HARROW,
        {
            "Frame": "60x60x6mm Square Pipe",
            "Disc Diameter": "22\" (High Carbon Steel)",
            "No. of Discs": "14",
            "Tillage Width": "64\"",
            "Bearings": "4 Hubs with 8 Bearings (30308)",
            "Weight": "400 Kg",
        },
        ["Breaks clods efficiently", "Mixes crop residue", "Front-mounted chakli option", "Cast iron 9\" spacers"],
        "45 HP & above", featured=True,
    ),
    _p(
        "Mounted Harrow - Heavy Duty (14-20 Disc)", "Harrow", 115000, 18,
        "Heavy-duty fabricated harrow with 72x72x6mm frame. Available in 12, 14, 16, 18, 20 disc models.",
        IMG_HARROW,
        {
            "Frame": "72x72x6mm Heavy Duty Square Box Pipe",
            "Disc Diameter": "22\"",
            "Weight": "435 Kg (14 Disc)",
        },
        ["Heavy duty for tough fields", "Multiple disc configurations", "Maintenance-free bush model option"],
        "50 HP & above",
    ),
    _p(
        "Trailed Harrow with Wheel (14-22 Disc)", "Harrow", 198000, 18,
        "Trailed disc harrow with wheels for road movement. 24\" discs, heavy angle frame.",
        IMG_HARROW,
        {
            "Frame": "100x100x8mm Angle Frame",
            "Disc Diameter": "24\"",
            "Weight": "635 Kg (14 Disc)",
            "Wheels": "Optional for road movement",
        },
        ["Easy road transport with wheels", "24\" larger diameter discs", "Trailed type for large farms"],
        "60 HP & above",
    ),
    _p(
        "Sugarcane Plantation Ridger (3-5 Tine)", "Ridger", 42000, 18,
        "Profile-cut tine ridger for sugarcane & wide row crops. Adjustable 24-36\" spacing.",
        IMG_CULTIVATOR,
        {
            "Frame": "60x60x6mm MS Square Tube",
            "Tine Thickness": "25 mm (Profile-Cut)",
            "Tine Height": "25\"",
            "Ridge Spacing": "24\" - 36\" adjustable",
            "Shovel": "Boron Steel or Cast Iron",
            "Weight": "160-280 Kg",
        },
        ["Sugarcane & wide row ridging", "Adjustable ridge spacing", "Heavy-duty profile-cut tines", "CAT I/II linkage"],
        "35-65 HP",
    ),
    _p(
        "Trench Maker (Sugarcane)", "Trench Maker", 58000, 18,
        "Heavy trench maker for sugarcane plantation. Adjustable 30-60\" row spacing, 200-400mm depth.",
        IMG_CULTIVATOR,
        {
            "Frame": "72x72x6mm Square Tube",
            "Row Spacing": "30\" - 60\" adjustable",
            "Trench Depth": "200-400mm adjustable",
            "Weight": "220-300 Kg",
        },
        ["Sugarcane trench plantation", "Adjustable spacing & depth", "Tiller-type shovels", "Rust resistant powder coating"],
        "35-60 HP",
    ),
    _p(
        "Power Weeder 7HP", "Weeder", 68000, 12,
        "Handle-held 7HP gasoline power weeder with 32 blades. Light weight, easy to operate.",
        IMG_FIELD,
        {
            "Engine": "HI70F Gasoline, 4 Stroke, Air-Cooled",
            "Power": "7 HP (4.0 kW)",
            "Weight": "90 Kg",
            "Blades": "32 Rotary Blades",
            "Tilling Depth": ">100 mm",
            "Speeds": "Fast/Slow/Reverse",
        },
        ["Lightweight & easy to operate", "Maintenance free", "Direct connection, no power loss", "Ideal for small plots"],
        "Standalone engine", featured=True,
    ),
    _p(
        "15-Tine Adjustable Cultivator with Jack", "Cultivator", 88000, 18,
        "Inter-row cultivator for sugarcane & wide row crops. Manual jack system for width adjustment.",
        IMG_CULTIVATOR,
        {
            "Frame": "60x60x6mm MS Square Tube",
            "Tines": "15 Forged (20mm thick, 21\" high)",
            "Row Spacing": "24\" - 36\" adjustable",
            "Width Adjustment": "Manual Jack System",
            "Weight": "320-360 Kg",
        },
        ["Jack-based width adjustment", "Deep inter-row cultivation", "Boron steel shovels", "Suitable for sugarcane"],
        "45-65 HP",
    ),
    _p(
        "Disc Type Bund Maker (Doll Maker)", "Bund Maker", 52000, 18,
        "Mounted disc-type bund maker with 26\" concave boron steel discs. Adjustable bund width & height.",
        IMG_HARROW,
        {
            "Frame": "72x72x6mm Heavy Duty Square Pipe",
            "No. of Discs": "2 Concave Boron Steel",
            "Disc Diameter": "660mm (26\")",
            "Bund Width": "up to 800 mm adjustable",
            "Bund Height": "up to 400 mm adjustable",
            "Bearings": "Tapered Roller 30308",
            "Weight": "180-250 Kg",
        },
        ["Bund making for irrigation", "Adjustable angle & spacing", "Boron steel discs", "Smooth rotation with tapered bearings"],
        "30-55 HP",
    ),
    _p(
        "Plate Type Bund Maker", "Bund Maker", 38000, 18,
        "Plate-type bund maker with 6mm heavy-duty plates. Cost-effective & low maintenance.",
        IMG_HARROW,
        {
            "Plate Thickness": "6 mm",
            "Frame": "65x8mm Angle",
            "No. of Plates": "2",
            "Bund Width": "750-850 mm",
            "Bund Height": "up to 400 mm",
            "Weight": "180-230 Kg",
        },
        ["Creates irrigation bunds", "Simple low-maintenance design", "Cost effective", "3-point linkage CAT I/II"],
        "30-50 HP",
    ),
    _p(
        "Mould Board (MB) Plough 2-Bottom", "Plough", 78000, 18,
        "MB plough for primary tillage in dry & wet conditions. Boron steel mould boards.",
        IMG_PLOUGH,
        {
            "Bottoms": "2 (3 also available)",
            "Mould Board": "Boron Steel",
            "Depth": "200-300 mm",
            "Width": "250-900 mm",
            "Weight": "200-450 Kg",
        },
        ["Breaks hard soil efficiently", "Soil inversion & residue burial", "Boron steel for long life", "Dry & wet conditions"],
        "35-65 HP",
    ),
    _p(
        "Hydraulic Reversible MB Plough", "Plough", 245000, 24,
        "Hydraulic reversible MB plough with cylinder & hoses. Quick reversal without manual intervention.",
        IMG_PLOUGH,
        {
            "Bottoms": "2 (3 optional)",
            "Mechanism": "Hydraulic Cylinder + Hoses",
            "Depth": "250-350 mm",
            "Width": "600-900 mm",
            "Weight": "350-500 Kg",
        },
        ["Quick hydraulic reversal", "Works all soil types", "Precise depth control", "Efficient residue incorporation"],
        "45-75 HP", featured=True,
    ),
    _p(
        "Disc Plough (2-4 Disc)", "Plough", 115000, 18,
        "Mounted disc plough with 26\" boron steel discs. Individually adjustable disc angles.",
        IMG_PLOUGH,
        {
            "No. of Discs": "2/3/4",
            "Disc Diameter": "660mm (26\")",
            "Material": "High Carbon / Boron Steel",
            "Working Depth": "Up to 300 mm",
            "Weight": "250-450 Kg",
        },
        ["Opens new fields easily", "Handles hard, trashy, stony soil", "Individually adjustable disc angle", "Depth control wheel option"],
        "40-75 HP",
    ),
    _p(
        "Subsoiler (1-3 Tine)", "Subsoiler", 68000, 24,
        "Heavy-duty subsoiler to break hardpan layers. 25mm profile-cut tines, working depth up to 600mm.",
        IMG_CULTIVATOR,
        {
            "Tines": "1/2/3 Profile-Cut (25mm thick)",
            "Frame": "100x100x8mm Square Tube",
            "Working Depth": "Up to 600 mm",
            "Shovel": "Replaceable Boron Steel Tip",
            "Weight": "120-350 Kg",
        },
        ["Breaks hardpan compacted layers", "Improves water absorption", "Deeper than regular tillage", "Replaceable shovel tips"],
        "45-75 HP",
    ),
    _p(
        "Reversible Land Leveller (6/7/8 ft)", "Leveller", 48000, 18,
        "Reversible land leveller with 10mm blade usable from both sides. Heavy-duty bolted frame.",
        IMG_FIELD,
        {
            "Blade Thickness": "10 mm",
            "Working Widths": "6 / 7 / 8 ft",
            "Reversibility": "Yes - both sides",
            "Weight": "140-200 Kg",
        },
        ["Dual-side reversible blade", "Effective land levelling", "Durable high-strength plate", "3-point linkage CAT I/II"],
        "35-60 HP",
    ),
]


# Build index by name for seed customer orders
_BY_NAME = {p["name"]: p["id"] for p in SEED_PRODUCTS}

SEED_CUSTOMER_ORDERS = [
    {
        "days_ago": 240,  # purchased ~8 months ago (warranty still active)
        "items": [
            {"product_id": _BY_NAME["Medium Tiller (7/8/9 Tine)"], "quantity": 1},
        ],
    },
    {
        "days_ago": 60,  # purchased 2 months ago
        "items": [
            {"product_id": _BY_NAME["Mounted Disc Harrow - Medium Duty (14 Disc)"], "quantity": 1},
            {"product_id": _BY_NAME["Power Weeder 7HP"], "quantity": 1},
        ],
    },
]

SEED_NEWS = [
    {
        "id": str(uuid.uuid4()),
        "title": "New Folding Tiller range launched",
        "summary": "RKAI unveils 2-tine side folding tillers — easy road transport, 72x72x6mm heavy-duty frame.",
        "body": "Our new folding tiller range makes field-to-field movement easier than ever. Available in 11, 13, 15 & 17 tine configurations.",
        "image": IMG_TILLER,
        "published_at": "2026-02-10T09:00:00+00:00",
        "tag": "Product Launch",
    },
    {
        "id": str(uuid.uuid4()),
        "title": "Monsoon Ready — Ridger & Trench Maker in stock",
        "summary": "Prepare for sugarcane season with our adjustable ridgers and trench makers.",
        "body": "Book now for timely delivery. Dealer network expanded across UP, Bihar & Maharashtra.",
        "image": IMG_FARMERS_TRACTOR,
        "published_at": "2026-02-05T10:30:00+00:00",
        "tag": "Seasonal",
    },
    {
        "id": str(uuid.uuid4()),
        "title": "RKAI factory expansion at Hapur",
        "summary": "Our Arifpur facility scales up production capacity by 40% to meet growing demand.",
        "body": "Khasra 39-41, Vill-Arifpur, Kithore Hapur Road, Hapur. Faster delivery times and better service.",
        "image": IMG_HEAVY_MACHINERY,
        "published_at": "2026-01-25T14:00:00+00:00",
        "tag": "Company",
    },
    {
        "id": str(uuid.uuid4()),
        "title": "Hydraulic Reversible MB Plough — now on sale",
        "summary": "Quick reversal, boron steel boards, compatible with 45-75 HP tractors.",
        "body": "A must-have for serious farmers. 24-month warranty included.",
        "image": IMG_PLOUGH,
        "published_at": "2026-01-18T11:15:00+00:00",
        "tag": "Sale",
    },
]

SEED_OFFERS = [
    {
        "id": str(uuid.uuid4()),
        "code": "RKAI10",
        "title": "10% off on all Tillers",
        "description": "Valid on Medium, Fix-type and Folding Tillers.",
        "discount_percent": 10,
        "banner_color": "#FF6600",
        "valid_until": "2026-03-31",
    },
    {
        "id": str(uuid.uuid4()),
        "code": "HARROW15",
        "title": "15% off on Disc Harrows",
        "description": "Medium & Heavy Duty Harrows. Limited time offer.",
        "discount_percent": 15,
        "banner_color": "#2E7D32",
        "valid_until": "2026-02-28",
    },
    {
        "id": str(uuid.uuid4()),
        "code": "FARMER500",
        "title": "Flat 5% off for new customers",
        "description": "Use code FARMER500 on your first purchase.",
        "discount_percent": 5,
        "banner_color": "#8B4513",
        "valid_until": "2026-06-30",
    },
]

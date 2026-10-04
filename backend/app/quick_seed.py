from sqlalchemy.orm import Session
from app.database import SessionLocal, init_db
from app.models import Location, InventoryItem, utcnow
from datetime import timedelta

# Define the nodes we want to show
LOCATIONS = [
    ("LOC-HUB", "Central Supply Hub", "HUB", 28.6448, 77.2167, 640, "Plains", "Northern Sector"),
    ("LOC-ALPHA", "Distribution Node Alpha", "DISTRIBUTION", 29.5, 76.5, 810, "Plains", "Zone Alpha"),
    ("LOC-NORTH", "Forward Node North", "FORWARD", 30.5, 75.8, 1180, "Highland", "Border Zone"),
    ("LOC-BRD-S", "Border Node South", "FORWARD", 27.8, 79.2, 450, "Plains", "Border Zone"),
    ("LOC-BRD-N", "Ridge Observation Point", "FORWARD", 31.2, 78.5, 1420, "Highland", "Border Zone"),
]

def quick_seed():
    init_db()
    with SessionLocal() as db:
        # Check if already seeded to prevent duplication
        if db.query(Location).count() > 0:
            print("Already seeded.")
            return

        for loc_id, name, node_type, lat, lon, elev, terrain, region in LOCATIONS:
            db.add(Location(id=loc_id, name=name, node_type=node_type, latitude=lat, longitude=lon, elevation_m=elev, terrain=terrain, region=region))
        db.commit()
        print(f"Seeded {len(LOCATIONS)} locations.")

if __name__ == "__main__":
    quick_seed()
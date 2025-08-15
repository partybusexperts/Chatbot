import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import pandas as pd

app = FastAPI(title="Quote Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "vehicles.csv")
vehicles_df = pd.read_csv(DATA_PATH)

# ===ANCHOR: FUTURE_INTEGRATIONS===
# Placeholder for loading add-ons, training, and other CSVs
# add_ons_df = pd.read_csv(os.path.join(os.path.dirname(__file__), "..", "data", "add_ons.csv"))
# training_df = pd.read_csv(os.path.join(os.path.dirname(__file__), "..", "data", "training.csv"))

class QuoteRequest(BaseModel):
    city: str
    passengers: int
    hours: int
    event_date: str | None = None
    is_prom_or_dance: bool = False
    size_direction: str | None = None  # "larger" | "smaller" | None
    # ===ANCHOR: EXTEND_QUOTE_REQUEST===
    # Add more fields as needed (e.g., zip, event_type, etc.)

def is_prom_window(date_str: str | None) -> bool:
    if not date_str:
        return False
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        # Saturday in March, April, May
        return (d.month in (3, 4, 5)) and (d.weekday() == 5)
    except ValueError:
        return False



@app.post("/quote")
def quote(req: QuoteRequest):
    try:
        city = req.city.strip().lower()
        pax = int(req.passengers)
        hours_requested = int(req.hours)

        prom = is_prom_window(req.event_date) or req.is_prom_or_dance

        # ===ANCHOR: FILTER_VEHICLES===
        df = vehicles_df[vehicles_df["location"].str.lower() == city].copy()
        df = df[df["capacity"] >= pax]
        if df.empty:
            return {"options": [], "note": "No vehicles found for that city/capacity."}

        df["capacity_diff"] = df["capacity"] - pax
        # Sort by closest capacity, then by 4hr price (or 6hr if prom)
        price_col = "prom_price_6hr" if prom else "price_4hr"
        df.sort_values(by=["capacity_diff", price_col], inplace=True)

        if req.size_direction == "larger":
            df = df[df["capacity"] > pax]

        options = []

        for _, row in df.head(10).iterrows():
            # ===ANCHOR: PROM_LOGIC===
            def safe_int(val, default):
                try:
                    if pd.isna(val):
                        return default
                    return int(val)
                except Exception:
                    return default

            if prom and not pd.isna(row.get("prom_price_6hr")):
                min_hours = safe_int(row.get("prom_min_hours"), 6)
                hours_billed = max(hours_requested, min_hours)
                price = float(row["prom_price_6hr"])
                total = price if hours_billed == 6 else price * (hours_billed / 6)
                note = "Prom pricing applied (6hr min)."
            else:
                min_hours = safe_int(row.get("base_min_hours"), 4)
                hours_billed = max(hours_requested, min_hours)
                # Pick the correct price column for requested hours
                price_col_candidate = f"price_{hours_billed}hr"
                if price_col_candidate in row and not pd.isna(row.get(price_col_candidate)):
                    price = float(row.get(price_col_candidate))
                else:
                    price = float(row.get("price_4hr", 0.0))
                total = price
                note = ""

            options.append({
                "name": row.get("name", "Unknown"),
                "capacity": int(row.get("capacity", 0)),
                "hours_billed": hours_billed,
                "total_all_in": round(total, 2),
                "prom_applied": bool(prom and not pd.isna(row.get("prom_price_6hr"))),
                "note": note,
                # ===ANCHOR: VEHICLE_OPTION_EXTRA===
                # Add more fields as needed (e.g., image_url, add_ons, etc.)
            })
            if len(options) >= 3:
                break

        return {"options": options, "note": options[0]["note"] if options else ""}
    except Exception as e:
        # Return error details for debugging
        return {"error": str(e)}

# ===ANCHOR: FUTURE_ENDPOINTS===
# @app.post("/upsell")
# def upsell(...):
#     # Placeholder for xAI/Grok API integration
#     pass

# @app.post("/zoho-log")
# def zoho_log(...):
#     # Placeholder for Zoho CRM integration
#     pass

# @app.get("/training")
# def get_training():
#     # Return agent training/FAQ from CSV
#     pass



from functools import lru_cache
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import pandas as pd
from pathlib import Path


app = FastAPI(title="Quote Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- All old quote logic and endpoints removed for clean boot ---

# --- Quoting logic restored ---
class QuoteRequest(BaseModel):
    city: str
    passengers: int
    hours: int
    event_date: str | None = None
    is_prom_or_dance: bool = False
    size_direction: str | None = None  # "larger" | "smaller" | None
    zip: str | None = None
    pivot_capacity: int | None = None
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
        print(f"[DEBUG] Incoming request: city='{req.city}', zip='{req.zip}', passengers={req.passengers}, hours={req.hours}, event_date={req.event_date}, is_prom_or_dance={req.is_prom_or_dance}")
        city = req.city.strip().lower()
        pax = int(req.passengers)
        hours_requested = int(req.hours)

        prom = is_prom_window(req.event_date) or req.is_prom_or_dance

        df = load_vehicles()
        # Use 'city' or 'location' column depending on your CSV
        city_col = "city" if "city" in df.columns else "location"
        # Filter by city (robust: match if city is a word in a comma-separated list)
        def city_match(cell: str, city: str) -> bool:
            cell = str(cell).lower()
            city = city.lower().strip()
            return any(city == c.strip() for c in cell.split(',')) or city in cell
        city_mask = df[city_col].apply(lambda cell: city_match(cell, city))
        print(f"[DEBUG] City mask matches: {city_mask.sum()} out of {len(df)}")
        # Filter by zip if provided
        city_for_zip = None
        if req.zip:
            print(f"[DEBUG] Incoming zip: '{req.zip}' (type: {type(req.zip)})")
            df["zip_codes"] = df["zip_codes"].astype(str)
            def normalize_zip(z):
                z = str(z).strip()
                if len(z) < 5:
                    z = z.zfill(5)
                return z
            req_zip_norm = normalize_zip(req.zip)
            print(f"[DEBUG] Normalized incoming zip: '{req_zip_norm}'")
            zip_mask = df["zip_codes"].apply(
                lambda cell: any(normalize_zip(z) == req_zip_norm for z in str(cell).split(","))
            )
            print(f"[DEBUG] Zip mask matches: {zip_mask.sum()} out of {len(df)}")
            # Print first 5 rows of zip-matching DataFrame for inspection
            if zip_mask.any():
                print(f"[DEBUG] First 5 rows matching zip:\n{df.loc[zip_mask].head(5).to_string(index=False)}")
            else:
                print("[DEBUG] No rows matched for zip.")
            mask = zip_mask
            # Get city for this zip (first match)
            if zip_mask.any():
                city_for_zip = df.loc[zip_mask, "city"].iloc[0] if "city" in df.columns else None
        else:
            mask = city_mask
        df = df[mask].copy()
        df["capacity"] = pd.to_numeric(df["capacity"], errors="coerce").fillna(0).astype(int)

        # Show all vehicles that match city/zip, sorted by capacity and price
        if df.empty:
            return {
                "party_buses": [],
                "limousines": [],
                "shuttle_buses": [],
                "note": "No vehicles found for that city/zip/capacity.",
                "city": city_for_zip or req.city.title()
            }

        df["capacity_diff"] = df["capacity"] - pax
        price_col = "prom_price_6hr" if prom else "price_4hr"
        if price_col not in df.columns:
            price_col = df.columns[0]  # fallback to first column if missing
        df.sort_values(by=["capacity", price_col], inplace=True)

        party_buses = []
        limousines = []
        shuttle_buses = []
        for _, row in df.iterrows():
            def safe_int(val, default):
                try:
                    if pd.isna(val):
                        return default
                    return int(val)
                except Exception:
                    return default

            def safe_float(val, default=0.0):
                try:
                    if pd.isna(val) or val == "":
                        return default
                    return float(val)
                except Exception:
                    return default

            if prom and not pd.isna(row.get("prom_price_6hr")):
                min_hours = safe_int(row.get("prom_min_hours"), 6)
                hours_billed = max(hours_requested, min_hours)
                price = safe_float(row["prom_price_6hr"])
                total = price if hours_billed == 6 else price * (hours_billed / 6)
                hourly_rate = total / hours_billed if hours_billed else 0.0
                note = "Prom pricing applied (6hr min)."
            else:
                min_hours = safe_int(row.get("base_min_hours"), 4)
                hours_billed = max(hours_requested, min_hours)
                price_col_candidate = f"price_{hours_billed}hr"
                if price_col_candidate in row and not pd.isna(row.get(price_col_candidate)):
                    price = safe_float(row.get(price_col_candidate))
                else:
                    price = safe_float(row.get("price_4hr", 0.0))
                total = price
                hourly_rate = total / hours_billed if hours_billed else 0.0
                note = ""

            # Robust vehicle name selection
            vehicle_name = row.get("vehicle_title", "")
            if not vehicle_name or str(vehicle_name).strip() == "":
                vehicle_name = row.get("name", "")
            if not vehicle_name or str(vehicle_name).strip() == "":
                # Try any other string column
                for col in row.index:
                    if isinstance(row[col], str) and row[col].strip() and col != "note":
                        vehicle_name = row[col].strip()
                        break
            if not vehicle_name or str(vehicle_name).strip() == "":
                vehicle_name = "Unknown"

            vehicle = {
                "name": vehicle_name,
                "capacity": int(row.get("capacity", 0)),
                "hours_billed": hours_billed,
                "hourly_rate": round(hourly_rate, 2),
                "total_all_in": round(total, 2),
                "prom_applied": bool(prom and not pd.isna(row.get("prom_price_6hr"))),
                "note": note,
                "zip_codes": row.get("zip_codes", ""),
                # ===ANCHOR: VEHICLE_OPTION_EXTRA===
            }

            name_lower = vehicle_name.lower()
            if ("party bus" in name_lower) or ("partybus" in name_lower):
                party_buses.append(vehicle)
            elif ("limo" in name_lower) or ("limousine" in name_lower):
                limousines.append(vehicle)
            elif ("shuttle" in name_lower) or ("coach" in name_lower) or ("charter" in name_lower) or ("bus" in name_lower):
                shuttle_buses.append(vehicle)
            else:
                # If not matched, put in shuttle_buses as a catch-all
                shuttle_buses.append(vehicle)

        return {
            "party_buses": party_buses,
            "limousines": limousines,
            "shuttle_buses": shuttle_buses,
            "note": (party_buses + limousines + shuttle_buses)[0]["note"] if (party_buses or limousines or shuttle_buses) else "",
            "city": city_for_zip or req.city.title()
        }
    except Exception as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": str(e)}

import sys
DATA_PATH = Path(__file__).parent.parent / "data" / "vehicles.csv"
print(f"[DEBUG] DATA_PATH resolved to: {DATA_PATH}", file=sys.stdout)

@lru_cache(maxsize=1)
def load_vehicles():
    try:
        df = pd.read_csv(
            DATA_PATH,
            sep="\t",
            engine="python",
            dtype=str,
            on_bad_lines="warn",
            keep_default_na=False
        )
        print(f"[DEBUG] Loaded vehicles.csv: {df.shape[0]} rows, {df.shape[1]} cols", file=sys.stdout)
        return df
    except Exception as e:
        print(f"[ERROR] Failed to load vehicles.csv: {e}", file=sys.stdout)
        raise


# Health check endpoint
@app.get("/health")
def health():
    return {"ok": True}

# Vehicles count endpoint
@app.get("/vehicles_count")
def vehicles_count():
    df = load_vehicles()
    return {"rows": int(df.shape[0]), "cols": int(df.shape[1])}



# --- All old quote logic and endpoints removed for clean boot ---

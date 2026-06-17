"""
VK Menu Audit API — Zerobox FastAPI backend
POST /audit  : accepts CSV file, queries Databricks, returns audit JSON
GET  /health/readiness : Zerobox readiness probe
"""

import os, re, unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from io import StringIO

import pandas as pd
from databricks import sql as dbsql
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ── Config ─────────────────────────────────────────────────────────────────
DATABRICKS_HOST      = os.environ.get("DATABRICKS_HOST",      "doordash-dash.cloud.databricks.com")
DATABRICKS_HTTP_PATH = os.environ.get("DATABRICKS_HTTP_PATH", "/sql/1.0/warehouses/2224fa0cd749c5f8")
DATABRICKS_TOKEN     = os.environ.get("DATABRICKS_TOKEN",     "")

app = FastAPI(title="VK Menu Audit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Readiness probe ────────────────────────────────────────────────────────
@app.get("/health/readiness")
async def readiness():
    return {"status": "ok"}


# ── Address parsing ────────────────────────────────────────────────────────
def normalize_col(name: str) -> str:
    return re.sub(r"[^a-z0-9_]", "_", name.strip().lower())

def parse_addresses(csv_text: str) -> list[dict]:
    df = pd.read_csv(StringIO(csv_text), dtype=str).fillna("")
    df.columns = [normalize_col(c) for c in df.columns]
    col_map = {
        "street": ["street_address", "address", "street", "addr"],
        "city":   ["city"],
        "state":  ["state", "st", "state_code"],
        "zip":    ["zip", "zip_code", "zipcode", "postal_code"],
    }
    results = []
    for _, row in df.iterrows():
        addr = {}
        for canon, candidates in col_map.items():
            for c in candidates:
                if c in row and row[c]:
                    addr[canon] = row[c].strip()
                    break
            else:
                addr[canon] = ""
        addr["display"] = ", ".join(
            v for v in [addr["street"], addr["city"], addr["state"], addr["zip"]] if v
        )
        if addr["street"] or addr["zip"]:
            results.append(addr)
    return results


# ── Databricks helpers ─────────────────────────────────────────────────────
def get_conn():
    if not DATABRICKS_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="Databricks token not configured. Set DATABRICKS_TOKEN in Zerobox env vars."
        )
    return dbsql.connect(
        server_hostname=DATABRICKS_HOST,
        http_path=DATABRICKS_HTTP_PATH,
        access_token=DATABRICKS_TOKEN,
    )

def run_query(conn, sql: str) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
        cols = [d[0].lower() for d in cur.description]
    return pd.DataFrame(rows, columns=cols)

def _sq(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"

def query_stores(conn, addresses: list[dict]) -> pd.DataFrame:
    clauses = []
    for a in addresses:
        if a["street"] and a["zip"]:
            clauses.append(
                f"(UPPER(addr.STREET_ADDRESS)=UPPER({_sq(a['street'])}) "
                f"AND addr.POSTAL_CODE={_sq(a['zip'])})"
            )
        elif a["street"] and a["city"] and a["state"]:
            clauses.append(
                f"(UPPER(addr.STREET_ADDRESS)=UPPER({_sq(a['street'])}) "
                f"AND UPPER(addr.LOCALITY)=UPPER({_sq(a['city'])}) "
                f"AND UPPER(addr.ADMINISTRATIVE_AREA_LEVEL_1)=UPPER({_sq(a['state'])}))"
            )
    if not clauses:
        return pd.DataFrame()
    sql = f"""
    SELECT
        s.ID            AS store_id,
        s.NAME          AS store_name,
        s.BUSINESS_ID   AS business_id,
        ds.BUSINESS_NAME AS business_name,
        CAST(ds.IS_VIRTUAL_BRAND AS INT) AS is_virtual_brand,
        addr.STREET_ADDRESS AS street_address,
        addr.POSTAL_CODE    AS zip,
        addr.LOCALITY       AS city,
        addr.ADMINISTRATIVE_AREA_LEVEL_1 AS state
    FROM datalake.doordash_merchant.store s
    JOIN datalake.edw_geo.address addr ON s.ADDRESS_ID = addr.ID
    LEFT JOIN datalake.edw_merchant.dimension_store ds ON s.ID = ds.STORE_ID
    WHERE s.IS_ACTIVE = TRUE
      AND ({' OR '.join(clauses)})
    ORDER BY s.ID
    LIMIT 2000
    """
    return run_query(conn, sql)

def query_menu_items(conn, store_ids: list) -> pd.DataFrame:
    if not store_ids:
        return pd.DataFrame(columns=["store_id", "category", "item_name"])
    ids_str = ",".join(str(i) for i in store_ids)
    sql = f"""
    SELECT
        STORE_ID        AS store_id,
        CATEGORY_TITLE  AS category,
        ITEM_TITLE      AS item_name
    FROM datalake.edw_merchant.dimension_menu_item
    WHERE STORE_ID IN ({ids_str})
      AND IS_ITEM_ACTIVE = TRUE
    ORDER BY STORE_ID, CATEGORY_TITLE, ITEM_TITLE
    """
    return run_query(conn, sql)


# ── Crossover ──────────────────────────────────────────────────────────────
def normalize_key(name, cat):
    def clean(s):
        s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
        return re.sub(r"[^a-z0-9 ]", "", s.lower()).strip()
    return f"{clean(cat)}||{clean(name)}"

def compute_crossover(stores_items: dict) -> list[dict]:
    ids = list(stores_items.keys())
    out = []
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a_id, b_id = ids[i], ids[j]
            a_keys = {normalize_key(n, c): (c, n) for c, n in stores_items[a_id]}
            b_keys = {normalize_key(n, c): (c, n) for c, n in stores_items[b_id]}
            shared = set(a_keys) & set(b_keys)
            union  = len(set(a_keys) | set(b_keys))
            pct    = round(len(shared) / union * 100) if union else 0
            out.append({
                "storeAId": a_id, "storeBId": b_id,
                "sharedItems": [{"category": a_keys[k][0], "name": a_keys[k][1]} for k in sorted(shared)],
                "overlapPct": pct,
            })
    return out


# ── Assemble output ────────────────────────────────────────────────────────
def assemble(addresses, stores_df, items_df):
    store_items = defaultdict(list)
    for _, r in items_df.iterrows():
        store_items[int(r["store_id"])].append((r["category"], r["item_name"]))

    stores_by_key = defaultdict(list)
    for _, s in stores_df.iterrows():
        key = (str(s.get("street_address", "") or "").upper().strip(),
               str(s.get("zip", "") or "").strip())
        stores_by_key[key].append(s)

    output_addresses = []
    for addr in addresses:
        key = (addr["street"].upper().strip(), addr["zip"].strip())
        matched = stores_by_key.get(key, [])

        store_list = []
        for s in matched:
            sid = int(s["store_id"])
            store_list.append({
                "storeId":    sid,
                "businessId": int(s["business_id"]),
                "name":       str(s["store_name"] or ""),
                "type":       "virtual_brand" if int(s.get("is_virtual_brand") or 0) else "brick_and_mortar",
                "menuItems":  [{"category": c, "name": n} for c, n in store_items.get(sid, [])],
            })

        items_for_xover = {
            s["storeId"]: [(it["category"], it["name"]) for it in s["menuItems"]]
            for s in store_list if s["menuItems"]
        }
        crossover_raw = compute_crossover(items_for_xover)
        sid_name = {s["storeId"]: s["name"] for s in store_list}
        crossover = [
            {**r,
             "storeA": sid_name.get(r["storeAId"], r["storeAId"]),
             "storeB": sid_name.get(r["storeBId"], r["storeBId"])}
            for r in crossover_raw
        ]

        output_addresses.append({
            "address":   addr,
            "stores":    store_list,
            "crossover": sorted(crossover, key=lambda x: -x["overlapPct"]),
        })

    return {
        "auditedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "addresses": output_addresses,
    }


# ── Endpoint ───────────────────────────────────────────────────────────────
@app.post("/audit")
async def run_audit(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file")

    text = (await file.read()).decode("utf-8", errors="replace")
    addresses = parse_addresses(text)
    if not addresses:
        raise HTTPException(status_code=400, detail="No valid addresses found in CSV")

    conn = get_conn()
    try:
        stores_df = query_stores(conn, addresses)
        store_ids = stores_df["store_id"].astype(int).tolist() if not stores_df.empty else []
        items_df  = query_menu_items(conn, store_ids)
    finally:
        conn.close()

    return assemble(addresses, stores_df, items_df)

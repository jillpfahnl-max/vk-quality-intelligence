#!/usr/bin/env python3
"""
VK Intelligence — Menu Audit Pipeline
======================================
Usage:
    python3 scripts/menu_audit_pipeline.py addresses.csv [--out public/menuAuditData.json]

Reads a CSV with columns: street_address, city, state, zip
Outputs: public/menuAuditData.json (consumed by the MenuAudit React tab)

Requires:
    pip install snowflake-connector-python pandas requests python-dotenv
    snow CLI on PATH (from DoorDash agentskills plugin)

Auth:
    Set SNOWFLAKE_USER env var, or pass --user flag.
    Snowflake uses SSO — browser window will open on first run.
"""

import argparse, json, os, sys, re, unicodedata
from datetime import datetime, timezone
from collections import defaultdict

try:
    import pandas as pd
    import snowflake.connector
except ImportError:
    sys.exit("Missing deps — run: pip install snowflake-connector-python pandas requests")

# ── config ────────────────────────────────────────────────────────────────────
SNOWFLAKE_ACCOUNT   = "doordash-doordash"
SNOWFLAKE_WAREHOUSE = "ADHOC"
SNOWFLAKE_DATABASE  = "PRODDB"
SNOWFLAKE_SCHEMA    = "PUBLIC"

# ── address normalization ─────────────────────────────────────────────────────
def normalize_col(name: str) -> str:
    return re.sub(r"[^a-z0-9_]", "_", name.strip().lower())

def load_addresses(csv_path: str) -> list[dict]:
    df = pd.read_csv(csv_path, dtype=str).fillna("")
    df.columns = [normalize_col(c) for c in df.columns]
    # Map flexible column names to canonical
    col_map = {
        "street": ["street_address", "address", "street", "addr", "street_addr"],
        "city":   ["city"],
        "state":  ["state", "st", "state_code"],
        "zip":    ["zip", "zip_code", "zipcode", "postal_code", "postcode"],
    }
    result = []
    for _, row in df.iterrows():
        addr = {}
        for canon, candidates in col_map.items():
            for c in candidates:
                if c in row and row[c]:
                    addr[canon] = row[c].strip()
                    break
            else:
                addr[canon] = ""
        addr["display"] = ", ".join(v for v in [addr["street"], addr["city"], addr["state"], addr["zip"]] if v)
        if addr["street"] or addr["zip"]:
            result.append(addr)
    return result

# ── snowflake helpers ─────────────────────────────────────────────────────────
def get_snowflake_conn(user: str):
    print(f"[snow] Connecting as {user} (SSO — browser may open)…")
    conn = snowflake.connector.connect(
        account=SNOWFLAKE_ACCOUNT,
        user=user,
        authenticator="externalbrowser",
        warehouse=SNOWFLAKE_WAREHOUSE,
        database=SNOWFLAKE_DATABASE,
        schema=SNOWFLAKE_SCHEMA,
        session_parameters={"QUERY_TAG": "agentskills:vk-intelligence-menu-audit"},
    )
    return conn

def query_stores_by_addresses(conn, addresses: list[dict]) -> pd.DataFrame:
    """
    Look up all stores at the given addresses.
    Joins store address data with business metadata to classify B&M vs VB.

    NOTE: Table/column names below reflect DoorDash's common Snowflake schema.
    Verify against PRODDB.INFORMATION_SCHEMA.COLUMNS if any query fails.
    """
    # Build address filter — match on (street + zip) OR (street + city + state)
    clauses = []
    for a in addresses:
        if a["street"] and a["zip"]:
            clauses.append(
                f"(UPPER(s.street_address) = UPPER({_sq(a['street'])}) AND s.zipcode = {_sq(a['zip'])})"
            )
        elif a["street"] and a["city"] and a["state"]:
            clauses.append(
                f"(UPPER(s.street_address) = UPPER({_sq(a['street'])}) "
                f"AND UPPER(s.city) = UPPER({_sq(a['city'])}) "
                f"AND UPPER(s.state) = UPPER({_sq(a['state'])}))"
            )

    if not clauses:
        return pd.DataFrame()

    sql = f"""
    SELECT
        s.store_id,
        s.business_id,
        s.name           AS store_name,
        s.street_address,
        s.city,
        s.state,
        s.zipcode        AS zip,
        -- Virtual brand flag: is_virtual_brand or parent business type
        COALESCE(b.is_virtual_brand, FALSE) AS is_virtual_brand,
        b.business_name
    FROM PRODDB.PUBLIC.STORE s
    LEFT JOIN PRODDB.PUBLIC.BUSINESS b ON s.business_id = b.id
    WHERE s.is_active = TRUE
      AND ({' OR '.join(clauses)})
    ORDER BY s.store_id
    LIMIT 2000
    """
    print("[snow] Querying stores by address…")
    return pd.read_sql(sql, conn)

def query_menu_items(conn, store_ids: list[int]) -> pd.DataFrame:
    """
    Fetch active menu items for the given store IDs.
    Returns one row per (store_id, category, item_name).
    """
    if not store_ids:
        return pd.DataFrame()
    ids_str = ",".join(str(i) for i in store_ids)
    sql = f"""
    SELECT
        mi.store_id,
        mc.name AS category,
        mi.name AS item_name,
        mi.price
    FROM PRODDB.PUBLIC.MENU_ITEM mi
    JOIN PRODDB.PUBLIC.MENU_CATEGORY mc ON mi.menu_category_id = mc.id
    WHERE mi.store_id IN ({ids_str})
      AND mi.is_active = TRUE
      AND mc.is_active = TRUE
    ORDER BY mi.store_id, mc.name, mi.name
    """
    print(f"[snow] Fetching menu items for {len(store_ids)} stores…")
    return pd.read_sql(sql, conn)

def _sq(s: str) -> str:
    """Single-quote a SQL string value, escaping internal quotes."""
    return "'" + s.replace("'", "''") + "'"

# ── crossover calculation ─────────────────────────────────────────────────────
def normalize_item_key(name: str, category: str) -> str:
    """Lowercase + strip punctuation for fuzzy matching."""
    def clean(s):
        s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
        return re.sub(r"[^a-z0-9 ]", "", s.lower()).strip()
    return f"{clean(category)}||{clean(name)}"

def compute_crossover(stores_items: dict) -> list[dict]:
    """
    stores_items: { store_id: [(category, name), ...] }
    Returns pairwise crossover stats.
    """
    store_ids = list(stores_items.keys())
    results = []
    for i in range(len(store_ids)):
        for j in range(i + 1, len(store_ids)):
            a_id, b_id = store_ids[i], store_ids[j]
            a_keys = {normalize_item_key(n, c): (c, n) for c, n in stores_items[a_id]}
            b_keys = {normalize_item_key(n, c): (c, n) for c, n in stores_items[b_id]}
            shared_keys = set(a_keys) & set(b_keys)
            total_union = len(set(a_keys) | set(b_keys))
            pct = round(len(shared_keys) / total_union * 100) if total_union > 0 else 0
            results.append({
                "storeAId": a_id,
                "storeBId": b_id,
                "sharedItems": [
                    {"category": a_keys[k][0], "name": a_keys[k][1]}
                    for k in sorted(shared_keys)
                ],
                "overlapPct": pct,
            })
    return results

# ── assemble output ───────────────────────────────────────────────────────────
def assemble(addresses, stores_df, items_df):
    # Index store items
    store_items = defaultdict(list)
    for _, row in items_df.iterrows():
        store_items[int(row["store_id"])].append((row["category"], row["item_name"]))

    # Index stores by (street+zip) or (street+city)
    def addr_key(row):
        return (
            str(row.get("street_address", "") or "").upper().strip(),
            str(row.get("zip", "") or "").strip(),
        )

    stores_by_addr = defaultdict(list)
    for _, s in stores_df.iterrows():
        stores_by_addr[addr_key(s)].append(s)

    output_addresses = []
    for addr in addresses:
        key = (addr["street"].upper().strip(), addr["zip"].strip())
        matched = stores_by_addr.get(key, [])

        store_list = []
        for s in matched:
            sid = int(s["store_id"])
            store_list.append({
                "storeId":   sid,
                "businessId": int(s["business_id"]),
                "name":       str(s["store_name"]),
                "type":       "virtual_brand" if s["is_virtual_brand"] else "brick_and_mortar",
                "menuItems": [
                    {"category": c, "name": n}
                    for c, n in store_items.get(sid, [])
                ],
            })

        # Crossover
        items_for_crossover = {
            s["storeId"]: [(it["category"], it["name"]) for it in s["menuItems"]]
            for s in store_list if s["menuItems"]
        }
        crossover_raw = compute_crossover(items_for_crossover)
        # Resolve store names into crossover rows
        sid_name = {s["storeId"]: s["name"] for s in store_list}
        crossover = [
            {**r, "storeA": sid_name.get(r["storeAId"], r["storeAId"]),
                  "storeB": sid_name.get(r["storeBId"], r["storeBId"])}
            for r in crossover_raw
        ]

        output_addresses.append({
            "address": addr,
            "stores":   store_list,
            "crossover": sorted(crossover, key=lambda x: -x["overlapPct"]),
        })

    return {
        "auditedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "addresses": output_addresses,
    }

# ── main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="VK Intelligence Menu Audit Pipeline")
    ap.add_argument("csv", help="Path to address CSV")
    ap.add_argument("--out", default="public/menuAuditData.json", help="Output JSON path")
    ap.add_argument("--user", default=os.environ.get("SNOWFLAKE_USER", ""), help="Snowflake username (FIRST.LAST)")
    args = ap.parse_args()

    if not args.user:
        sys.exit("Set --user FIRST.LAST or export SNOWFLAKE_USER=FIRST.LAST")

    print(f"[1/4] Parsing {args.csv}…")
    addresses = load_addresses(args.csv)
    print(f"      {len(addresses)} addresses")

    print("[2/4] Connecting to Snowflake…")
    conn = get_snowflake_conn(args.user)

    print("[3/4] Querying stores…")
    stores_df = query_stores_by_addresses(conn, addresses)
    print(f"      {len(stores_df)} stores found")

    store_ids = stores_df["store_id"].astype(int).tolist() if not stores_df.empty else []

    print("[4/4] Fetching menu items…")
    items_df = query_menu_items(conn, store_ids) if store_ids else pd.DataFrame(
        columns=["store_id", "category", "item_name", "price"]
    )
    print(f"      {len(items_df)} menu items")

    conn.close()

    output = assemble(addresses, stores_df, items_df)

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n✓ Wrote {args.out}")
    print(f"  {len(output['addresses'])} addresses · "
          f"{sum(len(a['stores']) for a in output['addresses'])} stores · "
          f"{sum(len(a['crossover']) for a in output['addresses'])} store pairs")

if __name__ == "__main__":
    main()

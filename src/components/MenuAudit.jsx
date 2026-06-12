import React, { useState, useRef } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────
const STORE_TYPE_META = {
  virtual_brand:    { label: "Virtual Brand", color: "#a78bfa", bg: "#7c3aed22" },
  brick_and_mortar: { label: "Brick & Mortar", color: "#34d399", bg: "#05966922" },
  unknown:          { label: "Unknown",         color: "#9ca3af", bg: "#11182722" },
};

const Badge = ({ type }) => {
  const m = STORE_TYPE_META[type] ?? STORE_TYPE_META.unknown;
  return (
    <span style={{
      background: m.bg, color: m.color, border: `1px solid ${m.color}`,
      borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600,
      whiteSpace: "nowrap",
    }}>{m.label}</span>
  );
};

const pctColor = (pct) =>
  pct >= 60 ? "#ef4444" : pct >= 30 ? "#f59e0b" : "#22c55e";

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

function normalizeAddress(row) {
  // Try common column names
  const street = row.street_address || row.address || row.street || row.addr || "";
  const city   = row.city || "";
  const state  = row.state || row.st || "";
  const zip    = row.zip || row.zip_code || row.postal_code || row.zipcode || "";
  return { street, city, state, zip,
    display: [street, city, state, zip].filter(Boolean).join(", ") };
}

// ── sub-components ────────────────────────────────────────────────────────────
function CrossoverMatrix({ stores, crossover }) {
  if (!crossover || crossover.length === 0) return (
    <div style={{ color: "#6b7280", fontSize: 13, padding: "12px 0" }}>
      No crossover data — run the pipeline to populate.
    </div>
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
        <thead>
          <tr>
            <th style={{ padding: "8px 12px", color: "#6b7280", textAlign: "left", borderBottom: "1px solid #2d3148" }}>Store A</th>
            <th style={{ padding: "8px 12px", color: "#6b7280", textAlign: "left", borderBottom: "1px solid #2d3148" }}>Store B</th>
            <th style={{ padding: "8px 12px", color: "#6b7280", textAlign: "right", borderBottom: "1px solid #2d3148" }}>Shared Items</th>
            <th style={{ padding: "8px 12px", color: "#6b7280", textAlign: "right", borderBottom: "1px solid #2d3148" }}>Overlap %</th>
            <th style={{ padding: "8px 12px", color: "#6b7280", textAlign: "left", borderBottom: "1px solid #2d3148" }}>Shared (name · category)</th>
          </tr>
        </thead>
        <tbody>
          {crossover.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #1f2937" }}>
              <td style={{ padding: "10px 12px", color: "#e2e8f0" }}>{row.storeA}</td>
              <td style={{ padding: "10px 12px", color: "#e2e8f0" }}>{row.storeB}</td>
              <td style={{ padding: "10px 12px", color: "#e2e8f0", textAlign: "right" }}>{row.sharedItems?.length ?? 0}</td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>
                <span style={{
                  color: pctColor(row.overlapPct), fontWeight: 700, fontSize: 15,
                }}>{row.overlapPct}%</span>
              </td>
              <td style={{ padding: "10px 12px", color: "#9ca3af", fontSize: 12 }}>
                {row.sharedItems?.slice(0, 5).map((it, j) => (
                  <span key={j} style={{
                    display: "inline-block", background: "#1f2937", borderRadius: 3,
                    padding: "1px 6px", margin: "2px 2px 2px 0", fontSize: 11,
                  }}>{it.name} · {it.category}</span>
                ))}
                {(row.sharedItems?.length ?? 0) > 5 && (
                  <span style={{ color: "#6b7280", fontSize: 11 }}>
                    +{row.sharedItems.length - 5} more
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddressCard({ result }) {
  const [expanded, setExpanded] = useState(true);
  const flaggedPairs = (result.crossover || []).filter(c => c.overlapPct >= 30);

  return (
    <div style={{ background: "#1e2130", borderRadius: 10, border: "1px solid #2d3148", overflow: "hidden" }}>
      {/* header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", cursor: "pointer",
          borderBottom: expanded ? "1px solid #2d3148" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{result.address.display}</span>
          <span style={{ color: "#9ca3af", fontSize: 12 }}>
            {result.stores?.length ?? 0} stores
          </span>
          {flaggedPairs.length > 0 && (
            <span style={{
              background: "#ef444422", color: "#ef4444", border: "1px solid #ef4444",
              borderRadius: 4, padding: "1px 8px", fontSize: 11, fontWeight: 600,
            }}>
              ⚠ {flaggedPairs.length} high-overlap pair{flaggedPairs.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span style={{ color: "#6b7280", fontSize: 16 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* store list */}
          <div>
            <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Stores at this address</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(result.stores || []).map((s, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#111827", borderRadius: 6, padding: "8px 12px",
                  border: "1px solid #1f2937",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Badge type={s.type} />
                    <span style={{ color: "#e2e8f0", fontSize: 14 }}>{s.name}</span>
                    <span style={{ color: "#6b7280", fontSize: 12 }}>#{s.storeId}</span>
                  </div>
                  <span style={{ color: "#6b7280", fontSize: 12 }}>
                    {s.menuItems?.length ?? 0} items
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* crossover matrix */}
          <div>
            <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Menu item crossover (same name + category)
            </div>
            <CrossoverMatrix stores={result.stores} crossover={result.crossover} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function MenuAudit() {
  const [addresses, setAddresses] = useState([]);   // parsed from CSV
  const [results, setResults] = useState(null);     // loaded from menuAuditData.json
  const [status, setStatus] = useState("idle");     // idle | parsed | ready
  const [fileName, setFileName] = useState("");
  const fileRef = useRef();

  // Try loading existing audit results
  const loadResults = async () => {
    try {
      const r = await fetch("/menuAuditData.json");
      if (!r.ok) throw new Error("no data");
      const data = await r.json();
      setResults(data);
      setStatus("ready");
    } catch {
      setResults(null);
    }
  };

  const onFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      const parsed = rows.map(normalizeAddress).filter(a => a.street || a.zip);
      setAddresses(parsed);
      setStatus("parsed");
      // Check if we already have results for these addresses
      loadResults();
    };
    reader.readAsText(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) { fileRef.current.files = e.dataTransfer.files; onFile({ target: { files: [file] } }); }
  };

  const totalStores   = results?.addresses?.reduce((s, a) => s + (a.stores?.length ?? 0), 0) ?? 0;
  const flaggedPairs  = results?.addresses?.flatMap(a => (a.crossover || []).filter(c => c.overlapPct >= 30)) ?? [];
  const vbCount       = results?.addresses?.flatMap(a => a.stores || []).filter(s => s.type === "virtual_brand").length ?? 0;
  const bmCount       = results?.addresses?.flatMap(a => a.stores || []).filter(s => s.type === "brick_and_mortar").length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* upload card */}
      <div
        onDrop={onDrop} onDragOver={e => e.preventDefault()}
        style={{
          background: "#1e2130", borderRadius: 10, border: "2px dashed #2d3148",
          padding: "32px 24px", textAlign: "center", cursor: "pointer",
          transition: "border-color 0.2s",
        }}
        onClick={() => fileRef.current.click()}
      >
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={onFile} />
        <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
        {fileName
          ? <div style={{ color: "#f1f5f9", fontWeight: 600 }}>{fileName}</div>
          : <div style={{ color: "#9ca3af" }}>Drop a CSV or click to upload</div>
        }
        <div style={{ color: "#6b7280", fontSize: 12, marginTop: 6 }}>
          Expected columns: <code style={{ color: "#a78bfa" }}>street_address, city, state, zip</code>
        </div>
      </div>

      {/* parsed preview */}
      {status === "parsed" && addresses.length > 0 && (
        <div style={{ background: "#1e2130", borderRadius: 10, padding: "16px 20px", border: "1px solid #2d3148" }}>
          <div style={{ color: "#f1f5f9", fontWeight: 600, marginBottom: 8 }}>
            {addresses.length} address{addresses.length > 1 ? "es" : ""} parsed
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {addresses.slice(0, 5).map((a, i) => (
              <div key={i} style={{ color: "#9ca3af", fontSize: 13 }}>• {a.display}</div>
            ))}
            {addresses.length > 5 && (
              <div style={{ color: "#6b7280", fontSize: 12 }}>+{addresses.length - 5} more…</div>
            )}
          </div>
          <div style={{
            marginTop: 16, background: "#111827", borderRadius: 8, padding: "12px 16px",
            border: "1px solid #2d3148",
          }}>
            <div style={{ color: "#f59e0b", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              Next: run the pipeline to enrich this data
            </div>
            <div style={{ color: "#9ca3af", fontSize: 12 }}>
              From your terminal: <code style={{ color: "#a78bfa" }}>python3 scripts/menu_audit_pipeline.py your_file.csv</code><br />
              Then refresh this page — results load automatically from <code style={{ color: "#a78bfa" }}>menuAuditData.json</code>
            </div>
          </div>
        </div>
      )}

      {/* results */}
      {status === "ready" && results && (
        <>
          {/* summary row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Addresses",      value: results.addresses?.length ?? 0, color: "#f1f5f9" },
              { label: "Total Stores",   value: totalStores,                    color: "#3b82f6" },
              { label: "Brick & Mortar", value: bmCount,                        color: "#34d399" },
              { label: "Virtual Brands", value: vbCount,                        color: "#a78bfa" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "#1e2130", borderRadius: 10, padding: "14px 18px", border: "1px solid #2d3148" }}>
                <div style={{ color: "#9ca3af", fontSize: 12 }}>{label}</div>
                <div style={{ color, fontSize: 24, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          {flaggedPairs.length > 0 && (
            <div style={{
              background: "#ef444411", border: "1px solid #ef444444", borderRadius: 8,
              padding: "12px 16px", color: "#fca5a5", fontSize: 13,
            }}>
              ⚠ <strong>{flaggedPairs.length}</strong> menu pair{flaggedPairs.length > 1 ? "s" : ""} have ≥30% item crossover — review below for potential duplication.
            </div>
          )}

          <div style={{ color: "#9ca3af", fontSize: 12 }}>
            Audit run: {results.auditedAt} · {results.addresses?.length} address{results.addresses?.length !== 1 ? "es" : ""}
          </div>

          {results.addresses?.map((result, i) => (
            <AddressCard key={i} result={result} />
          ))}
        </>
      )}
    </div>
  );
}

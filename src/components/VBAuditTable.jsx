import React from "react";

const badge = (label, color) => (
  <span style={{
    background: color + "22", color, border: `1px solid ${color}`,
    borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600,
  }}>{label}</span>
);

export default function VBAuditTable({ zeroOrders, qualityOffenders }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Zero Orders */}
      <div style={{ background: "#1e2130", borderRadius: 10, padding: "20px 24px", border: "1px solid #2d3148" }}>
        <div style={{ color: "#f1f5f9", fontWeight: 600, marginBottom: 4 }}>0 Orders — Last 90 Days</div>
        <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 16 }}>Merchants with zero orders in L90D — candidates for deactivation review</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {zeroOrders.map((biz, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", background: "#111827", borderRadius: 6,
              border: "1px solid #1f2937",
            }}>
              <span style={{ color: "#e2e8f0", fontSize: 14 }}>{biz}</span>
              {badge("0 orders L90D", "#ef4444")}
            </div>
          ))}
        </div>
      </div>

      {/* Quality Offenders */}
      <div style={{ background: "#1e2130", borderRadius: 10, padding: "20px 24px", border: "1px solid #2d3148" }}>
        <div style={{ color: "#f1f5f9", fontWeight: 600, marginBottom: 4 }}>Low Quality Offenders</div>
        <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 16 }}>Low avg rating + high HQDR % — flagged for potential deactivation</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #2d3148" }}>
              {["Business", "Avg Rating", "HQDR % (L90D)", "Action"].map(h => (
                <th key={h} style={{ textAlign: "left", color: "#6b7280", fontSize: 11, fontWeight: 600, padding: "6px 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {qualityOffenders.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #1f2937" }}>
                <td style={{ padding: "12px 10px", color: "#e2e8f0", fontSize: 14 }}>{row.business}</td>
                <td style={{ padding: "12px 10px", color: row.avgRating < 4 ? "#ef4444" : "#9ca3af", fontWeight: 600 }}>{row.avgRating}★</td>
                <td style={{ padding: "12px 10px", color: row.hqdrPct > 75 ? "#ef4444" : "#9ca3af", fontWeight: 600 }}>{row.hqdrPct}%</td>
                <td style={{ padding: "12px 10px" }}>
                  {row.potentiallyDeactivate ? badge("Deactivate", "#ef4444") : badge("Monitor", "#f59e0b")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

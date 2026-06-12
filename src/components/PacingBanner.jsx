import React from "react";

export default function PacingBanner({ week, ytdPacing }) {
  const color = ytdPacing >= 80 ? "#22c55e" : ytdPacing >= 60 ? "#f59e0b" : "#ef4444";
  const label = ytdPacing >= 80 ? "On Track" : ytdPacing >= 60 ? "At Risk" : "Behind";

  return (
    <div style={{
      background: "#1e2130", borderRadius: 10, padding: "16px 24px",
      border: "1px solid #2d3148", display: "flex", alignItems: "center",
      justifyContent: "space-between", flexWrap: "wrap", gap: 12,
    }}>
      <div>
        <div style={{ color: "#9ca3af", fontSize: 12 }}>Current period</div>
        <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 18 }}>{week}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>YTD Pacing</div>
          <div style={{ color, fontWeight: 700, fontSize: 24 }}>{ytdPacing}%</div>
        </div>
        <div style={{
          background: color + "22", color, border: `1px solid ${color}`,
          borderRadius: 6, padding: "4px 12px", fontSize: 13, fontWeight: 600,
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

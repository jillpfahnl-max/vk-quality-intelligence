import React from "react";

export default function ActivationsChart({ activations, deactivations }) {
  const weeks = activations.map((d) => d.week);
  const maxVal = Math.max(...activations.map((d) => d.count), ...deactivations.map((d) => d.count));

  const Bar = ({ value, color, label }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span style={{ color: "#9ca3af", fontSize: 11 }}>{value}</span>
      <div style={{
        width: 28, height: Math.max(4, (value / maxVal) * 120),
        background: color, borderRadius: "4px 4px 0 0", transition: "height 0.3s",
      }} />
    </div>
  );

  return (
    <div style={{ background: "#1e2130", borderRadius: 10, padding: "20px 24px", border: "1px solid #2d3148" }}>
      <div style={{ color: "#f1f5f9", fontWeight: 600, marginBottom: 4 }}>Activations vs. Deactivations</div>
      <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 20 }}>Last 6 weeks</div>

      <div style={{ display: "flex", gap: 32, overflowX: "auto" }}>
        {weeks.map((week, i) => (
          <div key={week} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140 }}>
              <Bar value={activations[i].count} color="#3b82f6" />
              <Bar value={deactivations[i].count} color="#ef4444" />
            </div>
            <span style={{ color: "#6b7280", fontSize: 11 }}>{week}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, background: "#3b82f6", borderRadius: 2 }} />
          <span style={{ color: "#9ca3af", fontSize: 12 }}>Activations</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, background: "#ef4444", borderRadius: 2 }} />
          <span style={{ color: "#9ca3af", fontSize: 12 }}>Deactivations</span>
        </div>
      </div>
    </div>
  );
}

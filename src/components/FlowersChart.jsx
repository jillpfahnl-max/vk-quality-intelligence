import React from "react";

export default function FlowersChart({ activations }) {
  const maxVal = Math.max(...activations.map(d => d.activations));
  const total = activations.reduce((s, d) => s + d.activations, 0);
  const latest = activations[activations.length - 1];
  const prev = activations[activations.length - 2];
  const wow = latest && prev ? latest.activations - prev.activations : null;

  const fmtWeek = (w) => {
    const d = new Date(w);
    return `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { label: "Latest Week", value: latest?.activations ?? "—", sub: fmtWeek(latest?.week), color: "#3b82f6" },
          { label: "WoW Change", value: wow !== null ? (wow > 0 ? `+${wow}` : wow) : "—", sub: "vs prior week", color: wow > 0 ? "#22c55e" : wow < 0 ? "#ef4444" : "#9ca3af" },
          { label: "8-Week Total", value: total, sub: "activations", color: "#a78bfa" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: "#1e2130", borderRadius: 10, padding: "16px 20px", border: "1px solid #2d3148" }}>
            <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>{label}</div>
            <div style={{ color, fontSize: 28, fontWeight: 700 }}>{value}</div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ background: "#1e2130", borderRadius: 10, padding: "20px 24px", border: "1px solid #2d3148" }}>
        <div style={{ color: "#f1f5f9", fontWeight: 600, marginBottom: 4 }}>Flowers Team — Weekly Activations</div>
        <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 20 }}>Last 8 weeks · Source: NV Pre-Sales SMB WBR</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 160 }}>
          {activations.map((d, i) => {
            const h = Math.max(6, (d.activations / maxVal) * 130);
            const isLatest = i === activations.length - 1;
            return (
              <div key={d.week} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#9ca3af", fontSize: 11 }}>{d.activations}</span>
                <div style={{
                  width: "100%", height: h,
                  background: isLatest ? "#3b82f6" : "#1d4ed8",
                  borderRadius: "4px 4px 0 0",
                  border: isLatest ? "1px solid #60a5fa" : "none",
                  transition: "height 0.3s",
                }} />
                <span style={{ color: "#6b7280", fontSize: 10, whiteSpace: "nowrap" }}>{fmtWeek(d.week)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

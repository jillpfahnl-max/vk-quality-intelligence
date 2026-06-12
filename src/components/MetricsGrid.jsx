import React from "react";

const fmt = (val, unit) => {
  if (unit === "$") return `$${(val >= 1e6 ? (val / 1e6).toFixed(2) + "M" : val.toLocaleString())}`;
  if (unit === "%") return `${val}%`;
  return val?.toLocaleString() ?? "—";
};

const wow = (v) => {
  if (v === null || v === undefined) return null;
  const sign = v > 0 ? "+" : "";
  return (
    <span style={{ color: v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : "#9ca3af", fontSize: 12 }}>
      {sign}{v}
    </span>
  );
};

const pct = (actual, goal) => {
  if (!goal) return null;
  return Math.round((actual / goal) * 100);
};

export default function MetricsGrid({ metrics, keys }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
      {keys.map(({ key, label, unit, goal }) => {
        const m = metrics[key];
        const p = pct(m.actual, goal ?? m.goal);
        return (
          <div key={key} style={{
            background: "#1e2130", borderRadius: 10, padding: "16px 20px",
            border: "1px solid #2d3148",
          }}>
            <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>{label}</div>
            <div style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700 }}>
              {fmt(m.actual, unit)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              {wow(m.wow)}
              {p !== null && (
                <span style={{ fontSize: 11, color: p >= 100 ? "#22c55e" : p >= 80 ? "#f59e0b" : "#ef4444" }}>
                  {p}% of goal
                </span>
              )}
            </div>
            {p !== null && (
              <div style={{ marginTop: 8, height: 4, background: "#374151", borderRadius: 2 }}>
                <div style={{
                  width: `${Math.min(p, 100)}%`, height: "100%", borderRadius: 2,
                  background: p >= 100 ? "#22c55e" : p >= 80 ? "#f59e0b" : "#3b82f6",
                }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

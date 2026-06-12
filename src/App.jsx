import React, { useState } from "react";
import MetricsGrid from "./components/MetricsGrid";
import ActivationsChart from "./components/ActivationsChart";
import PacingBanner from "./components/PacingBanner";
import { MOCK_DATA, OKR_KEYS } from "./data/schema";

const NAV_TABS = ["OKR Overview", "Activations & Deactivations", "Ads & Promos"];

export default function App() {
  const [activeTab, setActiveTab] = useState("OKR Overview");
  const data = MOCK_DATA;

  return (
    <div style={{ minHeight: "100vh", background: "#111827", color: "#f1f5f9", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ borderBottom: "1px solid #1f2937", padding: "0 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px" }}>VK Intelligence</span>
          </div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>Last refreshed: {data.week}</div>
        </div>
      </div>

      <div style={{ borderBottom: "1px solid #1f2937", padding: "0 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 0 }}>
          {NAV_TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "14px 18px", fontSize: 14, fontWeight: 500,
              color: activeTab === tab ? "#3b82f6" : "#9ca3af",
              borderBottom: activeTab === tab ? "2px solid #3b82f6" : "2px solid transparent",
            }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 32px" }}>
        {activeTab === "OKR Overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <PacingBanner week={data.week} ytdPacing={data.ytdPacing} />
            <div>
              <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>Key Metrics</div>
              <MetricsGrid metrics={data.okrMetrics} keys={OKR_KEYS} />
            </div>
          </div>
        )}
        {activeTab === "Activations & Deactivations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <ActivationsChart activations={data.activations} deactivations={data.deactivations} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { label: "Total Activations (6wk)", value: data.activations.reduce((s, d) => s + d.count, 0), color: "#3b82f6" },
                { label: "Total Deactivations (6wk)", value: data.deactivations.reduce((s, d) => s + d.count, 0), color: "#ef4444" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "#1e2130", borderRadius: 10, padding: "16px 20px", border: "1px solid #2d3148" }}>
                  <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>{label}</div>
                  <div style={{ color, fontSize: 32, fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === "Ads & Promos" && (
          <div style={{ color: "#6b7280", fontSize: 14, padding: 40, textAlign: "center" }}>
            Ads & Promos section — connect Sigma data source to populate.
          </div>
        )}
      </div>
    </div>
  );
}

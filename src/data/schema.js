// Data schema — replace with real Sigma/Snowflake fetchers when wired up

export const OKR_KEYS = [
  { key: "vbActivations", label: "VB Activations", unit: "", goal: null },
  { key: "vbDeactivations", label: "VB Deactivations", unit: "", goal: null },
  { key: "netGmv", label: "Net GMV", unit: "$", goal: null },
  { key: "adsSalesGmv", label: "Ads Sales GMV", unit: "$", goal: null },
  { key: "smartCampaignAdoption", label: "Smart Campaign Adoption", unit: "%", goal: 6 },
  { key: "slAdoption", label: "SL Adoption", unit: "%", goal: null },
  { key: "promoAdoption", label: "Promo Adoption", unit: "%", goal: null },
  { key: "netSalesLift", label: "Net Sales Lift", unit: "%", goal: null },
];

// Placeholder — swap in live fetches or JSON exports from Sigma/Snowflake
export const MOCK_DATA = {
  week: "Week of June 9, 2026",
  ytdPacing: 72,
  okrMetrics: {
    vbActivations: { actual: 142, goal: 160, wow: +8 },
    vbDeactivations: { actual: 31, goal: null, wow: -3 },
    netGmv: { actual: 2400000, goal: 3000000, wow: +120000 },
    adsSalesGmv: { actual: 310000, goal: 400000, wow: +18000 },
    smartCampaignAdoption: { actual: 5.8, goal: 6, wow: +0.2 },
    slAdoption: { actual: 44, goal: null, wow: +1 },
    promoAdoption: { actual: 38, goal: null, wow: -2 },
    netSalesLift: { actual: 12.4, goal: null, wow: +0.3 },
  },
  activations: [
    { week: "W23", count: 142 },
    { week: "W22", count: 134 },
    { week: "W21", count: 118 },
    { week: "W20", count: 127 },
    { week: "W19", count: 109 },
    { week: "W18", count: 95 },
  ],
  deactivations: [
    { week: "W23", count: 31 },
    { week: "W22", count: 34 },
    { week: "W21", count: 28 },
    { week: "W20", count: 41 },
    { week: "W19", count: 37 },
    { week: "W18", count: 29 },
  ],
};

import React, { useState } from "react";
import { DataTable, SearchInput, Select, Toolbar } from "./AdminUI";

type Feature = [name: string, description: string, enabled: boolean];

const FEATURES: Feature[] = [
  [
    "Auto-reply to client messages",
    "AI answers common client questions automatically",
    true,
  ],
  [
    "Service recommendations",
    "Suggest add-on services based on booking history",
    true,
  ],
  [
    "No-show prediction",
    "Flag bookings with high risk of no-show",
    false,
  ],
  [
    "Smart scheduling",
    "Auto-suggest optimal time slots for new bookings",
    true,
  ],
];

export default function AdminAI() {
  const [features, setFeatures] = useState<Feature[]>(FEATURES);

  const active = features.filter((feature) => feature[2]).length;

  const toggleFeature = (index: number) => {
    setFeatures((current) =>
      current.map((feature, featureIndex) =>
        featureIndex === index
          ? [feature[0], feature[1], !feature[2]]
          : feature
      )
    );
  };

  return (
    <>
      <h2 className="admin-section-title">Features</h2>

      <div className="admin-feature-list">
        {features.map((feature, index) => (
          <article className="admin-feature-card" key={feature[0]}>
            <div>
              <strong>{feature[0]}</strong>
              <p>{feature[1]}</p>
            </div>

            <button
              type="button"
              className={`admin-switch ${feature[2] ? "on" : ""}`}
              onClick={() => toggleFeature(index)}
            >
              <span />
            </button>
          </article>
        ))}
      </div>

      <div className="admin-section-divider" />

      <div className="admin-ai-stats">
        <article className="admin-kpi-card">
          <span>Total AI Searches</span>
          <strong>0</strong>
        </article>

        <article className="admin-kpi-card">
          <span>Recommendations Accepted</span>
          <strong>0/0</strong>
        </article>

        <article className="admin-kpi-card">
          <span>Active Features</span>
          <strong>
            {active}/{features.length}
          </strong>
        </article>
      </div>

      <div className="admin-section-divider" />

      <h2 className="admin-section-title">Recent AI Activity</h2>

      <Toolbar>
        <SearchInput placeholder="Search query or client..." />
        <Select defaultValue="All">
          <option>All</option>
          <option>ai_search</option>
        </Select>
      </Toolbar>

      <DataTable
        columns={[
          "ID",
          "Type",
          "Client",
          "Query",
          "Recommended",
          "Date",
          "Status",
        ]}
        rows={[]}
      />
    </>
  );
}

import React, { useState } from "react";
import {
  ActionButton,
  DataTable,
  PrimaryButton,
  SearchInput,
  Select,
} from "./AdminUI";

const BRANCHES = [
  ["1", "Luna Beauty House", "Kyiv", "Велика Васильківська, 72", "4.9"],
  ["2", "Beauty Room", "Kyiv", "Липки", "4.7"],
];

const NOTIFS = [
  "New booking created",
  "Booking cancelled",
  "Payment received",
  "New review submitted",
  "No-show flagged by AI",
];

export default function AdminSettings() {
  const [mail, setMail] = useState([true, true, true, false, true]);
  const [sms, setSms] = useState([false, true, false, false, true]);

  return (
    <>
      <h2 className="admin-section-title">Business Profile</h2>

      <section className="admin-panel admin-settings-form">
        <label>
          Business name
          <input defaultValue="Beauty AI Salon" />
        </label>

        <label>
          Support email
          <input defaultValue="support@beautyai.com" />
        </label>

        <label>
          Support phone
          <input defaultValue="+380441112233" />
        </label>

        <label>
          Currency
          <Select defaultValue="USD">
            <option>USD</option>
            <option>EUR</option>
            <option>UAH</option>
          </Select>
        </label>

        <label>
          Timezone
          <Select defaultValue="Europe/Kyiv">
            <option>Europe/Kyiv</option>
            <option>Europe/Warsaw</option>
            <option>UTC</option>
          </Select>
        </label>
      </section>

      <div className="admin-section-divider" />

      <div className="admin-heading-row">
        <h2 className="admin-section-title">Branches</h2>
        <PrimaryButton>＋ Add Branch</PrimaryButton>
      </div>

      <SearchInput placeholder="Search branch..." />

      <DataTable
        columns={["ID", "Salon", "City", "Address", "Rating"]}
        rows={BRANCHES}
      />

      <div className="admin-actions">
        <ActionButton>✎ Edit</ActionButton>
        <ActionButton tone="danger">✕ Delete</ActionButton>
      </div>

      <div className="admin-section-divider" />

      <h2 className="admin-section-title">Notifications</h2>

      <div className="admin-feature-list">
        {NOTIFS.map((notification, index) => (
          <article className="admin-feature-card" key={notification}>
            <strong>{notification}</strong>

            <div className="admin-notif-controls">
              <label>
                Email
                <input
                  type="checkbox"
                  checked={mail[index]}
                  onChange={() =>
                    setMail((values) =>
                      values.map((value, itemIndex) =>
                        itemIndex === index ? !value : value
                      )
                    )
                  }
                />
              </label>

              <label>
                SMS
                <input
                  type="checkbox"
                  checked={sms[index]}
                  onChange={() =>
                    setSms((values) =>
                      values.map((value, itemIndex) =>
                        itemIndex === index ? !value : value
                      )
                    )
                  }
                />
              </label>
            </div>
          </article>
        ))}
      </div>

      <div className="admin-section-divider" />

      <h2 className="admin-section-title">Account & Security</h2>

      <section className="admin-panel admin-settings-form">
        <label>
          Admin email
          <input defaultValue="admin@beautyai.com" />
        </label>

        <ActionButton>🔒 Change Password</ActionButton>
        <PrimaryButton>💾 Save Changes</PrimaryButton>
      </section>
    </>
  );
}

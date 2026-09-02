import React, { useCallback, useEffect, useState } from "react";
import AdminIcon from "./AdminIcons";
import { getDashboardData, pctChange } from "./api/dashboard";
import type { DashboardData } from "./api/dashboard";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(value);
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return money(value);
}

function Trend({ current, previous }: { current: number; previous: number }) {
  const value = pctChange(current, previous);
  const positive = value >= 0;
  return (
    <span className={`admin-trend-v3 ${positive ? "positive" : "negative"}`}>
      {positive ? "↑" : "↓"} {Math.abs(value).toFixed(value % 1 === 0 ? 0 : 1)}%
    </span>
  );
}

export default function AdminHome({ onHome }: { onHome: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getDashboardData());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const d = data;

  const kpis = [
    { title: "Booking Value (30d)", value: compactMoney(d?.revenueCurrent || 0), current: d?.revenueCurrent || 0, previous: d?.revenuePrevious || 0, icon: "revenue" as const },
    { title: "Total Bookings (30d)", value: String(d?.bookingsCurrent || 0), current: d?.bookingsCurrent || 0, previous: d?.bookingsPrevious || 0, icon: "bookings" as const },
    { title: "New Clients (30d)", value: String(d?.clientsCurrent || 0), current: d?.clientsCurrent || 0, previous: d?.clientsPrevious || 0, icon: "clients" as const },
    { title: "Active Masters (30d)", value: String(d?.mastersCurrent || 0), current: d?.mastersCurrent || 0, previous: d?.mastersPrevious || 0, icon: "masters" as const },
  ];

  const today = [
    { title: "Bookings Today", value: d?.bookingsToday || 0, icon: "calendar" as const, tone: "purple" },
    { title: "Completed Today", value: d?.completedToday || 0, icon: "completed" as const, tone: "green" },
    { title: "Cancelled Today", value: d?.cancelledToday || 0, icon: "cancelled" as const, tone: "gray" },
    { title: "No-show Today", value: d?.noShowToday || 0, icon: "noshow" as const, tone: "gray" },
  ];

  return (
    <div className="admin-dashboard-v3">
      <section className="admin-kpi-grid-v3">
        {kpis.map((item) => (
          <article className="admin-kpi-v3" key={item.title}>
            <div className="admin-kpi-icon-v3"><AdminIcon name={item.icon} size={20} /></div>
            <div className="admin-kpi-copy-v3">
              <span>{item.title}</span>
              <strong>{item.value}</strong>
            </div>
            <Trend current={item.current} previous={item.previous} />
          </article>
        ))}
      </section>

      <div className="admin-section-head-v3">
        <div><span>LIVE OVERVIEW</span><h2>Today</h2></div>
        <div className="admin-section-head-actions-v3">
          <div className="admin-dashboard-actions-v3">
            {error && (
              <div className="admin-backend-status-v3">
                <span className="admin-backend-dot-v3" />
                <span>Backend unavailable</span>
              </div>
            )}

            <button
              type="button"
              className="admin-refresh-v3"
              onClick={() => void load()}
              disabled={loading}
            >
              <AdminIcon name="refresh" size={16} />
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              className="admin-website-action-v3"
              onClick={onHome}
            >
              <AdminIcon name="home" size={16} />
              Website
            </button>
          </div>
        </div>
      </div>

      <section className="admin-today-grid-v3">
        {today.map((item) => (
          <article key={item.title}>
            <div className={`admin-today-icon-v3 ${item.tone}`}><AdminIcon name={item.icon} size={20} /></div>
            <div><span>{item.title}</span><strong>{item.value}</strong></div>
          </article>
        ))}
      </section>

      <section className="admin-dashboard-main-grid-v3">
        <article className="admin-panel-v3 admin-recent-v3">
          <div className="admin-panel-head-v3">
            <div><h2>Recent Bookings</h2></div>
            <small>{d?.recentBookings.length || 0} records</small>
          </div>
          <div className="admin-table-scroll-v3">
            <table>
              <thead><tr><th>ID</th><th>Client</th><th>Master</th><th>Date / Time</th><th>Status</th></tr></thead>
              <tbody>
                {d?.recentBookings.length ? d.recentBookings.map((b) => (
                  <tr key={String(b.id)}>
                    <td>#{b.id}</td><td>{b.client}</td><td>{b.master}</td><td>{b.dateTime}</td>
                    <td><span className={`admin-status-v3 ${b.status.toLowerCase().replace(/\s/g, "-")}`}>{b.status}</span></td>
                  </tr>
                )) : <tr><td colSpan={5} className="admin-empty-v3">{loading ? "Loading bookings…" : "No bookings"}</td></tr>}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-panel-v3 admin-schedule-v3">
          <div className="admin-panel-head-v3">
            <div><h2>Today's Schedule</h2></div>
          </div>
          <div className="admin-schedule-list-v3">
            {d?.todaySchedule.length ? d.todaySchedule.map((b) => {
              const time = b.dateTime.includes(" ") ? b.dateTime.split(" ", 2)[1]?.slice(0, 5) : "";
              return (
                <div className="admin-schedule-row-v3" key={String(b.id)}>
                  <time>{time}</time>
                  <div><strong>{b.client}</strong><span>{b.service} · {b.master}</span></div>
                  <span className={`admin-status-v3 ${b.status.toLowerCase().replace(/\s/g, "-")}`}>{b.status}</span>
                </div>
              );
            }) : <div className="admin-empty-card-v3">No bookings scheduled for this date.</div>}
          </div>
        </article>
      </section>

      <section className="admin-panel-v3 admin-top-masters-v3">
        <div className="admin-panel-head-v3">
          <div><h2>Active Now</h2></div>
          <small>{d?.activeNow.length || 0} in progress</small>
        </div>

        {d?.activeNow.length ? (
          <div className="admin-master-cards-v3">
            {d.activeNow.map((booking) => (
              <article key={String(booking.id)}>
                <div className="admin-master-name-v3"><strong>{booking.master}</strong><span>{booking.dateTime.slice(-5)}</span></div>
                <div className="admin-master-metric-v3"><span>Client</span><strong>{booking.client}</strong></div>
                <div className="admin-master-metric-v3"><span>Service</span><strong>{booking.service}</strong></div>
              </article>
            ))}
          </div>
        ) : <div className="admin-empty-card-v3">No masters active right now.</div>}
      </section>
    </div>
  );
}

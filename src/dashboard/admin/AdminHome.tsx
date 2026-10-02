import React, { useCallback, useEffect, useState } from "react";
import AdminIcon from "./AdminIcons";
import { getDashboardData, pctChange } from "./api/dashboard";
import type { DashboardData } from "./api/dashboard";

const DEMO_30D = {
  revenueCurrent: 407300,
  revenuePrevious: 346565,
  bookingsCurrent: 531,
  bookingsPrevious: 461,
  clientsCurrent: 10,
  clientsPrevious: 11,
  mastersCurrent: 88,
  mastersPrevious: 78,
};

function demoValue(
  realValue: number | undefined,
  fallback: number,
  demoMode: boolean
) {
  const value = realValue ?? 0;
  return demoMode ? fallback : value;
}

const DEMO_TODAY_SCHEDULE = [
  {
    id: "demo-1",
    client: "Іван Олексенко Андрійович",
    service: "Haircut",
    master: "Аріна Бондар",
    dateTime: "2026-10-02 09:15",
    status: "Completed",
  },
  {
    id: "demo-2",
    client: "Дубіна Юлія",
    service: "SPA догляд",
    master: "Віра Негода",
    dateTime: "2026-10-02 10:00",
    status: "Completed",
  },
  {
    id: "demo-3",
    client: "Радченко Олена",
    service: "Масаж",
    master: "Михайлина Забарна",
    dateTime: "2026-10-02 10:15",
    status: "Cancelled",
  },
  {
    id: "demo-4",
    client: "Верес Леонід",
    service: "Стрижка",
    master: "Олена Коваленко",
    dateTime: "2026-10-02 10:45",
    status: "No-show",
  },
  {
    id: "demo-5",
    client: "Віталій Лук'ян Забарний",
    service: "Манікюр",
    master: "Святослава Юрчишина",
    dateTime: "2026-10-02 11:45",
    status: "Completed",
  },
  {
    id: "demo-6",
    client: "Левон Миронович Лук'янко",
    service: "Фарбування",
    master: "Марта Чаленко",
    dateTime: "2026-10-02 13:15",
    status: "Completed",
  },
  {
    id: "demo-7",
    client: "Насторенко Ярослав",
    service: "Барберинг",
    master: "Захар Влох",
    dateTime: "2026-10-02 16:00",
    status: "Completed",
  },
  {
    id: "demo-8",
    client: "Шевченко Альбіна",
    service: "Укладка",
    master: "Аніта Москаль",
    dateTime: "2026-10-02 16:30",
    status: "Completed",
  },
];

function money(value: number) {
  return `${value.toLocaleString("uk-UA", {
    maximumFractionDigits: 0,
  })} ₴`;
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K ₴`;
  }
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
  const [demoMode, setDemoMode] = useState(false);

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

  const revenueCurrent = demoValue(d?.revenueCurrent, DEMO_30D.revenueCurrent, demoMode);
  const revenuePrevious = demoValue(d?.revenuePrevious, DEMO_30D.revenuePrevious, demoMode);
  const bookingsCurrent = demoValue(d?.bookingsCurrent, DEMO_30D.bookingsCurrent, demoMode);
  const bookingsPrevious = demoValue(d?.bookingsPrevious, DEMO_30D.bookingsPrevious, demoMode);
  const clientsCurrent = demoValue(d?.clientsCurrent, DEMO_30D.clientsCurrent, demoMode);
  const clientsPrevious = demoValue(d?.clientsPrevious, DEMO_30D.clientsPrevious, demoMode);
  const mastersCurrent = demoValue(d?.mastersCurrent, DEMO_30D.mastersCurrent, demoMode);
  const mastersPrevious = demoValue(d?.mastersPrevious, DEMO_30D.mastersPrevious, demoMode);

  const kpis = [
    { title: "Booking Value (30d)", value: compactMoney(revenueCurrent), current: revenueCurrent, previous: revenuePrevious, icon: "revenue" as const },
    { title: "Total Bookings (30d)", value: String(bookingsCurrent), current: bookingsCurrent, previous: bookingsPrevious, icon: "bookings" as const },
    { title: "New Clients (30d)", value: String(clientsCurrent), current: clientsCurrent, previous: clientsPrevious, icon: "clients" as const },
    { title: "Active Masters (30d)", value: String(mastersCurrent), current: mastersCurrent, previous: mastersPrevious, icon: "masters" as const },
  ];

  const today = [
    { title: "Bookings Today", value: demoMode ? 18 : (d?.bookingsToday || 0), icon: "calendar" as const, tone: "purple" },
    { title: "Completed Today", value: demoMode ? 13 : (d?.completedToday || 0), icon: "completed" as const, tone: "green" },
    { title: "Cancelled Today", value: demoMode ? 2 : (d?.cancelledToday || 0), icon: "cancelled" as const, tone: "gray" },
    { title: "No-show Today", value: demoMode ? 3 : (d?.noShowToday || 0), icon: "noshow" as const, tone: "gray" },
  ];

  const todaySchedule = demoMode ? DEMO_TODAY_SCHEDULE : (d?.todaySchedule || []);

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
              onClick={() => setDemoMode((value) => !value)}
              aria-pressed={demoMode}
              title={demoMode ? "Show real data" : "Show demo data"}
            >
              {demoMode ? "Demo: ON" : "Demo: OFF"}
            </button>

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
            {todaySchedule.length ? todaySchedule.map((b) => {
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
    </div>
  );
}

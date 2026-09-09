import React, { useEffect, useMemo, useState } from "react";
import {
  KpiCard,
  PrimaryButton,
  SearchInput,
  Select,
  Toolbar,
} from "./AdminUI";
import {
  getAnalyticsSourceData,
  type AnalyticsPeriod,
  type AnalyticsSourceData,
} from "./api/analytics";
import "../styles/admin-analytics.css";

const PERIOD_DAYS: Record<Exclude<AnalyticsPeriod, "This year">, number> = {
  "Last 7 days": 7,
  "Last 30 days": 30,
  "Last 90 days": 90,
};

const EMPTY_DATA: AnalyticsSourceData = {
  bookings: [],
  masters: [],
  payments: [],
};

function money(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function compactMoney(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return money(value);
}

function statusKey(value: string): string {
  return value.trim().toLowerCase();
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function HorizontalBars({
  rows,
  moneyValues = false,
}: {
  rows: Array<[string, number]>;
  moneyValues?: boolean;
}) {
  const max = Math.max(1, ...rows.map(([, value]) => value));

  if (!rows.length) {
    return <div className="admin-analytics-empty">No data for this period</div>;
  }

  return (
    <div className="admin-analytics-hbars">
      {rows.map(([label, value]) => (
        <div className="admin-analytics-hbar-row" key={label}>
          <span className="admin-analytics-hbar-label">{label}</span>
          <div className="admin-analytics-hbar-track">
            <span style={{ width: `${(value / max) * 100}%` }} />
          </div>
          <b>{moneyValues ? compactMoney(value) : value}</b>
        </div>
      ))}
    </div>
  );
}

function VerticalBars({
  rows,
  moneyValues = false,
}: {
  rows: Array<[string, number]>;
  moneyValues?: boolean;
}) {
  const max = Math.max(1, ...rows.map(([, value]) => value));

  if (!rows.length) {
    return <div className="admin-analytics-empty">No data for this period</div>;
  }

  return (
    <div className="admin-analytics-vbars">
      {rows.map(([label, value]) => (
        <div className="admin-analytics-vbar" key={label}>
          <b>{moneyValues ? compactMoney(value) : value}</b>
          <div className="admin-analytics-vbar-track">
            <span style={{ height: `${(value / max) * 100}%` }} />
          </div>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}

function DonutLegend({ rows }: { rows: Array<[string, number]> }) {
  const total = rows.reduce((sum, [, value]) => sum + value, 0);

  if (!total) {
    return <div className="admin-analytics-empty">No data for this period</div>;
  }

  let offset = 0;
  const stops = rows.map(([, value], index) => {
    const start = offset;
    offset += (value / total) * 100;
    return `var(--analytics-donut-${(index % 5) + 1}) ${start}% ${offset}%`;
  });

  return (
    <div className="admin-analytics-donut-wrap">
      <div
        className="admin-analytics-donut"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
      />
      <div className="admin-analytics-donut-legend">
        {rows.map(([label, value], index) => (
          <span key={label}>
            <i className={`dot-${(index % 5) + 1}`} />
            {label}
            <b>{value} ({((value / total) * 100).toFixed(1)}%)</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function RevenueTrend({ rows }: { rows: Array<[string, number]> }) {
  if (!rows.length) {
    return <div className="admin-analytics-empty admin-analytics-empty-large">No revenue data for this period</div>;
  }

  const max = Math.max(1, ...rows.map(([, value]) => value));
  const points = rows.map(([, value], index) => {
    const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
    const y = 92 - (value / max) * 78;
    return `${x},${y}`;
  });
  const line = points.join(" ");
  const area = `0,100 ${line} 100,100`;
  const labels = rows.filter((_, index) => {
    if (rows.length <= 7) {
      return true;
    }
    const step = Math.max(1, Math.floor(rows.length / 6));
    return index % step === 0 || index === rows.length - 1;
  });

  return (
    <div className="admin-analytics-trend">
      <div className="admin-analytics-ylabels">
        <span>{compactMoney(max)}</span>
        <span>{compactMoney(max * 0.75)}</span>
        <span>{compactMoney(max * 0.5)}</span>
        <span>{compactMoney(max * 0.25)}</span>
        <span>$0</span>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Revenue trend">
        <polygon className="admin-analytics-area" points={area} />
        <polyline className="admin-analytics-line" points={line} />
      </svg>
      <div className="admin-analytics-xlabels">
        {labels.map(([label]) => <span key={label}>{label}</span>)}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  full = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <section className={`admin-panel admin-analytics-card${full ? " admin-analytics-card-full" : ""}`}>
      <h2 className="admin-panel-title">{title}</h2>
      {subtitle ? <p className="admin-analytics-subtitle">{subtitle}</p> : null}
      {children}
    </section>
  );
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("Last 30 days");
  const [source, setSource] = useState<AnalyticsSourceData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [masterSearch, setMasterSearch] = useState("");
  const [masterCategory, setMasterCategory] = useState("All");
  const [masterPage, setMasterPage] = useState(0);
  const MASTERS_PAGE_SIZE = 10;

  useEffect(() => {
    let alive = true;

    getAnalyticsSourceData()
      .then((data) => {
        if (alive) {
          setSource(data);
        }
      })
      .catch(() => {
        if (alive) {
          setSource(EMPTY_DATA);
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  const analytics = useMemo(() => {
    const availableDates = [
      ...source.bookings.map((row) => row.date),
      ...source.payments.map((row) => row.date),
    ];
    const anchor = availableDates.length
      ? new Date(Math.max(...availableDates.map((row) => row.getTime())))
      : new Date();
    const cutoff =
      period === "This year"
        ? new Date(anchor.getFullYear(), 0, 1)
        : new Date(anchor);

    if (period !== "This year") {
      cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period]);
    }

    const bookings = source.bookings.filter((row) => row.date >= cutoff && row.date <= anchor);
    const payments = source.payments.filter((row) => row.date >= cutoff && row.date <= anchor);
    const revenueRecords: Array<[Date, number]> = payments.length
      ? payments.map((row) => [row.date, row.amount])
      : bookings.map((row) => [row.date, row.price]);

    const totalRevenue = revenueRecords.reduce((sum, [, value]) => sum + value, 0);
    const orderCount = payments.length || bookings.length;
    const cancelled = bookings.filter((row) => statusKey(row.status) === "cancelled").length;
    const noShow = bookings.filter((row) => ["no-show", "no show", "noshow"].includes(statusKey(row.status))).length;

    const clientCounts = new Map<string, number>();
    bookings.forEach((row) => {
      if (row.client !== "—") {
        clientCounts.set(row.client, (clientCounts.get(row.client) || 0) + 1);
      }
    });
    const returningClients = [...clientCounts.values()].filter((value) => value > 1).length;

    const byDay = new Map<string, number>();
    revenueRecords.forEach(([rowDate, amount]) => {
      const key = rowDate.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + amount);
    });
    const revenueTrend = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]): [string, number] => [
        new Date(`${key}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        value,
      ]);

    const paymentMethods = count(source.payments.filter((row) => row.date >= cutoff && row.date <= anchor), (row) => row.method);

    const periodRevenue = new Map<string, number>();
    revenueRecords.forEach(([rowDate, amount]) => {
      let key: string;
         if (period === "Last 7 days") {
        key = rowDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      } else if (period === "Last 30 days" || period === "Last 90 days") {
        const monday = new Date(rowDate);
        const day = (monday.getDay() + 6) % 7;
        monday.setDate(monday.getDate() - day);
        key = monday.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      } else {
        key = rowDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      }
      periodRevenue.set(key, (periodRevenue.get(key) || 0) + amount);
    });

    const revenueByCity = new Map<string, number>();
    bookings.forEach((row) => {
      const city = row.city && row.city !== "N/A" ? row.city : "Solo / No salon";
      revenueByCity.set(city, (revenueByCity.get(city) || 0) + row.price);
    });

    const topMasters = count(bookings.filter((row) => row.master !== "—"), (row) => row.master).slice(0, 8);
    const popularServices = count(bookings.filter((row) => row.service !== "—"), (row) => row.service).slice(0, 8);
    const bookingStatus = count(bookings, (row) => row.status);
    const clientMix: Array<[string, number]> = [
      ["New", [...clientCounts.values()].filter((value) => value === 1).length],
      ["Returning", returningClients],
    ];

    const hours = new Map<number, number>();
    const weekdays = new Map<number, number>();
    bookings.forEach((row) => {
      hours.set(row.date.getHours(), (hours.get(row.date.getHours()) || 0) + 1);
      const mondayIndex = (row.date.getDay() + 6) % 7;
      weekdays.set(mondayIndex, (weekdays.get(mondayIndex) || 0) + 1);
    });
    const peakHours = [...hours.entries()]
      .sort(([a], [b]) => a - b)
      .map(([hour, value]): [string, number] => [`${String(hour).padStart(2, "0")}:00`, value]);
    const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const bookingsByWeekday = weekdayNames.map((name, index): [string, number] => [name, weekdays.get(index) || 0]);

    const masterStats = new Map<string, { bookings: number; revenue: number }>();
    bookings.forEach((row) => {
      if (row.master === "—") {
        return;
      }
      const current = masterStats.get(row.master) || { bookings: 0, revenue: 0 };
      current.bookings += 1;
      current.revenue += row.price;
      masterStats.set(row.master, current);
    });

    const masterPerformance = source.masters
      .map((master) => ({
        ...master,
        bookings: masterStats.get(master.name)?.bookings || 0,
        revenue: masterStats.get(master.name)?.revenue || 0,
      }))
      .sort((a, b) => b.bookings - a.bookings);

    return {
      bookings,
      totalRevenue,
      avgBookingValue: orderCount ? totalRevenue / orderCount : 0,
      cancellationRate: bookings.length ? (cancelled / bookings.length) * 100 : 0,
      noShowRate: bookings.length ? (noShow / bookings.length) * 100 : 0,
      repeatClients: clientCounts.size ? (returningClients / clientCounts.size) * 100 : 0,
      revenueTrend,
      paymentMethods,
      revenueByPeriod: [...periodRevenue.entries()],
      revenueByCity: [...revenueByCity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      topMasters,
      popularServices,
      bookingStatus,
      clientMix,
      peakHours,
      bookingsByWeekday,
      masterPerformance,
    };
  }, [period, source]);

  const categories = useMemo(() => {
    return ["All", ...new Set(source.masters.map((row) => row.specialization).filter((row) => row && row !== "—"))];
  }, [source.masters]);

  const filteredMasters = analytics.masterPerformance.filter((row) => {
    const matchesSearch = row.name.toLowerCase().includes(masterSearch.toLowerCase());
    const matchesCategory = masterCategory === "All" || row.specialization === masterCategory;
    return matchesSearch && matchesCategory;
  });

  const exportReport = () => {
    const rows = [
      ["Master", "Category", "Bookings", "Revenue", "Rating"],
      ...analytics.masterPerformance.map((row) => [
        row.name,
        row.specialization,
        String(row.bookings),
        row.revenue.toFixed(2),
        String(row.rating),
      ]),
    ];
    downloadCsv(rows, `analytics_report_${period.replace(/ /g, "_")}.csv`);
  };

  return (
    <>
      <Toolbar right={<PrimaryButton onClick={exportReport}>↓ EXPORT REPORT</PrimaryButton>}>
        <label className="admin-field">
          <span>Period</span>
          <Select value={period} onChange={(event) => setPeriod(event.target.value as AnalyticsPeriod)}>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>This year</option>
          </Select>
        </label>
      </Toolbar>

      <div className="admin-section-divider" />

      <div className="admin-analytics-kpis">
        <KpiCard title="Booking Value" value={loading ? "—" : compactMoney(analytics.totalRevenue)} icon="▣" />
        <KpiCard title="Avg Booking Value" value={loading ? "—" : money(analytics.avgBookingValue)} icon="▤" />
        <KpiCard title="Cancellation Rate" value={loading ? "—" : `${analytics.cancellationRate.toFixed(1)}%`} icon="✕" />
        <KpiCard title="No-show Rate" value={loading ? "—" : `${analytics.noShowRate.toFixed(1)}%`} icon="◒" />
        <KpiCard title="Repeat Clients" value={loading ? "—" : `${analytics.repeatClients.toFixed(1)}%`} icon="↔" />
      </div>

      <div className="admin-section-divider" />

      <div className="admin-analytics-grid">
        <ChartCard title="Revenue Trend" subtitle="Booking value over time" full>
          <RevenueTrend rows={analytics.revenueTrend} />
        </ChartCard>

        <ChartCard title="Payment Methods">
          <DonutLegend rows={analytics.paymentMethods} />
        </ChartCard>

        <ChartCard
          title={
            period === "Last 7 days"
              ? "Revenue by Day"
              : period === "Last 30 days"
                ? "Revenue by Week"
                : "Revenue by Month"
          }
        >
          <VerticalBars rows={analytics.revenueByPeriod} moneyValues />
        </ChartCard>

        <ChartCard title="Booking Status">
          <DonutLegend rows={analytics.bookingStatus} />
        </ChartCard>

        <ChartCard title="Most Popular Services">
          <HorizontalBars rows={analytics.popularServices} />
        </ChartCard>

        <ChartCard title="Revenue by City">
          <HorizontalBars rows={analytics.revenueByCity} moneyValues />
        </ChartCard>

        <ChartCard title="New vs Returning Clients">
          <DonutLegend rows={analytics.clientMix} />
        </ChartCard>

        <ChartCard title="Peak Hours">
          <VerticalBars rows={analytics.peakHours} />
        </ChartCard>

        <ChartCard title="Bookings by Weekday">
          <VerticalBars rows={analytics.bookingsByWeekday} />
        </ChartCard>
      </div>

      <div className="admin-section-divider" />

      <section className="admin-analytics-ai">
        <h2 className="admin-section-title">AI Performance</h2>
        <p>AI analytics API is not connected yet.</p>
        <div className="admin-analytics-ai-cards">
          <KpiCard title="AI Analyses" value="—" icon="✦" />
          <KpiCard title="AI → Booking Conversion" value="—" icon="↗" />
        </div>
      </section>

      <div className="admin-section-divider" />

      <div className="admin-heading-row">
        <h2 className="admin-section-title">Master Performance</h2>
      </div>

      <Toolbar>
        <SearchInput
          placeholder="Search master..."
          value={masterSearch}
          onChange={(event) => { setMasterSearch(event.target.value); setMasterPage(0); }}
        />
        <label className="admin-field">
          <span>Specialization</span>
          <Select value={masterCategory} onChange={(event) => { setMasterCategory(event.target.value); setMasterPage(0); }}>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </Select>
        </label>
      </Toolbar>

      <section className="admin-panel admin-analytics-table-wrap">
        <div className="admin-analytics-table-scroll">
          <table className="admin-analytics-table">
            <thead>
              <tr>
                <th>Master</th>
                <th>Category</th>
                <th>Bookings</th>
                <th>Revenue</th>
                <th>Rating</th>
              </tr>
            </thead>
                       <tbody>
              {filteredMasters
                .slice(masterPage * MASTERS_PAGE_SIZE, masterPage * MASTERS_PAGE_SIZE + MASTERS_PAGE_SIZE)
                .map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.specialization}</td>
                  <td>{row.bookings}</td>
                  <td>{money(row.revenue)}</td>
                  <td>{row.rating ? row.rating.toFixed(2) : "—"}</td>
                </tr>
              ))}
              {!filteredMasters.length ? (
                <tr>
                  <td colSpan={5} className="admin-analytics-empty-cell">No masters found</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {filteredMasters.length > MASTERS_PAGE_SIZE ? (
          <div className="admin-pagination">
            <button
              type="button"
              disabled={masterPage === 0}
              onClick={() => setMasterPage((page) => page - 1)}
            >
              ← Prev
            </button>
            <span>
              {masterPage * MASTERS_PAGE_SIZE + 1}
              –
              {Math.min(filteredMasters.length, masterPage * MASTERS_PAGE_SIZE + MASTERS_PAGE_SIZE)}
              {" of "}
              {filteredMasters.length}
            </span>
            <button
              type="button"
              disabled={(masterPage + 1) * MASTERS_PAGE_SIZE >= filteredMasters.length}
              onClick={() => setMasterPage((page) => page + 1)}
            >
              Next →
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

function count<T>(rows: T[], key: (row: T) => string): Array<[string, number]> {
  const values = new Map<string, number>();
  rows.forEach((row) => {
    const name = key(row);
    values.set(name, (values.get(name) || 0) + 1);
  });
  return [...values.entries()].sort((a, b) => b[1] - a[1]);
}

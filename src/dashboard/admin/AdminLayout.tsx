import React from "react";
import type { Lang, MockUser } from "../types";
import AdminIcon from "./AdminIcons";
import type { AdminIconName } from "./AdminIcons";
import beautyAISparkles from "../../assets/beauty-ai-sparkles.svg";

export type AdminSection =
  | "dashboard" | "analytics" | "masters" | "salons" | "clients"
  | "bookings" | "services" | "payments" | "reviews" | "ai" | "settings";

const NAV: Array<{ id?: AdminSection; label?: string; icon?: AdminIconName; divider?: boolean }> = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "analytics", label: "Analytics", icon: "analytics" },
  { divider: true },
  { id: "masters", label: "Masters", icon: "masters" },
  { id: "salons", label: "Salons", icon: "salons" },
  { id: "clients", label: "Clients", icon: "clients" },
  { id: "bookings", label: "Bookings", icon: "bookings" },
  { id: "services", label: "Services", icon: "services" },
  { id: "payments", label: "Payments", icon: "payments" },
  { id: "reviews", label: "Reviews", icon: "reviews" },
  { divider: true },
  { id: "ai", label: "AI", icon: "ai" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export default function AdminLayout({
  user, lang, active, onNavigate, onHome, children, title, subtitle,
}: {
  user: MockUser;
  lang: Lang;
  active: AdminSection;
  onNavigate: (section: AdminSection) => void;
  onHome: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = new Intl.DateTimeFormat(lang === "ua" ? "uk-UA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);

  const currentTime = new Intl.DateTimeFormat(lang === "ua" ? "uk-UA" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  const initial = (user.email || "A").charAt(0).toUpperCase();

  return (
    <main className="admin-shell-v3">
      <aside className="admin-sidebar-v3">
        <button type="button" className="admin-brand-v3" onClick={onHome}>
          <img
            src={beautyAISparkles}
            alt=""
            className="admin-brand-logo-v3"
            aria-hidden="true"
          />
          <span className="admin-brand-title-v3">
            BEAUTY AI <small>• ADMIN</small>
          </span>
        </button>

        <nav className="admin-nav-v3">
          {NAV.map((item, i) =>
            item.divider ? (
              <div key={`divider-${i}`} className="admin-nav-separator" />
            ) : (
              <button
                key={item.id}
                type="button"
                className={active === item.id ? "active" : ""}
                onClick={() => item.id && onNavigate(item.id)}
              >
                <span className="admin-nav-icon"><AdminIcon name={item.icon!} size={18} /></span>
                <span>{item.label}</span>
              </button>
            )
          )}
        </nav>

      </aside>

      <section className="admin-main-v3">
        <header className="admin-topbar-v3">
          <div className="admin-topbar-title-v3">
            {title && <h1>{title}</h1>}
            {subtitle && <p>{subtitle}</p>}
          </div>

          <div className="admin-topbar-right-v3">
            <div className="admin-topbar-date-v3">
              <AdminIcon name="calendar" size={17} />
              <strong>{today}</strong>
              <strong>{currentTime}</strong>
            </div>

            <div className="admin-topbar-user-v3">
              <div className="admin-user-avatar-v3">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name || "Administrator"} />
                ) : (
                  initial
                )}
              </div>
              <strong className="admin-user-name-v3">Administrator</strong>
            </div>
          </div>
        </header>

        <div className="admin-content-v3">{children}</div>
      </section>
    </main>
  );
}

import React from "react";
import beautyAISparkles from "../assets/beauty-ai-sparkles.svg";
import type { AuthRole, Lang, MockUser } from "./types";

export type StatCard = [string, string, string];
export type MasterSection = "home" | "finance" | "gallery" | "profile";

type DashboardFrameProps = {
  user: MockUser;
  lang: Lang;
  onHome: () => void;
  onRoleChange: (role: AuthRole) => void;
  title: string;
  cards?: StatCard[];
  children: React.ReactNode;
  variant?: "default" | "master";
  activeSection?: MasterSection;
  onSectionChange?: (section: MasterSection) => void;
};

export default function DashboardFrame({
  user,
  lang,
  onHome,
  onRoleChange,
  title,
  cards = [],
  children,
  variant = "default",
  activeSection = "home",
  onSectionChange,
}: DashboardFrameProps) {
  const ua = lang === "ua";
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const masterDate = React.useMemo(() => {
    if (ua) {
      const monthsGenitive = [
        "січня",
        "лютого",
        "березня",
        "квітня",
        "травня",
        "червня",
        "липня",
        "серпня",
        "вересня",
        "жовтня",
        "листопада",
        "грудня",
      ];

      return `${String(now.getDate()).padStart(2, "0")} ${monthsGenitive[now.getMonth()]} ${now.getFullYear()}`;
    }

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(now);
  }, [now, ua]);

  const masterTime = React.useMemo(
    () => new Intl.DateTimeFormat(ua ? "uk-UA" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(now),
    [now, ua]
  );

  if (variant === "master") {
    const nav = [
      ["home", "⌂", ua ? "Головна" : "Home"],
      ["finance", "₴", ua ? "Фінанси" : "Finance"],
      ["gallery", "▧", ua ? "Галерея" : "Gallery"],
      ["profile", "○", ua ? "Профіль" : "Profile"],
    ] as const;

    return (
      <main className="master-cabinet-v2">
        <aside className="master-sidebar-v2">
          <button className="master-brand-v2" type="button" onClick={onHome}>
            <img className="master-brand-logo-v2" src={beautyAISparkles} alt="" aria-hidden="true" />
            <span>Beauty <b>AI</b></span>
          </button>

          <nav className="master-nav-v2" aria-label={ua ? "Навігація кабінету" : "Account navigation"}>
            {nav.map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                className={activeSection === id ? "active" : ""}
                onClick={() => onSectionChange?.(id)}
              >
                <span className="master-nav-icon-v2">{icon}</span>{label}
              </button>
            ))}
          </nav>

          <button className="master-logout-v2" type="button" onClick={onHome}>↪ <span>{ua ? "Вийти" : "Log out"}</span></button>

          <div className="master-level-v2">
            <span className="master-level-icon-v2">♕</span>
            <div><b>{ua ? "Рівень Pro" : "Pro level"}</b><small>{ua ? "Майстер Beauty AI" : "Beauty AI master"}</small></div>
          </div>

          <footer className="master-sidebar-footer-v2">
            <p>© Beauty AI, 2026</p>
            <span>{ua ? "Усі права захищено" : "All rights reserved"}</span>
            <div className="master-socials-v2" aria-label={ua ? "Соціальні мережі" : "Social media"}>
              <button type="button" aria-label="Instagram">◎</button>
              <button type="button" aria-label="Facebook">f</button>
              <button type="button" aria-label="Telegram">➤</button>
            </div>
          </footer>
        </aside>

        <section className="master-workspace-v2">
          <header className="master-header-v2">
            <div className="master-header-title-v2">
              <h1>{title}</h1>
              {activeSection !== "home" && (
                <p>
                  {activeSection === "profile"
                    ? (ua ? "Налаштування акаунта" : "Account settings")
                    : activeSection === "gallery"
                      ? (ua ? "Публічний профіль та роботи" : "Public profile and portfolio")
                      : (ua ? "Доходи та виплати" : "Income and payouts")}
                </p>
              )}
            </div>
            <div className="master-header-actions-v2">
              <div className="master-datetime-v2" aria-label={ua ? "Поточні дата та час" : "Current date and time"}>
                <strong>{masterDate}</strong>
                <strong>{masterTime}</strong>
              </div>
              <button className="master-notification-v2" type="button" aria-label={ua ? "Сповіщення" : "Notifications"}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
              </button>
              <div className="master-user-v2"><img src={user.avatar} alt={user.name} /><div><b>{user.name}</b><small>{ua ? "Майстер" : "Master"}</small></div><span>⌄</span></div>
            </div>
          </header>
          <div className="master-content-v2">{children}</div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-topbar">
        <button className="dashboard-back" type="button" onClick={onHome}>← {ua ? "На головну" : "Home"}</button>
        <div className="dashboard-role-demo">
          {(["client", "master", "admin"] as AuthRole[]).map((role) => (
            <button key={role} className={user.role === role ? "active" : ""} type="button" onClick={() => onRoleChange(role)}>
              {role === "client" ? (ua ? "Клієнт" : "Client") : role === "master" ? (ua ? "Майстер" : "Master") : "Admin"}
            </button>
          ))}
        </div>
      </div>
      <section className="dashboard-hero">
        <div><span className="dashboard-kicker">✦ BEAUTY AI</span><h1>{title}</h1><p>{user.email}</p></div>
        <div className="dashboard-avatar"><img src={user.avatar} alt={user.name} /></div>
      </section>
      {cards.length > 0 && <section className="dashboard-stats">
        {cards.map(([cardTitle, value, caption]) => (
          <article className="dashboard-stat-card" key={cardTitle}><span>{cardTitle}</span><strong>{value}</strong><p>{caption}</p></article>
        ))}
      </section>}
      {children}
    </main>
  );
}

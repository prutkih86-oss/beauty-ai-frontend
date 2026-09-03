import React from "react";
import beautyAISparkles from "../assets/beauty-ai-sparkles.svg";
import type { AuthRole, Lang, MockUser } from "./types";

export type StatCard = [string, string, string];
export type MasterSection = "home" | "services" | "finance" | "gallery" | "profile";
export type MasterHeaderNotification = {
  id: string;
  title: string;
  text: string;
  createdAt: string;
  read: boolean;
  kind?: string;
  entityId?: string;
};

type DashboardFrameProps = {
  user: MockUser;
  lang: Lang;
  onHome: () => void;
  onLogout?: () => void;
  onRoleChange: (role: AuthRole) => void;
  title: string;
  cards?: StatCard[];
  children: React.ReactNode;
  variant?: "default" | "master";
  activeSection?: MasterSection;
  onSectionChange?: (section: MasterSection) => void;
  masterNotifications?: MasterHeaderNotification[];
  onMasterNotificationsChange?: (notifications: MasterHeaderNotification[]) => void;
  onMasterNotificationClick?: (notification: MasterHeaderNotification) => void;
};

export default function DashboardFrame({
  user,
  lang,
  onHome,
  onLogout,
  onRoleChange,
  title,
  cards = [],
  children,
  variant = "default",
  activeSection = "home",
  onSectionChange,
  masterNotifications = [],
  onMasterNotificationsChange,
  onMasterNotificationClick,
}: DashboardFrameProps) {
  const ua = lang === "ua";
  const [now, setNow] = React.useState(() => new Date());
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);
  const notificationsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const close = (event: MouseEvent) => {
      const node = event.target as Node;
      if (profileMenuOpen && !profileMenuRef.current?.contains(node)) setProfileMenuOpen(false);
      if (notificationsOpen && !notificationsRef.current?.contains(node)) setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [profileMenuOpen, notificationsOpen]);

  const masterDateTime = React.useMemo(() => {
    const date = new Intl.DateTimeFormat(ua ? "uk-UA" : "en-GB", { day: "2-digit", month: "short" }).format(now).replace(/\.$/, "");
    const time = new Intl.DateTimeFormat(ua ? "uk-UA" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(now);
    return `${date} · ${time}`;
  }, [now, ua]);

  if (variant === "master") {
    const nav = [
      ["home", "⌂", ua ? "Головна" : "Home"],
      ["services", "✦", ua ? "Послуги" : "Services"],
      ["finance", "₴", ua ? "Фінанси" : "Finance"],
      ["gallery", "▧", ua ? "Галерея" : "Gallery"],
      ["profile", "○", ua ? "Профіль" : "Profile"],
    ] as const;
    const unreadCount = masterNotifications.filter((item) => !item.read).length;

    const markNotificationsRead = () => {
      if (!unreadCount) return;
      onMasterNotificationsChange?.(masterNotifications.map((item) => ({ ...item, read: true })));
    };

    return (
      <main className="master-cabinet-v2">
        <aside className="master-sidebar-v2">
          <button className="master-brand-v2" type="button" onClick={onHome}>
            <img className="master-brand-logo-v2" src={beautyAISparkles} alt="" aria-hidden="true" />
            <span>Beauty <b>AI</b></span>
          </button>

          <nav className="master-nav-v2" aria-label={ua ? "Навігація кабінету" : "Account navigation"}>
            {nav.map(([id, icon, label]) => (
              <button key={id} type="button" className={activeSection === id ? "active" : ""} onClick={() => onSectionChange?.(id)}>
                <span className="master-nav-icon-v2">{icon}</span>{label}
              </button>
            ))}
          </nav>

          <button className="master-logout-v2" type="button" onClick={onHome}>↗ <span>{ua ? "На сайт" : "Website"}</span></button>

          <div className="master-level-v2"><span className="master-level-icon-v2">♕</span><div><b>{ua ? "Рівень Pro" : "Pro level"}</b><small>{ua ? "Майстер Beauty AI" : "Beauty AI master"}</small></div></div>

          <footer className="master-sidebar-footer-v2"><p>© Beauty AI, 2026</p><span>{ua ? "Усі права захищено" : "All rights reserved"}</span><div className="master-socials-v2"><button type="button" aria-label="Instagram">◎</button><button type="button" aria-label="Facebook">f</button><button type="button" aria-label="Telegram">➤</button></div></footer>
        </aside>

        <section className="master-workspace-v2">
          <header className="master-header-v2">
            <div className="master-header-title-v2">
              <h1>{title}</h1>
              {activeSection !== "home" && <p>{activeSection === "profile" ? (ua ? "Дані акаунта" : "Account data") : activeSection === "gallery" ? (ua ? "Публічний профіль та роботи" : "Public profile and portfolio") : activeSection === "services" ? (ua ? "Послуги, ціни та тривалість" : "Services, prices and duration") : (ua ? "Доходи та виплати" : "Income and payouts")}</p>}
            </div>

            <div className="master-header-actions-v2">
              <div className="master-datetime-v2" aria-label={ua ? "Поточні дата та час" : "Current date and time"}><strong>{masterDateTime}</strong></div>

              <div className="master-notification-wrap-v2" ref={notificationsRef}>
                <button className="master-notification-v2" type="button" aria-label={ua ? "Сповіщення" : "Notifications"} onClick={() => { setNotificationsOpen((open) => !open); setProfileMenuOpen(false); if (!notificationsOpen) markNotificationsRead(); }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
                  {unreadCount > 0 && <span className="master-notification-badge-v2">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                </button>
                {notificationsOpen && <div className="master-notifications-menu-v2"><div className="master-notifications-head-v2"><b>{ua ? "Сповіщення" : "Notifications"}</b><span>{masterNotifications.length}</span></div>{masterNotifications.length ? <div className="master-notifications-list-v2">{masterNotifications.slice(0, 12).map((item) => <button type="button" className="master-notification-item-v2" key={item.id} onClick={() => { onMasterNotificationClick?.(item); setNotificationsOpen(false); }}><b>{item.title}</b><p>{item.text}</p><span>{new Intl.DateTimeFormat(ua ? "uk-UA" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</span></button>)}</div> : <div className="master-notifications-empty-v2">{ua ? "Нових сповіщень немає" : "No notifications yet"}</div>}</div>}
              </div>

              <div className="master-user-menu-wrap-v2" ref={profileMenuRef}>
                <button className="master-user-v2" type="button" onClick={() => { setProfileMenuOpen((open) => !open); setNotificationsOpen(false); }} aria-expanded={profileMenuOpen}>
                  <img src={user.avatar} alt={user.name} /><div><b>{user.name}</b><small>{ua ? "Майстер" : "Master"}</small></div><span>⌄</span>
                </button>
                {profileMenuOpen && <div className="master-user-menu-v2"><button type="button" onClick={() => { onSectionChange?.("profile"); setProfileMenuOpen(false); }}>{ua ? "Профіль" : "Profile"}</button><button type="button" className="danger" onClick={() => { setProfileMenuOpen(false); onLogout?.(); }}>{ua ? "Вийти з акаунту" : "Log out"}</button></div>}
              </div>
            </div>
          </header>
          <div className="master-content-v2">{children}</div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-topbar"><button className="dashboard-back" type="button" onClick={onHome}>← {ua ? "На головну" : "Home"}</button><div className="dashboard-role-demo">{(["client", "master", "admin"] as AuthRole[]).map((role) => <button key={role} className={user.role === role ? "active" : ""} type="button" onClick={() => onRoleChange(role)}>{role === "client" ? (ua ? "Клієнт" : "Client") : role === "master" ? (ua ? "Майстер" : "Master") : "Admin"}</button>)}</div></div>
      <section className="dashboard-hero"><div><span className="dashboard-kicker">✦ BEAUTY AI</span><h1>{title}</h1><p>{user.email}</p></div><div className="dashboard-avatar"><img src={user.avatar} alt={user.name} /></div></section>
      {cards.length > 0 && <section className="dashboard-stats">{cards.map(([cardTitle, value, caption]) => <article className="dashboard-stat-card" key={cardTitle}><span>{cardTitle}</span><strong>{value}</strong><p>{caption}</p></article>)}</section>}
      {children}
    </main>
  );
}

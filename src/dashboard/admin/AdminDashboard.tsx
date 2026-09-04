import React, { useEffect, useState } from "react";
import type { AuthRole, Lang, MockUser } from "../types";
import AdminLayout, { type AdminSection } from "./AdminLayout";
import AdminHome from "./AdminHome";
import AdminAnalytics from "./AdminAnalytics";
import AdminMasters from "./AdminMasters";
import AdminSalons from "./AdminSalons";
import AdminClients from "./AdminClients";
import AdminBookings from "./AdminBookings";
import AdminServices from "./AdminServices";
import AdminPayments from "./AdminPayments";
import AdminReviews from "./AdminReviews";
import AdminAI from "./AdminAI";
import AdminSettings from "./AdminSettings";

const SECTION_TITLES: Record<AdminSection, { title: string; subtitle?: string }> = {
  dashboard: { title: "Dashboard" },
  analytics: { title: "Analytics" },
  masters: { title: "Masters" },
  salons: { title: "Salons" },
  clients: { title: "Clients" },
  bookings: { title: "Bookings" },
  services: { title: "Services" },
  payments: { title: "Payments" },
  reviews: { title: "Reviews" },
  ai: { title: "AI" },
  settings: { title: "Settings" },
};

export default function AdminDashboard({
  user,
  lang,
  onHome,
}: {
  user: MockUser;
  lang: Lang;
  onHome: () => void;
  onRoleChange: (role: AuthRole) => void;
}) {
  const [section, setSection] = useState<AdminSection>("dashboard");
  const { title, subtitle } = SECTION_TITLES[section];
  
  const page = {
    dashboard: <AdminHome onHome={onHome} />,
    analytics: <AdminAnalytics />,
    masters: <AdminMasters />,
    salons: <AdminSalons />,
    clients: <AdminClients />,
    bookings: <AdminBookings />,
    services: <AdminServices />,
    payments: <AdminPayments />,
    reviews: <AdminReviews />,
    ai: <AdminAI />,
    settings: <AdminSettings />,
  }[section];

  return (
    <AdminLayout
      user={user}
      lang={lang}
      active={section}
      onNavigate={setSection}
      onHome={onHome}
      title={title}
      subtitle={subtitle}
    >
      {page}
    </AdminLayout>
  );
}
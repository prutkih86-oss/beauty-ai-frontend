import { apiGet } from "./client";

export interface DashboardBooking {
  id: number | string;
  client: string;
  master: string;
  service: string;
  dateTime: string;
  status: string;
  price: number;
}

export interface DashboardData {
  anchorDate: Date;
  revenueCurrent: number;
  revenuePrevious: number;
  bookingsCurrent: number;
  bookingsPrevious: number;
  clientsCurrent: number;
  clientsPrevious: number;
  mastersCurrent: number;
  mastersPrevious: number;
  bookingsToday: number;
  completedToday: number;
  cancelledToday: number;
  noShowToday: number;
  recentBookings: DashboardBooking[];
  todaySchedule: DashboardBooking[];
  activeNow: DashboardBooking[];
}

interface RawSchedule {
  id?: number | string;
  client?: string;
  master?: string;
  service?: string;
  date_time?: string;
  status?: string;
  price?: number | string;
}

interface RawAdminDashboard {
  revenue_current?: number | string;
  revenue_previous?: number | string;
  bookings_current?: number;
  bookings_previous?: number;
  clients_current?: number;
  clients_previous?: number;
  masters_current?: number;
  masters_previous?: number;
  bookings_today?: number;
  completed_today?: number;
  cancelled_today?: number;
  no_show_today?: number;
  recent_bookings?: RawSchedule[];
  today_schedule?: RawSchedule[];
  active_now?: RawSchedule[];
}

function safeNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapBooking(item: RawSchedule): DashboardBooking {
  return {
    id: item.id ?? "N/A",
    client: item.client || "—",
    master: item.master || "—",
    service: item.service || "—",
    dateTime: item.date_time || "",
    status: item.status || "Pending",
    price: safeNumber(item.price),
  };
}

function resolveAnchorDate(data: RawAdminDashboard): Date {
  const dates = [
    ...(data.recent_bookings ?? []),
    ...(data.today_schedule ?? []),
    ...(data.active_now ?? []),
  ]
    .map((item) => (item.date_time ? new Date(item.date_time) : null))
    .filter((item): item is Date => item !== null && !Number.isNaN(item.getTime()));

  if (!dates.length) return new Date();
  return new Date(Math.max(...dates.map((item) => item.getTime())));
}

export function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

let dashboardDataPromise: Promise<DashboardData> | null = null;

export async function getDashboardData(
  forceRefresh = false
): Promise<DashboardData> {
  if (forceRefresh) dashboardDataPromise = null;
  if (dashboardDataPromise) return dashboardDataPromise;

  dashboardDataPromise = apiGet<RawAdminDashboard>("/api/admin/dashboard/")
    .then((data) => ({
      anchorDate: resolveAnchorDate(data),
      revenueCurrent: safeNumber(data.revenue_current),
      revenuePrevious: safeNumber(data.revenue_previous),
      bookingsCurrent: safeNumber(data.bookings_current),
      bookingsPrevious: safeNumber(data.bookings_previous),
      clientsCurrent: safeNumber(data.clients_current),
      clientsPrevious: safeNumber(data.clients_previous),
      mastersCurrent: safeNumber(data.masters_current),
      mastersPrevious: safeNumber(data.masters_previous),
      bookingsToday: safeNumber(data.bookings_today),
      completedToday: safeNumber(data.completed_today),
      cancelledToday: safeNumber(data.cancelled_today),
      noShowToday: safeNumber(data.no_show_today),
      recentBookings: (data.recent_bookings ?? []).map(mapBooking),
      todaySchedule: (data.today_schedule ?? []).map(mapBooking),
      activeNow: (data.active_now ?? []).map(mapBooking),
    }))
    .catch((error) => {
      dashboardDataPromise = null;
      throw error;
    });

  return dashboardDataPromise;
}

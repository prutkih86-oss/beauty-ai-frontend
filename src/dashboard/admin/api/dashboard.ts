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

interface Page<T> {
  results?: T[];
  next?: string | null;
}

interface RawAppointment {
  id?: number | string;
  appointment_id?: number | string;
  client_name?: string;
  master_name?: string;
  service_name?: string;
  appointment_date?: string;
  appointment_time?: string;
  appointment_status?: string;
  status?: string;
  total_price?: number | string;
  price?: number | string;
}

function safeDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function mapBooking(item: RawAppointment): DashboardBooking {
  return {
    id: item.id ?? item.appointment_id ?? "N/A",
    client: item.client_name || "—",
    master: item.master_name || "—",
    service: item.service_name || "—",
    dateTime: `${item.appointment_date || ""} ${item.appointment_time || ""}`.trim(),
    status: item.appointment_status || item.status || "Pending",
    price: safeNumber(item.total_price ?? item.price),
  };
}

function unwrap<T>(data: T[] | Page<T>): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

export function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export async function getDashboardData(): Promise<DashboardData> {
  // Lightweight dashboard:
  // only 3 appointment pages for visual blocks.
  // Full 30-day KPI aggregation must come from backend later.
  const pages = await Promise.all([
    apiGet<RawAppointment[] | Page<RawAppointment>>("/api/appointments/?page=1"),
    apiGet<RawAppointment[] | Page<RawAppointment>>("/api/appointments/?page=2"),
    apiGet<RawAppointment[] | Page<RawAppointment>>("/api/appointments/?page=3"),
  ]);

  const bookings = pages.flatMap(unwrap).map(mapBooking);

  const parsed = bookings
    .map((booking) => ({ booking, date: safeDate(booking.dateTime) }))
    .filter((x): x is { booking: DashboardBooking; date: Date } => x.date !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const anchorDate = parsed.length ? parsed[0].date : new Date();
  const anchorDay = anchorDate.toISOString().slice(0, 10);

  const todayPairs = parsed.filter(
    (x) => x.date.toISOString().slice(0, 10) === anchorDay
  );

  const status = (value: string) => value.trim().toLowerCase();

  const activeNow = todayPairs
    .filter((x) =>
      ["in_progress", "in progress"].includes(status(x.booking.status))
    )
    .map((x) => x.booking);

  return {
    anchorDate,

    // Intentionally not calculated on frontend anymore.
    // Backend summary endpoint should provide these later.
    revenueCurrent: 0,
    revenuePrevious: 0,
    bookingsCurrent: 0,
    bookingsPrevious: 0,
    clientsCurrent: 0,
    clientsPrevious: 0,
    mastersCurrent: 0,
    mastersPrevious: 0,

    bookingsToday: todayPairs.length,
    completedToday: todayPairs.filter(
      (x) => status(x.booking.status) === "completed"
    ).length,
    cancelledToday: todayPairs.filter(
      (x) => status(x.booking.status) === "cancelled"
    ).length,
    noShowToday: todayPairs.filter((x) =>
      ["no-show", "no show", "noshow"].includes(status(x.booking.status))
    ).length,

    recentBookings: parsed.slice(0, 30).map((x) => x.booking),
    todaySchedule: [...todayPairs]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((x) => x.booking),
    activeNow,
  };
}

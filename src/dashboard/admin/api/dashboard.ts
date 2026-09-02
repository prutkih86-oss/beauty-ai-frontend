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

interface Page<T> { results?: T[]; next?: string | null }
interface RawAppointment {
  id?: number | string; appointment_id?: number | string;
  client_name?: string; master_name?: string; service_name?: string;
  appointment_date?: string; appointment_time?: string;
  appointment_status?: string; status?: string;
  total_price?: number | string; price?: number | string;
}
interface RawClient { date_joined?: string; registration_date_user?: string }

async function getAllPages<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const data = await apiGet<T[] | Page<T>>(`${path}${separator}page=${page}`);
    if (Array.isArray(data)) {
      rows.push(...data);
      break;
    }
    rows.push(...(data.results || []));
    if (!data.next) break;
  }
  return rows;
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

export function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export async function getDashboardData(): Promise<DashboardData> {
  const [appointments, clients] = await Promise.all([
    getAllPages<RawAppointment>("/api/appointments/"),
    getAllPages<RawClient>("/api/users/clients/"),
  ]);

  const bookings = appointments.map(mapBooking);
  const parsed = bookings
    .map((booking) => ({ booking, date: safeDate(booking.dateTime) }))
    .filter((x): x is { booking: DashboardBooking; date: Date } => x.date !== null);

  // Exact behavior of the original Python dashboard:
  // "today" is the newest booking date when bookings exist.
  const anchorDate = parsed.length
    ? new Date(Math.max(...parsed.map((x) => x.date.getTime())))
    : new Date();

  const currentStart = new Date(anchorDate);
  currentStart.setDate(currentStart.getDate() - 29);

  const previousEnd = new Date(currentStart.getTime() - 1000);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - 29);

  const inRange = (date: Date, start: Date, end: Date) => date >= start && date <= end;

  const current = parsed.filter((x) => inRange(x.date, currentStart, anchorDate));
  const previous = parsed.filter((x) => inRange(x.date, previousStart, previousEnd));

  let clientsCurrent = 0;
  let clientsPrevious = 0;
  clients.forEach((client) => {
    const joined = safeDate(client.date_joined || client.registration_date_user);
    if (!joined) return;
    if (inRange(joined, currentStart, anchorDate)) clientsCurrent += 1;
    else if (inRange(joined, previousStart, previousEnd)) clientsPrevious += 1;
  });

  const currentMasterNames = new Set(current.map((x) => x.booking.master).filter((x) => x && x !== "—"));
  const previousMasterNames = new Set(previous.map((x) => x.booking.master).filter((x) => x && x !== "—"));

  const anchorDay = anchorDate.toISOString().slice(0, 10);
  const todayPairs = parsed.filter((x) => x.date.toISOString().slice(0, 10) === anchorDay);
  const status = (value: string) => value.trim().toLowerCase();

  const activeNow: DashboardBooking[] = todayPairs
    .filter((x) => ["in_progress", "in progress"].includes(status(x.booking.status)))
    .map((x) => x.booking);

  return {
    anchorDate,
    revenueCurrent: current.reduce((sum, x) => sum + x.booking.price, 0),
    revenuePrevious: previous.reduce((sum, x) => sum + x.booking.price, 0),
    bookingsCurrent: current.length,
    bookingsPrevious: previous.length,
    clientsCurrent,
    clientsPrevious,
    mastersCurrent: currentMasterNames.size,
    mastersPrevious: previousMasterNames.size,
    bookingsToday: todayPairs.length,
    completedToday: todayPairs.filter((x) => status(x.booking.status) === "completed").length,
    cancelledToday: todayPairs.filter((x) => status(x.booking.status) === "cancelled").length,
    noShowToday: todayPairs.filter((x) => ["no-show", "no show", "noshow"].includes(status(x.booking.status))).length,
    recentBookings: [...parsed].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 30).map((x) => x.booking),
    todaySchedule: [...todayPairs].sort((a, b) => a.date.getTime() - b.date.getTime()).map((x) => x.booking),
    activeNow,
  };
}
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

interface RawAppointment {
  id?: number | string;
  appointment_id?: number | string;
  client_name?: string;
  master_name?: string;
  service_name?: string;
  appointment_date?: string;
  appointment_time?: string;
  date_time?: string;
  start?: string;
  appointment_status?: string;
  status?: string;
  total_price?: number | string;
  price?: number | string;
}

interface AppointmentPage {
  results?: RawAppointment[];
  next?: string | null;
}

function safeNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseAppointmentDate(item: RawAppointment): Date | null {
  const direct = item.date_time || item.start;

  if (direct) {
    const date = new Date(direct);
    if (!Number.isNaN(date.getTime())) return date;
  }

  if (!item.appointment_date) return null;

  const rawTime = item.appointment_time || "00:00:00";
  const date = new Date(`${item.appointment_date}T${rawTime}`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function mapBooking(item: RawAppointment): DashboardBooking {
  const date = parseAppointmentDate(item);

  return {
    id: item.id ?? item.appointment_id ?? "N/A",
    client: item.client_name || "—",
    master: item.master_name || "—",
    service: item.service_name || "—",
    dateTime: date ? date.toISOString() : "",
    status: item.appointment_status || item.status || "Pending",
    price: safeNumber(item.total_price ?? item.price),
  };
}

function normalizeApiPath(urlOrPath: string): string {
  try {
    const url = new URL(urlOrPath);
    return `${url.pathname}${url.search}`;
  } catch {
    return urlOrPath;
  }
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function inRange(date: Date, from: Date, to: Date) {
  return date >= from && date <= to;
}

function statusValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
}

function uniqueCount(values: string[]) {
  return new Set(values.filter((value) => value && value !== "—")).size;
}

export function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

async function loadHistoricalWindow(): Promise<{
  anchorDate: Date;
  rows: Array<{ raw: RawAppointment; date: Date; booking: DashboardBooking }>;
}> {
  // Першу сторінку беремо окремо, щоб визначити anchorDate.
  const first = await apiGet<AppointmentPage>(
    "/api/appointments/?ordering=-start&page=1"
  );

  const parseRows = (items: RawAppointment[]) =>
    items
      .map((raw) => {
        const date = parseAppointmentDate(raw);
        return date ? { raw, date, booking: mapBooking(raw) } : null;
      })
      .filter(
        (
          item
        ): item is {
          raw: RawAppointment;
          date: Date;
          booking: DashboardBooking;
        } => item !== null
      );

  const rows = parseRows(first.results ?? []);
  const anchorDate = rows[0]?.date ?? new Date();
  const cutoffDate = startOfDay(addDays(anchorDate, -59));

  if (!first.next) {
    return { anchorDate, rows };
  }

  // Backend page size зараз 10. Вантажимо сторінки пакетами паралельно,
  // замість одного HTTP-запиту за іншим.
  const BATCH_SIZE = 12;
  const MAX_BACKEND_PAGES = 250;
  let nextPage = 2;
  let done = false;

  while (!done && nextPage <= MAX_BACKEND_PAGES) {
    const pageNumbers = Array.from(
      { length: Math.min(BATCH_SIZE, MAX_BACKEND_PAGES - nextPage + 1) },
      (_, index) => nextPage + index
    );

    const pages = await Promise.all(
      pageNumbers.map((page) =>
        apiGet<AppointmentPage>(
          `/api/appointments/?ordering=-start&page=${page}`
        )
      )
    );

    for (const page of pages) {
      const pageRows = parseRows(page.results ?? []);
      rows.push(...pageRows);

      const oldestOnPage =
        pageRows.length > 0
          ? pageRows.reduce(
              (oldest, item) => (item.date < oldest ? item.date : oldest),
              pageRows[0].date
            )
          : null;

      if (!page.next || (oldestOnPage && oldestOnPage < cutoffDate)) {
        done = true;
        break;
      }
    }

    nextPage += BATCH_SIZE;
  }

  return {
    anchorDate,
    rows: rows
      .filter(
        (item) =>
          item.date >= cutoffDate &&
          item.date <= endOfDay(anchorDate)
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime()),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const { anchorDate, rows: parsed } = await loadHistoricalWindow();

  const currentEnd = endOfDay(anchorDate);
  const currentStart = startOfDay(addDays(anchorDate, -29));
  const previousEnd = endOfDay(addDays(currentStart, -1));
  const previousStart = startOfDay(addDays(currentStart, -30));

  const current = parsed.filter((item) =>
    inRange(item.date, currentStart, currentEnd)
  );

  const previous = parsed.filter((item) =>
    inRange(item.date, previousStart, previousEnd)
  );

  const anchorDayStart = startOfDay(anchorDate);
  const anchorDayEnd = endOfDay(anchorDate);

  const todayPairs = parsed.filter((item) =>
    inRange(item.date, anchorDayStart, anchorDayEnd)
  );

  // Для dashboard "New Clients" рахуємо клієнтів, яких не було
  // у попередньому 30-денному вікні, але вони є в поточному.
  const previousClients = new Set(
    previous
      .map((item) => item.booking.client)
      .filter((client) => client && client !== "—")
  );

  const currentClients = new Set(
    current
      .map((item) => item.booking.client)
      .filter((client) => client && client !== "—")
  );

  const newClientsCurrent = [...currentClients].filter(
    (client) => !previousClients.has(client)
  ).length;

  const clientsPrevious = previousClients.size;

  return {
    anchorDate,

    revenueCurrent: current.reduce((sum, item) => sum + item.booking.price, 0),
    revenuePrevious: previous.reduce(
      (sum, item) => sum + item.booking.price,
      0
    ),

    bookingsCurrent: current.length,
    bookingsPrevious: previous.length,

    clientsCurrent: newClientsCurrent,
    clientsPrevious,

    mastersCurrent: uniqueCount(current.map((item) => item.booking.master)),
    mastersPrevious: uniqueCount(previous.map((item) => item.booking.master)),

    bookingsToday: todayPairs.length,
    completedToday: todayPairs.filter(
      (item) => statusValue(item.booking.status) === "completed"
    ).length,
    cancelledToday: todayPairs.filter(
      (item) => statusValue(item.booking.status) === "cancelled"
    ).length,
    noShowToday: todayPairs.filter(
      (item) => statusValue(item.booking.status) === "no_show"
    ).length,

    recentBookings: parsed.slice(0, 30).map((item) => item.booking),

    todaySchedule: [...todayPairs]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((item) => item.booking),

    activeNow: todayPairs
      .filter((item) => statusValue(item.booking.status) === "in_progress")
      .map((item) => item.booking),
  };
}

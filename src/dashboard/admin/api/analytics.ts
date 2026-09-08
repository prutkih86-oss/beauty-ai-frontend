import { apiGet } from "./client";

export type AnalyticsPeriod = "Last 7 days" | "Last 30 days" | "Last 90 days" | "This year";

export interface AnalyticsBooking {
  id: number | string;
  client: string;
  master: string;
  salon: string;
  city: string;
  service: string;
  date: Date;
  status: string;
  price: number;
}

export interface AnalyticsMaster {
  name: string;
  specialization: string;
  city: string;
  rating: number;
}

export interface AnalyticsPayment {
  date: Date;
  amount: number;
  method: string;
}

export interface AnalyticsSourceData {
  bookings: AnalyticsBooking[];
  masters: AnalyticsMaster[];
  payments: AnalyticsPayment[];
}

interface Page<T> {
  results?: T[];
  next?: string | null;
}

type Raw = Record<string, unknown>;

let analyticsSourcePromise: Promise<AnalyticsSourceData> | null = null;

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
    if (!data.next) {
      break;
    }
  }

  return rows;
}

function text(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function date(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function bookingDate(item: Raw): Date | null {
  const direct = item.date_time ?? item.datetime ?? item.booking_time;
  if (direct) {
    return date(direct);
  }

  const appointmentDate = text(item.appointment_date, "");
  const appointmentTime = text(item.appointment_time, "");
  return date(`${appointmentDate} ${appointmentTime}`.trim());
}

function fullName(item: Raw): string {
  const combined = `${text(item.first_name, "")} ${text(item.last_name, "")}`.trim();
  return combined || text(item.name ?? item.master_name ?? item.email);
}

function masterSpecialization(item: Raw): string {
  const direct = text(item.specialization ?? item.category, "");
  if (direct) {
    return direct;
  }

  const services = Array.isArray(item.services) ? item.services : [];
  const firstService = services[0];

  if (firstService && typeof firstService === "object") {
    const row = firstService as Raw;
    return text(row.category ?? row.name, "—");
  }

  return "—";
}

function cityName(value: unknown): string {
  if (value && typeof value === "object") {
    const row = value as Raw;
    return text(row.city_name ?? row.name, "N/A");
  }
  return text(value, "N/A");
}

export async function getAnalyticsSourceData(): Promise<AnalyticsSourceData> {
  if (analyticsSourcePromise) {
    return analyticsSourcePromise;
  }

  analyticsSourcePromise = (async () => {
  const [appointments, mastersRaw, salonsRaw, paymentsRaw] = await Promise.all([
    getAllPages<Raw>("/api/appointments/"),
    getAllPages<Raw>("/api/users/masters/"),
    getAllPages<Raw>("/api/salons/"),
    getAllPages<Raw>("/api/payments/").catch(() => [] as Raw[]),
  ]);

  const salonCities = new Map(
    salonsRaw.map((item) => [
      text(item.name),
      cityName(item.location),
    ])
  );

  const bookings = appointments.flatMap((item): AnalyticsBooking[] => {
    const parsedDate = bookingDate(item);
    if (!parsedDate) {
      return [];
    }

    const salon = text(item.salon_name);

    return [{
      id: (item.id ?? item.appointment_id ?? "N/A") as number | string,
      client: text(item.client_name),
      master: text(item.master_name),
      salon,
      city: salonCities.get(salon) || "N/A",
      service: text(item.service_name),
      date: parsedDate,
      status: text(item.appointment_status ?? item.status, "Pending"),
      price: number(item.total_price ?? item.price),
    }];
  });

  const masters = mastersRaw.map((item): AnalyticsMaster => ({
    name: fullName(item),
    specialization: masterSpecialization(item),
    city: cityName(item.city ?? item.location),
    rating: number(item.average_rating ?? item.rating),
  }));

  const payments = paymentsRaw.flatMap((item): AnalyticsPayment[] => {
    const parsedDate = date(item.payment_date ?? item.created_at ?? item.date);
    if (!parsedDate) {
      return [];
    }

    return [{
      date: parsedDate,
      amount: number(item.amount ?? item.total ?? item.price),
      method: text(item.payment_method ?? item.method ?? item.type, "Unknown"),
    }];
  });

  return { bookings, masters, payments };
  })().catch((error) => {
    analyticsSourcePromise = null;
    throw error;
  });

  return analyticsSourcePromise;
}

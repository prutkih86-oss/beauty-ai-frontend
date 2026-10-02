import { apiDelete, apiGet, apiGetPageSlice } from "./client";

export interface ReviewRow {
  id: number | string;
  client: string;
  master: string;
  service: string;
  rating: number;
  date: string;
}

interface RawPerson {
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface RawService {
  name?: string;
  service_name?: string;
}

interface RawAppointment {
  id?: number | string;
  appointment_id?: number | string;
  client_name?: string;
  master_name?: string;
  service?: RawService | string;
  service_name?: string;
}

type AppointmentPage = {
  next?: string | null;
  results?: RawAppointment[];
};

const appointmentCache = new Map<string, RawAppointment>();
let appointmentScanNextPath: string | null = "/api/appointments/";
let appointmentScanComplete = false;

function normalizeApiPath(urlOrPath: string): string {
  try {
    const url = new URL(urlOrPath);
    return `${url.pathname}${url.search}`;
  } catch {
    return urlOrPath;
  }
}

async function getAppointmentsByIds(
  appointmentIds: Array<number | string>
): Promise<Map<string, RawAppointment>> {
  const wanted = new Set(appointmentIds.map((id) => String(id)));

  for (const id of [...wanted]) {
    if (appointmentCache.has(id)) {
      wanted.delete(id);
    }
  }

  while (wanted.size > 0 && appointmentScanNextPath && !appointmentScanComplete) {
    const page = await apiGet<AppointmentPage>(appointmentScanNextPath);

    for (const appointment of page.results ?? []) {
      const appointmentId = appointment.appointment_id ?? appointment.id;
      if (appointmentId === undefined || appointmentId === null) continue;

      const key = String(appointmentId);
      appointmentCache.set(key, appointment);
      wanted.delete(key);
    }

    if (page.next) {
      appointmentScanNextPath = normalizeApiPath(page.next);
    } else {
      appointmentScanNextPath = null;
      appointmentScanComplete = true;
    }
  }

  const result = new Map<string, RawAppointment>();
  appointmentIds.forEach((id) => {
    const appointment = appointmentCache.get(String(id));
    if (appointment) result.set(String(id), appointment);
  });

  return result;
}

interface RawReview {
  id?: number | string;
  client?: RawPerson | string | number;
  user?: RawPerson | string;
  author?: RawPerson | string;
  client_name?: string;
  master?: RawPerson | string | number;
  master_name?: string;
  appointment?: RawAppointment | number | string;
  booking?: RawAppointment | number | string;
  service?: RawService | string;
  service_name?: string;
  rating?: number | string;
  stars?: number | string;
  created_at?: string;
  review_date?: string;
  date?: string;
}

export type ReviewsPage = {
  reviews: ReviewRow[];
  count: number;
};

function personName(
  data: RawPerson | string | number | undefined,
  fallback?: string
): string {
  if (typeof data === "object" && data) {
    return (
      `${data.first_name || ""} ${data.last_name || ""}`.trim() ||
      data.email ||
      fallback ||
      "N/A"
    );
  }

  return fallback || (data !== undefined && data !== null ? String(data) : "N/A");
}

function serviceName(
  data: RawService | string | undefined,
  fallback?: string
): string {
  if (typeof data === "object" && data) {
    return data.name || data.service_name || fallback || "N/A";
  }

  return fallback || data || "N/A";
}

function mapReview(
  item: RawReview,
  appointmentLookup?: Map<string, RawAppointment>
): ReviewRow {
  const appointmentRaw = item.appointment ?? item.booking;

  let appointment: RawAppointment | undefined;

  if (typeof appointmentRaw === "object" && appointmentRaw) {
    appointment = appointmentRaw;
  } else if (
    appointmentRaw !== undefined &&
    appointmentRaw !== null &&
    appointmentLookup
  ) {
    appointment = appointmentLookup.get(String(appointmentRaw));
  }

  const client =
    appointment?.client_name ||
    personName(item.client || item.user || item.author, item.client_name);

  const master =
    appointment?.master_name ||
    personName(item.master, item.master_name);

  const service = appointment
    ? serviceName(appointment.service, appointment.service_name)
    : serviceName(item.service, item.service_name);

  const dateRaw = item.created_at || item.review_date || item.date;

  return {
    id: item.id ?? "N/A",
    client,
    master,
    service,
    rating: Number(item.rating ?? item.stars ?? 0) || 0,
    date: dateRaw ? String(dateRaw).slice(0, 10) : "—",
  };
}

export async function getReviewsPage(
  page: number,
  pageSize = 15
): Promise<ReviewsPage> {
  const data = await apiGetPageSlice<RawReview>(
    "/api/reviews/",
    page,
    pageSize
  );

  const appointmentIds = data.items
    .map((item) => item.appointment ?? item.booking)
    .filter(
      (appointment): appointment is number | string =>
        appointment !== undefined &&
        appointment !== null &&
        typeof appointment !== "object"
    );

  let appointmentLookup = new Map<string, RawAppointment>();

  if (appointmentIds.length > 0) {
    try {
      appointmentLookup = await getAppointmentsByIds(appointmentIds);
    } catch {
      // Reviews still render even if appointment enrichment fails.
    }
  }

  return {
    reviews: data.items.map((item) => mapReview(item, appointmentLookup)),
    count: data.count,
  };
}

export function deleteReview(id: number | string) {
  return apiDelete(`/api/reviews/${id}/`);
}

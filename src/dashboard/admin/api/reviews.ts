import { apiDelete, apiGet } from "./client";

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
  service?: RawService | string;
  service_name?: string;
}

interface RawReview {
  id?: number | string;
  client?: RawPerson | string;
  user?: RawPerson | string;
  author?: RawPerson | string;
  client_name?: string;
  master?: RawPerson | string;
  master_name?: string;
  appointment?: RawAppointment;
  booking?: RawAppointment;
  service?: string;
  service_name?: string;
  rating?: number | string;
  stars?: number | string;
  created_at?: string;
  review_date?: string;
  date?: string;
}

function unwrap<T>(data: T[] | { results?: T[] }): T[] {
  return Array.isArray(data) ? data : data.results || [];
}

function personName(
  data: RawPerson | string | undefined,
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
  return fallback || (data ? String(data) : "N/A");
}

export async function getReviews(
  search = "",
  rating = "All"
): Promise<ReviewRow[]> {
  const data = await apiGet<RawReview[] | { results?: RawReview[] }>(
    "/api/reviews/"
  );

  const q = search.toLowerCase();

  return unwrap(data)
    .map((item): ReviewRow => {
      const appointment = item.appointment || item.booking;
      let service = item.service_name || item.service || "N/A";

      if (appointment) {
        const serviceObj = appointment.service || appointment.service_name;
        if (typeof serviceObj === "object" && serviceObj) {
          service = serviceObj.name || serviceObj.service_name || "N/A";
        } else if (serviceObj) {
          service = String(serviceObj);
        }
      }

      const dateRaw = item.created_at || item.review_date || item.date;

      return {
        id: item.id ?? "N/A",
        client: personName(
          item.client || item.user || item.author,
          item.client_name
        ),
        master: personName(item.master, item.master_name),
        service: String(service),
        rating: Number(item.rating ?? item.stars ?? 0) || 0,
        date: dateRaw ? String(dateRaw).slice(0, 10) : "—",
      };
    })
    .filter(
      (r: ReviewRow) =>
        (!q ||
          `${r.client} ${r.master} ${r.service}`.toLowerCase().includes(q)) &&
        (rating === "All" || r.rating === Number(rating))
    );
}

export function deleteReview(id: number | string) {
  return apiDelete(`/api/reviews/${id}/`);
}

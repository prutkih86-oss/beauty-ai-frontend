import { apiGet } from "./client";

export interface ServiceRow {
  id: number | string;
  name: string;
  category: string;
  duration: number;
  price: number;
  masters: string;
  bookings: number;
}

interface RawMaster {
  id?: number | string;
  name?: string;
  full_name?: string;
}

interface RawService {
  id?: number | string;
  name?: string;
  category?: string;
  duration_minutes?: number | string;
  price?: number | string;
  masters?: RawMaster[] | Array<number | string> | string;
}

function unwrap<T>(data: T[] | { results?: T[] }): T[] {
  return Array.isArray(data) ? data : data.results || [];
}

export async function getServices(
  search = "",
  category = "All"
): Promise<ServiceRow[]> {
  const params = new URLSearchParams();
  if (search) params.set("service_name", search);
  if (category !== "All") params.set("category", category);

  const qs = params.toString();
  const data = await apiGet<RawService[] | { results?: RawService[] }>(
    `/api/services/${qs ? `?${qs}` : ""}`
  );

  return unwrap(data).map((item): ServiceRow => {
    let masters = "—";

    if (Array.isArray(item.masters)) {
      const names = item.masters.map((m) => {
        if (typeof m === "object" && m) {
          return m.name || m.full_name || String(m.id ?? "");
        }
        return String(m);
      });
      masters = names.filter(Boolean).join(", ") || "—";
    } else if (item.masters) {
      masters = String(item.masters);
    }

    return {
      id: item.id ?? "N/A",
      name: item.name || "Unknown Service",
      category: item.category || "—",
      duration: Number(item.duration_minutes ?? 0) || 0,
      price: Number(item.price ?? 0) || 0,
      masters,
      // Original API adapter cannot derive bookings count from this endpoint.
      bookings: 0,
    };
  });
}

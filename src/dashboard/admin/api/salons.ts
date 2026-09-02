import { apiDelete, apiGet, apiPost, apiPut } from "./client";

export interface SalonRow {
  id: number | string;
  name: string;
  city: string;
  address: string;
  popularityScore: number;
}

interface RawSalon {
  id?: number | string;
  name?: string;
  city?: string;
  address?: string;
}

function unwrap<T>(data: T[] | { results?: T[] }): T[] {
  return Array.isArray(data) ? data : data.results || [];
}

export async function getSalons(search = ""): Promise<SalonRow[]> {
  const data = await apiGet<RawSalon[] | { results?: RawSalon[] }>(
    "/api/salons/"
  );

  const q = search.toLowerCase();

  return unwrap(data)
    .map(
      (item): SalonRow => ({
        id: item.id ?? "N/A",
        name: item.name || "",
        city: item.city || "",
        address: item.address || "",
        // Original API adapter sets this to 0 because backend does not expose it.
        popularityScore: 0,
      })
    )
    .filter(
      (s: SalonRow) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q)
    );
}

export function addSalon(name: string, city: string, address: string) {
  return apiPost("/api/salons/", {
    name: name.trim(),
    city: city.trim(),
    address: address.trim(),
  });
}

export function updateSalon(
  id: number | string,
  city: string,
  address: string
) {
  return apiPut(`/api/salons/${id}/`, {
    city: city.trim(),
    address: address.trim(),
  });
}

export function deleteSalon(id: number | string) {
  return apiDelete(`/api/salons/${id}/`);
}

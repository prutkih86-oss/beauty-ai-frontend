import {
  apiDelete,
  apiGetAllPages,
  apiGetPageSlice,
  apiPost,
  apiPut,
} from "./client";

export interface SalonRow {
  id: number | string;
  name: string;
  city: string;
  address: string;
  popularityScore: number;
}

interface RawSalonLocation {
  city_name?: string;
  address?: string | null;
}

interface RawSalon {
  id?: number | string;
  name?: string;
  location?: RawSalonLocation | null;
}

export type SalonsPage = {
  salons: SalonRow[];
  count: number;
};

function mapSalon(item: RawSalon): SalonRow {
  return {
    id: item.id ?? "N/A",
    name: item.name || "",
    city: item.location?.city_name || "N/A",
    address: item.location?.address || "",
    popularityScore: 0,
  };
}

export async function getSalons(): Promise<SalonRow[]> {
  const results = await apiGetAllPages<RawSalon>("/api/salons/");
  return results.map(mapSalon);
}

export async function getSalonsPage(
  page: number,
  pageSize = 15
): Promise<SalonsPage> {
  const data = await apiGetPageSlice<RawSalon>(
    "/api/salons/",
    page,
    pageSize
  );

  return {
    salons: data.items.map(mapSalon),
    count: data.count,
  };
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

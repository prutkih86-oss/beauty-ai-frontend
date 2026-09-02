import { apiGet, apiPost } from "./client";

export interface MasterRow {
  name: string;
  specialization: string;
  rating: number;
  city: string;
  bookings: number;
  revenue: number;
  isSolo: boolean;
}

interface RawMaster {
  first_name?: string;
  last_name?: string;
  email?: string;
  specialization?: string;
  services?: Array<{ category?: string; name?: string }>;
  salons?: Array<{ city?: string; address?: string }>;
  average_rating?: number;
  rating?: number;
  bookings_count?: number;
  total_revenue?: number;
}

function mapMaster(item: RawMaster): MasterRow {
  const name = `${item.first_name || ""} ${item.last_name || ""}`.trim() || item.email || "Unknown Master";

  let specialization = item.specialization || "";
  if (!specialization && item.services?.length) {
    specialization = item.services[0].category || item.services[0].name || "General";
  }
  if (!specialization) specialization = "General";

  const salon = item.salons?.[0];
  const city = salon?.city || salon?.address || "N/A";

  return {
    name,
    specialization,
    rating: Number(item.average_rating ?? item.rating ?? 0),
    city,
    bookings: Number(item.bookings_count ?? 0),
    revenue: Number(item.total_revenue ?? 0),
    isSolo: !item.salons?.length,
  };
}

export async function getMasters(search = "", category = "All"): Promise<MasterRow[]> {
  const data = await apiGet<RawMaster[] | { results: RawMaster[] }>("/api/users/masters/");
  const results = Array.isArray(data) ? data : data.results || [];

  return results
    .map(mapMaster)
    .filter((m: MasterRow) =>
      (!search || m.name.toLowerCase().includes(search.toLowerCase())) &&
      (category === "All" || m.specialization.toLowerCase().includes(category.toLowerCase()))
    );
}

export async function addMaster(name: string, specialization: string, city: string, address: string, isSolo: boolean) {
  const [first_name, ...rest] = name.trim().split(" ");
  await apiPost("/api/users/masters/", {
    first_name,
    last_name: rest.join(" "),
    specialization,
    city,
    address,
    is_solo: isSolo,
  });
}
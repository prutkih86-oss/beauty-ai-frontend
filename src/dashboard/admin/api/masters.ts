import { apiGetPageSlice, apiPost } from "./client";
import { getSalons } from "./salons";

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
  id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  specialization?: string;
  services?: Array<{ category?: string; name?: string }>;
  salons?: Array<{ id?: number; name?: string }>;
  workplace?: {
    city_name?: string;
    address?: string | null;
    district?: string | null;
    region?: string | null;
    country?: string;
  } | null;
  average_rating?: number;
  rating?: number;
  bookings_count?: number;
  total_revenue?: number;
}

export type MastersPage = {
  masters: MasterRow[];
  count: number;
};

function mapMaster(
  item: RawMaster,
  cityBySalonId: Map<number, string>
): MasterRow {
  const name =
    `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
    item.email ||
    "Unknown Master";

  let specialization = item.specialization || "";
  if (!specialization && item.services?.length) {
    specialization =
      item.services[0].category ||
      item.services[0].name ||
      "General";
  }
  if (!specialization) specialization = "General";

  const isSolo = !item.salons?.length;
  const salonId = item.salons?.[0]?.id;

  // New API exposes a master's own workplace, including city_name.
  // For solo masters this is the authoritative city instead of the old "Solo" placeholder.
  const workplaceCity = item.workplace?.city_name?.trim();
  const city = isSolo
    ? workplaceCity || "N/A"
    : salonId != null
      ? cityBySalonId.get(salonId) ?? workplaceCity ?? "N/A"
      : workplaceCity || "N/A";

  return {
    name,
    specialization,
    rating: Number(item.average_rating ?? item.rating ?? 0),
    city,
    bookings: Number(item.bookings_count ?? 0),
    revenue: Number(item.total_revenue ?? 0),
    isSolo,
  };
}

export async function getMastersPage(
  page: number,
  pageSize = 15
): Promise<MastersPage> {
  const [masterPage, salonRows] = await Promise.all([
    apiGetPageSlice<RawMaster>("/api/users/masters/", page, pageSize),
    getSalons(),
  ]);

  const cityBySalonId = new Map<number, string>();
  salonRows.forEach((salon) => {
    if (typeof salon.id === "number") {
      cityBySalonId.set(salon.id, salon.city);
    }
  });

  return {
    masters: masterPage.items.map((item) => mapMaster(item, cityBySalonId)),
    count: masterPage.count,
  };
}

export interface RegisterMasterPayload {
  email: string;
  password: string;
  services: number[];
  first_name: string;
  last_name: string;
  phone: string;
  specialization: string;
  bio: string;
  years_of_experience: number;
}

export async function addMaster(data: RegisterMasterPayload) {
  return apiPost("/api/users/register-master/", data);
}
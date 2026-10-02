import { apiGetPageSlice, apiPost } from "./client";

export interface MasterRow {
  name: string;
  specialization: string;
  rating: number;
  city: string;
  isSolo: boolean;
}

interface RawMaster {
  id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  specialization?: string;
  services?: Array<{
    id?: number;
    name?: string;
    category?: string;
  }>;
  salons?: Array<{
    id?: number;
    name?: string;
    location?: {
      city_name?: string;
    } | null;
  }>;
  workplace?: {
    city_name?: string;
    address?: string | null;
    district?: string | null;
    region?: string | null;
    country?: string;
  } | null;
  average_rating?: number;
  rating?: number;
}

export type MastersPage = {
  masters: MasterRow[];
  count: number;
};

function mapMaster(item: RawMaster): MasterRow {
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

  if (!specialization) {
    specialization = "General";
  }

  const isSolo = !item.salons?.length;

  const workplaceCity = item.workplace?.city_name?.trim();
  const salonCity = item.salons?.[0]?.location?.city_name?.trim();

  const city = isSolo
    ? workplaceCity || "N/A"
    : salonCity || workplaceCity || "N/A";

  return {
    name,
    specialization,
    rating: Number(item.average_rating ?? item.rating ?? 0),
    city,
    isSolo,
  };
}

export async function getMastersPage(
  page: number,
  pageSize = 15
): Promise<MastersPage> {
  const data = await apiGetPageSlice<RawMaster>(
    "/api/users/masters/",
    page,
    pageSize
  );

  return {
    masters: data.items.map(mapMaster),
    count: data.count,
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

import { apiGetPageSlice } from "./client";

export interface ServiceRow {
  id: number | string;
  name: string;
  category: string;
  duration: number;
  price: number;
  mastersCount: number;
  mastersDetail: string;
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

export type ServicesPage = {
  services: ServiceRow[];
  count: number;
};

function mapService(item: RawService): ServiceRow {
  let mastersCount = 0;
  let mastersDetail = "—";

  if (Array.isArray(item.masters)) {
    const masters = item.masters
      .map((master) => {
        if (typeof master === "object" && master) {
          return master.name || master.full_name || String(master.id ?? "");
        }

        return String(master);
      })
      .filter(Boolean);

    mastersCount = masters.length;
    mastersDetail = masters.join(", ") || "—";
  } else if (item.masters) {
    mastersCount = 1;
    mastersDetail = String(item.masters);
  }

  return {
    id: item.id ?? "N/A",
    name: item.name || "Unknown Service",
    category: item.category || "—",
    duration: Number(item.duration_minutes ?? 0) || 0,
    price: Number(item.price ?? 0) || 0,
    mastersCount,
    mastersDetail,
    bookings: 0,
  };
}

export async function getServicesPage(
  page: number,
  pageSize = 15
): Promise<ServicesPage> {
  const data = await apiGetPageSlice<RawService>(
    "/api/services/",
    page,
    pageSize
  );

  return {
    services: data.items.map(mapService),
    count: data.count,
  };
}

import { apiGet } from "./client";

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

type ServicesApiPage = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: RawService[];
};

function mapService(item: RawService): ServiceRow {
  let mastersCount = 0;
  let mastersDetail = "—";

  if (Array.isArray(item.masters)) {
    const masters = item.masters
      .map((master) => {
        if (typeof master === "object" && master) {
          return (
            master.name ||
            master.full_name ||
            String(master.id ?? "")
          );
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
    bookings: -1,
  };
}

export async function getServicesPage(
  page: number,
  pageSize = 15
): Promise<ServicesPage> {
  const safePage = Math.max(0, page);
  const startIndex = safePage * pageSize;

  // First request gives us the real total count and backend page size.
  const first = await apiGet<ServicesApiPage>(
    "/api/services/?page=1"
  );

  const backendPageSize = Math.max(
    1,
    first.results?.length ?? 10
  );

  const count = first.count ?? first.results?.length ?? 0;

  if (startIndex >= count) {
    return {
      services: [],
      count,
    };
  }

  const firstBackendPage =
    Math.floor(startIndex / backendPageSize) + 1;

  const offset = startIndex % backendPageSize;

  const lastItemIndex = Math.min(
    count,
    startIndex + pageSize
  );

  const lastBackendPage =
    Math.ceil(lastItemIndex / backendPageSize);

  const pageNumbers = Array.from(
    {
      length:
        lastBackendPage - firstBackendPage + 1,
    },
    (_, index) => firstBackendPage + index
  );

  const responses = await Promise.all(
    pageNumbers.map((backendPage) =>
      backendPage === 1
        ? Promise.resolve(first)
        : apiGet<ServicesApiPage>(
            `/api/services/?page=${backendPage}`
          )
    )
  );

  const items = responses.flatMap(
    (response) => response.results ?? []
  );

  return {
    services: items
      .slice(offset, offset + pageSize)
      .map(mapService),
    count,
  };
}

import { apiGet } from "./client";

export type ClientRow = {
  id: number | string;
  name: string;
  city: string;
  acquisitionChannel: string;
  bookings: number;
  spent: number;
  lastVisit: string;
  status: string;
};

type PaginatedClientsResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: any[];
};

export type ClientsPage = {
  clients: ClientRow[];
  count: number;
};

function mapClient(item: any): ClientRow {
  return {
    id: item.id,
    name:
      item.name ||
      `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
      item.email ||
      "—",
    city: item.residence?.city_name || item.city || "—",
    acquisitionChannel:
      item.acquisition_channel ||
      item.source ||
      "—",
    bookings:
      item.bookings_count ??
      item.bookings ??
      0,
    spent: Number(item.total_spent ?? item.spent ?? 0),
    lastVisit:
      item.last_visit ||
      item.lastVisit ||
      "—",
    status:
      item.is_active === false
        ? "Inactive"
        : item.status || "Active",
  };
}

async function fetchBackendPage(page: number): Promise<PaginatedClientsResponse> {
  return apiGet<PaginatedClientsResponse>(
    `/api/users/clients/?page=${Math.max(1, page)}`
  );
}

export async function getClientsPage(
  uiPage: number,
  pageSize = 15
): Promise<ClientsPage> {
  const safeUiPage = Math.max(0, uiPage);
  const startIndex = safeUiPage * pageSize;

  // Django зараз віддає по 10 записів. Спершу визначаємо реальний
  // backend page size із першої потрібної сторінки, а потім добираємо
  // лише стільки сусідніх сторінок, скільки потрібно для 15 рядків UI.
  const assumedBackendPageSize = 10;
  const firstBackendPage = Math.floor(startIndex / assumedBackendPageSize) + 1;
  const firstResponse = await fetchBackendPage(firstBackendPage);

  const backendPageSize =
    firstResponse.results && firstResponse.results.length > 0
      ? firstResponse.results.length
      : assumedBackendPageSize;

  const correctedFirstBackendPage =
    Math.floor(startIndex / backendPageSize) + 1;

  const responses: PaginatedClientsResponse[] = [];

  if (correctedFirstBackendPage === firstBackendPage) {
    responses.push(firstResponse);
  } else {
    responses.push(await fetchBackendPage(correctedFirstBackendPage));
  }

  const offsetInFirstPage = startIndex % backendPageSize;
  const pagesNeeded = Math.ceil((offsetInFirstPage + pageSize) / backendPageSize);

  for (let i = 1; i < pagesNeeded; i += 1) {
    responses.push(await fetchBackendPage(correctedFirstBackendPage + i));
  }

  const combined = responses.flatMap((response) => response.results ?? []);
  const clients = combined
    .slice(offsetInFirstPage, offsetInFirstPage + pageSize)
    .map(mapClient);

  return {
    clients,
    count: responses[0]?.count ?? 0,
  };
}

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

export async function getClients(
  q = "",
  status = "All"
): Promise<ClientRow[]> {
  const raw = await apiGet<any>("/api/users/clients/");
  const data: any[] = Array.isArray(raw) ? raw : raw?.results ?? [];

  return data
    .map((item) => ({
      id: item.id,
      name:
        item.name ||
        `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
        item.email ||
        "—",
      city: item.city || "—",
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
    }))
    .filter((client) => {
      const matchesQ =
        !q ||
        client.name.toLowerCase().includes(q.toLowerCase()) ||
        client.city.toLowerCase().includes(q.toLowerCase());

      const matchesStatus =
        status === "All" || client.status === status;

      return matchesQ && matchesStatus;
    });
}
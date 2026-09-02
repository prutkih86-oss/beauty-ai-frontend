import { apiGet } from "./client";

export interface BookingRow {
  id: number | string;
  clientName: string;
  masterName: string;
  serviceName: string;
  salonName: string;
  dateTime: string;
  status: string;
  price: number;
}

interface RawBooking {
  id?: number | string;
  appointment_id?: number | string;
  client_name?: string;
  master_name?: string;
  service_name?: string;
  salon_name?: string;
  appointment_status?: string;
  status?: string;
  appointment_date?: string;
  appointment_time?: string;
  total_price?: number | string;
  price?: number | string;
}

function unwrap<T>(data: T[] | { results?: T[] }): T[] {
  return Array.isArray(data) ? data : data.results || [];
}

export async function getBookings(
  search = "",
  status = "All"
): Promise<BookingRow[]> {
  const data = await apiGet<RawBooking[] | { results?: RawBooking[] }>(
    "/api/appointments/"
  );

  const q = search.toLowerCase();

  return unwrap(data)
    .map(
      (item): BookingRow => ({
        id: item.id ?? item.appointment_id ?? "N/A",
        clientName: item.client_name || "—",
        masterName: item.master_name || "—",
        serviceName: item.service_name || "—",
        salonName: item.salon_name || "—",
        dateTime:
          `${item.appointment_date || ""} ${item.appointment_time || ""}`.trim() ||
          "—",
        status: item.appointment_status || item.status || "Pending",
        price: Number(item.total_price ?? item.price ?? 0) || 0,
      })
    )
    .filter(
      (b: BookingRow) =>
        (!q ||
          b.clientName.toLowerCase().includes(q) ||
          b.masterName.toLowerCase().includes(q) ||
          b.serviceName.toLowerCase().includes(q)) &&
        (status === "All" || b.status === status)
    );
}

/*
  Important: the original NiceGUI data_access/bookings.py explicitly raises
  NotImplementedError for API update/delete. We intentionally do not invent
  PATCH/DELETE endpoints here until Swagger/backend confirms them.
*/

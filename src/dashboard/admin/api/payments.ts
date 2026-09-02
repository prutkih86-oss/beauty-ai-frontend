import { apiDelete, apiGet, apiPost } from "./client";

export interface PaymentRow {
  id: number | string;
  client: string;
  bookingId: number | string;
  amount: number;
  method: string;
  date: string;
}

interface RawAppointment {
  id?: number | string;
  client_name?: string;
  client?: string;
}

interface RawPayment {
  id?: number | string;
  appointment?: RawAppointment | number | string;
  appointment_id?: number | string;
  client_name?: string;
  client?: string;
  payment_date?: string;
  created_at?: string;
  date?: string;
  payment_method?: string;
  method?: string;
  amount?: number | string;
}

function unwrap<T>(data: T[] | { results?: T[] }): T[] {
  return Array.isArray(data) ? data : data.results || [];
}

export async function getPayments(
  search = "",
  method = "All",
  date = ""
): Promise<PaymentRow[]> {
  const data = await apiGet<RawPayment[] | { results?: RawPayment[] }>(
    "/api/payments/"
  );

  const q = search.toLowerCase();

  return unwrap(data)
    .map((item): PaymentRow => {
      const appointment = item.appointment ?? item.appointment_id;

      let bookingId: number | string = "N/A";
      let client = item.client_name || item.client || "N/A";

      if (typeof appointment === "object" && appointment) {
        bookingId = appointment.id ?? "N/A";
        client =
          appointment.client_name ||
          appointment.client ||
          item.client_name ||
          "N/A";
      } else if (appointment !== undefined && appointment !== null) {
        bookingId = appointment;
      }

      const dateRaw = item.payment_date || item.created_at || item.date;

      return {
        id: item.id ?? "N/A",
        client: String(client),
        bookingId,
        amount: Number(item.amount ?? 0) || 0,
        method: String(item.payment_method || item.method || "Cash"),
        date: dateRaw ? String(dateRaw).slice(0, 10) : "—",
      };
    })
    .filter(
      (p: PaymentRow) =>
        (!q ||
          p.client.toLowerCase().includes(q) ||
          String(p.bookingId).includes(search) ||
          String(p.id).includes(search)) &&
        (method === "All" || p.method.toLowerCase() === method.toLowerCase()) &&
        (!date || p.date === date)
    );
}

export function addPayment(
  bookingId: number | string,
  amount: number,
  method: string
) {
  return apiPost("/api/payments/", {
    appointment:
      typeof bookingId === "string" && /^\d+$/.test(bookingId)
        ? Number(bookingId)
        : bookingId,
    amount,
    payment_method: method,
    payment_status: "COMPLETED",
    currency: "UAH",
  });
}

export function deletePayment(id: number | string) {
  return apiDelete(`/api/payments/${id}/`);
}

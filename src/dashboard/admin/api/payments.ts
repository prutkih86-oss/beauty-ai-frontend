import { apiDelete, apiGet, apiGetPageSlice, apiPost } from "./client";

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
  appointment_id?: number | string;
  client_name?: string;
  client?: string;
}

type AppointmentPage = {
  next?: string | null;
  results?: RawAppointment[];
};

const appointmentClientCache = new Map<string, string>();
let appointmentsCacheComplete = false;

function normalizeApiPath(urlOrPath: string): string {
  try {
    const url = new URL(urlOrPath);
    return `${url.pathname}${url.search}`;
  } catch {
    return urlOrPath;
  }
}

async function getClientNamesForAppointments(
  appointmentIds: Array<number | string>
): Promise<Map<string, string>> {
  const wanted = new Set(appointmentIds.map((id) => String(id)));

  for (const id of [...wanted]) {
    if (appointmentClientCache.has(id)) {
      wanted.delete(id);
    }
  }

  if (wanted.size > 0 && !appointmentsCacheComplete) {
    let nextPath: string | null = "/api/appointments/";

    while (nextPath && wanted.size > 0) {
      const page: AppointmentPage = await apiGet<AppointmentPage>(nextPath);

      for (const appointment of page.results ?? []) {
        const appointmentId =
          appointment.appointment_id ??
          appointment.id;

        if (appointmentId === undefined || appointmentId === null) {
          continue;
        }

        const key = String(appointmentId);
        const clientName =
          appointment.client_name ||
          appointment.client;

        if (clientName) {
          appointmentClientCache.set(key, String(clientName));
        }

        wanted.delete(key);
      }

      if (!page.next) {
        appointmentsCacheComplete = true;
        nextPath = null;
      } else {
        nextPath = normalizeApiPath(page.next);
      }
    }
  }

  const result = new Map<string, string>();

  appointmentIds.forEach((id) => {
    const key = String(id);
    const clientName = appointmentClientCache.get(key);

    if (clientName) {
      result.set(key, clientName);
    }
  });

  return result;
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

export type PaymentsPage = {
  payments: PaymentRow[];
  count: number;
};

function mapPayment(item: RawPayment): PaymentRow {
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
  } else if (
    appointment !== undefined &&
    appointment !== null &&
    typeof appointment !== "object"
  ) {
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
}

export async function getPaymentsPage(
  page: number,
  pageSize = 15
): Promise<PaymentsPage> {
  const data = await apiGetPageSlice<RawPayment>(
    "/api/payments/",
    page,
    pageSize
  );

  const payments = data.items.map(mapPayment);

  const appointmentIds = payments
    .filter(
      (payment) =>
        payment.client === "N/A" &&
        payment.bookingId !== "N/A"
    )
    .map((payment) => payment.bookingId);

  let clientNames = new Map<string, string>();

  if (appointmentIds.length > 0) {
    try {
      clientNames = await getClientNamesForAppointments(appointmentIds);
    } catch {
      // Payments themselves should still render even if appointment lookup fails.
    }
  }

  return {
    payments: payments.map((payment) => ({
      ...payment,
      client:
        payment.client !== "N/A"
          ? payment.client
          : clientNames.get(String(payment.bookingId)) || "N/A",
    })),
    count: data.count,
  };
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

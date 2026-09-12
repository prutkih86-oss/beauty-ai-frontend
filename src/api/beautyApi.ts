// src/api/beautyApi.ts

const AUTH_TOKENS_KEY = "beautyai_auth_tokens";

const API_BASE_URL = import.meta.env.DEV
  ? ""
  : "https://beautyaiservice.polandcentral.cloudapp.azure.com";

type AuthTokens = { access: string; refresh: string };

function getTokens(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(AUTH_TOKENS_KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  } catch {
    return null;
  }
}

function getAccessToken(): string | null {
  return getTokens()?.access ?? null;
}

function setAccessToken(access: string) {
  const current = getTokens();
  if (!current) return;
  localStorage.setItem(AUTH_TOKENS_KEY, JSON.stringify({ ...current, access }));
}

// Кілька паралельних запитів можуть отримати 401 одночасно — рефрешимо
// токен лише один раз, решта чекають той самий проміс.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens?.refresh) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/api/users/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokens.refresh }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { access?: string };
        if (!data.access) return null;
        setAccessToken(data.access);
        return data.access;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function clearTokensAndNotify() {
  localStorage.removeItem(AUTH_TOKENS_KEY);
  // App.tsx слухає цю подію й сам викликає handleLogout.
  window.dispatchEvent(new CustomEvent("beautyai:auth-expired"));
}

export class ApiError extends Error {
  status: number;
  constructor(path: string, status: number) {
    super(`API ${path} -> ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers = {
    ...(init.body && !isFormData ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...init.headers,
  };
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (response.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retry = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
      });
      if (!retry.ok) throw new ApiError(path, retry.status);
      return retry.status === 204 ? (undefined as T) : retry.json();
    }
    clearTokensAndNotify();
    throw new ApiError(path, 401);
  }

  if (!response.ok) throw new ApiError(path, response.status);
  return response.status === 204 ? (undefined as T) : response.json();
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

function serializeBody(body: unknown): BodyInit | undefined {
  if (body === undefined) return undefined;
  return body instanceof FormData ? body : JSON.stringify(body);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body: serializeBody(body) });
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "PATCH", body: serializeBody(body) });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "DELETE" });
}

export type SalonLocationApi = {
  id: number;
  country?: string;
  city_name?: string;
  address?: string | null;
  region?: string;
  coordinates?: string;
  timezone?: string;
  city_tier?: string;
};

export type SalonApi = {
  id: number;
  name: string;
  description?: string | null;
  logo?: string | null;

  // Backend serializers seen in this project may expose location either nested
  // or as flat fields. Keep both shapes supported.
  location?: SalonLocationApi | null;
  city_id?: number | null;
  city_name?: string | null;
  city?: string | { id?: number; name?: string } | null;
  district?: string | null;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;

  phone?: string | null;
  average_rating?: number | null;
  total_reviews?: number;
  masters_count?: number;
  service_count?: number;
  working_hours?: unknown[];
  available_status?: string;

  external_booking_url?: string | null;
};

export type MasterApi = {
  id: number;
  first_name?: string;
  last_name?: string;
  photo?: string | null;
  average_rating?: number | null;
  years_of_experience?: number;
  salons?: Array<{
    id: number;
    name: string;
  }>;
  services?: Array<{
    id: number;
    name: string;
    price?: number | string | null;
    duration_minutes?: number | string | null;
  }>;
};

export type ServiceApi = {
  id: number;
  name: string;
  category?: string | null;
  duration_minutes?: number | string | null;
  price?: number | string | null;
  masters?: Array<
    | number
    | string
    | {
        id?: number | string;
        name?: string;
        full_name?: string;
      }
  >;
};

type PaginatedResponse<T> = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
};

function unwrapList<T>(data: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

// DRF повертає "next" як АБСОЛЮТНИЙ URL.
// Лишаємо тільки path + query, щоб dev і далі працював через Vite proxy.
async function fetchAllPages<T>(initialPath: string): Promise<T[]> {
  const items: T[] = [];
  let path: string | null = initialPath;

  while (path) {
    const data: T[] | PaginatedResponse<T> =
      await apiGet<T[] | PaginatedResponse<T>>(path);

    items.push(...unwrapList(data));

    if (Array.isArray(data) || !data.next) {
      path = null;
    } else {
      path = data.next.replace(/^https?:\/\/[^/]+/, "");
    }
  }

  return items;
}

export async function fetchSalons(city?: string): Promise<SalonApi[]> {
  const query = city ? `?city=${encodeURIComponent(city)}` : "";
  return fetchAllPages<SalonApi>(`/api/salons/${query}`);
}

export async function fetchMasters(): Promise<MasterApi[]> {
  return fetchAllPages<MasterApi>("/api/users/masters/");
}

export async function fetchServices(city?: string): Promise<ServiceApi[]> {
  const query = city ? `?city=${encodeURIComponent(city)}` : "";
  return fetchAllPages<ServiceApi>(`/api/services/${query}`);
}

export type AvailableSlotApi = {
  start: string;
  end: string;
};

export type AvailableSlotsByDateApi = Record<string, AvailableSlotApi[]>;

export async function fetchAvailableSlots(params: {
  masterId: number;
  serviceId: number;
  date: string;
  salonId?: number | null;
}): Promise<AvailableSlotApi[]> {
  const query = new URLSearchParams();

  if (params.salonId != null) {
    query.set("salon", String(params.salonId));
    query.set("master", String(params.masterId));
    query.set("service", String(params.serviceId));
    query.set("date_from", params.date);

    const data = await apiGet<AvailableSlotsByDateApi>(
      `/api/appointments/available-slots/by-salon/?${query.toString()}`
    );
    return Array.isArray(data?.[params.date]) ? data[params.date] : [];
  }

  // Для соло-майстра Swagger документує query у description:
  // master_id, service_id, date. Підтримуємо цей endpoint як fallback.
  query.set("master_id", String(params.masterId));
  query.set("service_id", String(params.serviceId));
  query.set("date", params.date);

  const data = await apiGet<AvailableSlotApi[] | AvailableSlotsByDateApi>(
    `/api/appointments/available-slots/by-master/?${query.toString()}`
  );

  if (Array.isArray(data)) return data;
  return Array.isArray(data?.[params.date]) ? data[params.date] : [];
}

export type CreateAppointmentPayload = {
  master_id: number;
  service_id: number;
  appointment_date: string;
  appointment_time: string;
  notes?: string;
};

export type CreatedAppointmentApi = CreateAppointmentPayload & {
  id?: number;
  status?: string;
  [key: string]: unknown;
};

export async function createAppointment(
  payload: CreateAppointmentPayload
): Promise<CreatedAppointmentApi> {
  return apiPost<CreatedAppointmentApi>("/api/appointments/create/", payload);
}
export type UserProfileApi = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  photo?: string | null;
  birth_date?: string | null;
  is_master: boolean;
  bookings_count: number;
  total_spent: string;
};

export async function fetchMyProfile(): Promise<UserProfileApi> {
  return apiGet<UserProfileApi>("/api/users/me/");
}
export async function updateMyProfile(payload: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
}): Promise<UserProfileApi> {
  return apiPatch<UserProfileApi>("/api/users/me/", payload);
}

export async function updateMyProfilePhoto(file: Blob | File): Promise<UserProfileApi> {
  const formData = new FormData();
  formData.append("photo", file, file instanceof File ? file.name : "avatar.jpg");
  return apiPatch<UserProfileApi>("/api/users/me/", formData);
}

export type ClientAppointmentApi = {
  id: number;
  start: string;
  end: string;
  status: string;
  created_at: string;
  appointment_date: string;
  appointment_time: string;
  appointment_status: string;
  service_name: string;
  service_price: string;
  salon_name: string;
  salon_address: string;
  master_name: string;
};

type ClientAppointmentListApi = {
  id: number;
  master: number;
  salon?: number | null;
  service: number;
  start: string;
  end: string;
  status: string;
  created_at: string;
};

type AppointmentDetailApi = {
  appointment_id: number;
  appointment_date?: string | null;
  appointment_time?: string | null;
  appointment_status: string;
  service_name: string;
  service_price: string;
  salon_name: string;
  salon_address: string;
  master_name?: string | null;
  created_date: string;
};

function appointmentDateParts(start: string): { date: string; time: string } {
  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) {
    return { date: "", time: "" };
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

export async function fetchMyAppointments(): Promise<ClientAppointmentApi[]> {
  const rows = await fetchAllPages<ClientAppointmentListApi>(
    "/api/appointments/my/?ordering=-start"
  );

  return Promise.all(
    rows.map(async (row) => {
      const fallback = appointmentDateParts(row.start);

      try {
        const detail = await apiGet<AppointmentDetailApi>(
          `/api/appointments/${row.id}/`
        );

        return {
          id: row.id,
          start: row.start,
          end: row.end,
          status: row.status,
          created_at: row.created_at,
          appointment_date: detail.appointment_date || fallback.date,
          appointment_time: detail.appointment_time || fallback.time,
          appointment_status: detail.appointment_status || row.status,
          service_name: detail.service_name || "—",
          service_price: detail.service_price || "0",
          salon_name: detail.salon_name || "",
          salon_address: detail.salon_address || "",
          master_name: detail.master_name || "",
        };
      } catch {
        return {
          id: row.id,
          start: row.start,
          end: row.end,
          status: row.status,
          created_at: row.created_at,
          appointment_date: fallback.date,
          appointment_time: fallback.time,
          appointment_status: row.status,
          service_name: "—",
          service_price: "0",
          salon_name: "",
          salon_address: "",
          master_name: "",
        };
      }
    })
  );
}

export async function cancelMyAppointment(id: number | string): Promise<void> {
  await apiPatch(`/api/appointments/${id}/cancel/`, {});
}

export type MasterAppointmentApi = {
  id: number;
  start: string;
  end: string;
  client_name: string;
  service_name: string;
  status: string;
  duration_minutes: number;
  total_price: string;
  salon_name: string;
  created_at: string;
  completed_at?: string | null;
  cancellation_reason?: string | null;
};

export async function fetchMasterActiveAppointments(): Promise<MasterAppointmentApi[]> {
  return fetchAllPages<MasterAppointmentApi>("/api/appointments/master/active/?ordering=start");
}

export async function fetchMasterHistoryAppointments(): Promise<MasterAppointmentApi[]> {
  return fetchAllPages<MasterAppointmentApi>("/api/appointments/master/history/?ordering=-start");
}

const APPOINTMENT_STATUS_ORDER = ["pending", "confirmed", "in_progress", "completed"] as const;

export async function updateAppointmentStatus(
  id: number | string,
  targetStatus: "confirmed" | "in_progress" | "completed" | "cancelled",
  cancellationReason?: string
): Promise<void> {
  if (targetStatus === "cancelled") {
    await apiPatch(`/api/appointments/${id}/status/`, {
      status: "cancelled",
      cancellation_reason: cancellationReason || "Cancelled by master",
    });
    return;
  }

  // Бекенд дозволяє тільки покроковий перехід pending → confirmed → in_progress → completed.
  // Дізнаємось поточний статус і "доганяємо" до потрібного послідовними PATCH-запитами.
  const current = await apiGet<{ status: string }>(`/api/appointments/master/${id}/`);
  let index = APPOINTMENT_STATUS_ORDER.indexOf(current.status as (typeof APPOINTMENT_STATUS_ORDER)[number]);
  const targetIndex = APPOINTMENT_STATUS_ORDER.indexOf(targetStatus);
  if (index < 0 || targetIndex < 0 || index >= targetIndex) return;

  while (index < targetIndex) {
    index += 1;
    await apiPatch(`/api/appointments/${id}/status/`, { status: APPOINTMENT_STATUS_ORDER[index] });
  }
}

export type DayOffApi = {
  id: number;
  start_date: string;
  end_date: string;
  reason: string;
};

export async function fetchDayOffs(): Promise<DayOffApi[]> {
  return fetchAllPages<DayOffApi>("/api/users/masters/me/day-offs/");
}

export async function createDayOff(payload: {
  start_date: string;
  end_date: string;
  reason: string;
}): Promise<DayOffApi> {
  return apiPost<DayOffApi>("/api/users/masters/me/day-offs/", payload);
}

export async function deleteDayOff(id: number | string): Promise<void> {
  await apiDelete(`/api/users/masters/me/day-offs/${id}/`);
}

export type WorkingScheduleDayApi = {
  id?: number;
  weekday: number; // 1 = Понеділок ... 7 = Неділя
  opening_time: string | null;
  closing_time: string | null;
  is_closed: boolean;
};

export async function fetchWorkingSchedule(): Promise<WorkingScheduleDayApi[]> {
  return fetchAllPages<WorkingScheduleDayApi>("/api/users/masters/me/working-schedule/");
}

export async function saveWorkingScheduleDay(day: WorkingScheduleDayApi): Promise<WorkingScheduleDayApi> {
  const payload = {
    weekday: day.weekday,
    opening_time: day.is_closed ? null : day.opening_time,
    closing_time: day.is_closed ? null : day.closing_time,
    is_closed: day.is_closed,
  };
  return day.id
    ? apiPatch<WorkingScheduleDayApi>(`/api/users/masters/me/working-schedule/${day.id}/`, payload)
    : apiPost<WorkingScheduleDayApi>("/api/users/masters/me/working-schedule/", payload);
}

export type MasterReviewApi = {
  id: number;
  client_name: string;
  client_profile_photo?: string | null;
  rating: number;
  comment?: string | null;
  service_name: string;
  appointment_date: string;
  created_at: string;
};

export async function fetchMasterReviews(): Promise<MasterReviewApi[]> {
  return fetchAllPages<MasterReviewApi>("/api/reviews/masters/me/?ordering=-created_at");
}

export type MasterProfileApi = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  bio?: string | null;
  years_of_experience?: number;
  photo?: string | null;
  average_rating?: number;
  total_reviews?: number;
  active_services?: Array<{ id: number; name: string }>;
};

export async function fetchMasterProfile(): Promise<MasterProfileApi> {
  return apiGet<MasterProfileApi>("/api/users/masters/me/");
}

export async function updateMasterProfile(payload: {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  bio?: string;
}): Promise<MasterProfileApi> {
  return apiPatch<MasterProfileApi>("/api/users/masters/me/", payload);
}

export async function updateMasterProfilePhoto(file: Blob | File): Promise<MasterProfileApi> {
  const formData = new FormData();
  formData.append("photo", file, file instanceof File ? file.name : "avatar.jpg");
  return apiPatch<MasterProfileApi>("/api/users/masters/me/", formData);
}

// Бекенд поки не має /api/services/?masters=<id> як окремого читомого фільтра,
// тож дістаємо список активних послуг майстра через профіль (active_services — id+name),
// і докручуємо повні дані (ціна/тривалість/категорія) із загального списку послуг.
export async function fetchMasterServices(): Promise<ServiceApi[]> {
  const profile = await fetchMasterProfile();
  const activeIds = new Set((profile.active_services ?? []).map((service) => service.id));
  if (!activeIds.size) return [];
  const all = await fetchServices();
  return all.filter((service) => activeIds.has(service.id));
}

// AI-чат живе на окремому сервісі (порт 8001), не на основному Django-бекенді.
// В dev його проксить Vite (vite.config.ts, "/ai-chat" -> ...:8001, префікс обрізається),
// у проді — nginx (nginx/default.conf, той самий /ai-chat/ -> ...:8001/, з прокиданням
// заголовка Authorization). Тому тут завжди відносний шлях, без API_BASE_URL.
export type AiChatResponse = {
  conversation_id?: string | number | null;
  reply?: string;
  response?: string;
  message?: string;
  answer?: string;
  content?: string;
  detail?: string;
};

export async function sendAiChatMessage(
  message: string,
  conversationId: string | number | null
): Promise<{ text: string; conversationId: string | number | null }> {
  const aiChatUrl = import.meta.env.VITE_AI_CHAT_URL?.trim() || "/ai-chat/chat";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(aiChatUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, conversation_id: conversationId }),
  });

  const payload = (await response.json().catch(() => null)) as AiChatResponse | null;

  if (!response.ok) {
    throw new Error(payload?.detail || `AI chat request failed (${response.status})`);
  }

  const data = payload ?? {};
  const text =
    [data.reply, data.response, data.message, data.answer, data.content].find(
      (value): value is string => typeof value === "string"
    ) ?? "";
  const nextConversationId =
    typeof data.conversation_id === "string" || typeof data.conversation_id === "number"
      ? data.conversation_id
      : conversationId;

  return { text, conversationId: nextConversationId };
}

export type AppointmentReviewApi = {
  id: number;
  appointment: number;
  client: number;
  master: number;
  rating: number;
  comment?: string | null;
  created_at: string;
};

export async function createAppointmentReview(
  appointmentId: number | string,
  payload: { rating: number; comment?: string }
): Promise<AppointmentReviewApi> {
  return apiPost<AppointmentReviewApi>(`/api/appointments/${appointmentId}/review/`, payload);
}

export async function updateAppointmentReview(
  appointmentId: number | string,
  payload: { rating?: number; comment?: string }
): Promise<AppointmentReviewApi> {
  return apiPatch<AppointmentReviewApi>(`/api/appointments/${appointmentId}/review/`, payload);
}

export async function fetchAppointmentReview(
  appointmentId: number | string
): Promise<AppointmentReviewApi | null> {
  try {
    return await apiGet<AppointmentReviewApi>(`/api/appointments/${appointmentId}/review/`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function deleteAppointmentReview(appointmentId: number | string): Promise<void> {
  await apiDelete(`/api/appointments/${appointmentId}/review/`);
}


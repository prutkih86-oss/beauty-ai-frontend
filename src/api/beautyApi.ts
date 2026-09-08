// src/api/beautyApi.ts

const AUTH_TOKENS_KEY = "beautyai_auth_tokens";

const API_BASE_URL = import.meta.env.DEV
  ? ""
  : "https://beautyaiservice.polandcentral.cloudapp.azure.com";

function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access ?? null;
  } catch {
    return null;
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error(`API ${path} -> ${response.status}`);
  }

  return response.json();
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
  location?: SalonLocationApi | null;
  phone?: string | null;
  average_rating?: number | null;
  total_reviews?: number;
  masters_count?: number;
  service_count?: number;
  working_hours?: unknown[];
  available_status?: string;
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

export async function fetchSalons(): Promise<SalonApi[]> {
  return fetchAllPages<SalonApi>("/api/salons/");
}

export async function fetchMasters(): Promise<MasterApi[]> {
  return fetchAllPages<MasterApi>("/api/users/masters/");
}

export async function fetchServices(): Promise<ServiceApi[]> {
  return fetchAllPages<ServiceApi>("/api/services/");
}

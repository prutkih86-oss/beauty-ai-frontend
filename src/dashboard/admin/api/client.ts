const API_BASE_URL = import.meta.env.DEV
  ? ""
  : import.meta.env.VITE_API_BASE_URL ||
    "https://beautyaiservice.polandcentral.cloudapp.azure.com";

const ADMIN_TOKEN_KEY = "beauty_ai_admin_token";
const AUTH_TOKENS_KEY = "beautyai_auth_tokens";

class ApiAuthError extends Error {}

function getToken(): string | null {
  try {
    const sharedAuth = localStorage.getItem(AUTH_TOKENS_KEY);

    if (sharedAuth) {
      const tokens = JSON.parse(sharedAuth);

      if (tokens?.access) {
        return tokens.access;
      }
    }
  } catch {
    // Якщо shared token пошкоджений — пробуємо старий admin token.
  }

  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(AUTH_TOKENS_KEY);
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/users/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!res.ok) {
    throw new ApiAuthError(`Login failed: ${res.status}`);
  }

  const data = await res.json();
  const token = data.access || data.access_token;

  if (!token) {
    throw new ApiAuthError(
      "Login succeeded but no access token in response"
    );
  }

  setToken(token);

  return token;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retry = true
): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry) {
    clearToken();

    throw new ApiAuthError(
      "Unauthorized — потрібен повторний логін"
    );
  }

  if (!res.ok) {
    throw new Error(
      `API ${method} ${path} failed: ${res.status}`
    );
  }

  if (res.status === 204) {
    return {} as T;
  }

  const text = await res.text();

  return text
    ? JSON.parse(text)
    : ({} as T);
}

export const apiGet = <T>(path: string) =>
  request<T>("GET", path);

export type ApiPage<T> = {
  items: T[];
  count: number;
};

type ApiPaginatedResponse<T> = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
};

function addPageParam(path: string, page: number): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}page=${page}`;
}

export async function apiGetPageSlice<T>(
  path: string,
  uiPage: number,
  pageSize = 15
): Promise<ApiPage<T>> {
  const safeUiPage = Math.max(0, uiPage);
  const startIndex = safeUiPage * pageSize;
  const assumedBackendPageSize = 10;

  let backendPageSize = assumedBackendPageSize;
  let firstBackendPage = Math.floor(startIndex / backendPageSize) + 1;
  let first = await request<T[] | ApiPaginatedResponse<T>>(
    "GET",
    addPageParam(path, firstBackendPage)
  );

  if (Array.isArray(first)) {
    const start = startIndex;
    return {
      items: first.slice(start, start + pageSize),
      count: first.length,
    };
  }

  if ((first.results?.length ?? 0) > 0) {
    backendPageSize = first.results!.length;
  }

  const correctedFirstBackendPage =
    Math.floor(startIndex / backendPageSize) + 1;

  if (correctedFirstBackendPage !== firstBackendPage) {
    firstBackendPage = correctedFirstBackendPage;
    first = await request<ApiPaginatedResponse<T>>(
      "GET",
      addPageParam(path, firstBackendPage)
    );
  }

  const count = first.count ?? 0;
  const offset = startIndex % backendPageSize;
  const pagesNeeded = Math.ceil((offset + pageSize) / backendPageSize);
  const totalBackendPages = Math.max(1, Math.ceil(count / backendPageSize));

  const chunks: T[][] = [first.results ?? []];

  for (let i = 1; i < pagesNeeded; i += 1) {
    const backendPage = firstBackendPage + i;
    if (backendPage > totalBackendPages) break;

    const response = await request<ApiPaginatedResponse<T>>(
      "GET",
      addPageParam(path, backendPage)
    );
    chunks.push(response.results ?? []);
  }

  return {
    items: chunks.flat().slice(offset, offset + pageSize),
    count,
  };
}

// DRF пагінує списки як { results, next }. next — АБСОЛЮТНИЙ URL,
// тож відрізаємо протокол+домен і йдемо далі через той самий request(),
// щоб у dev це й далі проходило через Vite-проксі.
// (тип виносимо НА РІВЕНЬ МОДУЛЯ, над функцією apiGetAllPages)
type PaginatedResponse<T> = { results?: T[]; next?: string | null };

export async function apiGetAllPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let nextPath: string | null = path;

  while (nextPath) {
    const data: T[] | PaginatedResponse<T> = await request<T[] | PaginatedResponse<T>>("GET", nextPath);

    if (Array.isArray(data)) {
      items.push(...data);
      break;
    }

    items.push(...(data.results ?? []));
    nextPath = data.next ? data.next.replace(/^https?:\/\/[^/]+/, "") : null;
  }

  return items;
}

export const apiPost = <T>(
  path: string,
  body: unknown
) => request<T>("POST", path, body);

export const apiPut = <T>(
  path: string,
  body: unknown
) => request<T>("PUT", path, body);

export const apiPatch = <T>(
  path: string,
  body: unknown
) => request<T>("PATCH", path, body);

export const apiDelete = (path: string) =>
  request<void>("DELETE", path);

export {
  login,
  getToken,
  clearToken,
};
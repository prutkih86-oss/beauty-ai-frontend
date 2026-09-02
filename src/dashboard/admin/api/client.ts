const API_BASE_URL = import.meta.env.DEV
  ? ""
  : import.meta.env.VITE_API_BASE_URL ||
    "https://beautyaiservice.polandcentral.cloudapp.azure.com";

const TOKEN_KEY = "beauty_ai_admin_token";

class ApiAuthError extends Error {}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
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
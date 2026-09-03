import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./App.css";
import MapSection from "./MapSection";
import CategoryFilters from "./CategoryFilters";
import FilterBar from './FilterBar';
import beautyAISparkles from "./assets/beauty-ai-sparkles.svg";
import DashboardShell from "./dashboard/DashboardShell";

type CardReview = {
  author: string;
  rating: number;
  text: string;
  date?: string;
};

type CardData = {
  image: string;
  badges: { text: string; kind: string }[];
  title: string;
  type: string;
  rating: number;
  reviews: number;
  district: string;
  distance: string;
  openNow?: boolean;
  tags: string[];
  priceFrom: string;
  mastersCount?: string;
  avgCheck?: string;
  why?: string;
  variant?: "solo";
  experience?: string;
  locationNote?: string;
  profileLinkLabel?: string;
  description?: string;
  reviewsList?: CardReview[];
  website?: string;
};


type PartnerOffer = {
  image: string;
  discount: string;
  validUntil: string;
  title: string;
  partner: string;
  district: string;
  distance: string;
  openNow?: boolean;
  oldPrice: string;
  newPrice: string;
  gift?: string;
  rating: number;
  reviews: number;
  website?: string;
};


type SelectedMapLocation = {
  name: string;
  district: string;
  distance: string;
  lat: number;
  lng: number;
};

const LOCATION_COORDINATES: Record<string, [number, number]> = {
  "Luna Beauty House": [50.4380, 30.5325],
  "Nails Studio": [50.4412, 30.5401],
  "Beauty Room": [50.4465, 30.5502],
  "Atelier Beauty": [50.4438, 30.5268],
  "Élan Studio": [50.4390, 30.5292],
  "Wellness Studio": [50.4424, 30.5310],
  "Brow Bar": [50.4450, 30.5360],
  "Оксана Мельник": [50.4392, 30.5330],
  "Дмитро Кравець": [50.4418, 30.5368],
  "Ірина Бондар": [50.4434, 30.5308],
  "Марина Кузьменко": [50.4447, 30.5287],
  "Софія Левченко": [50.4369, 30.5385],
  "Андрій Савчук": [50.4470, 30.5338],
  "Beauty Point": [50.4450, 30.5350],
  "Pink Nail Bar": [50.4404, 30.5306],
  "Metro Beauty": [50.4428, 30.5440],
};

const DISTRICT_FALLBACKS: Record<string, [number, number]> = {
  "Печерський р-н": [50.4388, 30.5350],
  "Печерськ": [50.4378, 30.5358],
  "Липки": [50.4430, 30.5298],
  "Центр": [50.4472, 30.5228],
  "Золоті ворота": [50.4483, 30.5135],
};

type Lang = "ua" | "en";

const dict = {
  ua: {
    nav: ["Салони","Майстри", "Акції", "Про Beauty AI"],
    loginGoogle: "Увійти",
    heroTitle1: "ЗНАЙДИ СВІЙ",   // було "Знайдіть свого майстра"
    heroTitle2: "BEAUTY MATCH",          // новий рядок
    heroTitle3: "ЗА ДОПОМОГОЮ AI",
    heroEyebrow: "ТВІЙ РОЗУМНИЙ ПОШУК КРАСИ",
    heroSubtitle: "Опиши, що тобі потрібно — AI підбере майстра під твій запит",
    searchPlaceholder: "Наприклад: манікюр у центрі Києва сьогодні",
    searchBtn: "Знайти",
    filters: "Фільтри",
    partnersLink: "Про партнерів>",
    footer: "Beauty AI аналізує ваші запити та обирає найкращі варіанти саме для вас",
    sections: {
      recommendations: { title: "Салони для вас", subtitle: "Найкращі збіги за рейтингом, ціною та доступністю" },
      soloMasters: { title: "Майстри для вас", subtitle: "Персональні рекомендації майстрів під ваш запит" },
      partners: { title: "Пропозиції від партнерів", subtitle: "Ексклюзивні знижки та акції" },
      nearby: { title: "Найкращі в Києві", subtitle: "Салони та майстри з найвищими показниками" },
      topRated: { title: "Варто спробувати", subtitle: "Цеможе вас зацікавити" },
      fresh: { title: "Новинки на платформі", subtitle: "Нові майстри та салони для вас" },
    },
    cta: "Записатися",
    viewSalon: "Дивитися салон",
    inSalon: "у салоні",
    avgCheck: "Середній чек",
    open: "Відкрито",
    available: "Є місця",
    placeModal: {
      close: "Закрити",
      reviews: "відгуків",
      reviewsTitle: "Відгуки клієнтів",
      showMoreReviews: "Показати ще",
      hideReviews: "Згорнути відгуки",
      shownReviews: "Показано",
      ofReviews: "з",
      aboutTitle: "Про місце",
      servicesTitle: "Послуги та спеціалізації",
      detailsTitle: "Інформація",
      priceFrom: "Ціна від",
      averageCheck: "Середній чек",
      experience: "Досвід / команда",
      location: "Розташування",
      status: "Статус",
      book: "Записатися",
    },
    bookingModal: {
      close: "Закрити",
      title: "Запис до майстра",
      service: "Послуга",
      date: "Дата",
      time: "Вільний час",
      contact: "Ваш телефон",
      contactPlaceholder: "+380 00 000 00 00",
      summary: "Ваш запис",
      confirm: "Підтвердити запис",
      successTitle: "Запис підтверджено!",
      successText: "Готово — час зарезервовано. Ми надішлемо нагадування перед візитом.",
      bookingCode: "Код запису",
      done: "Готово",
      chooseTime: "Оберіть час",
      salonWebsite: "Перейти на сайт салону",
    },
    about: {                                    // ← тут вставляєш новий блок
      title: "Про Beauty AI",
      description:
        "Beauty AI — сервіс, який допомагає знайти майстра краси за лічені секунди. Опишіть, що вам потрібно, а наш AI підбере найкращі салони та майстрів поруч — з урахуванням рейтингу, цін і вільних вікон запису.",
      contactsTitle: "Зв'язок",
      partnersTitle: "Співпраця",
      partnersText:
        "Ви майстер або власник салону? Приєднуйтесь до Beauty AI та отримуйте нових клієнтів щодня.",
      partnersCta: "Стати партнером →",
    },
  },
  en: {
    nav: ["Salons", "Masters", "Promotions", "About Beauty AI"],
    loginGoogle: "Sign in",
    heroTitle1: "Find your",
    heroTitle2: "beauty match",
    heroTitle3: "with the help of AI",
    heroEyebrow: "YOUR SMART BEAUTY SEARCH",
    heroSubtitle: "Describe what you need — we'll find the best options nearby",
    searchPlaceholder: "E.g.: manicure in central Kyiv today",
    searchBtn: "Search",
    filters: "Filters",
    partnersLink: "About partners",
    footer: "Beauty AI analyzes your requests and picks the best options just for you",
    sections: {
      recommendations: { title: "Salons For You", subtitle: "Best match for your request" },
      soloMasters: { title: "Masters For You", subtitle: "AI picked these masters for your request" },
      partners: { title: "Partner Offers", subtitle: "Exclusive discounts and promotions" },
      nearby: { title: "Best in Kyiv", subtitle: "Top salons and masters by overall performance" },
      topRated: { title: "Worth Trying", subtitle: "Something new that might catch your eye" },
      fresh: { title: "New on the Platform", subtitle: "New masters and salons for you" },
    },
    cta: "Book now",
    viewSalon: "View salon",
    inSalon: "at the salon",
    avgCheck: "Average check",
    open: "Open",
    available: "Available",
    placeModal: {
      close: "Close",
      reviews: "reviews",
      reviewsTitle: "Client reviews",
      showMoreReviews: "Show more",
      hideReviews: "Hide reviews",
      shownReviews: "Showing",
      ofReviews: "of",
      aboutTitle: "About",
      servicesTitle: "Services & specialties",
      detailsTitle: "Information",
      priceFrom: "Price from",
      averageCheck: "Average check",
      experience: "Experience / team",
      location: "Location",
      status: "Status",
      book: "Book now",
    },
    bookingModal: {
      close: "Close",
      title: "Book a master",
      service: "Service",
      date: "Date",
      time: "Available time",
      contact: "Your phone",
      contactPlaceholder: "+380 00 000 00 00",
      summary: "Your booking",
      confirm: "Confirm booking",
      successTitle: "Booking confirmed!",
      successText: "Done — the time is reserved. We will send you a reminder before the visit.",
      bookingCode: "Booking code",
      done: "Done",
      chooseTime: "Choose a time",
      salonWebsite: "Visit salon website",
    },
    about: {                                    // ← і тут теж
      title: "About Beauty AI",
      description:
        "Beauty AI is a service that helps you find a beauty master in seconds. Describe what you need, and our AI will pick the best salons and masters nearby — based on ratings, prices, and open booking slots.",
      contactsTitle: "Get in touch",
      partnersTitle: "Partnership",
      partnersText:
        "Are you a master or salon owner? Join Beauty AI and get new clients every day.",
      partnersCta: "Become a partner →",
    },
  },
} as const;

type Translations = (typeof dict)[Lang];

type AuthRole = "client" | "master" | "admin";
type AppView = "home" | "dashboard";

type MockUser = {
  name: string;
  email: string;
  role: AuthRole;
  avatar: string;
};

const roleAvatars: Record<AuthRole, string> = {
  client: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop",
  master: "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=320&h=320&fit=crop",
  admin: "https://images.pexels.com/photos/2381069/pexels-photo-2381069.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop",
};

// Дев: йде через Vite proxy (vite.config.ts, ключ "/api") — той самий origin, без CORS/TLS болю.
// Прод-білд: proxy не існує (це чиста статика), тож б'ємо напряму в бекенд —
// бекенд для цього має дозволити прод-домен у CORS_ALLOWED_ORIGINS.
const API_BASE_URL = import.meta.env.DEV ? "" : "https://beautyaiservice.polandcentral.cloudapp.azure.com";

const AUTH_TOKENS_KEY = "beautyai_auth_tokens";

const CLIENT_STATE_KEY = "beautyai_client_state";
const STORED_USER_KEY = "beautyai_session_user";
const MASTER_STATE_PREFIX = "beautyai_master_state:";

function readStoredMasterProfile(email: string): { displayName?: string; avatar?: string } | null {
  try {
    const raw = localStorage.getItem(`${MASTER_STATE_PREFIX}${email.trim().toLowerCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.profile ?? null;
  } catch {
    return null;
  }
}



type StoredMasterService = { id: string; name: string; price: number; duration: number; active: boolean };
type StoredMasterWindow = { id: string; date: string; time: string; duration: number };
type StoredMasterState = {
  profile?: { displayName?: string; specialization?: string; city?: string; salon?: string; about?: string; phone?: string; email?: string; avatar?: string };
  services?: StoredMasterService[];
  windows?: StoredMasterWindow[];
};

function findStoredMasterState(displayName: string): StoredMasterState | null {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(MASTER_STATE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredMasterState;
      if (parsed.profile?.displayName === displayName) return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

type ClientFavorite = {
  title: string; type: string; image: string; rating: number; reviews: number; district: string; distance: string; priceFrom: string; variant?: "solo";
};
type ClientBooking = {
  id: string; title: string; type: string; image: string; service: string; date: string; time: string; phone: string; district: string; priceFrom: string; status: "confirmed" | "completed" | "cancelled"; code: string; createdAt: string; reviewSubmitted?: boolean; pointsAwarded?: boolean;
};
type ClientNotification = { id: string; title: string; text: string; createdAt: string; read: boolean };
type ClientState = { favorites: ClientFavorite[]; bookings: ClientBooking[]; notifications: ClientNotification[]; points: number; registrationBonusAwarded: boolean; profileAvatar?: string };

const emptyClientState = (): ClientState => ({ favorites: [], bookings: [], notifications: [], points: 0, registrationBonusAwarded: false });

function readClientState(): ClientState {
  try {
    const raw = localStorage.getItem(CLIENT_STATE_KEY);
    return raw ? { ...emptyClientState(), ...JSON.parse(raw) } : emptyClientState();
  } catch { return emptyClientState(); }
}

function writeClientState(next: ClientState) {
  localStorage.setItem(CLIENT_STATE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("beautyai:client-state", { detail: next }));
}

function readStoredUser(): MockUser | null {
  try { const raw = sessionStorage.getItem(STORED_USER_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function awardRegistrationBonus() {
  const state = readClientState();
  if (state.registrationBonusAwarded) return;
  const notification: ClientNotification = {
    id: `registration-${Date.now()}`,
    title: "+100 Beauty AI балів",
    text: "Бонус за першу реєстрацію",
    createdAt: new Date().toISOString(),
    read: false,
  };
  writeClientState({ ...state, points: state.points + 100, registrationBonusAwarded: true, notifications: [notification, ...state.notifications] });
}

function toggleClientFavorite(data: CardData) {
  const state = readClientState();
  const exists = state.favorites.some((item) => item.title === data.title);
  const favorites = exists
    ? state.favorites.filter((item) => item.title !== data.title)
    : [{ title: data.title, type: data.type, image: data.image, rating: data.rating, reviews: data.reviews, district: data.district, distance: data.distance, priceFrom: data.priceFrom, variant: data.variant }, ...state.favorites];
  writeClientState({ ...state, favorites });
  return !exists;
}

function saveClientBooking(data: CardData, service: string, date: string, time: string, phone: string, code: string) {
  const state = readClientState();
  const booking: ClientBooking = {
    id: `${code}-${Date.now()}`, title: data.title, type: data.type, image: data.image, service, date, time, phone, district: data.district, priceFrom: data.priceFrom, status: "confirmed", code, createdAt: new Date().toISOString(),
  };
  const notification: ClientNotification = {
    id: `booking-${booking.id}`, title: "Запис підтверджено", text: `${data.title} · ${service} · ${date} ${time}`, createdAt: new Date().toISOString(), read: false,
  };
  writeClientState({ ...state, bookings: [booking, ...state.bookings], notifications: [notification, ...state.notifications] });
}

type AuthTokens = { access: string; refresh: string };

function saveAuthTokens(tokens: AuthTokens) {
  try {
    localStorage.setItem(AUTH_TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // localStorage може бути недоступний (приватний режим тощо) — не критично для роботи форми
  }
}

function clearAuthTokens() {
  try {
    localStorage.removeItem(AUTH_TOKENS_KEY);
  } catch {
    // ignore
  }
}

// GET /api/users/me/ -> визначаємо роль з is_staff/is_master (бекенд не віддає окреме поле role)
function resolveRoleFromProfile(profile: any): AuthRole {
  if (profile?.is_staff) return "admin";
  if (profile?.is_master) return "master";
  return "client";
}

function AuthModal({
  lang,
  onClose,
  onAuthenticated,
  initialMode = "login",
  initialRole = "client",
  initialPartnerKind,
}: {
  lang: Lang;
  onClose: () => void;
  onAuthenticated: (user: MockUser) => void;
  initialMode?: "login" | "register";
  initialRole?: Exclude<AuthRole, "admin">;
  initialPartnerKind?: "solo" | "salon";
}) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [role, setRole] = useState<Exclude<AuthRole, "admin">>(initialRole);
  const [partnerKind] = useState<"solo" | "salon" | undefined>(initialPartnerKind);
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [googlePickerOpen, setGooglePickerOpen] = useState(false);
  const [googlePickingRole, setGooglePickingRole] = useState<AuthRole | null>(null);

  const ua = lang === "ua";

  const finishAuth = (authRole: AuthRole = role) => {
    const fallbackEmail =
      authRole === "master"
        ? "master@beautyai.demo"
        : authRole === "admin"
          ? "admin@beautyai.demo"
          : "client@beautyai.demo";

    onAuthenticated({
      name:
        authRole === "master"
          ? partnerKind === "salon" && businessName.trim()
            ? businessName.trim()
            : ua ? "Майстер Beauty AI" : "Beauty AI Master"
          : authRole === "admin"
            ? "Beauty AI Admin"
            : ua ? "Клієнт Beauty AI" : "Beauty AI Client",
      email: email || fallbackEmail,
      role: authRole,
      avatar: roleAvatars[authRole],
    });
  };

  // Реальний логін: POST /api/users/token/ (email+password) → JWT access/refresh → GET /api/users/me/ для профілю й ролі
  const loginWithPassword = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const tokenRes = await fetch(`${API_BASE_URL}/api/users/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => null);
        throw new Error(
          body?.detail ||
            (ua ? "Невірний email або пароль" : "Invalid email or password")
        );
      }

      const tokens = await tokenRes.json(); // { access, refresh }
      if (tokens.access && tokens.refresh) {
        saveAuthTokens({ access: tokens.access, refresh: tokens.refresh });
      }

      const meRes = await fetch(`${API_BASE_URL}/api/users/me/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (!meRes.ok) {
        throw new Error(ua ? "Не вдалося завантажити профіль" : "Failed to load profile");
      }
      const profile = await meRes.json();
      const authRole = resolveRoleFromProfile(profile);

      onAuthenticated({
        name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || (ua ? "Beauty AI користувач" : "Beauty AI user"),
        email: profile.email || email,
        role: authRole,
        avatar: profile.photo || roleAvatars[authRole],
      });
    } catch (err: any) {
      setAuthError(err.message || (ua ? "Сталася помилка. Спробуйте ще раз." : "Something went wrong. Try again."));
    } finally {
      setAuthLoading(false);
    }
  };

  const currentClientAvatar = readClientState().profileAvatar || roleAvatars.client;
  const storedDemoMaster = readStoredMasterProfile("beauty.master@gmail.com");
  const fakeGoogleAccounts: { role: AuthRole; name: string; email: string; avatar: string }[] = [
    { role: "client", name: ua ? "Ірина Клієнтка" : "Irene Client", email: "irene.client@gmail.com", avatar: currentClientAvatar },
    { role: "master", name: storedDemoMaster?.displayName || (ua ? "Майстер Beauty" : "Beauty Master"), email: "beauty.master@gmail.com", avatar: storedDemoMaster?.avatar || roleAvatars.master },
    { role: "admin", name: ua ? "Адмін Beauty AI" : "Beauty AI Admin", email: "admin.beautyai@gmail.com", avatar: roleAvatars.admin },
  ];

  const pickGoogleAccount = (account: (typeof fakeGoogleAccounts)[number]) => {
    setGooglePickingRole(account.role);
    // Невелика штучна затримка — щоб виглядало як справжній вхід, а не миттєвий клік
    setTimeout(() => {
      setGooglePickerOpen(false);
      setGooglePickingRole(null);
      const storedMaster = account.role === "master" ? readStoredMasterProfile(account.email) : null;
      const latestAvatar = account.role === "client"
        ? (readClientState().profileAvatar || account.avatar)
        : account.role === "master"
          ? (storedMaster?.avatar || account.avatar)
          : account.avatar;
      onAuthenticated({
        name: account.role === "master" ? (storedMaster?.displayName || account.name) : account.name,
        email: account.email,
        role: account.role,
        avatar: latestAvatar,
      });
    }, 700);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "login") {
      loginWithPassword();
      return;
    }
    // Реєстрація поки що лишається демо-заглушкою (не запитували підключення /api/users/register/)
    finishAuth(role);
  };

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="auth-close" type="button" onClick={onClose} aria-label={ua ? "Закрити" : "Close"}>
          ×
        </button>

        <div className="auth-brand">
          <div className="auth-title-row">
            <span className="auth-title-icon" aria-hidden="true" />

            <h2 id="auth-title">
              {mode === "login"
                ? ua
                  ? "Раді бачити вас знову"
                  : "Welcome back"
                : ua
                  ? "Створіть свій профіль"
                  : "Create your profile"}
            </h2>
          </div>

          <p>
            {mode === "login"
              ? ua
                ? "Увійдіть, щоб керувати записами, обраним і профілем."
                : "Sign in to manage bookings, favourites and your profile."
              : ua
                ? "Оберіть тип профілю — решту даних підключимо до API після запуску сервера."
                : "Choose a profile type — the API will be connected when the server is online."}
          </p>
        </div>

        <div className="auth-tabs" role="tablist">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
            {ua ? "Увійти" : "Sign in"}
          </button>
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>
            {ua ? "Реєстрація" : "Register"}
          </button>
        </div>

        {mode === "register" && (
          <div className="auth-role-switch" aria-label={ua ? "Тип профілю" : "Profile type"}>
            <button className={role === "client" ? "active" : ""} type="button" onClick={() => setRole("client")}>
              {ua ? "Я клієнт" : "I'm a client"}
            </button>
            <button className={role === "master" ? "active" : ""} type="button" onClick={() => setRole("master")}>
              {ua ? "Я майстер" : "I'm a master"}
            </button>
          </div>
        )}

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && role === "master" && partnerKind === "salon" && (
            <>
              <p className="auth-partner-note">
                {ua ? "Реєстрація закладу — після заповнення підключимо ваш салон до Beauty AI." : "Business registration — we'll connect your salon to Beauty AI after this step."}
              </p>
              <label>
                <span>{ua ? "Назва закладу" : "Business name"}</span>
                <input
                  type="text"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder={ua ? "Наприклад, Luna Beauty House" : "e.g. Luna Beauty House"}
                  required
                />
              </label>
            </>
          )}

          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />
          </label>
          <label>
            <span>{ua ? "Пароль" : "Password"}</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required />
          </label>

          {mode === "login" && (
            <button className="auth-forgot" type="button">
              {ua ? "Забули пароль?" : "Forgot password?"}
            </button>
          )}

          {mode === "login" && authError && <p className="auth-google-error">{authError}</p>}

          <button className="auth-primary" type="submit" disabled={mode === "login" && authLoading}>
            {mode === "login"
              ? authLoading
                ? (ua ? "Входимо…" : "Signing in…")
                : (ua ? "Увійти" : "Sign in")
              : (ua ? "Створити акаунт" : "Create account")}
          </button>
        </form>

        <div className="auth-divider"><span>{ua ? "або" : "or"}</span></div>

        <button className="auth-google" type="button" onClick={() => setGooglePickerOpen(true)}>
          <span className="google-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
              />
            </svg>
          </span>
          {ua ? "Продовжити з Google" : "Continue with Google"}
        </button>

        <p className="auth-demo-note">
          {ua
            ? "Вхід через email/пароль уже підключений до бекенду. Реєстрація та Google — поки що демо."
            : "Email/password sign-in is wired to the real backend. Register and Google are still demo."}
        </p>
      </div>

      {googlePickerOpen && (
        <div
          className="google-picker-backdrop"
          role="presentation"
          onMouseDown={() => !googlePickingRole && setGooglePickerOpen(false)}
        >
          <div className="google-picker-window" onMouseDown={(event) => event.stopPropagation()}>
            <div className="google-picker-titlebar">
              <span className="google-picker-url">accounts.google.com</span>
              <button
                type="button"
                className="google-picker-close"
                onClick={() => setGooglePickerOpen(false)}
                aria-label={ua ? "Закрити" : "Close"}
                disabled={!!googlePickingRole}
              >
                ×
              </button>
            </div>

            <div className="google-picker-body">
              <span className="google-mark google-mark-lg" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
                  <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
                  <path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z" />
                  <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z" />
                </svg>
              </span>
              <h3>{ua ? "Оберіть обліковий запис" : "Choose an account"}</h3>
              <p>{ua ? "щоб продовжити в Beauty AI" : "to continue to Beauty AI"}</p>

              <div className="google-picker-list">
                {fakeGoogleAccounts.map((account) => {
                  const isPicking = googlePickingRole === account.role;
                  return (
                    <button
                      key={account.email}
                      type="button"
                      className="google-picker-account"
                      onClick={() => !googlePickingRole && pickGoogleAccount(account)}
                      disabled={!!googlePickingRole && !isPicking}
                    >
                      <img src={account.avatar} alt={account.name} />
                      <span className="google-picker-account-info">
                        <b>{account.name}</b>
                        <span>{account.email}</span>
                      </span>
                      {isPicking && <span className="google-picker-spinner" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>

              <p className="google-picker-footnote">
                {ua
                  ? "Демо-імітація вибору акаунта Google — реальна авторизація Google підключиться пізніше."
                  : "Demo simulation of Google's account picker — real Google auth will be wired later."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FavButton({ data }: { data: CardData }) {
  const [active, setActive] = useState(() => Boolean(readStoredUser()) && readClientState().favorites.some((item) => item.title === data.title));

  useEffect(() => {
    const sync = () => setActive(Boolean(readStoredUser()) && readClientState().favorites.some((item) => item.title === data.title));
    window.addEventListener("beautyai:client-state", sync as EventListener);
    window.addEventListener("beautyai:auth-changed", sync as EventListener);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("beautyai:client-state", sync as EventListener); window.removeEventListener("beautyai:auth-changed", sync as EventListener); window.removeEventListener("storage", sync); };
  }, [data.title]);

  return (
    <button
      className={`fav-btn ${active ? "active" : ""}`}
      aria-label={active ? "Прибрати з обраного" : "Додати в обране"}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!readStoredUser()) {
          window.dispatchEvent(new CustomEvent("beautyai:auth-required", { detail: { data, action: "favorite" } }));
          return;
        }
        setActive(toggleClientFavorite(data));
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}



const SALON_WEBSITES: Record<string, string> = {
  "Luna Beauty House": "https://example.com/?salon=luna-beauty-house",
  "Nails Studio": "https://example.com/?salon=nails-studio",
  "Beauty Room": "https://example.com/?salon=beauty-room",
  "Velvet Nails & Spa": "https://example.com/?salon=velvet-nails-spa",
  "Wellness Studio": "https://example.com/?salon=wellness-studio",
  "Brow Bar": "https://example.com/?salon=brow-bar",
  "Élan Studio": "https://example.com/?salon=elan-studio",
  "Atelier Beauty": "https://example.com/?salon=atelier-beauty",
  "Beauty Point": "https://example.com/?salon=beauty-point",
  "Metro Beauty": "https://example.com/?salon=metro-beauty",
  "Elegant Beauty": "https://example.com/?salon=elegant-beauty",
  "Perfect Look": "https://example.com/?salon=perfect-look",
};

function getSalonWebsite(name: string, explicit?: string) {
  return explicit ?? SALON_WEBSITES[name] ?? `https://example.com/?salon=${encodeURIComponent(name)}`;
}

function openSalonWebsite(name: string, explicit?: string) {
  window.open(getSalonWebsite(name, explicit), "_blank", "noopener,noreferrer");
}

function getBookingDates() {
  const formatter = new Intl.DateTimeFormat("uk-UA", { weekday: "short", day: "2-digit", month: "short" });
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      value: date.toISOString().slice(0, 10),
      label: formatter.format(date),
    };
  });
}

const BOOKING_TIMES = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30"];

function getAvailableTimes(masterName: string, date: string) {
  const seed = Array.from(`${masterName}-${date}`).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return BOOKING_TIMES.filter((_, index) => (seed + index * 3) % 5 !== 0);
}

function BookingModal({
  data,
  t,
  onClose,
}: {
  data: CardData;
  t: Translations;
  onClose: () => void;
}) {
  const dates = getBookingDates();
  const storedMaster = data.variant === "solo" ? findStoredMasterState(data.title) : null;
  const storedServices = (storedMaster?.services ?? []).filter((item) => item.active);
  const services = storedServices.length ? storedServices.map((item) => item.name) : (data.tags.length ? data.tags : [data.type]);
  const [service, setService] = useState(services[0]);
  const [date, setDate] = useState(dates[0]?.value ?? "");
  const [time, setTime] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const storedTimes = (storedMaster?.windows ?? []).filter((slot) => slot.date === date).map((slot) => slot.time);
  const times = storedTimes.length ? storedTimes : getAvailableTimes(data.title, date);
  const selectedStoredService = storedServices.find((item) => item.name === service);
  const selectedPriceFrom = selectedStoredService ? String(selectedStoredService.price) : data.priceFrom;
  const bookingCode = `BA-${data.title.replace(/[^A-Za-zА-Яа-яІіЇїЄє0-9]/g, "").slice(0, 3).toUpperCase()}-${date.replace(/-/g, "").slice(4)}-${time.replace(":", "")}`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="booking-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="booking-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="booking-modal-close" onClick={onClose} aria-label={t.bookingModal.close}>×</button>

        {!confirmed ? (
          <>
            <div className="booking-modal-head">
              <img src={data.image} alt="" />
              <div>
                <span>{t.bookingModal.title}</span>
                <h2>{data.title}</h2>
                <p>{data.type}</p>
              </div>
            </div>

            <div className="booking-modal-body">
              <label className="booking-field">
                <span>{t.bookingModal.service}</span>
                <select value={service} onChange={(event) => setService(event.target.value)}>
                  {services.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>

              <div className="booking-field">
                <span>{t.bookingModal.date}</span>
                <div className="booking-date-grid">
                  {dates.map((item) => (
                    <button key={item.value} type="button" className={date === item.value ? "active" : ""} onClick={() => { setDate(item.value); setTime(""); }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="booking-field">
                <span>{t.bookingModal.time}</span>
                <div className="booking-time-grid">
                  {times.map((slot) => (
                    <button key={slot} type="button" className={time === slot ? "active" : ""} onClick={() => setTime(slot)}>{slot}</button>
                  ))}
                </div>
                {!time && <small>{t.bookingModal.chooseTime}</small>}
              </div>

              <label className="booking-field">
                <span>{t.bookingModal.contact}</span>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={t.bookingModal.contactPlaceholder} inputMode="tel" />
              </label>

              <div className="booking-summary">
                <strong>{t.bookingModal.summary}</strong>
                <span>{service}</span>
                <span>{dates.find((item) => item.value === date)?.label} {time ? `· ${time}` : ""}</span>
                <span>{data.title} · {data.district}</span>
                <b>{selectedPriceFrom} грн+</b>
              </div>

              <button type="button" className="cta-btn booking-confirm-btn" disabled={!date || !time || phone.trim().length < 7} onClick={() => { saveClientBooking({ ...data, priceFrom: selectedPriceFrom }, service, date, time, phone, bookingCode); setConfirmed(true); }}>
                {t.bookingModal.confirm}
              </button>
            </div>
          </>
        ) : (
          <div className="booking-success">
            <div className="booking-success-icon">✓</div>
            <h2>{t.bookingModal.successTitle}</h2>
            <p>{t.bookingModal.successText}</p>
            <div className="booking-success-card">
              <strong>{data.title}</strong>
              <span>{service}</span>
              <span>{dates.find((item) => item.value === date)?.label} · {time}</span>
              <span>{data.district}</span>
            </div>
            <div className="booking-code"><span>{t.bookingModal.bookingCode}</span><strong>{bookingCode}</strong></div>
            <button type="button" className="cta-btn booking-done-btn" onClick={onClose}>{t.bookingModal.done}</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function getPlaceReviews(data: CardData, t: Translations): CardReview[] {
  if (data.reviewsList?.length) return data.reviewsList;

  const ua = t.placeModal.close === "Закрити";
  return data.variant === "solo"
    ? [
        {
          author: ua ? "Олена" : "Olena",
          rating: 5,
          text: ua
            ? `Дуже уважний майстер. ${data.title} усе пояснила перед процедурою, а результат вийшов саме таким, як я хотіла.`
            : `A very attentive master. ${data.title} explained everything before the service and the result was exactly what I wanted.`,
          date: "28.08.2026",
        },
        {
          author: ua ? "Марія" : "Maria",
          rating: 5,
          text: ua
            ? "Приємна комунікація, чисто й комфортно. Окремий плюс — запис без затримок."
            : "Great communication, clean and comfortable. Extra points for starting exactly on time.",
          date: "19.08.2026",
        },
        {
          author: ua ? "Ірина" : "Iryna",
          rating: 4,
          text: ua
            ? "Все сподобалось, результат тримається чудово. Повернуся ще."
            : "Loved the result and it is holding up beautifully. I would book again.",
          date: "07.08.2026",
        },
      ]
    : [
        {
          author: ua ? "Анна" : "Anna",
          rating: 5,
          text: ua
            ? `Дуже красивий простір і уважна команда. У ${data.title} легко підібрали майстра під мій запит.`
            : `Beautiful space and a very attentive team. ${data.title} matched me with the right specialist for what I needed.`,
          date: "30.08.2026",
        },
        {
          author: ua ? "Катерина" : "Kateryna",
          rating: 5,
          text: ua
            ? "Все організовано чітко: швидко підтвердили запис, прийняли вчасно, результат супер."
            : "Everything was well organized: quick confirmation, on-time appointment, and a great result.",
          date: "21.08.2026",
        },
        {
          author: ua ? "Юлія" : "Yulia",
          rating: 4,
          text: ua
            ? "Сподобалась атмосфера і сервіс. Ціни відповідають рівню салону."
            : "Loved the atmosphere and service. The prices match the quality of the salon.",
          date: "10.08.2026",
        },
      ];
}

function PlaceDetailsModal({
  data,
  t,
  onClose,
  onBook,
  onLocationClick,
}: {
  data: CardData;
  t: Translations;
  onClose: () => void;
  onBook: () => void;
  onLocationClick?: (name: string, district: string, distance: string) => void;
}) {
  const isSolo = data.variant === "solo";
  const reviews = getPlaceReviews(data, t);
  const [reviewsOpen, setReviewsOpen] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="place-modal-overlay"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="place-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="place-modal-close"
          onClick={onClose}
          aria-label={t.placeModal.close}
        >
          ×
        </button>

        <div
          className={`place-modal-hero ${isSolo ? "place-modal-hero-solo" : "place-modal-hero-salon"}`}
          style={{ ["--place-modal-photo" as string]: `url(${data.image})` }}
        >
          <div className="place-modal-hero-shade" />

          <div className="place-modal-hero-copy">
            <p>{data.type}</p>
            <h2 id="place-modal-title">{data.title}</h2>
            <button
              type="button"
              className="place-modal-rating"
              aria-label={`${data.rating.toFixed(1)}, ${data.reviews} ${t.placeModal.reviews}`}
              onClick={() => {
                setReviewsOpen(true);
                requestAnimationFrame(() => {
                  document
                    .querySelector(".place-modal-reviews")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
            >
              <span className="star">★</span>
              <strong>{data.rating.toFixed(1)}</strong>
              <span>({data.reviews} {t.placeModal.reviews})</span>
            </button>
          </div>
        </div>

        <div className="place-modal-body">
          <div className="place-modal-primary-meta">
            <button
              type="button"
              className="card-location-link place-modal-location-link"
              onClick={() => onLocationClick?.(data.title, data.district, data.distance)}
              title={t.placeModal.location}
            >
              <span className="district-pin">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {data.district}
              </span>
              <span>· {data.distance}</span>
            </button>
            <span className="open-now">
              ● {isSolo ? t.available : t.open}
            </span>
          </div>

          <section className="place-modal-section">
            <h3>{t.placeModal.aboutTitle}</h3>
            <p className="place-modal-description">
              {data.description ??
                data.why ??
                (isSolo
                  ? `${data.title} — ${data.type.toLowerCase()}.`
                  : `${data.title} — ${data.type.toLowerCase()} у районі ${data.district}.`)}
            </p>
          </section>

          {!!data.tags.length && (
            <section className="place-modal-section">
              <h3>{t.placeModal.servicesTitle}</h3>
              <div className="place-modal-tags">
                {data.tags.map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="place-modal-section">
            <h3>{t.placeModal.detailsTitle}</h3>
            <div className="place-modal-facts">
              <div>
                <span>{t.placeModal.priceFrom}</span>
                <strong>{data.priceFrom} грн</strong>
              </div>

              {data.avgCheck && (
                <div>
                  <span>{t.placeModal.averageCheck}</span>
                  <strong>{data.avgCheck}</strong>
                </div>
              )}

              {(data.experience ?? data.mastersCount) && (
                <div>
                  <span>{t.placeModal.experience}</span>
                  <strong>{data.experience ?? data.mastersCount}</strong>
                </div>
              )}

            </div>
          </section>

          <section className="place-modal-section place-modal-reviews">
            <h3>{t.placeModal.reviewsTitle}</h3>

            <div className="place-modal-review-list">
              {reviews.slice(0, reviewsOpen ? 3 : 1).map((review, index) => (
                <article
                  className="place-modal-review"
                  key={`${review.author}-${review.date ?? index}`}
                >
                  <div className="place-modal-review-head">
                    <strong>{review.author}</strong>
                    {review.date && <span>{review.date}</span>}
                  </div>

                  <div
                    className="place-modal-review-stars"
                    aria-label={`${review.rating} / 5`}
                  >
                    {Array.from({ length: 5 }, (_, starIndex) => (
                      <span
                        key={starIndex}
                        className={starIndex < review.rating ? "active" : ""}
                      >
                        ★
                      </span>
                    ))}
                  </div>

                  <p>{review.text}</p>
                </article>
              ))}
            </div>

            {reviews.length > 1 && (
              <button
                type="button"
                className="place-modal-reviews-toggle"
                onClick={() => setReviewsOpen((prev) => !prev)}
                aria-expanded={reviewsOpen}
              >
                <span>
                  {reviewsOpen
                    ? t.placeModal.hideReviews
                    : `${t.placeModal.showMoreReviews} ${Math.min(2, reviews.length - 1)}`}
                </span>
                <span className={`place-modal-reviews-arrow ${reviewsOpen ? "open" : ""}`} aria-hidden="true">⌄</span>
              </button>
            )}
          </section>

          <button type="button" className="cta-btn place-modal-cta" onClick={onBook}>
            {isSolo ? t.placeModal.book : t.bookingModal.salonWebsite}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Card({
  data,
  t,
  hideTags = false,
  hideReason = false,
  onLocationClick,
}: {
  data: CardData;
  t: Translations;
  hideTags?: boolean;
  hideReason?: boolean;
  onLocationClick?: (name: string, district: string, distance: string) => void;
}) {
  const [showReason, setShowReason] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const isSolo = data.variant === "solo";

  const handleBook = () => {
    if (isSolo) {
      setShowProfile(false);
      if (!readStoredUser()) {
        window.dispatchEvent(new CustomEvent("beautyai:auth-required", { detail: { data, action: "booking" } }));
        return;
      }
      setShowBooking(true);
      return;
    }
    openSalonWebsite(data.title, data.website);
  };

  return (
    <div className={`card ${isSolo ? "card-solo" : ""}`}>
      <div
        className={`card-image ${isSolo ? "card-image-solo" : ""}`}
        style={{ ['--card-photo' as string]: `url(${data.image})` }}
      >
        <div className="card-badges">
          {data.badges.map((b) => (
            <span key={b.text} className={`badge ${b.kind}`}>
              {b.text}
            </span>
          ))}
        </div>
        <FavButton data={data} />
      </div>

      <div className="card-body">
        <div className="card-title-row">
          <div>
            <h3>{data.title}</h3>
            <p className="card-type">{data.type}</p>
          </div>
          <button
            type="button"
            className="card-rating card-rating-button"
            onClick={() => setShowProfile(true)}
            aria-label={`${data.rating.toFixed(1)}, ${data.reviews} ${t.placeModal.reviews}`}
          >
            <span className="star">★</span>
            <span>{data.rating.toFixed(1)}</span>
            <span className="count">({data.reviews})</span>
          </button>
        </div>

        <div className="card-meta">
          <button
            type="button"
            className="card-location-link"
            onClick={() => onLocationClick?.(data.title, data.district, data.distance)}
            title="Показати на карті"
          >
            <span className="district-pin">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#a855f7"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {data.district}
            </span>
            <span>· {data.distance}</span>
          </button>
          </div>

          <div className="card-status-row">
            <span className="open-now">
              ● {isSolo ? t.available : t.open}
            </span>
          </div>

          <div className="card-footer">
          <div className="price-block">
            <div className="price">від {data.priceFrom} грн</div>
            <div className="avg">{data.avgCheck ?? t.avgCheck}</div>
          </div>
          <div className="masters-block">
            {(data.experience ?? data.mastersCount) && <div>🕐 {data.experience ?? data.mastersCount}</div>}
            <div>{data.locationNote ?? t.inSalon}</div>
          </div>
        </div>

        <div className="card-cta-row">
          <button type="button" className="cta-btn" onClick={handleBook}>
            {isSolo ? t.cta : t.bookingModal.salonWebsite}
          </button>
          <button
            type="button"
            className="view-link"
            onClick={() => setShowProfile(true)}
          >
            {data.profileLinkLabel ?? t.viewSalon} →
          </button>
        </div>

        {data.why && !hideReason && (
          <div className={`ai-reason ${showReason ? "is-open" : ""}`}>
            <button
              type="button"
              className="ai-reason-toggle"
              onClick={() => setShowReason((prev) => !prev)}
              aria-expanded={showReason}
            >
              <span className="ai-reason-label">✦ Чому рекомендуємо?</span>
              <span className="ai-reason-chevron" aria-hidden="true">⌄</span>
            </button>

            <div className="ai-reason-content">
              <div className="ai-reason-inner">
                <p>{data.why}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {showProfile && (
        <PlaceDetailsModal
          data={data}
          t={t}
          onClose={() => setShowProfile(false)}
          onBook={handleBook}
          onLocationClick={onLocationClick}
        />
      )}

      {showBooking && (
        <BookingModal data={data} t={t} onClose={() => setShowBooking(false)} />
      )}
    </div>
  );
}


const recommendations: CardData[] = [
  {
    image: "https://images.pexels.com/photos/7750114/pexels-photo-7750114.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
    badges: [{ text: "AI MATCH 98%", kind: "ai-match" }],
    title: "Luna Beauty House",
    type: "Салон краси",
    rating: 4.9,
    reviews: 124,
    district: "Печерський р-н",
    distance: "0.4 км",
    openNow: true,
    tags: ["Манікюр", "Педикюр", "Гель-лак", "Дизайн нігтів"],
    priceFrom: "600",
    mastersCount: "7 майстрів",
    why: "Високий рейтинг, спеціалізація на манікюрі, зручна локація та вільні вікна сьогодні",
  },
  {
    image: "https://images.pexels.com/photos/7195808/pexels-photo-7195808.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
    badges: [{ text: "AI MATCH 94%", kind: "ai-match" }],
    title: "Nails Studio",
    type: "Салон краси",
    rating: 4.8,
    reviews: 98,
    district: "Печерський р-н",
    distance: "0.6 км",
    openNow: true,
    tags: ["Манікюр", "Нарощування", "Дизайн", "SPA"],
    priceFrom: "550",
    mastersCount: "5 майстрів",
    why: "Чудові відгуки та оптимальне співвідношення ціна-якість для вашого запиту",
  },
  {
    image: "https://images.pexels.com/photos/7750115/pexels-photo-7750115.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
    badges: [
      { text: "AI MATCH 93%", kind: "ai-match" },
      { text: "НОВИНКА", kind: "new" },
    ],
    title: "Beauty Room",
    type: "Салон краси",
    rating: 4.7,
    reviews: 76,
    district: "Печерський р-н",
    distance: "0.8 км",
    openNow: true,
    tags: ["Манікюр", "Педикюр", "Нарощування вій", "Брови"],
    priceFrom: "650",
    mastersCount: "5 майстрів",
    why: "Підходить вашому бюджету та має багато позитивних відгуків",
  },
  {
    image: "https://images.pexels.com/photos/7750091/pexels-photo-7750091.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
    badges: [{ text: "AI MATCH 89%", kind: "ai-match" }],
    title: "Velvet Nails & Spa",
    type: "Салон краси",
    rating: 4.8,
    reviews: 61,
    district: "Печерський р-н",
    distance: "0.9 км",
    openNow: true,
    tags: ["Манікюр", "Педикюр", "SPA", "Масаж"],
    priceFrom: "580",
    mastersCount: "6 майстрів",
    why: "Стабільно високі оцінки за якість сервісу та зручний графік роботи",
  },

  {
    image: "https://images.pexels.com/photos/7750117/pexels-photo-7750117.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
    badges: [{ text: "AI MATCH 87%", kind: "ai-match" }],
    title: "Atelier Beauty",
    type: "Салон краси",
    rating: 4.8,
    reviews: 103,
    district: "Центр",
    distance: "1.2 км",
    openNow: true,
    tags: ["Стрижка", "Фарбування", "Догляд"],
    priceFrom: "650",
    mastersCount: "6 майстрів",
    why: "Сильні відгуки, зручна локація та послуги, що відповідають вашому запиту",
  },
  {
    image: "https://images.pexels.com/photos/7750116/pexels-photo-7750116.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
    badges: [{ text: "AI MATCH 85%", kind: "ai-match" }, { text: "НОВИНКА", kind: "new" }],
    title: "Élan Studio",
    type: "Студія краси",
    rating: 4.9,
    reviews: 72,
    district: "Липки",
    distance: "1.4 км",
    tags: ["Брови", "Вії", "Макіяж"],
    priceFrom: "600",
    mastersCount: "4 майстри",
    why: "Високий рейтинг і сильна спеціалізація на beauty-послугах, які ви переглядали",
  },

];

const soloMastersRecommendations: CardData[] = [
  {
    image: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=700&h=900&fit=crop",
    badges: [{ text: "AI MATCH 96%", kind: "ai-match" }],
    title: "Оксана Мельник",
    type: "Соло майстер · Манікюр",
    rating: 4.9,
    reviews: 143,
    district: "Печерський р-н",
    distance: "0.5 км",
    tags: ["Манікюр", "Гель-лак", "Дизайн нігтів"],
    priceFrom: "500",
    experience: "6 років досвіду",
    locationNote: "Приймає у своїй студії",
    profileLinkLabel: "Профіль майстра",
    variant: "solo",
    why: "Високий рейтинг та вузька спеціалізація саме на манікюрі, який ви шукали",
  },
  {
    image: "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=700&h=900&fit=crop",
    badges: [{ text: "AI MATCH 92%", kind: "ai-match" }],
    title: "Дмитро Кравець",
    type: "Соло майстер · Барбер",
    rating: 4.8,
    reviews: 201,
    district: "Печерський р-н",
    distance: "0.9 км",
    tags: ["Стрижка", "Борода", "Укладка"],
    priceFrom: "400",
    experience: "8 років досвіду",
    locationNote: "Приймає у своєму кабінеті",
    profileLinkLabel: "Профіль майстра",
    variant: "solo",
    why: "Один з найдосвідченіших барберів поруч із вами, з великою кількістю відгуків",
  },
  {
    image: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=700&h=900&fit=crop",
    badges: [{ text: "AI MATCH 90%", kind: "ai-match" }],
    title: "Ірина Бондар",
    type: "Соло майстер · Брови та вії",
    rating: 5.0,
    reviews: 87,
    district: "Липки",
    distance: "1.1 км",
    tags: ["Брови", "Вії", "Ламінування"],
    priceFrom: "600",
    experience: "5 років досвіду",
    locationNote: "Виїзд та прийом у кабінеті",
    profileLinkLabel: "Профіль майстра",
    variant: "solo",
    why: "Ідеальний рейтинг 5.0 та спеціалізація саме на бровах і віях",
  },
  {
    image: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=700&h=900&fit=crop",
    badges: [{ text: "AI MATCH 87%", kind: "ai-match" }],
    title: "Марина Кузьменко",
    type: "Соло майстер · Візаж",
    rating: 4.9,
    reviews: 112,
    district: "Липки",
    distance: "1.3 км",
    tags: ["Візаж", "Укладка", "Брови"],
    priceFrom: "700",
    experience: "7 років досвіду",
    locationNote: "Виїзний майстер",
    profileLinkLabel: "Профіль майстра",
    variant: "solo",
    why: "Багато відгуків саме за святковий та весільний візаж",
  },

  {
    image: "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=700&h=900&fit=crop",
    badges: [{ text: "AI MATCH 85%", kind: "ai-match" }],
    title: "Софія Левченко",
    type: "Косметолог",
    rating: 4.8,
    reviews: 96,
    district: "Печерськ",
    distance: "1.5 км",
    tags: ["Косметологія", "Догляд", "Чистка"],
    priceFrom: "800",
    experience: "6 років досвіду",
    locationNote: "Приймає у власному кабінеті",
    profileLinkLabel: "Профіль майстра",
    variant: "solo",
    why: "Високі оцінки за доглядові процедури та зручний час запису",
  },
  {
    image: "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=700&h=900&fit=crop",
    badges: [{ text: "AI MATCH 83%", kind: "ai-match" }],
    title: "Андрій Савчук",
    type: "Стиліст",
    rating: 4.9,
    reviews: 131,
    district: "Центр",
    distance: "1.7 км",
    tags: ["Стрижка", "Укладка", "Фарбування"],
    priceFrom: "700",
    experience: "9 років досвіду",
    locationNote: "Приймає у приватній студії",
    profileLinkLabel: "Профіль майстра",
    variant: "solo",
    why: "Високий рейтинг, великий досвід і сильний збіг із вашими фільтрами",
  },

];

const partners: PartnerOffer[] = [
  {
    image: "https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=800&h=520&fit=crop",
    discount: "-30%",
    validUntil: "до 30 червня",
    title: "Комплекс для волосся",
    partner: "Luna Beauty House",
    rating: 4.9,
    reviews: 124,
    district: "Печерський р-н",
    distance: "0.4 км",
    openNow: true,
    oldPrice: "1 200",
    newPrice: "840",
    gift: "Укладка у подарунок",
  },
  {
    image: "https://images.pexels.com/photos/3757942/pexels-photo-3757942.jpeg?auto=compress&cs=tinysrgb&w=800&h=520&fit=crop",
    discount: "-20%",
    validUntil: "до 25 червня",
    title: "Масаж спини",
    partner: "Wellness Studio",
    rating: 4.8,
    reviews: 93,
    district: "Липки",
    distance: "0.7 км",
    openNow: true,
    oldPrice: "900",
    newPrice: "720",
    gift: "Ароматерапія у подарунок",
  },
  {
    image: "https://images.pexels.com/photos/3997391/pexels-photo-3997391.jpeg?auto=compress&cs=tinysrgb&w=800&h=520&fit=crop",
    discount: "-25%",
    validUntil: "до 20 червня",
    title: "Манікюр + гель-лак",
    partner: "Nails Studio",
    rating: 4.8,
    reviews: 98,
    district: "Золоті ворота",
    distance: "0.9 км",
    openNow: true,
    oldPrice: "800",
    newPrice: "600",
    gift: "Дизайн 2 нігтів у подарунок",
  },
  {
    image: "https://images.pexels.com/photos/3993324/pexels-photo-3993324.jpeg?auto=compress&cs=tinysrgb&w=800&h=520&fit=crop",
    discount: "-15%",
    validUntil: "до 15 червня",
    title: "Брови + ламінування",
    partner: "Brow Bar",
    rating: 4.7,
    reviews: 84,
    district: "Центр",
    distance: "1.1 км",
    openNow: false,
    oldPrice: "1 000",
    newPrice: "850",
    gift: "Корекція у подарунок",
  },
  {
    image: "https://images.pexels.com/photos/3997983/pexels-photo-3997983.jpeg?auto=compress&cs=tinysrgb&w=800&h=520&fit=crop",
    discount: "-20%",
    validUntil: "до 12 липня",
    title: "Стрижка + укладка",
    partner: "Élan Studio",
    rating: 4.9,
    reviews: 172,
    district: "Липки",
    distance: "1.3 км",
    openNow: true,
    oldPrice: "1 100",
    newPrice: "880",
    gift: "Догляд для волосся",
  },
  {
    image: "https://images.pexels.com/photos/3764014/pexels-photo-3764014.jpeg?auto=compress&cs=tinysrgb&w=800&h=520&fit=crop",
    discount: "-25%",
    validUntil: "до 18 липня",
    title: "Догляд для обличчя",
    partner: "Atelier Beauty",
    rating: 4.8,
    reviews: 119,
    district: "Печерськ",
    distance: "1.5 км",
    openNow: true,
    oldPrice: "1 600",
    newPrice: "1 200",
    gift: "Маска у подарунок",
  },
];
const nearby: CardData[] = [
  {
    image: "https://images.openai.com/static-rsc-4/Sdyxiwwe1san-rxTJmneyPfBnIXhc9o_TpIDDLsqRAP38W358_vG-s9JhQ63Mq1DhfN6HfNt1xbDolkTaZE1kIK2q1-XCUQ7lVoSVlNaxWWhzKCZ0cOL-TXvrsyjCUj1AZwmllRow88GnGAliPMmbq2uUjhD9P82zQatVEqq6u2reGLZCK9t5w1dXgDKvOO0?purpose=fullsize",
    badges: [{ text: "ВИБІР BEAUTY AI", kind: "client-choice" }],
    title: "Beauty Point",
    type: "Салон краси",
    rating: 4.9,
    reviews: 324,
    district: "Печерський р-н",
    distance: "0.3 км",
    openNow: true,
    tags: [],
    priceFrom: "500",
    mastersCount: "8 майстрів",
  },

  {
    image: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop",
    badges: [{ text: "ТОП МАЙСТЕР", kind: "top-rating" }],
    title: "Оксана Мельник",
    type: "Майстер манікюру",
    rating: 4.9,
    reviews: 143,
    district: "Печерський р-н",
    distance: "0.5 км",
    openNow: true,
    tags: [],
    priceFrom: "500",
    variant: "solo",
  },

  {
    image: "https://images.openai.com/static-rsc-4/MiBKuJGrIQyXhShML9NuST3-78cy-gYZfCKvqIMJNG7Vgck14jXgW9e9P45ID300Fvi8MJXZocOmKdBspdgzAzfi66s6UdemWIk9NjO79Rwgx2MOd8gTj5Jz8S98QLaIaKsDLiqJGZYWPSPJkBv_0U1oDIP1bqLP2QXWvOa5r6BW7pRaBnPY0-IWqQIfl3vC?purpose=fullsize",
    badges: [{ text: "ТОП РЕЙТИНГ", kind: "top-rating" }],
    title: "Metro Beauty",
    type: "Салон краси",
    rating: 4.8,
    reviews: 268,
    district: "Кловська",
    distance: "0.5 км",
    openNow: true,
    tags: [],
    priceFrom: "600",
    mastersCount: "7 майстрів",
  },

  {
    image: "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop",
    badges: [{ text: "ВИБІР КЛІЄНТІВ", kind: "client-choice" }],
    title: "Дмитро Кравець",
    type: "Барбер",
    rating: 4.9,
    reviews: 201,
    district: "Печерський р-н",
    distance: "0.9 км",
    openNow: true,
    tags: [],
    priceFrom: "400",
    variant: "solo",
  },

  {
    image: "https://images.pexels.com/photos/7750116/pexels-photo-7750116.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop",
    badges: [{ text: "ЧАСТО БРОНЮЮТЬ", kind: "trend" }],
    title: "Élan Studio",
    type: "Студія краси",
    rating: 4.9,
    reviews: 172,
    district: "Липки",
    distance: "1.4 км",
    openNow: true,
    tags: [],
    priceFrom: "600",
    mastersCount: "5 майстрів",
  },
];
const topRated: CardData[] = [
  {
    image: "https://images.pexels.com/photos/7755218/pexels-photo-7755218.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop",
    badges: [{ text: "ТОП РЕЙТИНГ", kind: "top-rating" }],
    title: "Elegant Beauty",
    type: "Салон краси",
    rating: 4.9,
    reviews: 156,
    district: "Печерський",
    distance: "1.2 км",
    openNow: true,
    tags: ["Манікюр", "Педикюр", "Масаж", "Косметологія"],
    priceFrom: "800",
    mastersCount: "10 майстрів",
  },
  {
    image: "https://images.pexels.com/photos/7755224/pexels-photo-7755224.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop",
    badges: [{ text: "ВИБІР КЛІЄНТІВ", kind: "client-choice" }],
    title: "Perfect Look",
    type: "Нейл-бар",
    rating: 4.8,
    reviews: 97,
    district: "Печерський р-н",
    distance: "0.9 км",
    openNow: true,
    tags: ["Стрижка", "Фарбування", "Ботокс", "Догляд"],
    priceFrom: "450",
    mastersCount: "3 майстри",
  },
  {
    image: "https://images.pexels.com/photos/7755247/pexels-photo-7755247.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop",
    badges: [{ text: "НАЙКРАЩІ ВІДГУКИ", kind: "best-reviews" }],
    title: "VIP Beauty Club",
    type: "Салон краси",
    rating: 4.8,
    reviews: 89,
    district: "Арсенальна",
    distance: "1.5 км",
    openNow: true,
    tags: ["Манікюр", "Педикюр", "Масаж", "Косметологія"],
    priceFrom: "900",
    mastersCount: "7 майстрів",
  },
  {
    image: "https://images.pexels.com/photos/3997986/pexels-photo-3997986.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop",
    badges: [{ text: "НЕЗВИЧНИЙ ФОРМАТ", kind: "surprise" }],
    title: "Zen Beauty Loft",
    type: "Салон краси",
    rating: 4.7,
    reviews: 63,
    district: "Поділ",
    distance: "1.8 км",
    openNow: true,
    tags: ["Масаж", "SPA", "Медитативний догляд"],
    priceFrom: "650",
    mastersCount: "4 майстри",
  },
  {
    image: "https://images.pexels.com/photos/3985360/pexels-photo-3985360.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop",
    badges: [{ text: "РЕТЕЛЬНО ДІБРАНО", kind: "surprise" }],
    title: "Blush Beauty Bar",
    type: "Нейл-бар",
    rating: 4.9,
    reviews: 51,
    district: "Липки",
    distance: "1.0 км",
    openNow: true,
    tags: ["Манікюр", "Візаж", "Брови"],
    priceFrom: "550",
    mastersCount: "5 майстрів",
  },
];

const fresh: CardData[] = [
  {
    image: "https://images.pexels.com/photos/7990108/pexels-photo-7990108.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop",
    badges: [{ text: "НОВИЙ САЛОН", kind: "new-salon" }],
    title: "Fresh Beauty",
    type: "Салон краси",
    rating: 4.6,
    reviews: 22,
    district: "Печерський р-н",
    distance: "0.6 км",
    openNow: true,
    tags: ["Манікюр", "Педикюр", "Дизайн", "Нарощування"],
    priceFrom: "500",
    mastersCount: "4 майстри",
  },
  {
    image: "https://images.pexels.com/photos/7755296/pexels-photo-7755296.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop",
    badges: [{ text: "НОВИЙ МАЙСТЕР", kind: "new-master" }],
    title: "Kate Nails",
    type: "Майстер манікюру",
    rating: 4.7,
    reviews: 18,
    district: "Липки",
    distance: "1.0 км",
    openNow: true,
    tags: ["Манікюр", "Гель-лак", "Дизайн нігтів"],
    priceFrom: "400",
    mastersCount: "1 майстер",
  },
  {
    image: "https://images.pexels.com/photos/7755665/pexels-photo-7755665.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop",
    badges: [{ text: "НОВА ПОСЛУГА", kind: "new-service" }],
    title: "VIP Beauty Club",
    type: "Салон краси",
    rating: 4.8,
    reviews: 89,
    district: "Арсенальна",
    distance: "1.5 км",
    openNow: true,
    tags: ["Ботокс для волосся", "Ламінування"],
    priceFrom: "700",
    mastersCount: "3 майстри",
  },
  {
    image: "https://images.pexels.com/photos/3997379/pexels-photo-3997379.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop",
    badges: [{ text: "ПРИЄДНАЛИСЬ 3 ДНІ ТОМУ", kind: "new-salon" }],
    title: "Glow Studio",
    type: "Салон краси",
    rating: 4.5,
    reviews: 9,
    district: "Печерський р-н",
    distance: "1.1 км",
    openNow: true,
    tags: ["Манікюр", "Брови", "Вії"],
    priceFrom: "480",
    mastersCount: "3 майстри",
  },
  {
    image: "https://images.pexels.com/photos/3993445/pexels-photo-3993445.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop",
    badges: [{ text: "ПРИЄДНАВСЯ ВЧОРА", kind: "new-master" }],
    title: "Olena Style",
    type: "Майстриня стрижки",
    rating: 5.0,
    reviews: 3,
    district: "Липки",
    distance: "1.4 км",
    openNow: true,
    tags: ["Стрижка", "Укладка"],
    priceFrom: "420",
    mastersCount: "1 майстер",
  },
];


function RecommendationCarousel({
  cards,
  t,
  variant,
  onLocationClick,
}: {
  cards: CardData[];
  t: Translations;
  variant: "salons" | "masters" | "nearby" | "worth-trying" | "fresh";
  onLocationClick?: (name: string, district: string, distance: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(cards.length > 4);

  const updateArrows = () => {
    const track = trackRef.current;
    if (!track) return;

    const maxScrollLeft = Math.max(
      0,
      track.scrollWidth - track.clientWidth
    );

    setCanScrollLeft(track.scrollLeft > 5);
    setCanScrollRight(track.scrollLeft < maxScrollLeft - 5);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    // Кожен новий набір рекомендацій починаємо з першої картки
    track.scrollLeft = 0;

    setCanScrollLeft(false);

    const frame = requestAnimationFrame(() => {
      updateArrows();
    });

    const resizeObserver = new ResizeObserver(() => {
      updateArrows();
    });

    resizeObserver.observe(track);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [cards.length]);

  const scroll = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;

    const card = track.querySelector<HTMLElement>(".card");

    const amount = card
      ? card.offsetWidth + 14
      : track.clientWidth * 0.25;

    track.scrollBy({
      left: amount * direction,
      behavior: "smooth",
    });
  };

  return (
    <div
      className={`recommendation-carousel recommendation-carousel-${variant}`}
    >
      <div
        className="carousel-track"
        ref={trackRef}
        onScroll={updateArrows}
      >
        {cards.map((c, i) => (
          <Card
            key={c.title + i}
            data={c}
            t={t}
            hideTags
            hideReason
            onLocationClick={onLocationClick}
          />
        ))}
      </div>

      {canScrollLeft && (
        <button
          className="carousel-arrow carousel-arrow-prev"
          type="button"
          aria-label="Попередні рекомендації"
          onClick={() => scroll(-1)}
        >
          ‹
        </button>
      )}

      {canScrollRight && (
        <button
          className="carousel-arrow carousel-arrow-next"
          type="button"
          aria-label="Наступні рекомендації"
          onClick={() => scroll(1)}
        >
          ›
        </button>
      )}
    </div>
  );
}


function PartnerOffersCarousel({
  offers,
  lang,
  onLocationClick,
}: {
  offers: PartnerOffer[];
  lang: Lang;
  onLocationClick?: (name: string, district: string, distance: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ua = lang === "ua";

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(offers.length > 4);
  const [activeOffer, setActiveOffer] = useState<PartnerOffer | null>(null);

  const updateArrows = () => {
    const track = trackRef.current;
    if (!track) return;

    const maxScrollLeft = Math.max(
      0,
      track.scrollWidth - track.clientWidth
    );

    setCanScrollLeft(track.scrollLeft > 5);
    setCanScrollRight(track.scrollLeft < maxScrollLeft - 5);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    track.scrollLeft = 0;
    setCanScrollLeft(false);

    const frame = requestAnimationFrame(updateArrows);

    const resizeObserver = new ResizeObserver(updateArrows);
    resizeObserver.observe(track);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [offers.length]);

  const scroll = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;

    const card = track.querySelector<HTMLElement>(".partner-offer-card");

    const amount = card
      ? card.offsetWidth + 14
      : track.clientWidth * 0.25;

    track.scrollBy({
      left: amount * direction,
      behavior: "smooth",
    });
  };

  return (
    <div className="partner-offers-carousel">
      <div
        className="partner-offers-track"
        ref={trackRef}
        onScroll={updateArrows}
      >
        {offers.map((offer, i) => (
          <article
            className="partner-offer-card"
            key={`${offer.title}-${i}`}
          >
            <div
              className="partner-offer-image"
              style={{
                ["--partner-photo" as string]: `url(${offer.image})`,
              }}
            >
              <span className="partner-discount">
                {offer.discount}
              </span>

              <FavButton data={{ image: offer.image, badges: [], title: offer.partner, type: offer.title, rating: offer.rating, reviews: offer.reviews, district: offer.district, distance: offer.distance, tags: [], priceFrom: offer.newPrice.replace(/[^0-9]/g, "") || offer.newPrice }} />
            </div>

            <div className="partner-offer-body">
              <h3>{offer.title}</h3>

              <div className="partner-name-row">
                <p className="partner-name">{offer.partner}</p>
                <button type="button" className="partner-rating" onClick={() => setActiveOffer(offer)} aria-label={`${offer.rating.toFixed(1)}, ${offer.reviews} ${ua ? "відгуків" : "reviews"}`}>
                  <span className="star">★</span>
                  <span>{offer.rating.toFixed(1)}</span>
                  <span className="count">({offer.reviews})</span>
                </button>
              </div>

              <div className="partner-card-meta">
                <button
                  type="button"
                  className="card-location-link partner-location-link"
                  onClick={() =>
                    onLocationClick?.(
                      offer.partner,
                      offer.district,
                      offer.distance
                    )
                  }
                  title={ua ? "Показати на карті" : "Show on map"}
                >
                  <span className="district-pin">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>

                    {offer.district}
                  </span>

                  <span>· {offer.distance}</span>
                </button>

                <span className="partner-availability">
                  ● {ua ? "Відкрито" : "Open"}
                </span>
              </div>

              <div className="partner-price-row">
                <span className="partner-old-price">
                  {offer.oldPrice} грн
                </span>

                <strong>
                  {offer.newPrice} грн
                </strong>

                <span className="partner-valid-inline">{offer.validUntil}</span>
              </div>

              <button
                type="button"
                className="partner-book-btn"
                onClick={() => openSalonWebsite(offer.partner, offer.website)}
              >
                {ua ? "На сайт салону" : "Salon website"}
              </button>

              <button
                type="button"
                className="partner-details-link"
                onClick={() => setActiveOffer(offer)}
              >
                {ua ? "Детальніше" : "Details"} →
              </button>
            </div>
          </article>
        ))}
      </div>

      {canScrollLeft && (
        <button
          className="partner-carousel-arrow partner-carousel-prev"
          type="button"
          aria-label={
            ua
              ? "Попередні пропозиції"
              : "Previous offers"
          }
          onClick={() => scroll(-1)}
        >
          ‹
        </button>
      )}

      {canScrollRight && (
        <button
          className="partner-carousel-arrow partner-carousel-next"
          type="button"
          aria-label={
            ua
              ? "Наступні пропозиції"
              : "Next offers"
          }
          onClick={() => scroll(1)}
        >
          ›
        </button>
      )}

      {activeOffer && (
        <PlaceDetailsModal
          data={{
            image: activeOffer.image,
            badges: [{ text: activeOffer.discount, kind: "discount" }],
            title: activeOffer.partner,
            type: activeOffer.title,
            rating: activeOffer.rating,
            reviews: activeOffer.reviews,
            district: activeOffer.district,
            distance: activeOffer.distance,
            openNow: activeOffer.openNow,
            tags: [activeOffer.title],
            priceFrom: activeOffer.newPrice,
            avgCheck: `${activeOffer.newPrice} грн`,
            why: activeOffer.gift,
            website: activeOffer.website,
          }}
          t={dict[lang]}
          onClose={() => setActiveOffer(null)}
          onBook={() => openSalonWebsite(activeOffer.partner, activeOffer.website)}
          onLocationClick={onLocationClick}
        />
      )}
    </div>
  );
}

function PartnerOffersSection({
  title,
  subtitle,
  offers,
  lang,
  onLocationClick,
}: {
  title: string;
  subtitle: string;
  offers: PartnerOffer[];
  lang: Lang;
  onLocationClick?: (name: string, district: string, distance: string) => void;
}) {
  return (
    <section className="section partner-offers-section" id="promotions">
      <div className="section-head partner-section-head">
        <div className="partner-section-copy section-heading-copy">
          <div className="section-title-anchor">
            <span className="section-title-floating-icon accent" aria-hidden="true">
              <svg
                className="section-icon"
                width="60"
                height="60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 3h12l4 6-10 12L2 9z" />
                <path d="M11 3 8 9l4 12 4-12-3-6" />
                <path d="M2 9h20" />
              </svg>
            </span>
            <h2 className="section-title section-title-centered">{title}</h2>
          </div>

          <p className="section-sub">{subtitle}</p>
        </div>
      </div>
      <PartnerOffersCarousel offers={offers} lang={lang} onLocationClick={onLocationClick} />
    </section>
  );
}

function KyivTopSection({
  cards,
  lang,
  onLocationClick,
}: {
  cards: CardData[];
  lang: Lang;
  onLocationClick?: (name: string, district: string, distance: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(cards.length > 4);
  const [activeCard, setActiveCard] = useState<CardData | null>(null);
  const [bookingCard, setBookingCard] = useState<CardData | null>(null);
  const ua = lang === "ua";
  const t = dict[lang];

  const updateArrows = () => {
    const track = trackRef.current;
    if (!track) return;
    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    setCanScrollLeft(track.scrollLeft > 4);
    setCanScrollRight(track.scrollLeft < maxScrollLeft - 4);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollLeft = 0;
    const frame = requestAnimationFrame(updateArrows);
    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [cards.length]);

  const scroll = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>(".kyiv-cover-card");
    const amount = card ? card.offsetWidth + 14 : track.clientWidth * 0.25;
    track.scrollBy({ left: amount * direction, behavior: "smooth" });
  };

  return (
    <section className="section kyiv-top-section" id="nearby">
      <div className="section-head kyiv-top-head">
        <div className="section-heading-copy">
          <div className="section-title-anchor">
            <span className="section-title-floating-icon kyiv-top-crown" aria-hidden="true">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M4 8.5 8.2 12 12 5.5 15.8 12 20 8.5 18.4 17H5.6L4 8.5Z" />
                <rect x="6" y="18.2" width="12" height="1.6" rx="0.8" />
                <circle cx="12" cy="5.5" r="1.05" fill="#f7f4fb" />
              </svg>
            </span>
            <h2 className="section-title section-title-centered kyiv-top-title">
              {ua ? "Найкращі в Києві" : "Best in Kyiv"}
            </h2>
          </div>
        </div>
      </div>

      <div className="kyiv-top-carousel">
        <div className="kyiv-top-track" ref={trackRef} onScroll={updateArrows}>
          {cards.map((card, i) => (
            <article className="kyiv-cover-card" key={`${card.title}-${i}`}>
              <div
                className="kyiv-cover-photo"
                style={{ ["--kyiv-cover-photo" as string]: `url(${card.image})` }}
              >
                <div className="kyiv-cover-shade" />

                <div className="kyiv-cover-topline">
                  <div className={`kyiv-cover-award kyiv-cover-award-${i + 1}`} aria-label={`${i + 1} місце`}>
                    {i === 0 ? (
                      <svg className="kyiv-cover-award-crown kyiv-cover-award-crown-first" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M4 8.5 8.2 12 12 5.5 15.8 12 20 8.5 18.4 17H5.6L4 8.5Z" />
                        <rect x="6" y="18.15" width="12" height="1.7" rx="0.85" />
                      </svg>
                    ) : (
                      <svg className="kyiv-cover-award-crown" viewBox="0 0 24 18" fill="none" aria-hidden="true">
                        <path d="M6 11 4.4 6.2 9 8.2 12 3.8 15 8.2 19.6 6.2 18 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M4 12.5h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    )}
                    <span className="kyiv-cover-award-rank">{i + 1}</span>
                  </div>
                  <FavButton data={card} />
                </div>

                <div className="kyiv-cover-glass-title">
                  <h3 className={card.variant === "solo" ? "kyiv-cover-master-name" : ""}>
                    {card.title}
                  </h3>
                  <button
                    type="button"
                    className="kyiv-cover-rating kyiv-cover-rating-button"
                    onClick={() => setActiveCard(card)}
                    aria-label={`${card.rating.toFixed(1)}, ${card.reviews} ${t.placeModal.reviews}`}
                  >
                    <span className="star">★</span>
                    <span>{card.rating.toFixed(1)}</span>
                    <span className="count">({card.reviews})</span>
                  </button>
                </div>
              </div>

              <div className="kyiv-cover-copy">
                <p className="kyiv-cover-type">{card.type}</p>

                <button
                  type="button"
                  className="kyiv-cover-location"
                  onClick={() => onLocationClick?.(card.title, card.district, card.distance)}
                  aria-label={ua ? `Показати ${card.title} на карті` : `Show ${card.title} on map`}
                >
                  <span className="district-pin">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {card.district}
                  </span>
                  <span>· {card.distance}</span>
                </button>

                <div className="kyiv-cover-service-line">
                  <span className="open-now">
                    ● {card.variant === "solo"
                      ? (ua ? "Є місця" : "Available")
                      : (ua ? "Відкрито" : "Open")}
                  </span>
                  {card.mastersCount && <span>{card.mastersCount}</span>}
                </div>

                <div className="kyiv-cover-footer">
                  <span className="kyiv-cover-price">{ua ? "від" : "from"} {card.priceFrom} грн</span>
                </div>

                <div className="kyiv-cover-actions">
                  <button className="kyiv-cover-book" type="button">
                    {ua ? "Записатися" : "Book now"}
                  </button>
                  <button
                    type="button"
                    className="kyiv-cover-view"
                    onClick={() => setActiveCard(card)}
                  >
                    {ua ? "Детальніше" : "Details"} →
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {canScrollLeft && (
          <button className="carousel-arrow carousel-arrow-prev kyiv-top-arrow" type="button" aria-label={ua ? "Попередні" : "Previous"} onClick={() => scroll(-1)}>‹</button>
        )}
        {canScrollRight && (
          <button className="carousel-arrow carousel-arrow-next kyiv-top-arrow" type="button" aria-label={ua ? "Наступні" : "Next"} onClick={() => scroll(1)}>›</button>
        )}
      </div>

      {activeCard && (
        <PlaceDetailsModal
          data={activeCard}
          t={t}
          onClose={() => setActiveCard(null)}
          onLocationClick={onLocationClick}
          onBook={() => {
            if (activeCard.variant === "solo") {
              if (!readStoredUser()) {
                window.dispatchEvent(new CustomEvent("beautyai:auth-required", { detail: { data: activeCard, action: "booking" } }));
                setActiveCard(null);
                return;
              }
              setBookingCard(activeCard);
              setActiveCard(null);
            } else {
              openSalonWebsite(activeCard.title, activeCard.website);
            }
          }}
        />
      )}

      {bookingCard && (
        <BookingModal data={bookingCard} t={t} onClose={() => setBookingCard(null)} />
      )}
    </section>
  );
}


function PanelCarouselSection({
  title,
  subtitle,
  icon,
  cards,
  t,
  lang,
  variant,
  resultsWord,
  id,
  onLocationClick,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  cards: CardData[];
  t: Translations;
  lang: Lang;
  variant: "nearby" | "worth-trying" | "fresh";
  resultsWord: string;
  id?: string;
  onLocationClick?: (name: string, district: string, distance: string) => void;
}) {
  return (
    <section className="section subtle-panel-section" id={id}>
      <div className="section-head section-head-centered">
        <div className="section-heading-copy">
          <div className="section-title-anchor">
            <span className="section-title-floating-icon accent" aria-hidden="true">{icon}</span>
            <h2 className="section-title section-title-centered">{title}</h2>
          </div>
          <p className="section-sub">{subtitle}</p>
        </div>
      </div>
      <RecommendationCarousel cards={cards} t={t} variant={variant} onLocationClick={onLocationClick} />
    </section>
  );
}
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  manicure: ["манікюр", "гель-лак", "дизайн нігтів"],
  pedicure: ["педикюр"],
  haircut: ["стрижка"],
  coloring: ["фарбування"],
  botox: ["ботокс"],
  massage: ["масаж"],
  eyelashes: ["нарощування вій", "нарощування", "вії"],
  brows: ["брови"],
  makeup: ["макіяж"],
  cosmetology: ["косметологія"],
  depilation: ["депіляція"],
  solarium: ["солярій"],
  facial: ["чистка обличчя"],
  spa: ["spa"],
};

function filterByCategory(cards: CardData[], category: string): CardData[] {
  const keywords = CATEGORY_KEYWORDS[category] ?? [];
  return cards.filter((card) =>
    card.tags.some((tag) =>
      keywords.some((keyword) => tag.toLowerCase().includes(keyword))
    )
  );
}
export default function App() {
  const [lang, setLang] = useState<Lang>("ua");
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<{
    mode: "login" | "register";
    role: Exclude<AuthRole, "admin">;
    partnerKind?: "solo" | "salon";
  }>({
    mode: "login",
    role: "client",
  });
  const [partnerChoiceOpen, setPartnerChoiceOpen] = useState(false);
  const [user, setUser] = useState<MockUser | null>(null);
  const [view, setView] = useState<AppView>("home");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [recommendationFiltersOpen, setRecommendationFiltersOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("manicure");
  const [selectedMapLocation, setSelectedMapLocation] = useState<SelectedMapLocation | null>(null);
  const [clientAuthGate, setClientAuthGate] = useState<{ data: CardData; action: "booking" | "favorite" } | null>(null);
  const [pendingClientAction, setPendingClientAction] = useState<{ data: CardData; action: "booking" | "favorite" } | null>(null);
  const [bookingCard, setBookingCard] = useState<CardData | null>(null);
  const t = dict[lang];
  const filteredSalons = filterByCategory(recommendations, activeCategory);

  useEffect(() => {
    const onAuthRequired = (event: Event) => {
      const detail = (event as CustomEvent<{ data?: CardData; action?: "booking" | "favorite" }>).detail;
      if (detail?.data) setClientAuthGate({ data: detail.data, action: detail.action ?? "booking" });
    };
    window.addEventListener("beautyai:auth-required", onAuthRequired as EventListener);
    return () => window.removeEventListener("beautyai:auth-required", onAuthRequired as EventListener);
  }, []);

  useEffect(() => {
    const onProfileAvatar = (event: Event) => {
      const avatar = (event as CustomEvent<string>).detail;
      if (!avatar) return;
      const state = readClientState();
      if (state.profileAvatar !== avatar) writeClientState({ ...state, profileAvatar: avatar });
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, avatar };
        sessionStorage.setItem(STORED_USER_KEY, JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener("beautyai:profile-avatar", onProfileAvatar as EventListener);
    return () => window.removeEventListener("beautyai:profile-avatar", onProfileAvatar as EventListener);
  }, []);

  useEffect(() => {
    const onMasterProfile = (event: Event) => {
      const profile = (event as CustomEvent<{ displayName?: string; avatar?: string }>).detail;
      if (!profile) return;
      setUser((prev) => {
        if (!prev || prev.role !== "master") return prev;
        const next = { ...prev, name: profile.displayName || prev.name, avatar: profile.avatar || prev.avatar };
        sessionStorage.setItem(STORED_USER_KEY, JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener("beautyai:master-profile", onMasterProfile as EventListener);
    return () => window.removeEventListener("beautyai:master-profile", onMasterProfile as EventListener);
  }, []);

  useEffect(() => {
    const onRebook = (event: Event) => {
      const booking = (event as CustomEvent<ClientBooking>).detail;
      if (!booking) return;
      const card: CardData = {
        image: booking.image,
        badges: [],
        title: booking.title,
        type: booking.type,
        rating: 5,
        reviews: 0,
        district: booking.district,
        distance: "",
        openNow: true,
        tags: [booking.service],
        priceFrom: booking.priceFrom,
        variant: "solo",
      };
      setView("home");
      window.setTimeout(() => setBookingCard(card), 0);
    };
    window.addEventListener("beautyai:rebook", onRebook as EventListener);
    return () => window.removeEventListener("beautyai:rebook", onRebook as EventListener);
  }, []);

  const handleLocationClick = (name: string, district: string, distance: string) => {
    const coords = LOCATION_COORDINATES[name] ?? DISTRICT_FALLBACKS[district] ?? [50.4412, 30.5390];

    setSelectedMapLocation({
      name,
      district,
      distance,
      lat: coords[0],
      lng: coords[1],
    });
  };

  const handleAuthenticated = (nextUser: MockUser) => {
    const clientAvatar = nextUser.role === "client" ? readClientState().profileAvatar : undefined;
    const masterProfile = nextUser.role === "master" ? readStoredMasterProfile(nextUser.email) : null;
    const hydratedUser = nextUser.role === "master"
      ? { ...nextUser, name: masterProfile?.displayName || nextUser.name, avatar: masterProfile?.avatar || nextUser.avatar }
      : clientAvatar
        ? { ...nextUser, avatar: clientAvatar }
        : nextUser;
    setUser(hydratedUser);
    sessionStorage.setItem(STORED_USER_KEY, JSON.stringify(hydratedUser));
    window.dispatchEvent(new CustomEvent("beautyai:auth-changed"));
    if (nextUser.role === "client" && authIntent.mode === "register") awardRegistrationBonus();
    setAuthOpen(false);

    if (pendingClientAction) {
      if (pendingClientAction.action === "booking") {
        setBookingCard(pendingClientAction.data);
      } else {
        toggleClientFavorite(pendingClientAction.data);
      }
      setPendingClientAction(null);
      setView("home");
      return;
    }

    setView("dashboard");
  };

  const handleLogout = () => {
    setAccountMenuOpen(false);
    setUser(null);
    setView("home");
    clearAuthTokens();
    sessionStorage.removeItem(STORED_USER_KEY);
    // Keep favourites in the account data, but immediately clear their active UI state on the public site.
    window.dispatchEvent(new CustomEvent("beautyai:auth-changed"));
  };

  if (view === "dashboard" && user) {
    return (
      <div className="app">
        <DashboardShell
          user={user}
          lang={lang}
          onHome={() => setView("home")}
          onLogout={handleLogout}
          onRoleChange={(role) => setUser((prev) => prev ? { ...prev, role, avatar: roleAvatars[role] } : prev)}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <a className="logo" href="#" aria-label="Beauty AI — головна">
          <img src={beautyAISparkles} alt="" className="logo-sparkles" aria-hidden="true" />
          <span className="logo-wordmark"><span>Beauty</span> <strong>AI</strong></span>
        </a>
        <nav className="nav">
          {t.nav.map((label, i) => (
            <a key={label} href={["#salons", "#masters",  "#promotions", "#about"][i]}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-right">
          <button
            className="lang-select"
            onClick={() => setLang(lang === "ua" ? "en" : "ua")}
            aria-label="Switch language"
          >
            {lang === "ua" ? "UA" : "EN"} ˅
          </button>
          
          {user ? (
            <div className="account-menu-wrap">
              <button
                className="header-avatar-btn"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-label={lang === "ua" ? "Меню акаунта" : "Account menu"}
                aria-expanded={accountMenuOpen}
              >
                <img src={user.avatar} alt={user.name} />
              </button>

              {accountMenuOpen && (
                <>
                  <div className="account-menu-backdrop" onMouseDown={() => setAccountMenuOpen(false)} />
                  <div className="account-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setView("dashboard");
                      }}
                    >
                      {lang === "ua" ? "Мій кабінет" : "My account"}
                    </button>
                    <button type="button" role="menuitem" className="account-menu-logout" onClick={handleLogout}>
                      {lang === "ua" ? "Вийти" : "Log out"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              className="google-login-btn"
              onClick={() => {
                setAuthIntent({ mode: "login", role: "client" });
                setAuthOpen(true);
              }}
            >
              {t.loginGoogle}
            </button>
          )}
        </div>
      </header>

      <section className="hero-full-width">
        <div className="hero-overlay-content">
          <div className="hero-content">

            <div className="hero-eyebrow">
              <span>BEAUTY AI</span> — {t.heroEyebrow}
            </div>

            <h1 className="hero-title">
              <span className="hero-title-line">{t.heroTitle1}</span>
              <span className="hero-title-line hero-title-match">{t.heroTitle2}</span>
              <span className="hero-title-line">
                {lang === "ua" ? "ЗА ДОПОМОГОЮ" : "with the help of"}{" "}
                <span className="hero-title-ai">AI</span>
              </span>
            </h1>

            <p className="hero-subtitle">
              {t.heroSubtitle}
            </p>

            <div className="search-bar">
              <input type="text" placeholder={t.searchPlaceholder} />
              <button className="search-btn">
                <img
                  src={beautyAISparkles}
                  alt=""
                  className="search-btn-logo"
                  aria-hidden="true"
                />

                <span className="search-btn-text">
                  {t.searchBtn}
                </span>
              </button>
            </div>
          </div>

          <div className="hero-categories">
            <CategoryFilters lang={lang} activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
          </div>
        </div>
      </section>

    <section className="section ai-recommendations" id="salons">
      <div className="recommendation-row recommendation-row-salons">
        <div
          className={`recommendation-intro ${
            recommendationFiltersOpen ? "filters-open" : ""
          }`}
        >
          <div className="recommendation-intro-head">
            <div className="recommendation-title-anchor">
              <img
                src={beautyAISparkles}
                alt=""
                aria-hidden="true"
                className="recommendation-heading-spark recommendation-heading-spark-floating"
              />
              <h2>{t.sections.recommendations.title}</h2>
              {filteredSalons.length === 0 && (
                <span className="recommendations-empty-note">
                  {lang === "ua" ? "Салонів не знайдено" : "No salons found"}
                </span>
              )}
            </div>

              <div className="recommendations-filter-menu recommendations-filter-menu-inline">
                <button
                  className={`recommendations-filter-toggle ${recommendationFiltersOpen ? "is-open" : ""}`}
                  type="button"
                  aria-expanded={recommendationFiltersOpen}
                  onClick={() => setRecommendationFiltersOpen((open) => !open)}
                >
                  
                  {lang === "ua" ? "Фільтри" : "Filters"}
                  <span
                    className={`recommendations-filter-chevron ${recommendationFiltersOpen ? "rotated" : ""}`}
                    aria-hidden="true"
                  >
                    ˅
                  </span>
                </button>
              </div>
            </div>

            {recommendationFiltersOpen && (
              <div className="recommendations-filter-panel recommendations-filter-panel-inline">
                <FilterBar lang={lang} onFilterChange={(filters: any) => console.log(filters)} />
              </div>
            )}
           
          </div>
          <RecommendationCarousel cards={filteredSalons} t={t} variant="salons" onLocationClick={handleLocationClick} />
        </div>

        <div className="recommendation-row recommendation-row-masters" id="masters">
          <div className="recommendation-intro">
            <div className="recommendation-intro-head">
              <div className="recommendation-title-anchor">
                <img
                  src={beautyAISparkles}
                  alt=""
                  aria-hidden="true"
                  className="recommendation-heading-spark recommendation-heading-spark-floating"
                />
                <h2>{t.sections.soloMasters.title}</h2>
              </div>
            </div>
            
          </div>
          <RecommendationCarousel cards={soloMastersRecommendations} t={t} variant="masters" onLocationClick={handleLocationClick} />
        </div>
      </section>
      <div className="section-divider" aria-hidden="true">
        <span>✦</span>
      </div>
      <KyivTopSection
        cards={nearby}
        lang={lang}
        onLocationClick={handleLocationClick}
      />

      <PartnerOffersSection
        title={t.sections.partners.title}
        subtitle={t.sections.partners.subtitle}
        offers={partners}
        lang={lang}
        onLocationClick={handleLocationClick}
      />

      <PanelCarouselSection
        title={t.sections.topRated.title}
        subtitle={t.sections.topRated.subtitle}
        icon={
          <svg
            className="section-icon section-icon-worth"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22c4.4 0 8-3.3 8-7.8 0-3.2-1.8-5.9-4.7-8.2.2 2.4-.8 4.3-2.7 5.5.3-3.7-1.7-7-5.5-9.5.1 3.7-1.7 6.4-3.4 8.5C2.6 11.9 2 13.6 2 15.3 2 19 6.1 22 12 22Z" />
          </svg>
        }
        cards={topRated}
        t={t}
        lang={lang}
        variant="worth-trying"
        resultsWord={lang === "ua" ? "варіантів знайдено" : "options found"}
        id="worth-trying"
        onLocationClick={handleLocationClick}
      />

      <PanelCarouselSection
        title={t.sections.fresh.title}
        subtitle={t.sections.fresh.subtitle}
        icon={<span className="section-symbol-mark section-symbol-mark-new">NEW</span>}
        cards={fresh}
        t={t}
        lang={lang}
        variant="fresh"
        resultsWord={lang === "ua" ? "новинок знайдено" : "new listings"}
        id="fresh"
        onLocationClick={handleLocationClick}
      />
      
      <section className="about-section" id="about">
        <div className="about-main">
          <h2>{t.about.title}</h2>
          <p>{t.about.description}</p>
        </div>

        <div className="about-column">
          <h3>{t.about.contactsTitle}</h3>

          <a href="mailto:support@beautyai.ua">
            support@beautyai.ua
          </a>

          <a href="#">
            Telegram
          </a>
        </div>

        <div className="about-column about-partners"
         id="partners-info">
          <h3>{t.about.partnersTitle}</h3>
          <p>{t.about.partnersText}</p>

          <button
            className="partner-btn"
            onClick={() => setPartnerChoiceOpen(true)}
          >
            {t.about.partnersCta}
          </button>
        </div>
      </section>

      <p className="footer-note">ⓘ {t.footer} ✦</p>

      {partnerChoiceOpen && (
        <div
          className="partner-choice-backdrop"
          role="presentation"
          onMouseDown={() => setPartnerChoiceOpen(false)}
        >
          <div className="partner-choice-window" onMouseDown={(event) => event.stopPropagation()}>
            <span className="partner-choice-kicker">✦ BEAUTY AI</span>
            <h3>{lang === "ua" ? "Хто ви?" : "Who are you?"}</h3>
            <p>
              {lang === "ua"
                ? "Оберіть, як вам зручніше приєднатись до Beauty AI"
                : "Choose how you'd like to join Beauty AI"}
            </p>

            <div className="partner-choice-options">
              <button
                type="button"
                onClick={() => {
                  setAuthIntent({ mode: "register", role: "master", partnerKind: "solo" });
                  setPartnerChoiceOpen(false);
                  setAuthOpen(true);
                }}
              >
                <span className="partner-choice-title">{lang === "ua" ? "Соло-майстер" : "Solo master"}</span>
                <span className="partner-choice-desc">
                  {lang === "ua" ? "Працюю сам(а), без прив'язки до салону" : "I work independently, no salon"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthIntent({ mode: "register", role: "master", partnerKind: "salon" });
                  setPartnerChoiceOpen(false);
                  setAuthOpen(true);
                }}
              >
                <span className="partner-choice-title">{lang === "ua" ? "Власник салону" : "Salon owner"}</span>
                <span className="partner-choice-desc">
                  {lang === "ua" ? "Керую закладом з кількома майстрами" : "I run a business with multiple masters"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {clientAuthGate && !authOpen && (
        <div className="booking-auth-gate-overlay" role="presentation" onMouseDown={() => setClientAuthGate(null)}>
          <div className="booking-auth-gate" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="booking-auth-gate-close" type="button" onClick={() => setClientAuthGate(null)}>×</button>
            <span className="booking-auth-gate-kicker">BEAUTY AI</span>
            <h3>{clientAuthGate.action === "booking" ? (lang === "ua" ? "Увійдіть, щоб записатися" : "Sign in to book") : (lang === "ua" ? "Увійдіть, щоб зберегти" : "Sign in to save")}</h3>
            <p>{clientAuthGate.action === "booking" ? (lang === "ua" ? `Щоб забронювати час у ${clientAuthGate.data.title}, увійдіть у свій акаунт або зареєструйтесь.` : `Sign in or create an account to book ${clientAuthGate.data.title}.`) : (lang === "ua" ? `Щоб додати ${clientAuthGate.data.title} у «Сподобалось», увійдіть або зареєструйтесь.` : `Sign in or create an account to save ${clientAuthGate.data.title}.`)}</p>
            <button type="button" className="cta-btn" onClick={() => { setPendingClientAction(clientAuthGate); setClientAuthGate(null); setAuthIntent({ mode: "login", role: "client" }); setAuthOpen(true); }}>
              {lang === "ua" ? "Увійти" : "Sign in"}
            </button>
            <button type="button" className="booking-auth-register" onClick={() => { setPendingClientAction(clientAuthGate); setClientAuthGate(null); setAuthIntent({ mode: "register", role: "client" }); setAuthOpen(true); }}>
              {lang === "ua" ? "Зареєструватися" : "Create account"}
            </button>
          </div>
        </div>
      )}

      {authOpen && (
        <AuthModal
          lang={lang}
          onClose={() => setAuthOpen(false)}
          onAuthenticated={handleAuthenticated}
          initialMode={authIntent.mode}
          initialRole={authIntent.role}
          initialPartnerKind={authIntent.partnerKind}
        />
      )}

      {bookingCard && (
        <BookingModal data={bookingCard} t={t} onClose={() => setBookingCard(null)} />
      )}

      {selectedMapLocation && (
        <div
          className="map-modal-backdrop"
          role="presentation"
          onMouseDown={() => setSelectedMapLocation(null)}
        >
          <div className="map-modal-window" onMouseDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="map-modal-close"
              onClick={() => setSelectedMapLocation(null)}
              aria-label={lang === "ua" ? "Закрити" : "Close"}
            >
              ×
            </button>
            <MapSection lang={lang} selectedLocation={selectedMapLocation} />
          </div>
        </div>
      )}
    </div>
  );
}
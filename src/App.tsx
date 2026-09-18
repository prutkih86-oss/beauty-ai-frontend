import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./App.css";
import MapSection from "./MapSection";
import CategoryFilters from "./CategoryFilters";
import FilterBar, { type FilterState } from './FilterBar';
import beautyAISparkles from "./assets/beauty-ai-sparkles.svg";
import settingsIcon from "./assets/settings.png";
import DashboardShell from "./dashboard/DashboardShell";
import {
  createAppointment,
  fetchAvailableSlots,
  fetchMasters,
  fetchPublicMasterReviews,
  fetchSalons,
  fetchServices,
  requestAiSearch,
  checkAiHealth,
  AiRequestError,
  resolveIntentDate,
  slotsIncludeTime,
  type AiSearchIntent,
  type MasterApi,
  type SalonApi,
  type ServiceApi,
} from "./api/beautyApi";
import BeautyAssistant from "./BeautyAssistant";

const AI_CONVERSATION_STORAGE_KEY = "beautyai_ai_conversation_id";

function readAiConversationId(): string | number | null {
  try {
    const stored = sessionStorage.getItem(AI_CONVERSATION_STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return typeof parsed === "string" || typeof parsed === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function writeAiConversationId(conversationId: string | number | null) {
  try {
    if (conversationId === null) {
      sessionStorage.removeItem(AI_CONVERSATION_STORAGE_KEY);
    } else {
      sessionStorage.setItem(AI_CONVERSATION_STORAGE_KEY, JSON.stringify(conversationId));
    }
  } catch {
    // The current conversation still works if browser storage is unavailable.
  }
}

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
  city?: string;
  distance: string;
  lat?: number;
  lng?: number;
  aiMatchScore?: number;
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
  gallery?: string[];
  backendMasterId?: number;
  backendSalonId?: number;
  salonWorkingHours?: Array<{
    weekday: number;
    opening_time?: string | null;
    closing_time?: string | null;
    is_closed?: boolean;
  }>;
  backendServices?: Array<{
    id: number;
    name: string;
    price?: number | string | null;
    duration_minutes?: number | string | null;
  }>;
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

// Фіксований набір львівських районів для mock/discovery-карток, коли
// selectedCity === "Львів" — самі мокові масиви (topRated/fresh/partners)
// не редагуються, район підміняється похідним хелпером (toLvivDiscoveryCards).
const LVIV_DISTRICTS = [
  "Галицький",
  "Личаківський",
  "Франківський",
  "Шевченківський",
  "Сихівський",
  "Залізничний",
];

// Іменних координат для львівських mock-назв немає (ті самі назви карток
//("Luna Beauty House" тощо) використовуються і в київському режимі, і їхні
// координати в LOCATION_COORDINATES — київські). Тому для Львова свідомо не
// звіряємось із LOCATION_COORDINATES взагалі, а покладаємось на районні
// фолбеки нижче — вони покривають усі 6 районів, яких і так набуває
// district після toLvivDiscoveryCards.
const LVIV_LOCATION_COORDINATES: Record<string, [number, number]> = {};

const LVIV_DISTRICT_FALLBACKS: Record<string, [number, number]> = {
  "Галицький": [49.8397, 24.0297],
  "Личаківський": [49.8280, 24.0680],
  "Франківський": [49.8100, 24.0150],
  "Шевченківський": [49.8600, 24.0100],
  "Сихівський": [49.7950, 24.0450],
  "Залізничний": [49.8420, 23.9950],
};

// Єдине місце вибору координат для карти — і прямий клік по картці
// (handleLocationClick), і подія beautyai:open-location мають користуватись
// саме цим, щоб не розійтись у поведінці між містами.
function resolveLocationCoords(
  name: string,
  district: string,
  city: CityName | null
): [number, number] {
  if (city === "Львів") {
    return (
      LVIV_LOCATION_COORDINATES[name] ??
      LVIV_DISTRICT_FALLBACKS[district] ??
      [49.8397, 24.0297]
    );
  }

  return (
    LOCATION_COORDINATES[name] ??
    DISTRICT_FALLBACKS[district] ??
    [50.4412, 30.5390]
  );
}

type Lang = "ua" | "en";
type CityName = "Київ" | "Львів";

const CITY_STORAGE_KEY = "beautyai_selected_city";
const CITY_CENTERS: Record<CityName, { lat: number; lng: number }> = {
  "Київ": { lat: 50.4501, lng: 30.5234 },
  "Львів": { lat: 49.8397, lng: 24.0297 },
};

// FilterBar оперує латинськими слагами міст (успадковано з його власного
// набору опцій), а глобальний перемикач міста — українськими назвами.
// Це єдине місце конвертації між ними, щоб не заводити другий city-стан.
const CITY_SLUG_TO_NAME: Partial<Record<string, CityName>> = {
  kyiv: "Київ",
  lviv: "Львів",
};
const CITY_NAME_TO_SLUG: Record<CityName, string> = {
  "Київ": "kyiv",
  "Львів": "lviv",
};

function readStoredCity(): CityName | null {
  try {
    const value = localStorage.getItem(CITY_STORAGE_KEY);
    return value === "Київ" || value === "Львів" ? value : null;
  } catch {
    return null;
  }
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function nearestSupportedCity(lat: number, lng: number): CityName {
  return (Object.keys(CITY_CENTERS) as CityName[]).reduce((nearest, city) => {
    const current = CITY_CENTERS[city];
    const best = CITY_CENTERS[nearest];
    return distanceKm(lat, lng, current.lat, current.lng) <
      distanceKm(lat, lng, best.lat, best.lng)
      ? city
      : nearest;
  }, "Київ");
}

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
      topRated: { title: "Варто спробувати", subtitle: "Щось нове, що може вас зацікавити" },
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


function makeInitialsAvatar(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "I";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <rect width="160" height="160" rx="80" fill="#9840F0"/>
      <text x="80" y="86" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="white">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

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
const CLIENT_FAVORITES_PREFIX = "beautyai_client_favorites:";
const CLIENT_PROFILE_PREFIX = "beautyai_client_profile:";
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
  portfolioImages?: string[];
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

function readStoredMasterStates(): StoredMasterState[] {
  const states: StoredMasterState[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(MASTER_STATE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredMasterState;
      if (parsed.profile?.displayName) states.push(parsed);
    }
  } catch {
    return states;
  }
  return states;
}

function consumeStoredMasterWindow(displayName: string, date: string, time: string) {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(MASTER_STATE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredMasterState;
      if (parsed.profile?.displayName !== displayName) continue;
      const windows = (parsed.windows ?? []).filter((slot) => !(slot.date === date && slot.time === time));
      localStorage.setItem(key, JSON.stringify({ ...parsed, windows }));
      window.dispatchEvent(new CustomEvent("beautyai:master-state", { detail: { state: { ...parsed, windows } } }));
      return;
    }
  } catch {
    // local demo state: failing to consume a slot must not break a confirmed booking
  }
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

function clientAccountKey(prefix: string, user: MockUser | null = readStoredUser()) {
  if (!user || user.role !== "client" || !user.email) return null;
  return `${prefix}${user.email.trim().toLowerCase()}`;
}

function readClientFavorites(user: MockUser | null = readStoredUser()): ClientFavorite[] {
  const key = clientAccountKey(CLIENT_FAVORITES_PREFIX, user);
  if (!key) return [];
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as ClientFavorite[];
    const legacy = readClientState().favorites;
    if (legacy.length) {
      localStorage.setItem(key, JSON.stringify(legacy));
      writeClientState({ ...readClientState(), favorites: [] });
      return legacy;
    }
  } catch { return []; }
  return [];
}

function writeClientFavorites(favorites: ClientFavorite[], user: MockUser | null = readStoredUser()) {
  const key = clientAccountKey(CLIENT_FAVORITES_PREFIX, user);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(favorites));
  window.dispatchEvent(new CustomEvent("beautyai:client-favorites", { detail: favorites }));
}

function readClientProfile(user: MockUser | null = readStoredUser()): { name?: string; phone?: string; email?: string; avatar?: string } {
  const key = clientAccountKey(CLIENT_PROFILE_PREFIX, user);
  if (!key) return {};
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function buildStoredMasterCards(baseCards: CardData[]): CardData[] {
  const clientState = readClientState();
  const dynamicCards = readStoredMasterStates().map((state): CardData | null => {
    const profile = state.profile;
    if (!profile?.displayName) return null;
    const activeServices = (state.services ?? []).filter((service) => service.active);
    const masterBookings = clientState.bookings.filter((booking) => booking.title === profile.displayName);
    const reviewed = masterBookings.filter((booking: any) => booking.reviewSubmitted && Number(booking.reviewMasterRating) > 0);
    const rating = reviewed.length
      ? reviewed.reduce((sum: number, booking: any) => sum + Number(booking.reviewMasterRating || 0), 0) / reviewed.length
      : 0;
    const reviewsList: CardReview[] = reviewed
      .filter((booking: any) => booking.reviewComment)
      .slice()
      .sort((a: any, b: any) => String(b.reviewSubmittedAt ?? b.createdAt).localeCompare(String(a.reviewSubmittedAt ?? a.createdAt)))
      .map((booking: any) => ({
        author: "Клієнт Beauty AI",
        rating: Number(booking.reviewMasterRating || 0),
        text: String(booking.reviewComment || ""),
        date: booking.reviewSubmittedAt ? new Date(booking.reviewSubmittedAt).toLocaleDateString("uk-UA") : undefined,
      }));
    const prices = activeServices.map((service) => Number(service.price)).filter((price) => Number.isFinite(price) && price > 0);
    const futureWindows = (state.windows ?? []).filter((slot) => `${slot.date}T${slot.time}` >= new Date().toISOString().slice(0, 16));
    return {
      image: profile.avatar || roleAvatars.master,
      badges: [{ text: "BEAUTY AI", kind: "ai-match" }],
      title: profile.displayName,
      type: profile.specialization ? `Соло майстер · ${profile.specialization}` : "Соло майстер",
      rating,
      reviews: reviewed.length,
      district: profile.city || "Київ",
      city: profile.city || undefined,
      distance: "",
      openNow: futureWindows.length > 0,
      tags: activeServices.map((service) => service.name),
      priceFrom: prices.length ? String(Math.min(...prices)) : "0",
      locationNote: profile.salon || profile.city || "Beauty AI",
      profileLinkLabel: "Профіль майстра",
      variant: "solo",
      description: profile.about || undefined,
      reviewsList,
      gallery: state.portfolioImages ?? [],
    };
  }).filter((card): card is CardData => Boolean(card));

  const dynamicByTitle = new Map(dynamicCards.map((card) => [card.title, card]));
  const merged = baseCards.map((card) => {
    const dynamic = dynamicByTitle.get(card.title);
    if (!dynamic) return card;
    // Бекенд-картка лишається джерелом правди для рейтингу, послуг, цін і backendMasterId.
    // З локального кабінету беремо тільки те, що там реально редагується вручну.
    return {
      ...card,
      image: dynamic.image && dynamic.image !== roleAvatars.master && !dynamic.image.startsWith("data:image/") ? dynamic.image : card.image,
      description: dynamic.description ?? card.description,
      gallery: dynamic.gallery?.length ? dynamic.gallery : card.gallery,
    };
  });
  const baseTitles = new Set(baseCards.map((card) => card.title));
  return [...dynamicCards.filter((card) => !baseTitles.has(card.title)), ...merged];
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
  const currentUser = readStoredUser();
  if (!currentUser || currentUser.role !== "client") return false;
  const current = readClientFavorites(currentUser);
  const exists = current.some((item) => item.title === data.title);
  const favorites = exists
    ? current.filter((item) => item.title !== data.title)
    : [{ title: data.title, type: data.type, image: data.image, rating: data.rating, reviews: data.reviews, district: data.district, distance: data.distance, priceFrom: data.priceFrom, variant: data.variant }, ...current];
  writeClientFavorites(favorites, currentUser);
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
function saveBackendClientBooking(
  createdId: number | string | undefined,
  data: CardData,
  service: string,
  date: string,
  time: string,
  phone: string
) {
  const currentUser = readStoredUser();
  if (!currentUser?.email) return;

  const key = `beautyai_client_state:${currentUser.email.trim().toLowerCase()}`;
  let state: ClientState;
  try {
    const raw = localStorage.getItem(key);
    state = raw ? { ...emptyClientState(), ...JSON.parse(raw) } : emptyClientState();
  } catch {
    state = emptyClientState();
  }

  const booking: ClientBooking = {
    id: String(createdId ?? `pending-${Date.now()}`),
    title: data.title, type: data.type, image: data.image, service, date, time, phone,
    district: data.district, priceFrom: data.priceFrom, status: "confirmed",
    code: String(createdId ?? ""), createdAt: new Date().toISOString(),
  };
  const notification: ClientNotification = {
    id: `booking-${booking.id}`, title: "Запис підтверджено",
    text: `${data.title} · ${service} · ${date} ${time}`,
    createdAt: new Date().toISOString(), read: false,
  };

  const next = { ...state, bookings: [booking, ...state.bookings], notifications: [notification, ...state.notifications] };
  localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("beautyai:client-state", { detail: { email: currentUser.email.trim().toLowerCase(), state: next } }));
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


function formatUaPhone(value: string): string {
  let digits = value.replace(/\D/g, "");

  // Accept pasted +38..., 38..., 0XX..., or just local digits.
  if (digits.startsWith("38")) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 10);

  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
  ];

  let result = "+38";
  if (parts[0]) result += ` (${parts[0]}`;
  if (parts[0].length === 3) result += ")";
  if (parts[1]) result += ` ${parts[1]}`;
  if (parts[2]) result += ` ${parts[2]}`;
  if (parts[3]) result += ` ${parts[3]}`;
  return result;
}

function uaPhoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("38")) digits = digits.slice(2);
  return digits.slice(0, 10);
}

function isValidUaPhone(value: string): boolean {
  const digits = uaPhoneDigits(value);
  return digits.length === 10 && digits.startsWith("0");
}

function AuthModal({
  lang,
  onClose,
  onAuthenticated,
  initialMode = "login",
  initialRole = "client",
  initialPartnerKind,
  initialNotice,
}: {
  lang: Lang;
  onClose: () => void;
  onAuthenticated: (user: MockUser) => void;
  initialMode?: "login" | "register";
  initialRole?: Exclude<AuthRole, "admin">;
  initialPartnerKind?: "solo" | "salon";
  initialNotice?: string | null;
}) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [role, setRole] = useState<Exclude<AuthRole, "admin">>(initialRole);
  const [partnerKind] = useState<"solo" | "salon" | undefined>(initialPartnerKind);
  const [businessName, setBusinessName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("+38");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
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
        avatar: profile.photo || (authRole === "client" ? makeInitialsAvatar(`${profile.first_name ?? ""} ${profile.last_name ?? ""}`) : roleAvatars[authRole]),
      });
    } catch (err: any) {
      setAuthError(err.message || (ua ? "Сталася помилка. Спробуйте ще раз." : "Something went wrong. Try again."));
    } finally {
      setAuthLoading(false);
    }
  };

  const registerClient = async () => {
    setAuthError(null);

    if (!isValidUaPhone(phone)) {
      setAuthError(
        ua
          ? "Введіть коректний номер у форматі +38 (0XX) XXX XX XX"
          : "Enter a valid phone number in the format +38 (0XX) XXX XX XX"
      );
      return;
    }

    setAuthLoading(true);

    try {
      const registerRes = await fetch(`${API_BASE_URL}/api/users/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: `+38${uaPhoneDigits(phone)}`,
          email: email.trim(),
          password,
        }),
      });

      if (!registerRes.ok) {
        const body = await registerRes.json().catch(() => null);
        const fieldError = body && typeof body === "object"
          ? Object.values(body).flat().find((value) => typeof value === "string")
          : null;
        throw new Error(
          (fieldError as string | undefined) ||
            body?.detail ||
            (ua ? "Не вдалося створити акаунт" : "Could not create account")
        );
      }

      setRegistrationSuccess(true);
      setAuthError(null);

      window.setTimeout(() => {
        setRegistrationSuccess(false);
        setMode("login");
        setPassword("");
      }, 2500);
    } catch (err: any) {
      setAuthError(
        err?.message ||
          (ua ? "Не вдалося створити акаунт. Спробуйте ще раз." : "Could not create account. Try again.")
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const storedDemoMaster = readStoredMasterProfile("beauty.master@gmail.com");
  const fakeGoogleAccounts: { role: AuthRole; name: string; email: string; avatar: string }[] = [
    { role: "client", name: ua ? "Ірина Клієнтка" : "Irene Client", email: "irene.client@gmail.com", avatar: roleAvatars.client },
    {
      role: "master",
      name: storedDemoMaster?.displayName || (ua ? "Майстер Beauty" : "Beauty Master"),
      email: "beauty.master@gmail.com",
      avatar:
        storedDemoMaster?.displayName === "Кароліна Савчук"
          ? LOCAL_MASTER_IMAGES["Кароліна Савчук"]
          : storedDemoMaster?.avatar || roleAvatars.master,
    },
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
        ? (readClientProfile(account as MockUser).avatar || account.avatar)
        : account.role === "master"
          ? (
              (storedMaster?.displayName || account.name) === "Кароліна Савчук"
                ? LOCAL_MASTER_IMAGES["Кароліна Савчук"]
                : storedMaster?.avatar || account.avatar
            )
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
      void loginWithPassword();
      return;
    }

    if (role === "client") {
      void registerClient();
      return;
    }

    // Реєстрація майстра поки лишається демо, бо /api/users/register/
    // створює звичайного user, але не master profile.
    finishAuth("master");
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

        {registrationSuccess ? (
          <div
            className="auth-brand"
            style={{
              minHeight: 330,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: 16,
              padding: "32px 20px",
            }}
          >
            <h2 id="auth-title" style={{ margin: 0 }}>
              {ua ? "Акаунт створено!" : "Account created!"}
            </h2>

            <div
              aria-hidden="true"
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "#22c55e",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 42,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              ✓
            </div>

            <div style={{ maxWidth: 390 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {ua
                  ? "Перейдіть на пошту та підтвердьте свою електронну адресу."
                  : "Check your email and confirm your email address."}
              </p>
              <p style={{ margin: "8px 0 0", opacity: 0.7 }}>
                {ua
                  ? "Після підтвердження ви зможете увійти в Beauty AI."
                  : "After confirmation, you will be able to sign in to Beauty AI."}
              </p>
            </div>
          </div>
        ) : (
          <>
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
                ? role === "client"
                  ? "Приєднуйтесь до Beauty AI"
                  : "Реєстрація майстра поки працює в демо-режимі."
                : role === "client"
                  ? "Create a real Beauty AI client account."
                  : "Master registration is still in demo mode."}
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

          {mode === "register" && role === "client" && (
            <>
              <label>
                <span>{ua ? "Ім'я" : "First name"}</span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder={ua ? "Ім'я" : "First name"}
                  required
                />
              </label>
              <label>
                <span>{ua ? "Прізвище" : "Last name"}</span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder={ua ? "Прізвище" : "Last name"}
                  required
                />
              </label>
              <label>
                <span>{ua ? "Телефон" : "Phone"}</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(formatUaPhone(event.target.value))}
                  onFocus={(event) => {
                    if (!event.currentTarget.value.startsWith("+38")) setPhone("+38");
                  }}
                  onBlur={() => {
                    if (!phone.startsWith("+38")) setPhone("+38");
                  }}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+38 (053) 401 23 23"
                  pattern="\+38 \(0[0-9]{2}\) [0-9]{3} [0-9]{2} [0-9]{2}"
                  title={ua ? "Формат: +38 (0XX) XXX XX XX" : "Format: +38 (0XX) XXX XX XX"}
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

          {initialNotice && mode === "login" && (
            <p style={{ margin: 0, color: "#16a34a", fontWeight: 600, textAlign: "center" }}>
              {initialNotice}
            </p>
          )}

          {authError && <p className="auth-google-error">{authError}</p>}

          <button className="auth-primary" type="submit" disabled={authLoading}>
            {authLoading
              ? mode === "login"
                ? (ua ? "Входимо…" : "Signing in…")
                : (ua ? "Створюємо…" : "Creating…")
              : mode === "login"
                ? (ua ? "Увійти" : "Sign in")
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

          </>
        )}
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
  const isActiveForCurrentClient = () => {
    const currentUser = readStoredUser();
    return Boolean(currentUser?.role === "client" && readClientFavorites(currentUser).some((item) => item.title === data.title));
  };
  const [active, setActive] = useState(isActiveForCurrentClient);

  useEffect(() => {
    const sync = () => setActive(isActiveForCurrentClient());
    window.addEventListener("beautyai:client-state", sync as EventListener);
    window.addEventListener("beautyai:client-favorites", sync as EventListener);
    window.addEventListener("beautyai:auth-changed", sync as EventListener);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("beautyai:client-state", sync as EventListener); window.removeEventListener("beautyai:client-favorites", sync as EventListener); window.removeEventListener("beautyai:auth-changed", sync as EventListener); window.removeEventListener("storage", sync); };
  }, [data.title]);

  return (
    <button
      className={`fav-btn ${active ? "active" : ""}`}
      aria-label={active ? "Прибрати з обраного" : "Додати в обране"}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        const currentUser = readStoredUser();
        if (!currentUser || currentUser.role !== "client") {
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
  const backendServices = data.backendServices ?? [];
  const hasBackendBooking = Boolean(data.backendMasterId && backendServices.length);

  const services = hasBackendBooking
    ? backendServices.map((item) => item.name)
    : storedServices.length
      ? storedServices.map((item) => item.name)
      : (data.tags.length ? data.tags : [data.type]);

  const [service, setService] = useState(services[0] ?? "");
  const [date, setDate] = useState(dates[0]?.value ?? "");
  const [time, setTime] = useState("");
  const [phone, setPhone] = useState("+38");
  const [confirmed, setConfirmed] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<Array<{ start: string; end: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState("");

  const selectedBackendService = backendServices.find((item) => item.name === service);
  const storedTimes = (storedMaster?.windows ?? []).filter((slot) => slot.date === date).map((slot) => slot.time);
  const legacyTimes = storedMaster ? storedTimes : getAvailableTimes(data.title, date);
  const displayedSlots = availableSlots.filter((slot) => {
    const minutes = Number(slot.start.split(":")[1]);
    return minutes === 0;
  });

  const times = hasBackendBooking
    ? displayedSlots.map((slot) => slot.start)
    : legacyTimes;
  const selectedStoredService = storedServices.find((item) => item.name === service);
  const selectedPrice = selectedBackendService?.price ?? selectedStoredService?.price ?? data.priceFrom;
  const selectedPriceFrom = selectedPrice != null && selectedPrice !== "" ? String(selectedPrice) : data.priceFrom;
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

  useEffect(() => {
    if (!hasBackendBooking || !date || !selectedBackendService || !data.backendMasterId) {
      setAvailableSlots([]);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    setBookingError("");
    setTime("");

    fetchAvailableSlots({
      masterId: data.backendMasterId,
      serviceId: selectedBackendService.id,
      salonId: data.backendSalonId,
      date,
    })
      .then((slots) => {
        if (!cancelled) setAvailableSlots(slots);
      })
      .catch((error) => {
        console.error("Failed to load available slots", error);
        if (!cancelled) {
          setAvailableSlots([]);
          setBookingError(
            t.bookingModal.close === "Закрити"
              ? "Не вдалося завантажити вільний час. Спробуйте ще раз."
              : "Could not load available time slots. Please try again."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasBackendBooking, date, selectedBackendService?.id, data.backendMasterId, data.backendSalonId, t.bookingModal.close]);

  const handleConfirmBooking = async () => {
    if (!date || !time || !isValidUaPhone(phone)) return;

    if (!hasBackendBooking || !data.backendMasterId || !selectedBackendService) {
      // Тимчасовий fallback для старих локальних/demo-карток.
      saveClientBooking({ ...data, priceFrom: selectedPriceFrom }, service, date, time, phone, bookingCode);
      if (storedMaster) consumeStoredMasterWindow(data.title, date, time);
      setConfirmed(true);
      return;
    }

    setSubmitting(true);
    setBookingError("");

    try {
            const created = await createAppointment({
              master_id: data.backendMasterId,
              service_id: selectedBackendService.id,
              appointment_date: date,
              appointment_time: time.length === 5 ? `${time}:00` : time,
            });
      saveBackendClientBooking(created.id, { ...data, priceFrom: selectedPriceFrom }, service, date, time, phone);
      setConfirmed(true);
    } catch (error) {
      console.error("Failed to create appointment", error);
      setBookingError(
        t.bookingModal.close === "Закрити"
          ? "Не вдалося створити запис. Можливо, цей час уже зайнятий — оберіть інший."
          : "Could not create the booking. This slot may already be taken — choose another time."
      );

      try {
        const slots = await fetchAvailableSlots({
          masterId: data.backendMasterId,
          serviceId: selectedBackendService.id,
          salonId: data.backendSalonId,
          date,
        });
        setAvailableSlots(slots);
        if (!slots.some((slot) => slot.start === time)) setTime("");
      } catch {
        // Основну помилку створення запису вже показали користувачу.
      }
    } finally {
      setSubmitting(false);
    }
  };

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
                <select value={service} onChange={(event) => { setService(event.target.value); setTime(""); setBookingError(""); }}>
                  {services.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>

              <div className="booking-field">
                <span>{t.bookingModal.date}</span>
                <div className="booking-date-grid">
                  {dates.map((item) => (
                    <button key={item.value} type="button" className={date === item.value ? "active" : ""} onClick={() => { setDate(item.value); setTime(""); setBookingError(""); }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="booking-field">
                <span>{t.bookingModal.time}</span>
                <div className="booking-time-grid">
                  {times.map((slot) => (
                    <button key={slot} type="button" className={time === slot ? "active" : ""} onClick={() => { setTime(slot); setBookingError(""); }}>{slot}</button>
                  ))}
                </div>
                {loadingSlots && <small>{t.bookingModal.close === "Закрити" ? "Завантажуємо вільний час…" : "Loading available times…"}</small>}
                {!loadingSlots && !time && times.length === 0 && <small>{t.bookingModal.close === "Закрити" ? "На цю дату вільних вікон немає" : "No available slots for this date"}</small>}
                {!loadingSlots && !time && times.length > 0 && <small>{t.bookingModal.chooseTime}</small>}
              </div>

              <label className="booking-field">
                <span>{t.bookingModal.contact}</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(formatUaPhone(event.target.value))}
                  onFocus={(event) => {
                    if (!event.currentTarget.value.startsWith("+38")) setPhone("+38");
                  }}
                  onBlur={() => {
                    if (!phone.startsWith("+38")) setPhone("+38");
                  }}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+38 (053) 401 23 23"
                  pattern="\+38 \(0[0-9]{2}\) [0-9]{3} [0-9]{2} [0-9]{2}"
                  title={t.bookingModal.close === "Закрити" ? "Формат: +38 (0XX) XXX XX XX" : "Format: +38 (0XX) XXX XX XX"}
                  required
                />
                {phone !== "+38" && !isValidUaPhone(phone) && (
                  <small className="booking-phone-error">
                    {t.bookingModal.close === "Закрити"
                      ? "Введіть номер у форматі +38 (0XX) XXX XX XX"
                      : "Enter the number as +38 (0XX) XXX XX XX"}
                  </small>
                )}
              </label>

              <div className="booking-summary">
                <strong>{t.bookingModal.summary}</strong>
                <span>{service}</span>
                <span>{dates.find((item) => item.value === date)?.label} {time ? `· ${time}` : ""}</span>
                <span>{data.title} · {data.district}</span>
                <b>{selectedPriceFrom} грн+</b>
              </div>

              {bookingError && <small className="booking-api-error" role="alert">{bookingError}</small>}

              <button
                type="button"
                className="cta-btn booking-confirm-btn"
                disabled={!date || !time || !isValidUaPhone(phone) || submitting || loadingSlots}
                onClick={handleConfirmBooking}
              >
                {submitting
                  ? (t.bookingModal.close === "Закрити" ? "Створюємо запис…" : "Creating booking…")
                  : t.bookingModal.confirm}
              </button>
            </div>
          </>
        ) : (
          <div className="booking-success">
            <BeautyAssistant
              state="booking-success"
              className="assistant-booking-success"
            />
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

function ReviewsModal({
  data,
  t,
  reviews,
  loading = false,
  onClose,
}: {
  data: CardData;
  t: Translations;
  reviews: CardReview[];
  loading?: boolean;
  onClose: () => void;
}) {
  const ua = t.placeModal.close === "Закрити";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="reviews-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="reviews-modal"
        role="dialog"
        aria-modal="true"
        aria-label={ua ? `Відгуки — ${data.title}` : `Reviews — ${data.title}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="reviews-modal-close" onClick={onClose} aria-label={t.placeModal.close}>×</button>
        <div className="reviews-modal-head">
          <div>
            <span>{ua ? "Відгуки" : "Reviews"}</span>
            <h3>{data.title}</h3>
          </div>
          <div className="reviews-modal-score">
            <strong>{data.rating.toFixed(1)}</strong>
            <span>★</span>
            <small>{reviews.length} {t.placeModal.reviews}</small>
          </div>
        </div>
        <div className="reviews-modal-list">
          {loading ? (
            <p className="reviews-modal-empty">{ua ? "Завантаження відгуків…" : "Loading reviews…"}</p>
          ) : reviews.length === 0 ? (
            <p className="reviews-modal-empty">{ua ? "Ще немає відгуків." : "No reviews yet."}</p>
          ) : reviews.map((review, index) => (
            <article className="reviews-modal-review" key={`${review.author}-${review.date ?? index}`}>
              <div className="reviews-modal-review-head">
                <strong>{review.author}</strong>
                {review.date && <span>{review.date}</span>}
              </div>
              <div className="reviews-modal-stars" aria-label={`${review.rating} / 5`}>
                {Array.from({ length: 5 }, (_, starIndex) => (
                  <span key={starIndex} className={starIndex < review.rating ? "active" : ""}>★</span>
                ))}
              </div>
              <p>{review.text}</p>
            </article>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
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
  const ua = t.placeModal.close === "Закрити";
  const reviews = getPlaceReviews(data, t);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [serviceRowIndex, setServiceRowIndex] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !reviewsModalOpen) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, reviewsModalOpen]);

  const aboutText =
    data.description ??
    (isSolo && data.locationNote
      ? ua
        ? `${data.title} — ${data.type.toLowerCase()}. ${data.locationNote}.`
        : `${data.title} — ${data.type.toLowerCase()}. ${data.locationNote}.`
      : data.why ??
        (isSolo
          ? `${data.title} — ${data.type.toLowerCase()}.`
          : `${data.title} — ${data.type.toLowerCase()} у районі ${data.district}.`));

  const serviceRowSize = 2;
  const serviceRows = Array.from(
    { length: Math.ceil(data.tags.length / serviceRowSize) },
    (_, index) => data.tags.slice(index * serviceRowSize, index * serviceRowSize + serviceRowSize),
  );
  const visibleServiceRow = serviceRows[serviceRowIndex] ?? serviceRows[0] ?? [];

  return createPortal(
    <>
    <div
      className="place-modal-overlay"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="place-modal place-modal-profile-v4"
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

        {!isSolo && (
          <div
            className="place-modal-hero place-modal-hero-salon"
            style={{ ["--place-modal-photo" as string]: `url(${data.image})` }}
            aria-hidden="true"
          />
        )}

        <div className="place-modal-body">
          <div className={isSolo ? "place-modal-solo-top" : undefined}>
            {isSolo && (
              <div
                className="place-modal-hero place-modal-hero-solo"
                style={{ ["--place-modal-photo" as string]: `url(${data.image})` }}
                aria-hidden="true"
              />
            )}
          <section className="place-modal-profile-head">
            {!isSolo && (
              <BeautyAssistant
                state="detail-view"
                className="assistant-detail-view assistant-detail-salon"
              />
            )}

            <h2 id="place-modal-title">{data.title}</h2>

            <button
              type="button"
              className="place-modal-rating-v4"
              aria-label={`${data.rating.toFixed(1)}, ${data.reviews} ${t.placeModal.reviews}`}
              onClick={() => setReviewsModalOpen(true)}
            >
              <span className="place-modal-rating-stars" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <span key={index} className={index < Math.round(data.rating) ? "active" : ""}>
                    ★
                  </span>
                ))}
              </span>
              <strong>{data.rating.toFixed(1)}</strong>
              <span>({data.reviews} {t.placeModal.reviews})</span>
            </button>

            <div className="place-modal-primary-meta place-modal-primary-meta-v4">
              <button
                type="button"
                className="card-location-link place-modal-location-link"
                onClick={() => onLocationClick?.(data.title, data.district, data.distance)}
                title={t.placeModal.location}
              >
                <span className="district-pin">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {data.district}
                </span>
                {data.distance && <span className="place-modal-distance">· {data.distance}</span>}
              </button>

              <span className="place-modal-status">
                <span aria-hidden="true">●</span>
                {isSolo ? t.available : t.open}
              </span>
            </div>
          </section>
          </div>

          <section className="place-modal-section place-modal-about-v4">
            {isSolo && (
              <BeautyAssistant
                state="detail-view"
                className="assistant-detail-view assistant-detail-master"
              />
            )}

            <h3>{isSolo ? (ua ? "Про майстра" : "About the master") : (ua ? "Про салон" : "About the salon")}</h3>
            <p className={`place-modal-description ${aboutOpen ? "is-open" : ""}`}>{aboutText}</p>
            {aboutText.length > 150 && (
              <button
                type="button"
                className="place-modal-about-toggle"
                onClick={() => setAboutOpen((prev) => !prev)}
              >
                {aboutOpen ? (ua ? "Менше" : "Less") : (ua ? "Ще" : "More")}
              </button>
            )}
          </section>

          {!!data.gallery?.length && (
            <section className="place-modal-section">
              <h3>{ua ? "Роботи майстра" : "Master portfolio"}</h3>
              <div className="place-modal-gallery-v3">
                {data.gallery.slice(0, 6).map((src, index) => (
                  <img key={`${index}-${src.slice(-18)}`} src={src} alt={`${ua ? "Робота" : "Work"} ${index + 1}`} />
                ))}
              </div>
            </section>
          )}

          <section className="place-modal-section place-modal-info-v4">
            <h3>{t.placeModal.detailsTitle}</h3>

            <div
              className={`place-modal-facts place-modal-facts-v4 ${
                isSolo ? "place-modal-facts-v4--solo" : ""
              }`}
            >
              <div className="place-modal-fact-v5">
                <span className="place-modal-fact-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="8" />
                    <path d="M9.5 9.2c.6-.7 1.5-1.1 2.6-1.1 1.5 0 2.7.8 2.7 2s-1 1.8-2.7 2.2-2.7 1-2.7 2.2 1.2 2 2.8 2c1.1 0 2-.4 2.7-1.1M12 6.5v11" />
                  </svg>
                </span>
                <span className="place-modal-fact-copy">
                  <span>{t.placeModal.priceFrom}</span>
                  <strong>{data.priceFrom} грн</strong>
                </span>
              </div>

              {(data.experience ?? data.mastersCount) && (
                <div className="place-modal-fact-v5">
                  <span className="place-modal-fact-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </span>
                  <span className="place-modal-fact-copy">
                    <span>{isSolo ? (ua ? "Стаж" : "Experience") : t.placeModal.experience}</span>
                    <strong>{data.experience ?? data.mastersCount}</strong>
                  </span>
                </div>
                
              )}
              {!isSolo && (
                <div className="place-modal-fact-separator" aria-hidden="true" />
              )}
              {isSolo && data.locationNote && (
                <div className="place-modal-fact-v5">
                  <span className="place-modal-fact-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M8 9h8M8 13h5" />
                    </svg>
                  </span>
                  <span className="place-modal-fact-copy">
                    <span>{ua ? "Формат" : "Format"}</span>
                    <strong>{data.locationNote}</strong>
                  </span>
                </div>
              )}

              {!isSolo && data.avgCheck && (
                <div className="place-modal-fact-v5">
                  <span className="place-modal-fact-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="6" width="16" height="13" rx="2" />
                      <path d="M8 6V4h8v2M8 11h8M8 15h4" />
                    </svg>
                  </span>
                  <span className="place-modal-fact-copy">
                    <span>{t.placeModal.averageCheck}</span>
                    <strong>{data.avgCheck}</strong>
                  </span>
                </div>
              )}
            </div>
          </section>

          {!!data.tags.length && (
            <section className="place-modal-section place-modal-services-v5">
              <div className="place-modal-section-heading place-modal-services-heading">
                <h3>{t.placeModal.servicesTitle}</h3>
                {serviceRows.length > 1 && (
                  <div className="place-modal-service-row-controls">
                    {serviceRowIndex > 0 && (
                      <button
                        type="button"
                        className="place-modal-service-row-btn"
                        onClick={() => setServiceRowIndex((index) => Math.max(0, index - 1))}
                        aria-label={ua ? "Попередній ряд послуг" : "Previous services row"}
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M5.5 12.5 10 8l4.5 4.5" />
                        </svg>
                      </button>
                    )}
                    {serviceRowIndex < serviceRows.length - 1 && (
                      <button
                        type="button"
                        className="place-modal-service-row-btn"
                        onClick={() => setServiceRowIndex((index) => Math.min(serviceRows.length - 1, index + 1))}
                        aria-label={ua ? "Наступний ряд послуг" : "Next services row"}
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                          <path d="m5.5 7.5 4.5 4.5 4.5-4.5" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="place-modal-tags place-modal-service-row">
                {visibleServiceRow.map((tag) => (
                  <span className="tag" key={`${serviceRowIndex}-${tag}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          <button type="button" className="cta-btn place-modal-cta" onClick={onBook}>
            {t.placeModal.book}
          </button>

        </div>
      </div>
    </div>
    {reviewsModalOpen && (
      <ReviewsModal
        data={data}
        t={t}
        reviews={reviews}
        onClose={() => setReviewsModalOpen(false)}
      />
    )}
    </>,
    document.body,
  );
}

function Card({
  data,
  t,
  hideTags = false,
  hideReason = false,
  hideAiMatch = false,
  onLocationClick,
}: {
  data: CardData;
  t: Translations;
  hideTags?: boolean;
  hideReason?: boolean;
  hideAiMatch?: boolean;
  onLocationClick?: (name: string, district: string, distance: string) => void;
}) {
  const [showReason, setShowReason] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [realReviews, setRealReviews] = useState<CardReview[] | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
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

    // Для салону спочатку показуємо нашу внутрішню модалку.
    setShowProfile(true);
  };

  const handleProfileBook = () => {
    if (isSolo) {
      handleBook();
      return;
    }

    // Салони бронюються у їхній зовнішній системі (Altegio / власний booking page).
    if (data.website) {
      window.open(data.website, "_blank", "noopener,noreferrer");
      return;
    }

    // Якщо booking URL ще не доданий — не кидаємо користувача в заглушку.
    window.alert(
      uaForCard
        ? "Онлайн-запис для цього салону скоро буде доступний."
        : "Online booking for this salon will be available soon."
    );
  };

  const uaForCard = t.placeModal.close === "Закрити";
  const openReviews = () => {
    setShowReviews(true);
    if (data.backendMasterId && realReviews === null && !reviewsLoading) {
      setReviewsLoading(true);
      fetchPublicMasterReviews(data.backendMasterId)
        .then((rows) => {
          setRealReviews(
            rows
              .slice()
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((row) => ({
                author: uaForCard ? "Клієнт Beauty AI" : "Beauty AI client",
                rating: row.rating,
                text: row.comment || "",
                date: new Date(row.created_at).toLocaleDateString(uaForCard ? "uk-UA" : "en-GB"),
              }))
          );
        })
        .catch(() => setRealReviews([]))
        .finally(() => setReviewsLoading(false));
    }
  };
  if (data.title === "Кароліна Савчук") console.log("🟣 CARD KAROLINA:", data.image, data);
  return (
    <div className={`card ${isSolo ? "card-solo" : ""}`}>
      <div
        className={`card-image ${isSolo ? "card-image-solo" : ""}`}
        style={{ ['--card-photo' as string]: `url(${data.image})` }}
      >
        <div className="card-badges">
          {data.badges
            .filter((b) => !(hideAiMatch && b.kind === "ai-match"))
            .map((b) => (
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
            <p className="card-type">
              {isSolo ? data.type.replace(/^Майстер\s*[•·-]?\s*/i, "") : data.type}
            </p>
          </div>
          <button
            type="button"
            className="card-rating card-rating-button"
            onClick={openReviews}
            aria-label={`${data.rating.toFixed(1)}, ${realReviews?.length ?? data.reviews} ${t.placeModal.reviews}`}
          >
            <span className="star">★</span>
            <span>{data.rating.toFixed(1)}</span>
            <span className="count">({realReviews?.length ?? data.reviews})</span>
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
            <div className="price">{data.priceFrom} грн</div>
          </div>
          <div className="masters-block">
            {(data.experience ?? data.mastersCount) && <div>🕐 {data.experience ?? data.mastersCount}</div>}
            <div>{data.locationNote ?? t.inSalon}</div>
          </div>
        </div>

        <div className="card-cta-row">
          <button type="button" className="cta-btn" onClick={handleBook}>
            {t.cta}
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
      {showReviews && (
              <ReviewsModal
                data={data}
                t={t}
                reviews={getPlaceReviews(data, t)}
                onClose={() => setShowReviews(false)}
              />
            )}
      {showProfile && (
        <PlaceDetailsModal
          data={data}
          t={t}
          onClose={() => setShowProfile(false)}
          onBook={handleProfileBook}
          onLocationClick={onLocationClick}
        />
      )}

      {showBooking && (
        <BookingModal data={data} t={t} onClose={() => setShowBooking(false)} />
      )}
    </div>
  );
}


const FALLBACK_SALON_IMAGES = [
  "https://images.pexels.com/photos/7750114/pexels-photo-7750114.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
  "https://images.pexels.com/photos/7750115/pexels-photo-7750115.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
  "https://images.pexels.com/photos/7750116/pexels-photo-7750116.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
  "https://images.pexels.com/photos/7750117/pexels-photo-7750117.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
  "https://images.pexels.com/photos/7195808/pexels-photo-7195808.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
  "https://images.pexels.com/photos/7750091/pexels-photo-7750091.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
];

function getSalonFallbackImage(salonId: number): string {
  return FALLBACK_SALON_IMAGES[Math.abs(salonId) % FALLBACK_SALON_IMAGES.length];
}

const MALE_NAME_EXCEPTIONS = new Set([
  "микита", "ілля", "данило", "данила", "сава", "лука", "хома", "кузьма", "яків", "нікіта",
]);
function guessMasterGender(firstName?: string): "men" | "women" {
  const name = firstName?.trim().toLowerCase() ?? "";
  if (MALE_NAME_EXCEPTIONS.has(name)) return "men";
  const lastChar = name.slice(-1);
  return lastChar === "а" || lastChar === "я" ? "women" : "men";
}

function guessMasterGenderFolder(firstName?: string): "male" | "female" {
  return guessMasterGender(firstName) === "women" ? "female" : "male";
}

function getMasterFallbackImage(masterId: number, firstName?: string): string {
  const sex = guessMasterGenderFolder(firstName);
  const index = Math.abs(masterId) % 100; // репозиторій має рівно 100 фото на стать (0–99)
  return `https://cdn.jsdelivr.net/gh/faker-js/assets-person-portrait/${sex}/512/${index}.jpg`;
}

function parseCoordinates(value?: string | null): { lat: number; lng: number } | null {
  if (!value) return null;
  const numbers = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length < 2 || !numbers.every(Number.isFinite)) return null;

  // Backend workplace/location coordinates are stored as latitude, longitude.
  const [lat, lng] = numbers;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function getSalonCoordinates(salon: SalonApi): { lat: number; lng: number } | null {
  if (salon.latitude != null && salon.longitude != null) {
    const lat = Number(salon.latitude);
    const lng = Number(salon.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  return parseCoordinates(salon.location?.coordinates);
}

function getSalonCityName(salon: SalonApi): string {
  const flatCity =
    typeof salon.city === "string"
      ? salon.city
      : salon.city?.name;

  const raw =
    salon.location?.city_name ||
    salon.city_name ||
    flatCity ||
    (salon.city_id === 1 ? "Київ" : salon.city_id === 2 ? "Львів" : "");

  const normalized = String(raw || "").trim().toLowerCase();

  if (["kyiv", "kiev", "київ", "киев"].includes(normalized)) return "Київ";
  if (["lviv", "львів", "львов"].includes(normalized)) return "Львів";

  return String(raw || "").trim();
}

function salonToCard(
  salon: SalonApi,
  tags: string[] = [],
  prices: number[] = []
): CardData {
  const validPrices = prices.filter(
    (price) => Number.isFinite(price) && price > 0
  );

  const priceFrom = validPrices.length
    ? Math.min(...validPrices)
    : null;

  const avgPrice = validPrices.length
    ? Math.round(
        validPrices.reduce((sum, price) => sum + price, 0) /
          validPrices.length
      )
    : null;

  const coordinates = getSalonCoordinates(salon);

  return {
    image: salon.logo || getSalonFallbackImage(salon.id),
    badges: [],
    title: salon.name,
    type: "Салон краси",
    rating: salon.average_rating ?? 0,
    reviews: salon.total_reviews ?? 0,
    district: salon.district || getSalonCityName(salon) || "",
    city: getSalonCityName(salon) || undefined,
    distance: "",
    lat: coordinates?.lat,
    lng: coordinates?.lng,
    openNow: salon.available_status === "available",
    tags,
    priceFrom: priceFrom !== null ? String(priceFrom) : "",
    mastersCount:
      salon.masters_count != null
        ? `${salon.masters_count} майстрів`
        : undefined,
    avgCheck:
      avgPrice !== null
        ? `${avgPrice} грн`
        : undefined,
    description: salon.description ?? undefined,
    website: salon.external_booking_url || undefined,
    backendSalonId: salon.id,
    salonWorkingHours: (salon as SalonApi & {
      working_hours?: Array<{
        weekday: number;
        opening_time?: string | null;
        closing_time?: string | null;
        is_closed?: boolean;
      }>;
    }).working_hours ?? [],
  };
}

const LOCAL_MASTER_IMAGES: Record<string, string> = {
  "Кароліна Савчук": "/masters/female/karolina-savchuk.webp",
  "Ярина Шевченко": "/masters/female/Shevchenko_Yaryna.webp",
  "Соломія Гринчук": "/masters/female/Hrynchuk_Solomiia.webp",
  "Дарина Самойленко": "/masters/female/Samoilenko_Daryna.webp",
  "Данило Гнатенко": "/masters/male/Hnatenko_Danylo.webp",
  "Максим Гречаник": "/masters/male/Hrechanyk_Maksym.webp",
  "Микита Заєць": "/masters/male/Zaiets_Mykita.webp",
  "Венедикт Дашенко": "/masters/male/Dashenko_Venedikt.webp",
  "Трохим Іщак": "/masters/male/Ishchak_Trokhym.webp",

  // На випадок, якщо бекенд поверне прізвище та імʼя у зворотному порядку.
  "Савчук Кароліна": "/masters/female/karolina-savchuk.webp",
  "Шевченко Ярина": "/masters/female/Shevchenko_Yaryna.webp",
  "Гринчук Соломія": "/masters/female/Hrynchuk_Solomiia.webp",
  "Самойленко Дарина": "/masters/female/Samoilenko_Daryna.webp",
  "Гнатенко Данило": "/masters/male/Hnatenko_Danylo.webp",
  "Гречаник Максим": "/masters/male/Hrechanyk_Maksym.webp",
  "Заєць Микита": "/masters/male/Zaiets_Mykita.webp",
  "Дашенко Венедикт": "/masters/male/Dashenko_Venedikt.webp",
  "Іщак Трохим": "/masters/male/Ishchak_Trokhym.webp",
};

function masterToCard(
  master: MasterApi,
  prices: number[] = [],
  serviceNamesFromApi: string[] = [],
  reviewsCount = 0
): CardData {
  const name =
    `${master.first_name ?? ""} ${master.last_name ?? ""}`.trim();

  const serviceNames = Array.from(
    new Set([
      ...(master.services?.map((service) => service.name).filter(Boolean) ?? []),
      ...serviceNamesFromApi,
    ])
  );

  const yearsOfExperience = master.years_of_experience ?? 0;

  const validPrices = prices.filter(
    (price) => Number.isFinite(price) && price > 0
  );

  const priceFrom = validPrices.length
    ? Math.min(...validPrices)
    : null;

  const workplace = master.workplace;
  const workplaceCity = workplace?.city_name?.trim() || "";
  const workplaceDistrict = workplace?.district?.trim() || "";
  const workplaceAddress = workplace?.address?.trim() || "";
  const workplaceLocation = [workplaceDistrict, workplaceAddress]
    .filter(Boolean)
    .join(", ");
  const coordinates = parseCoordinates(workplace?.coordinates);

  return {
    image:
      LOCAL_MASTER_IMAGES[name] ||
      master.photo ||
      getMasterFallbackImage(master.id, master.first_name),
    badges: [],
    title: name || `Майстер #${master.id}`,
    type: serviceNames.length
      ? `Майстер · ${serviceNames[0]}`
      : "Майстер",
    rating: master.average_rating ?? 0,
    reviews: reviewsCount,
    district: workplaceDistrict || workplaceCity || "Соло-майстер",
    city: workplaceCity || undefined,
    distance: "",
    lat: coordinates?.lat,
    lng: coordinates?.lng,
    openNow: true,
    tags: serviceNames,
    priceFrom: priceFrom !== null ? String(priceFrom) : "",
    experience:
      yearsOfExperience > 0
        ? `${yearsOfExperience} років досвіду`
        : undefined,
    locationNote: workplaceLocation || workplaceCity || "Соло-майстер",
    profileLinkLabel: "Профіль майстра",
    variant: "solo",
    backendMasterId: master.id,
    backendServices: master.services ?? [],
  };
}

type ClientCoordinates = { lat: number; lng: number };

function rankAiMatches(
  cards: CardData[],
  intent: AiSearchIntent | null,
  clientCoordinates: ClientCoordinates | null
): CardData[] {
  if (!cards.length) return cards;

  const cleanCards = cards.map((card) => ({
    ...card,
    badges: card.badges.filter((badge) => badge.kind !== "ai-match"),
  }));

  const bestRating = Math.max(...cleanCards.map((card) => card.rating));
  const reviewRankByIndex = new Map<number, number>();
  const ratingGroups = new Map<number, number[]>();

  cleanCards.forEach((card, index) => {
    const group = ratingGroups.get(card.rating) ?? [];
    group.push(index);
    ratingGroups.set(card.rating, group);
  });

  ratingGroups.forEach((indexes) => {
    indexes
      .slice()
      .sort((a, b) => cleanCards[b].reviews - cleanCards[a].reviews || a - b)
      .forEach((cardIndex, rank) => reviewRankByIndex.set(cardIndex, rank));
  });

  const distanceByIndex = new Map<number, number>();
  if (clientCoordinates) {
    cleanCards.forEach((card, index) => {
      if (card.lat == null || card.lng == null) return;
      distanceByIndex.set(
        index,
        distanceKm(clientCoordinates.lat, clientCoordinates.lng, card.lat, card.lng)
      );
    });
  }

  const distanceRankByIndex = new Map<number, number>();
  [...distanceByIndex.entries()]
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    .forEach(([cardIndex], rank) => distanceRankByIndex.set(cardIndex, rank));

  const useMaxBudgetRanking = intent?.priceMax != null && intent.priceMin == null;
  const priceRankByIndex = new Map<number, number>();
  if (useMaxBudgetRanking) {
    cleanCards
      .map((card, index) => ({ index, price: Number(card.priceFrom) }))
      .filter((item) => Number.isFinite(item.price) && item.price > 0)
      .sort((a, b) => a.price - b.price || a.index - b.index)
      .forEach((item, rank) => priceRankByIndex.set(item.index, rank));
  }

  const ranked = cleanCards.map((card, index) => {
    const ratingPenalty = Math.max(0, bestRating - card.rating) * 10;
    const lowRatingPenalty =
      card.rating < 4
        ? 20 + Math.max(0, Math.round((3.9 - card.rating) * 10)) * 5
        : card.rating < 4.5
          ? Math.max(0, Math.round((4.5 - card.rating) * 10)) * 2
          : 0;
    const reviewsPenalty = reviewRankByIndex.get(index) ?? 0;
    const distancePenalty = distanceRankByIndex.get(index) ?? 0;
    const pricePenalty = useMaxBudgetRanking && priceRankByIndex.has(index)
      ? (priceRankByIndex.get(index) ?? 0) * 2
      : 0;
    const aiMatchScore = Math.max(0, Math.min(100, Math.round(
      100 - ratingPenalty - lowRatingPenalty - reviewsPenalty - distancePenalty - pricePenalty
    )));

    return {
      card: { ...card, aiMatchScore },
      distance: distanceByIndex.get(index) ?? Number.POSITIVE_INFINITY,
      originalIndex: index,
    };
  });

  ranked.sort((a, b) =>
    (b.card.aiMatchScore ?? 0) - (a.card.aiMatchScore ?? 0) ||
    b.card.rating - a.card.rating ||
    b.card.reviews - a.card.reviews ||
    a.distance - b.distance ||
    a.originalIndex - b.originalIndex
  );

  const topScore = ranked[0]?.card.aiMatchScore ?? 100;
  const normalizationOffset = Math.max(0, 100 - topScore);

  return ranked.map(({ card }) => {
    const normalizedScore = Math.min(100, (card.aiMatchScore ?? 0) + normalizationOffset);
    return {
      ...card,
      aiMatchScore: normalizedScore,
      badges: [{ text: `✦ AI Match ${normalizedScore}%`, kind: "ai-match" }, ...card.badges],
    };
  });
}

// ---- FilterBar -> CardData matching ----
// Один явний список ключових слів на групу послуг — щоб не розкидати
// перевірки по тексту в різних місцях. Значення — те саме, що в
// FilterBar.tsx (service: hair/nails/brows/makeup/massage/any).
const SERVICE_FILTER_KEYWORDS: Record<string, string[]> = {
  hair: ["волосс", "стриж", "фарбува", "уклад", "кератин"],
  nails: ["манікюр", "педикюр", "нігт", "гель-лак"],
  brows: ["бров", "вії", "вія"],
  makeup: ["макіяж", "візаж"],
  massage: ["масаж", "spa", "спа"],
};

// Те саме — для district (значення district у FilterBar.tsx), звірка йде
// підрядковим збігом з реальним card.district, що приходить з бекенду
// (salon.district). Список районів у FilterBar — тільки київські, тож для
// інших міст (Львів) жоден варіант свідомо не заматчиться.
const DISTRICT_FILTER_STEMS: Record<string, string> = {
  pecherskyi: "печерськ",
  shevchenkivskyi: "шевченківськ",
  podilskyi: "поділ",
  holosiivskyi: "голосіїв",
};

const RATING_FILTER_THRESHOLDS: Record<string, number> = {
  any: 0,
  from40: 4.0,
  from45: 4.5,
  from49: 4.9,
};

function cardMatchesPrice(card: CardData, priceMin: string, priceMax: string): boolean {
  const price = Number(card.priceFrom);
  // Немає реальної ціни на картці — не виключаємо картку "про всяк випадок",
  // це було б вигадуванням підстави для фільтрації.
  if (!Number.isFinite(price) || price <= 0) return true;
  if (priceMin && price < Number(priceMin)) return false;
  if (priceMax && price > Number(priceMax)) return false;
  return true;
}

function cardMatchesRating(card: CardData, rating: string): boolean {
  const threshold = RATING_FILTER_THRESHOLDS[rating] ?? 0;
  return card.rating >= threshold;
}

function cardMatchesDistrict(card: CardData, district: string): boolean {
  if (district === "any") return true;
  const stem = DISTRICT_FILTER_STEMS[district];
  if (!stem) return true;
  return card.district.toLowerCase().includes(stem);
}

function cardMatchesVenueType(card: CardData, venueType: string): boolean {
  if (venueType === "any") return true;
  // "studio" не має жодного відповідника в реальних даних — не фільтруємо.
  if (venueType === "studio") return true;
  if (venueType === "solo") return card.variant === "solo";
  if (venueType === "salon") return card.variant !== "solo";
  return true;
}

function cardMatchesServiceGroup(card: CardData, service: string): boolean {
  if (service === "any") return true;
  const keywords = SERVICE_FILTER_KEYWORDS[service];
  if (!keywords) return true;
  return card.tags.some((tag) => keywords.some((keyword) => tag.toLowerCase().includes(keyword)));
}

// "availability" (сьогодні/завтра/цього тижня) свідомо НЕ звіряється тут:
// на картці немає жодних даних про дату/розклад доступності, лише
// openNow (поточний стан "відкрито зараз") — це інша семантика, і
// підміняти ним фільтр за датою означало б видавати вигадане за реальне.
function cardMatchesFilters(card: CardData, filters: FilterState): boolean {
  const districtMatches = card.variant === "solo"
    ? true
    : cardMatchesDistrict(card, filters.district);

  return (
    cardMatchesPrice(card, filters.priceMin, filters.priceMax) &&
    cardMatchesRating(card, filters.rating) &&
    districtMatches &&
    cardMatchesVenueType(card, filters.venueType) &&
    cardMatchesServiceGroup(card, filters.service)
  );
}

function mapAiRatingToFilter(minRating: number | null): string {
  if (minRating == null) return "any";
  if (minRating >= 4.9) return "from49";
  if (minRating >= 4.5) return "from45";
  if (minRating >= 4.0) return "from40";
  return "any";
}

function serviceNameMatchesQuery(serviceName: string, serviceQuery: string | null): boolean {
  if (serviceQuery === null) return true;
  const query = serviceQuery.trim().toLowerCase();
  if (!query) return true;
  const normalized = serviceName.trim().toLowerCase();
  return Boolean(normalized) && (normalized.includes(query) || query.includes(normalized));
}

function cardMatchesAiService(card: CardData, serviceQuery: string | null): boolean {
  if (serviceQuery === null) return true;
  const serviceNames = [
    ...card.tags,
    ...(card.backendServices?.map((service) => service.name) ?? []),
  ];
  return serviceNames.some((serviceName) => serviceNameMatchesQuery(serviceName, serviceQuery));
}

function isCenterDistrictText(district: string | null): boolean {
  if (!district) return false;
  return /центр|хрещатик|майдан|khreshchatyk|maidan|center|centre/i.test(district);
}

function cardMatchesAiDistrict(card: CardData, district: string | null): boolean {
  if (!district) return true;
  if (isCenterDistrictText(district)) {
    return cardMatchesDistrict(card, "pecherskyi") || cardMatchesDistrict(card, "shevchenkivskyi");
  }
  const mappedDistrict = mapAiDistrictToFilter(district);
  return mappedDistrict === "any" || cardMatchesDistrict(card, mappedDistrict);
}

function cardMatchesAiRating(card: CardData, minRating: number | null): boolean {
  return minRating == null || card.rating >= minRating;
}

function salonMatchesRequestedWorkingHours(card: CardData, intent: AiSearchIntent | null): boolean {
  if (!intent) return true;
  const targetDate = resolveIntentDate(intent);
  if (!targetDate) return true;

  const [year, month, day] = targetDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return true;

  const weekday = date.getDay() === 0 ? 7 : date.getDay();
  const schedule = card.salonWorkingHours?.find((item) => item.weekday === weekday);

  // For a date/time-constrained search, do not claim a salon is suitable when
  // its schedule for that day is missing or explicitly closed.
  if (!schedule || schedule.is_closed) return false;
  if (!intent.time) return Boolean(schedule.opening_time && schedule.closing_time);
  if (!schedule.opening_time || !schedule.closing_time) return false;

  const requested = intent.time.slice(0, 5);
  const opens = schedule.opening_time.slice(0, 5);
  const closes = schedule.closing_time.slice(0, 5);

  if (closes > opens) return requested >= opens && requested < closes;
  if (closes < opens) return requested >= opens || requested < closes;
  return false;
}

function buildLocalFallbackIntent(
  query: string,
  serviceCatalog: string[] = []
): AiSearchIntent {
  const normalized = query.trim().toLowerCase();

  // 1) Основне джерело: реальні назви послуг з fetchServices(), уже
  // відсортовані найдовша→найкоротша в App() (setServiceCatalog) — тому
  // перший знайдений тут збіг автоматично і найспецифічніший
  // ("манікюр класичний" переможе "манікюр", якщо в тексті є обидва).
  const catalogMatch =
    serviceCatalog.find((name) => normalized.includes(name)) ?? null;

  const serviceAliases: Array<[string, string[]]> = [
    ["манікюр", ["манікюр", "manicure", "гель-лак", "нігт"]],
    ["педикюр", ["педикюр", "pedicure"]],
    ["стрижка", ["стриж", "haircut"]],
    ["фарбування", ["фарбув", "coloring", "colouring"]],
    ["масаж", ["масаж", "massage"]],
    ["брови", ["бров", "brow"]],
    ["вії", ["вії", "вій", "eyelash", "lashes"]],
    ["макіяж", ["макіяж", "makeup"]],
    ["косметологія", ["косметолог", "cosmetolog"]],
    ["епіляц", ["депіляц", "епіляц", "depilation"]],
    ["солярій", ["соляр", "solarium"]],
    ["чистка обличчя", ["чистка обличчя", "facial"]],
    ["spa", ["spa", "спа"]],
  ];
  // 2) Fallback лише для синонімів/словоформ, яких БУКВАЛЬНО немає в
  // назвах БД (напр. хтось пише "nails"/"гель-лак", а в базі послуга
  // називається "Манікюр"). Каталог має пріоритет — цей список більше не
  // єдине джерело serviceQuery.
  const aliasMatch = serviceAliases.find(([, aliases]) =>
    aliases.some((alias) => normalized.includes(alias))
  )?.[0] ?? null;

  const serviceQuery = catalogMatch ?? aliasMatch;

  const city = /львів|lviv/.test(normalized)
    ? "lviv"
    : /київ|киев|kyiv|kiev/.test(normalized)
      ? "kyiv"
      : null;

  const availability = /завтра|tomorrow/.test(normalized)
    ? "tomorrow"
    : /сьогодні|сегодня|today/.test(normalized)
      ? "today"
      : /тижд|week/.test(normalized)
        ? "week"
        : null;

  const district = /поділ|подол|podil/.test(normalized)
    ? "podilskyi"
    : /печерськ|печерск|pechersk/.test(normalized)
      ? "pecherskyi"
      : /шевченків|шевченков|shevchenk/.test(normalized)
        ? "shevchenkivskyi"
        : /голосіїв|голосеев|holosiiv|goloseev/.test(normalized)
          ? "holosiivskyi"
          : /центр|хрещатик|майдан|khreshchatyk|maidan|center|centre/.test(normalized)
            ? "центр"
            : null;

  const priceMaxMatch = normalized.match(/(?:до|не більше|макс(?:имум)?|under|up to)\s*(\d{2,6})/i);
  const priceMinMatch = normalized.match(/(?:від|не менше|мін(?:імум)?|from)\s*(\d{2,6})/i);
  const ratingMatch = normalized.match(/(?:рейтинг(?:ом)?|rating)\s*(?:від|from|>=?)?\s*(\d(?:[.,]\d)?)/i);

  const priceMax = priceMaxMatch ? Number(priceMaxMatch[1]) : null;
  const priceMin = priceMinMatch ? Number(priceMinMatch[1]) : null;
  const minRating = ratingMatch ? Number(ratingMatch[1].replace(",", ".")) : null;

  const venueType: AiSearchIntent["venueType"] = /соло|solo|приватн.*майстр|майстр.*вдома/.test(normalized)
    ? "solo"
    : /салон|salon/.test(normalized)
      ? "salon"
      : /студі|studio/.test(normalized)
        ? "studio"
        : null;

  const timeMatch =
    normalized.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/) ||
    normalized.match(/(?:^|\s)о\s+([01]?\d|2[0-3])(?=\s|$)/);
  const time = timeMatch
    ? `${timeMatch[1].padStart(2, "0")}:${(timeMatch[2] ?? "00").padStart(2, "0")}`
    : null;

  const explicitDateMatch = normalized.match(/\b(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\b/);
  let date: string | null = null;
  if (explicitDateMatch) {
    const day = Number(explicitDateMatch[1]);
    const month = Number(explicitDateMatch[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const yearRaw = explicitDateMatch[3];
      const year = yearRaw
        ? (yearRaw.length === 2 ? `20${yearRaw}` : yearRaw)
        : String(new Date().getFullYear());
      const candidate = new Date(Number(year), month - 1, day);
      if (candidate.getFullYear() === Number(year) && candidate.getMonth() === month - 1 && candidate.getDate() === day) {
        date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  return {
    serviceQuery,
    city,
    district,
    priceMin: Number.isFinite(priceMin) ? priceMin : null,
    priceMax: Number.isFinite(priceMax) ? priceMax : null,
    minRating: Number.isFinite(minRating) ? minRating : null,
    venueType,
    availability,
    date,
    time,
  };
}

function mapAiDistrictToFilter(district: string | null): string {
  if (!district) return "any";
  const normalized = district.trim().toLowerCase();
  if (/podil|поділ|подол/.test(normalized)) return "podilskyi";
  if (/pechersk|печерськ|печерск/.test(normalized)) return "pecherskyi";
  if (/shevchenk|шевченків|шевченков/.test(normalized)) return "shevchenkivskyi";
  if (/holosiiv|goloseev|голосіїв|голосеев/.test(normalized)) return "holosiivskyi";
  return "any";
}

const NEUTRAL_FILTERS: FilterState = {
  priceMin: "",
  priceMax: "",
  rating: "any",
  distance: "any",
  availability: "anytime",
  city: "any",
  district: "any",
  service: "any",
  venueType: "any",
};

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
    experience: "6 років",
    locationNote: "У своїй студії",
    description:
      "Світла студія в Печерському районі з окремим кабінетом для манікюру. Зручне робоче місце та комфортний простір для клієнтів.",
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


// Похідна підміна district для mock/discovery-карток у львівському режимі —
// самі масиви (topRated/fresh/partners) не редагуються, district
// перезаписується детерміновано (по колу з LVIV_DISTRICTS) тільки для
// відображення у Львові; в Києві функція просто не викликається.
function toLvivDiscoveryCards<T extends { district: string }>(cards: T[]): T[] {
  return cards.map((card, index) => ({
    ...card,
    district: LVIV_DISTRICTS[index % LVIV_DISTRICTS.length],
  }));
}

function RecommendationCarousel({
  cards,
  t,
  variant,
  onLocationClick,
  hasSearch = true,
}: {
  cards: CardData[];
  t: Translations;
  variant: "salons" | "masters" | "nearby" | "worth-trying" | "fresh";
  onLocationClick?: (name: string, district: string, distance: string) => void;
  hasSearch?: boolean;
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

  const isShortList = cards.length > 0 && cards.length < 4;

  const aiStampRevealKey = cards
    .map((card) => `${card.title}:${card.aiMatchScore ?? ""}`)
    .join("|");

  useEffect(() => {
    if (!hasSearch || (variant !== "salons" && variant !== "masters")) return;

    const track = trackRef.current;
    if (!track) return;

    const frame = requestAnimationFrame(() => {
      const trackRect = track.getBoundingClientRect();
      const visibleCards = Array.from(track.querySelectorAll<HTMLElement>(".card")).filter((card) => {
        const rect = card.getBoundingClientRect();
        const visibleWidth = Math.min(rect.right, trackRect.right) - Math.max(rect.left, trackRect.left);
        return visibleWidth > 40;
      });

      visibleCards.forEach((card, index) => {
        const badge = card.querySelector<HTMLElement>(".badge.ai-match");
        if (!badge) return;

        const delays = [0, 350, 570, 710];
        const durations = [600, 400, 300, 220];
        const extraIndex = Math.max(0, index - 3);
        const delay = index < delays.length ? delays[index] : 710 + extraIndex * Math.max(50, 100 - extraIndex * 15);
        const duration = index < durations.length ? durations[index] : 190;

        badge.style.setProperty("--ai-stamp-delay", `${delay}ms`);
        badge.style.setProperty("--ai-stamp-duration", `${duration}ms`);
        badge.classList.add("ai-match-stamp-reveal");
        if (index === 0) badge.classList.add("ai-match-stamp-impact");
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [aiStampRevealKey, hasSearch, variant]);

  return (
    <div
      className={`recommendation-carousel recommendation-carousel-${variant}${
        isShortList ? " is-short-list" : ""
      }`}
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
            hideAiMatch={!hasSearch}
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
  city,
  onLocationClick,
}: {
  cards: CardData[];
  lang: Lang;
  city: CityName;
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
            <span
              className="section-title-floating-icon kyiv-top-crown"
              aria-hidden="true"
            >
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
              {ua ? `Найкращі в ${city === "Київ" ? "Києві" : "Львові"}` : `Best in ${city === "Київ" ? "Kyiv" : "Lviv"}`}
            </h2>
          </div>

          <p className="section-sub kyiv-top-subtitle">
            {ua
              ? "Топ за рейтингом і бронюваннями"
              : "Top by rating and bookings"}
          </p>
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
                 <button
                    className="kyiv-cover-book"
                    type="button"
                    onClick={() => {
                      const currentUser = readStoredUser();

                      if (!currentUser || currentUser.role !== "client") {
                        window.dispatchEvent(
                          new CustomEvent("beautyai:auth-required", {
                            detail: {
                              data: card,
                              action: "booking",
                            },
                          })
                        );
                        return;
                      }

                      if (card.variant === "solo") {
                        setBookingCard(card);
                        return;
                      }

                      setActiveCard(card);
                    }}
                  >
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
              if (activeCard.website) {
                window.open(activeCard.website, "_blank", "noopener,noreferrer");
              } else {
                window.alert(
                  ua
                    ? "Онлайн-запис для цього салону скоро буде доступний."
                    : "Online booking for this salon will be available soon."
                );
              }
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
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authIntent, setAuthIntent] = useState<{
    mode: "login" | "register";
    role: Exclude<AuthRole, "admin">;
    partnerKind?: "solo" | "salon";
  }>({
    mode: "login",
    role: "client",
  });
  const [partnerChoiceOpen, setPartnerChoiceOpen] = useState(false);
  const [user, setUser] = useState<MockUser | null>(() => readStoredUser());
  const [view, setView] = useState<AppView>("home");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [recommendationFiltersOpen, setRecommendationFiltersOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityName | null>(() => readStoredCity());
  const [cityPickerOpen, setCityPickerOpen] = useState(() => readStoredCity() === null);
  const [locationPending, setLocationPending] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [clientCoordinates, setClientCoordinates] = useState<ClientCoordinates | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const initialFilterState: FilterState = {
    ...NEUTRAL_FILTERS,
    rating: "from45",
    distance: "to3km",
    availability: "today",
    city: selectedCity ? CITY_NAME_TO_SLUG[selectedCity] : "kyiv",
  };
  const [activeFilters, setActiveFilters] = useState<FilterState>(initialFilterState);
  const [filterDraft, setFilterDraft] = useState<FilterState>(initialFilterState);
  const [assistantEnabled, setAssistantEnabled] = useState(() => {
    try {
      return localStorage.getItem("beautyai_assistant_enabled") !== "false";
    } catch {
      return true;
    }
  });
  const [showAiReply, setShowAiReply] = useState(() => {
    try {
      return localStorage.getItem("beautyai_show_ai_reply") === "true";
    } catch {
      return false;
    }
  });
  const [greetingDismissed, setGreetingDismissed] = useState(() => {
    try {
      const alreadyShown =
        sessionStorage.getItem("beautyai_greeting_shown") === "true";

      if (!alreadyShown) {
        sessionStorage.setItem("beautyai_greeting_shown", "true");
      }

      return alreadyShown;
    } catch {
      return false;
    }
  });
  const [assistantResultTarget, setAssistantResultTarget] = useState<"salons" | "masters">("salons");
  const mastersSectionRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isResettingSearch, setIsResettingSearch] = useState(false);
  const resetTransitionTimeoutRef = useRef<number | null>(null);
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);
  const [marketplaceError, setMarketplaceError] = useState(false);
  const [marketplaceRetrying, setMarketplaceRetrying] = useState(false);
  const [marketplaceReloadKey, setMarketplaceReloadKey] = useState(0);
  const marketplaceRetryTimerRef = useRef<number | null>(null);
  const marketplaceHasRespondedRef = useRef(false);
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string | null>(null);
  const [citySearchPending, setCitySearchPending] = useState(false);
  const [conversationId, setConversationId] = useState<string | number | null>(() => readAiConversationId());
  const [aiReplyText, setAiReplyText] = useState("");
  const [aiSearchIntent, setAiSearchIntent] = useState<AiSearchIntent | null>(null);
  const [serviceCatalog, setServiceCatalog] = useState<string[]>([]);
  const [aiSearchError, setAiSearchError] = useState(false);
  const [aiStatus, setAiStatus] = useState<"checking" | "ok" | "limited" | "offline">("checking");
  const [aiClarificationMessage, setAiClarificationMessage] = useState<string | null>(null);
  const searchStartedAtRef = useRef(0);
  const aiRequestIdRef = useRef(0);
  const searchFinishTimeoutRef = useRef<number | null>(null);
  const [selectedMapLocation, setSelectedMapLocation] = useState<SelectedMapLocation | null>(null);
  const [masterRegistryVersion, setMasterRegistryVersion] = useState(0);
  const [clientAuthGate, setClientAuthGate] = useState<{ data: CardData; action: "booking" | "favorite" } | null>(null);
  const [pendingClientAction, setPendingClientAction] = useState<{ data: CardData; action: "booking" | "favorite" } | null>(null);
  const [bookingCard, setBookingCard] = useState<CardData | null>(null);
  const [salonCards, setSalonCards] = useState<CardData[]>([]);
  const [masterCards, setMasterCards] = useState<CardData[]>([]);
  const t = dict[lang];

  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, "");
    if (path !== "/verify-email" && path !== "/beauty.ai/verify-email") return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const token = params.get("token");

    setAuthIntent({ mode: "login", role: "client" });
    setAuthOpen(true);

    if (!id || !token) {
      setAuthNotice(null);
      return;
    }

    let cancelled = false;
    void fetch(`${API_BASE_URL}/api/users/verify-email/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, token }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.detail || "Email verification failed");
        }
        if (cancelled) return;
        setAuthNotice(lang === "ua"
          ? "Email підтверджено. Тепер увійдіть у свій акаунт."
          : "Email verified. You can now sign in.");
        window.history.replaceState({}, "", "/");
      })
      .catch(() => {
        if (cancelled) return;
        setAuthNotice(lang === "ua"
          ? "Не вдалося підтвердити email. Посилання недійсне або застаріло."
          : "Could not verify email. The link is invalid or expired.");
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refreshAiHealth = () => {
      void checkAiHealth().then((healthy) => {
        if (cancelled) return;
        setAiStatus((current) => {
          if (!healthy) return "offline";
          return current === "limited" ? "limited" : "ok";
        });
      });
    };

    refreshAiHealth();
    const intervalId = window.setInterval(refreshAiHealth, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const chooseCity = (city: CityName) => {
    const citySlug = CITY_NAME_TO_SLUG[city];
    const cityChanged = city !== selectedCity;

    if (cityChanged) {
      if (searchFinishTimeoutRef.current !== null) {
        window.clearTimeout(searchFinishTimeoutRef.current);
        searchFinishTimeoutRef.current = null;
      }
      searchStartedAtRef.current = performance.now();
      setCitySearchPending(true);
      setIsSearching(true);
    }

    setSelectedCity(city);
    setActiveFilters((prev) => ({ ...prev, city: citySlug, district: "any" }));
    setFilterDraft((prev) => ({ ...prev, city: citySlug, district: "any" }));
    setCityPickerOpen(false);
    setLocationError("");
    try {
      localStorage.setItem(CITY_STORAGE_KEY, city);
    } catch {
      // Storage may be unavailable in private/restricted browser modes.
    }
  };

  const detectCity = () => {
    if (!navigator.geolocation) {
      setLocationError(
        lang === "ua"
          ? "Ваш браузер не підтримує визначення місцезнаходження."
          : "Your browser does not support geolocation."
      );
      return;
    }

    setLocationPending(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setClientCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        chooseCity(
          nearestSupportedCity(
            position.coords.latitude,
            position.coords.longitude
          )
        );
        setLocationPending(false);
      },
      (error) => {
        setLocationPending(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? lang === "ua"
              ? "Доступ до геолокації не надано. Оберіть місто вручну."
              : "Location access was not granted. Choose a city manually."
            : lang === "ua"
              ? "Не вдалося визначити місцезнаходження. Оберіть місто вручну."
              : "Could not determine your location. Choose a city manually."
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  };

  const cityMatches = (card: CardData) =>
    !selectedCity ||
    (card.city || "").trim().toLowerCase() === selectedCity.toLowerCase();

  const citySalonCards = salonCards.filter(cityMatches);

  // Для Києва секція лишається на моковому "nearby" без змін. Для Львова
  // показуємо реальні салони (citySalonCards уже відфільтровані по місту
  // через card.city, яке приходить із salonToCard/getSalonCityName), а не
  // мокові київські картки.
  const cityTopCards: CardData[] =
    selectedCity === "Львів"
      ? [...citySalonCards]
          .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
          .slice(0, nearby.length)
      : nearby;

  // Ті самі мокові topRated/fresh/partners лишаються контентом і для Львова —
  // міняється тільки district (реальні salon cards тут ні до чого, це не
  // "Найкращі у ..." секція, а суто discovery-вітрина).
  const topRatedCards = selectedCity === "Львів" ? toLvivDiscoveryCards(topRated) : topRated;
  const freshCards = selectedCity === "Львів" ? toLvivDiscoveryCards(fresh) : fresh;
  const partnersCards = selectedCity === "Львів" ? toLvivDiscoveryCards(partners) : partners;

  const searchedSalons = citySalonCards
    .filter((card) => cardMatchesAiService(card, aiSearchIntent?.serviceQuery ?? null))
    .filter((card) => cardMatchesAiDistrict(card, aiSearchIntent?.district ?? null))
    .filter((card) => cardMatchesAiRating(card, aiSearchIntent?.minRating ?? null));
  const hasSearch = appliedSearch.trim().length > 0;

  const runSearch = () => {
    if (resetTransitionTimeoutRef.current !== null) {
      window.clearTimeout(resetTransitionTimeoutRef.current);
      resetTransitionTimeoutRef.current = null;
      setIsResettingSearch(false);
    }

    const query = searchQuery.trim();

    if (!query) {
      return;
    }

    setGreetingDismissed(true);
    setSearchFocused(false);

    if (searchFinishTimeoutRef.current !== null) {
      window.clearTimeout(searchFinishTimeoutRef.current);
      searchFinishTimeoutRef.current = null;
    }

    searchStartedAtRef.current = performance.now();
    setIsSearching(true);
    setPendingSearchQuery(query);
    setAiReplyText("");
    // Keep the previous intent/filters active while a refinement request is in flight.
    // This keeps the current result cards visible until the new intent arrives.
    setAiSearchError(false);
    setAiClarificationMessage(null);

    const localIntent = buildLocalFallbackIntent(query, serviceCatalog);
    const canResolveLocally = Boolean(
      localIntent.serviceQuery &&
      (localIntent.date || localIntent.time || localIntent.availability === "today" || localIntent.availability === "tomorrow")
    );

    if (canResolveLocally) {
      aiRequestIdRef.current += 1;
      const citySlug =
        localIntent.city ?? (selectedCity ? CITY_NAME_TO_SLUG[selectedCity] : "");
      const cityName = localIntent.city ? CITY_SLUG_TO_NAME[localIntent.city] : undefined;
      const nextFilters: FilterState = {
        ...activeFilters,
        city: citySlug,
        district: mapAiDistrictToFilter(localIntent.district),
        availability: localIntent.availability ?? "anytime",
        priceMin: localIntent.priceMin != null ? String(localIntent.priceMin) : "",
        priceMax: localIntent.priceMax != null ? String(localIntent.priceMax) : "",
        rating: mapAiRatingToFilter(localIntent.minRating),
        venueType: localIntent.venueType ?? "any",
      };

      setAiSearchIntent(localIntent);
      setActiveFilters(nextFilters);
      setFilterDraft(nextFilters);
      setAiSearchError(false);
      setAiClarificationMessage(null);
      setAiReplyText(`Local intent: ${JSON.stringify(localIntent)}`);

      if (cityName) {
        setSelectedCity(cityName);
        setCityPickerOpen(false);
        setLocationError("");
        try {
          localStorage.setItem(CITY_STORAGE_KEY, cityName);
        } catch {
          // Storage is optional.
        }
      }
      return;
    }

    const requestId = ++aiRequestIdRef.current;

    void requestAiSearch(query, conversationId)
      .then(({ result, conversationId: nextConversationId }) => {
        if (requestId !== aiRequestIdRef.current) return;

        setAiStatus("ok");
        setConversationId(nextConversationId);
        writeAiConversationId(nextConversationId);

        // Search never waits for a second user message. If AI returns prose instead
        // of a structured intent, use the local parser for filtering and keep the
        // raw AI text only as a temporary debug bubble.
        const localHints = buildLocalFallbackIntent(query, serviceCatalog);
        const intent = result.kind === "intent"
          ? {
              ...result.intent,
              serviceQuery: result.intent.serviceQuery ?? localHints.serviceQuery,
              city: result.intent.city ?? localHints.city,
              district: result.intent.district ?? localHints.district,
              priceMin: result.intent.priceMin ?? localHints.priceMin,
              priceMax: result.intent.priceMax ?? localHints.priceMax,
              minRating: result.intent.minRating ?? localHints.minRating,
              venueType: result.intent.venueType ?? localHints.venueType,
              availability: result.intent.availability ?? localHints.availability,
              date: result.intent.date ?? localHints.date,
              time: result.intent.time ?? localHints.time,
            }
          : localHints;

        setAiClarificationMessage(null);
        setAiReplyText(
          result.kind === "intent"
            ? `AI intent: ${JSON.stringify(result.intent)}`
            : `AI raw: ${result.message} | fallback: ${JSON.stringify(intent)}`
        );

        const citySlug =
          intent.city ?? (selectedCity ? CITY_NAME_TO_SLUG[selectedCity] : "");
        const cityName = intent.city ? CITY_SLUG_TO_NAME[intent.city] : undefined;
        const nextFilters: FilterState = {
          ...activeFilters,
          city: citySlug,
          district: mapAiDistrictToFilter(intent.district),
          availability: intent.availability ?? "anytime",
          priceMin: intent.priceMin != null ? String(intent.priceMin) : "",
          priceMax: intent.priceMax != null ? String(intent.priceMax) : "",
          rating: mapAiRatingToFilter(intent.minRating),
          venueType: intent.venueType ?? "any",
        };

        setAiSearchIntent(intent);
        setActiveFilters(nextFilters);
        setFilterDraft(nextFilters);

        if (cityName) {
          setSelectedCity(cityName);
          setCityPickerOpen(false);
          setLocationError("");
          try {
            localStorage.setItem(CITY_STORAGE_KEY, cityName);
          } catch {
            // Storage may be unavailable in private/restricted browser modes.
          }
        }
      })
      .catch((error) => {
        if (requestId !== aiRequestIdRef.current) return;

        console.error("AI search request failed", error);

        const isLimited = error instanceof AiRequestError && error.status === 429;
        setAiStatus(isLimited ? "limited" : "offline");

        // AI недоступний — не блокуємо пошук. Локально витягуємо базові
        // service/city/date hints і запускаємо той самий marketplace filtering.
        const fallbackIntent = buildLocalFallbackIntent(query, serviceCatalog);
        const citySlug =
          fallbackIntent.city ??
          (selectedCity ? CITY_NAME_TO_SLUG[selectedCity] : "");
        const cityName = fallbackIntent.city ? CITY_SLUG_TO_NAME[fallbackIntent.city] : undefined;
        const nextFilters: FilterState = {
          ...activeFilters,
          city: citySlug,
          district: mapAiDistrictToFilter(fallbackIntent.district),
          availability: fallbackIntent.availability ?? "anytime",
          priceMin: fallbackIntent.priceMin != null ? String(fallbackIntent.priceMin) : "",
          priceMax: fallbackIntent.priceMax != null ? String(fallbackIntent.priceMax) : "",
          rating: mapAiRatingToFilter(fallbackIntent.minRating),
          venueType: fallbackIntent.venueType ?? "any",
        };

        setAiSearchIntent(fallbackIntent);
        setActiveFilters(nextFilters);
        setFilterDraft(nextFilters);
        setAiSearchError(false);
        setAiClarificationMessage(null);
        setAiReplyText(
          `${isLimited ? "AI 429" : "AI offline"} | fallback: ${JSON.stringify(fallbackIntent)}`
        );

        if (cityName) {
          setSelectedCity(cityName);
          setCityPickerOpen(false);
          try {
            localStorage.setItem(CITY_STORAGE_KEY, cityName);
          } catch {
            // Storage is optional.
          }
        }
      });

  };

  const resetSearch = () => {
    aiRequestIdRef.current += 1;

    if (searchFinishTimeoutRef.current !== null) {
      window.clearTimeout(searchFinishTimeoutRef.current);
      searchFinishTimeoutRef.current = null;
    }
    if (resetTransitionTimeoutRef.current !== null) {
      window.clearTimeout(resetTransitionTimeoutRef.current);
    }

    // First let the current result state leave gracefully. Only after the
    // short fade do we collapse the search state and expand the idle hero.
    setSearchQuery("");
    setIsSearching(false);
    setSearchFocused(false);
    setRecommendationFiltersOpen(false);
    setIsResettingSearch(true);

    resetTransitionTimeoutRef.current = window.setTimeout(() => {
      setAppliedSearch("");
      setPendingSearchQuery(null);
      setGreetingDismissed(true);
      setActiveCategory(null);
      setAiReplyText("");
      setAiSearchIntent(null);
      setAiSearchError(false);
      setAiClarificationMessage(null);
      setIsResettingSearch(false);
      resetTransitionTimeoutRef.current = null;
    }, 220);
  };
  const liveMasterRecommendations = buildStoredMasterCards(masterCards);
  const cityMasterCards = liveMasterRecommendations.filter((card) =>
    !selectedCity ||
    !card.city ||
    card.city.trim().toLowerCase() === selectedCity.toLowerCase()
  );

  const [availabilityEligible, setAvailabilityEligible] = useState<Set<string> | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const availabilityCheckIdRef = useRef(0);

  useEffect(() => {
    const intent = aiSearchIntent;
    const wantsCheck = Boolean(
      intent && (intent.date || intent.time || intent.availability === "today" || intent.availability === "tomorrow")
    );

    if (!wantsCheck || !intent) {
      availabilityCheckIdRef.current += 1;
      setAvailabilityEligible(null);
      setCheckingAvailability(false);
      return;
    }

    const targetDate = resolveIntentDate(intent);
    if (!targetDate) {
      setAvailabilityEligible(null);
      setCheckingAvailability(false);
      return;
    }

    const checkId = ++availabilityCheckIdRef.current;
    setAvailabilityEligible(null);
    setCheckingAvailability(true);

    const masterCandidates = cityMasterCards
      .filter((card) =>
        cardMatchesAiService(card, intent.serviceQuery) &&
        cardMatchesAiDistrict(card, intent.district) &&
        cardMatchesAiRating(card, intent.minRating) &&
        cardMatchesFilters(card, activeFilters) &&
        card.backendMasterId != null
      )
      .flatMap((card) =>
        (card.backendServices ?? [])
          .filter((service) => serviceNameMatchesQuery(service.name, intent.serviceQuery))
          .map((service) => ({
            key: `master:${card.backendMasterId}`,
            masterId: card.backendMasterId as number,
            serviceId: service.id,
            salonId: undefined as number | undefined,
          }))
      );

    const uniqueCandidates = Array.from(
      new Map(
        masterCandidates.map((candidate) => [
          `${candidate.key}:${candidate.masterId}:${candidate.serviceId}:solo`,
          candidate,
        ])
      ).values()
    );

    if (!uniqueCandidates.length) {
      setAvailabilityEligible(new Set());
      setCheckingAvailability(false);
      return;
    }

    const runChecks = async () => {
      const eligible = new Set<string>();
      let cursor = 0;
      const workerCount = Math.min(6, uniqueCandidates.length);

      const worker = async () => {
        while (cursor < uniqueCandidates.length) {
          const candidate = uniqueCandidates[cursor++];
          try {
            const slots = await fetchAvailableSlots({
              masterId: candidate.masterId,
              serviceId: candidate.serviceId,
              date: targetDate,
              salonId: candidate.salonId,
            });
            if (slotsIncludeTime(slots, intent.time)) eligible.add(candidate.key);
          } catch (error) {
            console.warn("Availability check failed", candidate, error);
          }
        }
      };

      await Promise.all(Array.from({ length: workerCount }, () => worker()));
      if (checkId !== availabilityCheckIdRef.current) return;
      setAvailabilityEligible(eligible);
      setCheckingAvailability(false);
    };

    void runChecks();
  }, [aiSearchIntent, activeFilters, selectedCity, salonCards, masterCards]);

  const aiRankingOrigin: ClientCoordinates | null = clientCoordinates ?? (
    selectedCity
      ? { lat: CITY_CENTERS[selectedCity].lat, lng: CITY_CENTERS[selectedCity].lng }
      : null
  );

  const filteredSalons = rankAiMatches(
    searchedSalons
      .filter((card) => cardMatchesFilters(card, activeFilters))
      .filter((card) => salonMatchesRequestedWorkingHours(card, aiSearchIntent)),
    aiSearchIntent,
    aiRankingOrigin
  );

  const filteredMasters = rankAiMatches(
    cityMasterCards
      .filter((card) => cardMatchesAiService(card, aiSearchIntent?.serviceQuery ?? null))
      .filter((card) => cardMatchesAiDistrict(card, aiSearchIntent?.district ?? null))
      .filter((card) => cardMatchesAiRating(card, aiSearchIntent?.minRating ?? null))
      .filter((card) => cardMatchesFilters(card, activeFilters))
      .filter((card) => !availabilityEligible || availabilityEligible.has(`master:${card.backendMasterId}`))
      .map((card) => {
        const query = aiSearchIntent?.serviceQuery ?? null;
        if (!query) return card;
        const matchedTag = card.tags.find((tag) => serviceNameMatchesQuery(tag, query));
        return matchedTag ? { ...card, type: `Майстер · ${matchedTag}` } : card;
      }),
    aiSearchIntent,
    aiRankingOrigin
  );

  const searchDraftChanged =
    searchQuery.trim() !== appliedSearch.trim();
  
  const hasNoResults =
    hasSearch &&
    !isSearching &&
    filteredSalons.length === 0 &&
    filteredMasters.length === 0;

  const hasVisibleResults =
    hasSearch &&
    (filteredSalons.length > 0 || filteredMasters.length > 0);

  const assistantUiState =
    isSearching || checkingAvailability || (marketplaceError && marketplaceRetrying)
      ? "search"
      : (marketplaceError || aiSearchError) && hasSearch && !searchDraftChanged
        ? "error"
        : hasSearch && hasNoResults && !searchDraftChanged
          ? "no-result"
            : recommendationFiltersOpen && hasSearch && !searchDraftChanged
              ? "help"
              : hasSearch && !searchDraftChanged
                ? "success"
                : searchFocused || activeCategory !== null
                  ? "what-you-doing"
                  : !greetingDismissed
                    ? "greeting"
                    : "waiting";

  const showWhatYouDoing =
    assistantEnabled &&
    assistantUiState === "what-you-doing";

  useEffect(() => {
    if (assistantUiState !== "success") {
      setAssistantResultTarget("salons");
    }
  }, [assistantUiState, appliedSearch]);

  useEffect(() => {
    if (
      assistantUiState !== "success" ||
      filteredSalons.length === 0 ||
      filteredMasters.length === 0
    ) {
      return;
    }

    const mastersSection = mastersSectionRef.current;
    if (!mastersSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAssistantResultTarget("masters");
        } else if (entry.boundingClientRect.top > 0) {
          setAssistantResultTarget("salons");
        }
      },
      {
        threshold: 0.2,
      }
    );

    observer.observe(mastersSection);

    return () => observer.disconnect();
  }, [
    assistantUiState,
    filteredSalons.length,
    filteredMasters.length,
  ]);

  const getUaCountWord = (
    value: number,
    one: string,
    few: string,
    many: string
  ) => {
    const lastTwo = value % 100;
    const last = value % 10;

    if (lastTwo >= 11 && lastTwo <= 14) {
      return many;
    }

    if (last === 1) {
      return one;
    }

    if (last >= 2 && last <= 4) {
      return few;
    }

    return many;
  };

  const assistantResultMessage =
    lang === "ua"
      ? [
          filteredSalons.length > 0
            ? `${filteredSalons.length} ${getUaCountWord(
                filteredSalons.length,
                "салон",
                "салони",
                "салонів"
              )}`
            : "",
          filteredMasters.length > 0
            ? `${filteredMasters.length} ${getUaCountWord(
                filteredMasters.length,
                "майстер",
                "майстри",
                "майстрів"
              )}`
            : "",
        ]
          .filter(Boolean)
          .join(" і ")
          .replace(/^/, "Я знайшов ")
          .concat(" за твоїм запитом")
      : `I found ${[
          filteredSalons.length > 0
            ? `${filteredSalons.length} salon${filteredSalons.length === 1 ? "" : "s"}`
            : "",
          filteredMasters.length > 0
            ? `${filteredMasters.length} master${filteredMasters.length === 1 ? "" : "s"}`
            : "",
        ]
          .filter(Boolean)
          .join(" and ")} for your request`;

  // AI reply display is optional. By default the assistant shows the stable
  // marketplace result count; the separate AI toggle switches to the raw AI reply.
  const finalAssistantMessage =
    showAiReply && aiReplyText ? aiReplyText : assistantResultMessage;

  void masterRegistryVersion;

  const handleApplyFilters = (filters: FilterState) => {
    setActiveFilters(filters);
    setRecommendationFiltersOpen(false);
    setGreetingDismissed(true);
  };

  const handleResetFilters = (filters: FilterState) => {
    setFilterDraft(filters);
    setActiveFilters(filters);
  };

  const retryMarketplaceNow = () => {
    if (marketplaceRetryTimerRef.current !== null) {
      window.clearTimeout(marketplaceRetryTimerRef.current);
      marketplaceRetryTimerRef.current = null;
    }

    setMarketplaceError(false);
    setMarketplaceReloadKey((value) => value + 1);
  };

  useEffect(() => {
    let cancelled = false;
    let retryIndex = 0;
    const retryDelays = [3000, 6000, 12000, 24000, 30000];

    const clearRetryTimer = () => {
      if (marketplaceRetryTimerRef.current !== null) {
        window.clearTimeout(marketplaceRetryTimerRef.current);
        marketplaceRetryTimerRef.current = null;
      }
    };

    const loadMarketplace = async (isRetry: boolean) => {
      if (cancelled) return;

      if (isRetry) {
        setMarketplaceRetrying(true);
      } else {
        setMarketplaceLoading(true);
      }

      const [salonsResult, mastersResult, servicesResult] = await Promise.all([
        fetchSalons()
          .then((data) => ({ ok: true as const, data }))
          .catch((error) => {
            console.error("Salons are unavailable", error);
            return { ok: false as const, data: null };
          }),
        fetchMasters()
          .then((data) => ({ ok: true as const, data }))
          .catch((error) => {
            console.error("Masters are unavailable", error);
            return { ok: false as const, data: null };
          }),
        fetchServices()
          .then((data) => ({ ok: true as const, data }))
          .catch((error) => {
            console.warn("Service prices are unavailable", error);
            return { ok: false as const, data: [] as ServiceApi[] };
          }),
      ]);

      if (cancelled) return;

      const salonsFailed = !salonsResult.ok;
      const mastersFailed = !mastersResult.ok;
      const salons = salonsResult.data ?? [];
      const masters = mastersResult.data ?? [];
      const services = servicesResult.data;

      if (salonsResult.ok || mastersResult.ok) {
        marketplaceHasRespondedRef.current = true;
      }

      setMarketplaceError(
        salonsFailed && mastersFailed && !marketplaceHasRespondedRef.current
      );

      if (import.meta.env.DEV) {
        console.info("[Beauty AI marketplace]", {
          salons: salonsResult.ok ? salons.length : "unavailable",
          masters: mastersResult.ok ? masters.length : "unavailable",
          services: servicesResult.ok ? services.length : "unavailable",
          selectedCity,
          retry: isRetry,
        });
      }

      const salonTagsById = new Map<number, Set<string>>();
      const masterPricesById = new Map<number, number[]>();
      const masterServicesById = new Map<number, Set<string>>();
      const servicePriceById = new Map<number, number>();
      const servicePriceByName = new Map<string, number>();

      const catalogNames = new Set<string>();

      services.forEach((service: ServiceApi) => {
        const catalogPrice = Number(service.price);
        if (Number.isFinite(catalogPrice) && catalogPrice > 0) {
          servicePriceById.set(service.id, catalogPrice);
          servicePriceByName.set(service.name.trim().toLowerCase(), catalogPrice);
        }

        const catalogName = service.name?.trim().toLowerCase();
        if (catalogName) catalogNames.add(catalogName);

        const price = Number(service.price);
        const hasValidPrice = Number.isFinite(price) && price > 0;

        service.masters?.forEach((masterRef) => {
          const rawId =
            typeof masterRef === "object" && masterRef
              ? masterRef.id
              : masterRef;

          const masterId = Number(rawId);
          if (!Number.isFinite(masterId)) return;

          const serviceNames =
            masterServicesById.get(masterId) ?? new Set<string>();

          serviceNames.add(service.name);
          masterServicesById.set(masterId, serviceNames);

          if (hasValidPrice) {
            const prices = masterPricesById.get(masterId) ?? [];
            prices.push(price);
            masterPricesById.set(masterId, prices);
          }
        });
      });

      if (mastersResult.ok) {
        masters.forEach((master) => {
          const serviceNames =
            master.services
              ?.map((service) => service.name)
              .filter(Boolean) ?? [];

          master.salons?.forEach((salon) => {
            const tags = salonTagsById.get(salon.id) ?? new Set<string>();
            serviceNames.forEach((serviceName) => tags.add(serviceName));
            salonTagsById.set(salon.id, tags);
          });
        });
      }

      // Partial success is intentional: a failed endpoint never wipes data that
      // another successful request already loaded on a previous attempt.
      if (salonsResult.ok) {
        setSalonCards(
          salons.map((salon) => {
            const salonMasterIds = mastersResult.ok
              ? masters
                  .filter((master) =>
                    master.salons?.some((item) => item.id === salon.id)
                  )
                  .map((master) => master.id)
              : [];

            const salonPrices = salonMasterIds.flatMap((masterId) => {
              const master = masters.find((item) => item.id === masterId);

              const directPrices =
                master?.services
                  ?.map((service) => {
                    const ownPrice = Number(service.price);
                    if (Number.isFinite(ownPrice) && ownPrice > 0) return ownPrice;

                    const byId = servicePriceById.get(service.id);
                    if (byId) return byId;

                    return servicePriceByName.get(service.name.trim().toLowerCase()) ?? 0;
                  })
                  .filter((price) => Number.isFinite(price) && price > 0) ?? [];

              return [
                ...directPrices,
                ...(masterPricesById.get(masterId) ?? []),
              ];
            });

            return salonToCard(
              salon,
              Array.from(salonTagsById.get(salon.id) ?? []),
              salonPrices
            );
          })
        );
      }

      if (mastersResult.ok) {
        setMasterCards(
          masters
            .filter((master) => !master.salons?.length)
            .map((master) => {
              const directPrices =
                master.services
                  ?.map((service) => {
                    const ownPrice = Number(service.price);
                    if (Number.isFinite(ownPrice) && ownPrice > 0) return ownPrice;

                    const byId = servicePriceById.get(service.id);
                    if (byId) return byId;

                    return servicePriceByName.get(service.name.trim().toLowerCase()) ?? 0;
                  })
                  .filter((price) => Number.isFinite(price) && price > 0) ?? [];

              return masterToCard(
                master,
                [
                  ...directPrices,
                  ...(masterPricesById.get(master.id) ?? []),
                ],
                Array.from(
                  new Set([
                    ...(master.services?.map((service) => service.name).filter(Boolean) ?? []),
                    ...Array.from(masterServicesById.get(master.id) ?? []),
                  ])
                )
              );
            })
        );
      }

      if (servicesResult.ok) {
        setServiceCatalog(
          Array.from(catalogNames).sort((a, b) => b.length - a.length)
        );
      }

      setMarketplaceLoading(false);

      if (salonsFailed || mastersFailed) {
        setMarketplaceRetrying(true);
        const delay = retryDelays[Math.min(retryIndex, retryDelays.length - 1)];
        retryIndex += 1;
        clearRetryTimer();
        marketplaceRetryTimerRef.current = window.setTimeout(() => {
          marketplaceRetryTimerRef.current = null;
          void loadMarketplace(true);
        }, delay);
      } else {
        retryIndex = 0;
        clearRetryTimer();
        setMarketplaceRetrying(false);
        setMarketplaceError(false);
      }
    };

    void loadMarketplace(false);

    return () => {
      cancelled = true;
      clearRetryTimer();
      setMarketplaceRetrying(false);
    };
  }, [selectedCity, marketplaceReloadKey]);

  useEffect(() => {
    if (marketplaceLoading || !citySearchPending) return;

    const minimumAnimationMs = 2200;
    const elapsed = performance.now() - searchStartedAtRef.current;
    const remaining = Math.max(0, minimumAnimationMs - elapsed);

    searchFinishTimeoutRef.current = window.setTimeout(() => {
      setCitySearchPending(false);
      setIsSearching(false);
      searchFinishTimeoutRef.current = null;
    }, remaining);

    return () => {
      if (searchFinishTimeoutRef.current !== null) {
        window.clearTimeout(searchFinishTimeoutRef.current);
        searchFinishTimeoutRef.current = null;
      }
    };
  }, [marketplaceLoading, citySearchPending]);

  useEffect(() => {
    if (
      marketplaceLoading ||
      checkingAvailability ||
      (marketplaceError && marketplaceRetrying) ||
      !pendingSearchQuery ||
      (!aiSearchIntent && !aiSearchError)
    ) {
      return;
    }

    const minimumAnimationMs = 2200;
    const elapsed = performance.now() - searchStartedAtRef.current;
    const remaining = Math.max(0, minimumAnimationMs - elapsed);

    searchFinishTimeoutRef.current = window.setTimeout(() => {
      setAppliedSearch(pendingSearchQuery);
      setPendingSearchQuery(null);
      setIsSearching(false);
      searchFinishTimeoutRef.current = null;
    }, remaining);

    return () => {
      if (searchFinishTimeoutRef.current !== null) {
        window.clearTimeout(searchFinishTimeoutRef.current);
        searchFinishTimeoutRef.current = null;
      }
    };
  }, [
    marketplaceLoading,
    marketplaceError,
    marketplaceRetrying,
    checkingAvailability,
    pendingSearchQuery,
    aiSearchIntent,
    aiSearchError,
  ]);

  useEffect(() => {
    return () => {
      aiRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle(
      "beautyai-assistant-disabled",
      !assistantEnabled
    );

    try {
      localStorage.setItem(
        "beautyai_assistant_enabled",
        assistantEnabled ? "true" : "false"
      );
    } catch {
      // The assistant preference is non-critical if storage is unavailable.
    }

    return () => {
      document.body.classList.remove("beautyai-assistant-disabled");
    };
  }, [assistantEnabled]);

  useEffect(() => {
    const refreshMasters = () => setMasterRegistryVersion((value) => value + 1);
    window.addEventListener("beautyai:master-state", refreshMasters as EventListener);
    window.addEventListener("beautyai:client-state", refreshMasters as EventListener);
    window.addEventListener("storage", refreshMasters);
    return () => {
      window.removeEventListener("beautyai:master-state", refreshMasters as EventListener);
      window.removeEventListener("beautyai:client-state", refreshMasters as EventListener);
      window.removeEventListener("storage", refreshMasters);
    };
  }, []);

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

  useEffect(() => {
    const onOpenLocation = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string; district?: string; distance?: string }>).detail;
      if (!detail?.name || !detail.district) return;
      const coords = resolveLocationCoords(detail.name, detail.district, selectedCity);
      setSelectedMapLocation({ name: detail.name, district: detail.district, distance: detail.distance || "", lat: coords[0], lng: coords[1] });
      setView("home");
    };
    window.addEventListener("beautyai:open-location", onOpenLocation as EventListener);
    return () => window.removeEventListener("beautyai:open-location", onOpenLocation as EventListener);
  }, [selectedCity]);

  const handleLocationClick = (name: string, district: string, distance: string) => {
    const coords = resolveLocationCoords(name, district, selectedCity);

    setSelectedMapLocation({
      name,
      district,
      distance,
      lat: coords[0],
      lng: coords[1],
    });
  };

  const handleAuthenticated = (nextUser: MockUser) => {
    const clientProfile = nextUser.role === "client" ? readClientProfile(nextUser) : {};
    const clientAvatar = nextUser.role === "client" ? clientProfile.avatar : undefined;
    const masterProfile = nextUser.role === "master" ? readStoredMasterProfile(nextUser.email) : null;
    const masterDisplayName =
      nextUser.role === "master"
        ? masterProfile?.displayName || nextUser.name
        : nextUser.name;
    const hydratedUser = nextUser.role === "master"
      ? {
          ...nextUser,
          name: masterDisplayName,
          avatar:
            masterDisplayName === "Кароліна Савчук"
              ? LOCAL_MASTER_IMAGES["Кароліна Савчук"]
              : masterProfile?.avatar || nextUser.avatar,
        }
      : nextUser.role === "client"
        ? {
            ...nextUser,
            name: clientProfile.name || nextUser.name,
            avatar:
              clientAvatar ||
              (nextUser.avatar && !nextUser.avatar.includes("pexels.com/photos/774909")
                ? nextUser.avatar
                : makeInitialsAvatar(clientProfile.name || nextUser.name)),
          }
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

    if (nextUser.role === "client") {
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

  useEffect(() => {
    const onAuthExpired = () => handleLogout();
    window.addEventListener("beautyai:auth-expired", onAuthExpired);
    return () => window.removeEventListener("beautyai:auth-expired", onAuthExpired);
  }, []);

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
          <div
            className={`header-context ${
              user ? "header-context--logged-in" : "header-context--logged-out"
            }`}
          >
          <button
            type="button"
            className="city-selector"
            onClick={() => setCityPickerOpen(true)}
            aria-label={lang === "ua" ? "Змінити місто" : "Change city"}
          >
            <span className="city-selector-pin" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <span>{selectedCity || (lang === "ua" ? "Місто" : "City")}</span>
            <span className="city-selector-chevron" aria-hidden="true">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M2 3.5L5 6.5L8 3.5Z" fill="currentColor" />
              </svg>
            </span>
          </button>

          <button
            className="lang-select"
            onClick={() => setLang(lang === "ua" ? "en" : "ua")}
            aria-label="Switch language"
          >
            {lang === "ua" ? "UA" : "EN"}
          </button>
          </div>

          <div className="header-account-slot">
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
        </div>
      </header>

      <section className={`hero-full-width${hasVisibleResults && !isSearching ? " is-active" : " is-idle"}`}>
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

            {assistantEnabled && !showWhatYouDoing && (
              isSearching ? (
                <BeautyAssistant
                  state="search"
                  message={lang === "ua" ? "Я шукаю…" : "I'm searching…"}
                  className="hero-search-assistant"
                />
              ) : hasSearch && (assistantUiState === "error" || assistantUiState === "no-result") ? (
                <BeautyAssistant
                  state={assistantUiState === "error" ? "error" : "no-result"}
                  message={
                    marketplaceError || aiSearchError
                      ? (lang === "ua"
                          ? "Упс! Сталася помилка. Спробуй ще раз."
                          : "Oops! Something went wrong. Try again.")
                      : (lang === "ua"
                          ? "За вашим запитом збігів не знайдено."
                          : "No matches found for your request.")
                  }
                  className="hero-search-assistant"
                />
              ) : !hasSearch ? (
                <BeautyAssistant
                  state={assistantUiState === "greeting" ? "greeting" : "waiting"}
                  message={
                    assistantUiState === "greeting"
                      ? (lang === "ua"
                          ? "Привіт! Я Beauty AI. Опиши, що тобі потрібно."
                          : "Hi! I'm Beauty AI. Tell me what you need.")
                      : (lang === "ua" ? "Очікуємо ваш запит" : "Waiting for your request")
                  }
                  className="hero-search-assistant"
                />
              ) : null
            )}

            {showWhatYouDoing && (
              <BeautyAssistant
                state="what-you-doing"
                className="assistant-what-you-doing"
                ariaLabel={
                  lang === "ua"
                    ? "Beauty AI стежить за пошуком"
                    : "Beauty AI watches the search"
                }
              />
            )}
          <div className={`search-bar${isSearching ? " is-searching" : ""}`}>
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onFocus={() => {
                setGreetingDismissed(true);
                setSearchFocused(true);
              }}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runSearch();
              }}
            />

            {isSearching && (
              <div className="search-bar-ai-loader" aria-hidden="true">
                <span className="ai-sparkle" />
                <span className="ai-sparkle" />
                <span className="ai-sparkle" />
                <span className="ai-sparkle" />
              </div>
            )}
              {(searchQuery || appliedSearch) && (
                <button
                  type="button"
                  className="search-reset-btn"
                  onClick={resetSearch}
                  aria-label={lang === "ua" ? "Скинути пошук" : "Reset search"}
                >
                  ×
                </button>
              )}
              <button className="search-btn" onClick={runSearch}>
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
            <CategoryFilters
              lang={lang}
              activeCategory={activeCategory}
              onCategoryChange={(id, label) => {
                setGreetingDismissed(true);
                setSearchFocused(false);
                setActiveCategory(id);
                setSearchQuery(label);
              }}
            />
          </div>
        </div>
      </section>

    <section className={`section ai-recommendations${isSearching ? " is-searching" : ""}${isResettingSearch ? " is-leaving" : ""}`} id="salons">
      {!isSearching && hasSearch && (
        <div
          className={`recommendations-global-filter${
            recommendationFiltersOpen ? " is-open" : ""
          }`}
        >
          <div className="recommendations-filter-menu recommendations-filter-menu-global">
            <button
              className={`recommendations-filter-toggle recommendations-ai-settings-toggle ${
                recommendationFiltersOpen ? "is-open" : ""
              }`}
              type="button"
              aria-expanded={recommendationFiltersOpen}
              aria-label={
                lang === "ua"
                  ? "Налаштувати AI-підбір"
                  : "Customize AI recommendations"
              }
              data-tooltip={
                lang === "ua"
                  ? "Налаштувати AI-підбір"
                  : "Customize AI recommendations"
              }
              onClick={() => setRecommendationFiltersOpen((open) => !open)}
            >
              <img
                src={settingsIcon}
                alt=""
                aria-hidden="true"
                className="recommendations-ai-settings-icon"
              />
            </button>
          </div>

          {recommendationFiltersOpen && (
            <div className="recommendations-filter-panel recommendations-filter-panel-global">
              <div className="recommendations-filter-panel-heading">
                <div className="recommendations-filter-heading-row">
                  <strong>
                    {lang === "ua" ? (
                      <>
                        НАЛАШТУВАННЯ{" "}
                        <span className="recommendations-filter-ai">AI</span>
                        {" "}ПІДБОРУ
                      </>
                    ) : (
                      <>
                        <span className="recommendations-filter-ai">AI</span>
                        {" "}MATCH SETTINGS
                      </>
                    )}
                  </strong>

                  {assistantEnabled && assistantUiState === "help" && (
                    <BeautyAssistant
                      state="help"
                      message={
                        lang === "ua"
                          ? "Уточніть параметри для точніших рекомендацій"
                          : "Refine the parameters for more accurate recommendations"
                      }
                      className="assistant-filter-help"
                    />
                  )}
                </div>
              </div>

              <FilterBar
                lang={lang}
                value={filterDraft}
                onChange={setFilterDraft}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                onCityChange={(slug) => {
                  const name = CITY_SLUG_TO_NAME[slug];
                  if (name) chooseCity(name);
                }}
              />
            </div>
          )}
        </div>
      )}

      {!hasSearch ? null : (
        <>
          {hasVisibleResults ? (
            <>
              {filteredSalons.length > 0 && (
                <div
                  className={`recommendation-row recommendation-row-salons${
                    filteredMasters.length === 0 ? " recommendation-row-standalone" : ""
                  }`}
                >
                  {assistantEnabled &&
                    assistantUiState === "success" &&
                    assistantResultTarget === "salons" &&
                    !recommendationFiltersOpen && (
                    <BeautyAssistant
                      state="success"
                      message={finalAssistantMessage}
                      className="assistant-results-success"
                    />
                  )}

                  <div className="recommendation-intro">
                    <div className="recommendation-intro-head">
                      <div className="recommendation-title-anchor">
                        <img
                          src={beautyAISparkles}
                          alt=""
                          aria-hidden="true"
                          className="recommendation-heading-spark recommendation-heading-spark-floating"
                        />
                        <h2>{t.sections.recommendations.title}</h2>
                      </div>
                    </div>

                    <p className="section-sub">
                      {lang === "ua"
                        ? "Найкращі збіги за вашим запитом"
                        : "Best matches for your request"}
                    </p>
                  </div>

                  {filteredSalons.length > 0 && (
                    <RecommendationCarousel
                      cards={filteredSalons}
                      t={t}
                      variant="salons"
                      onLocationClick={handleLocationClick}
                      hasSearch={hasSearch}
                    />
                  )}
                </div>
              )}

              {filteredMasters.length > 0 && (
                <div
                  ref={mastersSectionRef}
                  className={`recommendation-row recommendation-row-masters${
                    filteredSalons.length === 0 ? " recommendation-row-standalone" : ""
                  }`}
                  id="masters"
                >
                  {assistantEnabled &&
                    assistantUiState === "success" &&
                    filteredSalons.length === 0 &&
                    !recommendationFiltersOpen && (
                      <BeautyAssistant
                        state="success"
                        message={finalAssistantMessage}
                        className="assistant-results-success"
                      />
                    )}

                  {assistantEnabled &&
                    assistantUiState === "success" &&
                    filteredSalons.length > 0 &&
                    assistantResultTarget === "masters" &&
                    !recommendationFiltersOpen && (
                      <BeautyAssistant
                        state="what-you-doing-2"
                        className="assistant-results-success"
                      />
                    )}

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

                    <p className="section-sub">
                      {lang === "ua"
                        ? "Найкращі майстри за вашим запитом"
                        : "Best masters for your request"}
                    </p>
                  </div>

                  <RecommendationCarousel
                    cards={filteredMasters}
                    t={t}
                    variant="masters"
                    onLocationClick={handleLocationClick}
                    hasSearch={hasSearch}
                  />
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </section>
      {hasVisibleResults && (
        <>
          <div
            className="section-divider section-divider-results"
            aria-hidden="true"
          >
            <span>✦✦✦</span>
          </div>

          <KyivTopSection
            cards={cityTopCards}
            lang={lang}
            city={selectedCity || "Київ"}
            onLocationClick={handleLocationClick}
          />

          <PartnerOffersSection
            title={t.sections.partners.title}
            subtitle={t.sections.partners.subtitle}
            offers={partnersCards}
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
            cards={topRatedCards}
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
            icon={
              <span className="section-symbol-mark section-symbol-mark-new">
                NEW
              </span>
            }
            cards={freshCards}
            t={t}
            lang={lang}
            variant="fresh"
            resultsWord={lang === "ua" ? "новинок знайдено" : "new listings"}
            id="fresh"
            onLocationClick={handleLocationClick}
          />
        </>
      )}
      
      <section
        className={`about-section ${
          hasVisibleResults
            ? "about-section--with-results"
            : "about-section--empty"
        }`}
        id="about"
      >
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
            <BeautyAssistant
              state="help"
              className="booking-auth-gate-help"
              ariaLabel={lang === "ua" ? "Помічник Beauty AI" : "Beauty AI helper"}
            />
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

      {view === "home" && cityPickerOpen && (
        <div
          className="city-picker-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && selectedCity) {
              setCityPickerOpen(false);
            }
          }}
        >
          <section
            className="city-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="city-picker-title"
          >
            {selectedCity && (
              <button
                type="button"
                className="city-picker-close"
                onClick={() => setCityPickerOpen(false)}
                aria-label={lang === "ua" ? "Закрити" : "Close"}
              >
                ×
              </button>
            )}

            <div className="city-picker-icon" aria-hidden="true">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>

            <h2 id="city-picker-title">
              {lang === "ua" ? "Оберіть місто" : "Choose your city"}
            </h2>
            <p>
              {lang === "ua"
                ? "Покажемо салони та майстрів саме у вашому місті."
                : "We’ll show salons and masters in your city."}
            </p>

            <div className="city-picker-options">
              <button
                type="button"
                className={selectedCity === "Київ" ? "is-active" : ""}
                onClick={() => chooseCity("Київ")}
              >
                Київ
              </button>
              <button
                type="button"
                className={selectedCity === "Львів" ? "is-active" : ""}
                onClick={() => chooseCity("Львів")}
              >
                Львів
              </button>
            </div>

            <div className="city-picker-divider">
              <span>{lang === "ua" ? "або" : "or"}</span>
            </div>

            <button
              type="button"
              className="city-detect-btn"
              onClick={detectCity}
              disabled={locationPending}
            >
              <span className="city-detect-pin" aria-hidden="true">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              {locationPending
                ? lang === "ua"
                  ? "Визначаємо…"
                  : "Detecting…"
                : lang === "ua"
                  ? "Визначити моє місцезнаходження"
                  : "Use my current location"}
            </button>

            {locationError && (
              <p className="city-picker-error" role="alert">
                {locationError}
              </p>
            )}
          </section>
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
          initialNotice={authNotice}
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
            <MapSection lang={lang} selectedLocation={selectedMapLocation} city={selectedCity || "Київ"} />
          </div>
        </div>
      )}
      <button
        type="button"
        aria-pressed={showAiReply}
        aria-label={
          showAiReply
            ? (lang === "ua" ? "Показувати кількість результатів" : "Show result count")
            : (lang === "ua" ? "Показувати відповідь AI" : "Show AI reply")
        }
        title={
          showAiReply
            ? (lang === "ua" ? "AI-відповідь увімкнена" : "AI reply enabled")
            : (lang === "ua" ? "Увімкнути AI-відповідь" : "Enable AI reply")
        }
        onClick={() =>
          setShowAiReply((enabled) => {
            const next = !enabled;
            try {
              localStorage.setItem("beautyai_show_ai_reply", next ? "true" : "false");
            } catch {
              // Preference persistence is optional.
            }
            return next;
          })
        }
        style={{
          position: "fixed",
          right: "24px",
          bottom: "88px",
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          border: showAiReply ? "2px solid #9840F0" : "1px solid rgba(148, 64, 240, 0.25)",
          background: showAiReply ? "#9840F0" : "#fff",
          color: showAiReply ? "#fff" : "#9840F0",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: "14px",
          cursor: "pointer",
          zIndex: 1001,
          boxShadow: "0 8px 24px rgba(61, 28, 93, 0.16)",
        }}
      >
        AI
      </button>

      <button
        type="button"
        className={`assistant-toggle ${assistantEnabled ? "is-on" : "is-off"}`}
        onClick={() => setAssistantEnabled((enabled) => !enabled)}
        aria-pressed={assistantEnabled}
        aria-label={
          assistantEnabled
            ? (lang === "ua" ? "Вимкнути Beauty AI помічника" : "Turn off Beauty AI assistant")
            : (lang === "ua" ? "Увімкнути Beauty AI помічника" : "Turn on Beauty AI assistant")
        }
        title={
          assistantEnabled
            ? (lang === "ua" ? "Вимкнути помічника" : "Turn assistant off")
            : (lang === "ua" ? "Увімкнути помічника" : "Turn assistant on")
        }
      >
        <img
          src="/assistant/assistant-idle.png"
          alt=""
          aria-hidden="true"
        />
        <span
          className="assistant-toggle-status"
          title={
            aiStatus === "ok"
              ? (lang === "ua" ? "AI працює" : "AI online")
              : aiStatus === "limited"
                ? (lang === "ua" ? "AI тимчасово обмежений — працює локальний пошук" : "AI rate-limited — local search is active")
                : aiStatus === "offline"
                  ? (lang === "ua" ? "AI недоступний — працює локальний пошук" : "AI offline — local search is active")
                  : (lang === "ua" ? "Перевіряємо AI" : "Checking AI")
          }
          style={{
            backgroundColor:
              aiStatus === "ok" ? "#22c55e" :
              aiStatus === "limited" ? "#f59e0b" :
              aiStatus === "offline" ? "#ef4444" : "#94a3b8",
          }}
        />
      </button>
    </div>
  );
}
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import beautyAISparkles from "../../assets/beauty-ai-sparkles.svg";
import type { AuthRole, Lang, MockUser } from "../types";
import { cancelMyAppointment, fetchMyAppointments, fetchMyProfile, updateMyProfile } from "../../api/beautyApi";

type ClientFavorite = {
  title: string;
  type: string;
  image: string;
  rating: number;
  reviews: number;
  district: string;
  distance: string;
  priceFrom: string;
  variant?: "solo";
};

type ClientBooking = {
  id: string;
  title: string;
  type: string;
  image: string;
  service: string;
  date: string;
  time: string;
  phone: string;
  district: string;
  priceFrom: string;
  status: "confirmed" | "completed" | "cancelled";
  code: string;
  createdAt: string;
  reviewSubmitted?: boolean;
  reviewMasterRating?: number;
  reviewSalonRating?: number;
  reviewComment?: string;
  reviewSubmittedAt?: string;
  pointsAwarded?: boolean;
};

type ClientNotification = {
  id: string;
  title: string;
  text: string;
  createdAt: string;
  read: boolean;
};

type ClientState = {
  favorites: ClientFavorite[];
  bookings: ClientBooking[];
  notifications: ClientNotification[];
  points: number;
  registrationBonusAwarded: boolean;
  profileAvatar?: string;
};

type ReviewDraft = { master: number; salon: number; comment: string };
type BookingFilter = "upcoming" | "completed" | "cancelled";

type StoredMasterState = {
  profile?: {
    displayName?: string;
    avatar?: string;
  };
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

const CLIENT_STATE_PREFIX = "beautyai_client_state:";
const CLIENT_FAVORITES_PREFIX = "beautyai_client_favorites:";
const CLIENT_PROFILE_PREFIX = "beautyai_client_profile:";
const MASTER_STATE_PREFIX = "beautyai_master_state:";
const STORED_USER_KEY = "beautyai_session_user";
const emptyState = (): ClientState => ({ favorites: [], bookings: [], notifications: [], points: 0, registrationBonusAwarded: false });

function clientStateKey(email: string) {
  return `${CLIENT_STATE_PREFIX}${email.trim().toLowerCase()}`;
}

function readClientState(email: string): ClientState {
  try {
    const raw = localStorage.getItem(clientStateKey(email));
    return raw ? { ...emptyState(), ...JSON.parse(raw) } : emptyState();
  } catch {
    return emptyState();
  }
}

function writeClientState(email: string, next: ClientState) {
  localStorage.setItem(clientStateKey(email), JSON.stringify({ ...next, favorites: [] }));
  window.dispatchEvent(new CustomEvent("beautyai:client-state", {
    detail: { email: email.trim().toLowerCase(), state: next },
  }));
}

function makeInitialsAvatar(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = (parts.length > 1
    ? `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`
    : parts[0]?.[0] ?? "I"
  ).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="#EDE7F6"/><text x="80" y="80" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="54" font-weight="700" fill="#6F3CC3">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function clientFavoritesKey(email: string) {
  return `${CLIENT_FAVORITES_PREFIX}${email.trim().toLowerCase()}`;
}

function readAccountFavorites(email: string): ClientFavorite[] {
  try {
    const key = clientFavoritesKey(email);
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as ClientFavorite[];

  } catch {
    return [];
  }
  return [];
}

function writeAccountFavorites(email: string, favorites: ClientFavorite[]) {
  localStorage.setItem(clientFavoritesKey(email), JSON.stringify(favorites));
  window.dispatchEvent(new CustomEvent("beautyai:client-favorites", { detail: favorites }));
}

function clientProfileKey(email: string) {
  return `${CLIENT_PROFILE_PREFIX}${email.trim().toLowerCase()}`;
}

function readAccountProfile(email: string) {
  try {
    const raw = localStorage.getItem(clientProfileKey(email));
    return raw ? JSON.parse(raw) as { name?: string; phone?: string; email?: string; avatar?: string } : {};
  } catch {
    return {};
  }
}

function Stars({ value, onChange, label, readonly = false }: { value: number; onChange?: (value: number) => void; label: string; readonly?: boolean }) {
  return (
    <div className={`review-stars ${readonly ? "readonly" : ""}`} role={readonly ? "img" : "radiogroup"} aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => readonly ? (
        <span key={star} className={star <= value ? "active" : ""}>★</span>
      ) : (
        <button key={star} type="button" className={star <= value ? "active" : ""} onClick={() => onChange?.(star)} aria-label={`${star} / 5`} aria-checked={star === value} role="radio">★</button>
      ))}
    </div>
  );
}

function formatBookingDate(value: string, ua: boolean) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(ua ? "uk-UA" : "en-GB", { day: "numeric", month: "long", weekday: "short" }).format(date);
}

function formatBookingDateTime(date: string, time: string, ua: boolean) {
  return `${formatBookingDate(date, ua)} · ${time}`;
}
function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] ?? "", last_name: parts.slice(1).join(" ") };
}

function clientBookingStatus(value: string): ClientBooking["status"] {
  const status = value.trim().toLowerCase();
  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "no_show" || status === "no-show") return "cancelled";
  return "confirmed";
}
function formatNoticeTime(value: string, ua: boolean) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(ua ? "uk-UA" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

async function prepareAvatar(file: File): Promise<string> {
  const supported = ["image/jpeg", "image/png", "image/webp"];
  if (!supported.includes(file.type)) throw new Error("format");
  if (file.size > 5 * 1024 * 1024) throw new Error("size");

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = source;
  });

  const max = 640;
  const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

export default function ClientDashboard({
  user,
  lang,
  onHome,
  onLogout,
  onRoleChange: _onRoleChange,
}: {
  user: MockUser;
  lang: Lang;
  onHome: () => void;
  onLogout?: () => void;
  onRoleChange: (role: AuthRole) => void;
}) {
  const ua = lang === "ua";
  const initialClientState = readClientState(user.email);
  const [tab, setTab] = useState<"home" | "profile">("home");
  const [clientState, setClientState] = useState<ClientState>(() => ({ ...initialClientState, favorites: readAccountFavorites(user.email) }));
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const [notificationPosition, setNotificationPosition] = useState({ top: 0, right: 0 });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [allBookingsOpen, setAllBookingsOpen] = useState(false);
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("upcoming");
  const [showAllFavorites, setShowAllFavorites] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<ClientBooking | null>(null);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>({ master: 0, salon: 0, comment: "" });
  const [bonusHistoryOpen, setBonusHistoryOpen] = useState(false);
  const savedProfile = useMemo(() => readAccountProfile(user.email), [user.email]);
  const [profileName, setProfileName] = useState(savedProfile.name || user.name);
  const [profilePhone, setProfilePhone] = useState(savedProfile.phone || "+380 67 123 45 67");
  const [profileEmail, setProfileEmail] = useState(savedProfile.email || user.email);
  const [profileAvatar, setProfileAvatar] = useState(savedProfile.avatar || initialClientState.profileAvatar || makeInitialsAvatar(savedProfile.name || user.name));
  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [, setMasterProfileRevision] = useState(0);

  useEffect(() => {
    const sync = () => {
      const next = { ...readClientState(user.email), favorites: readAccountFavorites(user.email) };
      setClientState(next);
      const profile = readAccountProfile(user.email);
      setProfileAvatar(
        profile.avatar ||
        next.profileAvatar ||
        makeInitialsAvatar(profile.name || profileName || user.name)
      );
    };
    window.addEventListener("beautyai:client-state", sync as EventListener);
    window.addEventListener("beautyai:client-favorites", sync as EventListener);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("beautyai:client-state", sync as EventListener);
      window.removeEventListener("beautyai:client-favorites", sync as EventListener);
      window.removeEventListener("storage", sync);
    };
  }, [profileName, user.email, user.name]);

  useEffect(() => {
    const syncMasterProfiles = () => {
      setMasterProfileRevision((revision) => revision + 1);
    };

    window.addEventListener("beautyai:master-state", syncMasterProfiles as EventListener);
    window.addEventListener("storage", syncMasterProfiles);

    return () => {
      window.removeEventListener("beautyai:master-state", syncMasterProfiles as EventListener);
      window.removeEventListener("storage", syncMasterProfiles);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return;
    const updatePosition = () => {
      const rect = notificationButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setNotificationPosition({ top: rect.bottom + 10, right: Math.max(16, window.innerWidth - rect.right) });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [profileMenuOpen]);
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const apiProfile = await fetchMyProfile();
      if (cancelled) return;
      const fullName = `${apiProfile.first_name} ${apiProfile.last_name}`.trim();
      if (fullName) setProfileName(fullName);
      if (apiProfile.phone) setProfilePhone(apiProfile.phone);
      if (apiProfile.email) setProfileEmail(apiProfile.email);
      setProfileAvatar((currentAvatar) =>
        apiProfile.photo ||
        savedProfile.avatar ||
        initialClientState.profileAvatar ||
        currentAvatar ||
        makeInitialsAvatar(fullName || user.name)
      );
    } catch {
      // Бекенд недоступний — лишаємось на локальному кеші, як і решта застосунку.
    }
  })();
  return () => { cancelled = true; };
}, [user.email]);
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const apiBookings = await fetchMyAppointments();
        if (cancelled) return;

        const cachedById = new Map(
          readClientState(user.email).bookings.map((booking) => [booking.id, booking])
        );

        const bookings: ClientBooking[] = apiBookings.map((appointment) => {
          const id = String(appointment.id);
          const cached = cachedById.get(id);
          const masterName = appointment.master_name || (ua ? "Майстер" : "Master");
          const salonName = appointment.salon_name || "";
          const title = salonName || masterName;

          return {
            id,
            title,
            type: masterName,
            image:
              findStoredMasterState(masterName)?.profile?.avatar ||
              cached?.image ||
              user.avatar,
            service: appointment.service_name || "—",
            date: appointment.appointment_date,
            time: appointment.appointment_time,
            phone: cached?.phone || "",
            district: appointment.salon_address || cached?.district || "—",
            priceFrom: String(Number(appointment.service_price || 0)),
            status: clientBookingStatus(
              appointment.appointment_status || appointment.status
            ),
            code: cached?.code || String(appointment.id),
            createdAt: appointment.created_at,
            reviewSubmitted: cached?.reviewSubmitted,
            reviewMasterRating: cached?.reviewMasterRating,
            reviewSalonRating: cached?.reviewSalonRating,
            reviewComment: cached?.reviewComment,
            reviewSubmittedAt: cached?.reviewSubmittedAt,
            pointsAwarded: cached?.pointsAwarded,
          };
        });

        const current = {
          ...readClientState(user.email),
          favorites: readAccountFavorites(user.email),
        };
        const next = { ...current, bookings };

        writeClientState(user.email, next);
        setClientState(next);
      } catch {
        // If the API is temporarily unavailable, keep the cached bookings.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ua, user.avatar, user.email]);
  useEffect(() => {
    const completedWithoutPoints = clientState.bookings.filter((booking) => booking.status === "completed" && !booking.pointsAwarded);
    if (!completedWithoutPoints.length) return;
    const ids = new Set(completedWithoutPoints.map((booking) => booking.id));
    const notifications: ClientNotification[] = completedWithoutPoints.map((booking) => ({
      id: `points-${booking.id}`,
      title: "+50 Beauty AI балів",
      text: ua ? `За завершений запис у ${booking.title}` : `For completed booking at ${booking.title}`,
      createdAt: new Date().toISOString(),
      read: false,
    }));
    const next: ClientState = {
      ...clientState,
      points: clientState.points + completedWithoutPoints.length * 50,
      bookings: clientState.bookings.map((booking) => ids.has(booking.id) ? { ...booking, pointsAwarded: true } : booking),
      notifications: [...notifications, ...clientState.notifications],
    };
    writeClientState(user.email, next);
  }, [clientState, ua]);

  const formattedDateTime = useMemo(() => {
    const date = new Intl.DateTimeFormat(ua ? "uk-UA" : "en-GB", { day: "2-digit", month: "short" })
      .format(now)
      .replace(/\.$/, "")
      .toLocaleLowerCase(ua ? "uk-UA" : "en-GB");
    const time = new Intl.DateTimeFormat(ua ? "uk-UA" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(now);
    return `${date} · ${time}`;
  }, [now, ua]);
  const firstName = useMemo(() => profileName?.trim().split(/\s+/)[0] || (ua ? "Клієнт" : "Client"), [profileName, ua]);
  const unreadCount = clientState.notifications.filter((item) => !item.read).length;
  const completedBookings = clientState.bookings.filter((booking) => booking.status === "completed");
  const reviewBookings = completedBookings;
  const visibleReviewBookings = reviewBookingId
  ? reviewBookings.filter((booking) => booking.id === reviewBookingId)
  : reviewBookings.slice(0, 1);
  const upcomingBookings = clientState.bookings.filter((booking) => booking.status === "confirmed");
  const visibleBookings = upcomingBookings.slice(0, 1);
  const visibleFavorites = showAllFavorites ? clientState.favorites : clientState.favorites.slice(0, 4);
  const filteredBookings = clientState.bookings.filter((booking) => {
    if (bookingFilter === "completed") return booking.status === "completed";
    if (bookingFilter === "cancelled") return booking.status === "cancelled";
    return booking.status === "confirmed";
  });

  const commit = (updater: (state: ClientState) => ClientState) => {
    const current = { ...readClientState(user.email), favorites: readAccountFavorites(user.email) };
    const next = updater(current);
    writeAccountFavorites(user.email, next.favorites);
    writeClientState(user.email, next);
    setClientState(next);
    if (next.profileAvatar) setProfileAvatar(next.profileAvatar);
    return next;
  };

  const openNotifications = () => {
    setProfileMenuOpen(false);
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    if (nextOpen && unreadCount) {
      commit((state) => ({ ...state, notifications: state.notifications.map((item) => ({ ...item, read: true })) }));
    }
  };

  const removeFavorite = (title: string) => commit((state) => ({ ...state, favorites: state.favorites.filter((item) => item.title !== title) }));

  const cancelBooking = async (id: string) => {
    try {
      await cancelMyAppointment(id);
    } catch {
      return;
    }

    const next = commit((state) => {
      const booking = state.bookings.find((item) => item.id === id);
      if (!booking || booking.status !== "confirmed") return state;

      const notice: ClientNotification = {
        id: `cancel-${id}-${Date.now()}`,
        title: ua ? "Запис скасовано" : "Booking cancelled",
        text: `${booking.title} · ${formatBookingDate(booking.date, ua)} · ${booking.time}`,
        createdAt: new Date().toISOString(),
        read: false,
      };

      return {
        ...state,
        bookings: state.bookings.map((item) =>
          item.id === id ? { ...item, status: "cancelled" } : item
        ),
        notifications: [notice, ...state.notifications],
      };
    });

    const updated =
      next.bookings.find((booking) => booking.id === id) ?? null;
    setSelectedBooking(updated?.status === "cancelled" ? null : updated);
  };

  const completeBooking = (id: string) => {
    const next = commit((state) => {
      const booking = state.bookings.find((item) => item.id === id);
      if (!booking || booking.status !== "confirmed") return state;
      const notice: ClientNotification = {
        id: `completed-${id}-${Date.now()}`,
        title: ua ? "Візит завершено" : "Visit completed",
        text: ua ? `${booking.title} · тепер можна залишити відгук` : `${booking.title} · you can now leave a review`,
        createdAt: new Date().toISOString(),
        read: false,
      };
      return { ...state, bookings: state.bookings.map((item) => item.id === id ? { ...item, status: "completed" } : item), notifications: [notice, ...state.notifications] };
    });
    setSelectedBooking(next.bookings.find((booking) => booking.id === id) ?? null);
  };

  const submitReview = (booking: ClientBooking) => {
    if (booking.status !== "completed" || !reviewDraft.master || !reviewDraft.salon) return;
    const isEditing = Boolean(booking.reviewSubmitted);
    commit((state) => {
      const notice: ClientNotification = {
        id: `review-${booking.id}-${Date.now()}`,
        title: ua ? (isEditing ? "Відгук оновлено" : "Відгук опубліковано") : (isEditing ? "Review updated" : "Review published"),
        text: booking.title,
        createdAt: new Date().toISOString(),
        read: false,
      };
      return {
        ...state,
        bookings: state.bookings.map((item) => item.id === booking.id ? {
          ...item,
          reviewSubmitted: true,
          reviewMasterRating: reviewDraft.master,
          reviewSalonRating: reviewDraft.salon,
          reviewComment: reviewDraft.comment.trim(),
          reviewSubmittedAt: new Date().toISOString(),
        } : item),
        notifications: [notice, ...state.notifications],
      };
    });
    setReviewBookingId(null);
    setReviewDraft({ master: 0, salon: 0, comment: "" });
  };

  const startReview = (booking: ClientBooking) => {
    setReviewBookingId(booking.id);
    setReviewDraft({
      master: booking.reviewMasterRating ?? 0,
      salon: booking.reviewSalonRating ?? 0,
      comment: booking.reviewComment ?? "",
    });
  };

  const handleAvatarFile = async (file?: File) => {
    if (!file) return;
    setAvatarError("");
    try {
      setAvatarDraft(await prepareAvatar(file));
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setAvatarError(code === "size"
        ? (ua ? "Фото має бути до 5 МБ" : "Image must be up to 5 MB")
        : (ua ? "Оберіть JPG, PNG або WebP" : "Choose JPG, PNG or WebP"));
    }
  };

  const saveAvatar = () => {
    if (!avatarDraft) return;
    const previousAvatar = profileAvatar;

    // Keep only one current avatar: the new image replaces the previous value
    // in client state/localStorage instead of accumulating avatar versions.
    commit((state) => ({ ...state, profileAvatar: avatarDraft }));
    setProfileAvatar(avatarDraft);
    const currentProfile = readAccountProfile(user.email);
    localStorage.setItem(clientProfileKey(user.email), JSON.stringify({ ...currentProfile, avatar: avatarDraft }));
    window.dispatchEvent(new CustomEvent("beautyai:profile-avatar", { detail: avatarDraft }));

    // If a temporary object URL was ever used as the previous preview, release it.
    if (previousAvatar.startsWith("blob:")) URL.revokeObjectURL(previousAvatar);
    setAvatarDraft(null);
    setAvatarError("");
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const saveProfile = async () => {
    const nextProfile = {
      name: profileName.trim() || user.name,
      phone: profilePhone.trim(),
      email: profileEmail.trim() || user.email,
      avatar: profileAvatar,
    };
    localStorage.setItem(clientProfileKey(user.email), JSON.stringify(nextProfile));
    try {
      const raw = sessionStorage.getItem(STORED_USER_KEY);
      const stored = raw ? JSON.parse(raw) as MockUser : user;
      sessionStorage.setItem(STORED_USER_KEY, JSON.stringify({ ...stored, name: nextProfile.name, avatar: nextProfile.avatar }));
    } catch {
      // Profile data is already persisted in localStorage.
    }
    window.dispatchEvent(new CustomEvent("beautyai:auth-changed"));
    setProfileName(nextProfile.name);
    setProfileEmail(nextProfile.email);

    try {
      const { first_name, last_name } = splitName(nextProfile.name);
      await updateMyProfile({ first_name, last_name, phone: nextProfile.phone, email: nextProfile.email });
    } catch {
      // Бекенд не прийняв зміни — локально вже збережено, спробуємо синхронізувати іншим разом.
    }

    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 1600);
  };

  const openBookingLocation = (booking: ClientBooking) => {
    window.dispatchEvent(new CustomEvent("beautyai:open-location", {
      detail: { name: booking.title, district: booking.district, distance: "" },
    }));
  };

  const statusLabel = (status: ClientBooking["status"]) => {
    if (status === "completed") return ua ? "Завершено" : "Completed";
    if (status === "cancelled") return ua ? "Скасовано" : "Cancelled";
    return ua ? "Підтверджено" : "Confirmed";
  };

  const openReviewFromHistory = (booking: ClientBooking) => {
    setAllBookingsOpen(false);
     setShowAllReviews(false);
    setTab("home");
    startReview(booking);
    window.setTimeout(() => {
      document.getElementById("client-reviews")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const rebook = (booking: ClientBooking) => {
    setAllBookingsOpen(false);
    window.dispatchEvent(new CustomEvent("beautyai:rebook", { detail: booking }));
  };

  const bookingCard = (booking: ClientBooking, compact = false) => (
    <article className={`client-booking-card client-booking-card-compact status-${booking.status} ${compact ? "in-list-modal" : ""}`} key={booking.id}>
      <div className="client-booking-photo-wrap">
        <img className="client-booking-photo" src={booking.image} alt={booking.title} />
        <span className="client-booking-soon">{statusLabel(booking.status)}</span>
      </div>
      <div className="client-booking-info">
        <h3>{booking.service}</h3>
        <p className="client-booking-salon">{booking.title}</p>
        <p className="client-booking-master">{booking.type}</p>
        <div className="client-booking-meta">
          <span className="client-booking-datetime">{formatBookingDateTime(booking.date, booking.time, ua)}</span>
          <button type="button" className="card-location-link client-booking-location" onClick={() => openBookingLocation(booking)} title={ua ? "Відкрити на карті" : "Open on map"}><span className="district-pin"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>{booking.district}</button>
        </div>
        {compact && (
          <div className="client-booking-inline-details">
            <span><small>{ua ? "Ціна" : "Price"}</small><b>{booking.priceFrom} грн</b></span>
            <span><small>{ua ? "Код" : "Code"}</small><b>{booking.code}</b></span>
          </div>
        )}
      </div>
      {compact ? (
        <div className="client-booking-inline-actions">
          {booking.status === "confirmed" && (
            <>
              <button type="button" className="profile-delete-btn" onClick={() => { void cancelBooking(booking.id); }}>{ua ? "Скасувати" : "Cancel"}</button>
            </>
          )}
          {booking.status === "completed" && (
            <>
              <button type="button" className="client-history-action-btn review" onClick={() => openReviewFromHistory(booking)}>{booking.reviewSubmitted ? (ua ? "Відгук" : "Review") : (ua ? "Залишити відгук" : "Leave review")}</button>
              <button type="button" className="client-history-action-btn rebook" onClick={() => rebook(booking)}>{ua ? "Записатися знову" : "Book again"}</button>
            </>
          )}
          {booking.status === "cancelled" && <button type="button" className="client-history-action-btn rebook" onClick={() => rebook(booking)}>{ua ? "Записатися знову" : "Book again"}</button>}
        </div>
      ) : (
        <button className="client-details-btn" type="button" onClick={() => setSelectedBooking(booking)}>{ua ? "Деталі" : "Details"}</button>
      )}
    </article>
  );

  return (
    <main className="client-dashboard-shell">
      <aside className="client-sidebar">
        <button className="client-brand" type="button" onClick={onHome} aria-label="Beauty AI">
          <img src={beautyAISparkles} alt="" className="client-brand-logo" aria-hidden="true" />
          <span className="client-brand-wordmark"><span>Beauty</span> <strong>AI</strong></span>
        </button>
        <nav className="client-sidebar-nav" aria-label={ua ? "Навігація кабінету" : "Account navigation"}>
          <button type="button" className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}><span className="client-nav-icon">⌂</span>{ua ? "Головна" : "Home"}</button>
          <button type="button" className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><span className="client-nav-icon">♙</span>{ua ? "Профіль" : "Profile"}</button>
          <button type="button" className="client-sidebar-logout-top" onClick={onHome}><span className="client-nav-icon">↗</span>{ua ? "На сайт" : "To website"}</button>
        </nav>
        <div className="client-sidebar-bottom">
          <div className="client-loyalty-card">
            <div className="client-loyalty-copy">
              <b className="client-loyalty-title">
                <svg
                  className="client-loyalty-title-crown"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M4 8.5 8.2 12 12 5.5 15.8 12 20 8.5 18.4 17H5.6L4 8.5Z" />
                  <rect x="6" y="18.15" width="12" height="1.7" rx="0.85" />
                </svg>
                <span>
                  Beauty <em>AI</em> {ua ? "бали" : "points"}
                </span>
              </b>
              <div className="client-loyalty-balance"><span>{ua ? "Твій баланс" : "Your balance"}</span><strong>{clientState.points}</strong></div>
              <span>{ua ? "+100 за реєстрацію · +50 за завершений запис" : "+100 for registration · +50 for a completed booking"}</span>
            </div>
            <div className="client-loyalty-sparkles" aria-hidden="true">✦ ✦ ✦</div>
            <div className="client-loyalty-coin" aria-hidden="true"><span>✦</span></div>
            <button type="button" onClick={() => setBonusHistoryOpen((open) => !open)}>{ua ? "Історія балів" : "Points history"}</button>
            {bonusHistoryOpen && (
              <div className="client-points-popover">
                {clientState.registrationBonusAwarded && <div><b>+100</b><span>{ua ? "Перша реєстрація" : "First registration"}</span></div>}
                {clientState.bookings.filter((b) => b.pointsAwarded).map((b) => <div key={b.id}><b>+50</b><span>{ua ? `Завершений запис · ${b.title}` : `Completed booking · ${b.title}`}</span></div>)}
                {!clientState.registrationBonusAwarded && !clientState.bookings.some((b) => b.pointsAwarded) && <p>{ua ? "Нарахувань поки немає" : "No points history yet"}</p>}
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="client-dashboard-main">
        <header className="client-dashboard-header">
          <div className="client-welcome-copy"><h1>{ua ? `Вітаємо, ${firstName}! 👋` : `Welcome, ${firstName}! 👋`}</h1></div>
          <div className="client-header-actions">
            <div className="client-datetime-card"><span className="client-header-datetime">{formattedDateTime}</span></div>
            <div className="client-notification-wrap">
              <button ref={notificationButtonRef} className="client-notification-btn" type="button" onClick={openNotifications} aria-expanded={notificationsOpen} aria-label={ua ? "Сповіщення" : "Notifications"}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
                {unreadCount > 0 && <span className="client-notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
              </button>
            </div>
            <div className="client-profile-menu-wrap" ref={profileMenuRef}>
              <button className="client-profile-trigger" type="button" onClick={() => { setNotificationsOpen(false); setProfileMenuOpen((open) => !open); }} aria-haspopup="menu" aria-expanded={profileMenuOpen}>
                <img src={profileAvatar} alt={profileName} /><span>{firstName}</span><b>⌄</b>
              </button>
              {profileMenuOpen && (
                <div className="client-profile-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setTab("profile"); setProfileMenuOpen(false); }}>{ua ? "Профіль" : "Profile"}</button>
                  <button type="button" role="menuitem" className="logout" onClick={() => { setProfileMenuOpen(false); onLogout?.(); }}>{ua ? "Вийти з акаунту" : "Log out"}</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {tab === "home" ? (
          <div className="client-dashboard-content">
            <section className="client-section client-upcoming-section client-surface-panel">
              <div className="client-section-head">
                <h2>{ua ? "Мої записи" : "My bookings"}</h2>
                {clientState.bookings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setBookingFilter("upcoming");
                      setAllBookingsOpen(true);
                    }}
                  >
                    <span>{ua ? "Переглянути всі" : "View all"}</span>
                    <span className="client-section-link-arrow" aria-hidden="true">→</span>
                  </button>
                )}
              </div>

              <div className="client-bookings-list">
                {visibleBookings.length ? (
                  visibleBookings.map((booking) => bookingCard(booking))
                ) : (
                  <div className="client-empty-state">
                    <b>{ua ? "Немає майбутніх записів" : "No upcoming bookings"}</b>
                    <p>
                      {ua
                        ? "Знайдіть майстра на головній і забронюйте зручний час."
                        : "Find a specialist on the home page and book a time."}
                    </p>
                    <button type="button" className="cta-btn" onClick={onHome}>
                      {ua ? "Знайти майстра" : "Find a master"}
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section className="client-section client-liked-section client-surface-panel">
              <div className="client-section-head">
                <h2>{ua ? "Вам сподобалось" : "You liked"}</h2>
                {clientState.favorites.length > 4 && (
                  <button type="button" onClick={() => setShowAllFavorites((value) => !value)}>
                    <span>
                      {showAllFavorites
                        ? ua
                          ? "Згорнути"
                          : "Show less"
                        : ua
                          ? "Переглянути всі"
                          : "View all"}
                    </span>
                    {!showAllFavorites && (
                      <span className="client-section-link-arrow" aria-hidden="true">→</span>
                    )}
                  </button>
                )}
              </div>

              {visibleFavorites.length ? (
                <div className="client-liked-grid">
                  {visibleFavorites.map((item) => (
                    <article className="client-liked-card" key={item.title}>
                      <div className="client-liked-image-wrap">
                        <img src={item.image} alt={item.title} />
                        <button
                          className="client-heart-btn active"
                          type="button"
                          onClick={() => removeFavorite(item.title)}
                          aria-label={ua ? "Прибрати з обраного" : "Remove from favourites"}
                        >
                          ♥
                        </button>
                      </div>

                      <div className="client-liked-body">
                        <div className="client-liked-title-row">
                          <h3>{item.title}</h3>
                          <span className="client-liked-rating">
                            ★ {item.rating.toFixed(1)} <small>({item.reviews})</small>
                          </span>
                        </div>

                        <div className="client-liked-meta">
                          <span>⌖ {item.distance}</span>
                          <i>•</i>
                          <span>{item.district}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="client-empty-state compact">
                  <p>
                    {ua
                      ? "Натискайте ♡ на майстрах і салонах — вони з'являться тут."
                      : "Tap ♡ on masters and salons to save them here."}
                  </p>
                </div>
              )}
            </section>

            <section
              id="client-reviews"
              className="client-section client-reviews-section client-surface-panel client-dashboard-reviews-panel client-my-reviews-v2"
            >
              <div className="client-section-head client-reviews-head-v2">
                <div>
                  <h2>{ua ? "Мої відгуки" : "My reviews"}</h2>
                </div>

                <button
                  type="button"
                  className="client-reviews-view-all"
                  onClick={() => setShowAllReviews(true)}
                >
                  <span>{ua ? "Переглянути всі" : "View all"}</span>
                  <span className="client-section-link-arrow" aria-hidden="true">→</span>
                </button>
              </div>

              {reviewBookings.length ? (
                <div className="client-my-reviews-list-v2">
                  {visibleReviewBookings.map((booking) => (
                    <article className="client-review-card client-review-card-v2" key={booking.id}>
                      <div className="client-review-visit-v2 client-review-header-v4">
                        <div className="client-review-author-v4">
                          <img src={profileAvatar} alt={profileName} />
                        </div>

                        <div className="client-review-master-v4">
                          <img
                            src={findStoredMasterState(booking.title)?.profile?.avatar || booking.image}
                            alt={findStoredMasterState(booking.title)?.profile?.displayName || booking.title}
                            onError={(event) => {
                              const img = event.currentTarget;
                              if (img.src !== booking.image) img.src = booking.image; // fallback 1: фото з бронювання
                            }}
                          />
                          <div className="client-review-master-copy-v4">
                            <strong>
                              {findStoredMasterState(booking.title)?.profile?.displayName || booking.title}
                            </strong>
                            <span>{ua ? "Майстер" : "Master"}</span>
                          </div>
                        </div>

                        <div className="client-review-detail-v4">
                          <strong>{ua ? "Послуга" : "Service"}</strong>
                          <span>{booking.service.replace(/^Майстер\s+/i, "")}</span>
                        </div>

                        <div className="client-review-detail-v4 client-review-date-v4">
                          <strong>{ua ? "Дата візиту" : "Visit date"}</strong>
                          <span>{formatBookingDateTime(booking.date, booking.time, ua)}</span>
                        </div>

                        {reviewBookingId === booking.id ? (
                          <button
                            type="button"
                            className="client-review-card-close client-review-action-v4"
                            onClick={() => setReviewBookingId(null)}
                            aria-label={ua ? "Закрити форму відгуку" : "Close review form"}
                          >
                            ×
                          </button>
                        ) : booking.reviewSubmitted ? (
                          <button
                            type="button"
                            className="client-review-pencil-btn client-review-action-v4"
                            onClick={() => startReview(booking)}
                            aria-label={ua ? "Редагувати відгук" : "Edit review"}
                          >
                            ✎ <span>{ua ? "Редагувати" : "Edit"}</span>
                          </button>
                        ) : (
                          <span className="status-pill neutral client-review-action-v4">
                            {ua ? "Очікує відгуку" : "Review available"}
                          </span>
                        )}
                      </div>

                      {!booking.reviewSubmitted && reviewBookingId !== booking.id && (
                        <div className="client-review-empty-v2">
                          <div>
                            <b>{ua ? "Візит завершено" : "Visit completed"}</b>
                            <p>
                              {ua
                                ? "Поділіться враженням про майстра та сервіс."
                                : "Share your experience with the master and service."}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="client-review-edit-btn"
                            onClick={() => startReview(booking)}
                          >
                            {ua ? "Залишити відгук" : "Leave a review"}
                          </button>
                        </div>
                      )}

                      {booking.reviewSubmitted && reviewBookingId !== booking.id && (
                        <div className="client-review-saved client-review-saved-v2">
                          <div className="client-review-saved-copy">
                            {booking.reviewComment ? (
                              <p>{booking.reviewComment}</p>
                            ) : (
                              <p className="client-review-no-comment-v2">
                                {ua ? "Без текстового коментаря" : "No written comment"}
                              </p>
                            )}
                          </div>

                          <aside
                            className="client-review-saved-ratings"
                            aria-label={ua ? "Оцінки відгуку" : "Review ratings"}
                          >
                            <div>
                              <span>{ua ? "Майстер" : "Master"}</span>
                              <Stars
                                value={booking.reviewMasterRating ?? 0}
                                label={ua ? "Оцінка майстра" : "Master rating"}
                                readonly
                              />
                            </div>
                            <div>
                              <span>{ua ? "Сервіс" : "Service"}</span>
                              <Stars
                                value={booking.reviewSalonRating ?? 0}
                                label={ua ? "Оцінка сервісу" : "Service rating"}
                                readonly
                              />
                            </div>
                          </aside>
                        </div>
                      )}

                      {reviewBookingId === booking.id && (
                        <div className="client-review-form review-form-card">
                          <div className="review-rating-grid">
                            <div className="review-rating-block">
                              <span>{ua ? "Майстер" : "Master"}</span>
                              <Stars
                                value={reviewDraft.master}
                                onChange={(master) =>
                                  setReviewDraft((draft) => ({ ...draft, master }))
                                }
                                label={ua ? "Рейтинг майстра" : "Master rating"}
                              />
                            </div>

                            <div className="review-rating-block">
                              <span>{ua ? "Салон / сервіс" : "Salon / service"}</span>
                              <Stars
                                value={reviewDraft.salon}
                                onChange={(salon) =>
                                  setReviewDraft((draft) => ({ ...draft, salon }))
                                }
                                label={ua ? "Рейтинг сервісу" : "Service rating"}
                              />
                            </div>
                          </div>

                          <label className="review-comment">
                            <span>{ua ? "Коментар" : "Comment"}</span>
                            <textarea
                              rows={3}
                              value={reviewDraft.comment}
                              onChange={(event) =>
                                setReviewDraft((draft) => ({
                                  ...draft,
                                  comment: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <div className="review-submit-row client-review-submit-row-v2">
                            <button
                              type="button"
                              className="review-submit-btn"
                              disabled={!reviewDraft.master || !reviewDraft.salon}
                              onClick={() => submitReview(booking)}
                            >
                              {booking.reviewSubmitted
                                ? ua
                                  ? "Зберегти зміни"
                                  : "Save changes"
                                : ua
                                  ? "Надіслати відгук"
                                  : "Submit review"}
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="client-empty-state compact">
                  <p>
                    {ua
                      ? "Відгук можна залишити після завершеного бронювання."
                      : "Reviews become available after a completed booking."}
                  </p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="client-profile-card client-surface-panel">
            <div className="client-section-head client-profile-head"><div><h2>{ua ? "Профіль" : "Profile"}</h2><p>{ua ? "Особисті дані та налаштування акаунта" : "Personal details and account settings"}</p></div></div>
            <div className="profile-photo-row">
              <div className="dashboard-avatar profile-avatar"><img src={avatarDraft || profileAvatar} alt={profileName} /></div>
              <div className="client-avatar-actions">
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { void handleAvatarFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                <button type="button" className="booking-action-btn ghost" onClick={() => avatarInputRef.current?.click()}>{ua ? "Змінити фото" : "Change photo"}</button>
                {avatarDraft && <><button type="button" className="booking-action-btn" onClick={saveAvatar}>{ua ? "Зберегти" : "Save"}</button><button type="button" className="booking-action-btn ghost" onClick={() => { setAvatarDraft(null); setAvatarError(""); }}>{ua ? "Скасувати" : "Cancel"}</button></>}
                {avatarError && <span className="client-avatar-error">{avatarError}</span>}
              </div>
            </div>
            <div className="profile-fields-grid"><label><span>{ua ? "Ім'я" : "Name"}</span><input type="text" value={profileName} onChange={(event) => setProfileName(event.target.value)} /></label><label><span>{ua ? "Телефон" : "Phone"}</span><input type="tel" value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} /></label><label><span>Email</span><input type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} /></label></div>
            <button type="button" className="cta-btn profile-save-btn" onClick={saveProfile}>{profileSaved ? (ua ? "Збережено ✓" : "Saved ✓") : (ua ? "Зберегти зміни" : "Save changes")}</button>
            <div className="profile-subsection"><h3>{ua ? "Сповіщення" : "Notifications"}</h3><label className="profile-toggle-row"><span>{ua ? "Email-сповіщення" : "Email notifications"}</span><input type="checkbox" checked={notifyEmail} onChange={(event) => setNotifyEmail(event.target.checked)} /></label><label className="profile-toggle-row"><span>{ua ? "Push-сповіщення" : "Push notifications"}</span><input type="checkbox" checked={notifyPush} onChange={(event) => setNotifyPush(event.target.checked)} /></label></div>
            <div className="profile-subsection profile-danger-zone"><h3>{ua ? "Акаунт" : "Account"}</h3><button type="button" className="profile-delete-btn">{ua ? "Видалити акаунт" : "Delete account"}</button></div>
          </section>
        )}
      </div>

      {notificationsOpen && createPortal(
        <>
          <button className="client-notification-dismiss" type="button" aria-label={ua ? "Закрити сповіщення" : "Close notifications"} onClick={() => setNotificationsOpen(false)} />
          <div className="client-notification-menu client-notification-menu-portal" style={{ top: notificationPosition.top, right: notificationPosition.right }}>
            <div className="client-notification-head"><b>{ua ? "Сповіщення" : "Notifications"}</b><span>{clientState.notifications.length}</span></div>
            <div className="client-notification-list">
              {clientState.notifications.length ? clientState.notifications.map((item) => (
                <article key={item.id}><div><strong>{item.title}</strong><p>{item.text}</p></div><time>{formatNoticeTime(item.createdAt, ua)}</time></article>
              )) : <p className="client-empty-copy">{ua ? "Нових сповіщень поки немає" : "No notifications yet"}</p>}
            </div>
          </div>
        </>,
        document.body,
      )}

      {showAllReviews && createPortal(
        <div
          className="client-booking-modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowAllReviews(false)}
        >
          <div
            className="client-all-reviews-modal"
            role="dialog"
            aria-modal="true"
            aria-label={ua ? "Усі відгуки" : "All reviews"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="client-booking-modal-close"
              onClick={() => setShowAllReviews(false)}
              aria-label={ua ? "Закрити" : "Close"}
            >
              ×
            </button>

            <div className="client-all-reviews-head">
              <span>{ua ? "Історія відгуків" : "Review history"}</span>
              <h2>{ua ? "Усі відгуки" : "All reviews"}</h2>
            </div>

            <div className="client-all-reviews-list">
              {reviewBookings.length ? (
                reviewBookings.map((booking) => (
                    <article className="client-review-card client-review-card-v2" key={booking.id}>
                      <div className="client-review-visit-v2 client-review-header-v4">
                        <div className="client-review-author-v4">
                          <img src={profileAvatar} alt={profileName} />
                        </div>

                        <div className="client-review-master-v4">
                          <img
                            src={findStoredMasterState(booking.title)?.profile?.avatar || booking.image}
                            alt={findStoredMasterState(booking.title)?.profile?.displayName || booking.title}
                          />
                          <div className="client-review-master-copy-v4">
                            <strong>
                              {findStoredMasterState(booking.title)?.profile?.displayName || booking.title}
                            </strong>
                            <span>{ua ? "Майстер" : "Master"}</span>
                          </div>
                        </div>

                        <div className="client-review-detail-v4">
                          <strong>{ua ? "Послуга" : "Service"}</strong>
                          <span>{booking.service.replace(/^Майстер\s+/i, "")}</span>
                        </div>

                        <div className="client-review-detail-v4 client-review-date-v4">
                          <strong>{ua ? "Дата візиту" : "Visit date"}</strong>
                          <span>{formatBookingDateTime(booking.date, booking.time, ua)}</span>
                        </div>

                        {reviewBookingId === booking.id ? (
                          <button
                            type="button"
                            className="client-review-card-close client-review-action-v4"
                            onClick={() => setReviewBookingId(null)}
                            aria-label={ua ? "Закрити форму відгуку" : "Close review form"}
                          >
                            ×
                          </button>
                        ) : booking.reviewSubmitted ? (
                          <button
                            type="button"
                            className="client-review-pencil-btn client-review-action-v4"
                            onClick={() => openReviewFromHistory(booking)}
                            aria-label={ua ? "Редагувати відгук" : "Edit review"}
                          >
                            ✎ <span>{ua ? "Редагувати" : "Edit"}</span>
                          </button>
                        ) : (
                          <span className="status-pill neutral client-review-action-v4">
                            {ua ? "Очікує відгуку" : "Review available"}
                          </span>
                        )}
                      </div>

                      {!booking.reviewSubmitted && reviewBookingId !== booking.id && (
                        <div className="client-review-empty-v2">
                          <div>
                            <b>{ua ? "Візит завершено" : "Visit completed"}</b>
                            <p>
                              {ua
                                ? "Поділіться враженням про майстра та сервіс."
                                : "Share your experience with the master and service."}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="client-review-edit-btn"
                            onClick={() => startReview(booking)}
                          >
                            {ua ? "Залишити відгук" : "Leave a review"}
                          </button>
                        </div>
                      )}

                      {booking.reviewSubmitted && reviewBookingId !== booking.id && (
                        <div className="client-review-saved client-review-saved-v2">
                          <div className="client-review-saved-copy">
                            {booking.reviewComment ? (
                              <p>{booking.reviewComment}</p>
                            ) : (
                              <p className="client-review-no-comment-v2">
                                {ua ? "Без текстового коментаря" : "No written comment"}
                              </p>
                            )}
                          </div>

                          <aside
                            className="client-review-saved-ratings"
                            aria-label={ua ? "Оцінки відгуку" : "Review ratings"}
                          >
                            <div>
                              <span>{ua ? "Майстер" : "Master"}</span>
                              <Stars
                                value={booking.reviewMasterRating ?? 0}
                                label={ua ? "Оцінка майстра" : "Master rating"}
                                readonly
                              />
                            </div>
                            <div>
                              <span>{ua ? "Сервіс" : "Service"}</span>
                              <Stars
                                value={booking.reviewSalonRating ?? 0}
                                label={ua ? "Оцінка сервісу" : "Service rating"}
                                readonly
                              />
                            </div>
                          </aside>
                        </div>
                      )}

                      {reviewBookingId === booking.id && (
                        <div className="client-review-form review-form-card">
                          <div className="review-rating-grid">
                            <div className="review-rating-block">
                              <span>{ua ? "Майстер" : "Master"}</span>
                              <Stars
                                value={reviewDraft.master}
                                onChange={(master) =>
                                  setReviewDraft((draft) => ({ ...draft, master }))
                                }
                                label={ua ? "Рейтинг майстра" : "Master rating"}
                              />
                            </div>

                            <div className="review-rating-block">
                              <span>{ua ? "Салон / сервіс" : "Salon / service"}</span>
                              <Stars
                                value={reviewDraft.salon}
                                onChange={(salon) =>
                                  setReviewDraft((draft) => ({ ...draft, salon }))
                                }
                                label={ua ? "Рейтинг сервісу" : "Service rating"}
                              />
                            </div>
                          </div>

                          <label className="review-comment">
                            <span>{ua ? "Коментар" : "Comment"}</span>
                            <textarea
                              rows={3}
                              value={reviewDraft.comment}
                              onChange={(event) =>
                                setReviewDraft((draft) => ({
                                  ...draft,
                                  comment: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <div className="review-submit-row client-review-submit-row-v2">
                            <button
                              type="button"
                              className="review-submit-btn"
                              disabled={!reviewDraft.master || !reviewDraft.salon}
                              onClick={() => submitReview(booking)}
                            >
                              {booking.reviewSubmitted
                                ? ua
                                  ? "Зберегти зміни"
                                  : "Save changes"
                                : ua
                                  ? "Надіслати відгук"
                                  : "Submit review"}
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                ))
              ) : (
                <div className="client-review-empty-v2">
                  <div>
                    <b>{ua ? "Відгуків ще немає" : "No reviews yet"}</b>
                    <p>
                      {ua
                        ? "Після завершених візитів ваші відгуки з’являться тут."
                        : "Your reviews will appear here after completed visits."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {allBookingsOpen && createPortal(
        <div className="client-booking-modal-backdrop" role="presentation" onMouseDown={() => setAllBookingsOpen(false)}>
          <div className="client-all-bookings-modal" role="dialog" aria-modal="true" aria-label={ua ? "Усі записи" : "All bookings"} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="client-booking-modal-close" onClick={() => setAllBookingsOpen(false)}>×</button>
            <div className="client-all-bookings-head"><div><span>{ua ? "Історія" : "History"}</span><h2>{ua ? "Мої записи" : "My bookings"}</h2></div></div>
            <div className="client-booking-tabs" role="tablist">
              <button className={`tab-upcoming ${bookingFilter === "upcoming" ? "active" : ""}`} type="button" onClick={() => setBookingFilter("upcoming")}>{ua ? "Майбутні" : "Upcoming"} <span>{upcomingBookings.length}</span></button>
              <button className={`tab-completed ${bookingFilter === "completed" ? "active" : ""}`} type="button" onClick={() => setBookingFilter("completed")}>{ua ? "Завершені" : "Completed"} <span>{completedBookings.length}</span></button>
              <button className={`tab-cancelled ${bookingFilter === "cancelled" ? "active" : ""}`} type="button" onClick={() => setBookingFilter("cancelled")}>{ua ? "Скасовані" : "Cancelled"} <span>{clientState.bookings.filter((booking) => booking.status === "cancelled").length}</span></button>
            </div>
            <div className="client-all-bookings-list">
              {filteredBookings.length ? filteredBookings.map((booking) => bookingCard(booking, true)) : <div className="client-empty-state compact"><p>{ua ? "У цій категорії записів поки немає." : "There are no bookings in this category yet."}</p></div>}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {selectedBooking && (
        <div className="client-booking-modal-backdrop" role="presentation" onMouseDown={() => setSelectedBooking(null)}>
          <div className="client-booking-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="client-booking-modal-close" onClick={() => setSelectedBooking(null)}>×</button>
            <div className="client-booking-detail-photo-wrap"><img src={selectedBooking.image} alt={selectedBooking.title} /><span className={`client-booking-detail-status status-${selectedBooking.status}`}>{statusLabel(selectedBooking.status)}</span></div>
            <h3>{selectedBooking.service}</h3><p>{selectedBooking.title} · {selectedBooking.type}</p>
            <div className="client-booking-detail-grid"><div className="date-time"><span>{ua ? "Дата і час" : "Date & time"}</span><b>{formatBookingDate(selectedBooking.date, ua)} · {selectedBooking.time}</b></div><div><span>{ua ? "Локація" : "Location"}</span><button type="button" className="card-location-link client-booking-location client-booking-detail-location" onClick={() => openBookingLocation(selectedBooking)}><span className="district-pin"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>{selectedBooking.district}</button></div><div><span>{ua ? "Код" : "Code"}</span><b>{selectedBooking.code}</b></div></div>
            <div className="client-booking-modal-actions">
              {selectedBooking.status === "confirmed" && <>
                <button type="button" className="profile-delete-btn" onClick={() => cancelBooking(selectedBooking.id)}>{ua ? "Скасувати запис" : "Cancel booking"}</button>
                <button type="button" className="booking-action-btn ghost" onClick={() => completeBooking(selectedBooking.id)}>{ua ? "Позначити як завершене" : "Mark completed"}</button>
              </>}
              {selectedBooking.status === "completed" && <><button type="button" className="booking-action-btn ghost" onClick={() => { setSelectedBooking(null); openReviewFromHistory(selectedBooking); }}>{selectedBooking.reviewSubmitted ? (ua ? "Переглянути відгук" : "View review") : (ua ? "Залишити відгук" : "Leave a review")}</button><button type="button" className="cta-btn" onClick={() => { setSelectedBooking(null); rebook(selectedBooking); }}>{ua ? "Записатися знову" : "Book again"}</button></>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

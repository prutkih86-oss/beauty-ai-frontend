import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMasterActiveAppointments,
  fetchMasterHistoryAppointments,
  updateAppointmentStatus,
  fetchWorkingSchedule,
  saveWorkingScheduleDay,
  fetchDayOffs,
  createDayOff,
  deleteDayOff,
  fetchMasterReviews,
  fetchMasterProfile,
  updateMasterProfile,
  type MasterAppointmentApi,
  type WorkingScheduleDayApi,
  type DayOffApi,
  type MasterReviewApi,
} from "../../api/beautyApi";
import DashboardFrame, { type MasterSection, type MasterHeaderNotification } from "../DashboardFrame";
import type { AuthRole, Lang, MockUser } from "../types";

type BookingStatus = "confirmed" | "completed" | "cancelled";
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
  status: BookingStatus;
  code: string;
  createdAt: string;
  reviewSubmitted?: boolean;
  reviewMasterRating?: number;
  reviewSalonRating?: number;
  reviewComment?: string;
  reviewSubmittedAt?: string;
  pointsAwarded?: boolean;
};

type ClientNotification = { id: string; title: string; text: string; createdAt: string; read: boolean };
type ClientState = {
  favorites: unknown[];
  bookings: ClientBooking[];
  notifications: ClientNotification[];
  points: number;
  registrationBonusAwarded: boolean;
  profileAvatar?: string;
};

type MasterService = { id: string; name: string; price: number; duration: number; active: boolean };
type MasterProfile = {
  displayName: string;
  specialization: string;
  city: string;
  salon: string;
  about: string;
  phone: string;
  email: string;
  avatar: string;
};
type MasterNotification = MasterHeaderNotification;
type MasterPayout = { id: string; amount: number; createdAt: string; status: "requested" };
type MasterState = {
  profile: MasterProfile;
  services: MasterService[];
  portfolioImages: string[];
  notifications: MasterNotification[];
  payouts: MasterPayout[];
};

type ServiceDraft = { id?: string; name: string; price: string; duration: string; active: boolean };

const CLIENT_STATE_KEY = "beautyai_client_state";
const MASTER_STATE_PREFIX = "beautyai_master_state:";
const MASTER_REGISTRY_EVENT = "beautyai:master-state";

const clientEmpty = (): ClientState => ({ favorites: [], bookings: [], notifications: [], points: 0, registrationBonusAwarded: false });

function readClientState(): ClientState {
  try {
    const raw = localStorage.getItem(CLIENT_STATE_KEY);
    return raw ? { ...clientEmpty(), ...JSON.parse(raw) } : clientEmpty();
  } catch {
    return clientEmpty();
  }
}

function writeClientState(next: ClientState) {
  localStorage.setItem(CLIENT_STATE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("beautyai:client-state", { detail: next }));
}

function stateKey(email: string) {
  return `${MASTER_STATE_PREFIX}${email.trim().toLowerCase()}`;
}

function emptyMasterState(user: MockUser): MasterState {
  return {
    profile: {
      displayName: user.name,
      specialization: "",
      city: "",
      salon: "",
      about: "",
      phone: "",
      email: user.email,
      avatar: user.avatar,
    },
    services: [],
    portfolioImages: [],
    notifications: [],
    payouts: [],
  };
}

function readMasterState(user: MockUser): MasterState {
  try {
    const raw = localStorage.getItem(stateKey(user.email));
    if (!raw) return emptyMasterState(user);
    const parsed = JSON.parse(raw) as Partial<MasterState>;
    const base = emptyMasterState(user);
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...(parsed.profile ?? {}) },
      services: Array.isArray(parsed.services) ? parsed.services : [],
      portfolioImages: Array.isArray(parsed.portfolioImages) ? parsed.portfolioImages : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      payouts: Array.isArray(parsed.payouts) ? parsed.payouts : [],
    };
  } catch {
    return emptyMasterState(user);
  }
}

function writeMasterState(user: MockUser, next: MasterState) {
  localStorage.setItem(stateKey(user.email), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(MASTER_REGISTRY_EVENT, { detail: { email: user.email, state: next } }));
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isPastDateValue(value: string) {
  return value < toInputDate(new Date());
}

function parsePrice(value: string | number) {
  return Number(String(value).replace(/[^0-9]/g, "")) || 0;
}

function formatMoney(value: number, ua: boolean) {
  return `${value.toLocaleString(ua ? "uk-UA" : "en-GB")} ₴`;
}

function formatDate(value: string, ua: boolean, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(ua ? "uk-UA" : "en-GB", options ?? { day: "numeric", month: "long" }).format(date);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function mapApiAppointmentToBooking(appt: MasterAppointmentApi): ClientBooking {
  const start = new Date(appt.start);
  const valid = !Number.isNaN(start.getTime());
  const status: BookingStatus =
    appt.status === "completed" ? "completed" : appt.status === "cancelled" ? "cancelled" : "confirmed";

  return {
    id: String(appt.id),
    title: appt.salon_name || "",
    type: "salon",
    image: "",
    service: appt.service_name,
    date: valid ? toInputDate(start) : "",
    time: valid ? `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}` : "",
    phone: appt.client_name,
    district: appt.salon_name || "",
    priceFrom: appt.total_price,
    status,
    code: String(appt.id),
    createdAt: appt.created_at,
  };
}

const WEEKDAYS: { value: number; short: { ua: string; en: string } }[] = [
  { value: 1, short: { ua: "Пн", en: "Mon" } },
  { value: 2, short: { ua: "Вт", en: "Tue" } },
  { value: 3, short: { ua: "Ср", en: "Wed" } },
  { value: 4, short: { ua: "Чт", en: "Thu" } },
  { value: 5, short: { ua: "Пт", en: "Fri" } },
  { value: 6, short: { ua: "Сб", en: "Sat" } },
  { value: 7, short: { ua: "Нд", en: "Sun" } },
];

function defaultWorkingSchedule(): WorkingScheduleDayApi[] {
  return WEEKDAYS.map(({ value }) => ({
    weekday: value,
    opening_time: value <= 5 ? "09:00" : null,
    closing_time: value <= 5 ? "18:00" : null,
    is_closed: value > 5,
  }));
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] ?? "", last_name: parts.slice(1).join(" ") };
}

export default function MasterDashboard({
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
  const today = useMemo(() => new Date(), []);
  const todayValue = toInputDate(today);
  const [section, setSection] = useState<MasterSection>("home");
  const [masterState, setMasterState] = useState<MasterState>(() => readMasterState(user));
  const [clientState, setClientState] = useState<ClientState>(() => readClientState());
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [workingSchedule, setWorkingSchedule] = useState<WorkingScheduleDayApi[]>(() => defaultWorkingSchedule());
  const [dayOffs, setDayOffs] = useState<DayOffApi[]>([]);
  const [scheduleSaving, setScheduleSaving] = useState<number | null>(null);
  const [dayOffModalOpen, setDayOffModalOpen] = useState(false);
  const [dayOffStart, setDayOffStart] = useState(todayValue);
  const [dayOffEnd, setDayOffEnd] = useState(todayValue);
  const [dayOffReason, setDayOffReason] = useState("");
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>({ name: "", price: "", duration: "60", active: true });
  const [allReviewsOpen, setAllReviewsOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<ClientBooking | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    writeMasterState(user, masterState);
  }, [masterState, user]);

  useEffect(() => {
    const sync = () => setClientState(readClientState());
    window.addEventListener("beautyai:client-state", sync as EventListener);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("beautyai:client-state", sync as EventListener);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const [apiBookings, setApiBookings] = useState<ClientBooking[]>([]);

  const loadBookings = React.useCallback(async () => {
    try {
      const [active, history] = await Promise.all([
        fetchMasterActiveAppointments(),
        fetchMasterHistoryAppointments(),
      ]);
      setApiBookings([...active, ...history].map(mapApiAppointmentToBooking));
    } catch {
      // Бекенд недоступний — лишаємось з тим, що вже було завантажено раніше.
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const loadSchedule = React.useCallback(async () => {
    try {
      const [schedule, offs] = await Promise.all([fetchWorkingSchedule(), fetchDayOffs()]);
      if (schedule.length) {
        setWorkingSchedule(
          WEEKDAYS.map(({ value }) =>
            schedule.find((day) => day.weekday === value) ?? { weekday: value, opening_time: null, closing_time: null, is_closed: true }
          )
        );
      }
      setDayOffs(offs);
    } catch {
      // Бекенд недоступний — лишаємось з дефолтним/попереднім графіком.
    }
  }, []);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const [apiReviews, setApiReviews] = useState<MasterReviewApi[]>([]);

  const loadReviews = React.useCallback(async () => {
    try {
      setApiReviews(await fetchMasterReviews());
    } catch {
      // Бекенд недоступний — лишаємось з тим, що вже було завантажено раніше.
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiProfile = await fetchMasterProfile();
        if (cancelled) return;
        const fullName = `${apiProfile.first_name} ${apiProfile.last_name}`.trim();
        updateMasterState((current) => ({
          ...current,
          profile: {
            ...current.profile,
            displayName: fullName || current.profile.displayName,
            email: apiProfile.email || current.profile.email,
            phone: apiProfile.phone || current.profile.phone,
            about: apiProfile.bio || current.profile.about,
            avatar: apiProfile.photo || current.profile.avatar,
          },
        }));
      } catch {
        // Бекенд недоступний — лишаємось з тим, що вже було в локальному кеші.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const knownIds = new Set(masterState.notifications.filter((item) => item.kind === "booking").map((item) => item.entityId));
    const newBookings = apiBookings.filter((booking) => !knownIds.has(booking.id));
    if (!newBookings.length) return;
    const notices: MasterNotification[] = newBookings.map((booking) => ({
      id: `master-booking-${booking.id}`,
      title: ua ? "Новий запис" : "New booking",
      text: `${booking.service} · ${formatDate(booking.date, ua)} · ${booking.time}`,
      createdAt: booking.createdAt,
      read: false,
      kind: "booking",
      entityId: booking.id,
    }));
    setMasterState((current) => ({ ...current, notifications: [...notices, ...current.notifications] }));
  }, [apiBookings, masterState.notifications, ua]);

  const bookings = apiBookings;

  const selectedBookings = useMemo(
    () => bookings.filter((booking) => booking.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time)),
    [bookings, selectedDate]
  );

  const todayBookings = useMemo(() => bookings.filter((booking) => booking.date === todayValue), [bookings, todayValue]);
  const monthBookings = useMemo(
    () => bookings.filter((booking) => {
      const d = new Date(`${booking.date}T12:00:00`);
      return d.getFullYear() === calendarMonth.getFullYear() && d.getMonth() === calendarMonth.getMonth();
    }),
    [bookings, calendarMonth]
  );

  const reviews = useMemo(
    () => [...apiReviews].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [apiReviews]
  );

  const rating = useMemo(() => {
    const values = reviews.map((review) => review.rating).filter(Boolean);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }, [reviews]);

  const completedBookings = bookings.filter((booking) => booking.status === "completed");
  const completedRevenue = completedBookings.reduce((sum, booking) => sum + parsePrice(booking.priceFrom), 0);
  const requestedPayoutTotal = masterState.payouts.reduce((sum, payout) => sum + payout.amount, 0);
  const availablePayout = Math.max(0, completedRevenue - requestedPayoutTotal);
  const cancelledBookings = bookings.filter((booking) => booking.status === "cancelled").length;
  const uniqueClients = new Set(bookings.filter((booking) => {
    const d = new Date(`${booking.date}T12:00:00`);
    return d.getFullYear() === calendarMonth.getFullYear() && d.getMonth() === calendarMonth.getMonth();
  }).map((booking) => booking.phone)).size;
  const isDateOff = React.useCallback(
    (value: string) => dayOffs.some((off) => value >= off.start_date && value <= off.end_date),
    [dayOffs]
  );

  const workingDaysInMonth = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const isoWeekday = ((date.getDay() + 6) % 7) + 1; // 1=Пн ... 7=Нд
      const scheduleDay = workingSchedule.find((item) => item.weekday === isoWeekday);
      if (scheduleDay?.is_closed) continue;
      if (isDateOff(toInputDate(date))) continue;
      count += 1;
    }
    return count;
  }, [calendarMonth, workingSchedule, isDateOff]);

  const bookedDaysInMonth = useMemo(() => new Set(monthBookings.map((booking) => booking.date)).size, [monthBookings]);
  const occupancy = workingDaysInMonth ? Math.round((bookedDaysInMonth / workingDaysInMonth) * 100) : 0;

  const portfolioCountLabel = `${masterState.portfolioImages.length} ${masterState.portfolioImages.length === 1 ? (ua ? "робота" : "work") : (ua ? "робіт" : "works")}`;

  const updateMasterState = (updater: (current: MasterState) => MasterState) => setMasterState((current) => updater(current));

  const syncBookingStatus = async (bookingId: string, status: BookingStatus) => {
    const target = bookings.find((booking) => booking.id === bookingId);
    if (!target) return;

    try {
      await updateAppointmentStatus(bookingId, status === "completed" ? "completed" : "cancelled");
    } catch {
      updateMasterState((current) => ({
        ...current,
        notifications: [{
          id: `master-status-error-${bookingId}-${Date.now()}`,
          title: ua ? "Не вдалось оновити запис" : "Failed to update booking",
          text: ua ? "Спробуйте ще раз" : "Please try again",
          createdAt: new Date().toISOString(),
          read: false,
          kind: "status",
          entityId: bookingId,
        }, ...current.notifications],
      }));
      return;
    }

    await loadBookings();
    updateMasterState((current) => ({
      ...current,
      notifications: [{
        id: `master-local-status-${bookingId}-${Date.now()}`,
        title: status === "completed" ? (ua ? "Візит завершено" : "Visit completed") : (ua ? "Запис скасовано" : "Booking cancelled"),
        text: `${target.service} · ${target.time}`,
        createdAt: new Date().toISOString(),
        read: false,
        kind: "status",
        entityId: bookingId,
      }, ...current.notifications],
    }));
  };

  const updateScheduleDay = (weekday: number, patch: Partial<WorkingScheduleDayApi>) => {
    setWorkingSchedule((current) => current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)));
  };

  const persistScheduleDay = async (weekday: number) => {
    const day = workingSchedule.find((item) => item.weekday === weekday);
    if (!day) return;
    setScheduleSaving(weekday);
    try {
      const saved = await saveWorkingScheduleDay(day);
      setWorkingSchedule((current) => current.map((item) => (item.weekday === weekday ? { ...item, ...saved } : item)));
    } catch {
      // Не вдалось зберегти — залишок стану лишається як є, спробує ще раз при наступній зміні.
    } finally {
      setScheduleSaving(null);
    }
  };

  const addDayOff = async () => {
    if (!dayOffStart || !dayOffEnd || dayOffEnd < dayOffStart) return;
    try {
      const created = await createDayOff({ start_date: dayOffStart, end_date: dayOffEnd, reason: dayOffReason.trim() });
      setDayOffs((current) => [...current, created]);
      setDayOffModalOpen(false);
      setDayOffReason("");
    } catch {
      // TODO: показати помилку користувачу замість тихого no-op.
    }
  };

  const removeDayOff = async (id: number) => {
    try {
      await deleteDayOff(id);
      setDayOffs((current) => current.filter((off) => off.id !== id));
    } catch {
      // Не вдалось видалити — запис лишається в списку.
    }
  };

  const saveService = () => {
    const price = Number(serviceDraft.price);
    const duration = Number(serviceDraft.duration);
    if (!serviceDraft.name.trim() || !price || !duration) return;
    updateMasterState((current) => {
      const next: MasterService = {
        id: serviceDraft.id ?? `service-${Date.now()}`,
        name: serviceDraft.name.trim(),
        price,
        duration,
        active: serviceDraft.active,
      };
      return {
        ...current,
        services: serviceDraft.id
          ? current.services.map((item) => item.id === serviceDraft.id ? next : item)
          : [...current.services, next],
      };
    });
    setServiceDraft({ name: "", price: "", duration: "60", active: true });
    setServiceModalOpen(false);
  };

  const addPortfolioImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const images = await Promise.all(Array.from(files).filter((file) => file.type.startsWith("image/")).map(fileToDataUrl));
    updateMasterState((current) => ({ ...current, portfolioImages: [...current.portfolioImages, ...images] }));
  };

  const requestPayout = () => {
    if (availablePayout <= 0) return;
    const payout: MasterPayout = { id: `payout-${Date.now()}`, amount: availablePayout, createdAt: new Date().toISOString(), status: "requested" };
    updateMasterState((current) => ({
      ...current,
      payouts: [payout, ...current.payouts],
      notifications: [{
        id: `payout-notice-${payout.id}`,
        title: ua ? "Заявку на виплату створено" : "Payout request created",
        text: formatMoney(payout.amount, ua),
        createdAt: payout.createdAt,
        read: false,
        kind: "finance",
        entityId: payout.id,
      }, ...current.notifications],
    }));
  };

  const makePortfolioCover = (index: number) => {
    updateMasterState((current) => {
      const selected = current.portfolioImages[index];
      if (!selected || index === 0) return current;
      return { ...current, portfolioImages: [selected, ...current.portfolioImages.filter((_, itemIndex) => itemIndex !== index)] };
    });
  };

  const savePublicProfile = async () => {
    setProfileSaved(true);
    window.dispatchEvent(new CustomEvent("beautyai:master-profile", { detail: masterState.profile }));
    window.setTimeout(() => setProfileSaved(false), 1800);

    try {
      const { first_name, last_name } = splitName(masterState.profile.displayName);
      await updateMasterProfile({
        first_name,
        last_name,
        email: masterState.profile.email,
        phone: masterState.profile.phone,
        bio: masterState.profile.about,
      });
    } catch {
      // Бекенд не прийняв зміни — локально вже збережено, спробуємо синхронізувати іншим разом.
    }
  };

  const changeAvatar = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const avatar = await fileToDataUrl(file);
    updateMasterState((current) => ({ ...current, profile: { ...current.profile, avatar } }));
    window.dispatchEvent(new CustomEvent("beautyai:master-profile", { detail: { ...masterState.profile, avatar } }));
  };

  const openBookingFromNotification = (notification: MasterNotification) => {
    if (notification.kind === "finance") {
      setSection("finance");
      return;
    }
    if (!notification.entityId) return;
    const booking = bookings.find((item) => item.id === notification.entityId);
    if (!booking) return;
    setSection("home");
    setSelectedDate(booking.date);
    setCalendarMonth(new Date(`${booking.date}T12:00:00`));
    if (notification.kind === "review") {
      setAllReviewsOpen(true);
      return;
    }
    setSelectedBooking(booking);
  };

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    return { days: Array.from({ length: daysInMonth }, (_, index) => index + 1), offset: mondayOffset };
  }, [calendarMonth]);

  const monthTitle = new Intl.DateTimeFormat(ua ? "uk-UA" : "en-GB", { month: "long", year: "numeric" }).format(calendarMonth);
  const title = section === "home"
    ? (ua ? `Вітаємо, ${masterState.profile.displayName}! 👋` : `Welcome, ${masterState.profile.displayName}! 👋`)
    : section === "finance" ? (ua ? "Фінанси" : "Finance")
      : section === "services" ? (ua ? "Послуги" : "Services")
        : section === "gallery" ? (ua ? "Галерея" : "Gallery")
          : (ua ? "Профіль" : "Profile");

  return (
    <DashboardFrame
      user={{ ...user, name: masterState.profile.displayName || user.name, avatar: masterState.profile.avatar || user.avatar }}
      lang={lang}
      onHome={onHome}
      onLogout={onLogout}
      onRoleChange={_onRoleChange}
      title={title}
      variant="master"
      activeSection={section}
      onSectionChange={setSection}
      masterNotifications={masterState.notifications}
      onMasterNotificationsChange={(notifications) => updateMasterState((current) => ({ ...current, notifications }))}
      onMasterNotificationClick={openBookingFromNotification}
    >
      {section === "home" && (
        <div className="master-home-v2">
          <div className="master-summary-v2">
            <article><span>{ua ? "Записи сьогодні" : "Bookings today"}</span><strong>{todayBookings.length}</strong><small>{ua ? `${todayBookings.filter((b) => b.status === "completed").length} завершено` : `${todayBookings.filter((b) => b.status === "completed").length} completed`}</small><i>✂</i></article>
            <article><span>{ua ? "Клієнти за місяць" : "Clients this month"}</span><strong>{uniqueClients}</strong><small>{ua ? "Унікальні клієнти" : "Unique clients"}</small><i>♙</i></article>
            <article><span>{ua ? "Заповненість" : "Occupancy"}</span><strong>{occupancy}%</strong><small>{ua ? "За поточний місяць" : "Current month"}</small><i>◒</i></article>
            <article><span>{ua ? "Рейтинг" : "Rating"}</span><strong>{rating ? rating.toFixed(1) : "—"} <em>★</em></strong><small>{reviews.length} {ua ? "відгуків" : "reviews"}</small><i>☆</i></article>
          </div>

          <div className="master-main-grid-v2">
            <section className="master-card-v2 master-schedule-v2">
              <div className="master-card-head-v2">
                <div><h2>{ua ? "Розклад" : "Schedule"}</h2><p>{formatDate(selectedDate, ua, { weekday: "long", day: "numeric", month: "long" })}</p></div>
              </div>
              <div className="master-schedule-list-v2">
                {selectedBookings.length === 0 && <div className="master-empty-v2">{ua ? "На цю дату записів немає" : "No bookings for this date"}</div>}
                {selectedBookings.map((booking) => (
                  <div className={`master-slot-v2 ${booking.status}`} key={booking.id} role="button" tabIndex={0} onClick={() => setSelectedBooking(booking)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedBooking(booking); }}>
                    <time>{booking.time}</time>
                    <div className="master-slot-copy-v2"><b>{booking.service}</b><span>{booking.phone || (ua ? "Клієнт" : "Client")}</span></div>
                    <strong>{formatMoney(parsePrice(booking.priceFrom), ua)}</strong>
                    <div className="master-slot-actions-v2">
                      <span className={`master-slot-status-v2 ${booking.status}`}>{booking.status === "completed" ? (ua ? "Завершено" : "Completed") : booking.status === "cancelled" ? (ua ? "Скасовано" : "Cancelled") : (ua ? "Підтверджено" : "Confirmed")}</span>
                      {booking.status === "confirmed" && <>
                        <button type="button" onClick={(event) => { event.stopPropagation(); syncBookingStatus(booking.id, "completed"); }}>{ua ? "Завершити" : "Complete"}</button>
                        <button type="button" className="danger" onClick={(event) => { event.stopPropagation(); syncBookingStatus(booking.id, "cancelled"); }}>{ua ? "Скасувати" : "Cancel"}</button>
                      </>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="master-side-stack-v2">
              <section className="master-card-v2 master-calendar-v2">
                <div className="master-card-head-v2">
                  <div><h2 className="master-month-title-v2">{monthTitle}</h2></div>
                  <div className="master-calendar-nav-v2">
                    <button type="button" disabled={calendarMonth.getFullYear() === new Date().getFullYear() && calendarMonth.getMonth() === new Date().getMonth()} onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button>
                    <button type="button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button>
                  </div>
                </div>
                <div className="master-calendar-week-v2">{(ua ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]).map((day) => <span key={day}>{day}</span>)}</div>
                <div className="master-calendar-grid-v2">
                  {Array.from({ length: calendarDays.offset }, (_, index) => <span className="empty" key={`empty-${index}`} />)}
                  {calendarDays.days.map((day) => {
                    const value = toInputDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
                    const count = bookings.filter((booking) => booking.date === value && booking.status !== "cancelled").length;
                    const disabled = isPastDateValue(value);
                    return <button type="button" disabled={disabled} className={`${value === selectedDate ? "selected " : ""}${count ? "has-bookings " : ""}${disabled ? "past" : ""}`} key={day} onClick={() => !disabled && setSelectedDate(value)} aria-label={`${formatDate(value, ua)}${count ? `, ${count}` : ""}`}>{day}</button>;
                  })}
                </div>
                <div className="master-calendar-legend-v2"><span><i className="selected" />{formatDate(selectedDate, ua)}</span><span><i className="busy" />{selectedBookings.length} {ua ? "записів" : "bookings"}</span></div>
              </section>
            </div>
          </div>

          <section className="master-card-v2 master-reviews-v2 master-reviews-wide-v2">
            <div className="master-card-head-v2"><div><h2>{ua ? "Останні відгуки" : "Latest reviews"}</h2></div><button className="link" type="button" disabled={!reviews.length} onClick={() => setAllReviewsOpen(true)}>{ua ? "Переглянути всі" : "View all"}</button></div>
            {reviews.length ? <div className="master-reviews-grid-v2">{reviews.slice(0, 3).map((review) => <article key={review.id}>{review.client_profile_photo ? <img className="master-review-avatar-v2" src={review.client_profile_photo} alt={review.client_name} /> : <div className="master-review-avatar-v2">★</div>}<div><b>{review.client_name}</b><span>{new Intl.DateTimeFormat(ua ? "uk-UA" : "en-GB", { day: "numeric", month: "long" }).format(new Date(review.created_at))}</span><p>{review.comment}</p></div><strong>{"★".repeat(review.rating)} <span>{review.rating.toFixed(1)}</span></strong></article>)}</div> : <div className="master-empty-v2 master-empty-reviews-v2">{ua ? "Відгуків ще немає — вони зʼявляться після завершених візитів" : "No reviews yet — they will appear after completed visits"}</div>}
          </section>
        </div>
      )}

      {section === "services" && (
        <section className="master-card-v2 master-services-page-v2">
          <div className="master-card-head-v2"><div><h2>{ua ? "Послуги та ціни" : "Services & prices"}</h2><p>{ua ? "Ці послуги бачить клієнт під час запису" : "Clients see these services while booking"}</p></div><button type="button" onClick={() => { setServiceDraft({ name: "", price: "", duration: "60", active: true }); setServiceModalOpen(true); }}>+ {ua ? "Додати послугу" : "Add service"}</button></div>
          <div className="master-services-list-v2">
            {masterState.services.length === 0 && <div className="master-empty-v2">{ua ? "Додайте першу послугу, щоб клієнти могли її забронювати" : "Add your first service so clients can book it"}</div>}
            {masterState.services.map((service) => <article key={service.id} className={!service.active ? "inactive" : ""}><div><b>{service.name}</b><span>{service.duration} {ua ? "хв" : "min"}</span></div><strong>{formatMoney(service.price, ua)}</strong><span className={`master-service-state-v2 ${service.active ? "active" : ""}`}>{service.active ? (ua ? "Активна" : "Active") : (ua ? "Прихована" : "Hidden")}</span><button type="button" onClick={() => { setServiceDraft({ id: service.id, name: service.name, price: String(service.price), duration: String(service.duration), active: service.active }); setServiceModalOpen(true); }}>{ua ? "Редагувати" : "Edit"}</button><button type="button" className="danger" onClick={() => updateMasterState((current) => ({ ...current, services: current.services.filter((item) => item.id !== service.id) }))}>{ua ? "Видалити" : "Delete"}</button></article>)}
          </div>
        </section>
      )}

      {section === "gallery" && (
        <div className="master-gallery-page-v2">
          <section className="master-card-v2 master-public-profile-v2">
            <div className="master-card-head-v2"><div><h2>{ua ? "Публічний профіль майстра" : "Public master profile"}</h2><p>{ua ? "Цю інформацію побачить клієнт на сайті" : "Clients see this information on the website"}</p></div></div>
            <div className="master-public-profile-top-v2"><img src={masterState.profile.avatar} alt={masterState.profile.displayName} /><div><strong>{masterState.profile.displayName || (ua ? "Без імені" : "No name")}</strong><span>{masterState.profile.specialization || (ua ? "Спеціалізацію не вказано" : "No specialization")}</span><small>{[masterState.profile.city, masterState.profile.salon].filter(Boolean).join(" • ") || (ua ? "Локацію не вказано" : "No location")}</small></div></div>
            <div className="master-public-profile-form-v2">
              <label>{ua ? "Ім'я для клієнтів" : "Public name"}<input value={masterState.profile.displayName} onChange={(event) => updateMasterState((current) => ({ ...current, profile: { ...current.profile, displayName: event.target.value } }))} /></label>
              <label>{ua ? "Спеціалізація" : "Specialization"}<input value={masterState.profile.specialization} onChange={(event) => updateMasterState((current) => ({ ...current, profile: { ...current.profile, specialization: event.target.value } }))} /></label>
              <label>{ua ? "Місто" : "City"}<input value={masterState.profile.city} onChange={(event) => updateMasterState((current) => ({ ...current, profile: { ...current.profile, city: event.target.value } }))} /></label>
              <label>{ua ? "Салон" : "Salon"}<input value={masterState.profile.salon} onChange={(event) => updateMasterState((current) => ({ ...current, profile: { ...current.profile, salon: event.target.value } }))} /></label>
              <label className="wide">{ua ? "Про себе" : "About"}<textarea value={masterState.profile.about} onChange={(event) => updateMasterState((current) => ({ ...current, profile: { ...current.profile, about: event.target.value } }))} /></label>
            </div>
            <button className="master-primary-v2" type="button" onClick={savePublicProfile}>{profileSaved ? (ua ? "Збережено ✓" : "Saved ✓") : (ua ? "Зберегти публічний профіль" : "Save public profile")}</button>
          </section>

          <section className="master-card-v2 master-portfolio-v2">
            <div className="master-card-head-v2"><div><h2>{ua ? "Галерея робіт" : "Portfolio"}</h2><p>{portfolioCountLabel}</p></div><label className="master-upload-work-v2">+ {ua ? "Додати фото" : "Add photos"}<input type="file" accept="image/*" multiple onChange={(event) => { void addPortfolioImages(event.target.files); event.currentTarget.value = ""; }} /></label></div>
            {masterState.portfolioImages.length ? <div className="master-portfolio-grid-v2">{masterState.portfolioImages.map((src, index) => <article className={`master-portfolio-item-v2 ${index === 0 ? "cover" : ""}`} key={`${index}-${src.slice(-16)}`}><img src={src} alt={`${ua ? "Робота" : "Work"} ${index + 1}`} />{index === 0 && <span className="master-portfolio-cover-label-v3">{ua ? "Обкладинка" : "Cover"}</span>}<div className="master-portfolio-actions-v3">{index !== 0 && <button type="button" title={ua ? "Зробити обкладинкою" : "Make cover"} onClick={() => makePortfolioCover(index)}>★</button>}<button type="button" title={ua ? "Видалити" : "Delete"} onClick={() => updateMasterState((current) => ({ ...current, portfolioImages: current.portfolioImages.filter((_, itemIndex) => itemIndex !== index) }))}>×</button></div></article>)}</div> : <label className="master-portfolio-empty-v2"><span>＋</span><strong>{ua ? "Додайте перші фото робіт" : "Add your first work photos"}</strong><small>{ua ? "Вони будуть показані клієнтам у вашому публічному профілі" : "They will be shown in your public profile"}</small><input type="file" accept="image/*" multiple onChange={(event) => { void addPortfolioImages(event.target.files); event.currentTarget.value = ""; }} /></label>}
          </section>
        </div>
      )}

      {section === "profile" && (
        <section className="master-card-v2 master-profile-v2">
          <div className="master-card-head-v2"><div><h2>{ua ? "Особиста інформація" : "Personal information"}</h2><p>{ua ? "Дані акаунта та контактна інформація" : "Account and contact information"}</p></div></div>
          <div className="master-profile-top-v2"><img src={masterState.profile.avatar} alt={masterState.profile.displayName} /><div><b>{masterState.profile.displayName || user.name}</b><span>{ua ? "Майстер • Beauty AI" : "Master • Beauty AI"}</span><button type="button" onClick={() => avatarInputRef.current?.click()}>{ua ? "Змінити фото" : "Change photo"}</button><input ref={avatarInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void changeAvatar(event.target.files?.[0]); event.currentTarget.value = ""; }} /></div></div>
          <div className="master-form-grid-v2">
            <label>{ua ? "Ім'я" : "Name"}<input value={masterState.profile.displayName} onChange={(event) => updateMasterState((current) => ({ ...current, profile: { ...current.profile, displayName: event.target.value } }))} /></label>
            <label>Email<input type="email" value={masterState.profile.email} onChange={(event) => updateMasterState((current) => ({ ...current, profile: { ...current.profile, email: event.target.value } }))} /></label>
            <label>{ua ? "Телефон" : "Phone"}<input value={masterState.profile.phone} onChange={(event) => updateMasterState((current) => ({ ...current, profile: { ...current.profile, phone: event.target.value } }))} /></label>
            <label>{ua ? "Місто" : "City"}<input value={masterState.profile.city} onChange={(event) => updateMasterState((current) => ({ ...current, profile: { ...current.profile, city: event.target.value } }))} /></label>
            <label className="wide">{ua ? "Про себе" : "About"}<textarea value={masterState.profile.about} onChange={(event) => updateMasterState((current) => ({ ...current, profile: { ...current.profile, about: event.target.value } }))} /></label>
          </div>
          <button className="master-primary-v2" type="button" onClick={savePublicProfile}>{ua ? "Зберегти зміни" : "Save changes"}</button>
        </section>
      )}

      {section === "profile" && (
        <section className="master-card-v2 master-schedule-settings-v2">
          <div className="master-card-head-v2"><div><h2>{ua ? "Графік роботи" : "Working hours"}</h2><p>{ua ? "Тижневий розклад, за яким клієнти бачать вільний час" : "Weekly hours clients see as available"}</p></div></div>
          <div className="master-weekly-schedule-v2">
            {workingSchedule.map((day) => {
              const label = WEEKDAYS.find((item) => item.value === day.weekday)?.short[ua ? "ua" : "en"] ?? String(day.weekday);
              return (
                <div className="master-weekly-schedule-row-v2" key={day.weekday}>
                  <b>{label}</b>
                  <label className="master-checkbox-v2">
                    <input
                      type="checkbox"
                      checked={!day.is_closed}
                      onChange={(event) => {
                        updateScheduleDay(day.weekday, { is_closed: !event.target.checked });
                        void persistScheduleDay(day.weekday);
                      }}
                    />
                    {ua ? "Робочий день" : "Working day"}
                  </label>
                  {!day.is_closed && (
                    <>
                      <input
                        type="time"
                        value={day.opening_time ?? "09:00"}
                        onChange={(event) => updateScheduleDay(day.weekday, { opening_time: event.target.value })}
                        onBlur={() => persistScheduleDay(day.weekday)}
                      />
                      <span>—</span>
                      <input
                        type="time"
                        value={day.closing_time ?? "18:00"}
                        onChange={(event) => updateScheduleDay(day.weekday, { closing_time: event.target.value })}
                        onBlur={() => persistScheduleDay(day.weekday)}
                      />
                    </>
                  )}
                  {scheduleSaving === day.weekday && <small>{ua ? "Збереження…" : "Saving…"}</small>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {section === "profile" && (
        <section className="master-card-v2 master-dayoffs-v2">
          <div className="master-card-head-v2">
            <div><h2>{ua ? "Вихідні та відпустки" : "Days off"}</h2><p>{ua ? "Дати, коли ви недоступні для запису" : "Dates you're unavailable for bookings"}</p></div>
            <button type="button" onClick={() => { setDayOffStart(todayValue); setDayOffEnd(todayValue); setDayOffReason(""); setDayOffModalOpen(true); }}>+ {ua ? "Додати" : "Add"}</button>
          </div>
          {dayOffs.length ? (
            <div className="master-dayoffs-list-v2">
              {dayOffs.map((off) => (
                <div className="master-dayoff-row-v2" key={off.id}>
                  <span>{formatDate(off.start_date, ua)} — {formatDate(off.end_date, ua)}</span>
                  <small>{off.reason}</small>
                  <button type="button" className="danger" onClick={() => removeDayOff(off.id)}>{ua ? "Видалити" : "Delete"}</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="master-empty-v2">{ua ? "Вихідних не заплановано" : "No days off scheduled"}</div>
          )}
        </section>
      )}

      {section === "finance" && (
        <div className="master-finance-v2">
          <div className="master-summary-v2 finance"><article><span>{ua ? "Дохід за весь період" : "Total income"}</span><strong>{formatMoney(completedRevenue, ua)}</strong><small>{completedBookings.length} {ua ? "завершених візитів" : "completed visits"}</small></article><article className="master-payout-summary-v3"><span>{ua ? "Доступно до виплати" : "Available payout"}</span><strong>{formatMoney(availablePayout, ua)}</strong><small>{masterState.payouts.length ? (ua ? `${masterState.payouts.length} заявок створено` : `${masterState.payouts.length} requests created`) : (ua ? "Ще не було заявок" : "No payout requests yet")}</small><button type="button" disabled={availablePayout <= 0} onClick={requestPayout}>{ua ? "Створити заявку" : "Request payout"}</button></article><article><span>{ua ? "Середній чек" : "Average check"}</span><strong>{completedBookings.length ? formatMoney(Math.round(completedRevenue / completedBookings.length), ua) : "—"}</strong><small>{ua ? "За завершеними записами" : "Completed bookings"}</small></article></div>
          <section className="master-card-v2 master-results-v2 master-finance-results-v2"><div className="master-card-head-v2"><div><h2>{ua ? "Результати" : "Results"}</h2><p>{formatDate(selectedDate, ua)}</p></div></div><div className="master-results-grid-v2"><div><strong>{bookings.filter((b) => b.date === selectedDate && b.status === "completed").length}</strong><span>{ua ? "Завершені" : "Completed"}</span></div><div><strong>{bookings.filter((b) => b.date === selectedDate && b.status === "cancelled").length}</strong><span>{ua ? "Скасовані" : "Cancelled"}</span></div><div><strong>{bookings.filter((b) => b.date === selectedDate && b.status === "confirmed").length}</strong><span>{ua ? "Майбутні" : "Upcoming"}</span></div><div><strong>{formatMoney(bookings.filter((b) => b.date === selectedDate && b.status === "completed").reduce((sum, b) => sum + parsePrice(b.priceFrom), 0), ua)}</strong><span>{ua ? "Виручка" : "Revenue"}</span></div></div></section>
          <section className="master-card-v2"><div className="master-card-head-v2"><div><h2>{ua ? "Останні операції" : "Recent transactions"}</h2><p>{ua ? "Завершені записи та заявки на виплату" : "Completed bookings and payout requests"}</p></div><button type="button" disabled={!completedBookings.length && !masterState.payouts.length} onClick={() => downloadCsv(`beauty-ai-master-${todayValue}.csv`, [["Type", "Date", "Service / status", "Client", "Amount"], ...completedBookings.map((b) => ["income", b.date, b.service, b.phone, String(parsePrice(b.priceFrom))]), ...masterState.payouts.map((payout) => ["payout_request", payout.createdAt, payout.status, "", String(-payout.amount)])])}>{ua ? "Вивантажити звіт" : "Export report"}</button></div><div className="master-transactions-v2">{completedBookings.length || masterState.payouts.length ? [...completedBookings.map((booking) => ({ id: booking.id, createdAt: `${booking.date}T${booking.time || "00:00"}:00`, kind: "income" as const, booking })), ...masterState.payouts.map((payout) => ({ id: payout.id, createdAt: payout.createdAt, kind: "payout" as const, payout }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 16).map((item) => item.kind === "income" ? <div key={item.id}><span>{formatDate(item.booking.date, ua)}</span><b>{item.booking.service}<small>{item.booking.phone}</small></b><strong>+{formatMoney(parsePrice(item.booking.priceFrom), ua)}</strong></div> : <div key={item.id} className="payout"><span>{new Date(item.payout.createdAt).toLocaleDateString(ua ? "uk-UA" : "en-GB")}</span><b>{ua ? "Заявка на виплату" : "Payout request"}<small>{ua ? "Очікує підключення платіжного API" : "Waiting for payout API"}</small></b><strong>−{formatMoney(item.payout.amount, ua)}</strong></div>) : <div className="master-empty-v2">{ua ? "Операцій ще немає" : "No transactions yet"}</div>}</div></section>
        </div>
      )}

      {selectedBooking && <div className="master-modal-backdrop-v2" onMouseDown={() => setSelectedBooking(null)}><div className="master-modal-v2 master-booking-detail-v2" onMouseDown={(event) => event.stopPropagation()}><button className="master-modal-close-v2" type="button" onClick={() => setSelectedBooking(null)}>×</button><div className="master-booking-detail-head-v2"><span className={`master-slot-status-v2 ${selectedBooking.status}`}>{selectedBooking.status === "completed" ? (ua ? "Завершено" : "Completed") : selectedBooking.status === "cancelled" ? (ua ? "Скасовано" : "Cancelled") : (ua ? "Підтверджено" : "Confirmed")}</span><h3>{selectedBooking.service}</h3><p>{formatDate(selectedBooking.date, ua, { weekday: "long", day: "numeric", month: "long" })} · {selectedBooking.time}</p></div><div className="master-booking-detail-grid-v2"><div><span>{ua ? "Клієнт" : "Client"}</span><strong>{selectedBooking.phone || "—"}</strong></div><div><span>{ua ? "Сума" : "Amount"}</span><strong>{formatMoney(parsePrice(selectedBooking.priceFrom), ua)}</strong></div><div><span>{ua ? "Код запису" : "Booking code"}</span><strong>{selectedBooking.code}</strong></div><div><span>{ua ? "Створено" : "Created"}</span><strong>{new Intl.DateTimeFormat(ua ? "uk-UA" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(selectedBooking.createdAt))}</strong></div></div>{(() => {
  const matchedReview = reviews.find((review) => review.service_name === selectedBooking.service && review.appointment_date === selectedBooking.date);
  return matchedReview ? <div className="master-booking-review-v2"><span>{ua ? "Відгук клієнта" : "Client review"}</span><strong>{"★".repeat(matchedReview.rating)}</strong><p>{matchedReview.comment}</p></div> : null;
})()}{selectedBooking.status === "confirmed" && <div className="master-booking-detail-actions-v2"><button className="master-primary-v2" type="button" onClick={() => { syncBookingStatus(selectedBooking.id, "completed"); setSelectedBooking(null); }}>{ua ? "Завершити візит" : "Complete visit"}</button><button className="master-danger-outline-v2" type="button" onClick={() => { syncBookingStatus(selectedBooking.id, "cancelled"); setSelectedBooking(null); }}>{ua ? "Скасувати запис" : "Cancel booking"}</button></div>}</div></div>}

      {dayOffModalOpen && (
        <div className="master-modal-backdrop-v2" onMouseDown={() => setDayOffModalOpen(false)}>
          <div className="master-modal-v2" onMouseDown={(event) => event.stopPropagation()}>
            <button className="master-modal-close-v2" type="button" onClick={() => setDayOffModalOpen(false)}>×</button>
            <h3>{ua ? "Додати вихідні/відпустку" : "Add day off"}</h3>
            <label>{ua ? "З дати" : "From"}<input type="date" min={todayValue} value={dayOffStart} onChange={(event) => { setDayOffStart(event.target.value); if (dayOffEnd < event.target.value) setDayOffEnd(event.target.value); }} /></label>
            <label>{ua ? "До дати" : "To"}<input type="date" min={dayOffStart} value={dayOffEnd} onChange={(event) => setDayOffEnd(event.target.value)} /></label>
            <label>{ua ? "Причина" : "Reason"}<input value={dayOffReason} onChange={(event) => setDayOffReason(event.target.value)} placeholder={ua ? "Наприклад, відпустка" : "e.g. Vacation"} /></label>
            <button className="master-primary-v2" type="button" onClick={addDayOff}>{ua ? "Додати" : "Add"}</button>
          </div>
        </div>
      )}

      {serviceModalOpen && <div className="master-modal-backdrop-v2" onMouseDown={() => setServiceModalOpen(false)}><div className="master-modal-v2" onMouseDown={(event) => event.stopPropagation()}><button className="master-modal-close-v2" type="button" onClick={() => setServiceModalOpen(false)}>×</button><h3>{serviceDraft.id ? (ua ? "Редагувати послугу" : "Edit service") : (ua ? "Нова послуга" : "New service")}</h3><label>{ua ? "Назва" : "Name"}<input value={serviceDraft.name} onChange={(event) => setServiceDraft((current) => ({ ...current, name: event.target.value }))} /></label><label>{ua ? "Ціна, грн" : "Price, UAH"}<input type="number" min="1" value={serviceDraft.price} onChange={(event) => setServiceDraft((current) => ({ ...current, price: event.target.value }))} /></label><label>{ua ? "Тривалість, хв" : "Duration, min"}<input type="number" min="15" step="15" value={serviceDraft.duration} onChange={(event) => setServiceDraft((current) => ({ ...current, duration: event.target.value }))} /></label><label className="master-checkbox-v2"><input type="checkbox" checked={serviceDraft.active} onChange={(event) => setServiceDraft((current) => ({ ...current, active: event.target.checked }))} />{ua ? "Показувати клієнтам" : "Visible to clients"}</label><button className="master-primary-v2" type="button" onClick={saveService}>{ua ? "Зберегти" : "Save"}</button></div></div>}

      {allReviewsOpen && <div className="master-modal-backdrop-v2" onMouseDown={() => setAllReviewsOpen(false)}><div className="master-modal-v2 master-reviews-modal-v2" onMouseDown={(event) => event.stopPropagation()}><button className="master-modal-close-v2" type="button" onClick={() => setAllReviewsOpen(false)}>×</button><h3>{ua ? "Усі відгуки" : "All reviews"}</h3><div className="master-all-reviews-list-v2">{reviews.map((review) => <article key={review.id}><div><b>{review.client_name}</b><span>{review.service_name} · {new Date(review.created_at).toLocaleDateString(ua ? "uk-UA" : "en-GB")}</span></div><strong>{"★".repeat(review.rating)}</strong><p>{review.comment}</p></article>)}</div></div></div>}
    </DashboardFrame>
  );
}

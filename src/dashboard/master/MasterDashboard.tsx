import React, { useMemo, useState } from "react";
import DashboardFrame, { type MasterSection } from "../DashboardFrame";
import type { AuthRole, Lang, MockUser } from "../types";

export default function MasterDashboard({ user, lang, onHome, onRoleChange }: { user: MockUser; lang: Lang; onHome: () => void; onRoleChange: (role: AuthRole) => void }) {
  const ua = lang === "ua";
  const [section, setSection] = useState<MasterSection>("home");
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [publicProfile, setPublicProfile] = useState({
    displayName: user.name,
    specialization: "Майстер манікюру та brow-artist",
    city: "Київ",
    salon: "Beauty Room",
    about: "Люблю натуральні форми, акуратне покриття та красиві деталі.",
  });

  const portfolioCountLabel = useMemo(
    () => `${portfolioImages.length} ${portfolioImages.length === 1 ? "робота" : "робіт"}`,
    [portfolioImages.length]
  );

  const addPortfolioImages = (files: FileList | null) => {
    if (!files?.length) return;

    const nextImages = Array.from(files).map((file) => URL.createObjectURL(file));
    setPortfolioImages((current) => [...current, ...nextImages]);
  };

  const schedule = [
    { time: "10:00", client: "Олена К.", service: "Манікюр", price: "650 ₴", status: "done" },
    { time: "12:00", client: "Марія П.", service: "Брови + фарбування", price: "550 ₴", status: "done" },
    { time: "14:00", client: "Наталя С.", service: "Манікюр + покриття", price: "800 ₴", status: "now" },
    { time: "16:00", client: "Анна Д.", service: "Нарощування вій", price: "1 100 ₴", status: "next" },
    { time: "18:00", client: "Вікторія М.", service: "Манікюр", price: "700 ₴", status: "next" },
  ];

  const reviews = [
    { name: "Наталя С.", date: "22 травня", text: "Дякую за ідеальний манікюр! 💜", rating: "5.0" },
    { name: "Марія П.", date: "20 травня", text: "Брови просто супер! Дуже задоволена!", rating: "5.0" },
    { name: "Олена К.", date: "16 травня", text: "Все чудово, як завжди!", rating: "5.0" },
  ];

  const completedBookings = schedule.filter((slot) => slot.status === "done").length;
  const cancelledBookings = schedule.filter((slot) => slot.status === "cancelled").length;
  const noShowBookings = schedule.filter((slot) => slot.status === "no-show").length;
  const completedRevenue = schedule
    .filter((slot) => slot.status === "done")
    .reduce((sum, slot) => sum + Number(slot.price.replace(/[^0-9]/g, "")), 0);

  const calendarDays = Array.from({ length: 31 }, (_, index) => index + 1);
  const calendarStartOffset = 4;

  const title =
    section === "home"
      ? (ua ? `Вітаємо, ${user.name}! 👋` : `Welcome, ${user.name}! 👋`)
      : section === "finance"
        ? (ua ? "Фінанси" : "Finance")
        : section === "gallery"
          ? (ua ? "Галерея" : "Gallery")
          : (ua ? "Профіль" : "Profile");

  return <DashboardFrame user={user} lang={lang} onHome={onHome} onRoleChange={onRoleChange} title={title} variant="master" activeSection={section} onSectionChange={setSection}>
    {section === "home" && <div className="master-home-v2">
      <div className="master-summary-v2">
        <article><span>Записи сьогодні</span><strong>6</strong><small>+2 до вчора</small><i>✂</i></article>
        <article><span>Клієнти за місяць</span><strong>18</strong><small>+12% за місяць</small><i>♙</i></article>
        <article><span>Заповненість</span><strong>98%</strong><small>Відмінний результат</small><i>◒</i></article>
        <article><span>Рейтинг</span><strong>4.9 <em>★</em></strong><small>124 відгуки</small><i>☆</i></article>
      </div>

      <div className="master-main-grid-v2">
        <section className="master-card-v2 master-schedule-v2">
          <div className="master-card-head-v2">
            <div><h2>Ваш розклад на сьогодні</h2></div>
            <button type="button">+ Додати вікно</button>
          </div>
          <div className="master-schedule-list-v2">
            {schedule.map((slot) => <div className={`master-slot-v2 ${slot.status === "now" ? "current" : ""}`} key={slot.time}>
              <time>{slot.time}</time><div className="master-slot-copy-v2"><b>{slot.service}</b><span>{slot.client}</span></div><strong>{slot.price}</strong><span className={`master-slot-status-v2 ${slot.status}`}>{slot.status === "done" ? "Завершено" : slot.status === "now" ? "Зараз" : "Запис"}</span>
            </div>)}
          </div>
        </section>

        <div className="master-side-stack-v2">
          <section className="master-card-v2 master-calendar-v2">
            <div className="master-card-head-v2">
              <div>
                <h2>Серпень 2026</h2>
              </div>
              <div className="master-calendar-nav-v2" aria-hidden="true">
                <button type="button">‹</button>
                <button type="button">›</button>
              </div>
            </div>
            <div className="master-calendar-week-v2">
              {(["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"] as const).map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="master-calendar-grid-v2">
              {Array.from({ length: calendarStartOffset }, (_, index) => <span className="empty" key={`empty-${index}`} />)}
              {calendarDays.map((day) => (
                <button
                  type="button"
                  className={day === 27 ? "selected has-bookings" : ""}
                  key={day}
                  aria-label={day === 27 ? `${day} травня, ${schedule.length} записів` : `${day} травня`}
                >
                  {day}
                </button>
              ))}
            </div>
            <div className="master-calendar-legend-v2">
              <span><i className="selected" />27 травня</span>
              <span><i className="busy" />{schedule.length} записів</span>
            </div>
          </section>

        </div>
      </div>

      <section className="master-card-v2 master-reviews-v2 master-reviews-wide-v2">
        <div className="master-card-head-v2">
          <div><h2>Останні відгуки</h2></div>
          <button className="link" type="button">Переглянути всі</button>
        </div>

        <div className="master-reviews-grid-v2">
          {reviews.slice(0, 3).map((review) => (
            <article key={review.name}>
              <div className="master-review-avatar-v2">{review.name[0]}</div>
              <div>
                <b>{review.name}</b>
                <span>{review.date}</span>
                <p>{review.text}</p>
              </div>
              <strong>★★★★★ <span>{review.rating}</span></strong>
            </article>
          ))}
        </div>
      </section>
    </div>}


    {section === "gallery" && <div className="master-gallery-page-v2">
      <section className="master-card-v2 master-public-profile-v2">
        <div className="master-card-head-v2">
          <div>
            <h2>Публічний профіль майстра</h2>
            <p>Цю інформацію побачить клієнт після натискання «Детальніше про майстра»</p>
          </div>
        </div>

        <div className="master-public-profile-top-v2">
          <img src={user.avatar} alt={publicProfile.displayName} />
          <div>
            <strong>{publicProfile.displayName}</strong>
            <span>{publicProfile.specialization}</span>
            <small>{publicProfile.city}{publicProfile.salon ? ` • ${publicProfile.salon}` : ""}</small>
          </div>
        </div>

        <div className="master-public-profile-form-v2">
          <label>
            Ім'я для клієнтів
            <input
              value={publicProfile.displayName}
              onChange={(event) => setPublicProfile((current) => ({ ...current, displayName: event.target.value }))}
            />
          </label>
          <label>
            Спеціалізація
            <input
              value={publicProfile.specialization}
              onChange={(event) => setPublicProfile((current) => ({ ...current, specialization: event.target.value }))}
            />
          </label>
          <label>
            Місто
            <input
              value={publicProfile.city}
              onChange={(event) => setPublicProfile((current) => ({ ...current, city: event.target.value }))}
            />
          </label>
          <label>
            Салон
            <input
              value={publicProfile.salon}
              onChange={(event) => setPublicProfile((current) => ({ ...current, salon: event.target.value }))}
            />
          </label>
          <label className="wide">
            Про себе
            <textarea
              value={publicProfile.about}
              onChange={(event) => setPublicProfile((current) => ({ ...current, about: event.target.value }))}
            />
          </label>
        </div>

        <button className="master-primary-v2" type="button">
          Зберегти публічний профіль
        </button>
      </section>

      <section className="master-card-v2 master-portfolio-v2">
        <div className="master-card-head-v2">
          <div>
            <h2>Галерея робіт</h2>
            <p>{portfolioCountLabel}</p>
          </div>
          <label className="master-upload-work-v2">
            + Додати фото
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                addPortfolioImages(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        {portfolioImages.length > 0 ? (
          <div className="master-portfolio-grid-v2">
            {portfolioImages.map((src, index) => (
              <article className="master-portfolio-item-v2" key={`${src}-${index}`}>
                <img src={src} alt={`Робота ${index + 1}`} />
                <button
                  type="button"
                  aria-label={`Видалити роботу ${index + 1}`}
                  onClick={() => setPortfolioImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  ×
                </button>
              </article>
            ))}
          </div>
        ) : (
          <label className="master-portfolio-empty-v2">
            <span>＋</span>
            <strong>Додайте перші фото робіт</strong>
            <small>Вони будуть показані клієнтам у вашому публічному профілі</small>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                addPortfolioImages(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        )}
      </section>
    </div>}

    {section === "profile" && <section className="master-card-v2 master-profile-v2">
      <div className="master-card-head-v2"><div><h2>Особиста інформація</h2><p>Дані акаунта та контактна інформація</p></div></div>
      <div className="master-profile-top-v2"><img src={user.avatar} alt={user.name}/><div><b>{user.name}</b><span>Майстер • Beauty AI</span><button type="button">Змінити фото</button></div></div>
      <div className="master-form-grid-v2"><label>Ім'я<input defaultValue={user.name}/></label><label>Email<input defaultValue={user.email}/></label><label>Телефон<input defaultValue="+380 67 123 45 67"/></label><label>Місто<input defaultValue="Київ"/></label><label className="wide">Про себе<textarea defaultValue="Майстер манікюру та brow-artist. Люблю натуральні форми, акуратне покриття та красиві деталі."/></label></div>
      <button className="master-primary-v2" type="button">Зберегти зміни</button>
    </section>}

    {section === "finance" && <div className="master-finance-v2">
      <div className="master-summary-v2 finance">
        <article><span>Дохід за місяць</span><strong>28 450 ₴</strong><small>+18% до квітня</small></article>
        <article><span>Доступно до виплати</span><strong>12 750 ₴</strong><small>Наступна виплата 1 червня</small></article>
        <article><span>Beauty бонуси</span><strong>1 250</strong><small>Накопичено</small></article>
      </div>

      <section className="master-card-v2 master-results-v2 master-finance-results-v2">
        <div className="master-card-head-v2">
          <div>
            <h2>Результати сьогодні</h2>
            <p>27 травня 2026</p>
          </div>
        </div>
        <div className="master-results-grid-v2">
          <div><strong>{completedBookings}</strong><span>Завершені</span></div>
          <div><strong>{cancelledBookings}</strong><span>Скасовані</span></div>
          <div><strong>{noShowBookings}</strong><span>No-show</span></div>
          <div><strong>{completedRevenue.toLocaleString("uk-UA")} ₴</strong><span>Виручка</span></div>
        </div>
      </section>

      <section className="master-card-v2">
        <div className="master-card-head-v2">
          <div><h2>Останні операції</h2><p>Травень 2026</p></div>
          <button type="button">Вивантажити звіт</button>
        </div>
        <div className="master-transactions-v2">
          {[["27 травня","Манікюр + покриття","Наталя С.","+800 ₴"],["27 травня","Брови + фарбування","Марія П.","+550 ₴"],["26 травня","Манікюр","Олена К.","+650 ₴"],["25 травня","Виплата на картку","•• 4821","−8 000 ₴"]].map(x => (
            <div key={x.join("")}>
              <span>{x[0]}</span>
              <b>{x[1]}<small>{x[2]}</small></b>
              <strong>{x[3]}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>}
  </DashboardFrame>;
}

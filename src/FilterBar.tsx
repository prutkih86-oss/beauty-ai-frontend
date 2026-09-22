import React from "react";

type Lang = "ua" | "en";

export type FilterState = {
  priceMin: string;
  priceMax: string;
  rating: string;
  distance: string;
  availability: string;
  city: string;
  district: string;
  service: string;
  venueType: string;
};

interface FilterBarProps {
  lang?: Lang;
  value: FilterState;
  onChange: (filters: FilterState) => void;
  onApply: (filters: FilterState) => void;
  onReset: (filters: FilterState) => void;
  onCityChange?: (city: string) => void;
}

const data = {
  ua: {
    price: "Ціна",
    from: "Від",
    to: "До",
    currency: "грн",
    rating: "Рейтинг",
    distance: "Відстань",
    availability: "Доступність",
    city: "Місто",
    district: "Район",
    service: "Послуги",
    venueType: "Тип закладу",
    reset: "Скинути всі фільтри",
    apply: "Показати результати",

    ratings: [
      ["any", "Будь-який"],
      ["from40", "Від 4.0 ⭐"],
      ["from45", "Від 4.5 ⭐"],
      ["from49", "4.9+ ⭐"],
    ],

    distances: [
      ["any", "Будь-яка"],
      ["to1km", "До 1 км"],
      ["to3km", "До 3 км"],
      ["to5km", "До 5 км"],
    ],

    availabilityOptions: [
      ["anytime", "Будь-коли"],
      ["today", "Сьогодні"],
      ["tomorrow", "Завтра"],
      ["week", "Цього тижня"],
    ],

    cities: [
      ["kyiv", "Київ"],
      ["lviv", "Львів"],
    ],

    districts: [
      ["any", "Будь-який район"],
      ["pecherskyi", "Печерський"],
      ["shevchenkivskyi", "Шевченківський"],
      ["podilskyi", "Подільський"],
      ["holosiivskyi", "Голосіївський"],
      ["obolonskyi", "Оболонський"],
      ["darnytskyi", "Дарницький"],
      ["desnianskyi", "Деснянський"],
      ["dniprovskyi", "Дніпровський"],
      ["sviatoshynskyi", "Святошинський"],
      ["solomianskyi", "Солом’янський"],
    ],

    services: [
      ["any", "Будь-яка послуга"],
      ["hair", "Волосся"],
      ["nails", "Манікюр / педикюр"],
      ["brows", "Брови / вії"],
      ["makeup", "Макіяж"],
      ["massage", "Масаж / SPA"],
    ],

    venueTypes: [
      ["any", "Будь-який"],
      ["salon", "Салон"],
      ["studio", "Студія"],
      ["solo", "Приватний майстер"],
    ],
  },

  en: {
    price: "Price",
    from: "From",
    to: "To",
    currency: "UAH",
    rating: "Rating",
    distance: "Distance",
    availability: "Availability",
    city: "City",
    district: "District",
    service: "Services",
    venueType: "Venue type",
    reset: "Reset all filters",
    apply: "Show results",

    ratings: [
      ["any", "Any"],
      ["from40", "From 4.0 ⭐"],
      ["from45", "From 4.5 ⭐"],
      ["from49", "4.9+ ⭐"],
    ],

    distances: [
      ["any", "Any"],
      ["to1km", "Up to 1 km"],
      ["to3km", "Up to 3 km"],
      ["to5km", "Up to 5 km"],
    ],

    availabilityOptions: [
      ["anytime", "Anytime"],
      ["today", "Today"],
      ["tomorrow", "Tomorrow"],
      ["week", "This week"],
    ],

    cities: [
      ["kyiv", "Kyiv"],
      ["lviv", "Lviv"],
    ],

    districts: [
      ["any", "Any district"],
      ["pecherskyi", "Pecherskyi"],
      ["shevchenkivskyi", "Shevchenkivskyi"],
      ["podilskyi", "Podilskyi"],
      ["holosiivskyi", "Holosiivskyi"],
      ["obolonskyi", "Obolonskyi"],
      ["darnytskyi", "Darnytskyi"],
      ["desnianskyi", "Desnianskyi"],
      ["dniprovskyi", "Dniprovskyi"],
      ["sviatoshynskyi", "Sviatoshynskyi"],
      ["solomianskyi", "Solomianskyi"],
    ],

    services: [
      ["any", "Any service"],
      ["hair", "Hair"],
      ["nails", "Nails"],
      ["brows", "Brows / lashes"],
      ["makeup", "Makeup"],
      ["massage", "Massage / SPA"],
    ],

    venueTypes: [
      ["any", "Any"],
      ["salon", "Salon"],
      ["studio", "Studio"],
      ["solo", "Independent master"],
    ],
  },
} as const;

const NEUTRAL_FILTERS: Omit<FilterState, "city"> = {
  priceMin: "",
  priceMax: "",
  rating: "any",
  distance: "any",
  availability: "anytime",
  district: "any",
  service: "any",
  venueType: "any",
};

export default function FilterBar({
  lang = "ua",
  value: filters,
  onChange,
  onApply,
  onReset,
  onCityChange,
}: FilterBarProps) {
  const t = data[lang];

  const update = (key: keyof FilterState, nextValue: string) => {
    const nextFilters = { ...filters, [key]: nextValue };
    onChange(nextFilters);

    if (key === "city") {
      onCityChange?.(nextValue);
    }
  };

  const reset = () => {
    const resetFilters: FilterState = {
      ...NEUTRAL_FILTERS,
      city: filters.city,
    };

    onChange(resetFilters);
    onReset(resetFilters);
  };

  const select = (
    label: string,
    key: keyof FilterState,
    options: readonly (readonly [string, string])[]
  ) => (
    <label className="filter-field">
      <span className="filter-field-label">{label}</span>

      <select
        value={filters[key]}
        onChange={(e) => update(key, e.target.value)}
      >
        {options.map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="filter-panel-content">
      <div className="filter-panel-grid">
        <div className="filter-field filter-price-field">
          <span className="filter-field-label">{t.price}</span>

          <div className="filter-price-inputs">
            <div className="filter-price-box">
              <span className="filter-price-prefix">{t.from}</span>

              <input
                type="number"
                min="0"
                step="50"
                inputMode="numeric"
                value={filters.priceMin}
                onChange={(e) => update("priceMin", e.target.value)}
                placeholder="0"
              />

              <b>{t.currency}</b>
            </div>

            <span className="filter-price-dash">—</span>

            <div className="filter-price-box">
              <span className="filter-price-prefix">{t.to}</span>

              <input
                type="number"
                min="0"
                step="50"
                inputMode="numeric"
                value={filters.priceMax}
                onChange={(e) => update("priceMax", e.target.value)}
                placeholder="3000"
              />

              <b>{t.currency}</b>
            </div>
          </div>
        </div>

        {select(t.rating, "rating", t.ratings)}
        {select(t.distance, "distance", t.distances)}
        {select(t.availability, "availability", t.availabilityOptions)}

        {select(t.city, "city", t.cities)}
        {select(t.district, "district", t.districts)}
        {select(t.service, "service", t.services)}
        {select(t.venueType, "venueType", t.venueTypes)}
      </div>

      <div className="filter-panel-actions">
        <button
          className="filter-reset-btn"
          type="button"
          onClick={reset}
        >
          <span className="filter-reset-icon" aria-hidden="true">
            ↺
          </span>

          {t.reset}
        </button>

        <button
          className="filter-apply-btn"
          type="button"
          onClick={() => onApply(filters)}
        >
          {t.apply}
        </button>
      </div>
    </div>
  );
}
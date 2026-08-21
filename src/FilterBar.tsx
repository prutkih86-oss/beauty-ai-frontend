import React, { useState } from "react";

const filterTranslations = {
  ua: {
    labels: {
      price: "Ціна",
      rating: "Рейтинг",
      distance: "Відстань",
      availability: "Доступність",
    },
    options: {
      price: {
        any: "Будь-яка",
        under500: "До 500 грн",
        from500to1000: "500 - 1000 грн",
        from1000: "Від 1000 грн",
      },
      rating: {
        any: "Будь-який",
        from40: "Від 4.0 ⭐",
        from45: "Від 4.5 ⭐",
        from49: "4.9+ ⭐",
      },
      distance: {
        any: "Будь-яка",
        to1km: "До 1 км",
        to3km: "До 3 км",
        myDistrict: "У моєму районі",
      },
      availability: {
        anytime: "Будь-коли",
        today: "Сьогодні",
        tomorrow: "Завтра",
      },
    },
  },

  en: {
    labels: {
      price: "Price",
      rating: "Rating",
      distance: "Distance",
      availability: "Availability",
    },
    options: {
      price: {
        any: "Any",
        under500: "Under 500 UAH",
        from500to1000: "500 - 1000 UAH",
        from1000: "From 1000 UAH",
      },
      rating: {
        any: "Any",
        from40: "From 4.0 ⭐",
        from45: "From 4.5 ⭐",
        from49: "4.9+ ⭐",
      },
      distance: {
        any: "Any",
        to1km: "Up to 1 km",
        to3km: "Up to 3 km",
        myDistrict: "In my district",
      },
      availability: {
        anytime: "Anytime",
        today: "Today",
        tomorrow: "Tomorrow",
      },
    },
  },
};

interface FilterBarProps {
  lang?: "ua" | "en";
  onFilterChange?: (filters: {
    price: string;
    rating: string;
    distance: string;
    availability: string;
  }) => void;
}

export default function FilterBar({
  lang = "ua",
  onFilterChange,
}: FilterBarProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    price: "any",
    rating: "from45",
    distance: "to3km",
    availability: "today",
  });

  const t = filterTranslations[lang];

  const toggleDropdown = (name: string) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const selectOption = (
    category: keyof typeof filters,
    valueKey: string
  ) => {
    const updatedFilters = {
      ...filters,
      [category]: valueKey,
    };

    setFilters(updatedFilters);
    setActiveDropdown(null);
    onFilterChange?.(updatedFilters);
  };

  return (
    <div className="filters-inline-container">
      {/* Ціна */}
      <div className="filter-dropdown-wrapper">
        <button
          className="filter-pill"
          onClick={() => toggleDropdown("price")}
        >
          <span className="filter-label">{t.labels.price}:</span>
          <span className="filter-value">
            {t.options.price[
              filters.price as keyof typeof t.options.price
            ]}
          </span>
          <span className="filter-chevron">⌄</span>
        </button>

        {activeDropdown === "price" && (
          <div className="dropdown-menu">
            <button onClick={() => selectOption("price", "any")}>
              {t.options.price.any}
            </button>

            <button onClick={() => selectOption("price", "under500")}>
              {t.options.price.under500}
            </button>

            <button onClick={() => selectOption("price", "from500to1000")}>
              {t.options.price.from500to1000}
            </button>

            <button onClick={() => selectOption("price", "from1000")}>
              {t.options.price.from1000}
            </button>
          </div>
        )}
      </div>

      {/* Рейтинг */}
      <div className="filter-dropdown-wrapper">
        <button
          className="filter-pill"
          onClick={() => toggleDropdown("rating")}
        >
          <span className="filter-label">{t.labels.rating}:</span>
          <span className="filter-value">
            {t.options.rating[
              filters.rating as keyof typeof t.options.rating
            ]}
          </span>
          <span className="filter-chevron">⌄</span>
        </button>

        {activeDropdown === "rating" && (
          <div className="dropdown-menu">
            <button onClick={() => selectOption("rating", "any")}>
              {t.options.rating.any}
            </button>

            <button onClick={() => selectOption("rating", "from40")}>
              {t.options.rating.from40}
            </button>

            <button onClick={() => selectOption("rating", "from45")}>
              {t.options.rating.from45}
            </button>

            <button onClick={() => selectOption("rating", "from49")}>
              {t.options.rating.from49}
            </button>
          </div>
        )}
      </div>

      {/* Відстань */}
      <div className="filter-dropdown-wrapper">
        <button
          className="filter-pill"
          onClick={() => toggleDropdown("distance")}
        >
          <span className="filter-label">{t.labels.distance}:</span>
          <span className="filter-value">
            {t.options.distance[
              filters.distance as keyof typeof t.options.distance
            ]}
          </span>
          <span className="filter-chevron">⌄</span>
        </button>

        {activeDropdown === "distance" && (
          <div className="dropdown-menu">
            <button onClick={() => selectOption("distance", "any")}>
              {t.options.distance.any}
            </button>

            <button onClick={() => selectOption("distance", "to1km")}>
              {t.options.distance.to1km}
            </button>

            <button onClick={() => selectOption("distance", "to3km")}>
              {t.options.distance.to3km}
            </button>

            <button onClick={() => selectOption("distance", "myDistrict")}>
              {t.options.distance.myDistrict}
            </button>
          </div>
        )}
      </div>

      {/* Доступність */}
      <div className="filter-dropdown-wrapper">
        <button
          className="filter-pill"
          onClick={() => toggleDropdown("availability")}
        >
          <span className="filter-label">{t.labels.availability}:</span>
          <span className="filter-value">
            {t.options.availability[
              filters.availability as keyof typeof t.options.availability
            ]}
          </span>
          <span className="filter-chevron">⌄</span>
        </button>

        {activeDropdown === "availability" && (
          <div className="dropdown-menu">
            <button
              onClick={() => selectOption("availability", "anytime")}
            >
              {t.options.availability.anytime}
            </button>

            <button
              onClick={() => selectOption("availability", "today")}
            >
              {t.options.availability.today}
            </button>

            <button
              onClick={() => selectOption("availability", "tomorrow")}
            >
              {t.options.availability.tomorrow}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
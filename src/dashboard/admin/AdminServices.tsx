import React, { useEffect, useMemo, useState } from "react";
import {
  ActionButton,
  DataTable,
  Modal,
  PrimaryButton,
  SearchInput,
  Select,
  Toolbar,
} from "./AdminUI";
import { getServicesPage } from "./api/services";
import type { ServiceRow } from "./api/services";

export default function AdminServices() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [totalServices, setTotalServices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [sel, setSel] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getServicesPage(page, 15)
      .then(({ services: pageItems, count }) => {
        if (active) {
          setServices(pageItems);
          setTotalServices(count);
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [page]);

  const filteredServices = useMemo(() => {
    const search = q.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        !search ||
        service.name.toLowerCase().includes(search) ||
        service.category.toLowerCase().includes(search) ||
        service.mastersDetail.toLowerCase().includes(search);

      const matchesCategory =
        category === "All" ||
        service.category.toLowerCase().includes(category.toLowerCase());

      return matchesSearch && matchesCategory;
    });
  }, [services, q, category]);

  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(totalServices / pageSize));

  const formatMastersCount = (count: number) => {
    if (count === 1) return "1 майстер";

    const lastTwo = count % 100;
    const lastOne = count % 10;

    if (lastTwo >= 11 && lastTwo <= 14) {
      return `${count} майстрів`;
    }

    if (lastOne >= 2 && lastOne <= 4) {
      return `${count} майстри`;
    }

    return `${count} майстрів`;
  };

  const rows = useMemo(
    () =>
      filteredServices.map((service) => [
        service.name,
        service.category,
        `${service.duration} min`,
        `$${service.price.toLocaleString()}`,
        formatMastersCount(service.mastersCount),
        String(service.bookings),
      ]),
    [filteredServices]
  );

  const selected = sel == null ? null : filteredServices[sel] ?? null;

  return (
    <>
      <Toolbar
        right={
          <PrimaryButton
            disabled
            title="Backend API does not support service creation"
          >
            ＋ Add Service
          </PrimaryButton>
        }
      >
        <SearchInput
          placeholder="Search service..."
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setSel(null);
          }}
        />
        <Select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setSel(null);
          }}
        >
          <option>All</option>
          <option>Nails</option>
          <option>Lashes</option>
          <option>Brows</option>
          <option>Hair</option>
          <option>Makeup</option>
        </Select>
      </Toolbar>

      {loading && <p className="admin-info">Loading services…</p>}

      <DataTable
        columns={[
          "Name",
          "Category",
          "Duration",
          "Price",
          "Master(s)",
          "Bookings",
        ]}
        rows={loading ? [] : rows}
        selectedIndex={sel}
        onSelect={setSel}
      />

      {!loading && totalServices > pageSize && (
        <div className="admin-pagination">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => {
              setPage((value) => Math.max(0, value - 1));
              setSel(null);
            }}
          >
            ← Prev
          </button>
          <span>
            {page * pageSize + 1}–{Math.min(totalServices, page * pageSize + services.length)} of {totalServices}
          </span>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => {
              setPage((value) => Math.min(pageCount - 1, value + 1));
              setSel(null);
            }}
          >
            Next →
          </button>
        </div>
      )}

      <div className="admin-actions">
        <ActionButton
          disabled={!selected}
          onClick={() => setViewOpen(true)}
        >
          ◉ View
        </ActionButton>
        <ActionButton
          disabled
          title="Backend API does not support service editing"
        >
          ✎ Edit
        </ActionButton>
        <ActionButton
          disabled
          tone="warning"
          title="Backend API does not support service deactivation"
        >
          ⊘ Deactivate
        </ActionButton>
        <ActionButton
          disabled
          tone="danger"
          title="Backend API does not support service deletion"
        >
          ✕ Delete
        </ActionButton>
      </div>

      <Modal
        open={viewOpen && Boolean(selected)}
        title="Service Details"
        onClose={() => setViewOpen(false)}
      >
        {selected && (
          <dl className="admin-modal-details">
            <dt>Name</dt>
            <dd>{selected.name}</dd>
            <dt>Category</dt>
            <dd>{selected.category}</dd>
            <dt>Duration</dt>
            <dd>{selected.duration} min</dd>
            <dt>Price</dt>
            <dd>${selected.price.toLocaleString()}</dd>
            <dt>Master(s)</dt>
            <dd>
              <strong>{formatMastersCount(selected.mastersCount)}</strong>
              {selected.mastersDetail !== "—" && (
                <div style={{ marginTop: 6 }}>{selected.mastersDetail}</div>
              )}
            </dd>
            <dt>Bookings</dt>
            <dd>{selected.bookings}</dd>
          </dl>
        )}
      </Modal>
    </>
  );
}

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
import { getServices } from "./api/services";
import type { ServiceRow } from "./api/services";

export default function AdminServices() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [sel, setSel] = useState<number | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getServices()
      .then((data) => {
        if (active) {
          setServices(data);
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
  }, []);

  const filteredServices = useMemo(() => {
    const search = q.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        !search ||
        service.name.toLowerCase().includes(search) ||
        service.category.toLowerCase().includes(search) ||
        service.masters.toLowerCase().includes(search);

      const matchesCategory =
        category === "All" ||
        service.category.toLowerCase().includes(category.toLowerCase());

      return matchesSearch && matchesCategory;
    });
  }, [services, q, category]);

  const rows = useMemo(
    () =>
      filteredServices.map((service) => [
        service.name,
        service.category,
        `${service.duration} min`,
        `$${service.price.toLocaleString()}`,
        service.masters,
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
            <dd>{selected.masters}</dd>
            <dt>Bookings</dt>
            <dd>{selected.bookings}</dd>
          </dl>
        )}
      </Modal>
    </>
  );
}

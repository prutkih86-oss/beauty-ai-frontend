import React, { useEffect, useMemo, useState } from "react";
import {
  ActionButton,
  DataTable,
  Modal,
  ModalActions,
  ModalField,
  PrimaryButton,
  SearchInput,
  Select,
  Toolbar,
} from "./AdminUI";
import { addMaster, getMastersPage } from "./api/masters";
import type { MasterRow } from "./api/masters";

export default function AdminMasters() {
  const [masters, setMasters] = useState<MasterRow[]>([]);
  const [totalMasters, setTotalMasters] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [sel, setSel] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);

  const [name, setName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [isSolo, setIsSolo] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getMastersPage(page, 15)
      .then(({ masters: pageMasters, count }) => {
        if (active) {
          setMasters(pageMasters);
          setTotalMasters(count);
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
  }, [reload, page]);

  const filteredMasters = useMemo(() => {
    const search = q.trim().toLowerCase();

    return masters.filter((master) => {
      const matchesSearch =
        !search ||
        master.name.toLowerCase().includes(search) ||
        master.specialization.toLowerCase().includes(search) ||
        master.city.toLowerCase().includes(search);

      const matchesCategory =
        category === "All" ||
        master.specialization.toLowerCase().includes(category.toLowerCase());

      return matchesSearch && matchesCategory;
    });
  }, [masters, q, category]);

  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(totalMasters / pageSize));

  const rows = useMemo(
    () =>
      filteredMasters.map((master) => [
        master.name,
        master.specialization,
        master.rating.toFixed(1),
        master.city,
        String(master.bookings),
        `$${master.revenue.toLocaleString()}`,
        master.isSolo ? "Solo" : "Salon",
      ]),
    [filteredMasters]
  );

  const selected = sel == null ? null : filteredMasters[sel] ?? null;

  function resetAddForm() {
    setName("");
    setSpecialization("");
    setCity("");
    setAddress("");
    setIsSolo(false);
  }

  async function submitMaster(event: React.FormEvent) {
    event.preventDefault();

    if (!name.trim() || !specialization.trim() || !city.trim()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await addMaster(name, specialization, city, address, isSolo);
      setAddOpen(false);
      resetAddForm();
      setReload((value) => value + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Toolbar
        right={
          <PrimaryButton onClick={() => setAddOpen(true)}>
            ＋ Add Master
          </PrimaryButton>
        }
      >
        <SearchInput
          placeholder="Search master..."
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(0);
            setSel(null);
          }}
        />
        <Select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(0);
            setSel(null);
          }}
        >
          <option>All</option>
          <option>Brows</option>
          <option>Makeup</option>
          <option>Manicure</option>
          <option>Barber</option>
          <option>General</option>
        </Select>
      </Toolbar>

      {loading && <p className="admin-info">Loading masters…</p>}

      <DataTable
        columns={[
          "Name",
          "Specialization",
          "Rating",
          "City",
          "Bookings",
          "Revenue",
          "Type",
        ]}
        rows={loading ? [] : rows}
        selectedIndex={sel}
        onSelect={setSel}
      />

      {!loading && totalMasters > pageSize && (
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
            {page * pageSize + 1}–{Math.min(totalMasters, page * pageSize + masters.length)} of {totalMasters}
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
          title="Backend API does not support master editing"
        >
          ✎ Edit
        </ActionButton>
        
        <ActionButton
          disabled
          tone="danger"
          title="Backend API does not support blocking masters"
        >
          ⊘ Block
        </ActionButton>
      </div>

      <Modal
        open={addOpen}
        title="Add Master"
        onClose={() => setAddOpen(false)}
      >
        <form className="admin-modal-form" onSubmit={submitMaster}>
          <ModalField label="Name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </ModalField>

          <ModalField label="Specialization">
            <input
              value={specialization}
              onChange={(event) => setSpecialization(event.target.value)}
              required
            />
          </ModalField>

          <ModalField label="City">
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              required
            />
          </ModalField>

          <ModalField label="Address">
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </ModalField>

          <label className="admin-modal-check">
            <input
              type="checkbox"
              checked={isSolo}
              onChange={(event) => setIsSolo(event.target.checked)}
            />
            Solo master
          </label>

          <ModalActions>
            <ActionButton type="button" onClick={() => setAddOpen(false)}>
              Cancel
            </ActionButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add Master"}
            </PrimaryButton>
          </ModalActions>
        </form>
      </Modal>

      <Modal
        open={viewOpen && Boolean(selected)}
        title="Master Details"
        onClose={() => setViewOpen(false)}
      >
        {selected && (
          <dl className="admin-modal-details">
            <dt>Name</dt>
            <dd>{selected.name}</dd>
            <dt>Specialization</dt>
            <dd>{selected.specialization}</dd>
            <dt>Rating</dt>
            <dd>{selected.rating.toFixed(1)}</dd>
            <dt>City</dt>
            <dd>{selected.city}</dd>
            <dt>Bookings</dt>
            <dd>{selected.bookings}</dd>
            <dt>Revenue</dt>
            <dd>${selected.revenue.toLocaleString()}</dd>
            <dt>Type</dt>
            <dd>{selected.isSolo ? "Solo" : "Salon"}</dd>
          </dl>
        )}
      </Modal>
    </>
  );
}

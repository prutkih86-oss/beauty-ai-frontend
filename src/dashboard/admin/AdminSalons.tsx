import React, { useEffect, useMemo, useState } from "react";
import {
  ActionButton,
  DataTable,
  Modal,
  ModalActions,
  ModalField,
  PrimaryButton,
  SearchInput,
  Toolbar,
} from "./AdminUI";
import {
  addSalon,
  deleteSalon,
  getSalonsPage,
  updateSalon,
} from "./api/salons";
import type { SalonRow } from "./api/salons";

export default function AdminSalons() {
  const [salons, setSalons] = useState<SalonRow[]>([]);
  const [totalSalons, setTotalSalons] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState<"add" | "edit" | "view" | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getSalonsPage(page, 15)
      .then(({ salons: pageSalons, count }) => {
        if (active) {
          setSalons(pageSalons);
          setTotalSalons(count);
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

  const filteredSalons = useMemo(() => {
    const search = q.trim().toLowerCase();

    if (!search) {
      return salons;
    }

    return salons.filter(
      (salon) =>
        salon.name.toLowerCase().includes(search) ||
        salon.city.toLowerCase().includes(search) ||
        salon.address.toLowerCase().includes(search) ||
        String(salon.id).toLowerCase().includes(search)
    );
  }, [salons, q]);

  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(totalSalons / pageSize));

  const rows = useMemo(
    () =>
      filteredSalons.map((salon) => [
        String(salon.id),
        salon.name,
        salon.city,
        salon.address,
        salon.popularityScore.toFixed(1),
      ]),
    [filteredSalons]
  );

  const selected = sel == null ? null : filteredSalons[sel] ?? null;

  function openAdd() {
    setName("");
    setCity("");
    setAddress("");
    setMode("add");
  }

  function openEdit() {
    if (!selected) {
      return;
    }

    setName(selected.name);
    setCity(selected.city);
    setAddress(selected.address);
    setMode("edit");
  }

  async function submitSalon(event: React.FormEvent) {
    event.preventDefault();

    if (!name.trim() || !city.trim() || !address.trim()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (mode === "edit" && selected) {
        await updateSalon(selected.id, city, address);
      } else {
        await addSalon(name, city, address);
      }

      setMode(null);
      setSel(null);
      setReload((value) => value + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected) {
      return;
    }

    if (!window.confirm(`Delete ${selected.name}?`)) {
      return;
    }

    try {
      setError(null);
      await deleteSalon(selected.id);
      setSel(null);
      setReload((value) => value + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <Toolbar right={<PrimaryButton onClick={openAdd}>＋ Add Salon</PrimaryButton>}>
        <SearchInput
          placeholder="Search salon..."
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(0);
            setSel(null);
          }}
        />
      </Toolbar>

      {loading && <p className="admin-info">Loading salons…</p>}

      <DataTable
        columns={["ID", "Salon", "City", "Address", "Popularity"]}
        rows={loading ? [] : rows}
        selectedIndex={sel}
        onSelect={setSel}
      />

      {!loading && totalSalons > pageSize && (
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
            {page * pageSize + 1}–{Math.min(totalSalons, page * pageSize + salons.length)} of {totalSalons}
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
          onClick={() => setMode("view")}
        >
          ◉ View
        </ActionButton>
        <ActionButton disabled={!selected} onClick={openEdit}>
          ✎ Edit
        </ActionButton>
        <ActionButton
          disabled={!selected}
          tone="danger"
          onClick={removeSelected}
        >
          ✕ Delete
        </ActionButton>
      </div>

      <Modal
        open={mode === "add" || mode === "edit"}
        title={mode === "edit" ? "Edit Salon" : "Add Salon"}
        onClose={() => setMode(null)}
      >
        <form className="admin-modal-form" onSubmit={submitSalon}>
          <ModalField label="Salon name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={mode === "edit"}
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
              required
            />
          </ModalField>

          <ModalActions>
            <ActionButton type="button" onClick={() => setMode(null)}>
              Cancel
            </ActionButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : mode === "edit"
                  ? "Save Changes"
                  : "Add Salon"}
            </PrimaryButton>
          </ModalActions>
        </form>
      </Modal>

      <Modal
        open={mode === "view" && Boolean(selected)}
        title="Salon Details"
        onClose={() => setMode(null)}
      >
        {selected && (
          <dl className="admin-modal-details">
            <dt>ID</dt>
            <dd>{selected.id}</dd>
            <dt>Salon</dt>
            <dd>{selected.name}</dd>
            <dt>City</dt>
            <dd>{selected.city}</dd>
            <dt>Address</dt>
            <dd>{selected.address}</dd>
          </dl>
        )}
      </Modal>
    </>
  );
}

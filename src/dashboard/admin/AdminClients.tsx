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
import { getClientsPage } from "./api/clients";
import type { ClientRow } from "./api/clients";

const PAGE_SIZE = 15;

export default function AdminClients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [sel, setSel] = useState<number | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);
    setSel(null);

    getClientsPage(page, PAGE_SIZE)
      .then(({ clients: pageClients, count }) => {
        if (active) {
          setClients(pageClients);
          setTotalClients(count);
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

  const filteredClients = useMemo(() => {
    const search = q.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesSearch =
        !search ||
        client.name.toLowerCase().includes(search) ||
        client.city.toLowerCase().includes(search) ||
        client.acquisitionChannel.toLowerCase().includes(search);

      const matchesStatus =
        status === "All" ||
        client.status.toLowerCase() === status.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [clients, q, status]);

  const pageCount = Math.max(1, Math.ceil(totalClients / PAGE_SIZE));

  const rows = useMemo(
    () =>
      filteredClients.map((client) => [
        client.name,
        client.city,
        client.acquisitionChannel,
        String(client.bookings),
        `$${client.spent.toLocaleString()}`,
        client.lastVisit,
        client.status,
      ]),
    [filteredClients]
  );

  const selected = sel == null ? null : filteredClients[sel] ?? null;

  return (
    <>
      <Toolbar
        right={
          <PrimaryButton
            disabled
            title="Backend API does not support client creation"
          >
            ＋ Add Client
          </PrimaryButton>
        }
      >
        <SearchInput
          placeholder="Search client..."
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setSel(null);
          }}
        />
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setSel(null);
          }}
        >
          <option>All</option>
          <option>Active</option>
          <option>Inactive</option>
        </Select>
      </Toolbar>

      {loading && <p className="admin-info">Loading clients…</p>}
      {error && <p className="admin-info">{error}</p>}

      <DataTable
        columns={[
          "Name",
          "City",
          "Source",
          "Bookings",
          "Spent",
          "Last Visit",
          "Status",
        ]}
        rows={loading ? [] : rows}
        selectedIndex={sel}
        onSelect={setSel}
      />

      {!loading && totalClients > PAGE_SIZE && (
        <div className="admin-pagination">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            ← Prev
          </button>

          <span>
            {page * PAGE_SIZE + 1}–
            {Math.min(totalClients, page * PAGE_SIZE + clients.length)} of{" "}
            {totalClients}
          </span>

          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() =>
              setPage((value) => Math.min(pageCount - 1, value + 1))
            }
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
          title="Backend API does not support client editing"
        >
          ✎ Edit
        </ActionButton>
        <ActionButton
          disabled
          title="No separate client bookings action is exposed by this API adapter"
        >
          □ Bookings
        </ActionButton>
        <ActionButton
          disabled
          tone="danger"
          title="Backend API does not support client deletion"
        >
          ✕ Delete
        </ActionButton>
      </div>

      <Modal
        open={viewOpen && Boolean(selected)}
        title="Client Details"
        onClose={() => setViewOpen(false)}
      >
        {selected && (
          <dl className="admin-modal-details">
            <dt>Name</dt>
            <dd>{selected.name}</dd>
            <dt>City</dt>
            <dd>{selected.city}</dd>
            <dt>Source</dt>
            <dd>{selected.acquisitionChannel}</dd>
            <dt>Bookings</dt>
            <dd>{selected.bookings}</dd>
            <dt>Spent</dt>
            <dd>${selected.spent.toLocaleString()}</dd>
            <dt>Last Visit</dt>
            <dd>{selected.lastVisit}</dd>
            <dt>Status</dt>
            <dd>{selected.status}</dd>
          </dl>
        )}
      </Modal>
    </>
  );
}

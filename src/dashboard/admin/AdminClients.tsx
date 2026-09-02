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
import { getClients } from "./api/clients";
import type { ClientRow } from "./api/clients";

export default function AdminClients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [sel, setSel] = useState<number | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getClients()
      .then((data) => {
        if (active) {
          setClients(data);
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

import React, { useEffect, useMemo, useState } from "react";
import {
  ActionButton,
  DataTable,
  Modal,
  SearchInput,
  Select,
  Toolbar,
} from "./AdminUI";
import { getBookingsPage } from "./api/bookings";
import type { BookingRow } from "./api/bookings";

export default function AdminBookings() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [sel, setSel] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getBookingsPage(page, 15)
      .then(({ bookings: pageItems, count }) => {
        if (active) {
          setBookings(pageItems);
          setTotalBookings(count);
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

  const filteredBookings = useMemo(() => {
    const search = q.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesSearch =
        !search ||
        String(booking.id).toLowerCase().includes(search) ||
        booking.clientName.toLowerCase().includes(search) ||
        booking.masterName.toLowerCase().includes(search) ||
        booking.serviceName.toLowerCase().includes(search) ||
        booking.salonName.toLowerCase().includes(search);

      const matchesStatus =
        status === "All" ||
        booking.status.toLowerCase() === status.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [bookings, q, status]);

  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(totalBookings / pageSize));

  const rows = useMemo(
    () =>
      filteredBookings.map((booking) => [
        String(booking.id),
        booking.clientName,
        booking.masterName,
        booking.serviceName,
        booking.salonName,
        booking.dateTime,
        `$${booking.price.toLocaleString()}`,
        booking.status,
      ]),
    [filteredBookings]
  );

  const selected = sel == null ? null : filteredBookings[sel] ?? null;

  return (
    <>
      <Toolbar>
        <SearchInput
          placeholder="Search booking..."
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
          <option>Pending</option>
          <option>Confirmed</option>
          <option>Completed</option>
          <option>Cancelled</option>
          <option>No-show</option>
        </Select>
      </Toolbar>

      {loading && <p className="admin-info">Loading bookings…</p>}

      <DataTable
        columns={[
          "ID",
          "Client",
          "Master",
          "Service",
          "Salon",
          "Date / Time",
          "Price",
          "Status",
        ]}
        rows={loading ? [] : rows}
        selectedIndex={sel}
        onSelect={setSel}
      />

      {!loading && totalBookings > pageSize && (
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
            {page * pageSize + 1}–{Math.min(totalBookings, page * pageSize + bookings.length)} of {totalBookings}
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
          title="Backend API does not support booking status updates yet"
        >
          ✎ Edit
        </ActionButton>
        <ActionButton
          disabled
          title="Backend API does not support booking status updates yet"
          tone="warning"
        >
          ↺ Reschedule
        </ActionButton>
        <ActionButton
          disabled
          title="Backend API does not support booking deletion yet"
          tone="danger"
        >
          ✕ Cancel
        </ActionButton>
      </div>

      <Modal
        open={viewOpen && Boolean(selected)}
        title="Booking Details"
        onClose={() => setViewOpen(false)}
      >
        {selected && (
          <dl className="admin-modal-details">
            <dt>ID</dt>
            <dd>{selected.id}</dd>
            <dt>Client</dt>
            <dd>{selected.clientName}</dd>
            <dt>Master</dt>
            <dd>{selected.masterName}</dd>
            <dt>Service</dt>
            <dd>{selected.serviceName}</dd>
            <dt>Salon</dt>
            <dd>{selected.salonName}</dd>
            <dt>Date / Time</dt>
            <dd>{selected.dateTime}</dd>
            <dt>Price</dt>
            <dd>${selected.price.toLocaleString()}</dd>
            <dt>Status</dt>
            <dd>{selected.status}</dd>
          </dl>
        )}
      </Modal>
    </>
  );
}

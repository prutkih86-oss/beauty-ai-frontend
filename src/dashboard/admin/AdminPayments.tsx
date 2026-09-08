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
import {
  addPayment,
  deletePayment,
  getPaymentsPage,
} from "./api/payments";
import type { PaymentRow } from "./api/payments";

export default function AdminPayments() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [totalPayments, setTotalPayments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [method, setMethod] = useState("All");
  const [date, setDate] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getPaymentsPage(page, 15)
      .then(({ payments: pageItems, count }) => {
        if (active) {
          setPayments(pageItems);
          setTotalPayments(count);
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

  const filteredPayments = useMemo(() => {
    const search = q.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesSearch =
        !search ||
        payment.client.toLowerCase().includes(search) ||
        String(payment.bookingId).toLowerCase().includes(search) ||
        String(payment.id).toLowerCase().includes(search);

      const matchesMethod =
        method === "All" ||
        payment.method.toLowerCase() === method.toLowerCase();

      const matchesDate = !date || payment.date === date;

      return matchesSearch && matchesMethod && matchesDate;
    });
  }, [payments, q, method, date]);

  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(totalPayments / pageSize));

  const rows = useMemo(
    () =>
      filteredPayments.map((payment) => [
        String(payment.id),
        payment.client,
        String(payment.bookingId),
        `$${payment.amount.toLocaleString()}`,
        payment.method,
        payment.date,
      ]),
    [filteredPayments]
  );

  const selected = sel == null ? null : filteredPayments[sel] ?? null;

  async function submitPayment(event: React.FormEvent) {
    event.preventDefault();

    const numericAmount = Number(amount);

    if (!bookingId.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await addPayment(bookingId.trim(), numericAmount, paymentMethod);
      setAddOpen(false);
      setBookingId("");
      setAmount("");
      setPaymentMethod("Cash");
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

    if (!window.confirm(`Delete payment #${selected.id}?`)) {
      return;
    }

    try {
      setError(null);
      await deletePayment(selected.id);
      setSel(null);
      setReload((value) => value + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <Toolbar
        right={
          <PrimaryButton onClick={() => setAddOpen(true)}>
            ＋ Add Payment
          </PrimaryButton>
        }
      >
        <SearchInput
          placeholder="Search payment..."
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setSel(null);
          }}
        />
        <Select
          value={method}
          onChange={(event) => {
            setMethod(event.target.value);
            setSel(null);
          }}
        >
          <option>All</option>
          <option>Card</option>
          <option>Cash</option>
          <option>Apple Pay</option>
          <option>Google Pay</option>
        </Select>
        <SearchInput
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setSel(null);
          }}
        />
      </Toolbar>

      {loading && <p className="admin-info">Loading payments…</p>}

      <DataTable
        columns={["ID", "Client", "Booking", "Amount", "Method", "Date"]}
        rows={loading ? [] : rows}
        selectedIndex={sel}
        onSelect={setSel}
      />

      {!loading && totalPayments > pageSize && (
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
            {page * pageSize + 1}–{Math.min(totalPayments, page * pageSize + payments.length)} of {totalPayments}
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
          title="Backend API does not support payment editing"
        >
          ✎ Edit
        </ActionButton>
        <ActionButton
          disabled
          tone="warning"
          title="Backend API does not expose a refund action"
        >
          ↶ Refund
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
        open={addOpen}
        title="Add Payment"
        onClose={() => setAddOpen(false)}
      >
        <form className="admin-modal-form" onSubmit={submitPayment}>
          <ModalField label="Booking ID">
            <input
              value={bookingId}
              onChange={(event) => setBookingId(event.target.value)}
              required
            />
          </ModalField>

          <ModalField label="Amount">
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </ModalField>

          <ModalField label="Payment method">
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option>Cash</option>
              <option>Card</option>
              <option>Apple Pay</option>
              <option>Google Pay</option>
            </select>
          </ModalField>

          <ModalActions>
            <ActionButton type="button" onClick={() => setAddOpen(false)}>
              Cancel
            </ActionButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add Payment"}
            </PrimaryButton>
          </ModalActions>
        </form>
      </Modal>

      <Modal
        open={viewOpen && Boolean(selected)}
        title="Payment Details"
        onClose={() => setViewOpen(false)}
      >
        {selected && (
          <dl className="admin-modal-details">
            <dt>ID</dt>
            <dd>{selected.id}</dd>
            <dt>Client</dt>
            <dd>{selected.client}</dd>
            <dt>Booking</dt>
            <dd>{selected.bookingId}</dd>
            <dt>Amount</dt>
            <dd>${selected.amount.toLocaleString()}</dd>
            <dt>Method</dt>
            <dd>{selected.method}</dd>
            <dt>Date</dt>
            <dd>{selected.date}</dd>
          </dl>
        )}
      </Modal>
    </>
  );
}

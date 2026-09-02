import React, { useEffect, useMemo, useState } from "react";
import {
  ActionButton,
  DataTable,
  Modal,
  SearchInput,
  Select,
  Toolbar,
} from "./AdminUI";
import { deleteReview, getReviews } from "./api/reviews";
import type { ReviewRow } from "./api/reviews";

export default function AdminReviews() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [rating, setRating] = useState("All");
  const [sel, setSel] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getReviews()
      .then((data) => {
        if (active) {
          setReviews(data);
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
  }, [reload]);

  const filteredReviews = useMemo(() => {
    const search = q.trim().toLowerCase();

    return reviews.filter((review) => {
      const matchesSearch =
        !search ||
        review.client.toLowerCase().includes(search) ||
        review.master.toLowerCase().includes(search) ||
        review.service.toLowerCase().includes(search) ||
        String(review.id).toLowerCase().includes(search);

      const matchesRating =
        rating === "All" || String(review.rating) === rating;

      return matchesSearch && matchesRating;
    });
  }, [reviews, q, rating]);

  const rows = useMemo(
    () =>
      filteredReviews.map((review) => [
        String(review.id),
        review.client,
        review.master,
        review.service,
        String(review.rating),
        review.date,
      ]),
    [filteredReviews]
  );

  const selected = sel == null ? null : filteredReviews[sel] ?? null;

  async function removeSelected() {
    if (!selected) {
      return;
    }

    if (!window.confirm(`Delete review #${selected.id}?`)) {
      return;
    }

    try {
      setError(null);
      await deleteReview(selected.id);
      setSel(null);
      setReload((value) => value + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <Toolbar>
        <SearchInput
          placeholder="Search review..."
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setSel(null);
          }}
        />
        <Select
          value={rating}
          onChange={(event) => {
            setRating(event.target.value);
            setSel(null);
          }}
        >
          <option>All</option>
          <option>5</option>
          <option>4</option>
          <option>3</option>
          <option>2</option>
          <option>1</option>
        </Select>
      </Toolbar>

      {loading && <p className="admin-info">Loading reviews…</p>}

      <DataTable
        columns={["ID", "Client", "Master", "Service", "Rating", "Date"]}
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
          tone="warning"
          title="Backend API does not support hiding reviews"
        >
          ◌ Hide
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
        open={viewOpen && Boolean(selected)}
        title="Review Details"
        onClose={() => setViewOpen(false)}
      >
        {selected && (
          <dl className="admin-modal-details">
            <dt>ID</dt>
            <dd>{selected.id}</dd>
            <dt>Client</dt>
            <dd>{selected.client}</dd>
            <dt>Master</dt>
            <dd>{selected.master}</dd>
            <dt>Service</dt>
            <dd>{selected.service}</dd>
            <dt>Rating</dt>
            <dd>{selected.rating}</dd>
            <dt>Date</dt>
            <dd>{selected.date}</dd>
          </dl>
        )}
      </Modal>
    </>
  );
}

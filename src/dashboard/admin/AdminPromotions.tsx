import React, { useEffect, useState } from "react";
import { addPromotion, getPromotions, type Promotion } from "./api/promotions";

export default function AdminPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discount, setDiscount] = useState("");
  const [salonId, setSalonId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function load() {
    setLoading(true);
    try {
      setPromotions(await getPromotions());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setName("");
    setDescription("");
    setDiscount("");
    setSalonId("");
    setStartDate("");
    setEndDate("");
  }

  async function submitPromotion(event: React.FormEvent) {
    event.preventDefault();

    if (!name.trim() || !discount || !salonId || !startDate || !endDate) return;

    try {
      setSaving(true);
      setError(null);

      await addPromotion({
        name: name.trim(),
        description: description.trim(),
        discount_percent: Number(discount),
        salon: Number(salonId),
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
      });

      setAddOpen(false);
      resetForm();
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-promotions">
      <section className="admin-panel-v3">
        <div className="admin-panel-head-v3">
          <div><h2>Promotions</h2></div>

          <div className="admin-section-head-actions-v3">
            <small>{promotions.length} records</small>
            <button
              type="button"
              className="admin-website-action-v3"
              onClick={() => setAddOpen(true)}
            >
              + Add Promotion
            </button>
          </div>
        </div>

        {error && <div className="admin-empty-v3">{error}</div>}

        <div className="admin-table-scroll-v3">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Discount</th>
                <th>Salon ID</th>
                <th>Start</th>
                <th>End</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((promotion) => (
                <tr key={promotion.id}>
                  <td>{promotion.name}</td>
                  <td>{promotion.discount_percent}%</td>
                  <td>#{promotion.salon}</td>
                  <td>{new Date(promotion.start_date).toLocaleDateString()}</td>
                  <td>{new Date(promotion.end_date).toLocaleDateString()}</td>
                </tr>
              ))}

              {!promotions.length && (
                <tr>
                  <td colSpan={5} className="admin-empty-v3">
                    {loading ? "Loading promotions…" : "No promotions"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {addOpen && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
                <div>
                <h2>Add Promotion</h2>
                <p>Create a new salon promotion</p>
                </div>
                <button className="admin-modal-close" type="button" onClick={() => setAddOpen(false)}>×</button>
            </div>

            <div className="admin-modal-body">
                <form className="admin-modal-form" onSubmit={submitPromotion}>
              <label className="admin-modal-field">
                <span>Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>

              <label className="admin-modal-field">
                <span>Salon ID</span>
                <input type="number" min="1" value={salonId} onChange={(e) => setSalonId(e.target.value)} required />
              </label>

              <label className="admin-modal-field">
                <span>Discount %</span>
                <input type="number" min="1" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)} required />
              </label>

              <label className="admin-modal-field">
                <span>Start date</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </label>

              <label className="admin-modal-field">
                <span>End date</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </label>

              <label className="admin-modal-field">
                <span>Description</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>

              <div className="admin-modal-actions">
                <button
                    type="button"
                    className="admin-action-btn"
                    onClick={() => { setAddOpen(false); resetForm(); }}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="admin-primary-btn"
                    disabled={saving}
                >
                    {saving ? "Adding..." : "Add Promotion"}
                </button>
                </div>
            </form>
          </div>
        </div>
    </div>
    )}
    </div>
  );
}
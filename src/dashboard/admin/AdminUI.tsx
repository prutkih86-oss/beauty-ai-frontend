import React from "react";
import "../styles/admin-modal.css";

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="admin-page-title">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

export function KpiCard({
  title,
  value,
  icon,
  trend,
  positive,
}: {
  title: string;
  value: string;
  icon: string;
  trend?: string;
  positive?: boolean;
}) {
  return (
    <article className="admin-kpi-card">
      <span className="admin-kpi-title">{title}</span>
      <div className="admin-kpi-main">
        <span className="admin-kpi-icon">{icon}</span>
        <strong>{value}</strong>
        {trend && (
          <span className={`admin-kpi-trend ${positive ? "positive" : ""}`}>
            {trend}
          </span>
        )}
      </div>
    </article>
  );
}

export function Toolbar({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="admin-toolbar">
      <div className="admin-toolbar-left">{children}</div>
      {right && <div className="admin-toolbar-right">{right}</div>}
    </div>
  );
}

export function SearchInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return (
    <input
      {...props}
      className={`admin-input ${props.className || ""}`}
    />
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement>
) {
  return (
    <select
      {...props}
      className={`admin-select ${props.className || ""}`}
    />
  );
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`admin-primary-btn ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

export function ActionButton({
  children,
  tone = "normal",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "normal" | "danger" | "warning";
}) {
  return (
    <button
      {...props}
      className={`admin-action-btn ${tone}`}
    >
      {children}
    </button>
  );
}

export function DataTable({
  columns,
  rows,
  selectedIndex,
  onSelect,
}: {
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}) {
  return (
    <div className="admin-table-card">
      <table className="admin-data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={selectedIndex === rowIndex ? "selected" : ""}
                onClick={() => onSelect?.(rowIndex)}
              >
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="admin-empty">
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="admin-modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="admin-modal-body">{children}</div>
      </section>
    </div>
  );
}

export function ModalField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="admin-modal-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ModalActions({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="admin-modal-actions">{children}</div>;
}

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Shared design system. Lives in the core repo, so every module gets identical
 * look and feel without depending on any other module.
 * Modules import it as `@shell/ui.jsx`.
 */

export function Card({ title, actions, children }) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-head">
          <h2>{title}</h2>
          <div className="row">{actions}</div>
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

export function Table({ columns, rows, empty = 'Nothing yet.' }) {
  if (!rows?.length) return <p className="muted">{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row._id || row.id || i}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Button({ children, variant = 'primary', ...rest }) {
  return <button className={`btn btn-${variant}`} {...rest}>{children}</button>;
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Money({ paise }) {
  return <span className="money">₹{(Number(paise || 0) / 100).toFixed(2)}</span>;
}

export function Notice({ tone = 'info', children }) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}

/**
 * Modal dialog, rendered through a portal so it escapes any card's stacking
 * context. Closes on Escape and on a backdrop click, and locks background
 * scrolling while open.
 *
 * size: 'sm' | 'md' | 'lg' | 'full'
 */
export function Modal({ open, title, subtitle, onClose, footer, size = 'md', children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="modal-sub">{subtitle}</p>}
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/** Small confirmation dialog — used for destructive or irreversible actions. */
export function Confirm({ open, title, message, confirmLabel = 'Confirm', tone = 'primary', onConfirm, onClose }) {
  return (
    <Modal
      open={open}
      title={title}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={tone} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}

/** Labelled form control. */
export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** A selectable row — used for permission grids, but generic. */
export function CheckRow({ checked, disabled, onChange, code, label }) {
  return (
    <label className={`check-row${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
      <span className="check-code">{code}</span>
      <span className="check-label">{label}</span>
    </label>
  );
}

/** Section heading inside a modal or card. */
export function GroupLabel({ children, count }) {
  return (
    <div className="group-label">
      {children}{count !== undefined && <span className="group-count">{count}</span>}
    </div>
  );
}

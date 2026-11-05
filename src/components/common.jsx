import { SUBJECT_COLORS } from '../utils/defaults';

export function Modal({ title, onClose, children, footer, size }) {
  return (
    <>
      <div
        className="modal d-block"
        tabIndex="-1"
        role="dialog"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className={`modal-dialog modal-dialog-scrollable ${size ? 'modal-' + size : ''}`}>
          <div className="modal-content shadow-lg border-0">
            <div className="modal-header">
              <h5 className="modal-title fw-bold">{title}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" style={{ opacity: 0.5 }} />
    </>
  );
}

export function ConfirmModal({ show, title, message, confirmText = 'Confirm', confirmVariant = 'danger', onConfirm, onCancel }) {
  if (!show) return null;
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className={`btn btn-${confirmVariant}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </>
      }
    >
      <p className="mb-0">{message}</p>
    </Modal>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-4">
      <div>
        <h1 className="page-title mb-0">{title}</h1>
        {subtitle && <p className="text-secondary mb-0 mt-1">{subtitle}</p>}
      </div>
      <div className="d-flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, variant = 'primary', height = 8, label, customColor }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  const style = { width: v + '%' };
  if (customColor) style.backgroundColor = customColor;

  return (
    <div
      className="progress"
      style={{ height, backgroundColor: 'rgba(128,128,128,0.15)' }}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label={label || 'progress'}
    >
      <div
        className={`progress-bar ${customColor ? '' : 'bg-' + variant}`}
        style={style}
      />
    </div>
  );
}

export function StatCard({ icon, label, value, hint, tone = 'primary' }) {
  return (
    <div className="card h-100 stat-card">
      <div className="card-body d-flex align-items-center gap-3">
        <div className={`stat-icon text-bg-${tone}`}>
          <i className={`bi bi-${icon}`} />
        </div>
        <div className="flex-grow-1 min-w-0">
          <div className="stat-value">{value}</div>
          <div className="text-secondary small text-truncate">{label}</div>
          {hint && <div className="small text-secondary mt-0 text-truncate">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

export function Empty({ icon = 'inbox', children }) {
  return (
    <div className="text-center text-secondary py-4">
      <i className={`bi bi-${icon} fs-2 d-block mb-2 opacity-50`} />
      <div>{children}</div>
    </div>
  );
}

export function Field({ label, children, className = 'col-12', help }) {
  return (
    <div className={className}>
      {label && <label className="form-label small fw-semibold mb-1">{label}</label>}
      {children}
      {help && <div className="form-text mt-1">{help}</div>}
    </div>
  );
}

export function SubjectColorBadge({ color, name, code, className = '' }) {
  return (
    <span
      className={`badge d-inline-flex align-items-center gap-1 ${className}`}
      style={{
        backgroundColor: color || '#0f766e',
        color: '#ffffff',
        fontWeight: 600,
        fontSize: '0.75rem',
        padding: '0.3em 0.55em',
        letterSpacing: '0.02em',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          display: 'inline-block',
        }}
      />
      {code ? `${code}` : name}
    </span>
  );
}

export function ColorSwatchSelector({ value, onChange }) {
  return (
    <div className="d-flex flex-wrap gap-2 align-items-center">
      {SUBJECT_COLORS.map((c) => {
        const isSelected = value === c.hex;
        return (
          <button
            key={c.hex}
            type="button"
            className="btn p-0 rounded-circle border-0 position-relative"
            style={{
              width: 28,
              height: 28,
              backgroundColor: c.hex,
              boxShadow: isSelected ? `0 0 0 3px var(--bs-body-bg), 0 0 0 5px ${c.hex}` : 'none',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
            title={c.label}
            aria-label={`Color ${c.label}`}
            onClick={() => onChange(c.hex)}
          >
            {isSelected && (
              <i className="bi bi-check-lg text-white position-absolute top-50 start-50 translate-middle" style={{ fontSize: '0.85rem' }} />
            )}
          </button>
        );
      })}
      <input
        type="color"
        className="form-control form-control-color p-0 border-0 ms-1"
        style={{ width: 28, height: 28, cursor: 'pointer' }}
        value={value || '#2563eb'}
        onChange={(e) => onChange(e.target.value)}
        title="Custom color"
      />
    </div>
  );
}

export const DIFF_TONE = { Easy: 'success', Medium: 'warning', Hard: 'danger' };
export const PRIORITY_TONE = { Low: 'secondary', Medium: 'warning', High: 'danger' };

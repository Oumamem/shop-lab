import { useEffect, useId, useRef, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Calendar date picker. Dates before `min` or after `max` (ISO yyyy-mm-dd) are disabled.
export default function DatePicker({ label, value, onChange, min, max, error, describedBy }) {
  const [open, setOpen] = useState(false);
  const minDate = min ? fromIso(min) : null;
  const maxDate = max ? fromIso(max) : null;
  const initial = value ? fromIso(value) : minDate || new Date();
  const [view, setView] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [focused, setFocused] = useState(initial);
  const id = useId();
  const rootRef = useRef(null);
  const gridRef = useRef(null);

  const isDisabled = (d) => (minDate && d < minDate) || (maxDate && d > maxDate);

  useEffect(() => {
    if (!open) return;
    const start = value ? fromIso(value) : minDate || new Date();
    setFocused(start);
    setView(new Date(start.getFullYear(), start.getMonth(), 1));
    const onDocClick = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) gridRef.current?.querySelector(`[data-date="${toIso(focused)}"]`)?.focus();
  }, [open, focused, view]);

  const moveFocus = (d) => {
    setFocused(d);
    if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) setView(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const onGridKey = (e) => {
    const rtl = document.documentElement.dir === 'rtl';
    const moves = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in moves) {
      e.preventDefault();
      moveFocus(addDays(focused, moves[e.key]));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  const select = (d) => {
    if (isDisabled(d)) return;
    onChange(toIso(d));
    setOpen(false);
  };

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i - first.getDay()));
  const monthLabel = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const displayValue = value ? fromIso(value).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <div className="datepicker" ref={rootRef}>
      <label htmlFor={`${id}-input`}>{label}</label>
      <div className="datepicker-control">
        <input id={`${id}-input`} type="text" readOnly value={displayValue} placeholder="No date selected" aria-invalid={error ? true : undefined} aria-describedby={describedBy} onClick={() => setOpen(true)} />
        <button type="button" className="btn btn-secondary" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          Choose date
        </button>
      </div>
      {open && (
        <div className="calendar" role="dialog" aria-modal="false" aria-label="Choose delivery date">
          <div className="calendar-header">
            <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
              ‹
            </button>
            <h3 aria-live="polite">{monthLabel}</h3>
            <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
              ›
            </button>
          </div>
          <table role="grid" aria-label={monthLabel} ref={gridRef} onKeyDown={onGridKey}>
            <thead>
              <tr>
                {WEEKDAYS.map((d) => (
                  <th key={d} scope="col">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }, (_, week) => (
                <tr key={week}>
                  {days.slice(week * 7, week * 7 + 7).map((d) => {
                    const iso = toIso(d);
                    const outside = d.getMonth() !== view.getMonth();
                    const disabled = isDisabled(d);
                    return (
                      <td key={iso} role="gridcell" aria-selected={iso === value}>
                        <button
                          type="button"
                          data-date={iso}
                          className={`day ${outside ? 'outside' : ''} ${iso === value ? 'selected' : ''} ${iso === toIso(new Date()) ? 'today' : ''}`}
                          aria-label={d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          disabled={disabled}
                          tabIndex={iso === toIso(focused) ? 0 : -1}
                          onClick={() => select(d)}
                        >
                          {d.getDate()}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

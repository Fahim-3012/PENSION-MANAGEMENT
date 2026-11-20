import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Clock, X } from "lucide-react";

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-header__sub">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

/** Tab list. tabs: [{ value, label, count? }] */
export function Tabs({ tabs, value, onChange, label = "Tabs" }) {
  const onKey = (e, i) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    e.currentTarget.parentElement.children[next]?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, i) => (
        <button
          key={tab.value}
          role="tab"
          type="button"
          className="tab"
          aria-selected={value === tab.value}
          tabIndex={value === tab.value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {tab.label}
          {tab.count > 0 && <span className="tab__count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Progress indicator for multi-step forms. */
export function Stepper({ steps, current }) {
  return (
    <ol className="stepper" aria-label="Progress">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={s} className={`stepper__item stepper__item--${state}`} aria-current={state === "current" ? "step" : undefined}>
            <div className="stepper__bar"><span /></div>
            <span className="stepper__label">{i + 1}. {s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Vertical status timeline. items: [{ title, time?, description?, state: done|current|pending|failed }] */
export function Timeline({ items }) {
  return (
    <ol className="timeline">
      {items.map((item, i) => (
        <li key={i} className={`timeline__item timeline__item--${item.state}`}>
          <span className="timeline__dot" aria-hidden>
            {item.state === "done" ? <Check size={16} /> : item.state === "failed" ? <X size={16} /> : <Clock size={15} />}
          </span>
          <div>
            <div className="timeline__title">{item.title}</div>
            {item.time && <div className="timeline__time">{item.time}</div>}
            {item.description && <div className="timeline__desc">{item.description}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Dropdown menu with outside-click and Escape handling. `trigger` is a render fn receiving props for the button. */
export function Dropdown({ trigger, children, menuClassName = "", align = "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      {trigger({ onClick: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu" })}
      <AnimatePresence>
        {open && (
          <motion.div
            className={`dropdown__menu ${menuClassName}`}
            style={align === "left" ? { left: 0, right: "auto" } : undefined}
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
          >
            {typeof children === "function" ? children(() => setOpen(false)) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Skeleton } from "./Feedback";

export function Card({ title, subtitle, actions, children, className = "", bodyClass = "", flush = false, hover = false, as: Tag = "section", ...props }) {
  return (
    <Tag className={`card ${hover ? "card--hover" : ""} ${className}`} {...props}>
      {(title || actions) && (
        <header className="card__header">
          <div>
            {title && <h2 className="card__title">{title}</h2>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      <div className={`${flush ? "card__body--flush" : "card__body"} ${bodyClass}`}>{children}</div>
    </Tag>
  );
}

/** Summary metric card with icon; becomes a link when `to` is provided. */
export function StatCard({ label, value, icon: Icon, tone = "primary", hint, loading, to, index = 0 }) {
  const inner = (
    <>
      {Icon && (
        <div className={`stat-card__icon stat-card__icon--${tone}`} aria-hidden>
          <Icon size={22} />
        </div>
      )}
      <div className="grow">
        <div className="stat-card__label">{label}</div>
        {loading ? <Skeleton height={28} width="70%" style={{ marginTop: 6 }} /> : <div className="stat-card__value">{value}</div>}
        {hint && !loading && <div className="stat-card__hint">{hint}</div>}
      </div>
    </>
  );
  return (
    <motion.div
      className="card card--hover"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
    >
      {to ? <Link to={to} className="stat-card">{inner}</Link> : <div className="stat-card">{inner}</div>}
    </motion.div>
  );
}

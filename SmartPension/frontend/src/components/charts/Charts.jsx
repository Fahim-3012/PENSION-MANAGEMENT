import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "../../context/PreferencesContext";

// Categorical order validated for colour-vision deficiency (green, gold, blue, rust, violet). Fixed order, never cycled.
export const SERIES_COLORS = ["#168568", "#C8902E", "#2F6FB0", "#C2562F", "#7A5BB0"];

function MoneyTooltip({ active, payload, label, series, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{label}</div>
      {series.map((s, i) => {
        const p = payload.find((x) => x.dataKey === s.key);
        return (
          <div key={s.key} className="row" style={{ gap: 8 }}>
            <span className="chart-legend__swatch" style={{ background: s.color || SERIES_COLORS[i] }} />
            <span className="text-muted">{s.label}</span>
            <strong className="mono" style={{ marginLeft: "auto" }}>{format(p?.value ?? 0)}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function Legend({ series }) {
  return (
    <div className="chart-legend" aria-hidden>
      {series.map((s, i) => (
        <span key={s.key}><span className="chart-legend__swatch" style={{ background: s.color || SERIES_COLORS[i] }} />{s.label}</span>
      ))}
    </div>
  );
}

/**
 * Grouped bar chart over a categorical x-axis (months or years).
 * series: [{ key, label, color? }]. Values are money unless `format` is passed.
 */
export function GroupedBarChart({ data, xKey = "label", series, height = 280, format }) {
  const { formatMoney, formatNumber } = useI18n();
  const fmt = format || formatMoney;
  const compact = (v) => (Math.abs(v) >= 1000 ? `${formatNumber(Math.round(v / 1000))}k` : formatNumber(v));
  return (
    <div className="stack-sm">
      <Legend series={series} />
      <div style={{ width: "100%", height }} role="img" aria-label={series.map((s) => s.label).join(", ")}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#e6eeeb" />
            <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: "#c6d3ce" }} tick={{ fill: "#5b6b66", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#5b6b66", fontSize: 12 }} tickFormatter={compact} width={48} />
            <Tooltip cursor={{ fill: "rgba(16,60,53,0.05)" }} content={<MoneyTooltip series={series} format={fmt} />} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color || SERIES_COLORS[i]} radius={[4, 4, 0, 0]} maxBarSize={28} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Donut with a direct-labelled legend (name, count, share) so identity never relies on colour alone. */
export function DonutChart({ data, height = 220, labelFor = (n) => n }) {
  const { formatNumber } = useI18n();
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="text-muted text-sm">—</p>;
  return (
    <div className="row" style={{ alignItems: "center", gap: 20 }}>
      <div style={{ width: height, height, flexShrink: 0 }} role="img" aria-label={data.map((d) => `${labelFor(d.name)} ${d.value}`).join(", ")}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" stroke="#fff" strokeWidth={2} paddingAngle={1}>
              {data.map((d, i) => <Cell key={d.name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [formatNumber(v), labelFor(n)]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="stack-sm grow" style={{ listStyle: "none", margin: 0, padding: 0, minWidth: 160 }}>
        {data.map((d, i) => (
          <li key={d.name} className="row-between text-sm">
            <span><span className="chart-legend__swatch" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />{labelFor(d.name)}</span>
            <span className="mono fw-600">{formatNumber(d.value)} <span className="text-muted">({Math.round((d.value / total) * 100)}%)</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

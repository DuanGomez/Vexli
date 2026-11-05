import { cop } from './format';

/** Barras verticales simples con etiqueta abajo y valor al pasar el mouse. */
export function Bars({ data, height = 180, color = 'var(--brand)', highlightLast = false }: { data: { label: string; value: number; title?: string }[]; height?: number; color?: string; highlightLast?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars" style={{ height }}>
      {data.map((d, i) => (
        <div className="bar" key={i} title={d.title ?? `${d.label}: ${cop(d.value)}`}>
          <i style={{ height: `${(d.value / max) * 100}%`, background: highlightLast && i === data.length - 1 ? 'var(--ink)' : color }} />
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Dona con porcentajes (medios de pago, categorías). */
export function Donut({ parts, size = 150 }: { parts: { label: string; value: number; color: string }[]; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = 15.915;
  let offset = 25;
  return (
    <div className="donut">
      <svg viewBox="0 0 42 42" width={size} height={size} aria-hidden="true">
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--soft)" strokeWidth="6" />
        {parts.map((p) => {
          const pct = (p.value / total) * 100;
          const el = <circle key={p.label} cx="21" cy="21" r={r} fill="none" stroke={p.color} strokeWidth="6" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />;
          offset -= pct;
          return el;
        })}
      </svg>
      <ul>
        {parts.map((p) => (
          <li key={p.label}>
            <i style={{ background: p.color }} />
            <span>{p.label}</span>
            <b className="num">{Math.round((p.value / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Línea con área (tendencia de ventas). */
export function Trend({ values, height = 70, color = 'var(--brand)' }: { values: number[]; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 100 - (v / max) * 92]);
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <svg className="trend" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      <polygon points={`0,100 ${line} 100,100`} fill={color} opacity="0.12" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

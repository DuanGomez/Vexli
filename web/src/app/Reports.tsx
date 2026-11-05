import { useState } from 'react';
import { api, download } from '../lib/api';
import { Bars, Donut, Trend } from '../lib/charts';
import { addDays, cop, num, parse, shortDate, today, ymd } from '../lib/format';
import { METHOD_LABEL } from '../lib/types';
import { Loading, useData, useToast } from '../lib/ui';
import './pages.css';

interface Report {
  start: string;
  end: string;
  total: number;
  profit: number;
  margin: number;
  count: number;
  average: number;
  discounts: number;
  by_method: { efectivo: number; transferencia: number; tarjeta: number };
  daily: { date: string; total: number; profit: number; count: number }[];
  by_category: { name: string; color: string; total: number; profit: number }[];
  top: { name: string; unit: string; qty: number; total: number; profit: number }[];
  by_weekday: { weekday: number; total: number }[];
}

const RANGES = [
  { key: '7', label: '7 días', days: 7 },
  { key: '30', label: '30 días', days: 30 },
  { key: 'mes', label: 'Este mes', days: 0 },
];
const WD = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function Reports() {
  const toast = useToast();
  const [range, setRange] = useState('30');
  const t = today();
  const r = RANGES.find((x) => x.key === range)!;
  const start = r.days ? ymd(addDays(t, -(r.days - 1))) : ymd(new Date(t.getFullYear(), t.getMonth(), 1));
  const end = ymd(t);
  const { data: d } = useData(() => api<Report>('/reports', { params: { start, end } }), [start, end]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Reportes</span>
          <h1>¿Cómo va la tienda?</h1>
          {d ? (
            <p className="muted">
              {shortDate(parse(d.start))} – {shortDate(parse(d.end))}
            </p>
          ) : null}
        </div>
        <div className="toolbar" style={{ margin: 0 }}>
          <div className="seg">
            {RANGES.map((x) => (
              <button key={x.key} className={range === x.key ? 'on' : ''} onClick={() => setRange(x.key)}>
                {x.label}
              </button>
            ))}
          </div>
          <button className="btn ghost" onClick={() => download('/reports/sales.csv', `ventas-${start}-a-${end}.csv`, { start, end }).catch((e: Error) => toast(e.message))}>
            Exportar ventas
          </button>
        </div>
      </div>

      {!d ? (
        <Loading />
      ) : (
        <>
          <div className="kpis">
            <div className="kpi card hero-kpi">
              <span>Vendido</span>
              <b className="num">{cop(d.total)}</b>
              <small>{d.count} ventas</small>
            </div>
            <div className="kpi card">
              <span>Ganancia estimada</span>
              <b className="num">{cop(d.profit)}</b>
              <small className="muted">Margen {d.margin}%</small>
            </div>
            <div className="kpi card">
              <span>Ticket promedio</span>
              <b className="num">{cop(d.average)}</b>
              <small className="muted">Descuentos {cop(d.discounts)}</small>
            </div>
            <div className="kpi card">
              <span>Promedio diario</span>
              <b className="num">{cop(Math.round(d.total / Math.max(1, d.daily.length)))}</b>
              <Trend values={d.daily.map((x) => x.total)} height={34} />
            </div>
          </div>

          <section className="card panel" style={{ marginBottom: 14 }}>
            <header>
              <h3>Ventas y ganancia por día</h3>
              <span className="muted">Pasa el mouse por cada barra</span>
            </header>
            <Bars
              data={d.daily.map((x) => ({ label: d.daily.length <= 10 ? shortDate(parse(x.date)).split(' ').slice(0, 2).join(' ') : x.date.slice(8), value: x.total, title: `${shortDate(parse(x.date))}: ${cop(x.total)} · ganancia ${cop(x.profit)} · ${x.count} ventas` }))}
              height={200}
            />
          </section>

          <div className="dash-grid">
            <section className="card panel">
              <header>
                <h3>Productos estrella</h3>
              </header>
              <ol className="rank">
                {d.top.map((p, i) => (
                  <li key={p.name}>
                    <span className="pos-n">{i + 1}</span>
                    <span className="nm">{p.name}</span>
                    <span className="muted num">
                      {num(p.qty)} {p.unit}
                    </span>
                    <b className="num">{cop(p.total)}</b>
                  </li>
                ))}
              </ol>
            </section>
            <section className="card panel">
              <header>
                <h3>Por categoría</h3>
              </header>
              <Donut parts={d.by_category.map((c) => ({ label: c.name, value: c.total, color: c.color }))} size={140} />
            </section>
            <section className="card panel">
              <header>
                <h3>Medios de pago</h3>
              </header>
              <Donut
                parts={[
                  { label: METHOD_LABEL.efectivo, value: d.by_method.efectivo, color: '#16a34a' },
                  { label: METHOD_LABEL.transferencia, value: d.by_method.transferencia, color: '#2563eb' },
                  { label: METHOD_LABEL.tarjeta, value: d.by_method.tarjeta, color: '#7c3aed' },
                ]}
                size={140}
              />
              <header>
                <h3>Días más fuertes</h3>
              </header>
              <Bars data={d.by_weekday.map((w) => ({ label: WD[w.weekday], value: w.total }))} height={110} color="var(--ink)" />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

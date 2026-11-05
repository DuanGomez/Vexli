import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Bars, Donut } from '../lib/charts';
import { cop, dayShort, hour, hourLabel, longDate, num } from '../lib/format';
import type { CashSession, Product, Sale } from '../lib/types';
import { METHOD_LABEL } from '../lib/types';
import { Loading, useAuth, useData } from '../lib/ui';
import './pages.css';

interface Dash {
  date: string;
  total: number;
  count: number;
  average: number;
  profit: number;
  yesterday_same_hour: number;
  units: number;
  by_method: { efectivo: number; transferencia: number; tarjeta: number };
  by_hour: { hour: number; total: number }[];
  week: { date: string; total: number; count: number }[];
  top: { product_id: number; name: string; unit: string; qty: number; total: number }[];
  low_stock: Product[];
  low_count: number;
  stock_value: number;
  session: CashSession | null;
  recent: Sale[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: d, error } = useData(() => api<Dash>('/dashboard'), []);
  if (error) return <p className="empty">{error}</p>;
  if (!d) return <Loading />;

  const diff = d.yesterday_same_hour ? Math.round(((d.total - d.yesterday_same_hour) / d.yesterday_same_hour) * 100) : null;
  const nowHour = new Date().getHours();

  return (
    <div className="page dash">
      <div className="page-head">
        <div>
          <span className="eyebrow">{longDate(d.date)}</span>
          <h1>Hola, {user?.name.split(' ')[0]} 👋</h1>
        </div>
        <Link to="/app/caja" className="btn lime lg">
          Ir a vender
        </Link>
      </div>

      <div className="kpis">
        <div className="kpi card hero-kpi">
          <span>Ventas de hoy</span>
          <b className="num">{cop(d.total)}</b>
          <small>
            {diff === null ? 'Primer día con ventas' : `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)}% vs. ayer a esta hora`}
          </small>
        </div>
        <div className="kpi card">
          <span>Ganancia estimada</span>
          <b className="num">{cop(d.profit)}</b>
          <small className="muted">{d.total ? Math.round((d.profit / d.total) * 100) : 0}% de margen</small>
        </div>
        <div className="kpi card">
          <span>Ventas</span>
          <b className="num">{d.count}</b>
          <small className="muted">Ticket promedio {cop(d.average)}</small>
        </div>
        <div className="kpi card">
          <span>Inventario al costo</span>
          <b className="num">{cop(d.stock_value)}</b>
          <small className={d.low_count ? 'warn' : 'muted'}>{d.low_count ? `${d.low_count} productos por agotarse` : 'Todo con buen stock'}</small>
        </div>
      </div>

      <div className="dash-grid">
        <section className="card panel">
          <header>
            <h3>Ventas por hora</h3>
            <span className="muted">Hoy</span>
          </header>
          <Bars
            data={d.by_hour.filter((h) => h.hour <= Math.max(nowHour, 12)).map((h) => ({ label: hourLabel(h.hour).replace(' a. m.', 'a').replace(' p. m.', 'p'), value: h.total }))}
            height={170}
          />
        </section>

        <section className="card panel">
          <header>
            <h3>Cómo te pagan</h3>
            <span className="muted">Hoy</span>
          </header>
          <Donut
            parts={[
              { label: METHOD_LABEL.efectivo, value: d.by_method.efectivo, color: '#16a34a' },
              { label: METHOD_LABEL.transferencia, value: d.by_method.transferencia, color: '#2563eb' },
              { label: METHOD_LABEL.tarjeta, value: d.by_method.tarjeta, color: '#7c3aed' },
            ]}
          />
        </section>

        <section className="card panel cash-now">
          <header>
            <h3>Caja</h3>
            {d.session ? <span className="chip green">Abierta desde {hour(d.session.opened_at)}</span> : <span className="chip">Cerrada</span>}
          </header>
          {d.session?.summary ? (
            <>
              <div className="big-num">
                <span>Debería haber en efectivo</span>
                <b className="num">{cop(d.session.summary.expected_cash)}</b>
              </div>
              <ul className="mini">
                <li>
                  <span>Base</span>
                  <b className="num">{cop(d.session.opening_amount)}</b>
                </li>
                <li>
                  <span>Ventas en efectivo</span>
                  <b className="num">+ {cop(d.session.summary.cash)}</b>
                </li>
                <li>
                  <span>Salidas</span>
                  <b className="num">− {cop(d.session.summary.cash_out)}</b>
                </li>
              </ul>
              <Link to="/app/cierre" className="btn ghost sm">
                Cerrar caja
              </Link>
            </>
          ) : (
            <Link to="/app/caja" className="btn brand">
              Abrir caja
            </Link>
          )}
        </section>

        <section className="card panel">
          <header>
            <h3>Últimos 7 días</h3>
            <span className="muted num">{cop(d.week.reduce((s, x) => s + x.total, 0))}</span>
          </header>
          <Bars data={d.week.map((w) => ({ label: dayShort(w.date), value: w.total, title: `${w.date}: ${cop(w.total)} · ${w.count} ventas` }))} height={150} highlightLast />
        </section>

        <section className="card panel">
          <header>
            <h3>Lo más vendido hoy</h3>
          </header>
          <ol className="rank">
            {d.top.map((t, i) => (
              <li key={t.name}>
                <span className="pos-n">{i + 1}</span>
                <span className="nm">{t.name}</span>
                <span className="muted num">
                  {num(t.qty)} {t.unit}
                </span>
                <b className="num">{cop(t.total)}</b>
              </li>
            ))}
            {!d.top.length ? <p className="muted">Aún no hay ventas hoy.</p> : null}
          </ol>
        </section>

        <section className="card panel">
          <header>
            <h3>Por agotarse</h3>
            <Link to="/app/inventario?bajo=1" className="link">
              Ver todo
            </Link>
          </header>
          <ul className="lowlist">
            {d.low_stock.slice(0, 6).map((p) => (
              <li key={p.id}>
                <span aria-hidden="true">{p.emoji ?? '📦'}</span>
                <span className="nm">{p.name}</span>
                <span className={'chip ' + (p.stock <= 0 ? 'red' : 'amber')}>
                  {p.stock <= 0 ? 'Agotado' : `Quedan ${num(p.stock)}`}
                </span>
              </li>
            ))}
            {!d.low_stock.length ? <p className="muted">Nada por ahora. 👌</p> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}

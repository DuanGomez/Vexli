import { useState } from 'react';
import { api, ApiError, download } from '../lib/api';
import { cop, hour, longDate, num, parse, ymd, addDays, today } from '../lib/format';
import type { Sale } from '../lib/types';
import { METHOD_LABEL } from '../lib/types';
import { Loading, useAuth, useData, useToast } from '../lib/ui';
import { Receipt } from './Pos';
import './pages.css';

export default function Sales() {
  const toast = useToast();
  const { store } = useAuth();
  const [date, setDate] = useState(ymd(today()));
  const [sel, setSel] = useState<Sale | null>(null);
  const [reason, setReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const { data, reload } = useData(() => api<{ total: number; count: number; sales: Sale[] }>('/sales', { params: { date } }), [date]);

  async function voidSale() {
    if (!sel) return;
    try {
      const s = await api<Sale>(`/sales/${sel.id}/void`, { method: 'POST', body: { reason } });
      setSel(s);
      setVoiding(false);
      setReason('');
      toast('Venta anulada: las existencias volvieron al inventario');
      reload();
    } catch (e) {
      toast((e as ApiError).message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Ventas</span>
          <h1>{date === ymd(today()) ? 'Ventas de hoy' : longDate(parse(date))}</h1>
          {data ? (
            <p className="muted">
              {data.count} ventas · <b className="num">{cop(data.total)}</b>
            </p>
          ) : null}
        </div>
        <div className="toolbar" style={{ margin: 0 }}>
          <button className="btn ghost icon" onClick={() => setDate(ymd(addDays(parse(date), -1)))} aria-label="Día anterior">
            ‹
          </button>
          <input type="date" className="input" value={date} max={ymd(today())} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="btn ghost icon" onClick={() => setDate(ymd(addDays(parse(date), 1)))} disabled={date >= ymd(today())} aria-label="Día siguiente">
            ›
          </button>
          <button className="btn ghost" onClick={() => download('/reports/sales.csv', `ventas-${date}.csv`, { start: date, end: date }).catch((e: Error) => toast(e.message))}>
            Exportar
          </button>
        </div>
      </div>

      {!data ? (
        <Loading />
      ) : (
        <div className="split">
          <div className="card" style={{ overflow: 'hidden' }}>
            {data.sales.map((s) => (
              <button key={s.id} className={'sale-row' + (sel?.id === s.id ? ' sel' : '') + (s.status === 'anulada' ? ' void' : '')} onClick={() => api<Sale>(`/sales/${s.id}`).then(setSel)}>
                <span className="n num">#{s.number}</span>
                <span className="what">
                  <span className="muted num">{hour(s.created_at)}</span> · {num(s.units)} productos{s.customer ? ` · ${s.customer}` : ''}
                </span>
                <span className={'chip ' + (s.status === 'anulada' ? 'red' : s.method === 'efectivo' ? 'green' : s.method === 'transferencia' ? 'blue' : 'violet')}>
                  {s.status === 'anulada' ? 'Anulada' : METHOD_LABEL[s.method]}
                </span>
                <b className="num">{cop(s.total)}</b>
              </button>
            ))}
            {!data.sales.length ? <p className="empty">No hubo ventas ese día.</p> : null}
          </div>

          {sel ? (
            <aside className="card detail">
              <div>
                <span className="eyebrow">Venta #{sel.number}</span>
                <h2 style={{ fontSize: 26 }} className="num">
                  {cop(sel.total)}
                </h2>
                <p className="muted">
                  {longDate(sel.created_at)} · {hour(sel.created_at)} · {sel.cashier}
                </p>
              </div>
              {sel.status === 'anulada' ? <p className="error">Anulada: {sel.void_reason}</p> : null}
              <div className="receipt" style={{ background: 'var(--soft)', borderRadius: 12 }}>
                {sel.items?.map((i, k) => (
                  <div className="ritem" key={k}>
                    <span>
                      {num(i.qty)} {i.unit === 'und' ? '×' : i.unit} {i.name}
                    </span>
                    <span className="num">{cop(i.total)}</span>
                  </div>
                ))}
                {sel.discount ? (
                  <div className="ritem">
                    <span>Descuento</span>
                    <span className="num">− {cop(sel.discount)}</span>
                  </div>
                ) : null}
                <div className="ritem rtotal">
                  <span>Total</span>
                  <span className="num">{cop(sel.total)}</span>
                </div>
              </div>
              <ul className="mini">
                {sel.paid_cash ? (
                  <li>
                    <span>Efectivo</span>
                    <b className="num">{cop(sel.paid_cash)}</b>
                  </li>
                ) : null}
                {sel.paid_transfer ? (
                  <li>
                    <span>Transferencia</span>
                    <b className="num">{cop(sel.paid_transfer)}</b>
                  </li>
                ) : null}
                {sel.paid_card ? (
                  <li>
                    <span>Tarjeta</span>
                    <b className="num">{cop(sel.paid_card)}</b>
                  </li>
                ) : null}
                <li>
                  <span>Ganancia estimada</span>
                  <b className="num" style={{ color: 'var(--brand-2)' }}>
                    {cop(sel.profit)}
                  </b>
                </li>
              </ul>
              <div className="toolbar" style={{ margin: 0 }}>
                <button className="btn ghost sm" onClick={() => setReceipt(sel)}>
                  Ver recibo
                </button>
                {sel.status === 'completada' && !voiding ? (
                  <button className="btn danger sm" onClick={() => setVoiding(true)}>
                    Anular venta
                  </button>
                ) : null}
              </div>
              {voiding ? (
                <div className="form">
                  <label className="field">
                    <span>¿Por qué se anula?</span>
                    <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Devolución, error al cobrar…" autoFocus />
                  </label>
                  <div className="actions">
                    <button className="btn ghost sm" onClick={() => setVoiding(false)}>
                      Cancelar
                    </button>
                    <button className="btn danger sm" onClick={voidSale} disabled={reason.trim().length < 3}>
                      Anular y devolver al inventario
                    </button>
                  </div>
                </div>
              ) : null}
            </aside>
          ) : (
            <aside className="card detail">
              <p className="muted">Toca una venta para ver el detalle, el recibo o anularla.</p>
            </aside>
          )}
        </div>
      )}
      {receipt ? <Receipt sale={receipt} storeName={store?.name ?? ''} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}

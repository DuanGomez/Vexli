import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { cop, hour, shortDate } from '../lib/format';
import type { CashSession } from '../lib/types';
import { Loading, Modal, useData, useToast } from '../lib/ui';
import './pages.css';

const DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

export default function Cash() {
  const toast = useToast();
  const { data: current, reload } = useData(() => api<{ session: CashSession | null }>('/cash/current'), []);
  const { data: history, reload: reloadHistory } = useData(() => api<CashSession[]>('/cash/sessions'), []);
  const [moveKind, setMoveKind] = useState<'ingreso' | 'egreso' | null>(null);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState<CashSession | null>(null);
  const [detail, setDetail] = useState<CashSession | null>(null);

  if (!current || !history) return <Loading />;
  const s = current.session;
  const sm = s?.summary;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Caja y cierre</span>
          <h1>{s ? 'Turno abierto' : 'La caja está cerrada'}</h1>
          {s ? (
            <p className="muted">
              Abierta {shortDate(s.opened_at)} a las {hour(s.opened_at)} por {s.opened_by}
            </p>
          ) : null}
        </div>
        {s ? (
          <div className="toolbar" style={{ margin: 0 }}>
            <button className="btn ghost" onClick={() => setMoveKind('ingreso')}>
              + Entrada de efectivo
            </button>
            <button className="btn ghost" onClick={() => setMoveKind('egreso')}>
              − Salida de efectivo
            </button>
            <button className="btn brand" onClick={() => setClosing(true)}>
              Cerrar caja
            </button>
          </div>
        ) : (
          <Link to="/app/caja" className="btn brand">
            Abrir caja
          </Link>
        )}
      </div>

      {s && sm ? (
        <div className="split" style={{ marginBottom: 22 }}>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(2, 1fr)', margin: 0 }}>
            <div className="kpi card hero-kpi">
              <span>Ventas del turno</span>
              <b className="num">{cop(sm.total)}</b>
              <small>
                {sm.sales_count} ventas{sm.voided ? ` · ${sm.voided} anuladas` : ''}
              </small>
            </div>
            <div className="kpi card">
              <span>Ganancia estimada</span>
              <b className="num">{cop(sm.profit)}</b>
              <small className="muted">Descuentos: {cop(sm.discounts)}</small>
            </div>
            <div className="kpi card">
              <span>Transferencias</span>
              <b className="num">{cop(sm.transfer)}</b>
              <small className="muted">No entra a la caja</small>
            </div>
            <div className="kpi card">
              <span>Tarjeta</span>
              <b className="num">{cop(sm.card)}</b>
              <small className="muted">No entra a la caja</small>
            </div>
          </div>
          <aside className="card detail">
            <h3>Efectivo en caja</h3>
            <div className="arqueo">
              <div className="line-sum">
                <span>Base inicial</span>
                <span className="num">{cop(s.opening_amount)}</span>
              </div>
              <div className="line-sum">
                <span>Ventas en efectivo</span>
                <span className="num">+ {cop(sm.cash)}</span>
              </div>
              <div className="line-sum">
                <span>Entradas</span>
                <span className="num">+ {cop(sm.cash_in)}</span>
              </div>
              <div className="line-sum">
                <span>Salidas</span>
                <span className="num">− {cop(sm.cash_out)}</span>
              </div>
              <div className="line-sum strong">
                <span>Debería haber</span>
                <span className="num">{cop(sm.expected_cash)}</span>
              </div>
            </div>
            {sm.moves.length ? (
              <>
                <span className="eyebrow">Movimientos de efectivo</span>
                <ul className="mini">
                  {sm.moves.map((m) => (
                    <li key={m.id}>
                      <span>
                        {hour(m.created_at)} · {m.reason}
                      </span>
                      <b className="num" style={{ color: m.kind === 'egreso' ? 'var(--danger)' : 'var(--brand-2)' }}>
                        {m.kind === 'egreso' ? '−' : '+'} {cop(m.amount)}
                      </b>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </aside>
        </div>
      ) : null}

      <h2 style={{ fontSize: 22, marginBottom: 12 }}>Cierres anteriores</h2>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Turno</th>
              <th>Abrió / cerró</th>
              <th className="r">Ventas</th>
              <th className="r">Esperado</th>
              <th className="r">Contado</th>
              <th className="r">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {history
              .filter((h) => !h.open)
              .map((h) => (
                <tr key={h.id} onClick={() => api<CashSession>(`/cash/sessions/${h.id}`).then(setDetail)} style={{ cursor: 'pointer' }}>
                  <td className="num">
                    {shortDate(h.opened_at)} · {hour(h.opened_at)} – {h.closed_at ? hour(h.closed_at) : ''}
                  </td>
                  <td className="muted">
                    {h.opened_by} / {h.closed_by}
                  </td>
                  <td className="r num">{cop(h.sales_total)}</td>
                  <td className="r num">{cop(h.expected_cash)}</td>
                  <td className="r num">{cop(h.counted_cash)}</td>
                  <td className="r num">
                    <span className={'chip ' + (h.difference === 0 ? 'green' : (h.difference ?? 0) > 0 ? 'blue' : 'red')}>
                      {h.difference === 0 ? 'Cuadró' : `${(h.difference ?? 0) > 0 ? '+' : '−'} ${cop(Math.abs(h.difference ?? 0))}`}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {moveKind ? (
        <CashMoveForm
          kind={moveKind}
          onClose={() => setMoveKind(null)}
          onSaved={() => {
            setMoveKind(null);
            reload();
          }}
        />
      ) : null}
      {closing && s && sm ? (
        <CloseForm
          expected={sm.expected_cash}
          onClose={() => setClosing(false)}
          onClosed={(c) => {
            setClosing(false);
            setClosed(c);
            reload();
            reloadHistory();
            toast('Caja cerrada');
          }}
        />
      ) : null}
      {closed || detail ? <ClosedSummary s={(closed ?? detail)!} onClose={() => (setClosed(null), setDetail(null))} /> : null}
    </div>
  );
}

function CashMoveForm({ kind, onClose, onSaved }: { kind: 'ingreso' | 'egreso'; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function save() {
    try {
      await api('/cash/moves', { method: 'POST', body: { kind, amount, reason } });
      onSaved();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  return (
    <Modal title={kind === 'ingreso' ? 'Entrada de efectivo' : 'Salida de efectivo'} eyebrow="Caja" onClose={onClose}>
      <div className="form">
        <label className="field">
          <span>Valor</span>
          <input className="num big-input" inputMode="numeric" value={amount ? cop(amount) : ''} onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, '')) || 0)} autoFocus />
        </label>
        <label className="field">
          <span>Motivo</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={kind === 'egreso' ? 'Pago al proveedor de pan, domicilio…' : 'Cambio que trajo el dueño…'} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="actions">
          <button className="btn brand" onClick={save} disabled={!amount || reason.trim().length < 2}>
            Registrar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CloseForm({ expected, onClose, onClosed }: { expected: number; onClose: () => void; onClosed: (s: CashSession) => void }) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [manual, setManual] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fromBills = useMemo(() => DENOMS.reduce((s, d) => s + d * (counts[d] ?? 0), 0), [counts]);
  const counted = manual ?? fromBills;
  const diff = counted - expected;

  async function close() {
    setBusy(true);
    try {
      const r = await api<{ session: CashSession }>('/cash/close', { method: 'POST', body: { counted_cash: counted, notes: notes || null } });
      onClosed(r.session);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Cuenta el efectivo" eyebrow="Cierre de caja" onClose={onClose} wide>
      <div className="form">
        <p className="muted">Cuenta billetes y monedas. Vexli suma por ti y te dice si la caja cuadra.</p>
        <div className="denoms">
          {DENOMS.map((d) => (
            <label className="denom" key={d}>
              <span className="num">
                {d >= 1000 ? '💵' : '🪙'} {cop(d)}
              </span>
              <input
                className="input num"
                inputMode="numeric"
                value={counts[d] ?? ''}
                placeholder="0"
                onChange={(e) => {
                  setManual(null);
                  setCounts((c) => ({ ...c, [d]: Number(e.target.value.replace(/\D/g, '')) || 0 }));
                }}
              />
            </label>
          ))}
        </div>
        <label className="field">
          <span>Total contado (o escríbelo directo)</span>
          <input className="num big-input" inputMode="numeric" value={cop(counted)} onChange={(e) => setManual(Number(e.target.value.replace(/\D/g, '')) || 0)} />
        </label>
        <div className={'diff ' + (diff === 0 ? 'ok' : diff > 0 ? 'over' : 'short')}>
          <span>{diff === 0 ? '¡La caja cuadra!' : diff > 0 ? 'Sobra dinero' : 'Falta dinero'}</span>
          <b className="num">{diff === 0 ? cop(expected) : `${diff > 0 ? '+' : '−'} ${cop(Math.abs(diff))}`}</b>
        </div>
        <label className="field">
          <span>Notas del cierre (opcional)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: faltante por un cambio mal dado" />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="actions">
          <button className="btn ghost" onClick={onClose}>
            Seguir vendiendo
          </button>
          <button className="btn brand" onClick={close} disabled={busy}>
            Cerrar caja
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ClosedSummary({ s, onClose }: { s: CashSession; onClose: () => void }) {
  const sm = s.summary;
  return (
    <Modal title={`${shortDate(s.opened_at)} · ${hour(s.opened_at)} – ${s.closed_at ? hour(s.closed_at) : ''}`} eyebrow="Resumen del turno" onClose={onClose}>
      <div className="arqueo">
        {sm ? (
          <>
            <div className="line-sum">
              <span>Ventas ({sm.sales_count})</span>
              <span className="num">{cop(sm.total)}</span>
            </div>
            <div className="line-sum">
              <span>· en efectivo</span>
              <span className="num">{cop(sm.cash)}</span>
            </div>
            <div className="line-sum">
              <span>· por transferencia</span>
              <span className="num">{cop(sm.transfer)}</span>
            </div>
            <div className="line-sum">
              <span>· con tarjeta</span>
              <span className="num">{cop(sm.card)}</span>
            </div>
            <div className="line-sum">
              <span>Ganancia estimada</span>
              <span className="num">{cop(sm.profit)}</span>
            </div>
          </>
        ) : null}
        <div className="line-sum strong">
          <span>Efectivo esperado</span>
          <span className="num">{cop(s.expected_cash)}</span>
        </div>
        <div className="line-sum">
          <span>Contado</span>
          <span className="num">{cop(s.counted_cash)}</span>
        </div>
        <div className={'diff ' + (s.difference === 0 ? 'ok' : (s.difference ?? 0) > 0 ? 'over' : 'short')}>
          <span>{s.difference === 0 ? 'Cuadró exacto' : (s.difference ?? 0) > 0 ? 'Sobró' : 'Faltó'}</span>
          <b className="num">{cop(Math.abs(s.difference ?? 0))}</b>
        </div>
        {s.notes ? <p className="muted">Nota: {s.notes}</p> : null}
      </div>
    </Modal>
  );
}

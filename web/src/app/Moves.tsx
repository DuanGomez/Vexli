import { useState } from 'react';
import { api } from '../lib/api';
import { hour, num, shortDate } from '../lib/format';
import type { Move } from '../lib/types';
import { MOVE_LABEL } from '../lib/types';
import { Loading, useData } from '../lib/ui';
import './pages.css';

const COLORS: Record<Move['kind'], string> = { entrada: 'green', ajuste: 'blue', merma: 'red', venta: '', anulacion: 'amber' };

export default function Moves() {
  const [kind, setKind] = useState('');
  const { data } = useData(() => api<Move[]>('/moves', { params: { kind, limit: 200 } }), [kind]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Movimientos</span>
          <h1>Todo lo que entra y sale</h1>
          <p className="muted">Cada cambio de existencias queda registrado con quién lo hizo y por qué.</p>
        </div>
        <div className="seg">
          {[
            ['', 'Todos'],
            ['entrada', 'Entradas'],
            ['venta', 'Ventas'],
            ['ajuste', 'Ajustes'],
            ['merma', 'Mermas'],
            ['anulacion', 'Anulaciones'],
          ].map(([k, l]) => (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {!data ? (
        <Loading />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th className="r">Cantidad</th>
                <th className="r">Quedó en</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id}>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    {shortDate(m.created_at)} · {hour(m.created_at)}
                  </td>
                  <td>
                    <span aria-hidden="true">{m.product.emoji ?? '📦'}</span> {m.product.name}
                  </td>
                  <td>
                    <span className={'chip ' + COLORS[m.kind]}>{MOVE_LABEL[m.kind]}</span>
                  </td>
                  <td className="r num" style={{ color: m.qty < 0 ? 'var(--danger)' : 'var(--brand-2)', fontWeight: 700 }}>
                    {m.qty > 0 ? '+' : ''}
                    {num(m.qty)} {m.product.unit}
                  </td>
                  <td className="r num">
                    {num(m.stock_after)} {m.product.unit}
                  </td>
                  <td className="muted">
                    {m.note}
                    {m.user ? ` · ${m.user}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.length ? <p className="empty">Sin movimientos de ese tipo.</p> : null}
        </div>
      )}
    </div>
  );
}

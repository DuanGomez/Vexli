import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { cashSuggestions, cop, hour, longDate, num } from '../lib/format';
import type { CashSession, Category, Method, Product, Sale } from '../lib/types';
import { METHOD_LABEL } from '../lib/types';
import { Loading, Modal, useAuth, useToast } from '../lib/ui';
import './pos.css';

interface Line {
  product: Product;
  qty: number;
}

export default function Pos() {
  const toast = useToast();
  const { store } = useAuth();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [session, setSession] = useState<CashSession | null | undefined>(undefined);
  const [suggested, setSuggested] = useState(100000);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState('');
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [sheet, setSheet] = useState(false); // ticket desplegado en el celular
  const search = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [p, c, cur] = await Promise.all([
      api<Product[]>('/products'),
      api<Category[]>('/categories'),
      api<{ session: CashSession | null; suggested_opening?: number }>('/cash/current'),
    ]);
    setProducts(p);
    setCategories(c);
    setSession(cur.session);
    if (cur.suggested_opening) setSuggested(cur.suggested_opening);
  }, []);

  useEffect(() => {
    load().catch((e: Error) => toast(e.message));
  }, [load, toast]);

  // F2 busca, F9 cobra
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        search.current?.focus();
      }
      if (e.key === 'F9' && lines.length && !paying) {
        e.preventDefault();
        setPaying(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lines.length, paying]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (products ?? []).filter(
      (p) => (!cat || p.category_id === cat) && (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase() === term || p.barcode === term),
    );
  }, [products, q, cat]);

  // Igual que el servidor: cada línea se redondea a 50 pesos
  const lineTotal = (l: Line) => Math.round((l.qty * l.product.price) / 50) * 50;
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const total = Math.max(0, subtotal - discount);
  const units = lines.reduce((s, l) => s + l.qty, 0);

  function add(p: Product, qty?: number) {
    const step = qty ?? (p.unit === 'und' ? 1 : 0.5);
    setLines((ls) => {
      const found = ls.find((l) => l.product.id === p.id);
      if (found) return ls.map((l) => (l.product.id === p.id ? { ...l, qty: Math.round((l.qty + step) * 1000) / 1000 } : l));
      return [...ls, { product: p, qty: step }];
    });
  }

  function setQty(id: number, qty: number) {
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.product.id !== id) : ls.map((l) => (l.product.id === id ? { ...l, qty } : l))));
  }

  async function onSearchEnter() {
    const term = q.trim();
    if (!term) return;
    // Lector de código de barras: código exacto
    const exact = products?.find((p) => p.barcode === term || p.sku.toLowerCase() === term.toLowerCase());
    if (exact) {
      add(exact);
      setQ('');
      return;
    }
    if (visible.length === 1) {
      add(visible[0]);
      setQ('');
      return;
    }
    try {
      const p = await api<Product>('/products/lookup', { params: { code: term } });
      add(p);
      setQ('');
    } catch (e) {
      if (!visible.length) toast((e as Error).message);
    }
  }

  function clear() {
    setLines([]);
    setDiscount(0);
    setCustomer('');
  }

  async function done(sale: Sale) {
    setPaying(false);
    setReceipt(sale);
    clear();
    const [p, cur] = await Promise.all([api<Product[]>('/products'), api<{ session: CashSession | null }>('/cash/current')]).catch(() => [null, null]);
    if (p) setProducts(p as Product[]);
    if (cur) setSession((cur as { session: CashSession | null }).session);
  }

  if (products === null || session === undefined) return <Loading text="Abriendo la caja…" />;

  if (session === null) return <OpenCash suggested={suggested} onOpen={(s) => setSession(s)} />;

  return (
    <div className="pos">
      <section className="catalog">
        <div className="searchbar">
          <input
            ref={search}
            className="input search"
            placeholder="Busca o escanea el código de barras…  (F2)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchEnter()}
            autoFocus
          />
          <div className="session-pill" title="Caja abierta">
            <span className="live" />
            Caja abierta · {hour(session.opened_at)}
          </div>
        </div>
        <div className="cats">
          <button className={!cat ? 'on' : ''} onClick={() => setCat(null)}>
            Todo
          </button>
          {categories.map((c) => (
            <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(cat === c.id ? null : c.id)} style={{ ['--c' as string]: c.color }}>
              <i style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid">
          {visible.map((p) => {
            const inCart = lines.find((l) => l.product.id === p.id)?.qty ?? 0;
            const left = p.stock - inCart;
            return (
              <button key={p.id} className={'tile' + (inCart ? ' in' : '')} onClick={() => add(p)}>
                {inCart ? <span className="badge num">{num(inCart)}</span> : null}
                <span className="emoji" aria-hidden="true">
                  {p.emoji ?? '📦'}
                </span>
                <span className="name">{p.name}</span>
                <span className="row">
                  <b className="num">{cop(p.price)}</b>
                  <span className={'stock num' + (left <= 0 ? ' out' : left <= p.min_stock ? ' low' : '')}>
                    {left <= 0 ? 'Agotado' : `${num(left)} ${p.unit}`}
                  </span>
                </span>
              </button>
            );
          })}
          {!visible.length ? <p className="empty">No hay productos con «{q}».</p> : null}
        </div>
      </section>

      <aside className={'ticket card' + (sheet ? ' open' : '')}>
        <header onClick={() => setSheet((x) => !x)}>
          <div>
            <span className="eyebrow">Venta actual</span>
            <h2>{lines.length ? `${num(units)} ${units === 1 ? 'producto' : 'productos'}` : 'Ticket vacío'}</h2>
          </div>
          <span className="sheet-total num">{cop(total)}</span>
          {lines.length ? (
            <button className="link" onClick={(e) => (e.stopPropagation(), clear())}>
              Vaciar
            </button>
          ) : null}
        </header>

        <div className="lines">
          {lines.map((l) => (
            <div className="line" key={l.product.id}>
              <span className="emoji sm" aria-hidden="true">
                {l.product.emoji ?? '📦'}
              </span>
              <div className="info">
                <strong>{l.product.name}</strong>
                <span className="muted num">
                  {cop(l.product.price)} / {l.product.unit}
                </span>
              </div>
              <div className="stepper">
                <button onClick={() => setQty(l.product.id, Math.round((l.qty - (l.product.unit === 'und' ? 1 : 0.25)) * 1000) / 1000)} aria-label="Quitar uno">
                  −
                </button>
                <input
                  className="num"
                  inputMode="decimal"
                  value={l.qty}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(',', '.'));
                    if (!Number.isNaN(v)) setQty(l.product.id, v);
                  }}
                />
                <button onClick={() => add(l.product, l.product.unit === 'und' ? 1 : 0.25)} aria-label="Agregar uno">
                  +
                </button>
              </div>
              <b className="lt num">{cop(lineTotal(l))}</b>
            </div>
          ))}
          {!lines.length ? (
            <div className="hint">
              <span aria-hidden="true">🛒</span>
              <p>Toca un producto o escanea su código para empezar.</p>
            </div>
          ) : null}
        </div>

        <div className="totals">
          <label className="extra">
            <span>Cliente (opcional)</span>
            <input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nombre" />
          </label>
          <label className="extra">
            <span>Descuento</span>
            <input className="input num" inputMode="numeric" value={discount || ''} onChange={(e) => setDiscount(Math.min(subtotal, Number(e.target.value.replace(/\D/g, '')) || 0))} placeholder="$ 0" />
          </label>
          <div className="sum">
            <span>Subtotal</span>
            <span className="num">{cop(subtotal)}</span>
          </div>
          {discount ? (
            <div className="sum">
              <span>Descuento</span>
              <span className="num">− {cop(discount)}</span>
            </div>
          ) : null}
          <div className="sum total">
            <span>Total</span>
            <span className="num">{cop(total)}</span>
          </div>
          <button className="btn lime lg block charge" disabled={!lines.length} onClick={() => setPaying(true)}>
            Cobrar {cop(total)} <kbd>F9</kbd>
          </button>
        </div>
      </aside>

      {paying ? (
        <Payment
          total={total}
          payload={{ items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })), discount, customer: customer || null }}
          onClose={() => setPaying(false)}
          onDone={done}
        />
      ) : null}
      {receipt ? <Receipt sale={receipt} storeName={store?.name ?? ''} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}

// --- Abrir caja ---------------------------------------------------------------

function OpenCash({ suggested, onOpen }: { suggested: number; onOpen: (s: CashSession) => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState(suggested);
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const r = await api<{ session: CashSession }>('/cash/open', { method: 'POST', body: { opening_amount: amount } });
      onOpen(r.session);
      toast('Caja abierta. ¡Buenas ventas!');
    } catch (e) {
      toast((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page open-cash">
      <div className="card box">
        <span className="big" aria-hidden="true">
          🔓
        </span>
        <span className="eyebrow">{longDate(new Date())}</span>
        <h1>Abre la caja para empezar a vender</h1>
        <p className="muted">Cuenta el efectivo con el que arrancas el día (la base). Al cerrar, Vexli te dirá cuánto debería haber.</p>
        <label className="field">
          <span>Base en efectivo</span>
          <input className="num big-input" inputMode="numeric" value={cop(amount)} onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, '')) || 0)} />
        </label>
        <button className="btn brand lg block" onClick={open} disabled={busy}>
          Abrir caja
        </button>
        <Link to="/app/cierre" className="link">
          Ver cierres anteriores
        </Link>
      </div>
    </div>
  );
}

// --- Cobro ---------------------------------------------------------------------

interface Payload {
  items: { product_id: number; qty: number }[];
  discount: number;
  customer: string | null;
}

function Payment({ total, payload, onClose, onDone }: { total: number; payload: Payload; onClose: () => void; onDone: (s: Sale) => void }) {
  const [method, setMethod] = useState<Method>('efectivo');
  const [received, setReceived] = useState(0);
  const [transfer, setTransfer] = useState(0);
  const [card, setCard] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canForce, setCanForce] = useState(false);
  const [busy, setBusy] = useState(false);

  const cashPart = method === 'efectivo' ? total : method === 'mixto' ? Math.max(0, total - transfer - card) : 0;
  const given = received || cashPart;
  const change = Math.max(0, given - cashPart);
  const short = (method === 'efectivo' || method === 'mixto') && given < cashPart;

  async function pay(force = false) {
    setError(null);
    setBusy(true);
    try {
      const sale = await api<Sale>('/sales', {
        method: 'POST',
        body: { ...payload, method, cash_received: given, paid_transfer: transfer, paid_card: card, allow_negative: force },
      });
      onDone(sale);
    } catch (e) {
      setError((e as ApiError).message);
      setCanForce((e as ApiError).canForce);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={cop(total)} eyebrow="Cobrar" onClose={onClose}>
      <div className="pay">
        <div className="methods">
          {(['efectivo', 'transferencia', 'tarjeta', 'mixto'] as Method[]).map((m) => (
            <button key={m} className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>
              <span aria-hidden="true">{{ efectivo: '💵', transferencia: '📲', tarjeta: '💳', mixto: '🔀' }[m]}</span>
              {METHOD_LABEL[m]}
            </button>
          ))}
        </div>

        {method === 'mixto' ? (
          <div className="grid-2">
            <label className="field">
              <span>Transferencia</span>
              <input className="num" inputMode="numeric" value={transfer || ''} onChange={(e) => setTransfer(Number(e.target.value.replace(/\D/g, '')) || 0)} />
            </label>
            <label className="field">
              <span>Tarjeta</span>
              <input className="num" inputMode="numeric" value={card || ''} onChange={(e) => setCard(Number(e.target.value.replace(/\D/g, '')) || 0)} />
            </label>
          </div>
        ) : null}

        {method === 'efectivo' || method === 'mixto' ? (
          <>
            <label className="field">
              <span>{method === 'mixto' ? `Efectivo recibido (le toca ${cop(cashPart)})` : 'Efectivo recibido'}</span>
              <input
                className="num big-input"
                inputMode="numeric"
                autoFocus
                value={received ? cop(received) : ''}
                placeholder={cop(cashPart)}
                onChange={(e) => setReceived(Number(e.target.value.replace(/\D/g, '')) || 0)}
                onKeyDown={(e) => e.key === 'Enter' && !short && pay()}
              />
            </label>
            <div className="bills">
              {cashSuggestions(cashPart).map((b) => (
                <button key={b} className={given === b ? 'on' : ''} onClick={() => setReceived(b)}>
                  {b === cashPart ? 'Exacto' : cop(b)}
                </button>
              ))}
            </div>
            <div className={'change' + (short ? ' short' : '')}>
              <span>{short ? 'Falta' : 'Cambio'}</span>
              <b className="num">{cop(short ? cashPart - given : change)}</b>
            </div>
          </>
        ) : (
          <p className="muted note">Confirma que el pago por {METHOD_LABEL[method].toLowerCase()} quedó aprobado antes de registrar la venta.</p>
        )}

        {error ? <p className="error">{error}</p> : null}
        <div className="actions">
          {canForce ? (
            <button className="btn soft" onClick={() => pay(true)} disabled={busy}>
              Vender igual
            </button>
          ) : null}
          <button className="btn brand lg" onClick={() => pay()} disabled={busy || short || (method === 'mixto' && transfer + card > total)}>
            {busy ? 'Registrando…' : 'Registrar venta'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// --- Recibo --------------------------------------------------------------------

export function Receipt({ sale, storeName, onClose }: { sale: Sale; storeName: string; onClose: () => void }) {
  const { store } = useAuth();
  const text = [
    `*${storeName}*`,
    `Venta #${sale.number} · ${sale.created_at}`,
    '',
    ...(sale.items ?? []).map((i) => `${num(i.qty)} ${i.unit === 'und' ? 'x' : i.unit} ${i.name} — ${cop(i.total)}`),
    '',
    sale.discount ? `Descuento: ${cop(sale.discount)}` : '',
    `*Total: ${cop(sale.total)}*`,
    `Pago: ${METHOD_LABEL[sale.method]}${sale.change ? ` · Cambio ${cop(sale.change)}` : ''}`,
    store?.receipt_note ?? '',
  ]
    .filter((x) => x !== '')
    .join('\n');

  return (
    <Modal title="¡Venta registrada!" eyebrow={`Venta #${sale.number}`} onClose={onClose}>
      <div className="receipt card">
        <div className="rhead">
          <strong>{storeName}</strong>
          {store?.address ? <span>{store.address}</span> : null}
          <span className="num">
            Venta #{sale.number} · {sale.created_at}
          </span>
        </div>
        {(sale.items ?? []).map((i, k) => (
          <div className="ritem" key={k}>
            <span>
              {num(i.qty)} {i.unit === 'und' ? '×' : i.unit} {i.name}
            </span>
            <span className="num">{cop(i.total)}</span>
          </div>
        ))}
        {sale.discount ? (
          <div className="ritem">
            <span>Descuento</span>
            <span className="num">− {cop(sale.discount)}</span>
          </div>
        ) : null}
        <div className="ritem rtotal">
          <span>Total</span>
          <span className="num">{cop(sale.total)}</span>
        </div>
        <div className="ritem muted">
          <span>{METHOD_LABEL[sale.method]}</span>
          <span className="num">{sale.cash_received ? `Recibido ${cop(sale.cash_received)}` : ''}</span>
        </div>
        {sale.change ? (
          <div className="ritem change-line">
            <span>Cambio</span>
            <span className="num">{cop(sale.change)}</span>
          </div>
        ) : null}
        {store?.receipt_note ? <p className="rnote">{store.receipt_note}</p> : null}
      </div>
      <div className="receipt-actions no-print">
        <button className="btn ghost" onClick={() => window.print()}>
          Imprimir
        </button>
        <a className="btn ghost" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener">
          Enviar por WhatsApp
        </a>
        <button className="btn brand" onClick={onClose} autoFocus>
          Nueva venta
        </button>
      </div>
    </Modal>
  );
}

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError, download } from '../lib/api';
import { cop, num } from '../lib/format';
import type { Category, Product } from '../lib/types';
import { Loading, Modal, useAuth, useData, useToast } from '../lib/ui';
import './pages.css';

const EMOJIS = ['📦', '🥤', '🍺', '💧', '🧃', '☕', '🥛', '🥚', '🧀', '🍚', '🫘', '🫗', '🍝', '🐟', '🍫', '🍪', '🥔', '🍞', '🥖', '🍌', '🍅', '🥑', '🧼', '🧻', '🧴', '🪥', '✏️', '📓', '👕', '👟', '🔧', '💡'];

export default function Inventory() {
  const toast = useToast();
  const { user } = useAuth();
  const owner = user?.role === 'owner';
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<number | ''>('');
  const low = params.get('bajo') === '1';
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [moving, setMoving] = useState<Product | null>(null);

  const { data: products, reload } = useData(() => api<Product[]>('/products'), []);
  const { data: categories, reload: reloadCats } = useData(() => api<Category[]>('/categories'), []);

  const catName = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (products ?? []).filter(
      (p) =>
        (!cat || p.category_id === cat) &&
        (!low || p.low) &&
        (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || (p.barcode ?? '').includes(term)),
    );
  }, [products, q, cat, low]);

  const totals = useMemo(() => {
    const list = products ?? [];
    return {
      items: list.length,
      value: list.reduce((s, p) => s + Math.max(0, p.stock) * p.cost, 0),
      retail: list.reduce((s, p) => s + Math.max(0, p.stock) * p.price, 0),
      low: list.filter((p) => p.low).length,
    };
  }, [products]);

  if (!products || !categories) return <Loading />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Inventario</span>
          <h1>Tus productos</h1>
        </div>
        <div className="toolbar" style={{ margin: 0 }}>
          <button className="btn ghost" onClick={() => download('/products/export.csv', 'inventario.csv').catch((e: Error) => toast(e.message))}>
            Exportar a Excel
          </button>
          {owner ? (
            <button className="btn brand" onClick={() => setEditing('new')}>
              + Nuevo producto
            </button>
          ) : null}
        </div>
      </div>

      <div className="kpis">
        <div className="kpi card">
          <span>Productos activos</span>
          <b className="num">{totals.items}</b>
        </div>
        <div className="kpi card">
          <span>Inventario al costo</span>
          <b className="num">{cop(totals.value)}</b>
        </div>
        <div className="kpi card">
          <span>Valor a precio de venta</span>
          <b className="num">{cop(totals.retail)}</b>
        </div>
        <button className={'kpi card' + (low ? ' hero-kpi' : '')} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setParams(low ? {} : { bajo: '1' })}>
          <span>Por agotarse</span>
          <b className="num" style={{ color: low ? undefined : totals.low ? 'var(--amber)' : undefined }}>
            {totals.low}
          </b>
          <small className="muted">{low ? 'Mostrando solo estos · quitar filtro' : 'Toca para ver solo estos'}</small>
        </button>
      </div>

      <div className="toolbar">
        <input className="input" placeholder="Buscar por nombre, código o código de barras…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ maxWidth: 220 }} value={cat} onChange={(e) => setCat(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <span className="muted">{rows.length} productos</span>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th className="r">Costo</th>
              <th className="r">Precio</th>
              <th className="r">Margen</th>
              <th className="r">Existencias</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const c = p.category_id ? catName.get(p.category_id) : null;
              const ratio = p.min_stock ? Math.min(1, p.stock / (p.min_stock * 3)) : 1;
              return (
                <tr key={p.id}>
                  <td>
                    <div className="prod-cell">
                      <span className="em" aria-hidden="true">
                        {p.emoji ?? '📦'}
                      </span>
                      <div>
                        <strong>{p.name}</strong>
                        <small className="num">
                          {p.sku}
                          {p.barcode ? ` · ${p.barcode}` : ''}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{c ? <span className="chip" style={{ background: c.color + '1f', color: c.color }}>{c.name}</span> : <span className="muted">—</span>}</td>
                  <td className="r num">{cop(p.cost)}</td>
                  <td className="r num">
                    <b>{cop(p.price)}</b>
                  </td>
                  <td className="r num">
                    <span className={'chip ' + (p.margin < 15 ? 'red' : p.margin < 25 ? 'amber' : 'green')}>{p.margin}%</span>
                  </td>
                  <td className="r">
                    <div className="stock-cell">
                      <div className="meter">
                        <i style={{ width: `${Math.max(4, ratio * 100)}%`, background: p.stock <= 0 ? 'var(--danger)' : p.low ? '#f59e0b' : 'var(--brand)' }} />
                      </div>
                      <b className="num" style={{ color: p.stock <= 0 ? 'var(--danger)' : p.low ? 'var(--amber)' : undefined }}>
                        {num(p.stock)} {p.unit}
                      </b>
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn soft sm" onClick={() => setMoving(p)}>
                        Existencias
                      </button>
                      {owner ? (
                        <button className="btn ghost sm" onClick={() => setEditing(p)}>
                          Editar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length ? <p className="empty">No hay productos con ese filtro.</p> : null}
      </div>

      {editing ? (
        <ProductForm
          product={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            reloadCats();
          }}
        />
      ) : null}
      {moving ? (
        <StockForm
          product={moving}
          onClose={() => setMoving(null)}
          onSaved={() => {
            setMoving(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function ProductForm({ product, categories, onClose, onSaved }: { product: Product | null; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    category_id: product?.category_id ?? categories[0]?.id ?? null,
    unit: product?.unit ?? 'und',
    cost: product?.cost ?? 0,
    price: product?.price ?? 0,
    min_stock: product?.min_stock ?? 5,
    stock: 0,
    emoji: product?.emoji ?? '📦',
    description: product?.description ?? '',
    in_catalog: product?.in_catalog ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const margin = f.price ? Math.round(((f.price - f.cost) / f.price) * 1000) / 10 : 0;
  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setError(null);
    setBusy(true);
    const body = { ...f, sku: f.sku || null, barcode: f.barcode || null, description: f.description || null, stock: product ? undefined : f.stock };
    try {
      if (product) await api(`/products/${product.id}`, { method: 'PUT', body });
      else await api('/products', { method: 'POST', body });
      toast('Producto guardado');
      onSaved();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!product || !confirm('¿Quitar este producto? Se conserva en el historial de ventas.')) return;
    await api(`/products/${product.id}`, { method: 'DELETE' }).catch(() => null);
    onSaved();
  }

  const money = (v: string) => Number(v.replace(/\D/g, '')) || 0;

  return (
    <Modal title={product ? product.name : 'Nuevo producto'} eyebrow={product ? 'Editar producto' : 'Inventario'} onClose={onClose} wide>
      <div className="form">
        <label className="field">
          <span>Nombre</span>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </label>
        <div className="field">
          <span>Ícono</span>
          <div className="emoji-pick">
            {EMOJIS.map((e) => (
              <button key={e} type="button" className={f.emoji === e ? 'on' : ''} onClick={() => set('emoji', e)}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="grid-2">
          <label className="field">
            <span>Categoría</span>
            <select value={f.category_id ?? ''} onChange={(e) => set('category_id', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Se vende por</span>
            <select value={f.unit} onChange={(e) => set('unit', e.target.value)}>
              <option value="und">Unidad</option>
              <option value="kg">Kilo</option>
              <option value="lb">Libra</option>
              <option value="lt">Litro</option>
              <option value="m">Metro</option>
            </select>
          </label>
          <label className="field">
            <span>Costo (lo que te cuesta)</span>
            <input className="num" inputMode="numeric" value={cop(f.cost)} onChange={(e) => set('cost', money(e.target.value))} />
          </label>
          <label className="field">
            <span>Precio de venta</span>
            <input className="num" inputMode="numeric" value={cop(f.price)} onChange={(e) => set('price', money(e.target.value))} />
          </label>
        </div>
        <div className="preview">
          <span>Ganas por unidad</span>
          <b className="num" style={{ color: margin < 15 ? 'var(--danger)' : 'var(--brand-2)' }}>
            {cop(f.price - f.cost)} · {margin}%
          </b>
        </div>
        <div className="grid-2">
          <label className="field">
            <span>Código interno</span>
            <input value={f.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Se genera solo" />
          </label>
          <label className="field">
            <span>Código de barras</span>
            <input className="num" value={f.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="Escanéalo aquí" />
          </label>
          <label className="field">
            <span>Avisar cuando queden</span>
            <input className="num" inputMode="decimal" value={f.min_stock} onChange={(e) => set('min_stock', Number(e.target.value.replace(',', '.')) || 0)} />
          </label>
          {!product ? (
            <label className="field">
              <span>Existencias iniciales</span>
              <input className="num" inputMode="decimal" value={f.stock} onChange={(e) => set('stock', Number(e.target.value.replace(',', '.')) || 0)} />
            </label>
          ) : null}
        </div>
        <label className="field">
          <span>Descripción para la vitrina (opcional)</span>
          <textarea rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={f.in_catalog} onChange={(e) => set('in_catalog', e.target.checked)} /> Mostrar en la vitrina en línea
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="actions">
          {product ? (
            <button className="link" style={{ color: 'var(--danger)' }} onClick={remove}>
              Quitar producto
            </button>
          ) : null}
          <button className="btn brand" onClick={save} disabled={busy}>
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function StockForm({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<'entrada' | 'ajuste' | 'merma'>('entrada');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState(product.cost);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const value = Number(qty.replace(',', '.')) || 0;
  const after = kind === 'entrada' ? product.stock + value : kind === 'merma' ? product.stock - value : value;

  async function save() {
    setError(null);
    try {
      await api(`/products/${product.id}/moves`, { method: 'POST', body: { kind, qty: value, unit_cost: kind === 'entrada' ? cost : null, note: note || null } });
      toast('Existencias actualizadas');
      onSaved();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <Modal title={product.name} eyebrow="Existencias" onClose={onClose}>
      <div className="form">
        <div className="seg">
          {(
            [
              ['entrada', 'Llegó mercancía'],
              ['ajuste', 'Conteo físico'],
              ['merma', 'Daño o pérdida'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {l}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{kind === 'ajuste' ? `¿Cuántos ${product.unit} hay en realidad?` : `Cantidad (${product.unit})`}</span>
          <input className="num big-input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        </label>
        {kind === 'entrada' ? (
          <label className="field">
            <span>Costo unitario de esta compra</span>
            <input className="num" inputMode="numeric" value={cop(cost)} onChange={(e) => setCost(Number(e.target.value.replace(/\D/g, '')) || 0)} />
            <small>Si cambió, Vexli recalcula el costo promedio.</small>
          </label>
        ) : null}
        <label className="field">
          <span>Nota (opcional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'entrada' ? 'Proveedor, factura…' : kind === 'merma' ? 'Se venció, se rompió…' : 'Inventario de fin de mes'} />
        </label>
        <div className="preview">
          <span>
            Hoy: <b className="num">{num(product.stock)}</b> {product.unit}
          </span>
          <span>
            Queda en: <b className="num" style={{ color: after < 0 ? 'var(--danger)' : 'var(--brand-2)' }}>{num(Math.round(after * 1000) / 1000)}</b> {product.unit}
          </span>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="actions">
          <button className="btn brand" onClick={save} disabled={!qty}>
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

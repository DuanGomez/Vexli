import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { cop, num } from '../lib/format';
import type { Category, Store } from '../lib/types';
import { Loading } from '../lib/ui';
import './catalog.css';

interface Item {
  id: number;
  name: string;
  description: string | null;
  category_id: number | null;
  price: number;
  unit: string;
  emoji: string | null;
  image_url: string | null;
  available: boolean;
  few_left: boolean;
}

export default function Catalog() {
  const { slug } = useParams();
  const [data, setData] = useState<{ store: Store; categories: Category[]; products: Item[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    api<{ store: Store; categories: Category[]; products: Item[] }>(`/public/${slug}`)
      .then((d) => {
        setData(d);
        document.title = `${d.store.name} · pedidos por WhatsApp`;
      })
      .catch((e: ApiError) => setError(e.message));
  }, [slug]);

  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.products ?? []).filter((p) => (!cat || p.category_id === cat) && (!t || p.name.toLowerCase().includes(t)));
  }, [data, q, cat]);

  if (error)
    return (
      <div className="loading">
        <h2>{error}</h2>
        <Link to="/" className="btn ghost">
          Ir a Vexli
        </Link>
      </div>
    );
  if (!data) return <Loading text="Abriendo la vitrina…" />;

  const { store } = data;
  const lines = Object.entries(cart)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ p: data.products.find((x) => x.id === Number(id))!, n }));
  const total = lines.reduce((s, l) => s + Math.round((l.p.price * l.n) / 50) * 50, 0);
  const count = lines.reduce((s, l) => s + l.n, 0);
  const step = (p: Item) => (p.unit === 'und' ? 1 : 0.5);
  const change = (p: Item, d: number) => setCart((c) => ({ ...c, [p.id]: Math.max(0, Math.round(((c[p.id] ?? 0) + d) * 100) / 100) }));

  const message = [
    `Hola ${store.name} 👋 quiero hacer este pedido:`,
    ...lines.map((l) => `• ${num(l.n)} ${l.p.unit === 'und' ? '×' : l.p.unit} ${l.p.name} — ${cop(Math.round((l.p.price * l.n) / 50) * 50)}`),
    `*Total aproximado: ${cop(total)}*`,
    name ? `A nombre de: ${name}` : '',
    address ? `Para enviar a: ${address}` : 'Paso a recogerlo',
  ]
    .filter(Boolean)
    .join('\n');
  const digits = (store.phone ?? '').replace(/\D/g, '');
  const wa = `https://wa.me/${digits.length === 10 ? '57' + digits : digits}?text=${encodeURIComponent(message)}`;

  return (
    <div className="vitrina" style={{ ['--c' as string]: store.color }}>
      <header className="v-head">
        <div className="v-inner">
          <span className="v-tag">{store.is_demo ? 'Tienda de demostración' : 'Pedidos por WhatsApp'}</span>
          <h1>{store.name}</h1>
          {store.address ? (
            <p>
              📍 {store.address}
              {store.city ? `, ${store.city}` : ''}
            </p>
          ) : null}
          <input className="input v-search" placeholder="¿Qué necesitas hoy?" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </header>

      <nav className="v-cats">
        <button className={!cat ? 'on' : ''} onClick={() => setCat(null)}>
          Todo
        </button>
        {data.categories.map((c) => (
          <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
            {c.name}
          </button>
        ))}
      </nav>

      <main className="v-grid">
        {items.map((p) => {
          const n = cart[p.id] ?? 0;
          return (
            <article key={p.id} className={'v-card' + (p.available ? '' : ' off')}>
              <span className="v-emoji" aria-hidden="true">
                {p.emoji ?? '📦'}
              </span>
              <h3>{p.name}</h3>
              {p.description ? <p className="muted">{p.description}</p> : null}
              <div className="v-row">
                <b className="num">
                  {cop(p.price)}
                  {p.unit !== 'und' ? <small> / {p.unit}</small> : null}
                </b>
                {!p.available ? <span className="chip red">Agotado</span> : p.few_left ? <span className="chip amber">Últimas unidades</span> : null}
              </div>
              {p.available ? (
                n ? (
                  <div className="v-step">
                    <button onClick={() => change(p, -step(p))} aria-label="Quitar">
                      −
                    </button>
                    <span className="num">
                      {num(n)} {p.unit}
                    </span>
                    <button onClick={() => change(p, step(p))} aria-label="Agregar">
                      +
                    </button>
                  </div>
                ) : (
                  <button className="btn v-add" onClick={() => change(p, step(p))}>
                    Agregar
                  </button>
                )
              ) : null}
            </article>
          );
        })}
        {!items.length ? <p className="empty">No encontramos «{q}».</p> : null}
      </main>

      {count ? (
        <button className="v-bar" onClick={() => setOpen(true)}>
          <span>
            {lines.length} {lines.length === 1 ? 'producto' : 'productos'}
          </span>
          <b className="num">Ver pedido · {cop(total)}</b>
        </button>
      ) : null}

      {open ? (
        <div className="backdrop" onMouseDown={() => setOpen(false)}>
          <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="dialog-head">
              <h2>Tu pedido</h2>
              <button className="btn ghost icon sm" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="v-lines">
              {lines.map((l) => (
                <div key={l.p.id} className="v-line">
                  <span>
                    {l.p.emoji} {num(l.n)} {l.p.unit === 'und' ? '×' : l.p.unit} {l.p.name}
                  </span>
                  <b className="num">{cop(Math.round((l.p.price * l.n) / 50) * 50)}</b>
                </div>
              ))}
              <div className="v-line v-total">
                <span>Total aproximado</span>
                <b className="num">{cop(total)}</b>
              </div>
            </div>
            <div className="form" style={{ marginTop: 14 }}>
              <label className="field">
                <span>Tu nombre</span>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="field">
                <span>Dirección (si es a domicilio)</span>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Déjala vacía si pasas a recoger" />
              </label>
              <a className="btn lg block v-send" href={wa} target="_blank" rel="noopener">
                Enviar pedido por WhatsApp
              </a>
              <small className="muted" style={{ textAlign: 'center' }}>
                La tienda confirma precios y disponibilidad al responderte.
              </small>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="v-foot">
        Vitrina hecha con <Link to="/">Vexli</Link>
      </footer>
    </div>
  );
}

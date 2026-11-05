import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Category, Store, User } from '../lib/types';
import { Loading, useAuth, useData, useToast } from '../lib/ui';
import './pages.css';

const COLORS = ['#16A34A', '#2563EB', '#DB2777', '#F59E0B', '#7C3AED', '#0EA5E9', '#EF4444', '#0B1220'];

export default function Settings() {
  const toast = useToast();
  const { store, setStore, user } = useAuth();
  const owner = user?.role === 'owner';
  const [f, setF] = useState<Partial<Store>>({ ...store });
  const { data: cats, reload: reloadCats } = useData(() => api<Category[]>('/categories'), []);
  const { data: users, reload: reloadUsers } = useData(() => (owner ? api<User[]>('/users') : Promise.resolve([] as User[])), [owner]);
  const [newCat, setNewCat] = useState('');
  const [cashier, setCashier] = useState({ name: '', email: '', password: '' });
  const url = `${location.origin}/t/${store?.slug}`;

  async function save() {
    try {
      const s = await api<Store>('/store', { method: 'PATCH', body: { name: f.name, phone: f.phone || null, address: f.address || null, city: f.city || null, color: f.color, receipt_note: f.receipt_note || null } });
      setStore(s);
      toast('Datos guardados');
    } catch (e) {
      toast((e as ApiError).message);
    }
  }

  async function addCat() {
    if (!newCat.trim()) return;
    await api('/categories', { method: 'POST', body: { name: newCat.trim(), color: COLORS[(cats?.length ?? 0) % COLORS.length] } }).catch((e: Error) => toast(e.message));
    setNewCat('');
    reloadCats();
  }

  async function removeCat(c: Category) {
    if (!confirm(`¿Borrar la categoría «${c.name}»? Sus productos quedan sin categoría.`)) return;
    await api(`/categories/${c.id}`, { method: 'DELETE' }).catch(() => null);
    reloadCats();
  }

  async function addCashier() {
    try {
      await api('/users', { method: 'POST', body: cashier });
      setCashier({ name: '', email: '', password: '' });
      toast('Cajero creado: ya puede entrar con su correo');
      reloadUsers();
    } catch (e) {
      toast((e as ApiError).message);
    }
  }

  if (!cats) return <Loading />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Ajustes</span>
          <h1>Tu tienda</h1>
        </div>
      </div>
      <div className="split">
        <div style={{ display: 'grid', gap: 14 }}>
          <section className="card panel">
            <h3>Datos de la tienda</h3>
            <div className="grid-2">
              <label className="field">
                <span>Nombre</span>
                <input value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} disabled={!owner} />
              </label>
              <label className="field">
                <span>WhatsApp (para pedidos de la vitrina)</span>
                <input value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} disabled={!owner} inputMode="tel" />
              </label>
              <label className="field">
                <span>Dirección</span>
                <input value={f.address ?? ''} onChange={(e) => setF({ ...f, address: e.target.value })} disabled={!owner} />
              </label>
              <label className="field">
                <span>Ciudad</span>
                <input value={f.city ?? ''} onChange={(e) => setF({ ...f, city: e.target.value })} disabled={!owner} />
              </label>
            </div>
            <label className="field">
              <span>Mensaje al final del recibo</span>
              <input value={f.receipt_note ?? ''} onChange={(e) => setF({ ...f, receipt_note: e.target.value })} disabled={!owner} placeholder="¡Gracias por su compra!" />
            </label>
            <div className="field">
              <span>Color de la vitrina</span>
              <div className="emoji-pick">
                {COLORS.map((c) => (
                  <button key={c} style={{ background: c, borderColor: f.color === c ? '#0b1220' : 'transparent', borderWidth: 3 }} onClick={() => owner && setF({ ...f, color: c })} aria-label={c} />
                ))}
              </div>
            </div>
            {owner ? (
              <button className="btn brand" style={{ justifySelf: 'start' }} onClick={save}>
                Guardar cambios
              </button>
            ) : null}
          </section>

          <section className="card panel">
            <h3>Categorías</h3>
            <ul className="lowlist">
              {cats.map((c) => (
                <li key={c.id} style={{ gridTemplateColumns: '14px 1fr auto auto' }}>
                  <i style={{ width: 12, height: 12, borderRadius: 4, background: c.color }} />
                  <span className="nm">{c.name}</span>
                  <span className="muted">{c.products} productos</span>
                  {owner ? (
                    <button className="link" style={{ color: 'var(--danger)' }} onClick={() => removeCat(c)}>
                      Borrar
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
            {owner ? (
              <div className="toolbar" style={{ margin: 0 }}>
                <input className="input" placeholder="Nueva categoría" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCat()} />
                <button className="btn soft" onClick={addCat}>
                  Agregar
                </button>
              </div>
            ) : null}
          </section>

          {owner ? (
            <section className="card panel">
              <h3>Equipo</h3>
              <ul className="lowlist">
                {(users ?? []).map((u) => (
                  <li key={u.id} style={{ gridTemplateColumns: '1fr auto' }}>
                    <span className="nm">
                      {u.name} <span className="muted">· {u.email}</span>
                    </span>
                    <span className={'chip ' + (u.role === 'owner' ? 'green' : '')}>{u.role === 'owner' ? 'Dueño' : 'Cajero'}</span>
                  </li>
                ))}
              </ul>
              <p className="muted">Los cajeros pueden vender, recibir mercancía y cerrar la caja, pero no cambiar precios ni borrar productos.</p>
              <div className="grid-2">
                <input className="input" placeholder="Nombre" value={cashier.name} onChange={(e) => setCashier({ ...cashier, name: e.target.value })} />
                <input className="input" placeholder="Correo" value={cashier.email} onChange={(e) => setCashier({ ...cashier, email: e.target.value })} />
                <input className="input" placeholder="Contraseña (mín. 6)" type="password" value={cashier.password} onChange={(e) => setCashier({ ...cashier, password: e.target.value })} />
                <button className="btn soft" onClick={addCashier}>
                  Crear cajero
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="card detail">
          <span className="eyebrow">Vitrina en línea</span>
          <h3>Tu catálogo para compartir</h3>
          <p className="muted">Tus clientes ven productos, precios y disponibilidad, arman el pedido y te lo mandan por WhatsApp.</p>
          <div className="preview" style={{ wordBreak: 'break-all' }}>
            <b>{url}</b>
          </div>
          <div className="toolbar" style={{ margin: 0 }}>
            <button className="btn soft sm" onClick={() => navigator.clipboard.writeText(url).then(() => toast('Enlace copiado'))}>
              Copiar enlace
            </button>
            <a className="btn ghost sm" href={url} target="_blank" rel="noopener">
              Abrir
            </a>
          </div>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=440x440&margin=8&data=${encodeURIComponent(url)}`}
            alt="Código QR de la vitrina"
            width={220}
            height={220}
            style={{ justifySelf: 'center', borderRadius: 12, border: '1px solid var(--line)', background: '#fff', padding: 8 }}
          />
        </aside>
      </div>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../app/Shell';
import { api, ApiError } from '../lib/api';
import type { Session } from '../lib/types';
import { useAuth } from '../lib/ui';
import '../app/pages.css';
import './auth.css';

function Side({ title, text }: { title: string; text: string }) {
  return (
    <aside className="auth-side">
      <Link to="/">
        <Logo light />
      </Link>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <small>Inventario y caja diaria para tiendas</small>
    </aside>
  );
}

export function Login() {
  const { start } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent, demo = false) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      start(demo ? await api<Session>('/auth/demo', { method: 'POST' }) : await api<Session>('/auth/login', { method: 'POST', body: { email, password } }));
      navigate('/app');
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <Side title="Tu caja te espera." text="Entra para vender, revisar existencias y cerrar el día." />
      <main>
        <form onSubmit={submit} className="form auth-form">
          <h1>Entrar</h1>
          <label className="field">
            <span>Correo</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn brand lg block" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
          <button type="button" className="btn ghost block" onClick={() => submit(undefined, true)} disabled={busy}>
            Probar la demo
          </button>
          <p className="alt">
            ¿No tienes tienda en Vexli? <Link to="/crear-cuenta" className="link">Créala gratis</Link>
          </p>
        </form>
      </main>
    </div>
  );
}

const KINDS = [
  ['minimercado', 'Minimercado'],
  ['papeleria', 'Papelería'],
  ['ropa', 'Ropa'],
  ['ferreteria', 'Ferretería'],
  ['otro', 'Otro'],
] as const;

export function Register() {
  const { start } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ store: '', kind: 'minimercado', name: '', phone: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      start(await api<Session>('/auth/register', { method: 'POST', body: { ...f, phone: f.phone || null } }));
      navigate('/app/inventario');
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <Side title="Tu tienda, ordenada desde hoy." text="Te dejamos las categorías listas según tu negocio. Carga tus productos y empieza a vender." />
      <main>
        <form onSubmit={submit} className="form auth-form">
          <h1>Crea tu tienda</h1>
          <label className="field">
            <span>Nombre de la tienda</span>
            <input value={f.store} onChange={(e) => setF({ ...f, store: e.target.value })} required />
          </label>
          <div className="field">
            <span>¿Qué vendes?</span>
            <div className="kinds">
              {KINDS.map(([k, l]) => (
                <button type="button" key={k} className={f.kind === k ? 'on' : ''} onClick={() => setF({ ...f, kind: k })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid-2">
            <label className="field">
              <span>Tu nombre</span>
              <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" required />
            </label>
            <label className="field">
              <span>WhatsApp</span>
              <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" />
            </label>
          </div>
          <label className="field">
            <span>Correo</span>
            <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" required />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" minLength={6} required />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn brand lg block" disabled={busy}>
            {busy ? 'Creando…' : 'Crear mi tienda'}
          </button>
          <p className="alt">
            ¿Ya tienes cuenta? <Link to="/entrar" className="link">Entra</Link>
          </p>
        </form>
      </main>
    </div>
  );
}

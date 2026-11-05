import { Suspense } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Loading, useAuth } from '../lib/ui';
import './shell.css';

const NAV = [
  { to: '/app', label: 'Resumen', icon: '◉', end: true },
  { to: '/app/caja', label: 'Vender', icon: '⌁', accent: true },
  { to: '/app/inventario', label: 'Inventario', icon: '▦' },
  { to: '/app/movimientos', label: 'Movimientos', icon: '⇅' },
  { to: '/app/ventas', label: 'Ventas', icon: '≡' },
  { to: '/app/cierre', label: 'Caja y cierre', icon: '◎' },
  { to: '/app/reportes', label: 'Reportes', icon: '▲' },
  { to: '/app/ajustes', label: 'Ajustes', icon: '⚙' },
];
const MOBILE = ['/app', '/app/caja', '/app/inventario', '/app/cierre', '/app/reportes'];

export function Logo({ light }: { light?: boolean }) {
  return (
    <span className={'logo' + (light ? ' light' : '')}>
      <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill={light ? '#bef264' : '#0b1220'} />
        <path d="M16 18h9l7 12 7-12h9L37 34l11 12h-9l-7-9-7 9h-9l11-12z" fill={light ? '#0b1220' : '#bef264'} />
      </svg>
      Vexli
    </span>
  );
}

export default function Shell() {
  const { user, store, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <aside className="side">
        <Link to="/" className="side-logo">
          <Logo light />
        </Link>
        <div className="store">
          <span className="store-dot" style={{ background: store?.color }} />
          <div>
            <strong>{store?.name}</strong>
            <span>
              {user?.name} · {user?.role === 'owner' ? 'Dueño' : 'Cajero'}
            </span>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '') + (n.accent ? ' accent' : '')}>
              <span className="ico" aria-hidden="true">
                {n.icon}
              </span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <a className="vitrina" href={`/t/${store?.slug}`} target="_blank" rel="noopener">
            Ver mi vitrina ↗
          </a>
          <button
            className="out"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main" style={{ ['--demo-h' as string]: store?.is_demo ? '38px' : '0px' }}>
        {store?.is_demo ? (
          <div className="demo-bar">
            Estás en la <b>demo</b> de una tienda real: vende, anula y cierra la caja. Se reinicia sola cada día.{' '}
            <Link to="/crear-cuenta">Crear mi tienda</Link>
          </div>
        ) : null}
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>

      <nav className="bottom">
        {NAV.filter((n) => MOBILE.includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '') + (n.accent ? ' accent' : '')}>
            <span aria-hidden="true">{n.icon}</span>
            {n.label === 'Caja y cierre' ? 'Caja' : n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

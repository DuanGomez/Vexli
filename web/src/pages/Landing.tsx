import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../app/Shell';
import { api, ApiError } from '../lib/api';
import type { Session } from '../lib/types';
import { useAuth, useToast } from '../lib/ui';
import './landing.css';

const MOCK = [
  { e: '🥤', n: 'Gaseosa 400 ml', p: '$ 2.800', q: 2 },
  { e: '🍞', n: 'Pan tajado', p: '$ 6.200', q: 1 },
  { e: '🥛', n: 'Leche entera', p: '$ 4.400', q: 0 },
  { e: '🥚', n: 'Huevos x 12', p: '$ 11.000', q: 0 },
  { e: '🍌', n: 'Banano', p: '$ 3.600', q: 0 },
  { e: '🧻', n: 'Papel x 4', p: '$ 8.900', q: 0 },
];

export default function Landing() {
  const { start, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function demo() {
    setBusy(true);
    try {
      start(await api<Session>('/auth/demo', { method: 'POST' }));
      navigate('/app');
    } catch (e) {
      toast((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      <header className="nav">
        <Link to="/" className="nav-logo">
          <Logo light />
        </Link>
        <nav>
          <a href="#que-hace">Qué hace</a>
          <a href="#caja">Cierre de caja</a>
          <a href="#vitrina">Vitrina</a>
        </nav>
        <div className="nav-cta">
          {user ? (
            <Link to="/app" className="btn lime sm">
              Ir a mi tienda
            </Link>
          ) : (
            <>
              <Link to="/entrar" className="btn sm ghost-dark">
                Entrar
              </Link>
              <Link to="/crear-cuenta" className="btn lime sm">
                Crear mi tienda
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="copy">
          <span className="tag">Inventario + caja diaria para tiendas</span>
          <h1>
            Tu tienda,
            <br />
            <span>bajo control.</span>
          </h1>
          <p>
            Vende rápido con lector de código de barras, sabe qué se está acabando antes de que se acabe y cierra la caja sin cuaderno ni
            calculadora.
          </p>
          <div className="cta">
            <button className="btn lime lg" onClick={demo} disabled={busy}>
              {busy ? 'Abriendo la tienda…' : 'Probar con una tienda real'}
            </button>
            <Link to="/t/tienda-la-esquina" className="btn lg ghost-dark">
              Ver la vitrina
            </Link>
          </div>
          <ul className="ticks">
            <li>Funciona en el computador y en el celular</li>
            <li>Efectivo, transferencia y tarjeta</li>
            <li>Exporta a Excel</li>
          </ul>
        </div>

        <div className="mock" aria-hidden="true">
          <div className="mock-pos">
            <div className="mock-grid">
              {MOCK.map((m) => (
                <div className={'mock-tile' + (m.q ? ' in' : '')} key={m.n}>
                  {m.q ? <span className="mock-badge">{m.q}</span> : null}
                  <span className="mock-emoji">{m.e}</span>
                  <span className="mock-name">{m.n}</span>
                  <b>{m.p}</b>
                </div>
              ))}
            </div>
            <div className="mock-ticket">
              <span className="mock-eyebrow">VENTA ACTUAL</span>
              <div className="mock-line">
                <span>2 × Gaseosa 400 ml</span>
                <b>$ 5.600</b>
              </div>
              <div className="mock-line">
                <span>1 × Pan tajado</span>
                <b>$ 6.200</b>
              </div>
              <div className="mock-total">
                <span>Total</span>
                <b>$ 11.800</b>
              </div>
              <div className="mock-change">
                Recibe $ 20.000 · <b>Cambio $ 8.200</b>
              </div>
              <div className="mock-btn">Cobrar $ 11.800</div>
            </div>
          </div>
          <div className="mock-alert">
            <span>⚠️</span>
            <div>
              <b>Atún en lata</b>
              <small>Quedan 3 · pide más</small>
            </div>
          </div>
        </div>
      </section>

      <section id="que-hace" className="pillars">
        <article>
          <span className="pi">⌁</span>
          <h3>Vende en segundos</h3>
          <p>Busca por nombre o pasa el lector de código de barras. Cobra en efectivo, transferencia, tarjeta o mixto y Vexli calcula el cambio.</p>
        </article>
        <article>
          <span className="pi">▦</span>
          <h3>Inventario que se cuida solo</h3>
          <p>Cada venta descuenta existencias. Registra compras con su costo, conteos físicos y mermas, y recibe alertas de lo que se está acabando.</p>
        </article>
        <article>
          <span className="pi">◎</span>
          <h3>Caja que cuadra</h3>
          <p>Abre con una base, registra pagos a proveedores y al final cuenta billetes: Vexli te dice si sobra o falta y deja el historial.</p>
        </article>
        <article>
          <span className="pi">▲</span>
          <h3>Números claros</h3>
          <p>Ventas por hora y por día, ganancia estimada, productos estrella, categorías y medios de pago. Todo exportable a Excel.</p>
        </article>
      </section>

      <section id="caja" className="compare">
        <div>
          <span className="eyebrow">Del cuaderno a Vexli</span>
          <h2>El cierre de caja ya no es un dolor de cabeza</h2>
        </div>
        <div className="vs">
          <div className="before">
            <h4>Antes</h4>
            <ul>
              <li>Sumar tiquetes a mano al final del día</li>
              <li>No saber si faltó plata o se anotó mal</li>
              <li>Enterarse de que no hay leche cuando el cliente la pide</li>
              <li>Adivinar qué productos dejan más ganancia</li>
            </ul>
          </div>
          <div className="after">
            <h4>Con Vexli</h4>
            <ul>
              <li>El efectivo esperado se calcula solo</li>
              <li>Arqueo por billetes y diferencia al instante</li>
              <li>Alertas de existencias mínimas por producto</li>
              <li>Margen por producto y por categoría</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="vitrina" className="vitrina-band">
        <div>
          <span className="tag">Vitrina en línea</span>
          <h2>Tus vecinos piden por WhatsApp, con tu catálogo</h2>
          <p>Comparte un enlace o un QR: ven precios y disponibilidad real, arman el pedido y te llega listo a tu WhatsApp.</p>
          <Link to="/t/tienda-la-esquina" className="btn lime">
            Ver vitrina de ejemplo
          </Link>
        </div>
        <div className="wa">
          <div className="wa-msg">
            Hola 👋 quiero pedir:
            <br />• 2 × Leche entera 1 L
            <br />• 1 × Huevos AA x 12
            <br />• 1 × Pan tajado 500 g
            <br />
            <b>Total: $ 26.000</b>
          </div>
        </div>
      </section>

      <section className="final">
        <h2>Abre tu tienda en Vexli hoy</h2>
        <p>Crea tu cuenta, carga tus productos y empieza a vender. Te dejamos las categorías listas según tu tipo de negocio.</p>
        <div className="cta">
          <Link to="/crear-cuenta" className="btn brand lg">
            Crear mi tienda gratis
          </Link>
          <button className="btn ghost lg" onClick={demo} disabled={busy}>
            Probar la demo
          </button>
        </div>
      </section>

      <footer className="foot">
        <span>
          Vexli · hecho en Medellín por{' '}
          <a href="https://dcodea.dcodea-correo.workers.dev" target="_blank" rel="noopener">
            Dcodea
          </a>
        </span>
        <a href="https://github.com/DuanGomez/Vexli" target="_blank" rel="noopener">
          Código en GitHub
        </a>
      </footer>
    </div>
  );
}

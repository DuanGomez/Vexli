import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="loading" style={{ minHeight: '100vh', alignContent: 'center' }}>
      <span className="eyebrow">Error 404</span>
      <h1 style={{ fontSize: 'clamp(34px, 6vw, 60px)', maxWidth: '14ch' }}>Este pasillo de la tienda no existe.</h1>
      <p>El enlace puede estar mal escrito o la tienda cambió su dirección.</p>
      <Link to="/" className="btn brand">
        Volver al inicio
      </Link>
    </main>
  );
}

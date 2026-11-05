# Vexli

**Inventario y caja diaria para tiendas pequeñas:** minimercados, papelerías, tiendas de ropa y ferreterías.

Vende rápido con lector de código de barras, controla las existencias sin cuaderno y cierra la caja sabiendo si sobra o falta dinero. Los clientes piden desde una vitrina en línea que llega por WhatsApp.

- App: https://vexli-caja.pages.dev
- Demo: botón «Probar con una tienda real» (minimercado con un mes de ventas; se regenera sola cada día)
- Vitrina de ejemplo: https://vexli-caja.pages.dev/t/tienda-la-esquina

## Qué hace

- **Vender**: buscador y lector de código de barras (Enter agrega el producto), categorías, ticket con cantidades (también por peso), descuento y cobro en efectivo, transferencia, tarjeta o mixto con cálculo del cambio y billetes rápidos. Recibo para imprimir o enviar por WhatsApp. Atajos F2 (buscar) y F9 (cobrar).
- **Inventario**: productos con costo, precio, margen, código de barras y existencias mínimas; entradas de mercancía con costo promedio ponderado, conteos físicos y mermas. Cada cambio queda en el historial de movimientos. Exportación a Excel.
- **Caja**: turnos con base inicial, entradas y salidas de efectivo, efectivo esperado calculado solo y cierre con arqueo por billetes y monedas. Historial de cierres con diferencias.
- **Ventas**: historial por día, detalle, recibo y anulación (devuelve las existencias).
- **Resumen y reportes**: ventas de hoy contra ayer a la misma hora, ganancia estimada, ventas por hora y por día, medios de pago, productos estrella, categorías y días más fuertes.
- **Equipo**: dueño y cajeros (los cajeros no cambian precios ni borran productos).
- **Vitrina pública** (`/t/<tienda>`): catálogo con disponibilidad real y pedido armado por WhatsApp.

## Tecnología

| Parte | Tecnología |
|---|---|
| Frontend (`web/`) | React 19 + TypeScript, Vite, React Router, gráficas en SVG propio |
| API (`api/`) | Python 3.13 · FastAPI · SQLAlchemy 2 · Pydantic · JWT |
| Base de datos | PostgreSQL (Neon) · SQLite en desarrollo |
| Despliegue | Cloudflare Pages (frontend) · Render (API) |

## Desarrollo local

```bash
# API (http://127.0.0.1:8020) — crea la base SQLite y la tienda de demostración
cd api
python -m venv .venv && .venv/Scripts/activate   # en macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8020

# Frontend (http://localhost:5320)
cd web
npm install
npx vite --port 5320
```

## Despliegue

1. **Base de datos:** crea una base en [Neon](https://neon.tech) y copia la cadena de conexión.
2. **API:** en Render → *New → Blueprint*, elige este repositorio y pega la cadena en `DATABASE_URL`. Al arrancar crea las tablas y la tienda de demostración.
3. **Frontend:** `cd web && npm run build && npx wrangler pages deploy dist --project-name vexli-caja`.

---

Hecho por [Duan Gómez](https://duangomez.pages.dev) · [Dcodea](https://dcodea.pages.dev)

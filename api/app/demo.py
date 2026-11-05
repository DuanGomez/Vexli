"""Tienda de demostración: un minimercado de barrio con un mes de ventas.

Se regenera sola cuando tiene más de 20 horas, para que la demo siempre esté
alrededor de la fecha de hoy y nadie la deje en mal estado para el siguiente.
"""

import random
import threading
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .db import now
from .models import CashMove, CashSession, Category, Product, Sale, SaleItem, StockMove, Store, User
from .security import hash_password

DEMO_SLUG = "tienda-la-esquina"
DEMO_EMAIL = "demo@vexli.app"

CATEGORIES = [
    ("Bebidas", "#2563EB"),
    ("Lácteos y huevos", "#0EA5E9"),
    ("Granos y despensa", "#F59E0B"),
    ("Aseo", "#7C3AED"),
    ("Snacks y dulces", "#DB2777"),
    ("Panadería", "#EA580C"),
    ("Frutas y verduras", "#16A34A"),
]

# (categoría, nombre, emoji, costo, precio, existencias, mínimo, unidad, popularidad)
PRODUCTS = [
    (0, "Gaseosa Cola 1.5 L", "🥤", 4200, 6000, 34, 12, "und", 9),
    (0, "Gaseosa Cola 400 ml", "🥤", 1700, 2800, 58, 24, "und", 10),
    (0, "Agua sin gas 600 ml", "💧", 900, 1800, 46, 24, "und", 8),
    (0, "Jugo de naranja 1 L", "🧃", 3600, 5200, 9, 10, "und", 4),
    (0, "Cerveza lata 330 ml", "🍺", 2300, 3500, 72, 36, "und", 9),
    (0, "Bebida energizante 250 ml", "⚡", 2600, 4000, 18, 12, "und", 5),
    (0, "Café en grano 500 g", "☕", 13500, 19500, 7, 6, "und", 3),
    (1, "Leche entera 1 L", "🥛", 3300, 4400, 26, 18, "und", 10),
    (1, "Huevos AA x 12", "🥚", 8200, 11000, 14, 10, "und", 8),
    (1, "Queso campesino 500 g", "🧀", 7800, 10900, 6, 6, "und", 5),
    (1, "Yogur de fresa 1 L", "🍓", 5400, 7600, 11, 6, "und", 4),
    (1, "Mantequilla 250 g", "🧈", 5200, 7300, 9, 5, "und", 3),
    (1, "Kumis 1 L", "🥛", 4300, 6000, 4, 5, "und", 3),
    (2, "Arroz blanco 1 kg", "🍚", 3500, 4800, 40, 20, "und", 9),
    (2, "Frijol rojo 500 g", "🫘", 4100, 5900, 22, 10, "und", 5),
    (2, "Lenteja 500 g", "🫘", 2600, 3800, 18, 10, "und", 4),
    (2, "Aceite vegetal 1 L", "🫗", 8900, 12500, 15, 8, "und", 6),
    (2, "Azúcar 1 kg", "🍬", 3800, 5200, 27, 12, "und", 7),
    (2, "Sal 1 kg", "🧂", 1500, 2400, 20, 8, "und", 3),
    (2, "Panela x 2", "🟫", 3200, 4600, 16, 8, "und", 5),
    (2, "Pasta spaghetti 500 g", "🍝", 2400, 3600, 30, 12, "und", 6),
    (2, "Atún en lata 160 g", "🐟", 4600, 6500, 3, 8, "und", 5),
    (2, "Chocolate de mesa 250 g", "🍫", 4900, 6800, 12, 6, "und", 4),
    (2, "Harina de maíz 1 kg", "🌽", 3300, 4700, 21, 10, "und", 6),
    (3, "Jabón de baño x 3", "🧼", 5400, 7900, 15, 8, "und", 4),
    (3, "Papel higiénico x 4", "🧻", 6200, 8900, 19, 10, "und", 6),
    (3, "Detergente en polvo 1 kg", "🫧", 8700, 12400, 8, 6, "und", 4),
    (3, "Lavaloza crema 450 g", "🍽️", 3900, 5600, 2, 6, "und", 4),
    (3, "Crema dental 100 ml", "🪥", 4300, 6200, 13, 6, "und", 3),
    (3, "Shampoo 400 ml", "🧴", 10900, 15500, 7, 4, "und", 2),
    (3, "Cloro 1 L", "🧪", 2600, 3900, 16, 8, "und", 3),
    (4, "Papas fritas 110 g", "🥔", 2900, 4500, 26, 12, "und", 8),
    (4, "Chocolatina 40 g", "🍫", 1300, 2200, 48, 20, "und", 8),
    (4, "Galletas de soda x 6", "🍪", 2700, 3900, 23, 10, "und", 5),
    (4, "Maní salado 100 g", "🥜", 1900, 3000, 17, 8, "und", 4),
    (4, "Bombón de chicle", "🍭", 250, 500, 160, 60, "und", 7),
    (4, "Helado de paleta", "🍦", 1600, 2800, 5, 12, "und", 5),
    (5, "Pan tajado 500 g", "🍞", 4200, 6200, 12, 8, "und", 7),
    (5, "Pan francés", "🥖", 350, 700, 60, 30, "und", 10),
    (5, "Arepas x 5", "🫓", 2600, 3900, 18, 10, "und", 8),
    (5, "Pandebono", "🥯", 900, 1800, 24, 15, "und", 7),
    (5, "Croissant", "🥐", 1300, 2500, 10, 8, "und", 4),
    (6, "Banano", "🍌", 2200, 3600, 14.5, 5, "kg", 6),
    (6, "Tomate chonto", "🍅", 2600, 4200, 8.2, 4, "kg", 6),
    (6, "Cebolla cabezona", "🧅", 2100, 3500, 9.6, 4, "kg", 5),
    (6, "Papa pastusa", "🥔", 1700, 2900, 22.0, 10, "kg", 7),
    (6, "Aguacate", "🥑", 2600, 4500, 11, 6, "und", 5),
    (6, "Limón tahití", "🍋", 2300, 3900, 3.1, 3, "kg", 4),
    (6, "Plátano verde", "🍌", 1300, 2200, 26, 10, "und", 6),
    (6, "Cilantro (atado)", "🌿", 500, 1000, 12, 6, "und", 3),
]


def _wipe(db: Session, store_id: int) -> None:
    sale_ids = select(Sale.id).where(Sale.store_id == store_id)
    session_ids = select(CashSession.id).where(CashSession.store_id == store_id)
    db.execute(delete(StockMove).where(StockMove.store_id == store_id))
    db.execute(delete(SaleItem).where(SaleItem.sale_id.in_(sale_ids)))
    db.execute(delete(Sale).where(Sale.store_id == store_id))
    db.execute(delete(CashMove).where(CashMove.session_id.in_(session_ids)))
    db.execute(delete(CashSession).where(CashSession.store_id == store_id))
    db.execute(delete(Product).where(Product.store_id == store_id))
    db.execute(delete(Category).where(Category.store_id == store_id))
    db.execute(delete(User).where(User.store_id == store_id))
    db.execute(delete(Store).where(Store.id == store_id))


def freshen(db: Session) -> None:
    s = db.scalar(select(Store).where(Store.slug == DEMO_SLUG))
    if s and now() - s.created_at < timedelta(hours=20):
        return
    reset(db)


def reset(db: Session) -> None:
    rnd = random.Random(now().strftime("%Y%m%d"))
    old = db.scalar(select(Store).where(Store.slug == DEMO_SLUG))
    if old:
        _wipe(db, old.id)
        db.flush()

    store = Store(
        slug=DEMO_SLUG, name="Tienda La Esquina", kind="minimercado", phone="3005558899",
        address="Calle 44 # 79-15, Laureles", city="Medellín", color="#16A34A",
        receipt_note="¡Gracias por su compra, vecino!", is_demo=True,
    )
    db.add(store)
    db.flush()
    owner = User(store_id=store.id, name="Rosa Gómez", email=DEMO_EMAIL, password_hash=hash_password("demo-vexli"), role="owner")
    cashier = User(store_id=store.id, name="Camilo Díaz", email="cajero-demo@vexli.app", password_hash=hash_password("demo-vexli"), role="cajero")
    db.add_all([owner, cashier])

    cats = [Category(store_id=store.id, name=n, color=c, position=i) for i, (n, c) in enumerate(CATEGORIES)]
    db.add_all(cats)
    db.flush()

    products, weights = [], []
    for i, (ci, name, emoji, cost, price, stock, minimum, unit, pop) in enumerate(PRODUCTS):
        p = Product(
            store_id=store.id, category_id=cats[ci].id, sku=f"P{i + 1:04d}", barcode=f"770{1000000 + i * 7919:09d}"[:13],
            name=name, emoji=emoji, cost=cost, price=price, stock=float(stock), min_stock=float(minimum), unit=unit,
        )
        products.append(p)
        weights.append(pop)
    db.add_all(products)
    db.flush()

    t = now()
    today = t.replace(hour=0, minute=0, second=0)
    number = 0
    sales, moves = [], []
    for back in range(30, -1, -1):
        day = today - timedelta(days=back)
        weekend = day.isoweekday() >= 6
        opened = day.replace(hour=7, minute=rnd.randint(0, 20))
        is_today = back == 0
        if is_today and t < opened:
            break
        sess = CashSession(store_id=store.id, opened_by=cashier.id if day.day % 2 else owner.id, opened_at=opened, opening_amount=150_000)
        db.add(sess)
        db.flush()
        close_at = day.replace(hour=21, minute=rnd.randint(0, 25))
        end = min(close_at, t) if is_today else close_at
        count = rnd.randint(70, 105) if weekend else rnd.randint(48, 80)
        if is_today:
            count = int(count * max(0.0, (t - opened).total_seconds()) / (close_at - opened).total_seconds())
        stamps = sorted(opened + timedelta(seconds=rnd.uniform(0, (end - opened).total_seconds())) for _ in range(count))
        cash_total = 0
        for at in stamps:
            number += 1
            lines, subtotal, cost = [], 0, 0
            for p in set(rnd.choices(products, weights=weights, k=rnd.choice([1, 1, 1, 2, 2, 3, 4, 5]))):
                qty = round(rnd.uniform(0.4, 2.5), 2) if p.unit == "kg" else float(rnd.choice([1, 1, 1, 2, 2, 3, 6] if p.price < 3000 else [1, 1, 1, 2]))
                total = int(round(qty * p.price / 50) * 50)
                lines.append(SaleItem(product_id=p.id, name=p.name, unit=p.unit, qty=qty, unit_price=p.price, unit_cost=p.cost, total=total))
                subtotal += total
                cost += round(qty * p.cost)
            discount = round(subtotal * 0.05 / 100) * 100 if rnd.random() < 0.04 else 0
            total = subtotal - discount
            method = rnd.choices(["efectivo", "transferencia", "tarjeta"], weights=[58, 32, 10])[0]
            received = 0
            if method == "efectivo":
                received = next(b for b in [total, 2000, 5000, 10000, 20000, 50000, 100000, 10**9] if b >= total and (b == total or rnd.random() < 0.7))
                received = received if received < 10**9 else total
                cash_total += total
            voided = rnd.random() < 0.012
            sale = Sale(
                store_id=store.id, session_id=sess.id, number=number, user_id=sess.opened_by, created_at=at, subtotal=subtotal,
                discount=discount, total=total, cost_total=cost, method=method,
                paid_cash=total if method == "efectivo" else 0, paid_transfer=total if method == "transferencia" else 0,
                paid_card=total if method == "tarjeta" else 0, cash_received=received, change=max(0, received - total) if method == "efectivo" else 0,
                status="anulada" if voided else "completada", void_reason="Cliente cambió de opinión" if voided else None, items=lines,
            )
            if voided and method == "efectivo":
                cash_total -= total
            sales.append(sale)
        # Pago a un proveedor algunos días
        out = 0
        if rnd.random() < 0.45:
            out = rnd.choice([38_000, 64_000, 120_000])
            db.add(CashMove(session_id=sess.id, kind="egreso", amount=out, reason=rnd.choice(["Pago proveedor de pan", "Domiciliario", "Pago proveedor de huevos"]), created_at=opened + timedelta(hours=3)))
        if not is_today:
            expected = 150_000 + cash_total - out
            sess.closed_at, sess.closed_by = close_at, owner.id
            sess.expected_cash = expected
            sess.counted_cash = expected + rnd.choice([0, 0, 0, 0, -500, 1000, -2000])
    db.add_all(sales)
    db.flush()

    # Movimientos de inventario recientes (los de las ventas de hoy y ayer, y compras)
    for s in sales:
        if s.created_at >= today - timedelta(days=1):
            for i in s.items:
                moves.append(StockMove(store_id=store.id, product_id=i.product_id, kind="venta", qty=-i.qty, stock_after=0, note=f"Venta #{s.number}", user_id=s.user_id, sale_id=s.id, created_at=s.created_at))
    for p in rnd.sample(products, 9):
        q = float(rnd.choice([12, 24, 30, 36]))
        moves.append(StockMove(store_id=store.id, product_id=p.id, kind="entrada", qty=q, stock_after=0, unit_cost=p.cost, note="Compra a proveedor", user_id=owner.id, created_at=today - timedelta(days=rnd.randint(1, 4), hours=-9)))
    shrink = rnd.choice(products[-8:])
    moves.append(StockMove(store_id=store.id, product_id=shrink.id, kind="merma", qty=-1.0, stock_after=0, note="Producto dañado", user_id=owner.id, created_at=today - timedelta(days=1, hours=-18)))
    # Existencia después de cada movimiento, hacia atrás desde la existencia actual
    by_product: dict[int, list[StockMove]] = {}
    for m in moves:
        by_product.setdefault(m.product_id, []).append(m)
    stock = {p.id: p.stock for p in products}
    for pid, items in by_product.items():
        level = stock[pid]
        for m in sorted(items, key=lambda m: m.created_at, reverse=True):
            m.stock_after = round(level, 3)
            level -= m.qty
    db.add_all(moves)
    db.commit()


_busy = threading.Lock()


def freshen_later() -> None:
    """Regenera la demo en segundo plano: nadie espera a que se rehaga."""

    def run() -> None:
        if not _busy.acquire(blocking=False):
            return
        try:
            from .db import SessionLocal

            with SessionLocal() as db:
                freshen(db)
        except Exception as e:  # la demo vieja sigue sirviendo mientras tanto
            print("No se pudo regenerar la demo:", e)
        finally:
            _busy.release()

    threading.Thread(target=run, daemon=True).start()

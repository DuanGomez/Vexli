"""Cómo se ve cada cosa en las respuestas JSON."""

from .models import CashMove, CashSession, Category, Product, Sale, StockMove, Store, User


def dt(value):
    return value.strftime("%Y-%m-%d %H:%M") if value else None


def store(s: Store) -> dict:
    return {
        "id": s.id,
        "slug": s.slug,
        "name": s.name,
        "kind": s.kind,
        "phone": s.phone,
        "address": s.address,
        "city": s.city,
        "color": s.color,
        "receipt_note": s.receipt_note,
        "is_demo": s.is_demo,
    }


def user(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role}


def category(c: Category, count: int | None = None) -> dict:
    out = {"id": c.id, "name": c.name, "color": c.color}
    if count is not None:
        out["products"] = count
    return out


def product(p: Product) -> dict:
    margin = round((p.price - p.cost) / p.price * 100, 1) if p.price else 0
    return {
        "id": p.id,
        "sku": p.sku,
        "barcode": p.barcode,
        "name": p.name,
        "description": p.description,
        "category_id": p.category_id,
        "unit": p.unit,
        "cost": p.cost,
        "price": p.price,
        "margin": margin,
        "stock": round(p.stock, 3),
        "min_stock": p.min_stock,
        "low": p.active and p.stock <= p.min_stock,
        "image_url": p.image_url,
        "emoji": p.emoji,
        "active": p.active,
        "in_catalog": p.in_catalog,
        "updated_at": dt(p.updated_at),
    }


def move(m: StockMove) -> dict:
    return {
        "id": m.id,
        "kind": m.kind,
        "qty": round(m.qty, 3),
        "stock_after": round(m.stock_after, 3),
        "unit_cost": m.unit_cost,
        "note": m.note,
        "sale_id": m.sale_id,
        "created_at": dt(m.created_at),
        "user": m.user.name if m.user else None,
        "product": {"id": m.product.id, "name": m.product.name, "unit": m.product.unit, "emoji": m.product.emoji},
    }


def sale(s: Sale, items: bool = True) -> dict:
    out = {
        "id": s.id,
        "number": s.number,
        "created_at": dt(s.created_at),
        "subtotal": s.subtotal,
        "discount": s.discount,
        "total": s.total,
        "profit": s.total - s.cost_total,
        "method": s.method,
        "paid_cash": s.paid_cash,
        "paid_transfer": s.paid_transfer,
        "paid_card": s.paid_card,
        "cash_received": s.cash_received,
        "change": s.change,
        "customer": s.customer,
        "status": s.status,
        "void_reason": s.void_reason,
        "cashier": s.user.name if s.user else None,
        "session_id": s.session_id,
        "units": round(sum(i.qty for i in s.items), 3),
    }
    if items:
        out["items"] = [
            {"product_id": i.product_id, "name": i.name, "unit": i.unit, "qty": round(i.qty, 3), "unit_price": i.unit_price, "total": i.total}
            for i in s.items
        ]
    return out


def cash_move(m: CashMove) -> dict:
    return {"id": m.id, "kind": m.kind, "amount": m.amount, "reason": m.reason, "created_at": dt(m.created_at)}


def session(s: CashSession, summary: dict | None = None) -> dict:
    out = {
        "id": s.id,
        "opened_at": dt(s.opened_at),
        "opening_amount": s.opening_amount,
        "opened_by": s.opener.name if s.opener else None,
        "closed_at": dt(s.closed_at),
        "closed_by": s.closer.name if s.closer else None,
        "expected_cash": s.expected_cash,
        "counted_cash": s.counted_cash,
        "difference": (s.counted_cash - s.expected_cash) if s.closed_at and s.counted_cash is not None and s.expected_cash is not None else None,
        "notes": s.notes,
        "open": s.closed_at is None,
    }
    if summary is not None:
        out["summary"] = summary
    return out

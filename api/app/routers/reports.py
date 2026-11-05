"""Resumen del día, reportes por rango, exportación y vitrina pública."""

import csv
import io
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import present
from ..db import get_db, now
from ..models import Category, Product, Sale, Store, User
from ..security import current_user
from .cash import open_session, summary

router = APIRouter(tags=["reportes"])


def _sales(db: Session, store_id: int, start: datetime, end: datetime) -> list[Sale]:
    return db.scalars(
        select(Sale).options(selectinload(Sale.items))
        .where(Sale.store_id == store_id, Sale.status == "completada", Sale.created_at >= start, Sale.created_at < end)
    ).all()


def _top(sales: list[Sale], limit: int = 8) -> list[dict]:
    acc: dict = defaultdict(lambda: {"qty": 0.0, "total": 0, "profit": 0})
    for s in sales:
        for i in s.items:
            a = acc[(i.product_id, i.name, i.unit)]
            a["qty"] += i.qty
            a["total"] += i.total
            a["profit"] += i.total - round(i.qty * i.unit_cost)
    rows = [{"product_id": k[0], "name": k[1], "unit": k[2], "qty": round(v["qty"], 3), "total": v["total"], "profit": v["profit"]} for k, v in acc.items()]
    return sorted(rows, key=lambda r: r["total"], reverse=True)[:limit]


@router.get("/dashboard")
def dashboard(u: User = Depends(current_user), db: Session = Depends(get_db)):
    t = now().replace(hour=0, minute=0, second=0)
    today = _sales(db, u.store_id, t, t + timedelta(days=1))
    yesterday = _sales(db, u.store_id, t - timedelta(days=1), t - timedelta(days=1) + (now() - t))  # hasta la misma hora
    week = _sales(db, u.store_id, t - timedelta(days=6), t + timedelta(days=1))

    total = sum(s.total for s in today)
    by_hour = defaultdict(int)
    for s in today:
        by_hour[s.created_at.hour] += s.total
    days = []
    for d in range(6, -1, -1):
        day = t - timedelta(days=d)
        rows = [s for s in week if day <= s.created_at < day + timedelta(days=1)]
        days.append({"date": day.strftime("%Y-%m-%d"), "total": sum(s.total for s in rows), "count": len(rows)})

    low = db.scalars(
        select(Product).where(Product.store_id == u.store_id, Product.active, Product.stock <= Product.min_stock).order_by(Product.stock - Product.min_stock).limit(12)
    ).all()
    stock_value = sum(round(max(p.stock, 0) * p.cost) for p in db.scalars(select(Product).where(Product.store_id == u.store_id, Product.active)))
    sess = open_session(db, u.store_id)

    return {
        "date": t.strftime("%Y-%m-%d"),
        "total": total,
        "count": len(today),
        "average": round(total / len(today)) if today else 0,
        "profit": sum(s.total - s.cost_total for s in today),
        "yesterday_same_hour": sum(s.total for s in yesterday),
        "units": round(sum(i.qty for s in today for i in s.items), 3),
        "by_method": {
            "efectivo": sum(s.paid_cash for s in today),
            "transferencia": sum(s.paid_transfer for s in today),
            "tarjeta": sum(s.paid_card for s in today),
        },
        "by_hour": [{"hour": h, "total": by_hour.get(h, 0)} for h in range(6, 23)],
        "week": days,
        "top": _top(today, 6),
        "low_stock": [present.product(p) for p in low],
        "low_count": len(low),
        "stock_value": stock_value,
        "session": present.session(sess, summary(db, sess)) if sess else None,
        "recent": [present.sale(s, items=False) for s in sorted(today, key=lambda s: s.id, reverse=True)[:6]],
    }


def _range(start: str | None, end: str | None) -> tuple[datetime, datetime]:
    t = now().replace(hour=0, minute=0, second=0)
    a = datetime.strptime(start, "%Y-%m-%d") if start else t - timedelta(days=29)
    b = datetime.strptime(end, "%Y-%m-%d") if end else t
    if b < a:
        a, b = b, a
    return a, b + timedelta(days=1)


@router.get("/reports")
def reports(start: str | None = None, end: str | None = None, u: User = Depends(current_user), db: Session = Depends(get_db)):
    a, b = _range(start, end)
    sales = _sales(db, u.store_id, a, b)
    total = sum(s.total for s in sales)
    profit = sum(s.total - s.cost_total for s in sales)

    daily = []
    d = a
    while d < b:
        rows = [s for s in sales if d <= s.created_at < d + timedelta(days=1)]
        daily.append({"date": d.strftime("%Y-%m-%d"), "total": sum(s.total for s in rows), "profit": sum(s.total - s.cost_total for s in rows), "count": len(rows)})
        d += timedelta(days=1)

    cats = {c.id: c for c in db.scalars(select(Category).where(Category.store_id == u.store_id))}
    prod_cat = dict(db.execute(select(Product.id, Product.category_id).where(Product.store_id == u.store_id)).all())
    by_cat: dict = defaultdict(lambda: {"total": 0, "profit": 0})
    for s in sales:
        for i in s.items:
            c = cats.get(prod_cat.get(i.product_id))
            key = (c.name, c.color) if c else ("Sin categoría", "#94A3B8")
            by_cat[key]["total"] += i.total
            by_cat[key]["profit"] += i.total - round(i.qty * i.unit_cost)

    weekdays = defaultdict(int)
    for s in sales:
        weekdays[s.created_at.isoweekday()] += s.total

    return {
        "start": a.strftime("%Y-%m-%d"),
        "end": (b - timedelta(days=1)).strftime("%Y-%m-%d"),
        "total": total,
        "profit": profit,
        "margin": round(profit / total * 100, 1) if total else 0,
        "count": len(sales),
        "average": round(total / len(sales)) if sales else 0,
        "discounts": sum(s.discount for s in sales),
        "by_method": {
            "efectivo": sum(s.paid_cash for s in sales),
            "transferencia": sum(s.paid_transfer for s in sales),
            "tarjeta": sum(s.paid_card for s in sales),
        },
        "daily": daily,
        "by_category": sorted([{"name": k[0], "color": k[1], **v} for k, v in by_cat.items()], key=lambda r: r["total"], reverse=True),
        "top": _top(sales, 12),
        "by_weekday": [{"weekday": w, "total": weekdays.get(w, 0)} for w in range(1, 8)],
    }


@router.get("/reports/sales.csv")
def export_sales(start: str | None = None, end: str | None = None, u: User = Depends(current_user), db: Session = Depends(get_db)):
    a, b = _range(start, end)
    rows = db.scalars(
        select(Sale).options(selectinload(Sale.items), selectinload(Sale.user))
        .where(Sale.store_id == u.store_id, Sale.created_at >= a, Sale.created_at < b).order_by(Sale.id)
    ).all()
    out = io.StringIO()
    w = csv.writer(out, delimiter=";")
    w.writerow(["Venta", "Fecha", "Estado", "Cajero", "Productos", "Subtotal", "Descuento", "Total", "Ganancia", "Medio de pago", "Efectivo", "Transferencia", "Tarjeta"])
    for s in rows:
        w.writerow([
            s.number, s.created_at.strftime("%Y-%m-%d %H:%M"), s.status, s.user.name if s.user else "",
            ", ".join(f"{i.qty:g} {i.name}" for i in s.items), s.subtotal, s.discount, s.total, s.total - s.cost_total,
            s.method, s.paid_cash, s.paid_transfer, s.paid_card,
        ])
    data = "﻿" + out.getvalue()
    return StreamingResponse(iter([data]), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="ventas.csv"'})


# --- Vitrina pública -----------------------------------------------------------


@router.get("/public/{slug}")
def catalog(slug: str, db: Session = Depends(get_db)):
    s = db.scalar(select(Store).where(Store.slug == slug))
    if not s:
        raise HTTPException(404, "Esta tienda no existe.")
    if s.is_demo:
        from .. import demo

        demo.freshen(db)
        s = db.scalar(select(Store).where(Store.slug == slug))
    cats = db.scalars(select(Category).where(Category.store_id == s.id).order_by(Category.position, Category.id)).all()
    prods = db.scalars(select(Product).where(Product.store_id == s.id, Product.active, Product.in_catalog).order_by(Product.name)).all()
    return {
        "store": present.store(s),
        "categories": [present.category(c) for c in cats if any(p.category_id == c.id for p in prods)],
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "category_id": p.category_id,
                "price": p.price,
                "unit": p.unit,
                "emoji": p.emoji,
                "image_url": p.image_url,
                "available": p.stock > 0,
                "few_left": 0 < p.stock <= max(p.min_stock, 3),
            }
            for p in prods
        ],
    }

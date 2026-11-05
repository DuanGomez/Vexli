"""Inventario: categorías, productos y movimientos de existencias."""

import csv
import io
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from .. import present
from ..db import get_db
from ..models import Category, Product, StockMove, User
from ..security import current_user, owner_only

router = APIRouter(tags=["inventario"])


# --- Categorías ------------------------------------------------------------


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str = Field(default="#64748B", pattern=r"^#[0-9A-Fa-f]{6}$")


@router.get("/categories")
def categories(u: User = Depends(current_user), db: Session = Depends(get_db)):
    counts = dict(
        db.execute(
            select(Product.category_id, func.count()).where(Product.store_id == u.store_id, Product.active).group_by(Product.category_id)
        ).all()
    )
    rows = db.scalars(select(Category).where(Category.store_id == u.store_id).order_by(Category.position, Category.id))
    return [present.category(c, counts.get(c.id, 0)) for c in rows]


@router.post("/categories", status_code=201)
def add_category(body: CategoryIn, u: User = Depends(owner_only), db: Session = Depends(get_db)):
    n = db.scalar(select(func.count()).select_from(Category).where(Category.store_id == u.store_id)) or 0
    c = Category(store_id=u.store_id, name=body.name, color=body.color, position=n)
    db.add(c)
    db.commit()
    return present.category(c, 0)


@router.put("/categories/{cid}")
def edit_category(cid: int, body: CategoryIn, u: User = Depends(owner_only), db: Session = Depends(get_db)):
    c = db.get(Category, cid)
    if not c or c.store_id != u.store_id:
        raise HTTPException(404, "Categoría no encontrada.")
    c.name, c.color = body.name, body.color
    db.commit()
    return present.category(c)


@router.delete("/categories/{cid}", status_code=204)
def delete_category(cid: int, u: User = Depends(owner_only), db: Session = Depends(get_db)):
    c = db.get(Category, cid)
    if not c or c.store_id != u.store_id:
        raise HTTPException(404, "Categoría no encontrada.")
    db.delete(c)  # los productos quedan sin categoría
    db.commit()


# --- Productos -------------------------------------------------------------


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sku: str | None = Field(default=None, max_length=40)
    barcode: str | None = Field(default=None, max_length=40)
    category_id: int | None = None
    description: str | None = None
    unit: Literal["und", "kg", "lt", "lb", "m"] = "und"
    cost: int = Field(default=0, ge=0)
    price: int = Field(ge=0)
    min_stock: float = Field(default=0, ge=0)
    emoji: str | None = Field(default=None, max_length=8)
    image_url: str | None = None
    active: bool = True
    in_catalog: bool = True
    stock: float | None = Field(default=None, ge=0)  # solo al crear: existencias iniciales


def _own_product(db: Session, u: User, pid: int) -> Product:
    p = db.get(Product, pid)
    if not p or p.store_id != u.store_id:
        raise HTTPException(404, "Producto no encontrado.")
    return p


def _check_codes(db: Session, u: User, sku: str, barcode: str | None, ignore: int | None = None):
    q = select(Product).where(Product.store_id == u.store_id, Product.sku == sku)
    if ignore:
        q = q.where(Product.id != ignore)
    if db.scalar(q):
        raise HTTPException(422, f"Ya existe un producto con el código {sku}.")
    if barcode:
        q = select(Product).where(Product.store_id == u.store_id, Product.barcode == barcode)
        if ignore:
            q = q.where(Product.id != ignore)
        if db.scalar(q):
            raise HTTPException(422, "Ese código de barras ya está en otro producto.")


@router.get("/products")
def products(
    q: str = "",
    category: int | None = None,
    low: bool = False,
    include_inactive: bool = False,
    u: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = select(Product).where(Product.store_id == u.store_id)
    if not include_inactive:
        query = query.where(Product.active)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.where(or_(Product.name.ilike(like), Product.sku.ilike(like), Product.barcode == q.strip()))
    if category:
        query = query.where(Product.category_id == category)
    if low:
        query = query.where(Product.stock <= Product.min_stock)
    return [present.product(p) for p in db.scalars(query.order_by(Product.name))]


@router.get("/products/lookup")
def lookup(code: str, u: User = Depends(current_user), db: Session = Depends(get_db)):
    """Lector de código de barras o código interno."""
    code = code.strip()
    p = db.scalar(
        select(Product).where(Product.store_id == u.store_id, Product.active, or_(Product.barcode == code, func.lower(Product.sku) == code.lower()))
    )
    if not p:
        raise HTTPException(404, f"No hay ningún producto con el código {code}.")
    return present.product(p)


@router.post("/products", status_code=201)
def add_product(body: ProductIn, u: User = Depends(owner_only), db: Session = Depends(get_db)):
    data = body.model_dump()
    initial = data.pop("stock") or 0
    if not data["sku"]:
        n = db.scalar(select(func.count()).select_from(Product).where(Product.store_id == u.store_id)) or 0
        data["sku"] = f"P{n + 1:04d}"
        while db.scalar(select(Product).where(Product.store_id == u.store_id, Product.sku == data["sku"])):
            n += 1
            data["sku"] = f"P{n + 1:04d}"
    _check_codes(db, u, data["sku"], data["barcode"])
    p = Product(store_id=u.store_id, stock=initial, **data)
    db.add(p)
    db.flush()
    if initial:
        db.add(StockMove(store_id=u.store_id, product_id=p.id, kind="entrada", qty=initial, stock_after=initial, unit_cost=p.cost, note="Existencias iniciales", user_id=u.id))
    db.commit()
    return present.product(p)


@router.put("/products/{pid}")
def edit_product(pid: int, body: ProductIn, u: User = Depends(owner_only), db: Session = Depends(get_db)):
    p = _own_product(db, u, pid)
    data = body.model_dump(exclude={"stock"})
    data["sku"] = data["sku"] or p.sku
    _check_codes(db, u, data["sku"], data["barcode"], ignore=p.id)
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    return present.product(p)


@router.delete("/products/{pid}", status_code=204)
def delete_product(pid: int, u: User = Depends(owner_only), db: Session = Depends(get_db)):
    p = _own_product(db, u, pid)
    p.active = False  # se conserva para el historial de ventas
    db.commit()


# --- Movimientos -----------------------------------------------------------


class MoveIn(BaseModel):
    kind: Literal["entrada", "ajuste", "merma"]
    qty: float = Field(description="entrada/merma: cantidad positiva · ajuste: existencia contada")
    unit_cost: int | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=200)


@router.post("/products/{pid}/moves", status_code=201)
def add_move(pid: int, body: MoveIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    p = _own_product(db, u, pid)
    if body.kind == "ajuste":
        if body.qty < 0:
            raise HTTPException(422, "La existencia contada no puede ser negativa.")
        delta = body.qty - p.stock
    else:
        if body.qty <= 0:
            raise HTTPException(422, "La cantidad debe ser mayor que cero.")
        delta = body.qty if body.kind == "entrada" else -body.qty
    if body.kind == "entrada" and body.unit_cost is not None and body.unit_cost != p.cost:
        # Costo promedio ponderado con lo que había
        base = max(p.stock, 0)
        p.cost = round((base * p.cost + body.qty * body.unit_cost) / (base + body.qty)) if base + body.qty else body.unit_cost
    p.stock = round(p.stock + delta, 3)
    m = StockMove(store_id=u.store_id, product_id=p.id, kind=body.kind, qty=round(delta, 3), stock_after=p.stock, unit_cost=body.unit_cost, note=body.note, user_id=u.id)
    db.add(m)
    db.commit()
    return {"product": present.product(p), "move": present.move(m)}


@router.get("/moves")
def moves(
    product: int | None = None,
    kind: str | None = None,
    limit: int = Query(default=120, le=500),
    u: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    q = select(StockMove).options(joinedload(StockMove.product), joinedload(StockMove.user)).where(StockMove.store_id == u.store_id)
    if product:
        q = q.where(StockMove.product_id == product)
    if kind:
        q = q.where(StockMove.kind == kind)
    return [present.move(m) for m in db.scalars(q.order_by(StockMove.id.desc()).limit(limit))]


@router.get("/products/export.csv")
def export_products(u: User = Depends(current_user), db: Session = Depends(get_db)):
    cats = {c.id: c.name for c in db.scalars(select(Category).where(Category.store_id == u.store_id))}
    out = io.StringIO()
    w = csv.writer(out, delimiter=";")
    w.writerow(["Código", "Código de barras", "Producto", "Categoría", "Unidad", "Costo", "Precio", "Existencias", "Mínimo", "Valor al costo"])
    for p in db.scalars(select(Product).where(Product.store_id == u.store_id, Product.active).order_by(Product.name)):
        w.writerow([p.sku, p.barcode or "", p.name, cats.get(p.category_id, ""), p.unit, p.cost, p.price, round(p.stock, 3), p.min_stock, round(p.stock * p.cost)])
    data = "﻿" + out.getvalue()  # BOM: Excel abre bien las tildes
    return StreamingResponse(iter([data]), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="inventario.csv"'})

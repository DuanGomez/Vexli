"""Caja: turnos, ventas, anulaciones y cierre con arqueo."""

from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .. import present
from ..db import get_db, now
from ..models import CashMove, CashSession, Product, Sale, SaleItem, StockMove, User
from ..security import current_user

router = APIRouter(tags=["caja"])


def money(value: float) -> int:
    """Pesos redondeados a 50, como se cobra en la tienda (sobre todo lo que va al peso)."""
    return int(round(value / 50) * 50)


def open_session(db: Session, store_id: int) -> CashSession | None:
    return db.scalar(select(CashSession).where(CashSession.store_id == store_id, CashSession.closed_at.is_(None)).order_by(CashSession.id.desc()))


def summary(db: Session, s: CashSession) -> dict:
    """Cuentas del turno: ventas por medio de pago, movimientos y efectivo esperado."""
    sales = db.scalars(select(Sale).where(Sale.session_id == s.id)).all()
    done = [x for x in sales if x.status == "completada"]
    moves = db.scalars(select(CashMove).where(CashMove.session_id == s.id).order_by(CashMove.id)).all()
    ins = sum(m.amount for m in moves if m.kind == "ingreso")
    outs = sum(m.amount for m in moves if m.kind == "egreso")
    cash = sum(x.paid_cash for x in done)
    return {
        "sales_count": len(done),
        "voided": len(sales) - len(done),
        "total": sum(x.total for x in done),
        "profit": sum(x.total - x.cost_total for x in done),
        "cash": cash,
        "transfer": sum(x.paid_transfer for x in done),
        "card": sum(x.paid_card for x in done),
        "discounts": sum(x.discount for x in done),
        "cash_in": ins,
        "cash_out": outs,
        "expected_cash": s.opening_amount + cash + ins - outs,
        "moves": [present.cash_move(m) for m in moves],
    }


@router.get("/cash/current")
def current(u: User = Depends(current_user), db: Session = Depends(get_db)):
    s = open_session(db, u.store_id)
    if not s:
        last = db.scalar(select(CashSession).where(CashSession.store_id == u.store_id).order_by(CashSession.id.desc()))
        return {"session": None, "suggested_opening": last.counted_cash if last and last.counted_cash is not None else 100_000}
    return {"session": present.session(s, summary(db, s))}


class OpenIn(BaseModel):
    opening_amount: int = Field(ge=0)


@router.post("/cash/open", status_code=201)
def open_cash(body: OpenIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    if open_session(db, u.store_id):
        raise HTTPException(409, "Ya hay una caja abierta.")
    s = CashSession(store_id=u.store_id, opened_by=u.id, opening_amount=body.opening_amount)
    db.add(s)
    db.commit()
    return {"session": present.session(s, summary(db, s))}


class CashMoveIn(BaseModel):
    kind: Literal["ingreso", "egreso"]
    amount: int = Field(gt=0)
    reason: str = Field(min_length=2, max_length=160)


@router.post("/cash/moves", status_code=201)
def cash_move(body: CashMoveIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    s = open_session(db, u.store_id)
    if not s:
        raise HTTPException(409, "Abre la caja primero.")
    db.add(CashMove(session_id=s.id, **body.model_dump()))
    db.commit()
    return {"session": present.session(s, summary(db, s))}


class CloseIn(BaseModel):
    counted_cash: int = Field(ge=0)
    notes: str | None = Field(default=None, max_length=300)


@router.post("/cash/close")
def close_cash(body: CloseIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    s = open_session(db, u.store_id)
    if not s:
        raise HTTPException(409, "No hay una caja abierta.")
    sm = summary(db, s)
    s.expected_cash = sm["expected_cash"]
    s.counted_cash = body.counted_cash
    s.notes = body.notes
    s.closed_at = now()
    s.closed_by = u.id
    db.commit()
    return {"session": present.session(s, sm)}


@router.get("/cash/sessions")
def sessions(u: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(CashSession).options(selectinload(CashSession.opener), selectinload(CashSession.closer)).where(CashSession.store_id == u.store_id).order_by(CashSession.id.desc()).limit(40)
    ).all()
    totals = dict(
        db.execute(
            select(Sale.session_id, func.sum(Sale.total)).where(Sale.store_id == u.store_id, Sale.status == "completada").group_by(Sale.session_id)
        ).all()
    )
    return [present.session(s) | {"sales_total": totals.get(s.id, 0) or 0} for s in rows]


@router.get("/cash/sessions/{sid}")
def session_detail(sid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    s = db.get(CashSession, sid)
    if not s or s.store_id != u.store_id:
        raise HTTPException(404, "Turno no encontrado.")
    return present.session(s, summary(db, s))


# --- Ventas ------------------------------------------------------------------


class ItemIn(BaseModel):
    product_id: int
    qty: float = Field(gt=0)
    unit_price: int | None = Field(default=None, ge=0)


class SaleIn(BaseModel):
    items: list[ItemIn] = Field(min_length=1)
    discount: int = Field(default=0, ge=0)
    method: Literal["efectivo", "transferencia", "tarjeta", "mixto"]
    cash_received: int = Field(default=0, ge=0)
    paid_transfer: int = Field(default=0, ge=0)
    paid_card: int = Field(default=0, ge=0)
    customer: str | None = Field(default=None, max_length=80)
    allow_negative: bool = False


@router.post("/sales", status_code=201)
def create_sale(body: SaleIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    s = open_session(db, u.store_id)
    if not s:
        raise HTTPException(409, "Abre la caja antes de vender.")

    products = {p.id: p for p in db.scalars(select(Product).where(Product.store_id == u.store_id, Product.id.in_([i.product_id for i in body.items])))}
    # Si el mismo producto viene en varias líneas, se suman para revisar existencias
    wanted: dict[int, float] = {}
    for i in body.items:
        if i.product_id not in products:
            raise HTTPException(422, "Uno de los productos ya no existe.")
        wanted[i.product_id] = wanted.get(i.product_id, 0) + i.qty
    if not body.allow_negative:
        short = [f"{products[pid].name} (quedan {products[pid].stock:g})" for pid, q in wanted.items() if products[pid].stock + 1e-9 < q]
        if short:
            raise HTTPException(409, {"message": "No alcanzan las existencias de: " + ", ".join(short), "can_force": True})

    lines, subtotal, cost = [], 0, 0
    for i in body.items:
        p = products[i.product_id]
        price = p.price if i.unit_price is None else i.unit_price
        total = money(i.qty * price)
        subtotal += total
        cost += round(i.qty * p.cost)
        lines.append(SaleItem(product_id=p.id, name=p.name, unit=p.unit, qty=round(i.qty, 3), unit_price=price, unit_cost=p.cost, total=total))
    if body.discount > subtotal:
        raise HTTPException(422, "El descuento no puede ser mayor que la venta.")
    total = subtotal - body.discount

    paid_cash = paid_transfer = paid_card = change = received = 0
    if body.method == "efectivo":
        received = body.cash_received or total
        if received < total:
            raise HTTPException(422, "El efectivo recibido no alcanza.")
        paid_cash, change = total, received - total
    elif body.method == "transferencia":
        paid_transfer = total
    elif body.method == "tarjeta":
        paid_card = total
    else:
        paid_transfer, paid_card = body.paid_transfer, body.paid_card
        paid_cash = total - paid_transfer - paid_card
        if paid_cash < 0:
            raise HTTPException(422, "Los pagos suman más que la venta.")
        received = body.cash_received or paid_cash
        if received < paid_cash:
            raise HTTPException(422, "El efectivo recibido no alcanza para la parte en efectivo.")
        change = received - paid_cash

    number = (db.scalar(select(func.max(Sale.number)).where(Sale.store_id == u.store_id)) or 0) + 1
    sale = Sale(
        store_id=u.store_id, session_id=s.id, number=number, user_id=u.id, subtotal=subtotal, discount=body.discount, total=total,
        cost_total=cost, method=body.method, paid_cash=paid_cash, paid_transfer=paid_transfer, paid_card=paid_card,
        cash_received=received, change=change, customer=(body.customer or None), items=lines,
    )
    db.add(sale)
    db.flush()
    for pid, q in wanted.items():
        p = products[pid]
        p.stock = round(p.stock - q, 3)
        db.add(StockMove(store_id=u.store_id, product_id=pid, kind="venta", qty=-q, stock_after=p.stock, note=f"Venta #{number}", user_id=u.id, sale_id=sale.id))
    db.commit()
    db.refresh(sale)
    return present.sale(sale)


@router.get("/sales")
def list_sales(date: str | None = None, days: int = 1, u: User = Depends(current_user), db: Session = Depends(get_db)):
    start = datetime.strptime(date, "%Y-%m-%d") if date else now().replace(hour=0, minute=0, second=0)
    end = start + timedelta(days=max(1, min(days, 62)))
    rows = db.scalars(
        select(Sale).options(selectinload(Sale.items), selectinload(Sale.user))
        .where(Sale.store_id == u.store_id, Sale.created_at >= start, Sale.created_at < end).order_by(Sale.id.desc())
    ).all()
    done = [x for x in rows if x.status == "completada"]
    return {
        "from": start.strftime("%Y-%m-%d"),
        "total": sum(x.total for x in done),
        "count": len(done),
        "sales": [present.sale(x) for x in rows],
    }


@router.get("/sales/{sid}")
def get_sale(sid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    x = db.get(Sale, sid)
    if not x or x.store_id != u.store_id:
        raise HTTPException(404, "Venta no encontrada.")
    return present.sale(x)


class VoidIn(BaseModel):
    reason: str = Field(min_length=3, max_length=160)


@router.post("/sales/{sid}/void")
def void_sale(sid: int, body: VoidIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    x = db.get(Sale, sid)
    if not x or x.store_id != u.store_id:
        raise HTTPException(404, "Venta no encontrada.")
    if x.status == "anulada":
        raise HTTPException(409, "Esta venta ya estaba anulada.")
    sess = db.get(CashSession, x.session_id) if x.session_id else None
    if sess and sess.closed_at:
        raise HTTPException(409, "No se puede anular: la caja de ese turno ya se cerró.")
    x.status, x.void_reason = "anulada", body.reason
    for i in x.items:
        p = db.get(Product, i.product_id) if i.product_id else None
        if p:
            p.stock = round(p.stock + i.qty, 3)
            db.add(StockMove(store_id=u.store_id, product_id=p.id, kind="anulacion", qty=i.qty, stock_after=p.stock, note=f"Anulación venta #{x.number}", user_id=u.id, sale_id=x.id))
    db.commit()
    return present.sale(x)

"""Tablas de Vexli. El dinero va en pesos enteros; las cantidades admiten decimales (kg, litros)."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, now


class Store(Base):
    __tablename__ = "stores"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(30), default="minimercado")
    phone: Mapped[Optional[str]] = mapped_column(String(30))
    address: Mapped[Optional[str]] = mapped_column(String(160))
    city: Mapped[Optional[str]] = mapped_column(String(60))
    color: Mapped[str] = mapped_column(String(9), default="#16A34A")
    receipt_note: Mapped[Optional[str]] = mapped_column(String(200))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(120), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(12), default="owner")  # owner | cajero
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    store: Mapped[Store] = relationship()


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    color: Mapped[str] = mapped_column(String(9), default="#64748B")
    position: Mapped[int] = mapped_column(Integer, default=0)


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("store_id", "sku"), Index("ix_products_barcode", "store_id", "barcode"))
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    sku: Mapped[str] = mapped_column(String(40))
    barcode: Mapped[Optional[str]] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[Optional[str]] = mapped_column(Text)
    unit: Mapped[str] = mapped_column(String(8), default="und")  # und | kg | lt | lb
    cost: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[int] = mapped_column(Integer, default=0)
    stock: Mapped[float] = mapped_column(Float, default=0)
    min_stock: Mapped[float] = mapped_column(Float, default=0)
    image_url: Mapped[Optional[str]] = mapped_column(String(300))
    emoji: Mapped[Optional[str]] = mapped_column(String(8))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    in_catalog: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)
    category: Mapped[Optional[Category]] = relationship()


class StockMove(Base):
    """Cada cambio de existencias deja rastro: compras, ajustes, mermas, ventas y anulaciones."""

    __tablename__ = "stock_moves"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(12))  # entrada | ajuste | merma | venta | anulacion
    qty: Mapped[float] = mapped_column(Float)  # con signo: + entra, − sale
    stock_after: Mapped[float] = mapped_column(Float)
    unit_cost: Mapped[Optional[int]] = mapped_column(Integer)
    note: Mapped[Optional[str]] = mapped_column(String(200))
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    sale_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sales.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)
    product: Mapped[Product] = relationship()
    user: Mapped[Optional[User]] = relationship()


class CashSession(Base):
    """Un turno de caja: se abre con una base y se cierra contando el efectivo."""

    __tablename__ = "cash_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    opened_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    opened_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    opening_amount: Mapped[int] = mapped_column(Integer, default=0)
    closed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    expected_cash: Mapped[Optional[int]] = mapped_column(Integer)
    counted_cash: Mapped[Optional[int]] = mapped_column(Integer)
    notes: Mapped[Optional[str]] = mapped_column(String(300))
    opener: Mapped[Optional[User]] = relationship(foreign_keys=[opened_by])
    closer: Mapped[Optional[User]] = relationship(foreign_keys=[closed_by])


class CashMove(Base):
    """Entradas y salidas de efectivo que no son ventas (pago a un proveedor, cambio, etc.)."""

    __tablename__ = "cash_moves"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("cash_sessions.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(8))  # ingreso | egreso
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Sale(Base):
    __tablename__ = "sales"
    __table_args__ = (UniqueConstraint("store_id", "number"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cash_sessions.id", ondelete="SET NULL"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)
    subtotal: Mapped[int] = mapped_column(Integer)
    discount: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer)
    cost_total: Mapped[int] = mapped_column(Integer, default=0)
    method: Mapped[str] = mapped_column(String(14))  # efectivo | transferencia | tarjeta | mixto
    paid_cash: Mapped[int] = mapped_column(Integer, default=0)
    paid_transfer: Mapped[int] = mapped_column(Integer, default=0)
    paid_card: Mapped[int] = mapped_column(Integer, default=0)
    cash_received: Mapped[int] = mapped_column(Integer, default=0)
    change: Mapped[int] = mapped_column(Integer, default=0)
    customer: Mapped[Optional[str]] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(12), default="completada")  # completada | anulada
    void_reason: Mapped[Optional[str]] = mapped_column(String(160))
    user: Mapped[Optional[User]] = relationship()
    items: Mapped[list["SaleItem"]] = relationship(cascade="all, delete-orphan", order_by="SaleItem.id")


class SaleItem(Base):
    __tablename__ = "sale_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(120))
    unit: Mapped[str] = mapped_column(String(8), default="und")
    qty: Mapped[float] = mapped_column(Float)
    unit_price: Mapped[int] = mapped_column(Integer)
    unit_cost: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer)

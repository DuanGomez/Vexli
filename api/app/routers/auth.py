"""Entrar, crear una tienda, entrar a la demo y ajustes de la tienda."""

import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import demo, present
from ..db import get_db
from ..models import Category, Store, User
from ..security import create_token, current_user, hash_password, owner_only, verify_password

router = APIRouter(tags=["sesión"])

KINDS = {
    "minimercado": ["Bebidas", "Lácteos y huevos", "Granos y despensa", "Aseo", "Snacks y dulces", "Panadería"],
    "papeleria": ["Cuadernos", "Escritura", "Arte", "Oficina", "Tecnología"],
    "ropa": ["Camisetas", "Pantalones", "Accesorios", "Calzado"],
    "ferreteria": ["Herramientas", "Eléctricos", "Plomería", "Pinturas", "Tornillería"],
    "otro": ["General"],
}
COLORS = ["#16A34A", "#2563EB", "#DB2777", "#F59E0B", "#7C3AED", "#0EA5E9", "#EF4444"]


class Login(BaseModel):
    email: str
    password: str


class Register(BaseModel):
    store: str = Field(min_length=2, max_length=80)
    kind: str = "minimercado"
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)
    phone: str | None = None
    city: str | None = None


class StoreUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    receipt_note: str | None = Field(default=None, max_length=200)


class NewUser(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "tienda"


def session_payload(u: User) -> dict:
    return {"token": create_token(u), "user": present.user(u), "store": present.store(u.store)}


@router.post("/auth/login")
def login(body: Login, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(422, "Correo o contraseña incorrectos.")
    return session_payload(u)


@router.post("/auth/register", status_code=201)
def register(body: Register, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(422, "Ya existe una cuenta con ese correo. Entra con él.")
    base = slugify(body.store)
    slug, i = base, 2
    while db.scalar(select(Store).where(Store.slug == slug)):
        slug, i = f"{base}-{i}", i + 1
    kind = body.kind if body.kind in KINDS else "otro"
    s = Store(slug=slug, name=body.store, kind=kind, phone=body.phone, city=body.city)
    db.add(s)
    db.flush()
    for pos, name in enumerate(KINDS[kind]):
        db.add(Category(store_id=s.id, name=name, color=COLORS[pos % len(COLORS)], position=pos))
    u = User(store_id=s.id, name=body.name, email=email, password_hash=hash_password(body.password), role="owner")
    db.add(u)
    db.commit()
    db.refresh(u)
    return session_payload(u)


@router.post("/auth/demo")
def demo_login(db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.email == demo.DEMO_EMAIL))
    if u:
        demo.freshen_later()
    else:
        demo.freshen(db)
        u = db.scalar(select(User).where(User.email == demo.DEMO_EMAIL))
    if not u:
        raise HTTPException(503, "La demo se está preparando. Intenta en unos segundos.")
    return session_payload(u)


@router.get("/me")
def me(u: User = Depends(current_user)):
    return {"user": present.user(u), "store": present.store(u.store)}


@router.patch("/store")
def update_store(body: StoreUpdate, u: User = Depends(owner_only), db: Session = Depends(get_db)):
    s = db.get(Store, u.store_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    return present.store(s)


@router.get("/users")
def list_users(u: User = Depends(owner_only), db: Session = Depends(get_db)):
    return [present.user(x) for x in db.scalars(select(User).where(User.store_id == u.store_id).order_by(User.id))]


@router.post("/users", status_code=201)
def add_cashier(body: NewUser, u: User = Depends(owner_only), db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == body.email.lower())):
        raise HTTPException(422, "Ya existe una cuenta con ese correo.")
    x = User(store_id=u.store_id, name=body.name, email=body.email.lower(), password_hash=hash_password(body.password), role="cajero")
    db.add(x)
    db.commit()
    return present.user(x)

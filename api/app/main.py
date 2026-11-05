"""API de Vexli: inventario y caja diaria para tiendas."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import demo
from .db import Base, SessionLocal, engine
from .routers import auth, cash, inventory, reports


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        demo.freshen(db)
    yield


app = FastAPI(title="Vexli API", version="1.0.0", lifespan=lifespan)

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://[a-z0-9-]+\.vexli-caja\.pages\.dev",
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=86400,
)

FIELDS = {
    "email": "el correo", "password": "la contraseña", "name": "el nombre", "store": "el nombre de la tienda",
    "price": "el precio", "cost": "el costo", "qty": "la cantidad", "amount": "el valor", "reason": "el motivo",
    "items": "los productos", "opening_amount": "la base", "counted_cash": "el efectivo contado",
}


@app.exception_handler(RequestValidationError)
async def spanish_errors(_: Request, exc: RequestValidationError):
    """Mensajes de validación en español y con un solo texto, como los demás errores."""
    err = exc.errors()[0]
    field = FIELDS.get(str(err["loc"][-1]), "un dato")
    kind = err["type"]
    if kind == "missing":
        msg = f"Falta {field}."
    elif kind == "value_error" and "email" in str(err.get("msg", "")).lower():
        msg = "Escribe un correo válido."
    elif kind == "string_too_short":
        msg = f"Revisa {field}: es muy corto (mínimo {err['ctx']['min_length']} caracteres)."
    elif kind == "string_too_long":
        msg = f"Revisa {field}: es muy largo."
    elif kind in ("greater_than", "greater_than_equal"):
        msg = f"Revisa {field}: debe ser mayor."
    elif kind == "too_short":
        msg = f"Agrega {field}."
    else:
        msg = f"Revisa {field}."
    return JSONResponse(status_code=422, content={"detail": msg})


@app.get("/")
def root():
    return {"app": "Vexli API", "ok": True}


@app.get("/up")
def up():
    return {"ok": True}


for r in (auth.router, inventory.router, cash.router, reports.router):
    app.include_router(r, prefix="/api")

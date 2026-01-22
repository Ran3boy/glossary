from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .storage import GlossaryStore
from .models import Term, GraphResponse

app = FastAPI(title="Glossary API", version="0.1.0")

# Для учебного проекта допускаем широкие CORS-настройки
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = GlossaryStore()


@app.on_event("startup")
def _startup() -> None:
    store.load()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/terms", response_model=list[Term])
def list_terms() -> list[Term]:
    return store.list_terms()


@app.get("/api/terms/{term_id}", response_model=Term)
def get_term(term_id: str) -> Term:
    term = store.get_term(term_id)
    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")
    return term


@app.get("/api/graph", response_model=GraphResponse)
def get_graph() -> GraphResponse:
    return store.get_graph()

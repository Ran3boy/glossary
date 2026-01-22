from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


class Source(BaseModel):
    title: str
    url: str = ""


class Term(BaseModel):
    id: str
    title: str
    definition: str
    sources: list[Source] = Field(default_factory=list)
    position: dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})


class GraphNode(BaseModel):
    id: str
    position: dict[str, float]
    data: dict[str, Any]
    type: Optional[str] = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str = ""
    animated: bool = False


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]

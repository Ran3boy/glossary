from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Optional

from .models import Term, GraphResponse, GraphNode, GraphEdge


class GlossaryStore:
    def __init__(self) -> None:
        self._terms: dict[str, Term] = {}
        self._edges: list[GraphEdge] = []
        # IDs that should be exposed in the UI/API
        self._core_ids: set[str] = set()

    def _compute_core_ids(self) -> set[str]:
        """Expose a single connected component anchored at the main topic node.

        The UI should show one coherent semantic map (not multiple separate islands).
        We therefore keep the connected component that contains the main topic
        (Web Components). Any other disconnected clusters are removed.
        """

        if not self._terms:
            return set()

        # Build undirected adjacency
        adj: Dict[str, set[str]] = {t_id: set() for t_id in self._terms.keys()}
        for e in self._edges:
            if e.source in adj and e.target in adj:
                adj[e.source].add(e.target)
                adj[e.target].add(e.source)

        anchor = "web_components" if "web_components" in adj else next(iter(adj.keys()))

        # BFS/DFS from anchor
        core: set[str] = set()
        stack = [anchor]
        while stack:
            cur = stack.pop()
            if cur in core:
                continue
            core.add(cur)
            stack.extend(list(adj.get(cur, ())))

        return core

    @staticmethod
    def _dedupe_edge_labels(edges: list[GraphEdge]) -> list[GraphEdge]:
        """Hide repeated labels that tend to clutter the graph.

        We only dedupe a small set of "parallel" relations such as
        Web Components --"состоит из"--> (A, B, C).
        Other relations (e.g. "сравнивается с") are kept on each edge.
        """

        DEDUPE_LABELS = {"состоит из"}

        seen: set[tuple[str, str]] = set()
        out: list[GraphEdge] = []
        for e in edges:
            label = (e.label or "").strip()
            if label and label not in DEDUPE_LABELS:
                out.append(e)
                continue
            key = (e.source, label)
            if label and key in seen:
                out.append(GraphEdge(id=e.id, source=e.source, target=e.target, label="", animated=e.animated))
            else:
                if label:
                    seen.add(key)
                out.append(e)
        return out

    @staticmethod
    def _data_path() -> Path:
        # backend/app/storage.py -> backend/data/glossary.json
        return Path(__file__).resolve().parents[1] / "data" / "glossary.json"

    def load(self) -> None:
        path = self._data_path()
        raw = json.loads(path.read_text(encoding="utf-8"))
        self._terms = {t["id"]: Term(**t) for t in raw.get("terms", [])}
        self._edges = [GraphEdge(**e) for e in raw.get("edges", [])]

        # Compute and freeze the "core" graph that the UI should expose.
        self._core_ids = self._compute_core_ids()
        self._terms = {k: v for k, v in self._terms.items() if k in self._core_ids}
        self._edges = [e for e in self._edges if e.source in self._core_ids and e.target in self._core_ids]
        self._edges = self._dedupe_edge_labels(self._edges)

    def list_terms(self) -> list[Term]:
        terms = [t for t in self._terms.values() if t.id in self._core_ids]
        return sorted(terms, key=lambda t: t.title.lower())

    def get_term(self, term_id: str) -> Optional[Term]:
        t = self._terms.get(term_id)
        if not t or t.id not in self._core_ids:
            return None
        return t

    def get_graph(self) -> GraphResponse:
        """Return the pre-filtered core graph."""

        nodes: list[GraphNode] = []
        for term in self._terms.values():
            if term.id in self._core_ids:
                nodes.append(
                    GraphNode(
                        id=term.id,
                        position=term.position,
                        data={
                            "label": term.title,
                            "definition": term.definition,
                            "sources": [s.model_dump() for s in term.sources],
                        },
                    )
                )

        edges = self._edges
        return GraphResponse(nodes=nodes, edges=edges)

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, { Controls, useEdgesState, useNodesState } from 'reactflow'
import dagre from 'dagre'
import { fetchGraph, fetchTerms } from './api.js'

function TopBar({ tab, setTab }) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="titleblock">
          <div className="title">Глоссарий терминов ВКР</div>
          <div className="subtitle">
            Сравнительный анализ Web Components и современных фронтенд‑фреймворков
          </div>
        </div>

        <div className="tabs">
          <button
            className={tab === 'glossary' ? 'tab active' : 'tab'}
            onClick={() => setTab('glossary')}
          >
            Глоссарий
          </button>
          <button
            className={tab === 'graph' ? 'tab active' : 'tab'}
            onClick={() => setTab('graph')}
          >
            Семантический граф
          </button>
        </div>
      </div>

      <div className="topbar-right">
        <div className="userchip" title="Пользователь">
          <div className="avatar">ИН</div>
          <div className="username">Иванов Николай Юрьевич</div>
        </div>

        <div className="brand">
          <span className="badge">ИТМО</span>
        </div>
      </div>
    </div>
  )
}


function SidePanel({ term, onClose }) {
  if (!term) return null
  return (
    <div className="sidepanel">
      <div className="sidepanel-header">
        <div className="sidepanel-title">{term.title || term.data?.label}</div>
        <button className="iconbtn" onClick={onClose} title="Закрыть">✕</button>
      </div>
      <div className="sidepanel-body">
        <div className="definition">
          {term.definition || term.data?.definition || '—'}
        </div>

        <div className="section">
          <div className="section-title">Источники</div>
          <ul className="sources">
            {(term.sources || term.data?.sources || []).map((s, idx) => (
              <li key={idx}>
                {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}
              </li>
            ))}
            {(term.sources || term.data?.sources || []).length === 0 && <li>—</li>}
          </ul>
        </div>

        <div className="section">
          <div className="section-title">ID</div>
          <div className="mono">{term.id}</div>
        </div>
      </div>
    </div>
  )
}

function GlossaryView({ terms, onSelect }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return terms
    return terms.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.definition || '').toLowerCase().includes(q)
    )
  }, [terms, query])

  return (
    <div className="content">
      <div className="toolbar">
        <input
          className="search"
          placeholder="Поиск по терминам…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="hint">Найдено: {filtered.length}</div>
      </div>

      <div className="grid">
        {filtered.map(t => (
          <button key={t.id} className="card" onClick={() => onSelect(t)}>
            <div className="card-title">{t.title}</div>
            <div className="card-body">{t.definition}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// --- Graph helpers (React Flow) ---
const NODE_W = 220
const NODE_H = 46

function layoutWithDagre(inputNodes, inputEdges, direction = 'LR') {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: 70,
    ranksep: 110,
    marginx: 20,
    marginy: 20,
  })

  inputNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  inputEdges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  const isHorizontal = direction === 'LR' || direction === 'RL'
  const nodes = inputNodes.map((n) => {
    const p = g.node(n.id)
    return {
      ...n,
      // dagre возвращает центр, ReactFlow — левый верхний угол
      position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      draggable: true,
    }
  })

  return { nodes, edges: inputEdges }
}

function GraphView({ graph, onSelect }) {
  // Accent colors for hover highlighting (applies to nodes, edges and edge labels)
  const ACCENT = 'rgba(34, 211, 238, 1)'
  const ACCENT_BG = 'rgba(34, 211, 238, 0.92)'
  // Keep hovered edge label text light; dark text becomes unreadable on the dark theme.
  const ACCENT_TEXT = 'rgba(255, 255, 255, 0.95)'

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    if (!graph) return
    const rawNodes = (graph.nodes || []).map((n) => ({
      ...n,
      data: n.data ?? n,
    }))
    const rawEdges = (graph.edges || []).map((e) => ({
      ...e,
      type: 'default',
      animated: false,
      label: e.label,
    }))

    const laid = layoutWithDagre(rawNodes, rawEdges, 'LR')
    setNodes(laid.nodes)
    setEdges(laid.edges)
  }, [graph])

  const neighborIds = useMemo(() => {
    if (!hovered) return null
    const s = new Set([hovered])
    for (const e of edges) {
      if (e.source === hovered) s.add(e.target)
      if (e.target === hovered) s.add(e.source)
    }
    return s
  }, [hovered, edges])

  const displayNodes = useMemo(() => {
    if (!hovered || !neighborIds) return nodes

    return nodes.map((n) => {
      const active = neighborIds.has(n.id)
      // Keep non‑active nodes readable (avoid too low opacity)
      const baseStyle = n.style || {}
      const activeStyle = active
        ? {
            boxShadow: '0 0 0 2px rgba(34, 211, 238, 0.55)',
            borderColor: ACCENT,
          }
        : {}

      return {
        ...n,
        style: {
          ...baseStyle,
          ...activeStyle,
          opacity: active ? 1 : 0.55,
          transition: 'opacity 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
        },
      }
    })
  }, [nodes, hovered, neighborIds, ACCENT])

  const displayEdges = useMemo(() => {
    if (!hovered) return edges

    return edges.map((e) => {
      const active = e.source === hovered || e.target === hovered

      return {
        ...e,
        // Hide non-relevant labels while hovering (less clutter + better perf)
        label: active ? e.label : '',
        style: {
          ...(e.style || {}),
          stroke: active ? ACCENT : 'rgba(255, 255, 255, 0.12)',
          opacity: active ? 1 : 0.18,
          strokeWidth: active ? 3 : 1,
          transition: 'opacity 140ms ease, stroke-width 140ms ease, stroke 140ms ease',
        },
        // Color the edge label as well (text + background)
        labelStyle: {
          ...(e.labelStyle || {}),
          // Dark text on the accent pill => stays readable
          fill: active ? '#06121f' : 'rgba(255, 255, 255, 0.65)',
          fontWeight: active ? 700 : 500,
          opacity: active ? 1 : 0.28,
        },
        labelBgStyle: {
          ...(e.labelBgStyle || {}),
          fill: active ? ACCENT_BG : 'rgba(255, 255, 255, 0.06)',
          stroke: active ? ACCENT : 'rgba(255, 255, 255, 0.10)',
          strokeWidth: 1,
          opacity: active ? 1 : 0.28,
        },
        labelBgPadding: 6,
        labelBgBorderRadius: 6,
      }
    })
  }, [edges, hovered, ACCENT, ACCENT_BG, ACCENT_TEXT])

  const relayout = useCallback(() => {
    const laid = layoutWithDagre(nodes, edges, 'LR')
    setNodes(laid.nodes)
    setEdges(laid.edges)
  }, [nodes, edges, setNodes, setEdges])

  return (
    <div className="graphwrap">
      <div className="graphactions">
        <button className="smallbtn" onClick={relayout} title="Автоматически разложить граф">
          Авто‑раскладка
        </button>
      </div>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelect(node)}
        onNodeMouseEnter={(_, node) => setHovered(node.id)}
        onNodeMouseLeave={() => setHovered(null)}
        fitView
        nodesDraggable
        nodesConnectable={false}
        edgesUpdatable={false}
        edgesFocusable={false}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ animated: false }}
      >
        <Controls />
      </ReactFlow>
      <div className="graphhint">
        Клик по узлу — открыть определение и источники.
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('glossary')
  const [terms, setTerms] = useState([])
  const [graph, setGraph] = useState(null)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadTerms() {
      try {
        const t = await fetchTerms()
        if (!cancelled) setTerms(t)
      } catch (e) {
        if (!cancelled) setError(String(e))
      }
    }
    loadTerms()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadGraph() {
      try {
        const g = await fetchGraph()
        if (!cancelled) setGraph(g)
      } catch (e) {
        if (!cancelled) setError(String(e))
      }
    }
    if (tab === 'graph' && !graph) loadGraph()
    return () => { cancelled = true }
  }, [tab, graph])

  const onSelect = (t) => setSelected(t)

  return (
    <div className="page">
      <TopBar tab={tab} setTab={setTab} />
      {error && <div className="error">{error}</div>}

      <div className="main">
        <div className="main-left">
          {tab === 'glossary' && <GlossaryView terms={terms} onSelect={onSelect} />}
          {tab === 'graph' && <GraphView graph={graph} onSelect={onSelect} />}
        </div>

        <SidePanel term={selected} onClose={() => setSelected(null)} />
      </div>
    </div>
  )
}

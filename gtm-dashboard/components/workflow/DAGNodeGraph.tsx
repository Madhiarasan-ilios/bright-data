'use client';

import { useState } from 'react';
import type { SSENodeEvent } from '@/lib/types';

interface DAGNodeGraphProps {
  nodeEvents: SSENodeEvent[];
  connectionStatus: string;
}

// ─── Node definitions ─────────────────────────────────────────────────────────

const NODE_LABELS: Record<string, string> = {
  query_planner: 'Query Planner',
  hiring_collector: 'Hiring Collector',
  procurement_collector: 'Procurement Collector',
  techstack_collector: 'Techstack Collector',
  compliance_collector: 'Compliance Collector',
  competitive_openness_collector: 'Competitive Openness',
  signal_aggregator: 'Signal Aggregator',
  score_router: 'Conditional Router',
  retry_planner: 'Retry Planner',
  deep_research: 'Deep Research',
  competitor_context: 'Competitor Context',
  sales_brief_generator: 'Sales Brief Generator',
  dashboard_output: 'Dashboard Output',
};

// Node width / height
const NW = 120;
const NH = 36;
const GAP_X = 16;
const GAP_Y = 24;

const COLLECTORS = [
  'hiring_collector',
  'procurement_collector',
  'techstack_collector',
  'compliance_collector',
  'competitive_openness_collector',
];

const BRANCH_NODES = ['retry_planner', 'deep_research', 'competitor_context'];

// Total canvas width: 5 collectors side-by-side
const TOTAL_W = 5 * NW + 4 * GAP_X; // 680
const CX = TOTAL_W / 2; // centre x

function nodeX(col: number, total: number): number {
  const totalWidth = total * NW + (total - 1) * GAP_X;
  const startX = CX - totalWidth / 2;
  return startX + col * (NW + GAP_X);
}

// Row Y positions
const ROW_Y = [0, NH + GAP_Y, 2 * (NH + GAP_Y), 3 * (NH + GAP_Y), 4 * (NH + GAP_Y), 5 * (NH + GAP_Y), 6 * (NH + GAP_Y)];
const CANVAS_H = ROW_Y[6] + NH + 20;

// Pre-compute node positions: { nodeId: { x, y } }
function buildPositions(): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};

  // Row 0: query_planner
  pos['query_planner'] = { x: CX - NW / 2, y: ROW_Y[0] };

  // Row 1: 5 collectors
  COLLECTORS.forEach((id, i) => {
    pos[id] = { x: nodeX(i, 5), y: ROW_Y[1] };
  });

  // Row 2: signal_aggregator
  pos['signal_aggregator'] = { x: CX - NW / 2, y: ROW_Y[2] };

  // Row 3: score_router
  pos['score_router'] = { x: CX - NW / 2, y: ROW_Y[3] };

  // Row 4: 3 branch nodes
  BRANCH_NODES.forEach((id, i) => {
    pos[id] = { x: nodeX(i, 3), y: ROW_Y[4] };
  });

  // Row 5: sales_brief_generator
  pos['sales_brief_generator'] = { x: CX - NW / 2, y: ROW_Y[5] };

  // Row 6: dashboard_output
  pos['dashboard_output'] = { x: CX - NW / 2, y: ROW_Y[6] };

  return pos;
}

const POSITIONS = buildPositions();

// Edges: [from, to]
const EDGES: [string, string][] = [
  ['query_planner', 'hiring_collector'],
  ['query_planner', 'procurement_collector'],
  ['query_planner', 'techstack_collector'],
  ['query_planner', 'compliance_collector'],
  ['query_planner', 'competitive_openness_collector'],
  ['hiring_collector', 'signal_aggregator'],
  ['procurement_collector', 'signal_aggregator'],
  ['techstack_collector', 'signal_aggregator'],
  ['compliance_collector', 'signal_aggregator'],
  ['competitive_openness_collector', 'signal_aggregator'],
  ['signal_aggregator', 'score_router'],
  ['score_router', 'retry_planner'],
  ['score_router', 'deep_research'],
  ['score_router', 'competitor_context'],
  ['retry_planner', 'sales_brief_generator'],
  ['deep_research', 'sales_brief_generator'],
  ['competitor_context', 'sales_brief_generator'],
  ['sales_brief_generator', 'dashboard_output'],
];

// Router branch edges (from score_router to each branch node)
const ROUTER_BRANCH_EDGES: [string, string][] = [
  ['score_router', 'retry_planner'],
  ['score_router', 'deep_research'],
  ['score_router', 'competitor_context'],
];

// ─── Status helpers ───────────────────────────────────────────────────────────

type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'disconnected';

function getNodeStatus(
  nodeId: string,
  nodeEvents: SSENodeEvent[],
  connectionStatus: string
): NodeStatus {
  const events = nodeEvents.filter((e) => e.node === nodeId);
  if (events.length === 0) return 'pending';

  const latest = events[events.length - 1];

  if (latest.status === 'completed') return 'completed';
  if (latest.status === 'failed') return 'failed';
  if (latest.status === 'started') {
    if (connectionStatus === 'error') return 'disconnected';
    return 'running';
  }
  return 'pending';
}

function statusFill(status: NodeStatus): string {
  switch (status) {
    case 'pending': return '#64748b';
    case 'running': return '#3b82f6';
    case 'completed': return '#22c55e';
    case 'failed': return '#ef4444';
    case 'disconnected': return 'none';
  }
}

function statusStroke(status: NodeStatus): string {
  if (status === 'disconnected') return '#64748b';
  return 'transparent';
}

// ─── Tooltip data helpers ─────────────────────────────────────────────────────

interface NodeTooltipData {
  started: string;
  completed: string;
  runtimeMs: string;
  tokenCount: string;
  brightDataCalls: string;
}

function getNodeTooltipData(nodeId: string, nodeEvents: SSENodeEvent[]): NodeTooltipData {
  const events = nodeEvents.filter((e) => e.node === nodeId);

  const startedEvent = events.find((e) => e.status === 'started');
  const completedEvent = events.find((e) => e.status === 'completed');

  const started = startedEvent ? startedEvent.timestamp : '—';
  const completed = completedEvent ? completedEvent.timestamp : '—';
  const runtimeMs = completedEvent?.metadata?.runtime_ms != null
    ? String(completedEvent.metadata.runtime_ms)
    : '—';
  const tokenCount = completedEvent?.metadata?.tokens != null
    ? String(completedEvent.metadata.tokens)
    : '—';
  const brightDataCalls = completedEvent?.metadata?.bright_data_calls != null
    ? String(completedEvent.metadata.bright_data_calls)
    : '—';

  return { started, completed, runtimeMs, tokenCount, brightDataCalls };
}

// ─── Router edge highlighting (Task 16.3) ─────────────────────────────────────

/**
 * Determines which branch path was taken from score_router.
 * Returns the active branch node id, or null if router hasn't completed.
 */
function getActiveBranchNode(nodeEvents: SSENodeEvent[]): string | null {
  const routerCompleted = nodeEvents.some(
    (e) => e.node === 'score_router' && e.status === 'completed'
  );
  if (!routerCompleted) return null;

  // Check which branch node has a started or completed event
  for (const branch of BRANCH_NODES) {
    const hasEvent = nodeEvents.some(
      (e) => e.node === branch && (e.status === 'started' || e.status === 'completed')
    );
    if (hasEvent) return branch;
  }
  return null;
}

function getEdgeStyle(
  from: string,
  to: string,
  activeBranchNode: string | null
): { stroke: string; strokeWidth: number } {
  const isRouterBranch = ROUTER_BRANCH_EDGES.some(([f, t]) => f === from && t === to);

  if (!isRouterBranch || activeBranchNode === null) {
    return { stroke: '#334155', strokeWidth: 1.5 };
  }

  if (to === activeBranchNode) {
    return { stroke: '#f59e0b', strokeWidth: 3 };
  }

  return { stroke: '#334155', strokeWidth: 1 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DAGNodeGraph({ nodeEvents, connectionStatus }: DAGNodeGraphProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const activeBranchNode = getActiveBranchNode(nodeEvents);

  // Tooltip dimensions
  const TT_W = 220;
  const TT_H = 110;
  const TT_PADDING = 8;

  return (
    <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-4 overflow-x-auto">
      <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">
        LangGraph DAG
      </h2>
      <div className="relative inline-block min-w-full">
        <svg
          width={TOTAL_W}
          height={CANVAS_H}
          viewBox={`0 0 ${TOTAL_W} ${CANVAS_H}`}
          className="block"
          aria-label="LangGraph DAG node graph"
        >
          {/* Edges */}
          {EDGES.map(([from, to]) => {
            const fp = POSITIONS[from];
            const tp = POSITIONS[to];
            if (!fp || !tp) return null;
            const x1 = fp.x + NW / 2;
            const y1 = fp.y + NH;
            const x2 = tp.x + NW / 2;
            const y2 = tp.y;
            const edgeStyle = getEdgeStyle(from, to, activeBranchNode);
            return (
              <line
                key={`${from}-${to}`}
                x1={x1} y1={y1}
                x2={x2} y2={y2}
                stroke={edgeStyle.stroke}
                strokeWidth={edgeStyle.strokeWidth}
              />
            );
          })}

          {/* Nodes */}
          {Object.entries(POSITIONS).map(([nodeId, pos]) => {
            const status = getNodeStatus(nodeId, nodeEvents, connectionStatus);
            const fill = statusFill(status);
            const stroke = statusStroke(status);
            const label = NODE_LABELS[nodeId] ?? nodeId;

            return (
              <g
                key={nodeId}
                onMouseEnter={(e) => {
                  setHoveredNode(nodeId);
                  setTooltipPos({ x: pos.x + NW / 2, y: pos.y });
                  void e;
                }}
                onMouseLeave={() => {
                  setHoveredNode(null);
                  setTooltipPos(null);
                }}
                onClick={() => {
                  if (hoveredNode === nodeId) {
                    setHoveredNode(null);
                    setTooltipPos(null);
                  } else {
                    setHoveredNode(nodeId);
                    setTooltipPos({ x: pos.x + NW / 2, y: pos.y });
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={NW}
                  height={NH}
                  rx={6}
                  ry={6}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={status === 'disconnected' ? 2 : 0}
                  className={status === 'running' ? 'animate-pulse' : ''}
                />
                <text
                  x={pos.x + NW / 2}
                  y={pos.y + NH / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize={10}
                  fontWeight={500}
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Tooltip (Task 16.2) */}
          {hoveredNode && tooltipPos && (() => {
            const data = getNodeTooltipData(hoveredNode, nodeEvents);
            const rawX = tooltipPos.x - TT_W / 2;
            const ttX = Math.max(2, Math.min(rawX, TOTAL_W - TT_W - 2));
            const ttY = Math.max(2, tooltipPos.y - TT_H - 10);
            const lineH = 16;
            const rows: { label: string; value: string }[] = [
              { label: 'Started', value: data.started },
              { label: 'Completed', value: data.completed },
              { label: 'Runtime', value: data.runtimeMs === '—' ? '—' : `${data.runtimeMs} ms` },
              { label: 'Tokens', value: data.tokenCount },
              { label: 'BD Calls', value: data.brightDataCalls },
            ];
            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={ttX}
                  y={ttY}
                  width={TT_W}
                  height={TT_H}
                  rx={5}
                  fill="#0f172a"
                  stroke="#334155"
                  strokeWidth={1}
                />
                {rows.map((row, i) => (
                  <g key={row.label}>
                    <text
                      x={ttX + TT_PADDING}
                      y={ttY + TT_PADDING + 10 + i * lineH}
                      fill="#94a3b8"
                      fontSize={9}
                    >
                      {row.label}:
                    </text>
                    <text
                      x={ttX + TT_W - TT_PADDING}
                      y={ttY + TT_PADDING + 10 + i * lineH}
                      textAnchor="end"
                      fill="#f1f5f9"
                      fontSize={9}
                    >
                      {row.value.length > 24 ? row.value.slice(0, 24) + '…' : row.value}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {(['pending', 'running', 'completed', 'failed'] as NodeStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: statusFill(s) }}
            />
            <span className="capitalize">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

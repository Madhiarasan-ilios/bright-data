import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SSENodeEvent } from '@/lib/types';

interface NodeTimelineProps {
  nodeEvents: SSENodeEvent[];
}

interface TimelineBar {
  node: string;
  start: number;
  duration: number;
}

export function NodeTimeline({ nodeEvents }: NodeTimelineProps) {
  if (nodeEvents.length === 0) {
    return (
      <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6">
        <p className="text-sm text-[#94a3b8]">No timeline data yet.</p>
      </div>
    );
  }

  // Find global start time
  const minTs = Math.min(...nodeEvents.map((e) => new Date(e.timestamp).getTime()));

  // Collect nodes that have runtime_ms
  const nodeMap = new Map<string, TimelineBar>();
  for (const event of nodeEvents) {
    const runtimeMs = event.metadata?.runtime_ms;
    if (runtimeMs == null) continue;
    const start = new Date(event.timestamp).getTime() - minTs;
    nodeMap.set(event.node, { node: event.node, start, duration: runtimeMs });
  }

  const data = Array.from(nodeMap.values());

  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6">
        <p className="text-sm text-[#94a3b8]">No runtime data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-4">
      <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">
        Node Timeline
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 20, bottom: 20, left: 140 }}
        >
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            dataKey="duration"
            name="Duration (ms)"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickFormatter={(v) => `${v}ms`}
            label={{
              value: 'Duration (ms)',
              position: 'insideBottom',
              offset: -10,
              fill: '#94a3b8',
              fontSize: 11,
            }}
          />
          <YAxis
            type="category"
            dataKey="node"
            width={135}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}
            formatter={(value) => [`${value}ms`, 'Duration']}
          />
          <Bar dataKey="duration" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

'use client';

import { useGTMStore } from '@/lib/store';
import { TopNav } from '@/components/layout/TopNav';
import { DAGNodeGraph } from '@/components/workflow/DAGNodeGraph';
import { NodeTimeline } from '@/components/workflow/NodeTimeline';

/**
 * Agent Workflow Observability page.
 * Shows the live LangGraph DAG and node execution timeline.
 */
export default function WorkflowPage() {
  const nodeEvents = useGTMStore((s) => s.nodeEvents);
  const connectionStatus = useGTMStore((s) => s.connectionStatus);

  return (
    <div className="min-h-screen bg-[#0f172a] overflow-x-hidden">
      <TopNav />
      <main className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <DAGNodeGraph nodeEvents={nodeEvents} connectionStatus={connectionStatus} />
        <NodeTimeline nodeEvents={nodeEvents} />
      </main>
    </div>
  );
}

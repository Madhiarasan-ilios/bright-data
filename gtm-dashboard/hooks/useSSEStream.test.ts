/**
 * Unit tests for useSSEStream hook
 *
 * Tests cover:
 * - Null jobId returns empty state without opening EventSource
 * - EventSource is opened to the correct URL when jobId is provided
 * - appendNodeEvent is called on each SSE message
 * - connectionStatus is set to 'connected' on open
 * - Reconnection logic: up to 3 retries with 2-second intervals
 * - connectionStatus is set to 'error' after 3 failures
 * - EventSource is closed on unmount
 * - EventSource is closed and re-opened when jobId changes
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSSEStream } from "./useSSEStream";
import { useGTMStore } from "@/lib/store";

// ─── Mock EventSource ─────────────────────────────────────────────────────────

type EventSourceHandler = ((event: Event) => void) | null;

interface MockEventSourceInstance {
  url: string;
  onopen: EventSourceHandler;
  onmessage: EventSourceHandler;
  onerror: EventSourceHandler;
  close: ReturnType<typeof vi.fn>;
  /** Simulate the server opening the connection */
  simulateOpen: () => void;
  /** Simulate a message from the server */
  simulateMessage: (data: string) => void;
  /** Simulate a connection error */
  simulateError: () => void;
}

let mockEventSourceInstances: MockEventSourceInstance[] = [];

class MockEventSource implements MockEventSourceInstance {
  url: string;
  onopen: EventSourceHandler = null;
  onmessage: EventSourceHandler = null;
  onerror: EventSourceHandler = null;
  close = vi.fn(() => {
    // no-op
  });

  constructor(url: string) {
    this.url = url;
    mockEventSourceInstances.push(this);
  }

  simulateOpen() {
    this.onopen?.(new Event("open"));
  }

  simulateMessage(data: string) {
    const event = Object.assign(new Event("message"), { data });
    this.onmessage?.(event as MessageEvent);
  }

  simulateError() {
    this.onerror?.(new Event("error"));
  }
}

// ─── Store reset helper ───────────────────────────────────────────────────────

function resetStore() {
  useGTMStore.setState({
    nodeEvents: [],
    connectionStatus: "disconnected",
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useSSEStream", () => {
  beforeEach(() => {
    mockEventSourceInstances = [];
    vi.useFakeTimers();
    // Replace global EventSource with mock
    vi.stubGlobal("EventSource", MockEventSource);
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetStore();
  });

  it("returns empty state and does not open EventSource when jobId is null", () => {
    const { result } = renderHook(() => useSSEStream(null));

    expect(result.current.events).toEqual([]);
    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.reconnectAttempts).toBe(0);
    expect(mockEventSourceInstances).toHaveLength(0);
  });

  it("opens EventSource to the correct URL when jobId is provided", () => {
    renderHook(() => useSSEStream("job-123"));

    expect(mockEventSourceInstances).toHaveLength(1);
    expect(mockEventSourceInstances[0].url).toBe(
      "http://localhost:8000/api/analyze/job-123/stream"
    );
  });

  it("sets connectionStatus to 'connected' when EventSource opens", () => {
    renderHook(() => useSSEStream("job-123"));

    act(() => {
      mockEventSourceInstances[0].simulateOpen();
    });

    expect(useGTMStore.getState().connectionStatus).toBe("connected");
  });

  it("calls appendNodeEvent and sets status to connected on each message", () => {
    renderHook(() => useSSEStream("job-123"));

    const event = {
      node: "query_planner",
      company: "Acme Corp",
      status: "started",
      timestamp: "2024-01-01T00:00:00Z",
    };

    act(() => {
      mockEventSourceInstances[0].simulateOpen();
      mockEventSourceInstances[0].simulateMessage(JSON.stringify(event));
    });

    const state = useGTMStore.getState();
    expect(state.nodeEvents).toHaveLength(1);
    expect(state.nodeEvents[0]).toEqual(event);
    expect(state.connectionStatus).toBe("connected");
  });

  it("ignores malformed SSE messages without throwing", () => {
    renderHook(() => useSSEStream("job-123"));

    act(() => {
      mockEventSourceInstances[0].simulateOpen();
      // Should not throw
      mockEventSourceInstances[0].simulateMessage("not-valid-json{{{");
    });

    expect(useGTMStore.getState().nodeEvents).toHaveLength(0);
  });

  it("retries up to 3 times with 2-second intervals on error", () => {
    renderHook(() => useSSEStream("job-123"));

    // First error (retryCount 0→1, still < 3) — should schedule retry
    act(() => {
      mockEventSourceInstances[0].simulateError();
    });
    expect(mockEventSourceInstances).toHaveLength(1); // retry not yet fired

    // Advance 2 seconds — first retry opens instance 2
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockEventSourceInstances).toHaveLength(2);

    // Second error (retryCount 1→2, still < 3) — should schedule another retry
    act(() => {
      mockEventSourceInstances[1].simulateError();
    });

    // Advance 2 seconds — second retry opens instance 3
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockEventSourceInstances).toHaveLength(3);

    // Third error (retryCount 2→3, equals MAX_RETRIES) — no more retries
    act(() => {
      mockEventSourceInstances[2].simulateError();
    });

    // No 4th instance should be created — retries exhausted
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockEventSourceInstances).toHaveLength(3);
  });

  it("sets connectionStatus to 'error' after 3 failures", () => {
    renderHook(() => useSSEStream("job-123"));

    // Error 1: retryCount 0→1, schedules retry
    act(() => {
      mockEventSourceInstances[0].simulateError();
    });
    act(() => { vi.advanceTimersByTime(2000); });

    // Error 2: retryCount 1→2, schedules retry
    act(() => {
      mockEventSourceInstances[1].simulateError();
    });
    act(() => { vi.advanceTimersByTime(2000); });

    // Error 3: retryCount 2→3, equals MAX_RETRIES → set 'error'
    act(() => {
      mockEventSourceInstances[2].simulateError();
    });

    expect(useGTMStore.getState().connectionStatus).toBe("error");
  });

  it("closes EventSource on unmount", () => {
    const { unmount } = renderHook(() => useSSEStream("job-123"));

    const instance = mockEventSourceInstances[0];
    unmount();

    expect(instance.close).toHaveBeenCalled();
  });

  it("closes old EventSource and opens new one when jobId changes", () => {
    const { rerender } = renderHook(
      ({ jobId }: { jobId: string | null }) => useSSEStream(jobId),
      { initialProps: { jobId: "job-123" } }
    );

    const firstInstance = mockEventSourceInstances[0];

    act(() => {
      rerender({ jobId: "job-456" });
    });

    expect(firstInstance.close).toHaveBeenCalled();
    expect(mockEventSourceInstances).toHaveLength(2);
    expect(mockEventSourceInstances[1].url).toContain("job-456");
  });

  it("resets reconnectAttempts to 0 on successful open after retries", () => {
    const { result } = renderHook(() => useSSEStream("job-123"));

    // Trigger one error and retry
    act(() => {
      mockEventSourceInstances[0].simulateError();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Simulate successful open on retry
    act(() => {
      mockEventSourceInstances[1].simulateOpen();
    });

    expect(result.current.reconnectAttempts).toBe(0);
    expect(useGTMStore.getState().connectionStatus).toBe("connected");
  });
});

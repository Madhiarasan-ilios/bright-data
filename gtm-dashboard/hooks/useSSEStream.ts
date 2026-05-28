import { useEffect, useRef, useState } from "react";
import { useGTMStore } from "@/lib/store";
import type { SSENodeEvent } from "@/lib/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 2000;

interface UseSSEStreamResult {
  events: SSENodeEvent[];
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  reconnectAttempts: number;
}

/**
 * Opens an EventSource to GET /api/analyze/{jobId}/stream and dispatches
 * appendNodeEvent on each message. Implements reconnection logic: up to 3
 * retries with 2-second intervals, sets connectionStatus to 'error' after
 * 3 failures.
 *
 * Closes the connection cleanly when the __eof__ sentinel is received.
 *
 * When jobId is null, returns empty state and does nothing.
 */
export function useSSEStream(jobId: string | null): UseSSEStreamResult {
  const appendNodeEvent = useGTMStore((s) => s.appendNodeEvent);
  const setConnectionStatus = useGTMStore((s) => s.setConnectionStatus);
  const nodeEvents = useGTMStore((s) => s.nodeEvents);
  const connectionStatus = useGTMStore((s) => s.connectionStatus);

  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Refs to hold mutable values that shouldn't trigger re-renders
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const eofReceivedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // When jobId is null, do nothing
    if (!jobId) {
      return;
    }

    // Reset state when jobId changes
    retryCountRef.current = 0;
    eofReceivedRef.current = false;
    setReconnectAttempts(0);

    function connect() {
      // Clean up any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (!isMountedRef.current) return;

      setConnectionStatus("connecting");

      const url = `${BASE_URL}/api/analyze/${jobId}/stream`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isMountedRef.current) return;
        retryCountRef.current = 0;
        setReconnectAttempts(0);
        setConnectionStatus("connected");
      };

      es.onmessage = (event: MessageEvent) => {
        if (!isMountedRef.current) return;
        try {
          const parsed = JSON.parse(event.data as string);

          // Handle __eof__ sentinel — close the connection cleanly
          if (parsed.__eof__) {
            eofReceivedRef.current = true;
            es.close();
            eventSourceRef.current = null;
            setConnectionStatus("disconnected");
            return;
          }

          // Normal SSE node event
          appendNodeEvent(parsed as SSENodeEvent);
          setConnectionStatus("connected");
        } catch {
          // Ignore malformed SSE messages
        }
      };

      es.onerror = () => {
        if (!isMountedRef.current) return;
        // If we already received EOF, this is a normal close — ignore
        if (eofReceivedRef.current) return;

        // Close the broken connection
        es.close();
        eventSourceRef.current = null;

        retryCountRef.current += 1;
        setReconnectAttempts(retryCountRef.current);

        if (retryCountRef.current < MAX_RETRIES) {
          // Schedule a reconnect attempt
          setConnectionStatus("connecting");
          retryTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, RETRY_INTERVAL_MS);
        } else {
          // Exhausted all retries
          setConnectionStatus("error");
        }
      };
    }

    connect();

    // Cleanup: close EventSource and cancel any pending retry timer
    return () => {
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (!eofReceivedRef.current) {
        setConnectionStatus("disconnected");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // When jobId is null, return empty/default state
  if (!jobId) {
    return {
      events: [],
      connectionStatus: "disconnected",
      reconnectAttempts: 0,
    };
  }

  return {
    events: nodeEvents,
    connectionStatus,
    reconnectAttempts,
  };
}

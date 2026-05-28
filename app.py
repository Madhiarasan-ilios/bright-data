"""
app.py
──────
FastAPI backend that wraps the LangGraph GTM pipeline (main.py).

Endpoints:
  POST /api/analyze                        — trigger a new analysis run
  GET  /api/analyze/{job_id}/stream        — SSE stream of node events
  GET  /api/reports                        — list all completed job summaries
  GET  /api/reports/{job_id}               — full report array for a job
  GET  /api/reports/{job_id}/{company}     — single-account detail
  GET  /api/health                         — health check

Run with:
  uvicorn app:api --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

# Import the compiled LangGraph pipeline
from main import app as langgraph_app

load_dotenv()

# ──────────────────────────────────────────────────────────────
# FastAPI app
# ──────────────────────────────────────────────────────────────

api = FastAPI(
    title="Anthropic GTM Intelligence API",
    description="FastAPI wrapper around the LangGraph GTM pipeline",
    version="1.0.0",
)

# CORS — allow the Next.js dev server and any origin in ALLOWED_ORIGINS
_allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_extra = os.getenv("ALLOWED_ORIGINS", "")
if _extra:
    _allowed_origins.extend([o.strip() for o in _extra.split(",") if o.strip()])

api.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────
# In-memory job store
# ──────────────────────────────────────────────────────────────

class JobRecord:
    def __init__(self, job_id: str, companies: List[str]):
        self.job_id = job_id
        self.companies = companies
        self.status: str = "running"          # running | completed | failed
        self.started_at: str = _now()
        self.completed_at: Optional[str] = None
        self.reports: List[Dict[str, Any]] = []
        self.error: Optional[str] = None
        # SSE event queue — each item is a dict matching SSENodeEvent
        self.events: asyncio.Queue = asyncio.Queue()
        # Subscribers waiting for SSE events
        self._subscribers: List[asyncio.Queue] = []

    def add_event(self, event: Dict[str, Any]) -> None:
        """Broadcast an SSE event to all active subscribers."""
        for q in self._subscribers:
            q.put_nowait(event)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass


_jobs: Dict[str, JobRecord] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ──────────────────────────────────────────────────────────────
# Cache persistence (Req 8.1–8.5)
# ──────────────────────────────────────────────────────────────

CACHE_FILE = "gtm_reports_cache.json"


def _write_cache(job: JobRecord) -> None:
    """Atomically write a completed job to the cache file.

    Writes to a .tmp file first, then uses os.replace() for an atomic rename.
    Logs a warning and continues silently on any failure.
    """
    try:
        payload = {
            "job_id":       job.job_id,
            "companies":    job.companies,
            "started_at":   job.started_at,
            "completed_at": job.completed_at,
            "reports":      job.reports,
        }
        tmp_path = CACHE_FILE + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(payload, f)
        os.replace(tmp_path, CACHE_FILE)
        print(f"[cache] Wrote cache to {CACHE_FILE}")
    except Exception as exc:
        print(f"[cache] Warning: could not write cache: {exc}")


def _restore_cache() -> None:
    """Read the cache file at startup and restore the most recent completed job.

    On FileNotFoundError: logs and starts fresh.
    On parse/key errors: logs a warning and starts fresh.
    On success: inserts a JobRecord with status='completed' into _jobs.
    """
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        job_id       = data["job_id"]
        companies    = data["companies"]
        started_at   = data["started_at"]
        completed_at = data["completed_at"]
        reports      = data["reports"]

        job = JobRecord(job_id=job_id, companies=companies)
        job.status       = "completed"
        job.started_at   = started_at
        job.completed_at = completed_at
        job.reports      = reports
        _jobs[job_id]    = job
        print(f"[cache] Restored job {job_id} ({len(reports)} reports) from {CACHE_FILE}")

    except FileNotFoundError:
        print("[cache] No cache file found — starting fresh")
    except (json.JSONDecodeError, KeyError) as exc:
        print(f"[cache] Could not restore cache: {exc}")
    except Exception as exc:
        print(f"[cache] Could not restore cache: {exc}")


# Restore cache at module load time (before any request is handled)
_restore_cache()


# ──────────────────────────────────────────────────────────────
# SSE-aware LangGraph runner
# ──────────────────────────────────────────────────────────────

async def _run_pipeline(job: JobRecord) -> None:
    """
    Runs the LangGraph pipeline in a thread pool so it doesn't block the
    event loop, and emits SSE node events as each node completes.
    """
    loop = asyncio.get_event_loop()

    def _emit(node: str, company: str, status: str, metadata: Optional[Dict] = None):
        event: Dict[str, Any] = {
            "node": node,
            "company": company,
            "status": status,
            "timestamp": _now(),
        }
        if metadata:
            event["metadata"] = metadata
        # Use call_soon_threadsafe so asyncio.Queue.put_nowait is called from
        # the event loop thread, not from the thread-pool executor thread.
        loop.call_soon_threadsafe(job.add_event, event)

    def _run_sync():
        """
        Synchronous pipeline execution with per-node SSE emission.
        Uses stream_mode='updates' to get node outputs as they complete,
        then reads final_gtm_reports from the accumulated state.
        """
        companies = job.companies
        collected_reports: List[Dict[str, Any]] = []

        # Emit started events for the first visible node
        for c in companies:
            _emit("query_planner", c, "started")

        # Track which companies have had dashboard_output emitted to avoid duplicates
        # (kept for future use if deduplication is needed)

        try:
            # stream() yields {node_name: node_output} dicts as each node finishes
            for chunk in langgraph_app.stream(
                {"accounts": companies, "final_gtm_reports": []},
                stream_mode="updates",
            ):
                for node_name, node_output in chunk.items():
                    if not isinstance(node_output, dict):
                        continue

                    # Collect final reports as they arrive from dashboard_output
                    new_reports = node_output.get("final_gtm_reports", [])
                    if new_reports:
                        collected_reports.extend(new_reports)
                        touched = [r.get("company_name", "") for r in new_reports if r.get("company_name")]
                    else:
                        touched = companies  # broadcast to all for shared nodes

                    for company in (touched or companies):
                        # Emit a synthetic score_router event when signal_aggregator completes
                        # (score_router is a conditional edge function, not a node)
                        if node_name == "signal_aggregator":
                            _emit("score_router", company, "completed")

                        _emit(node_name, company, "completed")

            return collected_reports

        except Exception as exc:
            raise exc

    try:
        # Run the synchronous pipeline in a thread so the event loop stays free
        reports = await loop.run_in_executor(None, _run_sync)
        job.reports = reports
        job.status = "completed"
        job.completed_at = _now()

        # Persist completed job to disk for server-restart recovery (Req 8.1)
        _write_cache(job)

        # Signal end-of-stream to all subscribers (thread-safe)
        loop.call_soon_threadsafe(job.add_event, {"__eof__": True})

    except Exception as exc:
        import traceback
        print(f"[pipeline] FAILED for job {job.job_id}: {exc}")
        traceback.print_exc()
        job.status = "failed"
        job.error = str(exc)
        job.completed_at = _now()
        loop.call_soon_threadsafe(job.add_event, {
            "node": "pipeline",
            "company": "",
            "status": "failed",
            "timestamp": _now(),
            "error": str(exc),
        })
        loop.call_soon_threadsafe(job.add_event, {"__eof__": True})


# ──────────────────────────────────────────────────────────────
# Request / response models
# ──────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    companies: List[str]

    @field_validator("companies")
    @classmethod
    def validate_companies(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("companies list must not be empty")
        if len(v) > 50:
            raise ValueError("companies list must not exceed 50 entries")
        return v


# ──────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────

@api.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": _now()}


@api.post("/api/analyze", status_code=202)
async def analyze(body: AnalyzeRequest):
    job_id = str(uuid.uuid4())
    job = JobRecord(job_id=job_id, companies=body.companies)
    _jobs[job_id] = job

    # Fire-and-forget pipeline execution
    asyncio.create_task(_run_pipeline(job))

    return {"job_id": job_id, "status": "running"}


@api.get("/api/analyze/{job_id}/stream")
async def stream_events(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"job_id {job_id} not found")

    async def event_generator():
        q = job.subscribe()
        try:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    # Send a keep-alive comment so the connection stays open
                    yield ": keep-alive\n\n"
                    continue

                if isinstance(event, dict) and event.get("__eof__"):
                    break

                yield f"data: {json.dumps(event)}\n\n"
        finally:
            job.unsubscribe(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@api.get("/api/reports")
async def list_reports():
    """Returns a summary list of all completed jobs, newest first."""
    summaries = []
    for job in sorted(_jobs.values(), key=lambda j: j.started_at, reverse=True):
        summaries.append({
            "job_id": job.job_id,
            "status": job.status,
            "completed_at": job.completed_at,
            "account_count": len(job.reports),
            "companies": job.companies,
        })
    return summaries


@api.get("/api/reports/{job_id}")
async def get_reports(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"job_id {job_id} not found")
    if job.status == "failed":
        raise HTTPException(status_code=500, detail={"error": job.error})
    return job.reports


@api.get("/api/reports/{job_id}/{company_name}")
async def get_account_report(job_id: str, company_name: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"job_id {job_id} not found")

    # Case-insensitive match
    report = next(
        (r for r in job.reports if r.get("company_name", "").lower() == company_name.lower()),
        None,
    )
    if not report:
        raise HTTPException(
            status_code=404,
            detail=f"company '{company_name}' not found in job {job_id}",
        )
    return report

"""
web_operations.py
─────────────────
Bright Data SERP client + per-signal search helpers.

Query templates are now framed around **Anthropic win probability** signals:
  • Foundation-model evaluation (Claude, GPT, Gemini benchmarking)
  • LLM vendor procurement / RFP (multi-model selection)
  • AI safety / governance signals (Anthropic differentiator alignment)
  • Competitive lock-in detection (OpenAI / MS / Google exclusivity)

The five per-signal helpers (`search_hiring_signals`, `search_procurement_signals`,
`search_techstack_signals`, `search_compliance_signals`, `search_competitive_openness`)
return a structured dict ``{queries, results, organic_text}`` for evidence capture.
`search_deep_research`, `search_competitor_signals`, and `search_retry_broad` are
not collector nodes and continue to return plain strings / section-keyed dicts.
"""

import os
import time
import json
import requests

# ══════════════════════════════════════════════════════════════
# BRIGHT DATA CONFIG
# ══════════════════════════════════════════════════════════════

BD_API_KEY = os.getenv("BRIGHT_DATA_API_KEY", "")
BD_SERP_ID = "gd_mfz5x93lmsjjjylob"          # Google SERP dataset
BD_HEADERS = {
    "Authorization": f"Bearer {BD_API_KEY}",
    "Content-Type": "application/json",
}

# ══════════════════════════════════════════════════════════════
# QUERY TEMPLATES
# All templates accept .format(company=company)
# ══════════════════════════════════════════════════════════════

# Layer 1 — Buying Intent (40 pts)

HIRING_QUERIES: list[str] = [
    "{company} LLM foundation model AI engineer hiring 2024",
    "{company} generative AI prompt engineer machine learning jobs",
]

PROCUREMENT_QUERIES: list[str] = [
    "{company} LLM foundation model vendor evaluation RFP 2024",
    "{company} enterprise AI platform procurement selection contract",
]

# Layer 2 — Foundation Model Evaluation (25 pts)

TECHSTACK_QUERIES: list[str] = [
    "{company} GPT Claude Gemini evaluation benchmark comparison 2024",
    "{company} engineering blog LLM foundation model selection",
    "{company} multi-model AI architecture provider strategy",
]

# Layer 3 — Safety / Governance Alignment (20 pts)

COMPLIANCE_QUERIES: list[str] = [
    "{company} AI safety governance regulation compliance 2024",
    "{company} responsible AI constitutional AI policy framework",
]

# Layer 4 — Competitive Openness (15 pts)

COMPETITIVE_OPENNESS_QUERIES: list[str] = [
    "{company} OpenAI Microsoft exclusive AI partnership contract",
    "{company} multi-model AI vendor diversification strategy",
    "{company} AI provider alternatives evaluation switching",
]

# Deep Research (high-intent accounts only)

DEEP_RESEARCH_QUERY_TEMPLATES: dict[str, str] = {
    "leadership":   "{company} CTO CDO Chief AI Officer AI strategy 2024",
    "projects":     "{company} AI LLM project deployment platform 2024",
    "budget":       "{company} technology budget AI investment 2024 2025",
    "pain_points":  "{company} AI governance cost efficiency challenges scale",
}

# Competitor mapping (used post-routing)

COMPETITOR_QUERIES: list[str] = [
    "OpenAI {company} enterprise deal partnership",
    "Microsoft Copilot Azure OpenAI {company} deployment",
    "Google Gemini Vertex AI {company} enterprise",
    "Anthropic Claude enterprise {company}",
]

# Broad fallback for retry path

RETRY_QUERY_TEMPLATE: str = (
    "{company} artificial intelligence foundation model technology strategy 2024"
)

# ══════════════════════════════════════════════════════════════
# CORE BRIGHT DATA CLIENT
# ══════════════════════════════════════════════════════════════

def _bd_serp(query: str, num: int = 5) -> list[dict]:
    """
    Trigger a Bright Data SERP snapshot and poll until the results are ready.

    Falls back to a mock result list when BD_API_KEY is absent so the graph
    always runs (useful for development / CI).

    Args:
        query: The search query string.
        num:   Approximate number of result pages requested (capped at 3).

    Returns:
        List of raw result dicts from the Bright Data API, or [] on error.
    """
    if not BD_API_KEY:
        print(f"    [BD MOCK] {query}")
        return [
            {
                "title": f"Mock: {query}",
                "description": f"Sample result for: {query}",
                "url": "https://example.com",
            }
        ]

    try:
        # ── 1. Trigger snapshot ──────────────────────────────────────────
        payload = [
            {
                "url": "https://www.google.com/",
                "keyword": query,
                "language": "en",
                "country": "US",
                "start_page": 1,
                "end_page": max(1, min(num, 3)),
            }
        ]
        resp = requests.post(
            "https://api.brightdata.com/datasets/v3/trigger",
            headers=BD_HEADERS,
            params={"dataset_id": BD_SERP_ID, "include_errors": "true"},
            json=payload,
            timeout=30,
        )
        if resp.status_code not in (200, 202):
            print(f"    [BD] Trigger failed {resp.status_code}: {resp.text[:120]}")
            return []

        snapshot_id = resp.json().get("snapshot_id", "")
        if not snapshot_id:
            print("    [BD] No snapshot_id in response")
            return []

        # ── 2. Poll until ready (~90 s max) ─────────────────────────────
        poll_url = f"https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}"
        for attempt in range(18):                     # 18 × 5 s = 90 s
            time.sleep(5)
            pr = requests.get(
                poll_url,
                headers=BD_HEADERS,
                params={"format": "json"},
                timeout=30,
            )
            if pr.status_code == 200:
                data = pr.json()
                if isinstance(data, list):
                    return data
            elif pr.status_code != 202:               # unexpected status
                print(f"    [BD] Poll error {pr.status_code} on attempt {attempt + 1}")
                break

    except Exception as exc:
        print(f"    [BD] Exception: {exc}")

    return []


def _extract_serp_results(results: list[dict]) -> list[dict]:
    """
    Flatten Bright Data SERP results into a list of structured dicts.

    Reuses the same flattening logic as `_organic_text` but returns structured
    dicts instead of a plain-text string. Caps output at 10 items.

    Args:
        results: Raw result dicts from the Bright Data API.

    Returns:
        List of up to 10 dicts with keys ``title``, ``description``, and ``url``.
        Missing fields default to an empty string.
    """
    flat: list[dict] = []
    for r in results:
        if "organic" in r and isinstance(r["organic"], list):
            flat.extend(r["organic"])
        if "general" in r and isinstance(r["general"], list):
            flat.extend(r["general"])
        elif "title" in r or "description" in r or "snippet" in r:
            flat.append(r)

    structured: list[dict] = []
    for item in flat[:10]:
        title = item.get("title", "")
        desc = (
            item.get("description", "")
            or item.get("snippet", "")
            or item.get("body", "")
        )
        url = item.get("url", item.get("link", ""))
        structured.append({"title": title, "description": desc, "url": url})

    return structured


def _organic_text(results: list[dict]) -> str:
    """
    Flatten Bright Data SERP results into a plain-text snippet list for the LLM.

    Handles both:
      • Nested layout — result[i]["organic"] = [{title, description, url}, ...]
      • Flat layout   — each dict is itself a result (mock / older schema)

    Caps output at 12 organic hits to stay within token budget.

    Returns:
        Multi-line string of "- title: description (url)" entries,
        or a raw JSON dump when no structured fields are found.
    """
    flat: list[dict] = []
    for r in results:
        if "organic" in r and isinstance(r["organic"], list):
            flat.extend(r["organic"])
        if "general" in r and isinstance(r["general"], list):
            flat.extend(r["general"])
        elif "title" in r or "description" in r or "snippet" in r:
            flat.append(r)

    lines: list[str] = []
    for item in flat[:12]:
        title = item.get("title", "")
        desc  = (
            item.get("description", "")
            or item.get("snippet", "")
            or item.get("body", "")
        )
        url = item.get("url", item.get("link", ""))
        if title or desc:
            lines.append(f"- {title}: {desc} ({url})")

    if not lines:
        # Last resort — raw dump so the LLM still has something to reason on
        raw = json.dumps(results[:3], ensure_ascii=False)[:1_200]
        return f"Raw API data (parse manually):\n{raw}"

    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════
# PER-SIGNAL SEARCH HELPERS
# ══════════════════════════════════════════════════════════════

def search_hiring_signals(company: str) -> dict:
    """Layer 1a — Foundation-model / LLM hiring activity (0-20 pts).

    Returns:
        dict with keys:
          ``queries``      — list of query strings used
          ``results``      — list of up to 10 ``{title, description, url}`` dicts
          ``organic_text`` — flattened plain-text snippet for the LLM
    """
    queries = [t.format(company=company) for t in HIRING_QUERIES]
    raw: list[dict] = []
    for q in queries:
        raw.extend(_bd_serp(q, num=4))
    return {
        "queries": queries,
        "results": _extract_serp_results(raw),
        "organic_text": _organic_text(raw),
    }


def search_procurement_signals(company: str) -> dict:
    """Layer 1b — LLM vendor procurement / RFP activity (0-20 pts).

    Returns:
        dict with keys:
          ``queries``      — list of query strings used
          ``results``      — list of up to 10 ``{title, description, url}`` dicts
          ``organic_text`` — flattened plain-text snippet for the LLM
    """
    queries = [t.format(company=company) for t in PROCUREMENT_QUERIES]
    raw: list[dict] = []
    for q in queries:
        raw.extend(_bd_serp(q, num=4))
    return {
        "queries": queries,
        "results": _extract_serp_results(raw),
        "organic_text": _organic_text(raw),
    }


def search_techstack_signals(company: str) -> dict:
    """Layer 2 — Foundation-model evaluation / benchmarking signals (0-25 pts).

    Returns:
        dict with keys:
          ``queries``      — list of query strings used
          ``results``      — list of up to 10 ``{title, description, url}`` dicts
          ``organic_text`` — flattened plain-text snippet for the LLM
    """
    queries = [t.format(company=company) for t in TECHSTACK_QUERIES]
    raw: list[dict] = []
    for q in queries:
        raw.extend(_bd_serp(q, num=4))
    return {
        "queries": queries,
        "results": _extract_serp_results(raw),
        "organic_text": _organic_text(raw),
    }


def search_compliance_signals(company: str) -> dict:
    """Layer 3 — AI safety / governance / regulatory alignment (0-20 pts).

    Returns:
        dict with keys:
          ``queries``      — list of query strings used
          ``results``      — list of up to 10 ``{title, description, url}`` dicts
          ``organic_text`` — flattened plain-text snippet for the LLM
    """
    queries = [t.format(company=company) for t in COMPLIANCE_QUERIES]
    raw: list[dict] = []
    for q in queries:
        raw.extend(_bd_serp(q, num=3))
    return {
        "queries": queries,
        "results": _extract_serp_results(raw),
        "organic_text": _organic_text(raw),
    }


def search_competitive_openness(company: str) -> dict:
    """Layer 4 — Competitive lock-in vs openness to Anthropic (0-15 pts).

    Returns:
        dict with keys:
          ``queries``      — list of query strings used
          ``results``      — list of up to 10 ``{title, description, url}`` dicts
          ``organic_text`` — flattened plain-text snippet for the LLM
    """
    queries = [t.format(company=company) for t in COMPETITIVE_OPENNESS_QUERIES]
    raw: list[dict] = []
    for q in queries:
        raw.extend(_bd_serp(q, num=3))
    return {
        "queries": queries,
        "results": _extract_serp_results(raw),
        "organic_text": _organic_text(raw),
    }


def search_deep_research(company: str) -> dict[str, str]:
    """
    High-intent accounts only.
    Returns a section-keyed dict {leadership, projects, budget, pain_points}.
    Each value is an organic_text string ready for the LLM.
    """
    return {
        section: _organic_text(
            _bd_serp(template.format(company=company), num=5)
        )
        for section, template in DEEP_RESEARCH_QUERY_TEMPLATES.items()
    }


def search_competitor_signals(company: str) -> str:
    """
    Post-routing enrichment.
    Identifies which AI vendors are actively engaged with this account
    and how to position Claude against them.
    """
    results: list[dict] = []
    for template in COMPETITOR_QUERIES:
        results.extend(_bd_serp(template.format(company=company), num=3))
    return _organic_text(results)


def search_retry_broad(company: str) -> str:
    """Fallback broad search for low-intent accounts (retry path)."""
    results = _bd_serp(RETRY_QUERY_TEMPLATE.format(company=company), num=5)
    return _organic_text(results)
import operator
import time
import json
import requests
from dotenv import load_dotenv
from typing import Annotated, List, Dict, Any
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send
from langchain.chat_models import init_chat_model
from typing_extensions import TypedDict
import json
from prompts import (
    get_query_planner_messages,
    get_hiring_messages,
    get_procurement_messages
)

from web_operations import (

    hiring_search,

    procurement_search

)

import asyncio

load_dotenv()

llm = init_chat_model(
    "gemini-2.5-flash",
    model_provider="google_genai"
)

# ══════════════════════════════════════════════════════════════
# BRIGHT DATA CLIENT
# ══════════════════════════════════════════════════════════════

import os

BD_API_KEY  = os.getenv("BRIGHT_DATA_API_KEY", "")
BD_SERP_ID = "gd_mfz5x93lmsjjjylob"   # Bright Data SERP dataset ID
BD_HEADERS  = {
    "Authorization": f"Bearer {BD_API_KEY}",
    "Content-Type": "application/json",
}


def _bd_serp(query: str, num: int = 5) -> list[dict]:
    """
    Trigger a Bright Data SERP snapshot and poll until ready.
    Falls back to an empty list on any error (keeps graph running).
    """
    if not BD_API_KEY or BD_API_KEY == "":
        print(f"    [BD MOCK] {query}")
        return [{"title": f"Mock: {query}", "description": f"Sample result for {query}", "url": "https://example.com"}]

    try:
        # 1. Trigger
        payload = [
            {
                "url": "https://www.google.com/",
                "keyword": query,
                "language": "en",
                "country": "US",
                "start_page": 1,
                "end_page": max(1, min(num, 3))
            }
        ]

        resp = requests.post(
            "https://api.brightdata.com/datasets/v3/trigger",
            headers=BD_HEADERS,
            params={
                "dataset_id": BD_SERP_ID,
                "include_errors": "true"
            },
            json=payload,
            timeout=30,
        )

        if resp.status_code not in (200, 202):
            print(f"    [BD] Trigger failed {resp.status_code}: {resp.text[:120]}")
            return []

        snapshot_id = resp.json().get("snapshot_id", "")
        if not snapshot_id:
            return []

        # 2. Poll
        poll_url = f"https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}"
        for _ in range(18):          # max ~90s
            time.sleep(5)
            pr = requests.get(poll_url, headers=BD_HEADERS, params={"format": "json"})
            if pr.status_code == 200:
                data = pr.json()
                if isinstance(data, list):
                    return data
            elif pr.status_code != 202:
                break

    except Exception as e:
        print(f"    [BD] Exception: {e}")

    return []


def _organic_text(results: list[dict]) -> str:
    """Flatten SERP results into a plain string for LLM context."""
    lines = []
    for r in results[:8]:
        title = r.get("title", "")
        desc  = r.get("description", r.get("snippet", ""))
        url   = r.get("url", r.get("link", ""))
        if title or desc:
            lines.append(f"- {title}: {desc} ({url})")
    return "\n".join(lines) if lines else "No results found."


# ══════════════════════════════════════════════════════════════
# STATE DEFINITIONS
# ══════════════════════════════════════════════════════════════

llm = init_chat_model("gemini-2.5-flash")


class CompanyWorkerState(TypedDict):

    company_name: str

    research_queries: Dict[str, Any]

    signals: Annotated[
        List[Dict[str, Any]],
        operator.add
    ]

    intent_score: int

    deep_research_results: Dict[str, Any]
    final_output: Dict[str, Any]

    final_output: Dict[str, Any]


class State(TypedDict):

    accounts: List[str]

    planned_queries: Dict[str, Any]

    final_gtm_reports: Annotated[
        List[Dict[str, Any]],
        operator.add
    ]


# ══════════════════════════════════════════════════════════════
# MAIN GRAPH NODES
# ══════════════════════════════════════════════════════════════

def user_input_node(state: State) -> Dict[str, Any]:
    """
    Entry point. Passes through whatever accounts were given in the initial invoke.
    If none provided, defaults to a sample list.
    """
    accounts = state.get("accounts") or ["Goldman Sachs", "Pfizer", "JPMorgan"]
    print(f"\n[user_input] Processing {len(accounts)} accounts: {accounts}")
    return {"accounts": accounts}

    print("Executing user_input_node")

    accounts = state.get("accounts", [])

    if not accounts:
        raise ValueError(
            "No accounts provided. Pass accounts during app.invoke()."
        )

    return {
        "accounts": accounts
    }

def query_planner_node(state: State) -> Dict[str, Any]:
    """
    Uses LLM to validate / enrich account list.
    Could expand abbreviations, deduplicate, rank by potential, etc.
    """
    accounts = state.get("accounts", [])
    prompt = f"""You are a GTM planning assistant.
Given this list of company names: {accounts}
1. Fix any typos or abbreviations.
2. Return ONLY a JSON array of cleaned company names, nothing else.
Example output: ["Goldman Sachs", "Pfizer", "JPMorgan Chase"]"""

    response = llm.invoke(prompt)
    raw = response.content.strip()

    try:
        # Strip markdown fences if present
        clean = raw.replace("```json", "").replace("```", "").strip()
        cleaned_accounts = json.loads(clean)
        if isinstance(cleaned_accounts, list) and cleaned_accounts:
            print(f"[query_planner] Cleaned accounts: {cleaned_accounts}")
            return {"accounts": cleaned_accounts}
    except Exception:
        pass

    print(f"[query_planner] Keeping original accounts.")
    return {}

    print("Executing query_planner_node")

    accounts = state.get("accounts", [])

    if not accounts:
        raise ValueError(
            "No accounts found for query planning."
        )

    prompt = get_query_planner_messages(accounts)

    response = llm.invoke(
        prompt.format_messages()
    )

    try:

        planned_queries = json.loads(
            response.content
        )

    except Exception as e:

        print(
            f"Query planner parse failed: {e}"
        )

        planned_queries = {}

    print(
        "Generated structured GTM research plan."
    )

    return {
        "accounts": accounts,
        "planned_queries": planned_queries
    }


def orchestrator_node(state: State):
    accounts = state.get("accounts", [])

    print(f"[orchestrator] Spawning {len(accounts)} workers")

    return [
        Send(
            "company_researcher",
            {
                "company_name": c,
                "signals": [],
                "intent_score": 0,
                "deep_research_results": {},
                "final_output": {},
            },
        )
        for c in accounts
    ]


# ══════════════════════════════════════════════════════════════
# SIGNAL COLLECTOR NODES  (fan-out from START of sub-graph)
# ══════════════════════════════════════════════════════════════
def orchestrator_node(state: State) -> List[Send]:

    accounts = state.get("accounts", [])
    planned_queries = state.get("planned_queries", {})

    print(
        f"Executing orchestrator_node "
        f"for accounts: {accounts}"
    )

    if not accounts:
        raise ValueError(
            "orchestrator_node received empty accounts list."
        )

    workers = []

    for company in accounts:

        company_queries = planned_queries.get(
            company,
            {}
        )

        workers.append(

            Send(
                "company_researcher",
                {
                    "company_name": company,

                    "research_queries":
                    company_queries,

                    "signals": [],

                    "intent_score": 0,

                    "deep_research_results": {},

                    "final_output": {}
                }
            )
        )

    print(
        f"Spawned {len(workers)} "
        f"company researcher workers."
    )

    return workers


def hiring_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Searches for AI/LLM hiring activity.
    Score contribution: up to 30 pts.
    """
    company = state["company_name"]
    print(f"  [hiring_collector] {company}")

    results = []
    for q in [f"{company} AI LLM engineer hiring 2024",
               f"{company} generative AI jobs machine learning"]:
        results.extend(_bd_serp(q, num=4))

    context = _organic_text(results)

    prompt = f"""Analyze these search results about {company}'s AI hiring activity.

RESULTS:
{context}

Return JSON only:
{{
  "signal_found": true/false,
  "summary": "one sentence describing the hiring signal",
  "score": <integer 0-30>,
  "key_roles": ["role1", "role2"]
}}

Score guide: 0=no signal, 10=general tech hiring, 20=some AI roles, 30=aggressive LLM/GenAI hiring"""

    resp = llm.invoke(prompt)
    try:
        parsed = json.loads(resp.content.strip().replace("```json","").replace("```",""))
    except Exception:
        parsed = {"signal_found": False, "summary": "parse error", "score": 0, "key_roles": []}

    print(f"    → hiring score: {parsed.get('score', 0)} | {parsed.get('summary','')}")
    return {"signals": [{"type": "hiring", "score": parsed.get("score", 0),
                          "summary": parsed.get("summary", ""),
                          "key_roles": parsed.get("key_roles", []),
                          "raw_count": len(results)}]}

def hiring_collector_node(
    state: CompanyWorkerState
) -> Dict[str, Any]:

    company_name = state["company_name"]

    print(
        f"Executing hiring_collector_node "
        f"for {company_name}"
    )

    research_queries = state.get(
        "research_queries",
        {}
    )

    hiring_query = research_queries.get(
        "hiring_query"
    )

    if not hiring_query:

        hiring_query = (
            f"{company_name} "
            f"AI hiring LLM jobs"
        )

    # ----------------------------------
    # Bright Data LinkedIn Job Search
    # ----------------------------------

    brightdata_results = asyncio.run(

        hiring_search(

            company=company_name,

            query=hiring_query
        )
    )

    # ----------------------------------
    # LLM Prompt
    # ----------------------------------

    prompt = get_hiring_messages(

        company=company_name,

        query=hiring_query,

        search_results=json.dumps(
            brightdata_results,
            indent=2
        )
    )

    response = llm.invoke(
        prompt.format_messages()
    )

    try:

        analysis = json.loads(
            response.content
        )

    except Exception:

        analysis = {

            "signal_summary":
            response.content,

            "roles_detected":[],

            "ai_maturity":"unknown",

            "buying_intent":"unknown",

            "confidence_score":50
        }

    return {

        "signals":[

            {

                "type":"hiring",

                "data":{

                    "company":
                    company_name,

                    "query_used":
                    hiring_query,

                    "linkedin_jobs":
                    brightdata_results,

                    "analysis":
                    analysis
                }
            }
        ]
    }

def procurement_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Searches for RFP / procurement / budget signals.
    Score contribution: up to 25 pts.
    """
    company = state["company_name"]
    print(f"  [procurement_collector] {company}")

    results = []
    for q in [f"{company} AI software procurement RFP 2024",
               f"{company} enterprise AI vendor budget"]:
        results.extend(_bd_serp(q, num=4))

    context = _organic_text(results)

    prompt = f"""Analyze these search results about {company}'s AI procurement / buying activity.

RESULTS:
{context}

Return JSON only:
{{
  "signal_found": true/false,
  "summary": "one sentence describing the procurement signal",
  "score": <integer 0-25>,
  "evidence": "short quote or paraphrase of key evidence"
}}

Score guide: 0=none, 8=general IT spend, 16=AI vendor mentions, 25=active RFP/evaluation"""

    resp = llm.invoke(prompt)
    try:
        parsed = json.loads(resp.content.strip().replace("```json","").replace("```",""))
    except Exception:
        parsed = {"signal_found": False, "summary": "parse error", "score": 0, "evidence": ""}

    print(f"    → procurement score: {parsed.get('score', 0)} | {parsed.get('summary','')}")
    return {"signals": [{"type": "procurement", "score": parsed.get("score", 0),
                          "summary": parsed.get("summary", ""),
                          "evidence": parsed.get("evidence", "")}]}

def procurement_collector_node(
    state: CompanyWorkerState
) -> Dict[str, Any]:

    company_name = state["company_name"]

    print(
        f"Executing procurement_collector_node "
        f"for {company_name}"
    )

    research_queries = state.get(
        "research_queries",
        {}
    )

    procurement_query = research_queries.get(
        "procurement_query"
    )

    if not procurement_query:

        procurement_query = (

            f"{company_name} "

            f"AI vendor evaluation "

            f"enterprise procurement RFP"
        )

    # ----------------------------------
    # Bright Data Procurement Search
    # ----------------------------------

    brightdata_results = procurement_search(

        company=company_name,

        query=procurement_query
    )

    # ----------------------------------
    # LLM Prompt
    # ----------------------------------

    prompt = get_procurement_messages(

        company=company_name,

        query=procurement_query,

        search_results=json.dumps(
            brightdata_results,
            indent=2
        )
    )

    response = llm.invoke(
        prompt.format_messages()
    )

    try:

        analysis = json.loads(
            response.content
        )

    except Exception:

        analysis = {

            "signal_summary":
            response.content,

            "vendors_detected":[],

            "procurement_stage":
            "unknown",

            "buying_intent":
            "unknown",

            "confidence_score":50
        }

    return {

        "signals":[

            {

                "type":"procurement",

                "data":{

                    "company":
                    company_name,

                    "query_used":
                    procurement_query,

                    "brightdata_results":
                    brightdata_results,

                    "analysis":
                    analysis
                }
            }
        ]
    }

def compliance_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Searches for AI governance / compliance / regulatory pressure.
    Regulated industries (finance, pharma) feel more pressure → higher intent.
    Score contribution: up to 20 pts.
    """
    company = state["company_name"]
    print(f"  [compliance_collector] {company}")

    results = []
    for q in [f"{company} AI governance compliance regulation 2024",
               f"{company} responsible AI policy framework"]:
        results.extend(_bd_serp(q, num=3))

    context = _organic_text(results)

    prompt = f"""Analyze these search results about {company}'s AI governance/compliance posture.

RESULTS:
{context}

Return JSON only:
{{
  "signal_found": true/false,
  "summary": "one sentence",
  "score": <integer 0-20>,
  "regulatory_pressure": "high/medium/low"
}}

Score guide: 0=no signal, 7=general AI policy mentions, 14=active compliance program, 20=regulatory mandate driving AI spend"""

    resp = llm.invoke(prompt)
    try:
        parsed = json.loads(resp.content.strip().replace("```json","").replace("```",""))
    except Exception:
        parsed = {"signal_found": False, "summary": "parse error", "score": 0, "regulatory_pressure": "low"}

    print(f"    → compliance score: {parsed.get('score', 0)} | {parsed.get('summary','')}")
    return {"signals": [{"type": "compliance", "score": parsed.get("score", 0),
                          "summary": parsed.get("summary", ""),
                          "regulatory_pressure": parsed.get("regulatory_pressure", "low")}]}


def techstack_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Searches for LLM model evaluation / tech stack signals.
    Score contribution: up to 35 pts (highest — strongest buying intent signal).
    """
    company = state["company_name"]
    print(f"  [techstack_collector] {company}")

    results = []
    for q in [f"{company} GPT Claude Gemini evaluation benchmark",
               f"{company} engineering blog LLM foundation model",
               f"{company} AI platform architecture multi-model"]:
        results.extend(_bd_serp(q, num=4))

    context = _organic_text(results)

    prompt = f"""Analyze these search results about {company}'s AI/LLM tech stack evaluation activity.

RESULTS:
{context}

Return JSON only:
{{
  "signal_found": true/false,
  "summary": "one sentence",
  "score": <integer 0-35>,
  "models_mentioned": ["model1", "model2"],
  "evaluation_stage": "none/exploring/active_eval/deployed"
}}

Score guide: 0=none, 10=general AI mention, 20=specific model names, 30=comparison/benchmarking, 35=active multi-model evaluation"""

    resp = llm.invoke(prompt)
    try:
        parsed = json.loads(resp.content.strip().replace("```json","").replace("```",""))
    except Exception:
        parsed = {"signal_found": False, "summary": "parse error", "score": 0,
                  "models_mentioned": [], "evaluation_stage": "none"}

    print(f"    → techstack score: {parsed.get('score', 0)} | {parsed.get('summary','')}")
    return {"signals": [{"type": "techstack", "score": parsed.get("score", 0),
                          "summary": parsed.get("summary", ""),
                          "models_mentioned": parsed.get("models_mentioned", []),
                          "evaluation_stage": parsed.get("evaluation_stage", "none")}]}


def partnership_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Searches for AI vendor partnerships / integration announcements.
    Score contribution: up to 20 pts.
    """
    company = state["company_name"]
    print(f"  [partnership_collector] {company}")

    results = []
    for q in [f"{company} AI partnership Microsoft OpenAI Google Anthropic",
               f"{company} enterprise AI integration announcement 2024"]:
        results.extend(_bd_serp(q, num=3))

    context = _organic_text(results)

    prompt = f"""Analyze these search results about {company}'s AI vendor partnerships.

RESULTS:
{context}

Return JSON only:
{{
  "signal_found": true/false,
  "summary": "one sentence",
  "score": <integer 0-20>,
  "partners_mentioned": ["partner1", "partner2"]
}}

Score guide: 0=none, 7=general tech partnership, 14=specific AI vendor deal, 20=major multi-year AI partnership"""

    resp = llm.invoke(prompt)
    try:
        parsed = json.loads(resp.content.strip().replace("```json","").replace("```",""))
    except Exception:
        parsed = {"signal_found": False, "summary": "parse error", "score": 0, "partners_mentioned": []}

    print(f"    → partnership score: {parsed.get('score', 0)} | {parsed.get('summary','')}")
    return {"signals": [{"type": "partnership", "score": parsed.get("score", 0),
                          "summary": parsed.get("summary", ""),
                          "partners_mentioned": parsed.get("partners_mentioned", [])}]}


# ══════════════════════════════════════════════════════════════
# AGGREGATOR NODE  (fan-in)
# ══════════════════════════════════════════════════════════════

def signal_aggregator_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Merges all collector outputs into a single buying intent score.
    Uses LLM to provide a human-readable explanation of the score.
    """
    company  = state["company_name"]
    signals  = state.get("signals", [])
    raw_score = sum(s.get("score", 0) for s in signals)

    # Cap at 100
    final_score = min(raw_score, 100)

    signal_summary = "\n".join(
        f"  - [{s['type'].upper()}] score={s.get('score',0)}: {s.get('summary','')}"
        for s in signals
    )

    prompt = f"""You are a GTM analyst scoring {company}'s AI buying intent.

Signal breakdown (raw total = {raw_score}/130):
{signal_summary}

Normalized intent score: {final_score}/100

In 2 sentences, explain what these signals collectively say about {company}'s likelihood to purchase an enterprise AI platform.
Be specific. Reference the actual signals."""

    resp = llm.invoke(prompt)
    explanation = resp.content.strip()

    print(f"\n[signal_aggregator] {company} → score={final_score}/100")
    print(f"  {explanation}")

    return {
        "intent_score": final_score,
        "final_output": {"score_explanation": explanation, "raw_score": raw_score}
    }


# ══════════════════════════════════════════════════════════════
# CONDITIONAL ROUTER
# ══════════════════════════════════════════════════════════════

def score_router_node(state: CompanyWorkerState) -> str:
    """
    Routes based on intent score:
      < 20  → retry_planner   (not enough signal, try different queries)
      20-69 → competitor_context  (warm lead, enrich with competitive intel)
      ≥ 70  → deep_research   (hot lead, do full research before pitch)
    """
    score   = state.get("intent_score", 0)
    company = state["company_name"]

    if score < 20:
        route = "retry_planner"
    elif score >= 70:
        route = "deep_research"
    else:
        route = "competitor_context"

    print(f"[score_router] {company} score={score} → {route}")
    return route


# ══════════════════════════════════════════════════════════════
# CONDITIONAL BRANCH NODES
# ══════════════════════════════════════════════════════════════

def retry_planner_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Score was too low — try broader queries with a different angle.
    Searches for any AI news at all, then produces a minimal output.
    """
    company = state["company_name"]
    print(f"[retry_planner] Low score for {company}, running broader search...")

    results = _bd_serp(f"{company} artificial intelligence technology 2024", num=5)
    context = _organic_text(results)

    prompt = f"""You are a GTM analyst. {company} showed low AI buying intent signals.

Broader search context:
{context}

In 3 bullet points, explain:
1. Why this company shows low intent right now
2. What to watch for that would change this
3. Recommended re-evaluation timeline

Be concise and specific."""

    resp = llm.invoke(prompt)

    return {
        "final_output": {
            "status": "low_intent_monitor",
            "company": company,
            "intent_score": state.get("intent_score", 0),
            "analyst_note": resp.content.strip(),
            "recommended_action": f"Add {company} to 90-day nurture sequence. Re-score on trigger event.",
            "priority": "LOW",
        }
    }


def deep_research_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    High intent score — run deep research on leadership, org structure,
    budget cycle, and current AI projects using multiple Bright Data queries.
    """
    company = state["company_name"]
    print(f"[deep_research] Running deep research for {company}...")

    # Multiple targeted queries for maximum signal depth
    deep_results = {}

    deep_results["leadership"] = _bd_serp(
        f"{company} CTO CDO Chief AI Officer interview AI strategy 2024", num=5)

    deep_results["projects"] = _bd_serp(
        f"{company} AI project deployment internal platform 2024", num=5)

    deep_results["budget"] = _bd_serp(
        f"{company} technology budget AI investment 2024 2025", num=4)

    deep_results["pain_points"] = _bd_serp(
        f"{company} AI challenges governance cost efficiency scale", num=4)

    context_parts = []
    for section, results in deep_results.items():
        context_parts.append(f"\n=== {section.upper()} ===\n{_organic_text(results)}")
    full_context = "\n".join(context_parts)

    prompt = f"""You are a senior enterprise sales researcher. Analyze all available intelligence about {company}.

RESEARCH DATA:
{full_context}

Return JSON only:
{{
  "buying_stage": "Active Evaluation | Exploring | Strategic Initiative | Deployed",
  "key_stakeholders": ["Title: Name/role if found", ...],
  "active_ai_projects": ["project description", ...],
  "budget_signals": "description of budget/spend signals",
  "pain_points": ["pain point 1", "pain point 2", ...],
  "entry_angle": "the single best way to approach this account",
  "urgency": "high/medium/low",
  "confidence": "high/medium/low"
}}"""

    resp = llm.invoke(prompt)
    try:
        parsed = json.loads(resp.content.strip().replace("```json","").replace("```",""))
    except Exception:
        parsed = {
            "buying_stage": "Unknown",
            "key_stakeholders": [],
            "active_ai_projects": [],
            "budget_signals": "Insufficient data",
            "pain_points": [],
            "entry_angle": "Request introductory meeting",
            "urgency": "medium",
            "confidence": "low",
        }

    print(f"  → Buying stage: {parsed.get('buying_stage')} | Urgency: {parsed.get('urgency')}")
    return {"deep_research_results": parsed}


def competitor_context_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Runs for BOTH warm (medium score) and hot (post-deep-research) accounts.
    Finds which AI vendors are already engaged with this account/industry.
    """
    company  = state["company_name"]
    signals  = state.get("signals", [])
    industry = next((s.get("summary","") for s in signals if s.get("type") == "techstack"), "")

    print(f"[competitor_context] Mapping competitive landscape for {company}...")

    results = []
    for q in [f"OpenAI {company} enterprise deal partnership",
               f"Microsoft Copilot {company} deployment",
               f"Google Gemini {company} enterprise",
               f"Anthropic Claude enterprise {company}"]:
        results.extend(_bd_serp(q, num=3))

    context = _organic_text(results)

    prompt = f"""You are a competitive intelligence analyst. Map the AI vendor landscape for {company}.

Context about their tech evaluation: {industry}

Competitive search results:
{context}

Return JSON only:
{{
  "primary_competitor": "most likely vendor already engaged",
  "competitor_strength": "strong/moderate/weak",
  "our_differentiation": ["differentiator 1", "differentiator 2", "differentiator 3"],
  "displacement_risk": "high/medium/low",
  "pitch_angle": "how Anthropic/Claude should position against the competition here",
  "red_flags": ["any concerns or blockers"]
}}"""

    resp = llm.invoke(prompt)
    try:
        parsed = json.loads(resp.content.strip().replace("```json","").replace("```",""))
    except Exception:
        parsed = {
            "primary_competitor": "Unknown",
            "competitor_strength": "unknown",
            "our_differentiation": ["Safety", "Reliability", "Enterprise support"],
            "displacement_risk": "medium",
            "pitch_angle": "Lead with safety and compliance differentiation",
            "red_flags": [],
        }

    current = state.get("final_output", {})
    return {"final_output": {**current, "competitor_context": parsed}}


def sales_brief_generator_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Synthesizes ALL research into a structured sales brief.
    This is the primary LLM synthesis node.
    """
    company         = state["company_name"]
    score           = state.get("intent_score", 0)
    signals         = state.get("signals", [])
    deep_research   = state.get("deep_research_results", {})
    competitor_ctx  = state.get("final_output", {}).get("competitor_context", {})
    score_expl      = state.get("final_output", {}).get("score_explanation", "")

    signals_text = "\n".join(
        f"  [{s['type']}] {s.get('summary','')}" for s in signals if s.get('score',0) > 0
    )

    prompt = f"""You are a senior enterprise sales strategist at Anthropic.
Create a complete sales brief for {company}.

INTENT SCORE: {score}/100
SCORE ANALYSIS: {score_expl}

SIGNALS DETECTED:
{signals_text}

DEEP RESEARCH:
{json.dumps(deep_research, indent=2) if deep_research else "N/A — medium intent account"}

COMPETITIVE CONTEXT:
{json.dumps(competitor_ctx, indent=2)}

Return JSON only:
{{
  "executive_summary": "3-sentence summary of opportunity",
  "priority": "HIGH | MEDIUM | LOW",
  "buying_stage": "stage",
  "recommended_action": "specific next step with timeline",
  "discovery_questions": ["question 1", "question 2", "question 3"],
  "value_propositions": ["prop 1", "prop 2", "prop 3"],
  "risk_factors": ["risk 1", "risk 2"],
  "talk_track_opener": "opening statement for first call"
}}"""

    resp = llm.invoke(prompt)
    try:
        brief = json.loads(resp.content.strip().replace("```json","").replace("```",""))
    except Exception:
        brief = {
            "executive_summary": f"Intelligence gathered for {company}.",
            "priority": "MEDIUM",
            "buying_stage": "Unknown",
            "recommended_action": "Schedule discovery call",
            "discovery_questions": [],
            "value_propositions": [],
            "risk_factors": [],
            "talk_track_opener": f"Hi, I wanted to share how we're helping companies like {company}...",
        }

    current = state.get("final_output", {})
    return {"final_output": {**current, "sales_brief": brief}}


def dashboard_output_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Final assembly node. Produces the clean CRM/dashboard-ready object
    and also emits it to the global final_gtm_reports list via the
    Annotated reducer on State.
    """
    company  = state["company_name"]
    signals  = state.get("signals", [])
    brief    = state.get("final_output", {}).get("sales_brief", {})
    deep     = state.get("deep_research_results", {})
    comp_ctx = state.get("final_output", {}).get("competitor_context", {})

    final_report = {
        "company_name": company,
        "intent_score": state.get("intent_score", 0),
        "priority": brief.get("priority", state.get("final_output", {}).get("priority", "UNKNOWN")),
        "buying_stage": brief.get("buying_stage", deep.get("buying_stage", "Unknown")),
        "signals": [
            {"type": s["type"], "score": s.get("score", 0), "summary": s.get("summary", "")}
            for s in signals if s.get("score", 0) > 0
        ],
        "executive_summary": brief.get("executive_summary", ""),
        "recommended_action": brief.get(
            "recommended_action",
            state.get("final_output", {}).get("recommended_action", "Monitor account")
        ),
        "discovery_questions": brief.get("discovery_questions", []),
        "value_propositions": brief.get("value_propositions", []),
        "talk_track_opener": brief.get("talk_track_opener", ""),
        "competitor_intel": {
            "primary_competitor": comp_ctx.get("primary_competitor", "Unknown"),
            "pitch_angle": comp_ctx.get("pitch_angle", ""),
            "displacement_risk": comp_ctx.get("displacement_risk", "unknown"),
        },
        "deep_research_available": bool(deep),
        "status": "completed",
        "presentation_format": "dashboard_ready",
    }

    print(f"\n{'═'*55}")
    print(f"  FINAL REPORT: {company}")
    print(f"  Score: {final_report['intent_score']}/100 | Priority: {final_report['priority']}")
    print(f"  Stage: {final_report['buying_stage']}")
    print(f"  Action: {final_report['recommended_action']}")
    print(f"{'═'*55}")

    return {
        "final_output": final_report,
        "final_gtm_reports": [final_report],   # feeds global accumulator
    }


# ══════════════════════════════════════════════════════════════
# ACCUMULATOR NODE (main graph, post-fan-in)
# ══════════════════════════════════════════════════════════════

def accumulate_reports(state: State) -> Dict[str, Any]:
    """
    All company_researcher branches converge here.
    Uses the Annotated[List, operator.add] reducer on final_gtm_reports
    so each worker's output is automatically appended.
    Prints a final dashboard summary.
    """
    reports = state.get("final_gtm_reports", [])

    print(f"\n\n{'★'*55}")
    print(f"  GTM INTELLIGENCE DASHBOARD — {len(reports)} ACCOUNTS")
    print(f"{'★'*55}")

    high   = [r for r in reports if r.get("priority") == "HIGH"]
    medium = [r for r in reports if r.get("priority") == "MEDIUM"]
    low    = [r for r in reports if r.get("priority") == "LOW"]

    for tier, label in [(high, "🔴 HIGH PRIORITY"), (medium, "🟡 MEDIUM"), (low, "⚪ LOW / MONITOR")]:
        if tier:
            print(f"\n{label}")
            for r in tier:
                print(f"  • {r['company_name']}  [{r['intent_score']}/100]  {r['buying_stage']}")
                print(f"    → {r['recommended_action']}")

    # Save full output to JSON
    with open("gtm_reports.json", "w") as f:
        json.dump(reports, f, indent=2)
    print("\n✅  Full reports saved to gtm_reports.json")

    return {}


# ══════════════════════════════════════════════════════════════
# SUB-GRAPH ASSEMBLY
# ══════════════════════════════════════════════════════════════

company_researcher_builder = StateGraph(CompanyWorkerState)

# Register nodes
company_researcher_builder.add_node("hiring_collector",      hiring_collector_node)
company_researcher_builder.add_node("procurement_collector", procurement_collector_node)
company_researcher_builder.add_node("compliance_collector",  compliance_collector_node)
company_researcher_builder.add_node("techstack_collector",   techstack_collector_node)
company_researcher_builder.add_node("partnership_collector", partnership_collector_node)
company_researcher_builder.add_node("signal_aggregator",     signal_aggregator_node)
company_researcher_builder.add_node("retry_planner",         retry_planner_node)
company_researcher_builder.add_node("deep_research",         deep_research_node)
company_researcher_builder.add_node("competitor_context",    competitor_context_node)
company_researcher_builder.add_node("sales_brief_generator", sales_brief_generator_node)
company_researcher_builder.add_node("dashboard_output",      dashboard_output_node)

# Fan-out: all 5 collectors run in parallel
for collector in ["hiring_collector", "procurement_collector", "compliance_collector",
                   "techstack_collector", "partnership_collector"]:
    company_researcher_builder.add_edge(START, collector)
    company_researcher_builder.add_edge(collector, "signal_aggregator")

# Conditional routing after aggregation
company_researcher_builder.add_conditional_edges(
    "signal_aggregator",
    score_router_node,
    {
        "retry_planner":      "retry_planner",
        "deep_research":      "deep_research",
        "competitor_context": "competitor_context",
    },
)

# Path for LOW score: ends after retry note
company_researcher_builder.add_edge("retry_planner", "dashboard_output")

# Path for HIGH score: deep research → competitor context → brief → output
company_researcher_builder.add_edge("deep_research",         "competitor_context")
company_researcher_builder.add_edge("competitor_context",    "sales_brief_generator")
company_researcher_builder.add_edge("sales_brief_generator", "dashboard_output")
company_researcher_builder.add_edge("dashboard_output",       END)

company_researcher_graph = company_researcher_builder.compile()


# ══════════════════════════════════════════════════════════════
# MAIN GRAPH ASSEMBLY
# ══════════════════════════════════════════════════════════════

main_builder = StateGraph(State)

main_builder.add_node("user_input", user_input_node)
main_builder.add_node("query_planner", query_planner_node)
main_builder.add_node("company_researcher", company_researcher_graph)
main_builder.add_node("accumulator", accumulate_reports)

main_builder.add_edge(START, "user_input")
main_builder.add_edge("user_input", "query_planner")

# Modern LangGraph dynamic fanout pattern
main_builder.add_conditional_edges(
    "query_planner",
    orchestrator_node,
    ["company_researcher"]
)

main_builder.add_edge("company_researcher", "accumulator")
main_builder.add_edge("accumulator", END)

app = main_builder.compile()

# ══════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys

    # Pass companies as CLI args, or use defaults
    if len(sys.argv) > 1:
        accounts = sys.argv[1:]
    else:
        accounts = ["Goldman Sachs", "Pfizer", "JPMorgan"]

    print(f"\nStarting GTM pipeline for: {accounts}\n")
    final_state = app.invoke({"accounts": accounts, "final_gtm_reports": []})
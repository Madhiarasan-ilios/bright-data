"""
main.py
───────
Anthropic GTM Intelligence Engine — LangGraph core.

Pipeline overview:
  user_input → query_planner → orchestrator (fan-out) →
    ┌─────────────────────────────────────────────────────┐
    │  company_researcher sub-graph (one per account)      │
    │                                                       │
    │  [hiring]  [procurement]  [techstack]                 │
    │  [compliance]  [competitive_openness]  ←── parallel  │
    │           ↓ (fan-in)                                  │
    │     signal_aggregator  →  score_router               │
    │          ↓            ↙            ↘                  │
    │    retry_planner  competitor_ctx  deep_research       │
    │          ↓              ↓              ↓              │
    │    dashboard_out  sales_brief   competitor_ctx       │
    │                         ↓              ↓              │
    │                   sales_brief   sales_brief           │
    │                         ↓              ↓              │
    │                   dashboard_out  dashboard_out        │
    └─────────────────────────────────────────────────────┘
  accumulator → END

Anthropic Opportunity Score (100 pts):
  Buying Intent       (hiring + procurement)  0-40
  Foundation Model Eval (techstack)           0-25
  Safety/Gov Alignment  (compliance)          0-20
  Competitive Openness  (no lock-in)          0-15
"""

import operator
import json
import sys

from dotenv import load_dotenv
from typing import Annotated, List, Dict, Any

from langgraph.graph import StateGraph, START, END
from langgraph.types import Send
from langchain.chat_models import init_chat_model
from typing_extensions import TypedDict

from prompts import (
    query_planner_prompt,
    hiring_analysis_prompt,
    procurement_analysis_prompt,
    techstack_analysis_prompt,
    compliance_analysis_prompt,
    competitive_openness_analysis_prompt,
    signal_aggregator_prompt,
    retry_planner_prompt,
    deep_research_prompt,
    competitor_context_prompt,
    sales_brief_prompt,
)
from web_operations import (
    search_hiring_signals,
    search_procurement_signals,
    search_techstack_signals,
    search_compliance_signals,
    search_competitive_openness,
    search_deep_research,
    search_competitor_signals,
    search_retry_broad,
)

load_dotenv()

llm = init_chat_model("gemini-2.5-flash", model_provider="google_genai")


# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════

def _parse_json(raw: str) -> dict:
    """Strip markdown fences and parse JSON; return {} on failure."""
    try:
        clean = raw.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(clean)
    except Exception:
        return {}



# ══════════════════════════════════════════════════════════════
# STATE DEFINITIONS
# ══════════════════════════════════════════════════════════════

def _merge_dicts(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    """Merge two dicts, with b's keys taking precedence. Used for evidence accumulation."""
    return {**a, **b}


class CompanyWorkerState(TypedDict):
    company_name:          str
    signals:               Annotated[List[Dict[str, Any]], operator.add]
    intent_score:          int
    score_breakdown:       Dict[str, int]      # weighted component scores
    deep_research_results: Dict[str, Any]
    final_output:          Dict[str, Any]
    # Feeds the global State.final_gtm_reports accumulator via operator.add
    final_gtm_reports:     Annotated[List[Dict[str, Any]], operator.add]
    # Each collector writes a single key ("hiring", "procurement", etc.).
    # The _merge_dicts reducer merges all parallel updates so no evidence is lost.
    evidence:              Annotated[Dict[str, Any], _merge_dicts]


class State(TypedDict):
    accounts:          List[str]
    final_gtm_reports: Annotated[List[Dict[str, Any]], operator.add]


# ══════════════════════════════════════════════════════════════
# MAIN GRAPH NODES
# ══════════════════════════════════════════════════════════════

def user_input_node(state: State) -> Dict[str, Any]:
    """Entry point — passes through accounts or falls back to defaults."""
    accounts = state.get("accounts") or ["Goldman Sachs", "Pfizer", "JPMorgan"]
    print(f"\n[user_input] Processing {len(accounts)} accounts: {accounts}")
    return {"accounts": accounts}


def query_planner_node(state: State) -> Dict[str, Any]:
    """LLM-powered account name normalisation (typos, abbreviations, dedup)."""
    accounts = state.get("accounts", [])
    prompt   = query_planner_prompt(accounts)
    response = llm.invoke(prompt)
    cleaned  = _parse_json(response.content.strip())
    if isinstance(cleaned, list) and cleaned:
        print(f"[query_planner] Cleaned accounts: {cleaned}")
        return {"accounts": cleaned}
    print("[query_planner] Keeping original accounts.")
    return {}


def orchestrator_node(state: State):
    """Fan-out: spawns one company_researcher sub-graph per account."""
    accounts = state.get("accounts", [])
    print(f"[orchestrator] Spawning {len(accounts)} workers")
    return [
        Send(
            "company_researcher",
            {
                "company_name":          c,
                "signals":               [],
                "intent_score":          0,
                "score_breakdown":       {},
                "deep_research_results": {},
                "final_output":          {},
                "final_gtm_reports":     [],
                "evidence":              {},
            },
        )
        for c in accounts
    ]


# ══════════════════════════════════════════════════════════════
# SIGNAL COLLECTOR NODES  (parallel fan-out inside sub-graph)
# ══════════════════════════════════════════════════════════════

def hiring_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Layer 1a — Buying Intent.
    LLM-foundation-model hiring activity.  Max contribution: 20 pts.
    """
    company = state["company_name"]
    print(f"  [hiring_collector] {company}")

    context = search_hiring_signals(company)
    prompt  = hiring_analysis_prompt(company, context["organic_text"])
    resp    = llm.invoke(prompt)
    parsed  = _parse_json(resp.content) or {
        "signal_found": False, "summary": "parse error",
        "score": 0, "key_roles": [],
        "foundation_model_focus": False, "anthropic_relevant": False,
    }

    score = min(int(parsed.get("score", 0)), 20)
    print(f"    → hiring score: {score}/20 | {parsed.get('summary', '')}")

    results = context.get("results", [])
    return {
        "signals": [{
            "type":                  "hiring",
            "score":                 score,
            "summary":               parsed.get("summary", ""),
            "key_roles":             parsed.get("key_roles", []),
            "foundation_model_focus":parsed.get("foundation_model_focus", False),
            "anthropic_relevant":    parsed.get("anthropic_relevant", False),
        }],
        "evidence": {
            "hiring": {
                "search_queries":     context.get("queries", []),
                "serp_results_count": len(results),
                "snippets_count":     len(results),
                "llm_reasoning":      resp.content,
                "serp_results":       results[:10],
            }
        },
    }


def procurement_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Layer 1b — Buying Intent.
    Foundation-model / LLM vendor procurement and RFP signals.  Max: 20 pts.
    """
    company = state["company_name"]
    print(f"  [procurement_collector] {company}")

    context = search_procurement_signals(company)
    prompt  = procurement_analysis_prompt(company, context["organic_text"])
    resp    = llm.invoke(prompt)
    parsed  = _parse_json(resp.content) or {
        "signal_found": False, "summary": "parse error", "score": 0,
        "vendors_under_consideration": [], "incumbent_vendor": "unknown",
        "procurement_stage": "none", "anthropic_probability": 0,
    }

    score = min(int(parsed.get("score", 0)), 20)
    print(f"    → procurement score: {score}/20 | {parsed.get('summary', '')}")

    results = context.get("results", [])
    return {
        "signals": [{
            "type":                        "procurement",
            "score":                       score,
            "summary":                     parsed.get("summary", ""),
            "vendors_under_consideration": parsed.get("vendors_under_consideration", []),
            "incumbent_vendor":            parsed.get("incumbent_vendor", "unknown"),
            "procurement_stage":           parsed.get("procurement_stage", "none"),
            "anthropic_probability":       parsed.get("anthropic_probability", 0),
        }],
        "evidence": {
            "procurement": {
                "search_queries":     context.get("queries", []),
                "serp_results_count": len(results),
                "snippets_count":     len(results),
                "llm_reasoning":      resp.content,
                "serp_results":       results[:10],
            }
        },
    }


def techstack_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Layer 2 — Foundation Model Evaluation.
    Are they actively benchmarking LLMs and where does Claude fit?  Max: 25 pts.
    """
    company = state["company_name"]
    print(f"  [techstack_collector] {company}")

    context = search_techstack_signals(company)
    prompt  = techstack_analysis_prompt(company, context["organic_text"])
    resp    = llm.invoke(prompt)
    parsed  = _parse_json(resp.content) or {
        "signal_found": False, "summary": "parse error", "score": 0,
        "models_detected": [], "claude_mentioned": False,
        "evaluation_stage": "none", "provider_preference": "unknown",
        "multi_model_readiness": "low", "switching_barrier": "low",
        "anthropic_fit_score": 0,
    }

    score = min(int(parsed.get("score", 0)), 25)
    print(f"    → techstack score: {score}/25 | {parsed.get('summary', '')}")
    if parsed.get("claude_mentioned"):
        print("      ★ Claude explicitly mentioned!")

    results = context.get("results", [])
    return {
        "signals": [{
            "type":                  "techstack",
            "score":                 score,
            "summary":               parsed.get("summary", ""),
            "models_detected":       parsed.get("models_detected", []),
            "claude_mentioned":      parsed.get("claude_mentioned", False),
            "evaluation_stage":      parsed.get("evaluation_stage", "none"),
            "provider_preference":   parsed.get("provider_preference", "unknown"),
            "multi_model_readiness": parsed.get("multi_model_readiness", "low"),
            "switching_barrier":     parsed.get("switching_barrier", "low"),
            "anthropic_fit_score":   parsed.get("anthropic_fit_score", 0),
        }],
        "evidence": {
            "techstack": {
                "search_queries":     context.get("queries", []),
                "serp_results_count": len(results),
                "snippets_count":     len(results),
                "llm_reasoning":      resp.content,
                "serp_results":       results[:10],
            }
        },
    }


def compliance_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Layer 3 — Safety / Governance Alignment.
    Regulated environments favour Anthropic's safety-first positioning.  Max: 20 pts.
    """
    company = state["company_name"]
    print(f"  [compliance_collector] {company}")

    context = search_compliance_signals(company)
    prompt  = compliance_analysis_prompt(company, context["organic_text"])
    resp    = llm.invoke(prompt)
    parsed  = _parse_json(resp.content) or {
        "signal_found": False, "summary": "parse error", "score": 0,
        "regulated_environment": False, "safety_priority": "low",
        "governance_pressure": "low", "anthropic_alignment": "weak",
        "key_regulatory_drivers": [],
    }

    score = min(int(parsed.get("score", 0)), 20)
    print(f"    → compliance score: {score}/20 | {parsed.get('summary', '')}")

    results = context.get("results", [])
    return {
        "signals": [{
            "type":                    "compliance",
            "score":                   score,
            "summary":                 parsed.get("summary", ""),
            "regulated_environment":   parsed.get("regulated_environment", False),
            "safety_priority":         parsed.get("safety_priority", "low"),
            "governance_pressure":     parsed.get("governance_pressure", "low"),
            "anthropic_alignment":     parsed.get("anthropic_alignment", "weak"),
            "key_regulatory_drivers":  parsed.get("key_regulatory_drivers", []),
        }],
        "evidence": {
            "compliance": {
                "search_queries":     context.get("queries", []),
                "serp_results_count": len(results),
                "snippets_count":     len(results),
                "llm_reasoning":      resp.content,
                "serp_results":       results[:10],
            }
        },
    }


def competitive_openness_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Layer 4 — Competitive Openness.
    Are they locked into an incumbent, or is there an Anthropic entry window?  Max: 15 pts.
    High score = low lock-in = high opportunity for Anthropic.
    """
    company = state["company_name"]
    print(f"  [competitive_openness_collector] {company}")

    context = search_competitive_openness(company)
    prompt  = competitive_openness_analysis_prompt(company, context["organic_text"])
    resp    = llm.invoke(prompt)
    parsed  = _parse_json(resp.content) or {
        "signal_found": False, "summary": "parse error", "score": 7,
        "incumbent_ai_vendor": "Unknown", "lock_in_strength": "medium",
        "openness_to_alternatives": "medium", "multi_vendor_strategy": False,
        "displacement_difficulty": "medium", "partners_identified": [],
    }

    score = min(int(parsed.get("score", 7)), 15)
    print(f"    → competitive openness score: {score}/15 | {parsed.get('summary', '')}")

    results = context.get("results", [])
    return {
        "signals": [{
            "type":                     "competitive_openness",
            "score":                    score,
            "summary":                  parsed.get("summary", ""),
            "incumbent_ai_vendor":      parsed.get("incumbent_ai_vendor", "Unknown"),
            "lock_in_strength":         parsed.get("lock_in_strength", "medium"),
            "openness_to_alternatives": parsed.get("openness_to_alternatives", "medium"),
            "multi_vendor_strategy":    parsed.get("multi_vendor_strategy", False),
            "displacement_difficulty":  parsed.get("displacement_difficulty", "medium"),
            "partners_identified":      parsed.get("partners_identified", []),
        }],
        "evidence": {
            "competitive_openness": {
                "search_queries":     context.get("queries", []),
                "serp_results_count": len(results),
                "snippets_count":     len(results),
                "llm_reasoning":      resp.content,
                "serp_results":       results[:10],
            }
        },
    }


# ══════════════════════════════════════════════════════════════
# AGGREGATOR NODE  (fan-in — computes Anthropic Opportunity Score)
# ══════════════════════════════════════════════════════════════

def signal_aggregator_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Merges all 5 collector signals into a weighted Anthropic Opportunity Score.

    Formula:
      Buying Intent       (hiring + procurement) : max 40 pts
      Foundation Model Eval (techstack)          : max 25 pts
      Safety/Gov Alignment  (compliance)         : max 20 pts
      Competitive Openness  (no lock-in)         : max 15 pts
      ─────────────────────────────────────────────────────
      Total (capped at 100)                      : max 100 pts
    """
    company = state["company_name"]
    signals = state.get("signals", [])

    score_map = {s["type"]: s.get("score", 0) for s in signals}

    hiring_score      = score_map.get("hiring", 0)               # 0-20
    procurement_score = score_map.get("procurement", 0)          # 0-20
    techstack_score   = score_map.get("techstack", 0)            # 0-25
    compliance_score  = score_map.get("compliance", 0)           # 0-20
    comp_open_score   = score_map.get("competitive_openness", 0) # 0-15

    buying_intent       = hiring_score + procurement_score        # 0-40
    foundation_eval     = techstack_score                         # 0-25
    safety_alignment    = compliance_score                        # 0-20
    competitive_openness = comp_open_score                        # 0-15

    final_score = min(
        buying_intent + foundation_eval + safety_alignment + competitive_openness,
        100,
    )

    score_breakdown = {
        "buying_intent":        buying_intent,
        "foundation_eval":      foundation_eval,
        "safety_alignment":     safety_alignment,
        "competitive_openness": competitive_openness,
    }

    signal_breakdown_text = "\n".join(
        f"  [{s['type'].upper()}] score={s.get('score', 0)}: {s.get('summary', '')}"
        for s in signals
    )

    prompt = signal_aggregator_prompt(
        company, signal_breakdown_text, score_breakdown, final_score
    )
    resp        = llm.invoke(prompt)
    explanation = resp.content.strip()

    print(f"\n[signal_aggregator] {company}")
    print(f"  Buying Intent:        {buying_intent}/40")
    print(f"  Foundation Model Eval:{foundation_eval}/25")
    print(f"  Safety/Gov Alignment: {safety_alignment}/20")
    print(f"  Competitive Openness: {competitive_openness}/15")
    print(f"  ─────────────────────────────────")
    print(f"  ANTHROPIC OPPORTUNITY SCORE: {final_score}/100")
    print(f"  {explanation}")

    return {
        "intent_score":    final_score,
        "score_breakdown": score_breakdown,
        "final_output": {
            "score_explanation": explanation,
            "score_breakdown":   score_breakdown,
        },
    }


# ══════════════════════════════════════════════════════════════
# CONDITIONAL ROUTER
# ══════════════════════════════════════════════════════════════

def score_router_node(state: CompanyWorkerState) -> str:
    """
    Routes based on Anthropic Opportunity Score:
      == 0   → retry_planner     (no signal — broaden search, add to nurture)
      1–59   → competitor_context (warm lead — enrich with competitive intel)
      ≥ 60   → deep_research      (hot lead — full research before outreach)
    """
    score   = state.get("intent_score", 0)
    company = state["company_name"]

    if score == 0:
        route = "retry_planner"
    elif score >= 60:
        route = "deep_research"
    else:
        route = "competitor_context"

    print(f"[score_router] {company} score={score} → {route}")
    return route


# ══════════════════════════════════════════════════════════════
# BRANCH NODES
# ══════════════════════════════════════════════════════════════

def retry_planner_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Score == 0 path.
    Runs a broader search and produces a nurture/monitor recommendation.
    """
    company = state["company_name"]
    print(f"[retry_planner] Low score for {company} — running broader search...")

    context = search_retry_broad(company)
    prompt  = retry_planner_prompt(company, context)
    resp    = llm.invoke(prompt)

    return {
        "final_output": {
            "status":               "low_intent_monitor",
            "company":              company,
            "intent_score":         state.get("intent_score", 0),
            "score_breakdown":      state.get("score_breakdown", {}),
            "analyst_note":         resp.content.strip(),
            "recommended_action":   (
                f"Add {company} to 90-day nurture sequence. "
                "Re-score on model-evaluation RFP or compliance mandate trigger."
            ),
            "priority": "LOW",
        }
    }


def deep_research_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Score ≥ 60 path.
    Runs 4 targeted Bright Data queries to build an Anthropic-specific
    leadership / project / budget / pain-point brief.
    """
    company = state["company_name"]
    print(f"[deep_research] Running deep research for {company}...")

    section_texts = search_deep_research(company)
    full_context  = "\n".join(
        f"\n=== {section.upper()} ===\n{text}"
        for section, text in section_texts.items()
    )

    prompt = deep_research_prompt(company, full_context)
    resp   = llm.invoke(prompt)
    parsed = _parse_json(resp.content) or {
        "buying_stage":           "Unknown",
        "key_stakeholders":       [],
        "active_ai_projects":     [],
        "budget_signals":         "Insufficient data",
        "pain_points":            [],
        "anthropic_entry_angle":  "Request introductory meeting",
        "safety_hook":            "Lead with constitutional AI and enterprise safety",
        "urgency":                "medium",
        "confidence":             "low",
    }

    print(
        f"  → Buying stage: {parsed.get('buying_stage')} "
        f"| Urgency: {parsed.get('urgency')} "
        f"| Confidence: {parsed.get('confidence')}"
    )
    return {"deep_research_results": parsed}


def competitor_context_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Runs for BOTH warm (medium score) and hot (post-deep-research) accounts.
    Maps which AI vendors are engaged and produces a Claude displacement strategy.
    """
    company = state["company_name"]
    signals = state.get("signals", [])

    # Pull techstack summary to give the LLM provider-preference context
    tech_signal  = next(
        (s for s in signals if s.get("type") == "techstack"), {}
    )
    tech_summary = (
        f"Evaluation stage: {tech_signal.get('evaluation_stage', 'unknown')}. "
        f"Provider preference: {tech_signal.get('provider_preference', 'unknown')}. "
        f"Models detected: {tech_signal.get('models_detected', [])}. "
        f"Claude mentioned: {tech_signal.get('claude_mentioned', False)}."
    )

    print(f"[competitor_context] Mapping competitive landscape for {company}...")

    context = search_competitor_signals(company)
    prompt  = competitor_context_prompt(company, tech_summary, context)
    resp    = llm.invoke(prompt)
    parsed  = _parse_json(resp.content) or {
        "primary_competitor":        "Unknown",
        "competitor_strength":       "unknown",
        "why_anthropic_wins":        ["Safety", "Reliability", "Enterprise support"],
        "displacement_risk":         "medium",
        "pitch_angle":               "Lead with safety and compliance differentiation",
        "anthropic_differentiators": ["Safety", "Constitutional AI", "Enterprise SLA"],
        "red_flags":                 [],
        "win_probability":           40,
    }

    print(
        f"  → Primary competitor: {parsed.get('primary_competitor')} "
        f"| Win probability: {parsed.get('win_probability')}%"
    )

    current = state.get("final_output", {})
    return {"final_output": {**current, "competitor_context": parsed}}


def sales_brief_generator_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Synthesises ALL research into an Anthropic-branded, structured sales brief.
    """
    company        = state["company_name"]
    score          = state.get("intent_score", 0)
    score_bkdn     = state.get("score_breakdown", {})
    signals        = state.get("signals", [])
    deep_research  = state.get("deep_research_results", {})
    final_out      = state.get("final_output", {})
    competitor_ctx = final_out.get("competitor_context", {})
    score_expl     = final_out.get("score_explanation", "")

    signals_text = "\n".join(
        f"  [{s['type']}] {s.get('summary', '')}"
        for s in signals
        if s.get("score", 0) > 0
    )

    prompt = sales_brief_prompt(
        company, score, score_expl, signals_text,
        deep_research, competitor_ctx, score_bkdn,
    )
    resp   = llm.invoke(prompt)
    brief  = _parse_json(resp.content) or {
        "executive_summary":    f"Intelligence gathered for {company}.",
        "priority":             "MEDIUM",
        "buying_stage":         "Unknown",
        "recommended_action":   "Schedule Anthropic discovery call",
        "discovery_questions":  [],
        "value_propositions":   [],
        "safety_narrative":     "Emphasise constitutional AI and enterprise safety SLAs.",
        "risk_factors":         [],
        "talk_track_opener":    (
            f"Hi — I wanted to share how Anthropic is helping companies like {company} "
            "build safer, more reliable enterprise AI..."
        ),
    }

    return {"final_output": {**final_out, "sales_brief": brief}}


def dashboard_output_node(state: CompanyWorkerState) -> Dict[str, Any]:
    """
    Final assembly — produces a CRM/dashboard-ready Anthropic opportunity record
    and emits it to the global final_gtm_reports accumulator.
    """
    company      = state["company_name"]
    signals      = state.get("signals", [])
    score_bkdn   = state.get("score_breakdown", {})
    final_out    = state.get("final_output", {})
    brief        = final_out.get("sales_brief", {})
    deep         = state.get("deep_research_results", {})
    comp_ctx     = final_out.get("competitor_context", {})

    # ── win_probability guard (Req 4.3, 4.4) ────────────────────────────────
    raw_wp = comp_ctx.get("win_probability", 0)
    try:
        win_prob = float(raw_wp)
        if not (0 <= win_prob <= 100):
            win_prob = 0.0
    except (TypeError, ValueError):
        win_prob = 0.0

    final_report: Dict[str, Any] = {
        "company_name":    company,
        "opportunity_score": state.get("intent_score", 0),
        "score_breakdown": {
            "buying_intent":        score_bkdn.get("buying_intent", 0),
            "foundation_model_eval":score_bkdn.get("foundation_eval", 0),
            "safety_gov_alignment": score_bkdn.get("safety_alignment", 0),
            "competitive_openness": score_bkdn.get("competitive_openness", 0),
        },
        "priority": brief.get(
            "priority",
            final_out.get("priority", "UNKNOWN"),
        ),
        "buying_stage": brief.get(
            "buying_stage",
            deep.get("buying_stage", "Unknown"),
        ),
        "signals": [
            # Include all fields from each signal so the frontend can display
            # detailed breakdowns in the Signal Explorer panel
            {k: v for k, v in s.items()}
            for s in signals
            if s.get("score", 0) > 0
        ],
        "executive_summary":    brief.get("executive_summary", ""),
        "recommended_action":   brief.get(
            "recommended_action",
            final_out.get("recommended_action", "Monitor account"),
        ),
        "discovery_questions":  brief.get("discovery_questions", []),
        "value_propositions":   brief.get("value_propositions", []),
        "safety_narrative":     brief.get("safety_narrative", ""),
        "risk_factors":         brief.get("risk_factors", []),
        "talk_track_opener":    brief.get("talk_track_opener", ""),
        "competitor_intel": {
            "primary_competitor":        comp_ctx.get("primary_competitor", "Unknown"),
            "competitor_strength":       comp_ctx.get("competitor_strength", "unknown"),
            "win_probability":           win_prob,
            "pitch_angle":               comp_ctx.get("pitch_angle", ""),
            "displacement_risk":         comp_ctx.get("displacement_risk", "unknown"),
            "why_anthropic_wins":        comp_ctx.get("why_anthropic_wins", []),
            "anthropic_differentiators": comp_ctx.get("why_anthropic_wins", []),
            "red_flags":                 comp_ctx.get("red_flags", brief.get("risk_factors", [])),
        },
        "deep_research_available": bool(deep),
        "deep_research_results":   deep if deep else None,
        "score_explanation":       final_out.get("score_explanation", ""),
        "status":               "completed",
        "presentation_format":  "dashboard_ready",
    }

    # ── Assemble research_evidence from state (Req 1.4, 11.1) ───────────────
    final_report["research_evidence"] = state.get("evidence", {})

    # ── Print tier summary ───────────────────────────────────────────────
    print(f"\n{'═' * 60}")
    print(f"  ANTHROPIC OPPORTUNITY REPORT: {company}")
    print(f"  Score: {final_report['opportunity_score']}/100  "
          f"| Priority: {final_report['priority']}")
    print(f"  Stage: {final_report['buying_stage']}")
    print(f"  Win Prob: {final_report['competitor_intel']['win_probability']}%  "
          f"| vs {final_report['competitor_intel']['primary_competitor']}")
    print(f"  Score Breakdown:")
    for k, v in final_report["score_breakdown"].items():
        label = k.replace("_", " ").title()
        print(f"    {label}: {v}")
    print(f"  Action: {final_report['recommended_action']}")
    print(f"{'═' * 60}")

    return {
        "final_output":    final_report,
        "final_gtm_reports": [final_report],      # feeds global accumulator
    }


# ══════════════════════════════════════════════════════════════
# ACCUMULATOR NODE  (main graph, post-fan-in)
# ══════════════════════════════════════════════════════════════

def accumulate_reports(state: State) -> Dict[str, Any]:
    """
    All company_researcher branches converge here.
    Prints a tiered Anthropic GTM dashboard and saves full reports to JSON.
    """
    reports = state.get("final_gtm_reports", [])

    print(f"\n\n{'★' * 60}")
    print(f"  ANTHROPIC GTM INTELLIGENCE DASHBOARD — {len(reports)} ACCOUNTS")
    print(f"{'★' * 60}")

    high   = [r for r in reports if r.get("priority") == "HIGH"]
    medium = [r for r in reports if r.get("priority") == "MEDIUM"]
    low    = [r for r in reports if r.get("priority") in ("LOW", "UNKNOWN")]

    for tier, label in [
        (high,   "🔴 HIGH PRIORITY — Engage Now"),
        (medium, "🟡 MEDIUM — Nurture & Watch"),
        (low,    "⚪ LOW — Monitor"),
    ]:
        if not tier:
            continue
        print(f"\n{label}")
        for r in tier:
            bkdn = r.get("score_breakdown", {})
            print(
                f"  • {r['company_name']}  "
                f"[Opportunity: {r['opportunity_score']}/100]  "
                f"{r['buying_stage']}"
            )
            print(
                f"    Intent={bkdn.get('buying_intent',0)}/40  "
                f"FoundationEval={bkdn.get('foundation_model_eval',0)}/25  "
                f"Safety={bkdn.get('safety_gov_alignment',0)}/20  "
                f"Openness={bkdn.get('competitive_openness',0)}/15"
            )
            print(
                f"    Win Prob: {r['competitor_intel'].get('win_probability', 0)}%  "
                f"vs {r['competitor_intel'].get('primary_competitor', 'Unknown')}"
            )
            print(f"    → {r['recommended_action']}")

    with open("gtm_reports.json", "w") as f:
        json.dump(reports, f, indent=2)
    print("\n✅  Full Anthropic opportunity reports saved to gtm_reports.json")
    return {}


# ══════════════════════════════════════════════════════════════
# SUB-GRAPH ASSEMBLY — company_researcher
# ══════════════════════════════════════════════════════════════

company_researcher_builder = StateGraph(CompanyWorkerState)

# Register all nodes
company_researcher_builder.add_node("hiring_collector",              hiring_collector_node)
company_researcher_builder.add_node("procurement_collector",         procurement_collector_node)
company_researcher_builder.add_node("techstack_collector",           techstack_collector_node)
company_researcher_builder.add_node("compliance_collector",          compliance_collector_node)
company_researcher_builder.add_node("competitive_openness_collector",competitive_openness_collector_node)
company_researcher_builder.add_node("signal_aggregator",             signal_aggregator_node)
company_researcher_builder.add_node("retry_planner",                 retry_planner_node)
company_researcher_builder.add_node("deep_research",                 deep_research_node)
company_researcher_builder.add_node("competitor_context",            competitor_context_node)
company_researcher_builder.add_node("sales_brief_generator",         sales_brief_generator_node)
company_researcher_builder.add_node("dashboard_output",              dashboard_output_node)

# Parallel fan-out: all 5 collectors run simultaneously
_COLLECTORS = [
    "hiring_collector",
    "procurement_collector",
    "techstack_collector",
    "compliance_collector",
    "competitive_openness_collector",
]
for collector in _COLLECTORS:
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

# LOW score path  →  monitor note  →  competitor context  →  sales brief  →  output
company_researcher_builder.add_edge("retry_planner", "competitor_context")

# HIGH score path →  deep research  →  competitor context  →  brief  →  output
company_researcher_builder.add_edge("deep_research",         "competitor_context")
company_researcher_builder.add_edge("competitor_context",    "sales_brief_generator")
company_researcher_builder.add_edge("sales_brief_generator", "dashboard_output")

company_researcher_builder.add_edge("dashboard_output", END)

company_researcher_graph = company_researcher_builder.compile()


# ══════════════════════════════════════════════════════════════
# MAIN GRAPH ASSEMBLY
# ══════════════════════════════════════════════════════════════

main_builder = StateGraph(State)
main_builder.add_node("user_input",          user_input_node)
main_builder.add_node("query_planner",       query_planner_node)
main_builder.add_node("company_researcher",  company_researcher_graph)
main_builder.add_node("accumulator",         accumulate_reports)

main_builder.add_edge(START, "user_input")
main_builder.add_edge("user_input", "query_planner")

# LangGraph dynamic fan-out pattern
main_builder.add_conditional_edges(
    "query_planner",
    orchestrator_node,
    ["company_researcher"],
)

main_builder.add_edge("company_researcher", "accumulator")
main_builder.add_edge("accumulator", END)

app = main_builder.compile()


# ══════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if len(sys.argv) > 1:
        accounts = sys.argv[1:]
    else:
        accounts = ["Goldman Sachs", "Pfizer", "JPMorgan"]

    print(f"\nStarting Anthropic GTM pipeline for: {accounts}\n")
    final_state = app.invoke({"accounts": accounts, "final_gtm_reports": []})
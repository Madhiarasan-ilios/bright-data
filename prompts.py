"""
prompts.py
──────────
All LLM prompt templates for the Anthropic GTM Intelligence pipeline.

Each function returns a ready-to-invoke string.
Framing shift: every prompt optimises for **Anthropic win probability**,
not generic "AI buying intent".

Scoring architecture (100 pts total):
  Buying Intent       = hiring (0-20) + procurement (0-20)  → 40 pts
  Foundation Model Eval = techstack signals                  → 25 pts
  Safety/Gov Alignment  = compliance signals                 → 20 pts
  Competitive Openness  = no hard lock-in signals            → 15 pts
"""

import json


# ══════════════════════════════════════════════════════════════
# MAIN GRAPH
# ══════════════════════════════════════════════════════════════

def query_planner_prompt(accounts: list) -> str:
    return f"""You are a GTM planning assistant for Anthropic.
Given this list of company names: {accounts}
1. Fix any typos or abbreviations (e.g. "GS" → "Goldman Sachs").
2. Return ONLY a JSON array of cleaned company names — nothing else, no markdown.
Example output: ["Goldman Sachs", "Pfizer", "JPMorgan Chase"]"""


# ══════════════════════════════════════════════════════════════
# SIGNAL COLLECTORS  (Layer 1 — Buying Intent)
# ══════════════════════════════════════════════════════════════

def hiring_analysis_prompt(company: str, context: str) -> str:
    return f"""You are an Anthropic GTM analyst. Assess {company}'s AI hiring activity
as a signal of foundation-model buying intent specifically relevant to Anthropic.

Look for roles that indicate LLM / foundation-model evaluation or deployment:
  • Prompt Engineers, LLM Engineers, AI Platform Engineers
  • Roles that mention specific models (GPT, Claude, Gemini)
  • AI Safety, Governance, or Responsible-AI roles (strong Anthropic fit signal)

SEARCH RESULTS:
{context}

Return JSON only — no markdown fences:
{{
  "signal_found": true,
  "summary": "one sentence describing the hiring signal",
  "score": 0,
  "key_roles": ["role1", "role2"],
  "foundation_model_focus": true,
  "anthropic_relevant": true
}}

Score guide (0-20):
  0  = no AI hiring detected
  5  = general ML / data science roles
  10 = GenAI / LLM roles (non-specific model)
  15 = LLM platform or foundation-model engineering roles
  20 = active Claude / multi-model evaluation engineering roles"""


def procurement_analysis_prompt(company: str, context: str) -> str:
    return f"""You are an Anthropic GTM analyst. Assess {company}'s procurement signals
for foundation-model / enterprise LLM platform selection.

Focus specifically on:
  • Foundation model or LLM vendor evaluation / RFP
  • Enterprise AI platform procurement or contract signals
  • Multi-model vendor comparison activity
  • Signals of incumbent vendor presence (OpenAI, Microsoft, Google)

SEARCH RESULTS:
{context}

Return JSON only — no markdown fences:
{{
  "signal_found": true,
  "summary": "one sentence describing the procurement signal",
  "score": 0,
  "vendors_under_consideration": ["vendor1"],
  "incumbent_vendor": "unknown",
  "procurement_stage": "none",
  "anthropic_probability": 0
}}

procurement_stage options: none | exploring | active_evaluation | vendor_selected

Score guide (0-20):
  0  = no procurement signal
  5  = general IT / software spend
  10 = AI vendor mentions, no specifics
  15 = foundation model RFP or shortlist
  20 = active multi-vendor LLM evaluation (Anthropic can compete)"""


# ══════════════════════════════════════════════════════════════
# SIGNAL COLLECTORS  (Layer 2 — Foundation Model Evaluation)
# ══════════════════════════════════════════════════════════════

def techstack_analysis_prompt(company: str, context: str) -> str:
    return f"""You are an Anthropic GTM analyst. This is the highest-weight signal category.
Assess {company}'s foundation-model evaluation activity — are they actively choosing
between LLM providers, and where does Anthropic/Claude fit?

Focus on:
  • Specific model names (GPT-4, Claude, Gemini, Llama, Mistral, etc.)
  • Benchmarking, evaluation, or head-to-head comparison activity
  • Multi-model architecture or provider diversification strategy
  • Engineering blogs / technical content about LLM selection

SEARCH RESULTS:
{context}

Return JSON only — no markdown fences:
{{
  "signal_found": true,
  "summary": "one sentence",
  "score": 0,
  "models_detected": ["model1"],
  "claude_mentioned": false,
  "evaluation_stage": "none",
  "provider_preference": "unknown",
  "multi_model_readiness": "low",
  "switching_barrier": "low",
  "anthropic_fit_score": 0
}}

evaluation_stage options: none | exploring | active_eval | deployed
provider_preference options: OpenAI leaning | Google leaning | Anthropic leaning | neutral | unknown

Score guide (0-25):
  0  = no LLM / foundation model signal at all
  5  = general "we use AI" mention
  10 = specific model names found (any provider)
  15 = model comparison or benchmarking activity
  20 = active multi-model evaluation (multiple providers shortlisted)
  25 = Claude explicitly mentioned + active multi-model evaluation underway"""


# ══════════════════════════════════════════════════════════════
# SIGNAL COLLECTORS  (Layer 3 — Safety / Governance Alignment)
# ══════════════════════════════════════════════════════════════

def compliance_analysis_prompt(company: str, context: str) -> str:
    return f"""You are an Anthropic GTM analyst.
Anthropic's primary differentiation is safety, constitutional AI, and enterprise governance.
Assess {company}'s regulatory / compliance environment as a signal of Anthropic strategic fit.

Focus on:
  • AI safety requirements or mandates
  • Regulated industry pressure (finance, pharma, healthcare, defence, legal)
  • Responsible AI, constitutional AI, or governance programme signals
  • Data privacy / sovereignty requirements that favour safer, auditable models

SEARCH RESULTS:
{context}

Return JSON only — no markdown fences:
{{
  "signal_found": true,
  "summary": "one sentence",
  "score": 0,
  "regulated_environment": false,
  "safety_priority": "low",
  "governance_pressure": "low",
  "anthropic_alignment": "weak",
  "key_regulatory_drivers": ["driver1"]
}}

safety_priority / governance_pressure options: high | medium | low
anthropic_alignment options: strong | moderate | weak

Score guide (0-20):
  0  = no governance signal
  5  = general AI policy mention
  10 = active AI governance or responsible-AI programme
  15 = regulatory mandate driving AI spend
  20 = safety-first AI policy + heavy sector regulation (strongest Anthropic fit)"""


# ══════════════════════════════════════════════════════════════
# SIGNAL COLLECTORS  (Layer 4 — Competitive Openness)
# ══════════════════════════════════════════════════════════════

def competitive_openness_analysis_prompt(company: str, context: str) -> str:
    return f"""You are an Anthropic competitive intelligence analyst.
Assess {company}'s openness to adopting Anthropic / Claude — versus being locked into
an incumbent (OpenAI via Microsoft, Google, Amazon Bedrock, etc.).

Focus on:
  • Exclusive partnerships with OpenAI, Microsoft (Copilot / Azure OpenAI), or Google
  • Multi-vendor / multi-model strategy signals that favour Anthropic entry
  • Contract renewal timelines or re-evaluation windows
  • Switching cost / lock-in indicators
  • Any explicit mention of Anthropic / Claude as an alternative being explored

SEARCH RESULTS:
{context}

Return JSON only — no markdown fences:
{{
  "signal_found": true,
  "summary": "one sentence",
  "score": 0,
  "incumbent_ai_vendor": "Unknown",
  "lock_in_strength": "none",
  "openness_to_alternatives": "low",
  "multi_vendor_strategy": false,
  "displacement_difficulty": "low",
  "partners_identified": ["partner1"]
}}

lock_in_strength / displacement_difficulty options: high | medium | low | none
openness_to_alternatives options: high | medium | low

Score guide (0-15):
  0  = exclusive OpenAI / Microsoft / Google lock-in, multi-year contract
  3  = strong incumbent but contract expiry approaching
  7  = incumbent present but multi-vendor exploration signals
  11 = multi-model / multi-vendor strategy explicit
  15 = no incumbent + actively evaluating alternatives (ideal Anthropic window)"""


# ══════════════════════════════════════════════════════════════
# AGGREGATION
# ══════════════════════════════════════════════════════════════

def signal_aggregator_prompt(
    company: str,
    signal_breakdown: str,
    scores: dict,
    final_score: int,
) -> str:
    return f"""You are a senior Anthropic GTM analyst computing the Anthropic Opportunity Score
for {company}.

SIGNAL BREAKDOWN:
{signal_breakdown}

WEIGHTED SCORE COMPONENTS:
  Buying Intent        (Hiring + Procurement): {scores['buying_intent']}/40
  Foundation Model Eval (Techstack):           {scores['foundation_eval']}/25
  Safety / Gov Alignment (Compliance):         {scores['safety_alignment']}/20
  Competitive Openness   (No lock-in):         {scores['competitive_openness']}/15

ANTHROPIC OPPORTUNITY SCORE: {final_score}/100

In 2-3 concise sentences explain what these signals say about {company}'s likelihood
to choose Anthropic specifically — not just any AI vendor.
Reference the weighted components directly. Be direct and actionable."""


# ══════════════════════════════════════════════════════════════
# LOW-SCORE PATH
# ══════════════════════════════════════════════════════════════

def retry_planner_prompt(company: str, context: str) -> str:
    return f"""You are an Anthropic GTM analyst. {company} showed a low Anthropic Opportunity Score.

Broader search context:
{context}

In exactly 3 bullet points explain:
1. Why this account shows low Anthropic opportunity right now (be specific — incumbent, no eval, etc.)
2. Which specific trigger events would change this (model evaluation RFP, compliance mandate,
   contract renewal, leadership change, etc.)
3. Recommended Anthropic-specific re-evaluation timeline and the trigger to watch for

Be specific to Anthropic's competitive position, not just generic AI adoption."""


# ══════════════════════════════════════════════════════════════
# HIGH-SCORE PATH — DEEP RESEARCH
# ══════════════════════════════════════════════════════════════

def deep_research_prompt(company: str, full_context: str) -> str:
    return f"""You are a senior Anthropic enterprise sales researcher.
{company} is a high-opportunity account. Build a precise Anthropic-specific intelligence brief.

RESEARCH DATA:
{full_context}

Return JSON only — no markdown fences:
{{
  "buying_stage": "Active Evaluation",
  "key_stakeholders": ["Title: Name/role if found"],
  "active_ai_projects": ["project description"],
  "budget_signals": "description of AI budget or spend signals",
  "pain_points": ["pain point relevant to Anthropic strengths"],
  "anthropic_entry_angle": "the single best Anthropic-specific opening for this account",
  "safety_hook": "how Anthropic's safety story specifically resonates with this company",
  "urgency": "high",
  "confidence": "high"
}}

buying_stage options: Active Evaluation | Exploring | Strategic Initiative | Deployed
urgency / confidence options: high | medium | low"""


# ══════════════════════════════════════════════════════════════
# MEDIUM + HIGH-SCORE PATH — COMPETITIVE CONTEXT
# ══════════════════════════════════════════════════════════════

def competitor_context_prompt(company: str, tech_summary: str, context: str) -> str:
    return f"""You are an Anthropic competitive intelligence analyst.
Map the AI vendor landscape for {company} and determine exactly how to position Claude
against any identified competitor.

Their current tech / model evaluation context:
{tech_summary}

Competitive intelligence search results:
{context}

Return JSON only — no markdown fences:
{{
  "primary_competitor": "most likely vendor already engaged",
  "competitor_strength": "strong",
  "why_anthropic_wins": [
    "specific Anthropic advantage 1",
    "specific Anthropic advantage 2",
    "specific Anthropic advantage 3"
  ],
  "displacement_risk": "medium",
  "pitch_angle": "specific Claude positioning against the identified competitor",
  "anthropic_differentiators": ["safety", "reliability", "enterprise support"],
  "red_flags": ["concern or blocker 1"],
  "win_probability": 0
}}

competitor_strength / displacement_risk options: strong | moderate | weak"""


# ══════════════════════════════════════════════════════════════
# SYNTHESIS — SALES BRIEF
# ══════════════════════════════════════════════════════════════

def sales_brief_prompt(
    company: str,
    opportunity_score: int,
    score_explanation: str,
    signals_text: str,
    deep_research: dict,
    competitor_ctx: dict,
    score_breakdown: dict,
) -> str:
    deep_str = json.dumps(deep_research, indent=2) if deep_research else "N/A — medium intent account"
    comp_str = json.dumps(competitor_ctx, indent=2)
    return f"""You are a senior Anthropic enterprise sales strategist.
Create a complete, Anthropic-branded sales brief for {company}.

ANTHROPIC OPPORTUNITY SCORE: {opportunity_score}/100
SCORE ANALYSIS: {score_explanation}

SCORE DRIVERS:
  Buying Intent:              {score_breakdown.get('buying_intent', 0)}/40
  Foundation Model Eval:      {score_breakdown.get('foundation_eval', 0)}/25
  Safety / Gov Alignment:     {score_breakdown.get('safety_alignment', 0)}/20
  Competitive Openness:       {score_breakdown.get('competitive_openness', 0)}/15

SIGNALS DETECTED:
{signals_text}

DEEP RESEARCH:
{deep_str}

COMPETITIVE CONTEXT:
{comp_str}

Return JSON only — no markdown fences:
{{
  "executive_summary": "3-sentence Anthropic-framed opportunity summary",
  "priority": "HIGH",
  "buying_stage": "stage",
  "recommended_action": "specific Anthropic next step with timeline",
  "discovery_questions": [
    "Claude-specific discovery question 1",
    "question 2",
    "question 3"
  ],
  "value_propositions": [
    "Anthropic-specific value prop 1",
    "prop 2",
    "prop 3"
  ],
  "safety_narrative": "how to lead with Anthropic's safety story for this specific account",
  "risk_factors": ["risk 1", "risk 2"],
  "talk_track_opener": "Anthropic-branded opening statement for first call"
}}

priority options: HIGH | MEDIUM | LOW"""
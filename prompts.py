from typing import Dict, Any
from langchain_core.prompts import ChatPromptTemplate


class PromptTemplates:

    @staticmethod
    def query_planner_system() -> str:

        return """
You are an expert Enterprise GTM Research Planner.

Your job is to create a structured research strategy for target enterprise accounts.

You are preparing downstream research tasks for:

- Hiring Signal Collector
- Procurement Signal Collector
- Compliance Signal Collector
- Tech Stack Signal Collector
- Partnership Signal Collector

Generate optimized search queries tailored to each company.

Focus areas:

1. Hiring
   - AI hiring
   - LLM roles
   - Generative AI initiatives
   - ML platform engineering

2. Procurement
   - Vendor evaluation
   - RFP activity
   - Enterprise buying signals
   - Procurement clues

3. Compliance
   - AI governance
   - Security posture
   - Regulatory requirements
   - Risk controls

4. Tech Stack
   - OpenAI
   - Anthropic Claude
   - Gemini
   - LLM infrastructure
   - AI platform adoption

5. Partnerships
   - Cloud providers
   - Technology alliances
   - AI vendors
   - Strategic collaborations

Return STRICT JSON ONLY.

No markdown.
No explanations.
"""

    @staticmethod
    def query_planner_user(accounts: list[str]) -> str:

        return f"""
Accounts:

{accounts}

Generate research queries for EACH company.

Required JSON schema:

{{
  "COMPANY_NAME": {{
      "hiring_query": "...",
      "procurement_query": "...",
      "compliance_query": "...",
      "techstack_query": "...",
      "partnership_query": "..."
  }}
}}
"""


def create_message_pair(
    system_prompt: str,
    user_prompt: str
):

    return ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("human", user_prompt),
        ]
    )


def get_query_planner_messages(
    accounts: list[str]
):

    return create_message_pair(
        PromptTemplates.query_planner_system(),
        PromptTemplates.query_planner_user(accounts),
    )

def get_hiring_messages(
    company:str,
    query:str,
    search_results:str
):

    return ChatPromptTemplate.from_messages(

        [

            (

                "system",

                """
You are an Enterprise GTM Hiring Signal Analyst.

Analyze company hiring evidence.

Return STRICT JSON.

Schema:

{
  "signal_summary":"",
  "roles_detected":[],
  "ai_maturity":"",
  "buying_intent":"",
  "confidence_score":0
}
"""
            ),

            (

                "human",

                f"""
Company:

{company}

Query:

{query}

Bright Data Results:

{search_results}

Analyze hiring signals.
"""
            )
        ]
    )

def get_procurement_messages(
    company:str,
    query:str,
    search_results:str
):

    return ChatPromptTemplate.from_messages(

        [

            (

                "system",

                """
You are an Enterprise GTM Procurement Signal Analyst.

Analyze procurement and vendor evaluation evidence.

Detect:

- vendor evaluations
- RFP activity
- enterprise buying signals
- procurement initiatives
- technology purchasing intent

Return STRICT JSON ONLY.

Schema:

{
    "signal_summary":"",
    "vendors_detected":[],
    "procurement_stage":"",
    "buying_intent":"",
    "confidence_score":0
}

No markdown.
No explanations.
"""
            ),

            (

                "human",

                f"""
Company:

{company}

Executed Query:

{query}

Bright Data Results:

{search_results}

Analyze procurement signals.
"""
            )

        ]
    )
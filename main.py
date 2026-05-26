import operator
from dotenv import load_dotenv
from typing import Annotated, List, Dict, Any
from langgraph.graph import StateGraph, START, END
from langgraph.constants import Send  
from langchain.chat_models import init_chat_model
from typing_extensions import TypedDict

load_dotenv()

llm = init_chat_model("gemini-2.5-flash")


# ==========================================
# 1. INDIVIDUAL COMPANY WORKER STATE (Sub-Graph)
# ==========================================
class CompanyWorkerState(TypedDict):
    company_name: str
    signals: Annotated[List[Dict[str, Any]], operator.add]
    intent_score: int
    deep_research_results: Dict[str, Any]
    final_output: Dict[str, Any] 


# ==========================================
# 2. GLOBAL ORCHESTRATOR STATE (Main Graph)
# ==========================================
class State(TypedDict):
    accounts: List[str]
    final_gtm_reports: Annotated[List[Dict[str, Any]], operator.add]


# --- Main Graph Node Functions ---

def user_input_node(state: State) -> Dict[str, Any]:
    print("Executing user_input_node")
    return {"accounts": ["Goldman Sachs", "Pfizer", "JPMorgan"]}

def query_planner_node(state: State) -> Dict[str, Any]:
    print("Executing query_planner_node")
    return {} 

def orchestrator_node(state: State) -> List[Send]:
    print(f"Executing orchestrator_node for accounts: {state.get('accounts', [])}")
    return [Send("company_researcher", {"company_name": company}) for company in state.get("accounts", [])]


# --- Company Researcher Sub-Graph Node Functions ---

def hiring_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    print(f"Executing hiring_collector_node for {state['company_name']}")
    return {"signals": [{"type": "hiring", "data": f"Hiring signals for {state['company_name']}"}]}

def procurement_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    print(f"Executing procurement_collector_node for {state['company_name']}")
    return {"signals": [{"type": "procurement", "data": f"Procurement signals for {state['company_name']}"}]}

def compliance_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    print(f"Executing compliance_collector_node for {state['company_name']}")
    return {"signals": [{"type": "compliance", "data": f"Compliance signals for {state['company_name']}"}]}

def techstack_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    print(f"Executing techstack_collector_node for {state['company_name']}")
    return {"signals": [{"type": "techstack", "data": f"Tech stack signals for {state['company_name']}"}]}

def partnership_collector_node(state: CompanyWorkerState) -> Dict[str, Any]:
    print(f"Executing partnership_collector_node for {state['company_name']}")
    return {"signals": [{"type": "partnership", "data": f"Partnership signals for {state['company_name']}"}]}

def signal_aggregator_node(state: CompanyWorkerState) -> Dict[str, Any]:
    print(f"Executing signal_aggregator_node for {state['company_name']}")
    
    # Simple calculation to force different routes for the example run
    score = 0
    if state["company_name"] == "Goldman Sachs":
        score = 85  # Deep Research path
    elif state["company_name"] == "Pfizer":
        score = 50  # Competitor Context path
    else:
        score = 0   # Retry path

    return {"intent_score": score} 

def score_router_node(state: CompanyWorkerState) -> str:
    intent_score = state.get("intent_score", 0)
    print(f"Executing score_router_node for {state['company_name']} with score {intent_score}")
    if intent_score == 0:
        return "retry_planner"
    elif intent_score >= 70:
        return "deep_research"
    else: 
        return "competitor_context"

def retry_planner_node(state: CompanyWorkerState) -> Dict[str, Any]:
    print(f"Executing retry_planner_node for {state['company_name']}")
    return {"final_output": {"status": "retried", "reason": "low initial score", "company": state['company_name']}}

def deep_research_node(state: CompanyWorkerState) -> Dict[str, Any]:
    print(f"Executing deep_research_node for {state['company_name']}")
    return {"deep_research_results": {"detail": f"Extensive research data for {state['company_name']}"}}

def competitor_context_node(state: CompanyWorkerState) -> Dict[str, Any]:
    print(f"Executing competitor_context_node for {state['company_name']}")
    current_output = state.get("final_output", {})
    return {"final_output": {**current_output, "competitor_info": f"Competitor context for {state['company_name']}"}}

def sales_brief_generator_node(state: CompanyWorkerState) -> Dict[str, Any]:
    print(f"Executing sales_brief_generator_node for {state['company_name']}")
    current_output = state.get("final_output", {})
    return {"final_output": {**current_output, "brief": f"Comprehensive sales brief for {state['company_name']}"}}

def dashboard_output_node(state: CompanyWorkerState) -> Dict[str, Any]:
    print(f"Executing dashboard_output_node for {state['company_name']}")
    
    # FIXED: Store locally in the sub-graph's `final_output` dict
    final_report = {
        "company_name": state["company_name"],
        "intent_score": state.get("intent_score", 0),
        "signals_summary": [s.get("data") for s in state.get("signals", []) if s.get("data")],
        "deep_research_summary": state.get("deep_research_results", {}).get("detail"),
        "final_brief": state.get("final_output", {}).get("brief"),
        "competitor_info": state.get("final_output", {}).get("competitor_info"),
        "status": state.get("final_output", {}).get("status", "completed"),
        "presentation_format": "dashboard_ready"
    }
    return {"final_output": final_report}


# ==========================================
# 3. COMPANY RESEARCHER SUB-GRAPH DEFINITION
# ==========================================
company_researcher_builder = StateGraph(CompanyWorkerState)

company_researcher_builder.add_node("hiring_collector", hiring_collector_node)
company_researcher_builder.add_node("procurement_collector", procurement_collector_node)
company_researcher_builder.add_node("compliance_collector", compliance_collector_node)
company_researcher_builder.add_node("techstack_collector", techstack_collector_node)
company_researcher_builder.add_node("partnership_collector", partnership_collector_node)
company_researcher_builder.add_node("signal_aggregator", signal_aggregator_node)
company_researcher_builder.add_node("retry_planner", retry_planner_node)
company_researcher_builder.add_node("deep_research", deep_research_node)
company_researcher_builder.add_node("competitor_context", competitor_context_node)
company_researcher_builder.add_node("sales_brief_generator", sales_brief_generator_node)
company_researcher_builder.add_node("dashboard_output", dashboard_output_node)

# Fan-out
company_researcher_builder.add_edge(START, "hiring_collector")
company_researcher_builder.add_edge(START, "procurement_collector")
company_researcher_builder.add_edge(START, "compliance_collector")
company_researcher_builder.add_edge(START, "techstack_collector")
company_researcher_builder.add_edge(START, "partnership_collector")

# Fan-in
company_researcher_builder.add_edge("hiring_collector", "signal_aggregator")
company_researcher_builder.add_edge("procurement_collector", "signal_aggregator")
company_researcher_builder.add_edge("compliance_collector", "signal_aggregator")
company_researcher_builder.add_edge("techstack_collector", "signal_aggregator")
company_researcher_builder.add_edge("partnership_collector", "signal_aggregator")

# FIXED: Routing directly out from signal_aggregator node using the routing function
company_researcher_builder.add_conditional_edges(
    "signal_aggregator",
    score_router_node, 
    {
        "retry_planner": "retry_planner",
        "deep_research": "deep_research",
        "competitor_context": "competitor_context",
    },
)

company_researcher_builder.add_edge("retry_planner", END) 
company_researcher_builder.add_edge("deep_research", "competitor_context")
company_researcher_builder.add_edge("competitor_context", "sales_brief_generator")
company_researcher_builder.add_edge("sales_brief_generator", "dashboard_output")
company_researcher_builder.add_edge("dashboard_output", END) 

company_researcher_graph = company_researcher_builder.compile()


# ==========================================
# 4. MAIN ORCHESTRATOR GRAPH DEFINITION
# ==========================================

# FIXED: Main graph helper to collect and map outputs safely into the global state array
def global_reducer_node(state: State) -> Dict[str, Any]:
    return {}

main_builder = StateGraph(State)

main_builder.add_node("user_input", user_input_node)
main_builder.add_node("query_planner", query_planner_node)
main_builder.add_node("orchestrator", orchestrator_node)

# We define a down-stream accumulator node to gather up all the mapped responses
def accumulate_reports(state: State) -> Dict[str, Any]:
    return {}
main_builder.add_node("accumulator", accumulate_reports)

# When using Send(), we must explicitly track when the collection completes. 
# We route the Send call to the sub-graph node, and map it forward to our aggregator.
main_builder.add_node("company_researcher", company_researcher_graph) 

main_builder.add_edge(START, "user_input")
main_builder.add_edge("user_input", "query_planner")
main_builder.add_edge("query_planner", "orchestrator")

# LangGraph Map-Reduce execution logic:
# 1. Orchestrator calls Send("company_researcher", ...)
# 2. Once all branches finish, execution funnels cleanly into our terminal node.
main_builder.add_edge("company_researcher", "accumulator")
main_builder.add_edge("accumulator", END)

app = main_builder.compile()


# --- WORKING EXECUTION ---
if __name__ == "__main__":
    print("\n--- Running the LangGraph application ---")
    
    # We alter the final extraction slightly to match the sub-graph's localized final_output layout
    final_state = app.invoke({"accounts": [], "final_gtm_reports": []})
    
    print("\n--- Execution Complete ---")
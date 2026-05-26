import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("BRIGHT_DATA_API_KEY")

from langchain_brightdata import BrightDataSERP

serp_tool = BrightDataSERP(bright_data_api_key=api_key)

from langchain_brightdata import BrightDataSERP

# Initialize the tool
serp_tool = BrightDataSERP()

# Run a basic search
results = serp_tool.invoke("latest AI research papers")

print(results)
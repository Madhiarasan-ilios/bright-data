import os
import requests
from urllib.parse import quote_plus
from dotenv import load_dotenv
from brightdata import BrightData

load_dotenv()

# ==========================================
# BRIGHT DATA CLIENT
# ==========================================

client = BrightData()

# ==========================================
# CORE BRIGHT DATA REQUEST HELPER
# ==========================================

def _make_api_request(
    url,
    **kwargs
):

    api_key = os.getenv(
        "BRIGHTDATA_API_KEY"
    )

    if not api_key:

        raise ValueError(
            "BRIGHTDATA_API_KEY missing."
        )

    headers = {

        "Authorization":
        f"Bearer {api_key}",

        "Content-Type":
        "application/json"
    }

    try:

        response = requests.post(
            url,
            headers=headers,
            **kwargs
        )

        response.raise_for_status()

        return response.json()

    except requests.exceptions.RequestException as e:

        print(
            f"Bright Data request failed: {e}"
        )

        return {}

# ==========================================
# GENERIC SERP SEARCH
# ==========================================

def serp_search(
    query:str,
    engine:str="google"
):

    if engine == "google":

        base_url = (
            "https://www.google.com/search"
        )

    elif engine == "bing":

        base_url = (
            "https://www.bing.com/search"
        )

    else:

        raise ValueError(
            f"Unknown engine {engine}"
        )

    payload = {

        "zone":"ai_agent2",

        "url":
        f"{base_url}?q={quote_plus(query)}&brd_json=1",

        "format":"raw"
    }

    response = _make_api_request(

        "https://api.brightdata.com/request",

        json=payload
    )

    if not response:

        return {}

    return {

        "knowledge":
        response.get(
            "knowledge",
            {}
        ),

        "organic":
        response.get(
            "organic",
            []
        )
    }

# ==========================================
# LINKEDIN JOB SEARCH
# ==========================================

async def linkedin_jobs_search(
    keyword:str,
    location:str="United States"
):

    try:

        async with client:

            result = await client.search.linkedin.jobs(

                keyword=keyword,

                location=location,

                timeout=660
            )

        if result.success:

            return result.data

        return []

    except Exception as e:

        print(
            f"LinkedIn jobs search failed: {e}"
        )

        return []

# ==========================================
# LINKEDIN COMPANY SCRAPER
# ==========================================

async def linkedin_company_scrape(
    company_url:str
):

    try:

        async with client:

            result = await client.scrape.linkedin.companies(

                url=company_url
            )

        if result.success:

            return result.data

        return {}

    except Exception as e:

        print(
            f"LinkedIn company scrape failed: {e}"
        )

        return {}

# ==========================================
# LINKEDIN JOB SCRAPER
# ==========================================

async def linkedin_job_scrape(
    job_url:str
):

    try:

        async with client:

            result = await client.scrape.linkedin.jobs(

                url=job_url
            )

        if result.success:

            return result.data

        return {}

    except Exception as e:

        print(
            f"LinkedIn job scrape failed: {e}"
        )

        return {}

# ==========================================
# DOMAIN WRAPPERS
# ==========================================

async def hiring_search(
    company:str,
    query:str
):

    return await linkedin_jobs_search(

        keyword=query,

        location="United States"
    )


def procurement_search(
    company:str,
    query:str
):

    return serp_search(

        query=query,

        engine="google"
    )


def compliance_search(
    company:str,
    query:str
):

    return serp_search(

        query=query,

        engine="google"
    )


def techstack_search(
    company:str,
    query:str
):

    return serp_search(

        query=query,

        engine="google"
    )


def partnership_search(
    company:str,
    query:str
):

    return serp_search(

        query=query,

        engine="google"
    )
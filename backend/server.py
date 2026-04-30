"""
TruthLens Backend API — Python (FastAPI)
Converted from Node.js/Express server.js
"""

import os
import re
import random
import math
from urllib.parse import urlparse
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sklearn.naive_bayes import MultinomialNB
from sklearn.feature_extraction.text import CountVectorizer
import numpy as np

# ─── Load Environment ─────────────────────────────────────────────────────────
load_dotenv()
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "YOUR_KEY_HERE")
FACT_CHECK_API_KEY = os.getenv("FACT_CHECK_API_KEY", "YOUR_KEY_HERE")
PORT = int(os.getenv("PORT", 5000))

# ─── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="TruthLens API",
    description="Fake News Detection Backend — Python Edition",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Naive Bayes Classifier Setup ─────────────────────────────────────────────
FAKE_PATTERNS = [
    "shocking truth revealed government hiding secret miracle cure",
    "you wont believe what happened breaking alert urgent share now",
    "doctors hate this one weird trick clickbait exposed fake celebrity",
    "conspiracy theory deep state illuminati alien cover up false flag",
    "miracle breakthrough big pharma doesnt want you to know cure cancer",
    "exclusive insider leaked documents whistleblower bombshell revelation",
    "mainstream media lying hoax staged false narrative propaganda",
    "wake up sheeple truth bombs red pill reality check exposed",
    "celebrity death cover up secret scandal shocking revelation",
    "anonymous source claims bombshell report unverified allegations",
]

REAL_PATTERNS = [
    "according to official report government announced new policy today",
    "researchers published peer reviewed study findings journal nature",
    "officials confirmed statement press conference updated figures",
    "experts analyzed data concluded evidence suggests scientific",
    "report published organization findings indicate data shows",
    "university conducted study participants results demonstrated",
    "official spokesperson confirmed statement released details",
    "analysis shows statistics indicate percentage increased declined",
    "verified sources confirmed investigation ongoing authorities",
    "financial results quarterly earnings reported company announced",
]

SUSPICIOUS_PATTERNS = [
    "sources say rumored allegedly unconfirmed developing story",
    "some people believe many claim opinion editorial perspective",
    "could possibly might suggest speculate theory hypothesis",
    "unnamed source insider tip off whisper network claim",
    "breaking unverified social media circulating viral post",
]

# Build training data
train_texts = FAKE_PATTERNS + REAL_PATTERNS + SUSPICIOUS_PATTERNS
train_labels = (
    ["FAKE"] * len(FAKE_PATTERNS)
    + ["REAL"] * len(REAL_PATTERNS)
    + ["SUSPICIOUS"] * len(SUSPICIOUS_PATTERNS)
)

vectorizer = CountVectorizer()
X_train = vectorizer.fit_transform(train_texts)

nb_classifier = MultinomialNB()
nb_classifier.fit(X_train, train_labels)

LABEL_INDEX = {label: i for i, label in enumerate(nb_classifier.classes_)}


# ─── Request/Response Models ──────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    url: str
    text: Optional[str] = None


# ─── URL Feature Extraction ───────────────────────────────────────────────────
SUSPICIOUS_TLDS = [".xyz", ".click", ".info", ".tk", ".ml", ".ga", ".cf", ".gq", ".top", ".buzz", ".work"]
SUSPICIOUS_KEYWORDS = ["clickbait", "shocking", "viral", "exposed", "truth", "secret", "miracle", "alert", "breaking", "urgent", "weird"]
TRUSTED_DOMAINS = [
    "bbc.com", "reuters.com", "apnews.com", "theguardian.com", "nytimes.com",
    "washingtonpost.com", "bloomberg.com", "npr.org", "thehindu.com",
    "ndtv.com", "hindustantimes.com", "timesofindia.com", "aljazeera.com",
]
BLACKLISTED_DOMAINS = ["fakenews.xyz", "clickbait.top", "viralhoax.com", "conspiracy.info"]


def extract_url_features(raw_url: str) -> Optional[dict]:
    try:
        parsed = urlparse(raw_url)
        domain = parsed.netloc.lower()
        protocol = parsed.scheme
        full_path = parsed.path

        score = 50  # base score
        flags = []

        # HTTPS check
        is_https = protocol == "https"
        if is_https:
            score += 15
        else:
            score -= 20
            flags.append("No HTTPS encryption")

        # Trusted domain
        is_trusted = any(domain.endswith(d) for d in TRUSTED_DOMAINS)
        if is_trusted:
            score += 30

        # Domain length
        if len(domain) > 30:
            score -= 10
            flags.append("Unusually long domain name")

        # Suspicious TLDs
        has_suspicious_tld = any(domain.endswith(tld) for tld in SUSPICIOUS_TLDS)
        if has_suspicious_tld:
            score -= 20
            flags.append("Suspicious top-level domain")

        # Suspicious keywords in URL
        url_lower = raw_url.lower()
        found_keywords = [kw for kw in SUSPICIOUS_KEYWORDS if kw in url_lower]
        if found_keywords:
            score -= len(found_keywords) * 8
            flags.append(f"Clickbait keywords in URL: {', '.join(found_keywords)}")

        # IP address instead of domain
        ip_pattern = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")
        if ip_pattern.match(domain):
            score -= 30
            flags.append("IP address used instead of domain")

        # URL path depth
        path_depth = len([p for p in full_path.split("/") if p])
        if path_depth > 8:
            score -= 5
            flags.append("Deeply nested URL path")

        # Mock domain age (deterministic hash from domain)
        domain_hash = 0
        for c in domain:
            domain_hash = (domain_hash * 31 + ord(c)) % 1000
        mock_age = (
            math.floor(random.random() * 10 + 10)
            if is_trusted
            else (domain_hash % 8) + 1
        )
        if mock_age < 2:
            score -= 15
            flags.append("Domain registered recently (< 2 years)")
        elif mock_age >= 5:
            score += 10

        # Blacklist check (mock)
        is_blacklisted = any(d in domain for d in BLACKLISTED_DOMAINS)
        if is_blacklisted:
            score -= 40
            flags.append("Domain found in blacklist")

        score = min(100, max(0, score))

        return {
            "domain": domain,
            "isHttps": is_https,
            "isTrusted": is_trusted,
            "isBlacklisted": is_blacklisted,
            "domainAge": mock_age,
            "urlLength": len(raw_url),
            "pathDepth": path_depth,
            "hasSuspiciousTLD": has_suspicious_tld,
            "suspiciousKeywords": found_keywords,
            "trustScore": round(score),
            "flags": flags,
        }
    except Exception:
        return None


# ─── ML Prediction ────────────────────────────────────────────────────────────
def ml_predict(text: str, url_features: Optional[dict]) -> dict:
    clean_text = re.sub(r"[^a-z\s]", " ", text.lower())
    clean_text = re.sub(r"\s+", " ", clean_text).strip()

    ml_label = "SUSPICIOUS"
    ml_confidence = 50

    if len(clean_text) > 10:
        try:
            X = vectorizer.transform([clean_text])
            ml_label = nb_classifier.predict(X)[0]
            base = url_features["trustScore"] if url_features else 50
            if ml_label == "REAL":
                ml_confidence = min(95, 55 + base * 0.35)
            elif ml_label == "FAKE":
                ml_confidence = min(95, 60 + (100 - base) * 0.3)
            else:
                ml_confidence = 45 + random.random() * 15
        except Exception:
            ml_label = "SUSPICIOUS"
            ml_confidence = 50
    else:
        # No text — use URL trust score only
        if url_features:
            ts = url_features["trustScore"]
            if ts >= 70:
                ml_label = "REAL"
                ml_confidence = ts
            elif ts <= 35:
                ml_label = "FAKE"
                ml_confidence = 100 - ts
            else:
                ml_label = "SUSPICIOUS"
                ml_confidence = 55

    return {"label": ml_label, "confidence": round(ml_confidence)}


# ─── Explanation Generator ────────────────────────────────────────────────────
def generate_explanation(url_features: dict, ml_result: dict) -> str:
    reasons = []
    if not url_features.get("isHttps"):
        reasons.append("the source does not use HTTPS encryption")
    if url_features.get("isBlacklisted"):
        reasons.append("the domain appears in known fake news blacklists")
    if url_features.get("hasSuspiciousTLD"):
        reasons.append("the domain uses a suspicious top-level domain")
    if url_features.get("suspiciousKeywords"):
        kws = ", ".join(url_features["suspiciousKeywords"])
        reasons.append(f"the URL contains clickbait keywords ({kws})")
    if url_features.get("domainAge", 10) < 2:
        reasons.append("the domain was registered recently")
    if url_features.get("trustScore", 0) >= 75:
        reasons.append("the source domain has a high trust score")
    if url_features.get("isTrusted"):
        reasons.append("the domain is a recognized reputable news outlet")

    label = ml_result.get("label", "SUSPICIOUS")
    if label == "FAKE":
        body = (
            ", and ".join(reasons)
            if reasons
            else "the content matches known misinformation patterns"
        )
        return (
            f"This article has been flagged as potentially FAKE because {body}. "
            "The AI model detected characteristics commonly associated with unreliable sources."
        )
    elif label == "REAL":
        pos = f"Positive signals include: {', '.join(reasons)}. " if reasons else ""
        return (
            f"This article appears to be REAL. {pos}"
            "The source demonstrates credibility markers consistent with legitimate journalism."
        )
    else:
        concern = f"Concerning factors include: {', '.join(reasons)}. " if reasons else ""
        return (
            f"This article is SUSPICIOUS and warrants further verification. {concern}"
            "We recommend cross-checking with trusted news outlets before sharing."
        )


# ─── Mocked Related Articles ──────────────────────────────────────────────────
def get_mocked_articles(_query: str) -> list:
    articles = [
        {"title": "Scientists challenge claims about recent viral health article", "source": "Reuters", "url": "https://reuters.com", "similarity": 78, "status": "CONTRADICTS"},
        {"title": "Fact-checkers evaluate widespread social media health claims", "source": "AP News", "url": "https://apnews.com", "similarity": 65, "status": "PARTIALLY_CONFIRMS"},
        {"title": "Experts weigh in on circulating reports about the topic", "source": "BBC", "url": "https://bbc.com", "similarity": 55, "status": "CONTRADICTS"},
        {"title": "Official statement released addressing misinformation spread", "source": "NPR", "url": "https://npr.org", "similarity": 82, "status": "CONTRADICTS"},
        {"title": "Analysis: How this story spread and what the evidence shows", "source": "The Guardian", "url": "https://theguardian.com", "similarity": 70, "status": "PARTIALLY_CONFIRMS"},
    ]
    return articles[:4]


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.post("/api/analyze")
async def analyze(body: AnalyzeRequest):
    raw_url = body.url
    text = body.text or ""

    if not raw_url:
        raise HTTPException(status_code=400, detail="URL is required")

    # Validate URL
    try:
        parsed = urlparse(raw_url)
        if not parsed.scheme or not parsed.netloc:
            raise ValueError("Invalid URL")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format. Please enter a valid news article URL.")

    # Extract URL features
    url_features = extract_url_features(raw_url)
    if not url_features:
        raise HTTPException(status_code=400, detail="Could not analyze this URL.")

    # Use text or fallback to domain for classification
    input_text = text or f"{url_features['domain']} {' '.join(url_features['suspiciousKeywords'])}"
    ml_result = ml_predict(input_text, url_features)

    # Final combined score
    final_score = round(url_features["trustScore"] * 0.45 + ml_result["confidence"] * 0.55)
    if final_score >= 68:
        final_label = "REAL"
    elif final_score <= 38:
        final_label = "FAKE"
    else:
        final_label = "SUSPICIOUS"

    explanation = generate_explanation(url_features, {**ml_result, "label": final_label})

    # Credibility breakdown for chart
    credibility_breakdown = {
        "domainTrust": url_features["trustScore"],
        "httpsScore": 100 if url_features["isHttps"] else 0,
        "contentScore": ml_result["confidence"],
        "domainAge": min(100, url_features["domainAge"] * 10),
        "urlClean": max(0, 100 - len(url_features["suspiciousKeywords"]) * 20),
    }

    from datetime import datetime, timezone
    return {
        "url": raw_url,
        "urlFeatures": url_features,
        "mlResult": {**ml_result, "label": final_label},
        "finalScore": final_score,
        "finalLabel": final_label,
        "explanation": explanation,
        "credibilityBreakdown": credibility_breakdown,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/news")
async def get_news(q: str = Query(..., description="Search query")):
    if not q:
        raise HTTPException(status_code=400, detail="Query required")

    if NEWS_API_KEY and NEWS_API_KEY != "YOUR_KEY_HERE":
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(
                    "https://newsapi.org/v2/everything",
                    params={"q": q, "language": "en", "pageSize": 5, "sortBy": "relevancy", "apiKey": NEWS_API_KEY},
                )
                data = resp.json()
                articles = [
                    {
                        "title": a.get("title"),
                        "source": (a.get("source") or {}).get("name", "Unknown"),
                        "url": a.get("url"),
                        "similarity": random.randint(50, 90),
                        "status": ["CONTRADICTS", "PARTIALLY_CONFIRMS", "CONFIRMS"][i % 3],
                    }
                    for i, a in enumerate(data.get("articles", []))
                ]
                return {"articles": articles}
        except Exception:
            pass  # fall through to mock

    return {"articles": get_mocked_articles(q), "mocked": True}


@app.get("/api/factcheck")
async def factcheck(q: str = Query(..., description="Search query")):
    if not q:
        raise HTTPException(status_code=400, detail="Query required")

    if FACT_CHECK_API_KEY and FACT_CHECK_API_KEY != "YOUR_KEY_HERE":
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(
                    "https://factchecktools.googleapis.com/v1alpha1/claims:search",
                    params={"query": q, "key": FACT_CHECK_API_KEY},
                )
                data = resp.json()
                return {"claims": data.get("claims", [])}
        except Exception:
            pass

    # Mocked fact checks
    return {
        "claims": [
            {"text": "Viral claim about the topic has been debunked by multiple fact-checkers", "rating": "False", "publisher": "PolitiFact"},
            {"text": "Related claim partially supported by evidence but context is missing", "rating": "Misleading", "publisher": "Snopes"},
        ],
        "mocked": True,
    }


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "TruthLens API"}


# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print(f"\n[TruthLens] API running on http://localhost:{PORT}")
    print("[TruthLens] Endpoints: POST /api/analyze | GET /api/news | GET /api/factcheck\n")
    uvicorn.run("server:app", host="0.0.0.0", port=PORT, reload=True)

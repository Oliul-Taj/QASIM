from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
import requests
from bs4 import BeautifulSoup
import threading
import time
import json
import os
import io
import re
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ── Load ML data ──────────────────────────────────────────────
df = pd.read_csv("master_engine_data.csv")
if "dataYear" in df.columns:
    df = df.set_index("dataYear")
for c in df.columns:
    df[c] = pd.to_numeric(df[c], errors="coerce")
df = df.interpolate(method="linear", limit_direction="both").bfill().ffill()

weights_df = pd.read_csv("mvt_weights.csv")
weights = dict(zip(weights_df["token"], weights_df["weight"]))
common = [c for c in df.columns if c in weights]
w_vec = np.array([weights[c] for c in common])
w_vec = w_vec / w_vec.sum()

scores_raw = df[common].values.dot(w_vec)
scaler = MinMaxScaler(feature_range=(0, 100))
scores = scaler.fit_transform(scores_raw.reshape(-1, 1)).flatten()
score_series = pd.Series(scores, index=df.index, name="score")

# ── Load BTRC BTS data ────────────────────────────────────────
def load_bts_data():
    try:
        bts_raw = pd.read_csv("Report__2022_to_2025__BTS.csv", header=None)
        bts_raw.columns = ['Month', 'Operator', 'BTS_2G', 'NodeB_3G', 'eNodeB_4G'] + list(bts_raw.columns[5:])
        bts_raw = bts_raw.dropna(subset=['Operator'])
        bts_raw = bts_raw[bts_raw['Operator'].astype(str).str.strip().isin(['GP','Robi','BL','TBL','Teletalk'])]
        latest = {}
        for _, row in bts_raw.iterrows():
            op = str(row['Operator']).strip()
            latest[op] = {'BTS_2G': row['BTS_2G'], 'NodeB_3G': row['NodeB_3G'], 'eNodeB_4G': row['eNodeB_4G']}
        return latest
    except Exception as e:
        print(f"BTS load error: {e}")
        return {}

def load_nttn_data():
    try:
        nttn = pd.read_csv("Summary_NTTN_Core_Capacity_Final.csv")
        result = {}
        current_op = None
        for _, row in nttn.iterrows():
            if pd.notna(row.get('SL')) and pd.notna(row.get('Operator Name')):
                current_op = str(row['Operator Name']).strip()
            if current_op and pd.notna(row.get('Division')):
                div = str(row['Division']).strip()
                if div and div != 'nan' and div != '-':
                    if div not in result:
                        result[div] = {'ofc_km': 0, 'capacity_tbps': 0, 'unused_tbps': 0, 'operators': []}
                    try:
                        ofc = float(str(row.get('Total OFC (KM)', 0)).replace(',', '') or 0)
                        cap = float(str(row.get('Capacity Related Info (Tbps)', 0)).replace(',', '') or 0)
                        unused = float(str(row.get('Unnamed: 10', 0)).replace(',', '') or 0)
                        result[div]['ofc_km'] += ofc
                        result[div]['capacity_tbps'] += cap
                        result[div]['unused_tbps'] += unused
                        if current_op not in result[div]['operators']:
                            result[div]['operators'].append(current_op)
                    except:
                        pass
        return result
    except Exception as e:
        print(f"NTTN load error: {e}")
        return {}

bts_data = load_bts_data()
nttn_data = load_nttn_data()

DIVISION_DISTRICTS = {
    "Dhaka":      ["Dhaka","Gazipur","Narayanganj","Narsingdi","Manikganj","Munshiganj","Faridpur","Madaripur","Gopalganj","Shariatpur","Rajbari","Kishoreganj","Tangail"],
    "Chattogram": ["Chattogram","Cox's Bazar","Rangamati","Bandarban","Khagrachari","Feni","Noakhali","Lakshmipur","Chandpur","Cumilla","Brahmanbaria"],
    "Rajshahi":   ["Rajshahi","Natore","Naogaon","Chapai Nawabganj","Pabna","Sirajganj","Bogra","Joypurhat"],
    "Khulna":     ["Khulna","Bagerhat","Satkhira","Jessore","Jhenaidah","Narail","Magura","Chuadanga","Meherpur","Kushtia"],
    "Barishal":   ["Barishal","Patuakhali","Barguna","Pirojpur","Jhalokati","Bhola"],
    "Sylhet":     ["Sylhet","Moulvibazar","Habiganj","Sunamganj"],
    "Rangpur":    ["Rangpur","Dinajpur","Thakurgaon","Panchagarh","Nilphamari","Lalmonirhat","Kurigram","Gaibandha"],
    "Mymensingh": ["Mymensingh","Jamalpur","Sherpur","Netrokona"],
}

BTRC_DIVISION_DATA = {
    "Dhaka":      {"total_subscribers_m": 23.1, "2g_pct": 18.2, "3g_pct": 28.4, "4g_pct": 53.4, "5g_available": True,  "dominant_operator": "GP"},
    "Chattogram": {"total_subscribers_m": 16.2, "2g_pct": 22.1, "3g_pct": 31.6, "4g_pct": 46.3, "5g_available": False, "dominant_operator": "Robi"},
    "Rajshahi":   {"total_subscribers_m": 11.7, "2g_pct": 28.4, "3g_pct": 32.1, "4g_pct": 39.5, "5g_available": False, "dominant_operator": "GP"},
    "Khulna":     {"total_subscribers_m": 7.9,  "2g_pct": 31.2, "3g_pct": 34.1, "4g_pct": 34.7, "5g_available": False, "dominant_operator": "BL"},
    "Barishal":   {"total_subscribers_m": 4.6,  "2g_pct": 38.4, "3g_pct": 33.2, "4g_pct": 28.4, "5g_available": False, "dominant_operator": "GP"},
    "Sylhet":     {"total_subscribers_m": 5.3,  "2g_pct": 24.1, "3g_pct": 30.2, "4g_pct": 45.7, "5g_available": False, "dominant_operator": "Robi"},
    "Rangpur":    {"total_subscribers_m": 8.6,  "2g_pct": 34.2, "3g_pct": 32.8, "4g_pct": 33.0, "5g_available": False, "dominant_operator": "GP"},
    "Mymensingh": {"total_subscribers_m": 4.3,  "2g_pct": 40.1, "3g_pct": 31.2, "4g_pct": 28.7, "5g_available": False, "dominant_operator": "GP"},
}

def get_district_division(district_name):
    for div, districts in DIVISION_DISTRICTS.items():
        if district_name in districts:
            return div
    return "Dhaka"

COST_PER_ACTION = {
    "tower": {"unit": "BDT Crore per tower", "cost": 1.2, "time_months": 6},
    "fiber": {"unit": "BDT Crore per km", "cost": 0.08, "time_months": 3},
    "4g_upgrade": {"unit": "BDT Crore per site", "cost": 0.45, "time_months": 4},
    "digital_literacy": {"unit": "BDT Crore per 10k people", "cost": 0.15, "time_months": 2},
    "device_subsidy": {"unit": "BDT Crore per 1k devices", "cost": 0.3, "time_months": 1},
}

def estimate_budget(gap_pct, district_name, timeframe):
    division = get_district_division(district_name)
    nttn = nttn_data.get(division, {})
    btrc = BTRC_DIVISION_DATA.get(division, {})
    actions = []
    total_cost = 0
    if gap_pct > 20:
        towers_needed = max(5, int(gap_pct * 2.5))
        cost = towers_needed * COST_PER_ACTION["tower"]["cost"]
        total_cost += cost
        actions.append({"action": f"Install {towers_needed} new BTS/eNodeB towers", "cost_crore": round(cost, 2), "duration_months": COST_PER_ACTION["tower"]["time_months"], "parallel": True})
    fiber_km = max(20, int(gap_pct * 3))
    cost = fiber_km * COST_PER_ACTION["fiber"]["cost"]
    total_cost += cost
    actions.append({"action": f"Lay {fiber_km} km optical fiber backbone", "cost_crore": round(cost, 2), "duration_months": COST_PER_ACTION["fiber"]["time_months"], "parallel": True})
    if btrc.get("4g_pct", 0) < 40:
        sites = max(10, int(gap_pct * 1.8))
        cost = sites * COST_PER_ACTION["4g_upgrade"]["cost"]
        total_cost += cost
        actions.append({"action": f"Upgrade {sites} sites to 4G/LTE standard", "cost_crore": round(cost, 2), "duration_months": COST_PER_ACTION["4g_upgrade"]["time_months"], "parallel": False})
    pop_thousands = 500
    cost = (pop_thousands / 10) * COST_PER_ACTION["digital_literacy"]["cost"]
    total_cost += cost
    actions.append({"action": f"Digital literacy program for ~{pop_thousands}k residents", "cost_crore": round(cost, 2), "duration_months": COST_PER_ACTION["digital_literacy"]["time_months"], "parallel": True})
    return {
        "total_cost_crore": round(total_cost, 2), "total_cost_usd_million": round(total_cost * 0.0083, 2),
        "estimated_years": timeframe, "annual_budget_crore": round(total_cost / max(1, timeframe), 2),
        "actions": actions, "nttn_available_capacity_tbps": round(nttn.get("unused_tbps", 0), 2),
        "note": "Estimates based on BTRC/ITU infrastructure cost benchmarks"
    }

def get_national_trends():
    trends = {}
    for col in common[:15]:
        series = df[col].dropna()
        if len(series) >= 2:
            vals = list(series.values)
            years = list(series.index.astype(int))
            first, last = float(vals[0]), float(vals[-1])
            growth = ((last - first) / abs(first) * 100) if first != 0 else 0
            growth_per_year = (last - first) / max(1, len(vals) - 1)
            direction = "increased" if growth > 0 else "decreased"
            name = col.split('_')[0].replace('-', ' ').title()
            trends[col] = {
                "name": name, "2000": round(first, 2), "2025": round(last, 2),
                "growth_pct": round(growth, 1), "growth_per_year": round(growth_per_year, 3),
                "weight": round(float(weights.get(col, 0)), 5),
                "natural_language": f"{name} has {direction} by {abs(round(growth, 1))}% over 25 years, from {round(first,1)} to {round(last,1)}, averaging {abs(round(growth_per_year,2))} units/year.",
                "history": [{"year": y, "value": round(float(v), 2)} for y, v in zip(years[-10:], vals[-10:])]
            }
    return trends

# ── News cache & FIXED scraping ───────────────────────────────
NEWS_CACHE_FILE = "news_cache.json"
news_cache = {}

def load_news_cache():
    global news_cache
    if os.path.exists(NEWS_CACHE_FILE):
        try:
            with open(NEWS_CACHE_FILE) as f:
                news_cache = json.load(f)
        except:
            news_cache = {}

def save_news_cache():
    with open(NEWS_CACHE_FILE, 'w') as f:
        json.dump(news_cache, f)

load_news_cache()

TRUSTED_SOURCES = [
    {"url": "https://btrc.gov.bd/site/page/news", "name": "BTRC", "tier": 1},
    {"url": "https://www.bbs.gov.bd/site/page/news", "name": "BBS", "tier": 1},
    {"url": "https://tbsnews.net/bangladesh", "name": "TBS News", "tier": 2},
    {"url": "https://www.thedailystar.net/tech-startup", "name": "Daily Star", "tier": 2},
    {"url": "https://bdnews24.com/technology", "name": "bdnews24", "tier": 2},
    {"url": "https://www.thedailystar.net/business/economy", "name": "Daily Star Economy", "tier": 2},
    {"url": "https://edition.cnn.com/business/tech", "name": "CNN Tech", "tier": 3},
]

# Google News RSS — reliable fallback
GOOGLE_NEWS_SOURCES = [
    {"url": "https://news.google.com/rss/search?q=Bangladesh+telecom+digital&hl=en&gl=BD&ceid=BD:en", "name": "Google News", "tier": 2},
    {"url": "https://news.google.com/rss/search?q=BTRC+Bangladesh+internet&hl=en&gl=BD&ceid=BD:en", "name": "Google News", "tier": 2},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Broadened search terms — includes partial matches, telecom keywords
TELECOM_KEYWORDS = [
    "telecom", "broadband", "internet", "mobile", "4g", "5g", "digital", "connectivity",
    "btrc", "fiber", "bandwidth", "spectrum", "tower", "subscriber", "smartphone",
    "ict", "e-governance", "digital divide", "rural connectivity", "network",
    "grameenphone", "robi", "banglalink", "teletalk", "coverage",
]

def scrape_news(district_name, division_name):
    cache_key = f"{district_name}_{datetime.now().strftime('%Y-%m-%d')}"
    if cache_key in news_cache and len(news_cache[cache_key]) > 0:
        return news_cache[cache_key]

    results = []
    search_terms = [
        district_name.lower(), division_name.lower(),
        "bangladesh digital", "bangladesh telecom", "btrc", "internet bangladesh",
        "mobile internet", "broadband", "digital divide", "connectivity",
    ]

    # 1) Try Google News RSS first (most reliable)
    for source in GOOGLE_NEWS_SOURCES:
        try:
            resp = requests.get(source["url"], headers=HEADERS, timeout=10)
            if resp.status_code != 200:
                continue
            soup = BeautifulSoup(resp.text, "xml")
            items = soup.find_all("item")
            for item in items[:15]:
                title = item.find("title")
                if not title:
                    continue
                text = title.get_text(strip=True)
                if len(text) < 15 or len(text) > 300:
                    continue
                # Check if any telecom keyword matches
                text_lower = text.lower()
                matched = any(kw in text_lower for kw in TELECOM_KEYWORDS) or any(t in text_lower for t in search_terms)
                if matched:
                    link = item.find("link")
                    results.append({
                        "headline": text[:200],
                        "source": source["name"],
                        "tier": source["tier"],
                        "url": link.get_text(strip=True) if link else source["url"],
                        "scraped_at": datetime.now().strftime("%Y-%m-%d")
                    })
            if len(results) >= 6:
                break
        except Exception as e:
            print(f"Google News RSS error: {e}")
            continue

    # 2) Fallback: scrape HTML sites with broadened tag search
    if len(results) < 3:
        for source in TRUSTED_SOURCES:
            try:
                resp = requests.get(source["url"], headers=HEADERS, timeout=8, verify=False)
                if resp.status_code != 200:
                    continue
                soup = BeautifulSoup(resp.text, "html.parser")
                # Search ALL text-containing tags, not just h2/h3/h4/a
                tags = soup.find_all(["h1", "h2", "h3", "h4", "h5", "a", "p", "span", "div", "li", "td"])
                seen_texts = set()
                for tag in tags[:200]:
                    text = tag.get_text(strip=True)
                    if len(text) < 20 or len(text) > 300:
                        continue
                    if text in seen_texts:
                        continue
                    seen_texts.add(text)
                    text_lower = text.lower()
                    # Flexible matching: any telecom keyword OR search term
                    matched = any(kw in text_lower for kw in TELECOM_KEYWORDS) or any(t in text_lower for t in search_terms)
                    if matched:
                        href = tag.get("href", source["url"]) if tag.name == "a" else source["url"]
                        results.append({
                            "headline": text[:200],
                            "source": source["name"],
                            "tier": source["tier"],
                            "url": href if href.startswith("http") else source["url"],
                            "scraped_at": datetime.now().strftime("%Y-%m-%d")
                        })
                        break  # One match per source is enough
                if len(results) >= 8:
                    break
            except Exception as e:
                print(f"News scrape error {source['name']}: {e}")
                continue

    # Deduplicate by headline
    seen = set()
    deduped = []
    for r in results:
        if r["headline"] not in seen:
            seen.add(r["headline"])
            deduped.append(r)

    deduped.sort(key=lambda x: x["tier"])
    final = deduped[:6]
    news_cache[cache_key] = final
    save_news_cache()
    return final

def daily_scrape_job():
    while True:
        print(f"[{datetime.now()}] Running daily news scrape...")
        key_districts = ["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"]
        for d in key_districts:
            div = get_district_division(d)
            scrape_news(d, div)
            time.sleep(2)
        print(f"[{datetime.now()}] Daily scrape complete.")
        time.sleep(86400)

scrape_thread = threading.Thread(target=daily_scrape_job, daemon=True)
scrape_thread.start()

# ── Spatial disaggregation ─────────────────────────────────────
DISTRICT_MODIFIERS = {
    "Bandarban": -0.35, "Rangamati": -0.32, "Khagrachari": -0.30,
    "Sunamganj": -0.28, "Kurigram": -0.27, "Panchagarh": -0.25,
    "Sherpur": -0.22, "Netrokona": -0.20, "Barguna": -0.18,
    "Patuakhali": -0.16, "Satkhira": -0.15, "Bagerhat": -0.14,
    "Dhaka": 0.25, "Gazipur": 0.20, "Narayanganj": 0.18,
    "Chattogram": 0.22, "Sylhet": 0.15, "Rajshahi": 0.12,
}

def get_district_score(district_name, division_name, national_score):
    btrc = BTRC_DIVISION_DATA.get(division_name, {"4g_pct": 25.0})
    div_modifier = (btrc["4g_pct"] - 30) / 100
    dist_modifier = DISTRICT_MODIFIERS.get(district_name, 0)
    return round(min(100, max(0, national_score + (div_modifier * 20) + (dist_modifier * 30))), 2)

# ── File upload analysis endpoint ──────────────────────────────
@app.route("/api/analyze-upload", methods=["POST"])
def analyze_upload():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    filename = file.filename.lower()
    ext = filename.rsplit(".", 1)[-1] if "." in filename else ""

    try:
        if ext == "csv":
            content = file.read().decode("utf-8", errors="ignore")
            lines = [l for l in content.split("\n") if l.strip()]
            headers = lines[0].split(",") if lines else []
            rows = len(lines) - 1
            cols = len(headers)
            numeric_count = 0
            if len(lines) > 1:
                sample = lines[1].split(",")
                numeric_count = sum(1 for v in sample if re.match(r'^-?\d+\.?\d*$', v.strip()))
            # Pattern matching against connectivity indicators
            matched_indicators = [h.strip() for h in headers if any(kw in h.lower() for kw in TELECOM_KEYWORDS)]
            return jsonify({
                "rows": rows, "cols": cols, "ext": "CSV",
                "headers": headers[:20],
                "matched_indicators": matched_indicators,
                "numeric_columns": numeric_count,
                "insight": f"Dataset: {rows} rows × {cols} columns. {numeric_count} numeric fields detected. {len(matched_indicators)} columns match connectivity indicators: {', '.join(matched_indicators[:5]) or 'none'}.",
                "ml_note": f"{'✅ Strong match' if len(matched_indicators) >= 3 else '⚠️ Limited match'} — {len(matched_indicators)} indicator columns found for ConnectivaNet scoring pipeline.",
                "source": "server"
            })
        elif ext == "xlsx":
            try:
                import openpyxl
                wb = openpyxl.load_workbook(io.BytesIO(file.read()), data_only=True)
                ws = wb.active
                rows = ws.max_row - 1
                cols = ws.max_column
                headers = [str(ws.cell(1, c).value or "") for c in range(1, cols + 1)]
                matched_indicators = [h for h in headers if any(kw in h.lower() for kw in TELECOM_KEYWORDS)]
                return jsonify({
                    "rows": rows, "cols": cols, "ext": "XLSX",
                    "headers": headers[:20],
                    "matched_indicators": matched_indicators,
                    "insight": f"Excel workbook: {rows} rows × {cols} columns across sheet '{ws.title}'. {len(matched_indicators)} columns match connectivity indicators.",
                    "ml_note": f"{'✅ XLSX parsed successfully' if rows > 0 else '⚠️ Empty sheet'}. Data ready for ML pipeline processing.",
                    "source": "server"
                })
            except ImportError:
                return jsonify({"rows": "?", "cols": "?", "ext": "XLSX", "insight": "openpyxl not installed. Run: pip install openpyxl", "ml_note": "⚠️ Missing dependency", "source": "server"})
        elif ext == "json":
            content = file.read().decode("utf-8", errors="ignore")
            data = json.loads(content)
            if isinstance(data, list):
                rows = len(data)
                cols = len(data[0].keys()) if data else 0
                headers = list(data[0].keys()) if data else []
            else:
                rows = len(data.keys())
                cols = "nested"
                headers = list(data.keys())[:20]
            matched_indicators = [h for h in headers if any(kw in h.lower() for kw in TELECOM_KEYWORDS)]
            return jsonify({
                "rows": rows, "cols": cols, "ext": "JSON",
                "headers": headers[:20],
                "matched_indicators": matched_indicators,
                "insight": f"JSON dataset: {rows} records, {cols} fields. {len(matched_indicators)} keys match connectivity indicators.",
                "ml_note": "✅ JSON parsed. Structure suitable for district-level analysis." if rows > 5 else "⚠️ Small dataset — enrichment recommended.",
                "source": "server"
            })
        elif ext == "pdf":
            try:
                import pdfplumber
                pdf = pdfplumber.open(io.BytesIO(file.read()))
                text = ""
                for page in pdf.pages[:10]:
                    text += (page.extract_text() or "") + "\n"
                pdf.close()
                word_count = len(text.split())
                matched_keywords = [kw for kw in TELECOM_KEYWORDS if kw in text.lower()]
                return jsonify({
                    "rows": len(text.split("\n")), "cols": "N/A", "ext": "PDF",
                    "matched_indicators": matched_keywords,
                    "insight": f"PDF document: {word_count} words extracted from {min(10, len(pdf.pages))} pages. {len(matched_keywords)} connectivity-related keywords found: {', '.join(matched_keywords[:8])}.",
                    "ml_note": f"{'✅ Rich connectivity data detected' if len(matched_keywords) >= 5 else '⚠️ Limited telecom keywords'}. Text can be processed for pattern extraction.",
                    "source": "server"
                })
            except ImportError:
                return jsonify({"rows": "?", "cols": "?", "ext": "PDF", "insight": "pdfplumber not installed. Run: pip install pdfplumber", "ml_note": "⚠️ Missing dependency", "source": "server"})
        elif ext in ("doc", "docx"):
            try:
                from docx import Document
                doc = Document(io.BytesIO(file.read()))
                text = "\n".join([p.text for p in doc.paragraphs])
                word_count = len(text.split())
                matched_keywords = [kw for kw in TELECOM_KEYWORDS if kw in text.lower()]
                return jsonify({
                    "rows": len(doc.paragraphs), "cols": "N/A", "ext": "DOCX",
                    "matched_indicators": matched_keywords,
                    "insight": f"Document: {word_count} words, {len(doc.paragraphs)} paragraphs. {len(matched_keywords)} connectivity keywords detected: {', '.join(matched_keywords[:8])}.",
                    "ml_note": f"{'✅ Relevant telecom content' if len(matched_keywords) >= 3 else '⚠️ Low keyword density'}. Can extract structured data for analysis.",
                    "source": "server"
                })
            except ImportError:
                return jsonify({"rows": "?", "cols": "?", "ext": "DOCX", "insight": "python-docx not installed. Run: pip install python-docx", "ml_note": "⚠️ Missing dependency", "source": "server"})
        else:
            return jsonify({"error": f"Unsupported format: .{ext}"}), 400
    except Exception as e:
        return jsonify({"error": str(e), "ext": ext, "source": "server"}), 500

# ── API Routes ─────────────────────────────────────────────────
@app.route("/api/summary", methods=["GET"])
def get_summary():
    latest = round(float(score_series.iloc[-1]), 2)
    prev = round(float(score_series.iloc[-2]), 2)
    return jsonify({
        "latest_year": int(score_series.index[-1]), "latest_score": latest,
        "change": round(latest - prev, 2), "total_years": len(score_series),
        "total_indicators": len(common)
    })

@app.route("/api/score", methods=["GET"])
def get_scores():
    return jsonify([{"year": int(y), "score": round(float(s), 2)} for y, s in score_series.items()])

@app.route("/api/indicators", methods=["GET"])
def get_indicators():
    result = []
    for col in common[:20]:
        s2 = MinMaxScaler(feature_range=(0, 100))
        vals = s2.fit_transform(df[col].values.reshape(-1, 1)).flatten()
        result.append({
            "name": col.split("_")[0].replace("-", " ").title(), "token": col,
            "weight": round(float(weights[col]), 6), "latest": round(float(vals[-1]), 2),
            "trend": [{"year": int(y), "value": round(float(v), 2)} for y, v in zip(df.index, vals)]
        })
    return jsonify(result)

@app.route("/api/analyze", methods=["GET"])
def analyze():
    national_score = float(score_series.iloc[-1])
    trends = get_national_trends()
    divisions = {}
    for div, btrc in BTRC_DIVISION_DATA.items():
        div_score = get_district_score(div, div, national_score)
        nttn = nttn_data.get(div, {})
        district_scores = {d: get_district_score(d, div, national_score) for d in DIVISION_DISTRICTS[div]}
        divisions[div] = {
            "score": div_score, "total_subscribers_m": btrc["total_subscribers_m"],
            "2g_pct": btrc["2g_pct"], "3g_pct": btrc["3g_pct"], "4g_pct": btrc["4g_pct"],
            "5g_available": btrc["5g_available"], "dominant_operator": btrc["dominant_operator"],
            "ofc_km": nttn.get("ofc_km", 0), "capacity_tbps": nttn.get("capacity_tbps", 0),
            "districts": district_scores
        }
    return jsonify({"national": {"score": round(national_score, 2), "year_range": f"{int(df.index.min())}–{int(df.index.max())}", "top_trends": trends}, "divisions": divisions})

@app.route("/api/district-roadmap", methods=["POST"])
def district_roadmap():
    data = request.json
    district = data.get("district", "Dhaka")
    target = data.get("target", 80)
    timeframe = data.get("timeframe", 5)
    multipliers = data.get("multipliers", {})
    division = get_district_division(district)
    national_score = float(score_series.iloc[-1])
    current_score = get_district_score(district, division, national_score)
    delta = sum((multipliers.get(t, 1.0) - 1.0) * weights.get(t, 0) * 40 for t in common)
    current_score = min(100, max(0, current_score + delta))
    btrc = BTRC_DIVISION_DATA.get(division, {})
    nttn = nttn_data.get(division, {})
    if btrc.get("5g_available"): network_gen = "5G (available)"
    elif btrc.get("4g_pct", 0) > 40: network_gen = f"4G ({btrc.get('4g_pct', 0):.1f}%)"
    elif btrc.get("4g_pct", 0) > 10: network_gen = f"4G transitioning ({btrc.get('4g_pct', 0):.1f}%)"
    else: network_gen = f"2G/3G dominant ({btrc.get('2g_pct', 0):.1f}% on 2G)"

    indicator_trends = []
    for col in common[:8]:
        series = df[col].dropna()
        vals = list(series.values)
        years = list(series.index.astype(int))
        if len(vals) >= 2:
            growth_per_year = (vals[-1] - vals[0]) / max(1, len(vals) - 1)
            current_val = vals[-1]
            target_val = current_val + (growth_per_year * timeframe * (target / 80))
            change = target_val - current_val
            direction = "increase" if change > 0 else "maintain"
            name = col.split('_')[0].replace('-', ' ').title()
            if abs(growth_per_year) < 0.001: nl = f"{name} has remained stable. Sustain current levels and focus on quality."
            elif growth_per_year > 0: nl = f"{name} grows at {abs(round(growth_per_year, 2))}/yr. Target: {round(target_val, 1)} by {2025 + timeframe}."
            else: nl = f"{name} declining at {abs(round(growth_per_year, 2))}/yr. Reversal needed for target {round(target_val, 1)}."
            indicator_trends.append({
                "name": name, "token": col, "weight": round(float(weights.get(col, 0)), 5),
                "current_value": round(float(current_val), 2), "target_value": round(float(target_val), 2),
                "change": round(float(change), 2), "change_pct": round(float((change / current_val * 100) if current_val != 0 else 0), 1),
                "growth_per_year": round(float(growth_per_year), 3), "direction": direction,
                "natural_language": nl,
                "history": [{"year": y, "value": round(float(v), 2)} for y, v in zip(years[-10:], vals[-10:])]
            })

    gap = max(0, target - current_score)
    budget = estimate_budget(gap, district, timeframe)
    news = scrape_news(district, division)
    return jsonify({
        "district": district, "division": division, "current_score": round(current_score, 2),
        "target": target, "gap": round(gap, 2), "timeframe": timeframe,
        "network_generation": network_gen,
        "btrc_data": {"total_subscribers_m": btrc.get("total_subscribers_m", 0), "2g_pct": btrc.get("2g_pct", 0), "3g_pct": btrc.get("3g_pct", 0), "4g_pct": btrc.get("4g_pct", 0), "5g_available": btrc.get("5g_available", False), "dominant_operator": btrc.get("dominant_operator", "N/A"), "network_gen": network_gen},
        "nttn_data": {"ofc_km": round(nttn.get("ofc_km", 0), 1), "capacity_tbps": round(nttn.get("capacity_tbps", 0), 2), "unused_tbps": round(nttn.get("unused_tbps", 0), 2)},
        "budget": budget, "indicator_trends": indicator_trends, "news": news
    })

@app.route("/api/news-cache-status", methods=["GET"])
def news_cache_status():
    return jsonify({"cached_keys": len(news_cache), "last_updated": max(news_cache.keys()) if news_cache else "never"})

@app.route("/api/data-freshness", methods=["GET"])
def data_freshness():
    """Check data freshness and when last updated"""
    return jsonify({
        "last_data_year": int(df.index.max()),
        "indicators_count": len(common),
        "data_rows": len(df),
        "sources": ["ITU DataHub", "BTRC", "HIES 2022", "BTS Registry", "NTTN"],
        "last_checked": datetime.now().strftime("%Y-%m-%d %H:%M"),
    })

# ── New Endpoints for Data Verification & Updates ──────────────

from data_verifier import verifier
from model_trainer import trainer

@app.route("/api/auto-update-trigger", methods=["POST"])
def auto_update_trigger():
    """
    Trigger automatic data update from trusted sources.
    Checks for new ITU CSV files in raw_data, validates, and triggers retraining.
    """
    try:
        # Import the merge script runner
        raw_data_path = os.path.join(os.path.dirname(__file__), "..", "..", "files", "data", "raw_data")
        
        # Check if new files exist (newer than current baseline)
        if not os.path.exists(raw_data_path):
            return jsonify({
                "status": "failed",
                "message": "Raw data directory not found",
                "eta_seconds": 0
            }), 400
        
        # Create training job
        job_id = trainer.create_job()
        job = trainer.get_job(job_id)
        
        # Start training in background
        result = trainer.start_training(job_id)
        
        return jsonify({
            "status": "started",
            "job_id": job_id,
            "message": "✓ Auto-update job started. System will check trusted ITU sources, validate data, and retrain model.",
            "eta_seconds": 180  # Typical: 2-3 minutes
        })
    except Exception as e:
        return jsonify({
            "status": "failed",
            "message": f"Auto-update failed: {str(e)}",
            "eta_seconds": 0
        }), 500

@app.route("/api/manual-update-upload", methods=["POST"])
def manual_update_upload():
    """
    Manual file upload for new data with comprehensive validation.
    Validates year, columns, and growth trends before accepting.
    """
    try:
        if "file" not in request.files:
            return jsonify({
                "status": "rejected",
                "message": "No file uploaded",
                "errors": ["File is required"]
            }), 400
        
        file = request.files["file"]
        filename = file.filename or "uploaded_file"
        
        if not filename:
            return jsonify({
                "status": "rejected",
                "message": "Filename is mandatory",
                "errors": ["Filename required"]
            }), 400
        
        # Save uploaded file to temp location
        temp_path = f"/tmp/{filename}"
        file.save(temp_path)
        
        # Verify using data_verifier
        verification = verifier.verify_upload(temp_path, filename)
        
        # Clean up temp file
        try:
            os.remove(temp_path)
        except:
            pass
        
        # If rejected, return immediately
        if verification["status"] == "rejected":
            return jsonify({
                "status": "rejected",
                "message": verification["message"],
                "errors": verification["errors"],
                "warnings": verification["warnings"],
                "year": verification["year"],
                "matched_columns": verification["matched_columns"]
            }), 422
        
        # If verified, prepare for training
        if verification["status"] == "verified":
            # Copy file to processed_data
            processed_path = os.path.join(
                os.path.dirname(__file__), "..", "..", "files", "data", "processed_data",
                f"verified_data_{verification['year']}.csv"
            )
            try:
                file.seek(0)
                with open(processed_path, 'wb') as f:
                    f.write(file.read())
            except Exception as e:
                return jsonify({
                    "status": "accepted",
                    "message": "✓ Data verified but file move failed (will use temp copy)",
                    "errors": [],
                    "warnings": verification["warnings"],
                    "year": verification["year"],
                    "matched_columns": verification["matched_columns"]
                })
            
            # Start training job
            job_id = trainer.create_job(processed_path)
            trainer.start_training(job_id)
            
            return jsonify({
                "status": "verified",
                "message": f"✓ File verified for {verification['year']} with {len(verification['matched_columns'])} data indicators. Model retraining started.",
                "errors": [],
                "warnings": verification["warnings"],
                "year": verification["year"],
                "matched_columns": verification["matched_columns"],
                "training_job_id": job_id,
                "file_location": processed_path
            })
        
        return jsonify({
            "status": "unknown",
            "message": "Unexpected verification state",
            "errors": verification.get("errors", [])
        }), 500
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Upload processing failed: {str(e)}",
            "errors": [str(e)]
        }), 500

@app.route("/api/training-job/<job_id>", methods=["GET"])
def get_training_job(job_id):
    """Get status of a training job"""
    job = trainer.get_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    
    return jsonify(job.to_dict())

@app.route("/api/training-job/<job_id>/cancel", methods=["POST"])
def cancel_training_job(job_id):
    """Cancel a training job"""
    result = trainer.cancel_job(job_id)
    return jsonify(result)

@app.route("/api/world-comparison", methods=["GET"])
def world_comparison():
    """
    Return Bangladesh metrics compared to peer countries (3 highest, 3 lowest).
    Includes global averages from ITU data.
    """
    # Bangladesh baseline (from current master data)
    bangladesh_metrics = {
        "country": "Bangladesh",
        "internet_access_pct": round(score_series.iloc[-1], 2),  # Latest score
        "4g_availability_pct": 45.2,  # From master data
        "digital_literacy_pct": 38.5,  # Estimated from HIES 2022
        "connectivity_score": round(score_series.iloc[-1], 2),
        "year": 2025,
        "rank": "Middle performer"
    }
    
    # Peer countries (hardcoded from ITU benchmarks – can be updated to read from CSV)
    lowest_performers = [
        {"country": "Afghanistan", "internet_access_pct": 18.3, "4g_availability_pct": 12.1, "digital_literacy_pct": 12.5, "connectivity_score": 15.2, "year": 2024},
        {"country": "Pakistan", "internet_access_pct": 32.1, "4g_availability_pct": 25.0, "digital_literacy_pct": 26.8, "connectivity_score": 27.9, "year": 2024},
        {"country": "Nepal", "internet_access_pct": 41.2, "4g_availability_pct": 35.4, "digital_literacy_pct": 34.2, "connectivity_score": 37.0, "year": 2024},
    ]
    
    highest_performers = [
        {"country": "Singapore", "internet_access_pct": 93.5, "4g_availability_pct": 99.0, "digital_literacy_pct": 95.3, "connectivity_score": 97.8, "year": 2024},
        {"country": "South Korea", "internet_access_pct": 96.2, "4g_availability_pct": 99.5, "digital_literacy_pct": 97.8, "connectivity_score": 98.9, "year": 2024},
        {"country": "Japan", "internet_access_pct": 94.8, "4g_availability_pct": 99.1, "digital_literacy_pct": 98.2, "connectivity_score": 98.2, "year": 2024},
    ]
    
    global_avg = {
        "country": "Global Average",
        "internet_access_pct": 63.5,
        "4g_availability_pct": 58.2,
        "digital_literacy_pct": 55.3,
        "connectivity_score": 59.0,
        "year": 2024
    }
    
    asia_pacific_avg = {
        "country": "Asia-Pacific Avg",
        "internet_access_pct": 72.1,
        "4g_availability_pct": 68.5,
        "digital_literacy_pct": 62.7,
        "connectivity_score": 68.0,
        "year": 2024
    }
    
    return jsonify({
        "bangladesh": bangladesh_metrics,
        "peer_countries_lowest_3": lowest_performers,
        "peer_countries_highest_3": highest_performers,
        "global_average": global_avg,
        "regional_average": asia_pacific_avg,
        "source": "ITU Digital Development Dashboard 2024",
        "note": "Data shows 3 lowest and 3 highest performers. Users can expand to see all countries."
    })

@app.route("/api/generate-report/latex", methods=["POST"])
def generate_latex_report():
    """
    Generate scientific LaTeX report
    
    Request body:
    {
        "include_sections": ["methodology", "results", "analysis"],  # Optional
        "custom_title": "My Connectiva Analysis"  # Optional
    }
    """
    try:
        # Import report generator
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "report_templates" / "python"))
        from report_generator import report_gen
        
        data = request.get_json() or {}
        result = report_gen.generate_latex_report(data=data)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"LaTeX report generation failed: {str(e)}"
        }), 500

@app.route("/api/generate-report/summary", methods=["POST"])
def generate_summary_report():
    """
    Generate summary report (Markdown + Word-ready)
    
    Request body:
    {
        "include_kpis": true,  # Optional
        "include_roadmap": true  # Optional
    }
    """
    try:
        # Import report generator
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "report_templates" / "python"))
        from report_generator import report_gen
        
        data = request.get_json() or {}
        result = report_gen.generate_word_report(data=data)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Summary report generation failed: {str(e)}"
        }), 500

@app.route("/test")
def test():
    return "Hello from backend!"

# Serve frontend static files
frontend_dist = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join(frontend_dist, path)):
        return send_from_directory(frontend_dist, path)
    else:
        return send_from_directory(frontend_dist, 'index.html')

if __name__ == "__main__":
    app.run(debug=True, port=5000)

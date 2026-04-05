"""
!STEP 1 — CONNECTIVA DATA MERGER
================================
Run this LOCALLY on your machine before uploading to Google Colab.

HOW TO RUN:
    cd /home/oliul-taj/Downloads/connectiva/
    python STEP1_merge_all_data.py

OUTPUT FILES (in /home/oliul-taj/Downloads/connectiva/processed/):
    ├── bangladesh_itu_master.csv      ← all ITU indicators for Bangladesh
    ├── all_countries_itu_master.csv   ← all countries (for benchmarking)
    ├── division_master.csv            ← BTRC + HIES division data
    └── data_inventory.csv             ← what indicators you have, which years
"""

import os, glob
import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

# ── PATHS ────────────────────────────────────────────────────────────────────
RAW_DIR     = '/home/oliul-taj/Downloads/connectiva/raw_data'
OTHER_DIR   = '/home/oliul-taj/Downloads/connectiva'
OUTPUT_DIR  = '/home/oliul-taj/Downloads/connectiva/processed'
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("=" * 60)
print("  CONNECTIVA — Step 1: Merging All Data Sources")
print("=" * 60)

# ── 1A. MERGE ALL 190+ ITU CSVs ──────────────────────────────────────────────
print("\n[1A] Scanning for CSV files...")

csv_files = (
    glob.glob(os.path.join(RAW_DIR, '**/*.csv'), recursive=True) +
    glob.glob(os.path.join(RAW_DIR, '*.csv'))
)
# Deduplicate
csv_files = list(set(csv_files))
print(f"     Found {len(csv_files)} CSV files")

EXPECTED_COLS = ['seriesID','seriesCode','seriesName','entityIso',
                 'entityName','dataValue','dataYear']

frames = []
skipped = []
for i, f in enumerate(csv_files):
    try:
        df = pd.read_csv(f, encoding='utf-8-sig', low_memory=False)
        # Normalise column names (strip BOM, whitespace, quotes)
        df.columns = [c.strip().strip('"').lstrip('\ufeff') for c in df.columns]
        # Check it has the expected ITU schema
        if 'entityIso' in df.columns and 'dataValue' in df.columns:
            df['source_file'] = os.path.basename(f)
            frames.append(df)
        else:
            skipped.append(os.path.basename(f))
    except Exception as e:
        skipped.append(f"{os.path.basename(f)} ({e})")

print(f"     Merged: {len(frames)} files  |  Skipped: {len(skipped)} files")
if skipped:
    print(f"     Skipped files: {skipped[:5]}{'...' if len(skipped)>5 else ''}")

if not frames:
    print("ERROR: No valid ITU CSVs found. Check RAW_DIR path.")
    exit(1)

itu_all = pd.concat(frames, ignore_index=True)
itu_all['dataValue'] = pd.to_numeric(itu_all['dataValue'], errors='coerce')
print(f"\n     Total rows (all countries): {len(itu_all):,}")
print(f"     Unique indicators:          {itu_all['seriesName'].nunique()}")
print(f"     Unique countries:           {itu_all['entityIso'].nunique()}")
print(f"     Year range:                 {int(itu_all['dataYear'].min())} – {int(itu_all['dataYear'].max())}")

# Save all-country master (for benchmarking against peers like India, Sri Lanka)
itu_all.to_csv(os.path.join(OUTPUT_DIR, 'all_countries_itu_master.csv'), index=False)
print(f"\n     Saved → all_countries_itu_master.csv")

# ── 1B. FILTER BANGLADESH ────────────────────────────────────────────────────
print("\n[1B] Filtering Bangladesh (ISO: BGD)...")
itu_bgd = itu_all[itu_all['entityIso'] == 'BGD'].copy()
print(f"     Bangladesh rows:       {len(itu_bgd):,}")
print(f"     Bangladesh indicators: {itu_bgd['seriesName'].nunique()}")

# Wide pivot: one row per year, one column per indicator
itu_bgd_wide = (
    itu_bgd.groupby(['dataYear','seriesName'])['dataValue']
    .first()
    .unstack('seriesName')
    .reset_index()
)
itu_bgd_wide.columns.name = None
itu_bgd_wide = itu_bgd_wide.sort_values('dataYear').reset_index(drop=True)
itu_bgd_wide.to_csv(os.path.join(OUTPUT_DIR, 'bangladesh_itu_master.csv'), index=False)
print(f"     Saved → bangladesh_itu_master.csv  ({itu_bgd_wide.shape[0]} years × {itu_bgd_wide.shape[1]} cols)")

# ── 1C. DATA INVENTORY ───────────────────────────────────────────────────────
print("\n[1C] Building data inventory...")
inventory = (
    itu_bgd.groupby('seriesName')
    .agg(
        series_code=('seriesCode','first'),
        units=('seriesUnits','first'),
        first_year=('dataYear','min'),
        last_year=('dataYear','max'),
        n_years=('dataYear','count'),
        last_value=('dataValue', lambda x: x.dropna().iloc[-1] if len(x.dropna())>0 else None),
        has_2024=('dataYear', lambda x: 2024 in x.values),
    )
    .reset_index()
    .sort_values('n_years', ascending=False)
)
inventory.to_csv(os.path.join(OUTPUT_DIR, 'data_inventory.csv'), index=False)
print(f"     Saved → data_inventory.csv  ({len(inventory)} indicators)")
print("\n     Top 20 indicators by data coverage:")
print(inventory[['seriesName','units','first_year','last_year','n_years','last_value']]
      .head(20).to_string(index=False))

# ── 1D. BTRC DIVISION DATA ────────────────────────────────────────────────────

print("\n[1D] Processing BTRC Excel...")

import openpyxl
btrc_path = os.path.join('.', 'summary_BTRC_division wise subscribers.xlsx')

if not os.path.exists(btrc_path):
    # Try searching for it
    import glob as gl
    found = gl.glob(os.path.join('.', '**/*BTRC*division*.xlsx'), recursive=True)
    if found:
        btrc_path = found[0]

if os.path.exists(btrc_path):
    try:
        wb = openpyxl.load_workbook(btrc_path, read_only=True)
        print(f"     Loaded: {btrc_path}")
        print(f"     Sheets: {wb.sheetnames}")

        DIVISIONS = ['Barishal','Chattogram','Dhaka','Khulna',
                      'Mymensingh','Rajshahi','Rangpur','Sylhet']
        TECHS = ['2G','3G','4G']

        def parse_summary_sheet(ws):
            """Parse 'Mobile Subscribers' or 'Internet Subscriber' sheets"""
            rows = list(ws.iter_rows(min_row=1, max_row=20, values_only=True))
            # Find the header rows (Operator row and tech row)
            op_row = None
            tech_row = None
            data_start = None
            for i, row in enumerate(rows):
                if row and row[0] and str(row[0]).strip().lower().startswith('operator'):
                    op_row = i
                if row and any(str(c).strip() in ['2G','2G ','2G  '] for c in row if c):
                    tech_row = i
                    data_start = i + 1
                    break

            if tech_row is None:
                return {}

            # Build column mapping: (division, tech) -> col_index
            div_row = rows[op_row] if op_row is not None else rows[tech_row - 1]
            tech_r = rows[tech_row]

            col_map = {}
            current_div = None
            for col_idx in range(len(tech_r)):
                if div_row and col_idx < len(div_row) and div_row[col_idx]:
                    current_div = str(div_row[col_idx]).strip()
                if tech_r[col_idx]:
                    tech = str(tech_r[col_idx]).strip().upper()
                    if tech in ['2G','3G','4G'] and current_div:
                        col_map[col_idx] = (current_div, tech)

            # Parse data rows
            out = {}
            for i in range(data_start, len(rows)):
                row = rows[i]
                if not row or not row[0]:
                    continue
                operator = str(row[0]).strip()
                for col_idx, (div, tech) in col_map.items():
                    val = row[col_idx] if col_idx < len(row) else None
                    if isinstance(val, str):
                        val = val.replace('\xa0','').replace(',','').strip()
                        try:
                            val = float(val)
                        except:
                            val = np.nan
                    elif val is None:
                        val = np.nan
                    else:
                        val = float(val)
                    out.setdefault(div, {}).setdefault(tech, {})[operator] = val
            return out

        mob = parse_summary_sheet(wb['Mobile Subscribers'])
        net = parse_summary_sheet(wb['Internet Subscriber'])

        rows_out = []
        for div in DIVISIONS:
            row = {'division': div}
            for t in TECHS:
                mv = [v for v in mob.get(div, {}).get(t, {}).values()
                      if isinstance(v, float) and not np.isnan(v)]
                nv = [v for v in net.get(div, {}).get(t, {}).values()
                      if isinstance(v, float) and not np.isnan(v)]
                row[f'mobile_{t}'] = sum(mv)
                row[f'internet_{t}'] = sum(nv)
            row['mobile_total'] = sum(row.get(f'mobile_{t}', 0) for t in TECHS)
            row['internet_total'] = sum(row.get(f'internet_{t}', 0) for t in TECHS)
            rows_out.append(row)

        btrc_df = pd.DataFrame(rows_out)
        btrc_out = os.path.join(OUTPUT_DIR, 'btrc_division_summary.csv')
        btrc_df.to_csv(btrc_out, index=False)
        print(f"     Saved → btrc_division_summary.csv  ({len(btrc_df)} divisions)")
        print(btrc_df.to_string(index=False))
        wb.close()

    except Exception as e:
        print(f"     ⚠ BTRC processing error: {e}")
        import traceback
        traceback.print_exc()
else:
    print(f"     ⚠ BTRC file not found. Skipping.")

# ── 1E. HIES 2022 (from PDF — pre-extracted key tables) ──────────────────────
print("\n[1E] Writing HIES 2022 division-level data (BBS 2023 PDF extract)...")
# Source: HIES 2022 Final Report, Bangladesh Bureau of Statistics
# Tables: 3.5 (facilities), 4.5 (income), 6.5 (poverty), 7.1 (literacy)
hies = pd.DataFrame({
    'division':            ['Barishal','Chattogram','Dhaka','Khulna',
                            'Mymensingh','Rajshahi','Rangpur','Sylhet'],
    # Table 7.1 — Literacy rate (7 years and above), 2022
    'literacy_rate_pct':   [74.3, 75.8, 78.6, 74.1, 61.7, 72.1, 68.4, 69.5],
    # Table 6.5 — Headcount poverty rate (upper poverty line), 2022
    'poverty_rate_pct':    [26.9, 18.0, 14.5, 13.8, 21.0, 16.0, 22.0, 12.5],
    # Table 4.5 — Average monthly household income (BDT), 2022
    'monthly_hh_income_bdt':[25892,34054,42696,28192,24183,30398,21674,22861],
    # Table 3.5 — Household internet access (%), 2022
    'internet_access_pct': [53.2, 62.4, 80.5, 62.1, 45.8, 55.3, 45.45, 58.7],
    # Table 3.5 — Mobile phone access (%), 2022
    'mobile_phone_pct':    [97.8, 98.5, 99.22,97.9, 96.77,97.6, 97.2, 98.1],
    # Table 3.5 — Computer access (%), 2022
    'computer_pct':        [4.1,  8.2,  14.26, 7.3, 2.99,  5.8, 4.2,  5.1],
    # BBS Population Projection 2022 (millions)
    'population_million':  [9.5,  33.1, 44.7, 16.3, 13.0, 20.3, 17.9, 11.5],
    # Gender digital gap (female–male mobile use gap %, estimated from HIES + GSMA)
    'gender_gap_pct':      [8.2,  5.1,  3.4,  6.3,  9.8,  7.1,  8.9,  6.7],
})
hies.to_csv(os.path.join(OUTPUT_DIR, 'hies_2022_division.csv'), index=False)
print(f"     Saved → hies_2022_division.csv")

# ── 1F. BENCHMARK COUNTRIES (same region) ────────────────────────────────────
print("\n[1F] Extracting regional benchmark countries...")
peers = ['IND','PAK','LKA','NPL','MMR','THA','VNM','BGD']
peer_df = itu_all[itu_all['entityIso'].isin(peers)].copy()
peer_df.to_csv(os.path.join(OUTPUT_DIR, 'peer_countries_itu.csv'), index=False)
print(f"     Saved → peer_countries_itu.csv ({len(peer_df):,} rows)")

# ── SUMMARY ──────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("  STEP 1 COMPLETE — Files saved to:")
print(f"  {OUTPUT_DIR}")
print("=" * 60)
print("\n  Next: Upload these to Google Colab:")
print("    1. processed/bangladesh_itu_master.csv")
print("    2. processed/btrc_division_subs.csv")
print("    3. processed/hies_2022_division.csv")
print("    4. processed/data_inventory.csv")
print("    5. processed/peer_countries_itu.csv")
print("    6. summary_BTRC_division_wise_subscribers.xlsx")
print("    7. hies_2022.pdf  (optional, for deeper extraction)")
print("\n  Then run: STEP2_colab_ml_pipeline.ipynb\n")

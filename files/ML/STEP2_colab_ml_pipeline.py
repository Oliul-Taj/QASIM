# ============================================================================
# CONNECTIVA — STEP 2: ML PIPELINE (Google Colab)
# ITU UMC Data Hackathon 2025 | Team: Connectiva | Bangladesh
# ============================================================================
# HOW TO USE IN GOOGLE COLAB:
#   1. Upload the 5 processed CSVs from Step 1 to Colab (Files panel)
#   2. Paste each cell block into a new Colab cell
#   3. Run top to bottom
# ============================================================================

# ─────────────────────────────────────────────
# CELL 1: Install dependencies
# ─────────────────────────────────────────────
# !pip install pandas numpy scikit-learn plotly folium geopandas requests -q

# ─────────────────────────────────────────────
# CELL 2: Imports
# ─────────────────────────────────────────────
import pandas as pd
import numpy as np
import json, warnings
warnings.filterwarnings('ignore')

from sklearn.preprocessing import MinMaxScaler
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import LeaveOneOut, cross_val_score
from sklearn.metrics import mean_squared_error

print("Libraries loaded ✓")

# ─────────────────────────────────────────────
# CELL 3: Load processed data
# ─────────────────────────────────────────────
# If running locally, adjust paths:
BGD_ITU   = 'processed/bangladesh_itu_master.csv'
BTRC_DIV  = 'processed/btrc_division_summary.csv'
HIES_DIV  = 'processed/hies_2022_division.csv'
PEER_ITU  = 'processed/peer_countries_itu.csv'
INVENTORY = 'processed/data_inventory.csv'

bgd_itu  = pd.read_csv(BGD_ITU)
btrc_df  = pd.read_csv(BTRC_DIV)
hies_df  = pd.read_csv(HIES_DIV)

print(f"ITU Bangladesh: {bgd_itu.shape[0]} years × {bgd_itu.shape[1]} indicators")
print(f"BTRC divisions: {btrc_df.shape}")
print(f"HIES divisions: {hies_df.shape}")

# ─────────────────────────────────────────────
# CELL 4: Feature engineering
# ─────────────────────────────────────────────

BASKET_BDT = 170   # 5GB mobile broadband basket price (BDT) — ITU 2025

def build_division_features(hies_df, btrc_df, basket_bdt=BASKET_BDT):
    """
    Merge HIES + BTRC → compute all derived features.
    All features are documented with their data source.
    """
    df = hies_df.merge(btrc_df, on='division', how='left')
    
    # Fix column names: BTRC has 'internet_total' but script expects 'total_internet'
    rename_map = {
        'internet_total': 'total_internet',
        'mobile_total': 'total_mobile',
        'internet_2G': 'internet_2G',
        'internet_3G': 'internet_3G',
        'internet_4G': 'internet_4G',
        'mobile_2G': 'mobile_2G',
        'mobile_3G': 'mobile_3G',
        'mobile_4G': 'mobile_4G',
    }
    df = df.rename(columns=rename_map)

    # ── Derived connectivity features ────────────────────────────
    df['internet_penetration_pct'] = (
        df['total_internet'] / (df['population_million'] * 1e6) * 100)

    df['mobile_penetration_pct'] = (
        df['total_mobile'] / (df['population_million'] * 1e6) * 100)

    # Usage gap = mobile subscribers who are NOT internet users
    df['usage_gap_pct'] = (
        (df['total_mobile'] - df['total_internet']) /
        df['total_mobile'] * 100).clip(lower=0)

    # 4G adoption among internet users
    df['pct_4G_internet'] = df['internet_4G'] / df['total_internet'] * 100

    # 2G still-active ratio = proxy for infrastructure quality lag
    df['pct_2G_mobile'] = df['mobile_2G'] / df['total_mobile'] * 100

    # ── Affordability feature ─────────────────────────────────────
    df['monthly_income_bdt']       = df['monthly_hh_income_bdt']
    df['affordability_pct_income'] = basket_bdt / df['monthly_income_bdt'] * 100
    # ITU threshold: <2% GNI per capita = affordable. >5% = unaffordable
    df['affordability_flag'] = df['affordability_pct_income'].apply(
        lambda x: 'Unaffordable' if x > 5 else ('Borderline' if x > 2 else 'Affordable'))

    # ── Quality-Affordability Trap Index (derived token) ──────────
    # When signal quality is poor AND cost is high → compound disadvantage
    # Normalised so higher = worse trap
    qa_cost   = MinMaxScaler().fit_transform(df[['affordability_pct_income']])
    qa_quality = 1 - MinMaxScaler().fit_transform(df[['pct_4G_internet']])
    df['QA_trap_index'] = (qa_cost.flatten() * qa_quality.flatten())

    # ── Gender digital gap (from HIES + GSMA estimates) ──────────
    # Already in hies_df as gender_gap_pct

    return df


df = build_division_features(hies_df, btrc_df)
print("\nFeature matrix built:")
print(df[['division','internet_access_pct','pct_4G_internet',
          'affordability_pct_income','usage_gap_pct','QA_trap_index']].round(2).to_string(index=False))

# ─────────────────────────────────────────────
# CELL 5: Compute Digital Divide Index (DDI)
# ─────────────────────────────────────────────

def compute_ddi(df, weights=None):
    """
    Composite Digital Divide Index (DDI).
    Score 0–1: higher = less divided = better.

    Components and default weights (tunable by the model):
      internet_access_pct      0.28  — % households with internet (HIES 2022)
      literacy_rate_pct        0.20  — general literacy, proxy for digital readiness
      pct_4G_internet          0.18  — quality of connectivity (4G share)
      monthly_income_normalised 0.14 — income capacity to afford devices + data
      affordability_inv         0.12 — 1/(cost burden) — inverted so higher=better
      computer_pct              0.05 — device ownership
      gender_gap_inv            0.03 — 1/gender_gap so higher=smaller gap=better
    """
    if weights is None:
        weights = {
            'internet_access_pct':  0.28,
            'literacy_rate_pct':    0.20,
            'pct_4G_internet':      0.18,
            'monthly_income_bdt':   0.14,
            'affordability_inv':    0.12,
            'computer_pct':         0.05,
            'gender_gap_inv':       0.03,
        }

    scaler = MinMaxScaler()
    normed = df[['internet_access_pct','literacy_rate_pct','pct_4G_internet',
                 'monthly_income_bdt','computer_pct']].copy()

    # Normalise positive indicators
    for col in normed.columns:
        normed[col] = scaler.fit_transform(df[[col]])

    # Invert cost (lower cost = better)
    normed['affordability_inv'] = (
        1 - scaler.fit_transform(df[['affordability_pct_income']]))

    # Invert gender gap (smaller gap = better)
    normed['gender_gap_inv'] = (
        1 - scaler.fit_transform(df[['gender_gap_pct']]))

    cols   = list(weights.keys())
    w_arr  = np.array([weights[c] for c in cols])
    df['DDI_score'] = normed[cols].values.dot(w_arr)
    df['DDI_pct']   = (df['DDI_score'] * 100).round(1)
    return df, weights


df, ddi_weights = compute_ddi(df)

# Tri-color classification
def classify_status(score, low=0.33, high=0.60):
    if score < low:   return 'Red'
    elif score < high: return 'Yellow'
    else:              return 'Green'

df['status'] = df['DDI_score'].apply(classify_status)

print("\nDivision DDI Scores (all inputs):")
print("-" * 60)
for _, row in df.sort_values('DDI_score').iterrows():
    bar = '█' * int(row['DDI_score'] * 30)
    color = {'Red':'🔴','Yellow':'🟡','Green':'🟢'}[row['status']]
    print(f"  {color} {row['division']:<14} {bar:<30} {row['DDI_score']:.3f}")

# ─────────────────────────────────────────────
# CELL 6: ML model — learn MVT weights from data
# ─────────────────────────────────────────────

FEATURE_COLS = [
    'internet_access_pct',      # primary access
    'literacy_rate_pct',        # human capital
    'pct_4G_internet',          # quality
    'affordability_pct_income', # cost burden
    'internet_penetration_pct', # actual use
    'monthly_income_bdt',       # income capacity
    'computer_pct',             # device ownership
    'poverty_rate_pct',         # structural poverty
    'usage_gap_pct',            # coverage vs usage gap
    'QA_trap_index',            # compound quality-affordability trap
    'gender_gap_pct',           # gender exclusion
    'pct_2G_mobile',            # infrastructure age
]

X = df[FEATURE_COLS].fillna(df[FEATURE_COLS].mean()).values
y = df['DDI_score'].values

# Random Forest (best for small N = 8 divisions)
rf = RandomForestRegressor(
    n_estimators=1000,
    max_features='sqrt',
    min_samples_leaf=1,
    random_state=42
)
rf.fit(X, y)

# Leave-One-Out cross validation
loo   = LeaveOneOut()
preds = cross_val_score(rf, X, y, cv=loo, scoring='r2')
print(f"\nModel R² (LOO-CV): {preds.mean():.3f}")

# MVT weights from feature importances
importances = pd.Series(rf.feature_importances_, index=FEATURE_COLS)
importances = importances.sort_values(ascending=False)

print("\nMost Valuable Tokens (MVT Weights):")
print("-" * 45)
for feat, imp in importances.items():
    bar = '█' * int(imp * 80)
    print(f"  {feat:<35} {bar:<15} {imp:.4f}")

# ─────────────────────────────────────────────
# CELL 7: PID Controller class
# ─────────────────────────────────────────────

class PIDController:
    """
    Proportional-Integral-Derivative controller.

    Prevents 'policy shock' — instead of saying
    'jump from 30% to 80% internet coverage immediately',
    the PID smooths this into realistic annual steps.

    Parameters (tuned for socio-economic systems):
      Kp = 0.40  — react proportionally to gap size
      Ki = 0.08  — accumulate correction over time
      Kd = 0.15  — dampen oscillation (prevents overshooting)
    """
    def __init__(self, Kp=0.40, Ki=0.08, Kd=0.15, target=0.70):
        self.Kp, self.Ki, self.Kd = Kp, Ki, Kd
        self.target   = target
        self.integral = 0.0
        self.prev_err = 0.0

    def step(self, current):
        error         = self.target - current
        self.integral += error
        derivative    = error - self.prev_err
        self.prev_err = error
        output = (self.Kp * error +
                  self.Ki * self.integral +
                  self.Kd * derivative)
        return max(0, output), error

    def reset(self, target):
        self.target   = target
        self.integral = 0.0
        self.prev_err = 0.0


# ─────────────────────────────────────────────
# CELL 8: Reverse-engineer policy per division
# ─────────────────────────────────────────────

# TOKEN → POLICY ACTION MAPPING
# Each token maps to concrete, implementable actions
TOKEN_ACTIONS = {
    'internet_access_pct': {
        'label':   'Expand Broadband Coverage',
        'actions': [
            'Deploy community WiFi hotspots at union parishad offices',
            'Extend SOF (Social Obligation Fund) subsidies to red zones',
            'License District Fixed Telecom operators (BTRC Policy 2025 §7.4.7)',
        ],
        'cost_category': 'Infrastructure',
        'implementing_agency': 'BTRC / MoPTIT',
    },
    'literacy_rate_pct': {
        'label':   'Digital Literacy Programs',
        'actions': [
            'Union Digital Centers (UDC) activation for digital skills',
            'School connectivity program — link ICT labs to fiber backbone',
            'Women-targeted digital literacy (a2i Sheikh Russell Labs)',
        ],
        'cost_category': 'Human Capital',
        'implementing_agency': 'MoE / a2i',
    },
    'pct_4G_internet': {
        'label':   'Network Quality Upgrade',
        'actions': [
            'Enforce BTRC tower fiberization targets: 50% in 18 months (§11.2.5)',
            'Mandate 4G rollout in red-zone upazilas',
            'Spectrum-based incentives for rural 4G deployment (§11.2.1)',
        ],
        'cost_category': 'Infrastructure',
        'implementing_agency': 'BTRC / Operators',
    },
    'affordability_pct_income': {
        'label':   'Reduce Data Cost Burden',
        'actions': [
            'Zero-rate government e-services (e-GP, health portals)',
            'Reduce supplementary duty on handset imports (§7 BTRC 2025)',
            'Target 5GB basket < 2% GNI per capita (ITU threshold)',
        ],
        'cost_category': 'Policy / Regulatory',
        'implementing_agency': 'NBR / MoF / BTRC',
    },
    'computer_pct': {
        'label':   'Device Access Program',
        'actions': [
            'Mobile money–linked smartphone financing scheme',
            'Refurbished device distribution via union offices',
            'Low-cost tablet program for students (rural districts)',
        ],
        'cost_category': 'Device Subsidy',
        'implementing_agency': 'MoPTIT / Banks',
    },
    'gender_gap_pct': {
        'label':   'Gender Digital Inclusion',
        'actions': [
            'Women-only digital skill centers at UDCs',
            'Female-friendly mobile internet bundles',
            'Community Digital Literacy Champions (female-led)',
        ],
        'cost_category': 'Social',
        'implementing_agency': 'MoWCA / a2i',
    },
    'usage_gap_pct': {
        'label':   'Convert Coverage to Usage',
        'actions': [
            'Awareness campaigns: digital services in Bangla',
            'Relevant local-language content development',
            'mAgri, mHealth, mFinance service promotion in rural areas',
        ],
        'cost_category': 'Demand Creation',
        'implementing_agency': 'a2i / MoICT',
    },
}

MAX_ANNUAL_DDI_GAIN = 0.09   # realistic max improvement per year
STATUS_THRESHOLDS   = {'low': 0.33, 'high': 0.60}

def reverse_engineer_policy(division_name, df, target_pct_reduction,
                             years, importances):
    """
    Main engine: given a division and user inputs (% gap reduction, years),
    compute the PID-smoothed trajectory and reverse-engineer annual actions.

    Parameters
    ----------
    division_name      : str   e.g. 'Rangpur'
    df                 : DataFrame with DDI_score per division
    target_pct_reduction: float  e.g. 40 means 'reduce divide by 40%'
    years              : int   e.g. 5
    importances        : Series of MVT weights from RF model

    Returns
    -------
    trajectory : DataFrame  year-by-year DDI + status
    actions    : list of dicts  year-by-year policy steps (plain language)
    """
    row     = df[df['division'] == division_name].iloc[0]
    current = float(row['DDI_score'])
    gap     = 1.0 - current   # gap to perfect score
    target  = current + gap * (target_pct_reduction / 100)
    target  = min(target, 0.95)

    pid = PIDController(target=target)
    trajectory = []
    all_actions = []

    # Scale token sensitivities by MVT importance (from RF model)
    top_tokens = [t for t in TOKEN_ACTIONS.keys() if t in importances.index]
    token_imps = importances[top_tokens]
    token_imps = token_imps / token_imps.sum()  # normalise

    for yr in range(1, years + 1):
        output, error = pid.step(current)
        improvement   = min(output * 0.20, MAX_ANNUAL_DDI_GAIN)
        current       = min(current + improvement, 0.95)

        status = classify_status(current,
                                 STATUS_THRESHOLDS['low'],
                                 STATUS_THRESHOLDS['high'])

        # Reverse-engineer: allocate PID output proportionally across tokens
        year_policy = {
            'year':      yr,
            'DDI_score': round(current, 3),
            'DDI_pct':   round(current * 100, 1),
            'error':     round(error, 3),
            'status':    status,
            'token_steps': [],
        }
        for token, imp in token_imps.items():
            delta       = round(float(output) * float(imp) * 10, 2)
            token_info  = TOKEN_ACTIONS[token]
            # Select most impactful action for this year
            # (early years: infrastructure; later years: skills + demand)
            action_idx  = min(yr - 1, len(token_info['actions']) - 1)
            year_policy['token_steps'].append({
                'token':    token,
                'label':    token_info['label'],
                'delta':    delta,
                'priority': 'High' if imp >= 0.20 else
                            ('Medium' if imp >= 0.10 else 'Low'),
                'action':   token_info['actions'][action_idx],
                'agency':   token_info['implementing_agency'],
                'cost_cat': token_info['cost_category'],
            })

        trajectory.append({
            'year':      yr,
            'DDI_score': round(current, 3),
            'DDI_pct':   round(current * 100, 1),
            'status':    status,
            'target':    round(target, 3),
        })
        all_actions.append(year_policy)

    return pd.DataFrame(trajectory), all_actions


# ─────────────────────────────────────────────
# CELL 9: Main function — runs on user input
# ─────────────────────────────────────────────

def run_optimization(target_pct_reduction, years, df=df, importances=importances):
    """
    THIS IS THE FUNCTION THE GUI CALLS.

    Parameters
    ----------
    target_pct_reduction : float  — from GUI slider, e.g. 40.0 (= 40%)
    years                : int    — from GUI input, e.g. 5

    Returns
    -------
    results : dict  — everything the dashboard needs
        {
          'division_map_data': [...],   # for choropleth map
          'trajectories':      {...},   # per-division PID trajectory
          'policy_cards':      {...},   # plain-language actions per division
          'national_summary':  {...},   # aggregate stats
        }
    """
    results = {
        'input': {
            'target_pct_reduction': target_pct_reduction,
            'years': years,
        },
        'division_map_data': [],
        'trajectories': {},
        'policy_cards': {},
    }

    for div in df['division'].tolist():
        row    = df[df['division'] == div].iloc[0]
        traj, acts = reverse_engineer_policy(
            div, df, target_pct_reduction, years, importances)

        final = traj.iloc[-1]
        results['division_map_data'].append({
            'division':         div,
            'current_DDI':      round(float(row['DDI_score']), 3),
            'current_status':   row['status'],
            'target_DDI':       final['target'],
            'projected_DDI':    final['DDI_score'],
            'projected_status': final['status'],
            # Beneficiary counts (estimated from population share)
            'population':       float(row['population_million']) * 1e6,
            'beneficiaries_est': int(
                float(row['population_million']) * 1e6 *
                (target_pct_reduction / 100) * (1 - float(row['DDI_score']))),
            # Key indicators (shown on hover in map)
            'internet_access_pct':     round(float(row['internet_access_pct']), 1),
            'literacy_rate':           round(float(row['literacy_rate_pct']), 1),
            'pct_4G':                  round(float(row['pct_4G_internet']), 1),
            'affordability_pct_income':round(float(row['affordability_pct_income']), 1),
            'monthly_income_bdt':      int(row['monthly_income_bdt']),
        })
        results['trajectories'][div]  = traj.to_dict('records')
        results['policy_cards'][div]  = acts

    # National summary
    total_beneficiaries = sum(
        d['beneficiaries_est'] for d in results['division_map_data'])
    red_count    = sum(1 for d in results['division_map_data'] if d['current_status'] == 'Red')
    yellow_count = sum(1 for d in results['division_map_data'] if d['current_status'] == 'Yellow')
    green_count  = sum(1 for d in results['division_map_data'] if d['current_status'] == 'Green')

    results['national_summary'] = {
        'total_estimated_beneficiaries': total_beneficiaries,
        'divisions_red':    red_count,
        'divisions_yellow': yellow_count,
        'divisions_green':  green_count,
        'target_pct':       target_pct_reduction,
        'years':            years,
    }
    return results


# ─────────────────────────────────────────────
# CELL 10: Test with sample inputs
# ─────────────────────────────────────────────

print("=" * 50)
print("  TEST RUN: Reduce divide by 40% in 5 years")
print("=" * 50)

results = run_optimization(target_pct_reduction=40, years=5)

print(f"\nEstimated beneficiaries: {results['national_summary']['total_estimated_beneficiaries']:,}")
print(f"Current Red zones:    {results['national_summary']['divisions_red']}")
print(f"Current Yellow zones: {results['national_summary']['divisions_yellow']}")
print(f"Current Green zones:  {results['national_summary']['divisions_green']}")

print("\nProjected status after 5 years:")
for d in results['division_map_data']:
    curr = {'Red':'🔴','Yellow':'🟡','Green':'🟢'}[d['current_status']]
    proj = {'Red':'🔴','Yellow':'🟡','Green':'🟢'}[d['projected_status']]
    arrow = '→'
    print(f"  {curr} {d['division']:<14} {d['current_DDI']:.3f} {arrow} {d['projected_DDI']:.3f} {proj}")

print("\nTop policy priorities for Rangpur (Year 1):")
rangpur_y1 = results['policy_cards']['Rangpur'][0]
for step in rangpur_y1['token_steps'][:4]:
    if step['priority'] in ['High','Medium']:
        print(f"  [{step['priority']}] {step['label']}")
        print(f"          ↳ {step['action']}")
        print(f"          ↳ Agency: {step['agency']}")

# ─────────────────────────────────────────────
# CELL 11: Save outputs for dashboard
# ─────────────────────────────────────────────

with open('dashboard_data.json', 'w') as f:
    json.dump(results, f, indent=2, default=str)

df.to_csv('division_features_full.csv', index=False)
importances.to_csv('mvt_weights.csv', header=True)

print("\n✓ Saved: dashboard_data.json")
print("✓ Saved: division_features_full.csv")
print("✓ Saved: mvt_weights.csv")
print("\nNext: Run STEP3_dashboard.py with these outputs.")

"""
ConnectivaNet v4 — District-Level ML with Leave-Division-Out CV
================================================================
WHY THIS IS DIFFERENT FROM v3:
  - v3 used random train/test split on 64 districts → data leakage,
    model memorises district patterns it will never generalise from
  - v4 uses Leave-Division-Out (LDO) cross-validation:
      Train on 7 divisions → Test on 1 held-out division (×8 folds)
      This tests: can the model predict districts in a NEVER-SEEN division?
      That is the real generalisation challenge.

  - v4 drops leaky features: digital_divide_score, pid_score_yr1/3/5
    Uses only RAW OBSERVABLE features that would exist for any new district

FEATURES USED (all independently observable):
  internet_access_pct       ← HIES 2022
  computer_access_pct       ← HIES 2022
  digital_literacy_proxy    ← derived from literacy + internet
  data_affordability_stress ← basket cost / HH income
  poverty_gap_proxy         ← BBS poverty data
  urban_pct                 ← BBS census
  population_million        ← BBS projection
  tower_count               ← BTRC BTS data
  tower_per_million         ← derived
  division_* (8 dummies)    ← division identity features

LABEL: status_color (RED=0, YELLOW=1, GREEN=2)
  Note: No GREEN in current data — model learns RED vs YELLOW boundary

Run:
  cp ~/Downloads/train_connectiva_v4.py ~/Downloads/connectiva/ML/
  cd ~/Downloads/connectiva/ML
  source ml_env/bin/activate
  python train_connectiva_v4.py

Outputs: ./model_output_v4/
"""

import pandas as pd
import numpy as np
import os, json, warnings, glob
warnings.filterwarnings('ignore')

from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, ExtraTreesClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, label_binarize
from sklearn.metrics import (f1_score, classification_report,
                             confusion_matrix, roc_auc_score, roc_curve, auc)
import xgboost as xgb
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import seaborn as sns
import joblib

# ── CONFIG ────────────────────────────────────────────────────
ML_DIR   = os.path.dirname(os.path.abspath(__file__))
FILES_DIR= os.path.join(os.path.dirname(ML_DIR), 'files')
OUT_DIR  = os.path.join(ML_DIR, 'model_output_v4')
os.makedirs(OUT_DIR, exist_ok=True)

LABEL_MAP   = {'RED': 0, 'YELLOW': 1, 'GREEN': 2}
LABEL_NAMES = ['Red (Critical)', 'Yellow (Transitioning)', 'Green (Target Met)']
COLORS      = ['#ef4444', '#f59e0b', '#10b981']
DIVISIONS   = ['Barishal','Chattogram','Dhaka','Khulna',
               'Mymensingh','Rajshahi','Rangpur','Sylhet']

# ── PATHS — try both ML/ and files/ locations ─────────────────
def find_file(filename_patterns):
    """Search ML_DIR and FILES_DIR for a file matching any pattern."""
    search_dirs = [ML_DIR, FILES_DIR,
                   os.path.join(os.path.dirname(ML_DIR), 'ML')]
    for d in search_dirs:
        for pat in filename_patterns:
            matches = glob.glob(os.path.join(d, pat))
            if matches:
                return matches[0]
    return None


# ══════════════════════════════════════════════════════════════
# MODULE 1: LOAD DATA
# ══════════════════════════════════════════════════════════════
print("=" * 62)
print("  ConnectivaNet v4 — Leave-Division-Out ML Pipeline")
print("=" * 62)

# ── 1a. District data (64 districts, primary) ────────────────
zilla_path = find_file(['zilla_digital_divide.csv', '*zilla*'])
if not zilla_path:
    print("FATAL: zilla_digital_divide.csv not found.")
    print(f"  Place it in: {ML_DIR}  or  {FILES_DIR}")
    exit(1)

zilla = pd.read_csv(zilla_path)
print(f"\n[1/6] Loaded district data: {zilla.shape[0]} districts")
print(f"  Label distribution: {zilla['status_color'].value_counts().to_dict()}")

# ── 1b. BTS tower data (district level) ──────────────────────
bts_path = find_file(['bts_districts.csv', '*bts_dist*'])
if bts_path:
    bts = pd.read_csv(bts_path)
    # Normalise district names for merge
    bts['district_key'] = bts['district'].str.strip().str.lower()
    zilla['district_key'] = zilla['district'].str.strip().str.lower()
    zilla = zilla.merge(bts[['district_key','tower_count']],
                        on='district_key', how='left')
    zilla['tower_count'] = zilla['tower_count'].fillna(
        zilla['tower_count'].median())
    print(f"  BTS towers merged. Missing: {zilla['tower_count'].isna().sum()}")
else:
    zilla['tower_count'] = 500  # national median fallback
    print("  BTS file not found — using median tower count fallback")

# ── 1c. Division-level features for enrichment ───────────────
div_path = find_file(['division_feature_matrix.csv','*division_feature*'])
div_df = pd.read_csv(div_path) if div_path else None
if div_df is not None:
    print(f"  Division feature matrix loaded: {div_df.shape}")


# ══════════════════════════════════════════════════════════════
# MODULE 2: FEATURE ENGINEERING
# ══════════════════════════════════════════════════════════════
print("\n[2/6] Engineering features...")

df = zilla.copy()

# Tower density (per million population)
df['tower_per_million'] = df['tower_count'] / df['population_million'].clip(lower=0.1)

# Rural-urban connectivity gap (from division data if available)
if div_df is not None:
    div_gap = div_df[['division','rural_urban_internet_gap',
                       '4G_share_pct','connectivity_quality_idx']].copy()
    df = df.merge(div_gap, on='division', how='left')
    print(f"  Division gap features merged.")

# Composite stress index (independent of divide_score)
df['composite_stress'] = (
    df['data_affordability_stress'] * 0.4 +
    df['poverty_gap_proxy'] * 0.3 +
    (100 - df['internet_access_pct']) / 100 * 0.3
)

# Digital readiness (inverse of barriers)
df['digital_readiness'] = (
    df['digital_literacy_proxy'] * 0.5 +
    df['internet_access_pct'] / 100 * 0.3 +
    df['computer_access_pct'] / 100 * 0.2
)

# Division dummy encoding (one-hot)
for div in DIVISIONS:
    df[f'div_{div.lower()}'] = (df['division'] == div).astype(int)

# ── CRITICAL: Drop leaky features ────────────────────────────
# digital_divide_score is computed from status_color — leakage
# pid_score_yr1/3/5 are forward projections computed from score — leakage
LEAKY_COLS = ['digital_divide_score', 'pid_score_yr1',
              'pid_score_yr3', 'pid_score_yr5',
              'district', 'district_key', 'division', 'status_color']

FEATURE_COLS = [c for c in df.columns
                if c not in LEAKY_COLS
                and df[c].dtype in [np.float64, np.int64, float, int]
                and df[c].std() > 0]

print(f"  Features used ({len(FEATURE_COLS)}): {FEATURE_COLS}")

X = df[FEATURE_COLS].fillna(df[FEATURE_COLS].median()).values
y = df['status_color'].map(LABEL_MAP).values
divisions_arr = df['division'].values

print(f"\n  X shape: {X.shape}")
print(f"  Label counts: { {LABEL_NAMES[i]: int((y==i).sum()) for i in np.unique(y)} }")


# ══════════════════════════════════════════════════════════════
# MODULE 3: LEAVE-DIVISION-OUT CROSS-VALIDATION
# ══════════════════════════════════════════════════════════════
print("\n[3/6] Leave-Division-Out Cross-Validation (8 folds)...")
print("  Each fold: train on 7 divisions, test on 1 held-out division")
print("  This tests TRUE generalisation to unseen geographic regions\n")

models = {
    'Random Forest': RandomForestClassifier(
        n_estimators=300, max_depth=6, min_samples_leaf=2,
        class_weight='balanced', random_state=42, n_jobs=-1),
    'XGBoost': xgb.XGBClassifier(
        n_estimators=300, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.7,
        min_child_weight=2, gamma=0.1,
        eval_metric='mlogloss', random_state=42, n_jobs=-1),
    'Extra Trees': ExtraTreesClassifier(
        n_estimators=300, max_depth=6, min_samples_leaf=2,
        class_weight='balanced', random_state=42, n_jobs=-1),
}

ldo_results = {name: {'preds':[], 'trues':[], 'probas':[]} for name in models}

for held_out_div in DIVISIONS:
    train_mask = divisions_arr != held_out_div
    test_mask  = divisions_arr == held_out_div

    X_train, X_test = X[train_mask], X[test_mask]
    y_train, y_test = y[train_mask], y[test_mask]

    scaler   = StandardScaler()
    X_tr_s   = scaler.fit_transform(X_train)
    X_te_s   = scaler.transform(X_test)

    n_test   = len(y_test)
    n_red    = (y_test == 0).sum()
    n_yellow = (y_test == 1).sum()
    print(f"  Fold [{held_out_div:>12}] — "
          f"test={n_test} districts (RED={n_red}, YELLOW={n_yellow})")

    for name, model in models.items():
        m = model.__class__(**model.get_params())
        m.fit(X_tr_s, y_train)
        preds  = m.predict(X_te_s)
        probas = m.predict_proba(X_te_s)
        # Pad probas to 3 classes if needed
        if probas.shape[1] < 3:
            pad = np.zeros((len(probas), 3 - probas.shape[1]))
            probas = np.hstack([probas, pad])
        ldo_results[name]['preds'].extend(preds.tolist())
        ldo_results[name]['trues'].extend(y_test.tolist())
        ldo_results[name]['probas'].extend(probas.tolist())

# ── Compute aggregate metrics ─────────────────────────────────
print("\n  LDO Results Summary:")
print(f"  {'Model':<16} {'F1-Weighted':>12} {'F1-Macro':>10}")
print(f"  {'-'*40}")

all_metrics = {}
for name in models:
    trues  = np.array(ldo_results[name]['trues'])
    preds  = np.array(ldo_results[name]['preds'])
    probas = np.array(ldo_results[name]['probas'])

    f1_w = f1_score(trues, preds, average='weighted', zero_division=0)
    f1_m = f1_score(trues, preds, average='macro',    zero_division=0)
    all_metrics[name] = {'f1_weighted': f1_w, 'f1_macro': f1_m,
                          'trues': trues, 'preds': preds, 'probas': probas}
    print(f"  {name:<16} {f1_w:>12.4f} {f1_m:>10.4f}")

best_name = max(all_metrics, key=lambda n: all_metrics[n]['f1_weighted'])
print(f"\n  Best model: {best_name} (F1={all_metrics[best_name]['f1_weighted']:.4f})")

print(f"\n  Classification Report ({best_name} — LDO CV):")
print(classification_report(
    all_metrics[best_name]['trues'],
    all_metrics[best_name]['preds'],
    target_names=[LABEL_NAMES[i] for i in sorted(np.unique(y))],
    zero_division=0))


# ══════════════════════════════════════════════════════════════
# MODULE 4: TRAIN FINAL MODEL ON ALL DATA
# ══════════════════════════════════════════════════════════════
print("[4/6] Training final model on ALL 64 districts...")

final_scaler = StandardScaler()
X_final      = final_scaler.fit_transform(X)

final_model  = models[best_name].__class__(**models[best_name].get_params())
final_model.fit(X_final, y)
print(f"  Final {best_name} trained on {len(X_final)} districts.")


# ══════════════════════════════════════════════════════════════
# MODULE 5: SCIENTIFIC GRAPHS (9-panel)
# ══════════════════════════════════════════════════════════════
print("\n[5/6] Generating scientific evaluation graphs...")

best = all_metrics[best_name]
trues, preds, probas = best['trues'], best['preds'], best['probas']
classes_present = sorted(np.unique(trues))
names_present   = [LABEL_NAMES[i] for i in classes_present]
colors_present  = [COLORS[i] for i in classes_present]

y_bin = label_binarize(trues, classes=list(range(3)))
if y_bin.shape[1] < 3:
    y_bin = np.hstack([y_bin, np.zeros((len(y_bin), 3-y_bin.shape[1]))])

# ── Division-level F1 breakdown ───────────────────────────────
div_f1 = {}
for div in DIVISIONS:
    mask = divisions_arr == div
    if mask.sum() == 0: continue
    # Get LDO predictions for this division
    # Find indices in the concatenated LDO arrays
    start = 0
    for hd in DIVISIONS:
        n = (divisions_arr == hd).sum()
        if hd == div:
            div_trues = trues[start:start+n]
            div_preds = preds[start:start+n]
            break
        start += n
    div_f1[div] = f1_score(div_trues, div_preds, average='weighted', zero_division=0)

fig = plt.figure(figsize=(22, 18))
fig.patch.set_facecolor('#0a0f1c')
gs  = gridspec.GridSpec(3, 3, figure=fig, hspace=0.50, wspace=0.42)

def sax(ax):
    ax.set_facecolor('#1e293b')
    ax.tick_params(colors='#cbd5e1')
    ax.xaxis.label.set_color('#e2e8f0')
    ax.yaxis.label.set_color('#e2e8f0')
    ax.title.set_color('#f1f5f9')
    for sp in ax.spines.values(): sp.set_edgecolor('#334155')

# 1. Confusion Matrix (LDO aggregated)
ax1 = fig.add_subplot(gs[0,0])
cm  = confusion_matrix(trues, preds, labels=list(range(3)))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=ax1,
            xticklabels=['Red','Yellow','Green'],
            yticklabels=['Red','Yellow','Green'],
            linewidths=0.5, linecolor='#334155')
ax1.set_xlabel('Predicted', fontsize=9, color='#e2e8f0')
ax1.set_ylabel('Actual', fontsize=9, color='#e2e8f0')
ax1.set_title('Confusion Matrix\n(LDO Cross-Validation)', fontsize=11, fontweight='bold')
plt.setp(ax1.get_xticklabels(), color='#e2e8f0', fontsize=8)
plt.setp(ax1.get_yticklabels(), color='#e2e8f0', fontsize=8)
sax(ax1)

# 2. F1 by model comparison
ax2 = fig.add_subplot(gs[0,1])
model_names = list(all_metrics.keys())
f1_vals     = [all_metrics[n]['f1_weighted'] for n in model_names]
bars = ax2.bar(model_names, f1_vals,
               color=['#3b82f6','#8b5cf6','#06b6d4'][:len(model_names)],
               width=0.5, edgecolor='#334155')
for b, v in zip(bars, f1_vals):
    ax2.text(b.get_x()+b.get_width()/2., b.get_height()+0.01,
             f'{v:.3f}', ha='center', va='bottom',
             color='white', fontweight='bold', fontsize=11)
ax2.set_ylim([0, 1.15])
ax2.set_ylabel('F1 Score (Weighted)', fontsize=9)
ax2.set_title('Model Comparison\n(Leave-Division-Out F1)', fontsize=11, fontweight='bold')
ax2.axhline(0.6, color='#f59e0b', ls='--', alpha=0.7, label='0.60 LDO target')
ax2.axhline(0.7, color='#10b981', ls='--', alpha=0.7, label='0.70 stretch')
ax2.legend(fontsize=8, facecolor='#1e293b', labelcolor='white')
sax(ax2)

# 3. F1 per division (shows which regions generalise well)
ax3 = fig.add_subplot(gs[0,2])
div_names = list(div_f1.keys())
div_vals  = [div_f1[d] for d in div_names]
bar_colors= ['#10b981' if v >= 0.7 else '#f59e0b' if v >= 0.5 else '#ef4444'
             for v in div_vals]
bars3 = ax3.barh(div_names, div_vals, color=bar_colors, edgecolor='#334155')
for b, v in zip(bars3, div_vals):
    ax3.text(v + 0.01, b.get_y()+b.get_height()/2.,
             f'{v:.2f}', va='center', color='white', fontsize=8)
ax3.set_xlabel('F1 Score (Weighted)', fontsize=9)
ax3.set_title(f'F1 by Division\n({best_name} — held-out fold)', fontsize=11, fontweight='bold')
ax3.set_xlim([0, 1.15])
ax3.axvline(0.6, color='#f59e0b', ls='--', alpha=0.6)
sax(ax3)

# 4. ROC Curves
ax4 = fig.add_subplot(gs[1,0])
for i, (name, color) in enumerate(zip(LABEL_NAMES, COLORS)):
    try:
        fpr, tpr, _ = roc_curve(y_bin[:, i], probas[:, i])
        sc = auc(fpr, tpr)
        ax4.plot(fpr, tpr, color=color, lw=2, label=f'{name[:10]} AUC={sc:.2f}')
    except Exception:
        pass
ax4.plot([0,1],[0,1],'--',color='#475569',lw=1)
ax4.set_xlabel('False Positive Rate', fontsize=9)
ax4.set_ylabel('True Positive Rate', fontsize=9)
ax4.set_title(f'ROC Curves — One vs Rest\n({best_name}, LDO)', fontsize=11, fontweight='bold')
ax4.legend(fontsize=7, facecolor='#1e293b', labelcolor='white')
ax4.set_xlim([0,1]); ax4.set_ylim([0,1.02])
sax(ax4)

# 5. Feature Importance (from final model)
ax5 = fig.add_subplot(gs[1,1])
try:
    imp  = final_model.feature_importances_
    idx  = np.argsort(imp)[::-1][:15]
    vals = imp[idx]
    names= [FEATURE_COLS[i][:28] for i in idx]
    cmap = plt.cm.RdYlGn(np.linspace(0.15, 0.9, len(vals)))
    ax5.barh(range(len(vals)), vals[::-1], color=cmap)
    ax5.set_yticks(range(len(vals)))
    ax5.set_yticklabels(names[::-1], fontsize=7, color='#e2e8f0')
    ax5.set_xlabel('Importance', fontsize=9)
    ax5.set_title(f'Feature Importance\n({best_name}, trained on all data)',
                  fontsize=11, fontweight='bold')
except Exception as e:
    ax5.text(0.5,0.5,f'Not available\n{e}',ha='center',va='center',
             transform=ax5.transAxes, color='#94a3b8')
    ax5.set_title('Feature Importance', fontsize=11, fontweight='bold')
sax(ax5)

# 6. Prediction confidence (probability spread)
ax6 = fig.add_subplot(gs[1,2])
max_proba = probas.max(axis=1)
ax6.hist(max_proba, bins=15, color='#3b82f6', edgecolor='#1e293b', alpha=0.85)
ax6.axvline(0.7, color='#10b981', ls='--', lw=2, label='0.70 confidence')
ax6.axvline(0.5, color='#ef4444', ls='--', lw=2, label='0.50 threshold')
ax6.set_xlabel('Max Class Probability', fontsize=9)
ax6.set_ylabel('Number of Districts', fontsize=9)
ax6.set_title('Prediction Confidence\n(Higher = More Certain)', fontsize=11, fontweight='bold')
ax6.legend(fontsize=8, facecolor='#1e293b', labelcolor='white')
sax(ax6)

# 7. District predictions vs actual (scatter)
ax7 = fig.add_subplot(gs[2,0])
scores   = df['digital_divide_score'].values  # use for axis only, not as feature
jitter_x = np.random.normal(0, 0.005, len(trues))
jitter_y = np.random.normal(0, 0.02,  len(trues))
c_actual = [COLORS[t] for t in trues]
c_pred   = [COLORS[p] for p in preds]
correct  = (np.array(trues) == np.array(preds))
ax7.scatter(scores[np.array(list(range(len(trues))))],
            np.array(trues) + jitter_y,
            c=c_pred, s=60, alpha=0.75,
            marker='o', edgecolors='white', linewidths=0.4)
ax7.set_xlabel('Digital Divide Score (reference only)', fontsize=9)
ax7.set_ylabel('True Label (0=Red, 1=Yellow, 2=Green)', fontsize=9)
ax7.set_title(f'Predictions vs Actual\n(Color = predicted class)',
              fontsize=11, fontweight='bold')
from matplotlib.patches import Patch
legend_els = [Patch(facecolor=COLORS[i], label=LABEL_NAMES[i]) for i in range(3)]
ax7.legend(handles=legend_els, fontsize=7, facecolor='#1e293b', labelcolor='white')
sax(ax7)

# 8. Error analysis — where does it fail?
ax8 = fig.add_subplot(gs[2,1])
errors = np.array(trues) != np.array(preds)
# Show which divisions have most errors
div_errors = {}
start = 0
for div in DIVISIONS:
    n = (divisions_arr == div).sum()
    n_err = errors[start:start+n].sum()
    div_errors[div] = int(n_err)
    start += n
divs_e = list(div_errors.keys())
errs_e = list(div_errors.values())
bar_c  = ['#ef4444' if e > 2 else '#f59e0b' if e > 0 else '#10b981' for e in errs_e]
ax8.bar(divs_e, errs_e, color=bar_c, edgecolor='#334155')
ax8.set_ylabel('Misclassified Districts', fontsize=9)
ax8.set_title('Error Analysis by Division\n(0 = perfect on held-out fold)',
              fontsize=11, fontweight='bold')
plt.setp(ax8.get_xticklabels(), rotation=30, ha='right', fontsize=8)
sax(ax8)

# 9. Label distribution
ax9 = fig.add_subplot(gs[2,2])
counts = [(y==i).sum() for i in range(3)]
bars9  = ax9.bar(LABEL_NAMES, counts, color=COLORS, edgecolor='#334155', width=0.5)
for b, v in zip(bars9, counts):
    ax9.text(b.get_x()+b.get_width()/2., b.get_height()+0.3,
             str(v), ha='center', va='bottom', color='white', fontweight='bold')
ax9.set_ylabel('Districts', fontsize=9)
ax9.set_title('Label Distribution\n(64 Districts)', fontsize=11, fontweight='bold')
plt.setp(ax9.get_xticklabels(), rotation=20, ha='right', fontsize=8)
sax(ax9)

fig.suptitle(
    'ConnectivaNet v4 — Leave-Division-Out Generalisation Evaluation\n'
    f'Bangladesh Digital Divide | {best_name} | No Data Leakage | 64 Districts × 8 Folds',
    fontsize=13, fontweight='bold', color='#f1f5f9', y=0.998
)

graph_path = os.path.join(OUT_DIR, 'connectiva_v4_performance.png')
plt.savefig(graph_path, dpi=150, bbox_inches='tight',
            facecolor='#0a0f1c', edgecolor='none')
plt.close()
print(f"  Saved: {graph_path}")


# ══════════════════════════════════════════════════════════════
# MODULE 6: SAVE MODEL + METRICS
# ══════════════════════════════════════════════════════════════
print("\n[6/6] Saving model artifacts...")

joblib.dump(final_model,   os.path.join(OUT_DIR, 'connectiva_v4_model.pkl'))
joblib.dump(final_scaler,  os.path.join(OUT_DIR, 'connectiva_v4_scaler.pkl'))
joblib.dump(FEATURE_COLS,  os.path.join(OUT_DIR, 'connectiva_v4_features.pkl'))

try:
    arc = roc_auc_score(y_bin, probas, multi_class='ovr', average='weighted')
except Exception:
    arc = None

metrics = {
    'version': 'v4',
    'approach': 'Leave-Division-Out Cross-Validation (no data leakage)',
    'best_model': best_name,
    'all_models': {n: {'f1_weighted': round(all_metrics[n]['f1_weighted'],4),
                       'f1_macro':    round(all_metrics[n]['f1_macro'],4)}
                   for n in models},
    'f1_weighted_ldo': round(all_metrics[best_name]['f1_weighted'], 4),
    'f1_macro_ldo':    round(all_metrics[best_name]['f1_macro'],    4),
    'auc_roc_weighted': round(float(arc), 4) if arc else 'N/A',
    'n_districts': 64,
    'n_features':  len(FEATURE_COLS),
    'features_used': FEATURE_COLS,
    'leaky_features_dropped': ['digital_divide_score','pid_score_yr1',
                                'pid_score_yr3','pid_score_yr5'],
    'cv_strategy': 'Leave-Division-Out (8 folds)',
    'label_distribution': {LABEL_NAMES[i]: int((y==i).sum()) for i in range(3)},
    'division_f1': {d: round(div_f1[d],4) for d in div_f1},
}
with open(os.path.join(OUT_DIR, 'model_metrics_v4.json'), 'w') as f:
    json.dump(metrics, f, indent=2)

print("\n" + "="*62)
print("  ConnectivaNet v4 — COMPLETE")
print("="*62)
print(f"\n  Output: {OUT_DIR}/")
print(f"  connectiva_v4_model.pkl     ← {best_name}")
print(f"  connectiva_v4_scaler.pkl    ← StandardScaler")
print(f"  connectiva_v4_features.pkl  ← feature list")
print(f"  connectiva_v4_performance.png ← 9-panel graphs")
print(f"  model_metrics_v4.json       ← all metrics")
print(f"\n  LDO F1 Weighted: {all_metrics[best_name]['f1_weighted']:.4f}")
print(f"  LDO F1 Macro:    {all_metrics[best_name]['f1_macro']:.4f}")
if arc: print(f"  AUC-ROC:         {arc:.4f}")
print(f"\n  Per-division F1 ({best_name}):")
for d, v in div_f1.items():
    bar = '█' * int(v * 20)
    print(f"  {d:>12}: {v:.3f} {bar}")
print("="*62)

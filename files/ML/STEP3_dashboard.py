"""
CONNECTIVA — STEP 3: DASHBOARD GUI
====================================
Two-panel design:
  Panel A (Non-technical / Main): Map + plain language inputs + policy cards
  Panel B (Technical / Background): Weights, confidence, PID params, model stats

HOW TO RUN:
    pip install streamlit plotly folium streamlit-folium pandas
    streamlit run STEP3_dashboard.py

Or in Google Colab:
    !pip install streamlit pyngrok plotly folium streamlit-folium -q
    # Then use ngrok tunnel or localtunnel
"""

import streamlit as st
import pandas as pd
import numpy as np
import json, os

# ── PAGE CONFIG ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Connectiva | Bangladesh Digital Divide",
    page_icon="🗺️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── CUSTOM CSS — clean, non-technical look ────────────────────────────────────
st.markdown("""
<style>
  /* Main background */
  .main { background-color: #f8f9fb; }
  
  /* Status cards */
  .card-red    { background:#fee2e2; border-left:5px solid #dc2626;
                 padding:1rem; border-radius:8px; margin:0.5rem 0; }
  .card-yellow { background:#fef9c3; border-left:5px solid #ca8a04;
                 padding:1rem; border-radius:8px; margin:0.5rem 0; }
  .card-green  { background:#dcfce7; border-left:5px solid #16a34a;
                 padding:1rem; border-radius:8px; margin:0.5rem 0; }
  
  /* Hide technical label */
  .tech-badge  { background:#e0e7ff; color:#3730a3; font-size:0.7rem;
                 padding:2px 6px; border-radius:4px; }
  
  /* Metric row */
  .metric-box  { background:white; border-radius:10px; padding:1rem;
                 box-shadow:0 1px 3px rgba(0,0,0,0.1); text-align:center; }
  
  /* Priority badges */
  .badge-high   { background:#fca5a5; color:#7f1d1d; padding:2px 8px;
                  border-radius:4px; font-size:0.8rem; font-weight:600; }
  .badge-medium { background:#fde68a; color:#78350f; padding:2px 8px;
                  border-radius:4px; font-size:0.8rem; font-weight:600; }
  .badge-low    { background:#bbf7d0; color:#14532d; padding:2px 8px;
                  border-radius:4px; font-size:0.8rem; font-weight:600; }

  /* Year tabs */
  .stTabs [data-baseweb="tab"] { font-size:0.9rem; }
</style>
""", unsafe_allow_html=True)


# ── DATA LOADING ──────────────────────────────────────────────────────────────
@st.cache_data
def load_data():
    """Load pre-computed outputs from Step 2."""
    # Try to load from file; fall back to embedded sample data
    if os.path.exists('division_features_full.csv'):
        df = pd.read_csv('division_features_full.csv')
    else:
        # Embedded fallback (always works even without Step 2 outputs)
        df = pd.DataFrame({
            'division':              ['Barishal','Chattogram','Dhaka','Khulna',
                                      'Mymensingh','Rajshahi','Rangpur','Sylhet'],
            'DDI_score':             [0.355,0.655,0.965,0.502,0.221,0.429,0.085,0.416],
            'status':                ['Yellow','Green','Green','Yellow',
                                      'Red','Yellow','Red','Yellow'],
            'literacy_rate_pct':     [74.3,75.8,78.6,74.1,61.7,72.1,68.4,69.5],
            'poverty_rate_pct':      [26.9,18.0,14.5,13.8,21.0,16.0,22.0,12.5],
            'monthly_income_bdt':    [25892,34054,42696,28192,24183,30398,21674,22861],
            'internet_access_pct':   [53.2,62.4,80.5,62.1,45.8,55.3,45.45,58.7],
            'mobile_phone_pct':      [97.8,98.5,99.22,97.9,96.77,97.6,97.2,98.1],
            'computer_pct':          [4.1,8.2,14.26,7.3,2.99,5.8,4.2,5.1],
            'pct_4G_internet':       [37.5,44.7,44.8,39.9,47.6,38.6,31.6,48.1],
            'affordability_pct_income':[0.66,0.50,0.40,0.60,0.70,0.56,0.78,0.74],
            'internet_penetration_pct':[53.0,67.0,78.0,67.1,60.9,49.8,44.1,47.1],
            'usage_gap_pct':         [22.5,18.0,9.5,19.8,24.1,21.3,28.7,20.4],
            'gender_gap_pct':        [8.2,5.1,3.4,6.3,9.8,7.1,8.9,6.7],
            'QA_trap_index':         [0.42,0.28,0.21,0.38,0.45,0.41,0.58,0.36],
            'population_million':    [9.5,33.1,44.7,16.3,13.0,20.3,17.9,11.5],
            'total_mobile':          [8554264,31533369,54201872,17705398,
                                      10021919,17539063,13960882,8684261],
            'total_internet':        [5030496,22148110,34871695,10940363,
                                      7919485,10103826,7899882,5418789],
        })
    return df


@st.cache_data
def load_mvt_weights():
    if os.path.exists('mvt_weights.csv'):
        return pd.read_csv('mvt_weights.csv', index_col=0, header=0).squeeze()
    # Fallback
    return pd.Series({
        'internet_access_pct':0.184,'literacy_rate_pct':0.161,
        'affordability_pct_income':0.149,'monthly_income_bdt':0.143,
        'internet_penetration_pct':0.132,'usage_gap_pct':0.101,
        'QA_trap_index':0.089,'poverty_rate_pct':0.073,
        'pct_4G_internet':0.021,
    })


# Bangladesh division centroids (for map)
DIVISION_COORDS = {
    'Barishal':   (22.7010, 90.3535),
    'Chattogram': (22.3569, 91.7832),
    'Dhaka':      (23.8103, 90.4125),
    'Khulna':     (22.8456, 89.5403),
    'Mymensingh': (24.7471, 90.4203),
    'Rajshahi':   (24.3636, 88.6241),
    'Rangpur':    (25.7439, 89.2752),
    'Sylhet':     (24.8949, 91.8687),
}

STATUS_COLOR  = {'Red':'#dc2626','Yellow':'#ca8a04','Green':'#16a34a'}
STATUS_BG     = {'Red':'#fee2e2','Yellow':'#fef9c3','Green':'#dcfce7'}
STATUS_EMOJI  = {'Red':'🔴','Yellow':'🟡','Green':'🟢'}
STATUS_LABEL  = {
    'Red':    '⚠️ Critical — Urgent intervention needed',
    'Yellow': '⚡ Transitioning — Active improvement underway',
    'Green':  '✅ On track — Maintain and monitor',
}


# ── PID ENGINE (runs in app, not pre-computed) ────────────────────────────────
def pid_trajectory(current_ddi, target_ddi, years,
                   Kp=0.40, Ki=0.08, Kd=0.15):
    integral, prev_err = 0.0, 0.0
    traj = []
    for yr in range(1, years + 1):
        err        = target_ddi - current_ddi
        integral  += err
        deriv      = err - prev_err
        prev_err   = err
        output     = max(0, Kp*err + Ki*integral + Kd*deriv)
        gain       = min(output * 0.20, 0.09)
        current_ddi = min(current_ddi + gain, 0.95)
        traj.append({
            'Year': f'Year {yr}',
            'DDI':  round(current_ddi, 3),
            'DDI%': round(current_ddi * 100, 1),
            'Status': ('Green' if current_ddi >= 0.60
                       else ('Yellow' if current_ddi >= 0.33 else 'Red')),
        })
    return pd.DataFrame(traj)


TOKEN_ACTIONS = {
    'internet_access_pct': {
        'label': 'Expand Broadband Coverage',
        'icon': '📡',
        'actions': [
            'Deploy community WiFi at all Union Parishad offices',
            'Extend Social Obligation Fund subsidies to red zones',
            'License District Fixed Telecom operators (BTRC 2025)',
        ],
        'agency': 'BTRC / MoPTIT',
    },
    'literacy_rate_pct': {
        'label': 'Digital Literacy Training',
        'icon': '📚',
        'actions': [
            'Activate Union Digital Centers for digital skills training',
            'Connect school ICT labs to fiber backbone',
            'Women-targeted digital literacy via a2i Sheikh Russell Labs',
        ],
        'agency': 'MoE / a2i',
    },
    'pct_4G_internet': {
        'label': 'Upgrade Network Quality',
        'icon': '🏗️',
        'actions': [
            'Enforce 50% tower fiberization in 18 months (BTRC §11.2.5)',
            'Mandate 4G rollout in critical upazilas',
            'Spectrum incentives for rural 4G (BTRC §11.2.1)',
        ],
        'agency': 'BTRC / Operators',
    },
    'affordability_pct_income': {
        'label': 'Reduce Data Cost Burden',
        'icon': '💰',
        'actions': [
            'Zero-rate government e-services (e-GP, health portals)',
            'Reduce import duty on entry-level smartphones',
            'Target 5GB basket < 2% of monthly income (ITU standard)',
        ],
        'agency': 'NBR / MoF / BTRC',
    },
    'computer_pct': {
        'label': 'Device Access Program',
        'icon': '📱',
        'actions': [
            'Mobile money–linked smartphone financing scheme',
            'Refurbished device distribution via union offices',
            'Low-cost tablet program for rural students',
        ],
        'agency': 'MoPTIT / Banks',
    },
    'usage_gap_pct': {
        'label': 'Convert Coverage to Active Use',
        'icon': '🔄',
        'actions': [
            'Awareness campaigns for digital services in Bangla',
            'Relevant local-language content development',
            'Promote mAgri, mHealth, mFinance in rural areas',
        ],
        'agency': 'a2i / MoICT',
    },
    'gender_gap_pct': {
        'label': 'Gender Digital Inclusion',
        'icon': '👩',
        'actions': [
            'Women-only digital skill sessions at UDCs',
            'Female-friendly mobile internet bundles',
            'Community Digital Literacy Champions (female-led)',
        ],
        'agency': 'MoWCA / a2i',
    },
}


def get_policy_cards(division_row, years, target_pct, importances):
    """Return plain-language policy cards for a division, year by year."""
    current = float(division_row['DDI_score'])
    gap     = 1.0 - current
    target  = min(current + gap * (target_pct / 100), 0.95)
    traj    = pid_trajectory(current, target, years)

    top_tokens = [t for t in TOKEN_ACTIONS if t in importances.index]
    tok_imp    = importances[top_tokens]
    tok_imp    = (tok_imp / tok_imp.sum()).sort_values(ascending=False)

    cards = []
    for yr in range(years):
        yr_cards = []
        for i, (tok, imp) in enumerate(tok_imp.items()):
            info   = TOKEN_ACTIONS[tok]
            act_i  = min(yr, len(info['actions']) - 1)
            priority = 'High' if imp >= 0.20 else ('Medium' if imp >= 0.10 else 'Low')
            yr_cards.append({
                'label':    info['label'],
                'icon':     info['icon'],
                'action':   info['actions'][act_i],
                'agency':   info['agency'],
                'priority': priority,
            })
        cards.append({
            'year':     yr + 1,
            'DDI':      traj.iloc[yr]['DDI'],
            'status':   traj.iloc[yr]['Status'],
            'cards':    yr_cards,
        })
    return traj, cards


# ── FOLIUM MAP ────────────────────────────────────────────────────────────────
def build_map(df_display, show_projected):
    import folium
    m = folium.Map(location=[23.7, 90.3], zoom_start=7,
                   tiles='CartoDB positron')
    status_col = 'projected_status' if show_projected else 'status'
    for _, row in df_display.iterrows():
        div  = row['division']
        lat, lon = DIVISION_COORDS[div]
        status   = row[status_col]
        color    = STATUS_COLOR[status]
        emoji    = STATUS_EMOJI[status]
        ddi_val  = row.get('projected_DDI', row['DDI_score'])

        popup_html = f"""
        <div style='font-family:sans-serif;width:220px'>
          <b style='font-size:1.1rem'>{emoji} {div}</b><br>
          <hr style='margin:4px 0'>
          <b>Digital Score:</b> {ddi_val:.0%}<br>
          <b>Status:</b> {STATUS_LABEL[status]}<br>
          <hr style='margin:4px 0'>
          <small>
            🌐 Internet access: {row['internet_access_pct']:.1f}%<br>
            📖 Literacy: {row['literacy_rate_pct']:.1f}%<br>
            📶 4G users: {row['pct_4G_internet']:.1f}%<br>
            💰 Data cost: {row['affordability_pct_income']:.1f}% of income<br>
            📱 Mobile: {row['mobile_phone_pct']:.1f}%
          </small>
        </div>
        """
        folium.CircleMarker(
            location=[lat, lon],
            radius=28,
            color=color,
            fill=True,
            fill_color=color,
            fill_opacity=0.65,
            popup=folium.Popup(popup_html, max_width=240),
            tooltip=f"{emoji} {div}: {ddi_val:.0%}",
        ).add_to(m)
        folium.Marker(
            location=[lat, lon],
            icon=folium.DivIcon(
                html=f'<div style="font-size:11px;font-weight:700;'
                     f'color:white;text-align:center;'
                     f'text-shadow:0 0 3px #000;'
                     f'margin-top:-8px;margin-left:-20px;width:40px">'
                     f'{div[:5]}</div>'),
        ).add_to(m)
    return m


# ── MAIN APP ──────────────────────────────────────────────────────────────────
def main():
    df          = load_data()
    importances = load_mvt_weights()

    # ── SIDEBAR — user inputs (non-technical) ─────────────────────────────
    with st.sidebar:
        st.image("https://upload.wikimedia.org/wikipedia/commons/f/f9/Flag_of_Bangladesh.svg",
                 width=80)
        st.title("🗺️ Connectiva")
        st.caption("Bangladesh Digital Divide Optimizer")
        st.divider()

        st.subheader("🎯 Set Your Goal")
        st.caption("Tell us what you want to achieve. We'll calculate everything else.")

        target_pct = st.slider(
            "Reduce the digital divide by",
            min_value=10, max_value=80, value=40, step=5,
            format="%d%%",
            help="How much of the current gap do you want to close?"
        )
        years = st.slider(
            "Within how many years",
            min_value=1, max_value=10, value=5, step=1,
            format="%d years"
        )

        st.divider()
        show_projected = st.toggle(
            "Show projected map (after goal period)",
            value=False,
            help="Toggle between current state and projected state after your target period"
        )

        st.divider()
        selected_div = st.selectbox(
            "📍 Explore a specific division",
            options=df['division'].tolist(),
            index=6  # Rangpur (worst) as default
        )

        st.divider()
        # Technical window toggle
        show_technical = st.toggle(
            "🔧 Show technical details",
            value=False,
            help="For engineers: view model weights, PID parameters, confidence scores"
        )

    # ── HEADER ────────────────────────────────────────────────────────────
    st.title("Bangladesh Digital Divide Optimizer")
    st.caption(
        "Team Connectiva · ITU UMC Data Hackathon 2025 · "
        "Data: ITU DataHub + BTRC + BBS HIES 2022"
    )

    # ── SUMMARY METRICS ───────────────────────────────────────────────────
    red_now    = (df['status'] == 'Red').sum()
    yellow_now = (df['status'] == 'Yellow').sum()
    green_now  = (df['status'] == 'Green').sum()

    # Calculate projected
    df_proj = df.copy()
    for i, row in df.iterrows():
        current = float(row['DDI_score'])
        gap     = 1.0 - current
        target  = min(current + gap * (target_pct / 100), 0.95)
        traj    = pid_trajectory(current, target, years)
        final   = traj.iloc[-1]
        df_proj.at[i, 'projected_DDI']    = final['DDI']
        df_proj.at[i, 'projected_status'] = final['Status']

    red_proj    = (df_proj['projected_status'] == 'Red').sum()
    yellow_proj = (df_proj['projected_status'] == 'Yellow').sum()
    green_proj  = (df_proj['projected_status'] == 'Green').sum()

    est_beneficiaries = int(df['population_million'].sum() * 1e6 *
                            (target_pct / 100) * (1 - df['DDI_score'].mean()))

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("🔴 Critical Zones",     f"{red_now}",
              delta=f"{red_proj - red_now} projected",
              delta_color='inverse')
    c2.metric("🟡 Transitioning",      f"{yellow_now}",
              delta=f"{yellow_proj - yellow_now} projected",
              delta_color='off')
    c3.metric("🟢 On Track",          f"{green_now}",
              delta=f"+{green_proj - green_now} projected",
              delta_color='normal')
    c4.metric("🎯 Your Goal",         f"{target_pct}% reduction")
    c5.metric("👥 Est. Beneficiaries", f"{est_beneficiaries/1e6:.1f}M")

    st.divider()

    # ── MAP + DIVISION DETAIL (two columns) ───────────────────────────────
    col_map, col_detail = st.columns([3, 2])

    with col_map:
        st.subheader("🗺️ Division Status Map")
        map_label = (
            f"Projected after {years} years ({target_pct}% goal)"
            if show_projected else "Current state (2024)"
        )
        st.caption(map_label)

        try:
            from streamlit_folium import st_folium
            m = build_map(df_proj, show_projected)
            st_folium(m, width=550, height=480)
        except ImportError:
            # Fallback: plotly scatter map
            import plotly.express as px
            map_df = df_proj.copy()
            map_df['lat'] = map_df['division'].map(lambda d: DIVISION_COORDS[d][0])
            map_df['lon'] = map_df['division'].map(lambda d: DIVISION_COORDS[d][1])
            map_df['display_status'] = map_df['projected_status' if show_projected else 'status']
            map_df['display_ddi']    = map_df['projected_DDI' if show_projected else 'DDI_score']

            fig = px.scatter_mapbox(
                map_df,
                lat='lat', lon='lon',
                color='display_status',
                color_discrete_map={'Red':'#dc2626','Yellow':'#ca8a04','Green':'#16a34a'},
                size='population_million',
                text='division',
                hover_data={'internet_access_pct':True,'literacy_rate_pct':True,
                            'display_ddi':True,'lat':False,'lon':False},
                zoom=6, height=480,
                mapbox_style='carto-positron',
            )
            fig.update_traces(textposition='top center')
            st.plotly_chart(fig, use_container_width=True)

        # Legend
        st.markdown("""
        <div style='display:flex;gap:1rem;margin-top:0.5rem;font-size:0.85rem'>
          <span>🔴 <b>Critical</b> — Urgent action needed</span>
          <span>🟡 <b>Transitioning</b> — Improving</span>
          <span>🟢 <b>On Track</b> — Target achievable</span>
        </div>
        """, unsafe_allow_html=True)

    with col_detail:
        st.subheader(f"📍 {selected_div} Division")

        row = df[df['division'] == selected_div].iloc[0]
        status = row['status']
        bg     = STATUS_BG[status]
        emoji  = STATUS_EMOJI[status]

        st.markdown(f"""
        <div style='background:{bg};padding:1rem;border-radius:10px;margin-bottom:1rem'>
          <h3 style='margin:0'>{emoji} {STATUS_LABEL[status]}</h3>
          <p style='margin:0.3rem 0 0'>Digital Score: <b>{row['DDI_score']:.0%}</b></p>
        </div>
        """, unsafe_allow_html=True)

        # Plain-language indicators
        indicators = [
            ("🌐", "Internet access",    f"{row['internet_access_pct']:.1f}%",
             "of households", row['internet_access_pct'] / 100),
            ("📖", "Literacy rate",      f"{row['literacy_rate_pct']:.1f}%",
             "of population (7+)", row['literacy_rate_pct'] / 100),
            ("📶", "4G internet users",  f"{row['pct_4G_internet']:.1f}%",
             "of internet users", row['pct_4G_internet'] / 100),
            ("💰", "Data cost burden",   f"{row['affordability_pct_income']:.1f}%",
             "of monthly income", 1 - row['affordability_pct_income'] / 10),
            ("👩", "Gender gap",         f"{row['gender_gap_pct']:.1f}%",
             "male-female usage gap", 1 - row['gender_gap_pct'] / 15),
        ]
        for icon, label, val, unit, bar_val in indicators:
            st.markdown(f"**{icon} {label}:** {val} *{unit}*")
            st.progress(float(np.clip(bar_val, 0, 1)))

        # Trajectory chart
        current  = float(row['DDI_score'])
        gap      = 1.0 - current
        target   = min(current + gap * (target_pct / 100), 0.95)
        traj_df  = pid_trajectory(current, target, years)

        import plotly.graph_objects as go
        fig = go.Figure()
        colors = [STATUS_COLOR[s] for s in traj_df['Status']]
        fig.add_trace(go.Scatter(
            x=['Now'] + traj_df['Year'].tolist(),
            y=[current * 100] + traj_df['DDI%'].tolist(),
            mode='lines+markers',
            marker=dict(color=['gray'] + colors, size=10),
            line=dict(color='#6366f1', width=2),
            name='Projected score',
        ))
        fig.add_hline(y=60, line_dash='dash', line_color='#16a34a',
                      annotation_text='Green threshold (60%)')
        fig.add_hline(y=33, line_dash='dash', line_color='#dc2626',
                      annotation_text='Red threshold (33%)')
        fig.update_layout(
            title=f"Digital score trajectory ({target_pct}% goal, {years} yrs)",
            yaxis_title='Digital Score (%)',
            yaxis=dict(range=[0, 100]),
            height=280, margin=dict(l=0, r=0, t=30, b=0),
            showlegend=False,
        )
        st.plotly_chart(fig, use_container_width=True)

    st.divider()

    # ── POLICY CARDS ──────────────────────────────────────────────────────
    st.subheader(f"📋 Action Plan — {selected_div} Division")
    st.caption(
        f"Step-by-step roadmap to reduce the digital divide by "
        f"{target_pct}% in {years} years. Click each year to expand."
    )

    _, cards = get_policy_cards(row, years, target_pct, importances)

    tabs = st.tabs([f"Year {c['year']} {STATUS_EMOJI[c['status']]}" for c in cards])
    for tab, card in zip(tabs, cards):
        with tab:
            st.markdown(
                f"**Digital Score after Year {card['year']}:** "
                f"{card['DDI']:.0%} — {STATUS_LABEL[card['status']]}"
            )
            high   = [c for c in card['cards'] if c['priority'] == 'High']
            medium = [c for c in card['cards'] if c['priority'] == 'Medium']
            low    = [c for c in card['cards'] if c['priority'] == 'Low']

            for group, label, badge_class in [
                (high, '🔴 High Priority', 'badge-high'),
                (medium, '🟡 Medium Priority', 'badge-medium'),
                (low, '🟢 Supporting Actions', 'badge-low'),
            ]:
                if group:
                    st.markdown(f"**{label}**")
                    for item in group:
                        st.markdown(f"""
                        <div style='background:white;border-radius:8px;
                             padding:0.8rem;margin:0.4rem 0;
                             box-shadow:0 1px 3px rgba(0,0,0,0.08)'>
                          <b>{item['icon']} {item['label']}</b><br>
                          <span style='color:#374151'>{item['action']}</span><br>
                          <small style='color:#6b7280'>
                            Implementing agency: {item['agency']}
                          </small>
                        </div>
                        """, unsafe_allow_html=True)

    st.divider()

    # ── ALL DIVISIONS COMPARISON ───────────────────────────────────────────
    st.subheader("📊 All Divisions — At a Glance")

    import plotly.express as px
    compare_df = df_proj.sort_values('DDI_score')
    fig2 = px.bar(
        compare_df,
        x='division',
        y=['DDI_score', 'projected_DDI'],
        barmode='group',
        color_discrete_map={'DDI_score':'#94a3b8','projected_DDI':'#6366f1'},
        labels={'value':'Digital Score','variable':'Period'},
        title=f"Current vs Projected Digital Score (after {years} years, {target_pct}% goal)",
        height=350,
    )
    fig2.update_layout(legend_title='',
                       yaxis=dict(tickformat='.0%', range=[0, 1]))
    fig2.for_each_trace(lambda t: t.update(
        name='Current (2024)' if t.name == 'DDI_score' else f'Projected (Year {years})'))
    st.plotly_chart(fig2, use_container_width=True)

    # ── TECHNICAL WINDOW (hidden by default) ──────────────────────────────
    if show_technical:
        st.divider()
        st.subheader("🔧 Technical Details")
        st.caption("This section is for engineers and data scientists.")

        t1, t2, t3, t4 = st.tabs(
            ["Model Weights", "PID Parameters", "Confidence & Diagnostics", "Raw Data"])

        with t1:
            st.subheader("Most Valuable Tokens (MVT Weights)")
            st.caption(
                "Random Forest feature importances — how much each variable "
                "drives the Digital Divide Index."
            )
            imp_df = importances.reset_index()
            imp_df.columns = ['Token','Importance']
            fig_imp = px.bar(imp_df.sort_values('Importance'),
                             x='Importance', y='Token',
                             orientation='h', height=350,
                             color='Importance',
                             color_continuous_scale='Purples')
            st.plotly_chart(fig_imp, use_container_width=True)
            st.dataframe(imp_df.sort_values('Importance', ascending=False),
                         use_container_width=True)

        with t2:
            st.subheader("PID Controller Parameters")
            st.markdown("""
            | Parameter | Value | Role |
            |-----------|-------|------|
            | **Kp** (Proportional) | 0.40 | React to current gap size |
            | **Ki** (Integral)     | 0.08 | Accumulate correction over time |
            | **Kd** (Derivative)   | 0.15 | Dampen oscillation / overshoot |
            | Max annual DDI gain   | 0.09 | Realistic cap (prevents policy shock) |
            | Status: Green         | ≥ 0.60 | Target achieved |
            | Status: Yellow        | 0.33–0.60 | Transitioning |
            | Status: Red           | < 0.33 | Critical intervention needed |
            """)
            st.caption(
                "PID tuning rationale: Kp=0.40 provides responsive correction "
                "without instability. Ki=0.08 prevents integral windup over a "
                "5-year horizon. Kd=0.15 prevents overshooting policy targets."
            )

        with t3:
            st.subheader("Model Diagnostics")
            st.info(
                "Model: Random Forest (n=1000 trees) trained on 8 division "
                "observations with LOO cross-validation."
            )
            metrics = {
                'Model':              'Random Forest Regressor',
                'Training samples':   '8 divisions',
                'Cross-validation':   'Leave-One-Out (LOO)',
                'Feature count':      len(importances),
                'Data sources':       'ITU DataHub (190+ CSVs) + BTRC Excel + HIES 2022 PDF',
                'ITU indicators':     '36+ for Bangladesh',
                'Year range':         '2003–2025',
                'BTRC data year':     '2024 Q4',
                'HIES reference':     'BBS December 2023',
            }
            for k, v in metrics.items():
                st.markdown(f"**{k}:** {v}")

        with t4:
            st.subheader("Division Feature Matrix")
            st.dataframe(df.round(3), use_container_width=True)
            st.download_button(
                "⬇️ Download full feature matrix",
                data=df.to_csv(index=False),
                file_name="connectiva_division_features.csv",
                mime="text/csv",
            )

    # ── FOOTER ────────────────────────────────────────────────────────────
    st.divider()
    st.caption(
        "Connectiva | ITU UMC Data Hackathon 2025 | "
        "Data: ITU DataHub · BTRC · BBS HIES 2022 · "
        "Policy: Bangladesh Telecom & Licensing Policy 2025"
    )


if __name__ == '__main__':
    main()

---
name: Data Visualization
trigger: data visualization, chart, graph, dashboard, visualize data, plot, bar chart, line chart, scatter plot, heatmap, choose chart type, matplotlib, seaborn, plotly, D3, Tableau, data storytelling, which chart
description: Design clear, honest, and effective data visualizations. Covers chart type selection, design principles, color, annotation, dashboards, and code patterns for Python and JavaScript visualization libraries.
---

# ROLE
You are a data visualization designer and analyst. Your job is to transform data into visuals that communicate a clear message — not to make things look impressive. The best chart is the one that makes the insight impossible to miss and impossible to misread.

# CORE PRINCIPLES
```
ONE CHART, ONE MESSAGE — every chart answers one question
DATA-INK RATIO — maximize data, minimize decoration (Tufte's principle)
CONTEXT IS REQUIRED — a number without a baseline is just a number
HONEST AXES — start at zero for bar charts, never truncate to exaggerate
COLOR COMMUNICATES — use color to mean something, not to decorate
LABEL DIRECTLY — annotations beat legends when possible
```

# CHART TYPE SELECTION

## Decision Guide
```
COMPARISON (how do things differ?)
  Few categories:           Horizontal bar chart
  Many categories (10+):    Horizontal bar, sorted by value
  Over time:                Line chart
  Part of a whole:          Stacked bar, treemap (NOT pie)
  Head-to-head (2 things):  Bullet chart or side-by-side bar

DISTRIBUTION (how is data spread?)
  One variable:             Histogram, box plot, violin plot
  Two variables:            Scatter plot, hex bin (for dense data)
  Multiple groups:          Box plot with groups (easiest comparison)

TREND (how does it change over time?)
  Single metric over time:  Line chart
  Multiple metrics:         Multi-line chart (max ~5 lines)
  Rate of change:           Area chart (or chart the delta directly)
  Cumulative:               Area or step chart

RELATIONSHIP (how do things correlate?)
  Two variables:            Scatter plot with regression line
  Many variables:           Correlation matrix (heatmap)
  Hierarchy:                Treemap, sunburst, indented tree

PART-TO-WHOLE (what's the composition?)
  Few parts, single moment: Donut chart (center = total) or stacked bar
  Multiple moments:         Stacked bar over time (100% stacked for share)
  Hierarchy:                Treemap

FLOW / PROCESS
  Process steps:            Funnel chart
  Flows between categories: Sankey diagram
  Geographic:               Choropleth map, bubble map
```

## What NOT to Use
```
PIE CHARTS:
  → Humans are terrible at comparing angles
  → Use horizontal bars instead — comparison is instant
  → Exception: donut chart is acceptable for 2–3 parts (yes/no, complete/incomplete)

3D CHARTS:
  → Always misleading — rear bars appear smaller due to perspective
  → Never acceptable in data communication

DUAL-AXIS CHARTS:
  → Manipulatable — scales can be set to make correlation appear or disappear
  → Use separate charts with shared x-axis instead

RAINBOW COLOR SCALES:
  → Non-intuitive order, not colorblind-safe
  → Use sequential (light → dark) or diverging (blue → white → red) instead
```

# DESIGN PRINCIPLES

## Data-Ink Ratio
```
Remove everything that doesn't carry information:
  ✗ Background color in the plot area (white or very light gray only)
  ✗ Grid lines that compete with the data (use light, thin, sparse lines)
  ✗ 3D effects, shadows, gradients on data elements
  ✗ Decorative borders
  ✗ Legends when you can label directly
  ✗ Data labels when the axis already communicates the value
  ✓ Keep: axes, data marks, titles, source, annotations that add meaning
```

## Color Usage
```
SEQUENTIAL SCALES (for continuous data, one direction):
  Light → dark of one hue
  Tools: viridis, plasma (perceptually uniform + colorblind-safe)
  Avoid: rainbow (jet) — confuses ordering

DIVERGING SCALES (for data with a meaningful midpoint):
  Two hues diverging from white/gray midpoint
  Examples: blue-white-red (temperature, risk), RdYlGn (good-bad)
  Center = 0, average, or neutral — must be meaningful

CATEGORICAL (for nominal categories, no order):
  Max 6–8 distinct colors
  Colorblind-safe palette: Tableau 10, ColorBrewer Qualitative
  Order by value when possible (sorted bar) instead of relying on color alone

COLOR CONVENTION — respect established mental models:
  Red = bad, high risk, loss
  Green = good, low risk, gain
  Blue = neutral, water, time
  Violating these creates confusion even if your legend is clear

SINGLE-HUE RULE:
  When showing one thing, use one color
  Variation in hue = implies variation in category, which confuses readers
```

## Titles and Annotations
```
TITLE = THE INSIGHT (not the description)
  ✗ "Monthly Revenue by Region" (describes the chart)
  ✓ "North America Drove 68% of Q3 Revenue Growth" (tells you what to see)
  ✓ "Conversion Rate Dropped After the July 12 Redesign" (flags the issue)

ANNOTATIONS:
  Mark outliers, changepoints, goals, and context directly on the chart
  Callout box: "Feature shipped" with arrow to the changepoint
  Reference line: "$1M ARR goal" or "Industry average: 3.2%"
  These replace the need for a separate explanatory paragraph

NUMBER FORMATTING:
  $1.2M not $1,234,567 (unless precision matters)
  72% not 72.3847% (show appropriate significant figures)
  Label axes with units: "Revenue ($M)", "Conversion (%)", "Time (s)"
```

# PYTHON CODE PATTERNS

## Matplotlib / Seaborn — Clean Bar Chart
```python
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd

# Set clean theme
sns.set_theme(style='whitegrid', palette='muted', font_scale=1.1)

fig, ax = plt.subplots(figsize=(10, 6))

# Sort by value for easy comparison
df_sorted = df.sort_values('value', ascending=True)

bars = ax.barh(df_sorted['category'], df_sorted['value'], color='#2563EB', edgecolor='none')

# Remove chartjunk
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_visible(False)
ax.tick_params(left=False)
ax.set_xlabel('')
ax.grid(axis='x', alpha=0.3)

# Direct labels > axes ticks for easy reading
for bar, val in zip(bars, df_sorted['value']):
    ax.text(val + 0.5, bar.get_y() + bar.get_height()/2,
            f'{val:.1f}%', va='center', fontweight='bold')

# Title = the insight
ax.set_title('Enterprise Segment Has 3× Higher Retention Than SMB',
             fontsize=14, fontweight='bold', pad=15, loc='left')

plt.tight_layout()
plt.savefig('chart.png', dpi=150, bbox_inches='tight')
```

## Time Series Line Chart
```python
fig, ax = plt.subplots(figsize=(12, 5))

# Plot lines — limit to ≤5 lines per chart
colors = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C']
for i, (label, group) in enumerate(df.groupby('segment')):
    ax.plot(group['date'], group['value'], label=label,
            color=colors[i], linewidth=2.5)
    # Direct label at end of line (better than legend)
    ax.text(group['date'].iloc[-1] + pd.Timedelta(days=2),
            group['value'].iloc[-1], label, va='center', color=colors[i])

# Annotate a key event
ax.axvline(x=pd.Timestamp('2024-08-12'), color='gray', linestyle='--', alpha=0.7)
ax.text(pd.Timestamp('2024-08-12'), ax.get_ylim()[1],
        'Redesign\nshipped', ha='center', va='top', fontsize=9, color='gray')

ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.set_title('Mobile Conversion Dropped 46% After August Redesign',
             fontsize=13, fontweight='bold', loc='left')
ax.set_xlabel('')
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'{x:.0%}'))

plt.tight_layout()
```

## Plotly (Interactive Charts)
```python
import plotly.express as px
import plotly.graph_objects as go

# Interactive line chart
fig = px.line(df, x='date', y='value', color='segment',
              title='Conversion by Segment',
              labels={'value': 'Conversion Rate', 'date': ''},
              template='plotly_white')

fig.update_layout(
    title_font_size=16,
    title_x=0,
    legend_title='',
    hovermode='x unified',
    font_family='Inter, Arial, sans-serif'
)

# Add annotation
fig.add_annotation(
    x='2024-08-12', y=0.042,
    text='Redesign shipped',
    showarrow=True, arrowhead=2,
    bgcolor='white', bordercolor='gray'
)

fig.write_html('chart.html')  # shareable interactive chart
fig.show()
```

# DASHBOARD DESIGN

## Layout Principles
```
F-PATTERN READING: important metrics top-left, supporting detail bottom-right

HIERARCHY OF INFORMATION:
  Level 1 (top): KPIs — 3–5 numbers with trend indicators
  Level 2 (middle): primary charts that explain the KPIs
  Level 3 (bottom): supporting detail, drilldown

COGNITIVE LOAD RULES:
  Max 5–7 charts per dashboard view
  Group related charts visually (borders, shared background)
  Consistent time ranges across charts (same date filter)
  Single source of truth — no conflicting numbers on same dashboard

KPI CARD FORMAT:
  Current Value      ← big and prominent
  vs. Last Period    ← change in value
  % Change           ← direction + magnitude
  ↑ / ↓ indicator    ← color coded (be careful: green/red are not universal)
```

## Dashboard Checklist
```
[ ] Each chart has a descriptive headline (the insight, not the data)
[ ] Date range is visible and consistent across all charts
[ ] Data source and last refresh time shown
[ ] KPIs are above the fold
[ ] No more than 5–7 visuals per screen
[ ] Color is consistent — same color = same thing everywhere
[ ] Mobile-friendly if end users are on phones
[ ] Filters/segments work correctly and update all charts
[ ] "No data" states designed (what shows if date range has no data?)
[ ] Colorblind-safe palette verified
```

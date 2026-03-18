---
name: Data Analysis
trigger: analyze data, find insights, CSV, dataset, statistics, trends, patterns, correlation, visualize data, interpret results, pandas, SQL analysis
description: A systematic framework for exploring, analyzing, and communicating insights from any dataset. Use for data exploration, statistical analysis, visualization, and insight generation.
---

Data analysis is the process of inspecting, cleaning, transforming, and modeling data to discover useful information, draw conclusions, and support decision-making. Great analysis is rigorous, reproducible, and communicated in terms of decisions — not just numbers.

## The Analysis Process

```
1. Define the question → 2. Understand the data → 3. Clean & prepare → 
4. Explore → 5. Analyze → 6. Validate → 7. Communicate
```

Never skip step 1. "Analyze this data" is not a question.

## Phase 1: Define the Question

Analysis without a question is just computation. Start here:
```
Business question:  "Why did revenue drop in Q3?"
Analytical question: "Is there a statistically significant difference in conversion 
                     rate between Q2 and Q3, broken down by channel and cohort?"

Key dimensions:
- What decision will this analysis inform?
- What would "yes" look like? What would "no" look like?
- What's the minimum actionable finding?
- Who is the audience and what do they need to decide?
```

## Phase 2: Understand the Data

Before any computation, understand what you're working with:

```python
import pandas as pd
import numpy as np

df = pd.read_csv('data.csv')

# Shape and structure
print(df.shape)          # (rows, columns)
print(df.dtypes)         # Column types — often reveals encoding issues
print(df.head(10))       # First look at actual values
print(df.tail(5))        # Last rows — check for trailing garbage
print(df.columns.tolist()) # Column names

# Coverage and completeness
print(df.isnull().sum())                    # Missing values per column
print(df.isnull().mean().sort_values(desc=True))  # % missing per column

# Basic distributions
print(df.describe())     # count, mean, std, min, percentiles, max
print(df.describe(include='object'))  # For categorical columns

# Cardinality
for col in df.select_dtypes('object').columns:
    print(f"{col}: {df[col].nunique()} unique values")
    print(df[col].value_counts().head(10))
```

**Questions to answer in this phase:**
- What is the grain of the data? (One row = one what?)
- What time period does it cover?
- Are there obvious data quality issues?
- Are there columns I don't understand? (find the data dictionary)
- What does a "typical" row look like vs. an edge case?

## Phase 3: Clean & Prepare

```python
# Handle missing values — never blindly fill; understand WHY they're missing
# Missing completely at random → impute or drop
# Missing not at random → the missingness itself is information

# Drop columns with > 60% missing (threshold depends on importance)
df = df.dropna(thresh=len(df)*0.4, axis=1)

# For numeric imputation — use median for skewed, mean for symmetric
df['revenue'].fillna(df['revenue'].median(), inplace=True)

# Fix date parsing
df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
df['year_month'] = df['created_at'].dt.to_period('M')

# Handle outliers — investigate before removing
Q1 = df['value'].quantile(0.25)
Q3 = df['value'].quantile(0.75)
IQR = Q3 - Q1
outliers = df[(df['value'] < Q1 - 3*IQR) | (df['value'] > Q3 + 3*IQR)]
print(f"Outliers found: {len(outliers)}")
# Understand outliers — are they errors or real extreme values?

# Encode categories for analysis
df['segment_encoded'] = df['segment'].map({'enterprise': 2, 'mid': 1, 'smb': 0})

# Create derived features
df['revenue_per_user'] = df['revenue'] / df['active_users']
df['days_since_signup'] = (pd.Timestamp.now() - df['signup_date']).dt.days
```

## Phase 4: Exploratory Data Analysis (EDA)

**Univariate analysis — understand each variable:**
```python
import matplotlib.pyplot as plt
import seaborn as sns

# Distribution shape for numeric variables
fig, axes = plt.subplots(2, 3, figsize=(15, 10))
for i, col in enumerate(numeric_cols):
    ax = axes[i//3, i%3]
    df[col].hist(ax=ax, bins=30)
    ax.set_title(f'{col}\nskew={df[col].skew():.2f}')

# Check for: normal vs skewed, bimodal (two populations?), outliers, truncation
```

**Bivariate analysis — relationships between variables:**
```python
# Correlation matrix
corr_matrix = df[numeric_cols].corr()
sns.heatmap(corr_matrix, annot=True, fmt='.2f', cmap='RdBu_r', center=0)

# Scatter plot with trend line
sns.regplot(data=df, x='days_active', y='revenue')

# Categorical vs numeric — box plots
sns.boxplot(data=df, x='segment', y='revenue', order=['smb', 'mid', 'enterprise'])

# Time series
df.groupby('year_month')['revenue'].sum().plot(figsize=(12, 4))
```

**Group analysis:**
```python
# Segment comparison
summary = df.groupby('segment').agg({
    'revenue': ['mean', 'median', 'sum', 'count'],
    'churn': 'mean',
    'days_active': 'mean'
}).round(2)

# Cohort analysis (users grouped by signup month)
cohort = df.groupby(['signup_cohort', 'months_since_signup'])['revenue'].mean().unstack()
sns.heatmap(cohort, annot=True, fmt='.0f')
```

## Phase 5: Statistical Analysis

**Descriptive statistics — what happened:**
```python
# Central tendency: mean, median, mode
# Spread: std, variance, IQR, range
# Shape: skewness, kurtosis
# Always report n — a mean without a sample size is incomplete
```

**Inferential statistics — was it significant:**
```python
from scipy import stats

# Compare two groups (is the difference real?)
group_a = df[df['variant'] == 'control']['conversion_rate']
group_b = df[df['variant'] == 'treatment']['conversion_rate']

t_stat, p_value = stats.ttest_ind(group_a, group_b)
print(f"t-statistic: {t_stat:.4f}, p-value: {p_value:.4f}")
print(f"Effect significant: {p_value < 0.05}")

# Effect size (practical significance — p-value doesn't tell you this)
cohens_d = (group_b.mean() - group_a.mean()) / group_a.std()
print(f"Cohen's d: {cohens_d:.3f}")  # 0.2=small, 0.5=medium, 0.8=large

# Correlation significance
r, p = stats.pearsonr(df['feature'], df['target'])
print(f"r={r:.3f}, p={p:.4f}")
```

**Statistical vs. practical significance:**
```
A result can be statistically significant (low p-value) but practically meaningless
(tiny effect size). Always report BOTH.

Example:
"The treatment group had 0.3% higher conversion (control: 10.0%, treatment: 10.3%).
This difference was statistically significant (p=0.002, n=50,000 per group) 
but the effect size is small (Cohen's d=0.08), representing ~150 additional 
conversions per month — worth shipping but not a breakthrough."
```

## Phase 6: Validation & Sanity Checks

Before communicating findings:
```python
# Sanity check aggregates against known ground truth
print(f"Total revenue in analysis: ${df['revenue'].sum():,.0f}")
print(f"Expected from finance report: $X,XXX,XXX")

# Check for Simpson's paradox — does trend flip when segmented?
overall = df.groupby('treatment')['outcome'].mean()
by_segment = df.groupby(['segment', 'treatment'])['outcome'].mean().unstack()
print("Overall:", overall)
print("By segment:", by_segment)

# Verify sample sizes are adequate for the claims being made
# Rule of thumb: need >30 per group for t-tests; more for rare events
```

## Phase 7: Communicate Findings

**The finding structure:**
```
1. Bottom line up front: the answer in one sentence
2. Evidence: the key numbers that support it
3. Context: what this means relative to baseline/benchmark
4. Confidence: how certain are we? What are the caveats?
5. Recommendation: what decision does this inform?
```

**Example:**
```
FINDING: Conversion rate dropped 2.1 percentage points in Q3, driven primarily 
         by mobile users in the US market.

EVIDENCE: Overall conversion: Q2=8.4%, Q3=6.3% (−2.1pp, −25%)
          Desktop: Q2=9.1%, Q3=9.0% (−0.1pp, flat)
          Mobile US: Q2=7.8%, Q3=4.2% (−3.6pp, −46%)
          Mobile non-US: flat

CONTEXT: This decline coincides with the mobile checkout redesign shipped Aug 12.
         Mobile US traffic is 34% of total sessions = ~$180K estimated revenue impact.

CONFIDENCE: High — large sample sizes, clean segment data, clear timing correlation.
            Causation not proven but timing is compelling.

RECOMMENDATION: Roll back mobile checkout redesign and A/B test changes incrementally.
```

## Python Analysis Starter Template

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

# Settings
pd.set_option('display.max_columns', None)
pd.set_option('display.float_format', lambda x: f'{x:,.2f}')
sns.set_theme(style='whitegrid', palette='muted')

# Load
df = pd.read_csv('data.csv', parse_dates=['date_col'])

# Quick profile
def quick_profile(df):
    print(f"Shape: {df.shape}")
    print(f"\nMissing values:\n{df.isnull().sum()[df.isnull().sum() > 0]}")
    print(f"\nTypes:\n{df.dtypes}")
    print(f"\nSample:\n{df.head()}")
    print(f"\nSummary:\n{df.describe()}")

quick_profile(df)
```

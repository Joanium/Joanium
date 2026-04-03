---
name: Data Pipeline & ETL
trigger: data pipeline, ETL, ELT, data ingestion, data transformation, data warehouse, dbt, Airflow, Prefect, data quality, schema validation, CDC, change data capture, batch processing, streaming pipeline, Kafka, Spark, data lineage, pipeline orchestration, incremental load, full load, data freshness
description: Design reliable, observable ETL/ELT pipelines. Covers pipeline patterns, tool selection, incremental vs full loads, schema validation, idempotency, data quality checks, orchestration, and production reliability.
---

# ROLE
You are a data engineer. Your job is to move data reliably from sources to destinations without losing records, corrupting data, or creating pipelines that break silently. A pipeline that runs successfully but produces wrong data is worse than one that fails loudly.

# CORE PRINCIPLES
```
IDEMPOTENT BY DEFAULT:   Re-running a pipeline must produce the same result. No duplicates, no gaps.
VALIDATE EARLY:          Validate schema and data quality at ingestion, before transformation. Garbage in = garbage out.
FAIL LOUDLY:             Silent failures are catastrophic in data pipelines. Every failure must alert.
INCREMENTAL FIRST:       Prefer incremental over full loads for large datasets. Less risk, faster, cheaper.
LINEAGE IS MANDATORY:    Track where every dataset came from and what transformed it.
SCHEMA EVOLUTION PLAN:   Sources change schemas. Your pipeline must handle it gracefully.
```

# ETL vs ELT

## Choosing the Pattern
```
ETL (Extract → Transform → Load):
  → Transform data BEFORE loading into destination
  → Use when: destination can't handle raw/messy data, compliance requires data scrubbing first
  → Use when: transformations are complex and compute-intensive
  → Tools: Python scripts, Apache Spark, AWS Glue, Talend

ELT (Extract → Load → Transform):
  → Load raw data into destination FIRST, transform inside the warehouse
  → Use when: destination is a cloud data warehouse (BigQuery, Snowflake, Redshift)
  → Use when: you want raw data preserved for replay/reprocessing
  → Tools: Fivetran/Airbyte (ingestion) + dbt (transformation in SQL)
  
RECOMMENDATION: Default to ELT with a modern cloud data warehouse.
  → Raw layer (exact copy of source)
  → Staging layer (dbt models: cleaned, typed, renamed)
  → Mart layer (dbt models: business-level aggregations, ready for BI)
  → Preserve raw indefinitely — you'll want to re-derive from it
```

# TOOL SELECTION

## Ingestion Tools
```
Managed connectors (sync data from SaaS sources, databases):
  → Fivetran — best managed, hundreds of connectors, expensive but zero maintenance
  → Airbyte — open source Fivetran alternative, self-hostable, growing connector library
  → Stitch — simpler, cheaper, fewer connectors
  → Use these when the source has an existing connector — don't build your own

Custom ingestion:
  → Python with pandas/polars for one-off or simple transformations
  → Apache Spark for large-scale distributed processing (>100GB datasets)
  → AWS Glue — managed Spark, good if on AWS, serverless
  → Databricks — best Spark experience, expensive

CDC (Change Data Capture — streaming DB changes):
  → Debezium — open source, captures row-level changes from Postgres/MySQL/Mongo
  → AWS DMS — managed CDC for AWS
  → Use CDC when you need near-real-time sync (minutes, not hours)
```

## Orchestration Tools
```
For most teams (Python, modern, active community):
  → Prefect — best DX, cloud + self-hosted, excellent observability, native retry
  → Dagster — excellent for data-engineering-specific workflows, strong lineage
  → Apache Airflow — most widely used, complex, heavyweight but tons of integrations

Lightweight / scheduled scripts:
  → GitHub Actions / cron jobs for simple pipelines (<5 steps)
  → Cloud scheduler (AWS EventBridge, GCP Cloud Scheduler) → Lambda/Cloud Function

Streaming pipelines:
  → Apache Kafka + Kafka Streams — high-throughput, durable, replayable
  → Apache Flink — stateful stream processing, complex event processing
  → AWS Kinesis + Lambda — serverless streaming on AWS
```

## Transformation: dbt
```
dbt (data build tool) is the standard for SQL-based transformation in ELT.
  → Version-controlled SQL models
  → Dependency graph (DAG) between models
  → Tests built-in (not null, unique, referential integrity, custom)
  → Documentation generated automatically
  → Incremental models built-in

Use dbt if your destination is BigQuery, Snowflake, Redshift, DuckDB, or Postgres.
Do NOT use dbt if transformations require Python, ML, or non-SQL logic.
```

# PIPELINE PATTERNS

## Full Load vs Incremental
```
FULL LOAD:
  → Truncate destination, reload everything from source
  → Simple, always correct, but expensive at scale
  → Use for: small tables (<1M rows), lookups, dimension tables, when source has no timestamps

INCREMENTAL LOAD:
  → Load only records created/modified since last run
  → Requires: reliable updated_at timestamp on source OR CDC
  → Handle late-arriving data: run with overlap window (e.g., last 3 days instead of last 1 day)
  → Use for: large fact tables, high-volume event tables, anything > 1M rows

MERGE (UPSERT):
  → Insert new records, update changed records, optionally delete removed records
  → Destination: BigQuery MERGE, Snowflake MERGE, Redshift MERGE
  → Use for: syncing master data where records can be updated

APPEND-ONLY:
  → Insert new records, never update or delete
  → Simplest incremental pattern — no merge complexity
  → Use for: immutable event logs, audit trails
```

## Idempotent Batch Pipeline
```python
from datetime import datetime, timedelta
import polars as pl

def run_daily_pipeline(execution_date: datetime):
    """
    Idempotent: running this multiple times for the same date produces the same result.
    """
    # 1. Define the window deterministically from execution_date
    window_start = execution_date.replace(hour=0, minute=0, second=0, microsecond=0)
    window_end = window_start + timedelta(days=1)
    partition_key = window_start.strftime('%Y-%m-%d')
    
    # 2. Extract
    raw_df = extract_orders(window_start, window_end)
    
    # 3. Validate schema early
    validate_schema(raw_df, expected_schema={
        'order_id': pl.Utf8,
        'customer_id': pl.Utf8,
        'amount_cents': pl.Int64,
        'created_at': pl.Datetime
    })
    
    # 4. Transform
    transformed_df = transform_orders(raw_df)
    
    # 5. Data quality checks before writing
    assert_not_empty(transformed_df, 'orders')
    assert_no_nulls(transformed_df, ['order_id', 'customer_id'])
    assert_no_duplicates(transformed_df, 'order_id')
    assert_value_range(transformed_df, 'amount_cents', min=0, max=10_000_000)
    
    # 6. Write to destination — overwrite THIS partition only (idempotent)
    write_to_warehouse(
        df=transformed_df,
        table='orders_daily',
        partition={'date': partition_key},
        mode='overwrite'   # overwrite this date's partition, not the whole table
    )
    
    # 7. Record successful run
    record_pipeline_run(pipeline='orders_daily', partition=partition_key, row_count=len(transformed_df))
    
    return {'partition': partition_key, 'rows': len(transformed_df)}
```

## Incremental dbt Model
```sql
-- models/orders_daily.sql
{{
    config(
        materialized='incremental',
        unique_key='order_id',
        incremental_strategy='merge',
        partition_by={'field': 'created_date', 'data_type': 'date'},
        cluster_by=['customer_id']
    )
}}

SELECT
    order_id,
    customer_id,
    total_cents,
    currency,
    status,
    DATE(created_at) AS created_date,
    created_at,
    updated_at,
    CURRENT_TIMESTAMP() AS _ingested_at   -- track when we loaded this row
FROM {{ source('raw', 'orders') }}

{% if is_incremental() %}
    -- Only process records modified since last run (with 3-hour overlap for late data)
    WHERE updated_at >= (
        SELECT TIMESTAMP_SUB(MAX(updated_at), INTERVAL 3 HOUR)
        FROM {{ this }}
    )
{% endif %}
```

# SCHEMA VALIDATION

## Validate At Ingestion (Not Just Transform)
```python
import pandera as pa
from pandera.typing import DataFrame, Series

class OrderSchema(pa.DataFrameModel):
    order_id:    Series[str]   = pa.Field(nullable=False, unique=True)
    customer_id: Series[str]   = pa.Field(nullable=False)
    amount_cents: Series[int]  = pa.Field(ge=0, le=10_000_000)
    currency:    Series[str]   = pa.Field(isin=['USD', 'EUR', 'GBP', 'INR'])
    status:      Series[str]   = pa.Field(isin=['pending', 'completed', 'cancelled', 'refunded'])
    created_at:  Series[pd.Timestamp] = pa.Field(nullable=False)
    
    class Config:
        coerce = True   # try type coercion before failing
        strict = False  # allow extra columns (schema additive changes are OK)

@pa.check_types
def transform_orders(df: DataFrame[OrderSchema]) -> DataFrame:
    # If df doesn't match schema, pandera raises SchemaError with details
    return df.assign(
        amount_dollars=df['amount_cents'] / 100,
        is_large_order=df['amount_cents'] > 100_000
    )
```

# DATA QUALITY CHECKS

## Great Expectations Pattern
```python
import great_expectations as gx

def run_dq_checks(df, suite_name: str):
    context = gx.get_context()
    batch = context.sources.pandas_default.read_dataframe(df)
    
    results = batch.validate(
        expectation_suite_name=suite_name,
        catch_exceptions=False
    )
    
    if not results.success:
        failing = [
            r for r in results.results if not r.success
        ]
        raise DataQualityError(
            f"{len(failing)} DQ checks failed:\n" +
            "\n".join(str(r.expectation_config) for r in failing)
        )
    
    return results

# Define expectations (run once, store to repo):
# suite.expect_column_values_to_not_be_null("order_id")
# suite.expect_column_values_to_be_unique("order_id")
# suite.expect_column_values_to_be_between("amount_cents", min_value=0, max_value=10_000_000)
# suite.expect_table_row_count_to_be_between(min_value=1, max_value=10_000_000)
# suite.expect_column_proportion_of_unique_values_to_be_between("customer_id", min_value=0.01)
```

## Statistical Anomaly Detection
```python
def check_row_count_anomaly(pipeline: str, partition: str, current_count: int):
    # Compare to last 7 days of same pipeline
    historical = get_historical_counts(pipeline, days=7)
    
    if not historical:
        return  # no baseline yet
    
    avg = sum(historical) / len(historical)
    std = statistics.stdev(historical) if len(historical) > 1 else avg * 0.1
    
    z_score = abs(current_count - avg) / std if std > 0 else 0
    
    if z_score > 3:  # 3 standard deviations = likely anomaly
        alert(
            f"[DATA ANOMALY] {pipeline}/{partition}: {current_count} rows "
            f"(expected ~{int(avg)}, z-score={z_score:.1f})"
        )
```

# PIPELINE OBSERVABILITY

## Metadata Table
```sql
CREATE TABLE pipeline_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_name   TEXT NOT NULL,
    partition_key   TEXT NOT NULL,          -- '2024-05-01' or 'full'
    status          TEXT NOT NULL,          -- running, success, failed, skipped
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    duration_seconds INT,
    source_row_count INT,
    output_row_count INT,
    error_message   TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Query: which partitions are missing?
SELECT generate_series::date AS expected_date
FROM generate_series('2024-01-01', CURRENT_DATE, '1 day'::interval)
WHERE generate_series::date NOT IN (
    SELECT partition_key::date
    FROM pipeline_runs
    WHERE pipeline_name = 'orders_daily' AND status = 'success'
);
```

# PRODUCTION CHECKLIST
```
[ ] Pipelines are idempotent — re-running produces same result, no duplicates
[ ] Incremental loads use overlap window (not exact boundaries) for late data
[ ] Schema validation at ingestion — pipeline fails on unexpected schema change
[ ] Data quality checks defined: not null, uniqueness, value ranges, row count
[ ] Statistical anomaly detection on row counts (z-score vs historical baseline)
[ ] Pipeline run metadata stored (start, end, row counts, status, errors)
[ ] Missing partition detection query defined and alerting on gaps
[ ] All failures alert Slack/PagerDuty — no silent failures
[ ] Retry logic configured for transient source failures
[ ] Partial run state not left in destination (atomic partition overwrite)
[ ] Raw data preserved before transformation (never transform in place)
[ ] Lineage tracked (which source table → which dest table, via which pipeline)
[ ] dbt tests run after every model build (not just before deploy)
[ ] Data freshness SLA defined per table (e.g., orders refreshed within 1 hour)
[ ] Alert if freshness SLA breached (last_successful_run > SLA threshold)
[ ] Schema changes in source → alert pipeline owner (don't silently ignore)
[ ] GDPR deletion: pipeline can delete a user's data from all derived tables
```

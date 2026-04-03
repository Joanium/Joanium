---
name: Database Migrations
trigger: database migration, schema migration, DB migration, migrate database, schema change, rename column, add column, zero-downtime migration, migration strategy, Flyway, Alembic, Liquibase, knex migrations, prisma migrate, schema evolution, backward-compatible migration, breaking schema change
description: A complete guide to planning and executing safe database schema changes in production. Use for zero-downtime migrations, large table alterations, column renames, data backfills, rollback strategies, and avoiding the most common migration disasters.
---

Database migrations are schema changes applied to a live production database. Done wrong, they cause downtime, data loss, or corrupt data in ways that are very hard to recover from. Done right, they're invisible to users. The key insight: most migration disasters are caused by doing too much in a single step.

## Why Migrations Are Dangerous

```
A migration is dangerous when:
  1. It holds a table lock (DDL operations on large tables)
     → Reads and writes queue up; the table appears frozen to users
  
  2. It's not backward compatible
     → New code writes data the old code can't read (or vice versa)
     → Rollback deploys the old code to a database it can't understand
  
  3. It runs a long data scan on a large table
     → Full table scan on a 500M row table takes hours; locks the table
  
  4. It assumes the current state of data
     → "Set NOT NULL where field is null" when nulls exist = instant failure

The solution to all four: decompose big migrations into small, backward-compatible steps.
```

## The Expand-Contract Pattern

The safest approach to any breaking schema change.

```
Phase 1 — EXPAND (backward compatible):
  Add the new structure while keeping the old one.
  Both old and new code can read and write.
  Deploy the new code.

Phase 2 — MIGRATE (data backfill):
  Copy/transform existing data to the new structure.
  Background job or batched migration.
  No locks; runs asynchronously.

Phase 3 — CONTRACT (cleanup):
  Remove the old structure once all code uses the new one.
  Safe to do because no code references the old column/table.
```

**Example: Renaming a column (the trap everyone falls into)**
```sql
-- ❌ WRONG: Single step rename
ALTER TABLE users RENAME COLUMN full_name TO display_name;
-- Old code that references `full_name` now breaks instantly

-- ✅ RIGHT: Expand-Contract over 3 deployments

-- STEP 1 (Deploy 1): Add new column, keep old
ALTER TABLE users ADD COLUMN display_name VARCHAR(255);
-- Write trigger to keep both in sync
CREATE TRIGGER sync_display_name
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_name_columns();

-- Deploy new code that reads from display_name, writes to both
-- Old code still reads/writes full_name safely

-- STEP 2 (Background job): Backfill existing rows
UPDATE users 
SET display_name = full_name 
WHERE display_name IS NULL;
-- Do this in batches! See batching section below.

-- STEP 3 (Deploy 2): Remove old column + trigger
-- (Only after ALL code uses display_name)
ALTER TABLE users DROP COLUMN full_name;
DROP TRIGGER sync_display_name ON users;
```

## Common Migration Types and How to Do Them Safely

**Adding a column:**
```sql
-- Safe: adding nullable column (no table lock on most DBs)
ALTER TABLE orders ADD COLUMN notes TEXT;

-- Risky: adding NOT NULL column without default
-- ❌ BAD: locks table while PostgreSQL scans every row
ALTER TABLE orders ADD COLUMN status VARCHAR(20) NOT NULL;

-- ✅ SAFE: add nullable first, backfill, then add constraint
ALTER TABLE orders ADD COLUMN status VARCHAR(20);
-- Backfill existing rows
UPDATE orders SET status = 'pending' WHERE status IS NULL;
-- Then add NOT NULL (PostgreSQL 12+ can do this without full table scan
-- if there are no NULLs present — use a check constraint approach)
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;
```

**Adding an index on a large table:**
```sql
-- ❌ BAD: blocks all reads and writes while index builds
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- ✅ SAFE: CONCURRENTLY — builds index without locking (PostgreSQL)
-- Takes longer but doesn't block production traffic
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);

-- MySQL: ALTER TABLE with ALGORITHM=INPLACE, LOCK=NONE
ALTER TABLE orders ADD INDEX idx_user_id (user_id), ALGORITHM=INPLACE, LOCK=NONE;

-- Note: CONCURRENT index builds can fail on errors; check pg_stat_activity
-- if it was interrupted, you'll have an INVALID index — drop and recreate
SELECT indexname, indexdef FROM pg_indexes 
WHERE tablename = 'orders' AND indexname LIKE '%invalid%';
```

**Adding a foreign key:**
```sql
-- ❌ BAD: validates entire table, acquires lock
ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id);

-- ✅ SAFE: add NOT VALID first (doesn't scan existing rows), then validate separately
ALTER TABLE orders ADD CONSTRAINT fk_user 
  FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;

-- Validate in a separate step (shares lock with readers, doesn't block writes)
ALTER TABLE orders VALIDATE CONSTRAINT fk_user;
```

## Batching Large Data Migrations

Never update millions of rows in a single transaction. Always batch.

```python
# Safe batching pattern — works for any database
def backfill_column(db, batch_size=1000):
    """
    Backfill display_name from full_name in batches.
    Safe for large tables; won't cause lock contention.
    """
    last_id = 0
    total_updated = 0
    
    while True:
        # Process one batch
        rows_updated = db.execute("""
            UPDATE users 
            SET display_name = full_name
            WHERE id > %(last_id)s
              AND display_name IS NULL
            ORDER BY id
            LIMIT %(batch_size)s
            RETURNING id
        """, {'last_id': last_id, 'batch_size': batch_size})
        
        if not rows_updated:
            break  # Done
        
        last_id = max(row['id'] for row in rows_updated)
        total_updated += len(rows_updated)
        
        # Progress logging
        print(f"Backfilled {total_updated} rows, last_id={last_id}")
        
        # Sleep between batches to reduce DB load
        # Remove or reduce for low-traffic periods
        time.sleep(0.1)
    
    print(f"Backfill complete: {total_updated} rows updated")

# Rule of thumb batch sizes:
# Small rows (< 1KB): 1,000-5,000 per batch
# Large rows (1-10KB): 100-500 per batch  
# Very large rows / blobs: 10-50 per batch
# Target: each batch completes in < 1 second
```

**Background job approach (for very large tables):**
```python
# Queue a backfill job that runs during low-traffic windows
class BackfillDisplayNameJob:
    def perform(self):
        batch_size = 500
        last_processed_id = cache.get('backfill:display_name:last_id', 0)
        
        rows = User.where(
            'id > ? AND display_name IS NULL', last_processed_id
        ).order(:id).limit(batch_size)
        
        return if rows.empty?
        
        rows.each do |user|
            user.update_column(:display_name, user.full_name)
        end
        
        cache.set('backfill:display_name:last_id', rows.last.id)
        
        # Re-enqueue if more rows remain
        BackfillDisplayNameJob.perform_later if rows.count == batch_size
```

## Migration Tools

**Flyway (Java, multiple databases):**
```sql
-- V1__create_users.sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- V2__add_display_name.sql  
ALTER TABLE users ADD COLUMN display_name VARCHAR(255);

-- Flyway applies migrations in order, tracks applied versions in schema_history
-- flyway migrate — apply all pending migrations
-- flyway info   — show migration status
-- flyway repair — fix checksum mismatches (when migration files were edited)
```

**Alembic (Python/SQLAlchemy):**
```python
# alembic/versions/abc123_add_display_name.py
def upgrade():
    # Add the new column
    op.add_column('users', sa.Column('display_name', sa.String(255)))
    
    # For large tables, use execute_if or a separate backfill
    op.execute("UPDATE users SET display_name = full_name WHERE display_name IS NULL")

def downgrade():
    op.drop_column('users', 'display_name')
```

## Rollback Strategies

Every migration should have a tested rollback plan before it runs in production.

```
Types of rollbacks:

1. Schema rollback (easy)
   Downgrade migration reverts the schema change.
   Works when: the migration is additive (added a column → drop it)

2. Code rollback only (medium)
   Revert the application deployment; schema stays changed.
   Works when: schema is backward compatible with old code.
   Best approach for most migrations.

3. Data rollback (hard)
   Need to un-transform or restore data.
   Only possible if you: took a snapshot before, or logged original values.
   
   Pre-migration snapshot:
     CREATE TABLE users_pre_migration_2024_01_15 AS SELECT * FROM users;
     -- Keep for 48-72 hours after successful migration, then drop
```

**Pre-flight checklist:**
```
Before every production migration:
  □ Migration has been tested on a production-size data replica
  □ Estimated duration documented (use EXPLAIN ANALYZE on large operations)
  □ Rollback procedure documented and tested
  □ DB backup taken or verified within last N hours
  □ On-call engineer notified / present
  □ Monitoring dashboards open
  □ Low-traffic window scheduled (if migration is risky)
  □ Feature flag available to disable any code using new schema (if needed)
```

## Migration Anti-Patterns

```
❌ Running migrations automatically on deploy without review
   Better: require explicit approval for migrations that alter large tables

❌ Editing a migration file after it's been applied
   Migration tools checksum files; editing causes checksum failures and confusion
   Instead: write a new migration that corrects the previous one

❌ One mega-migration that adds a table, populates data, adds indexes, and adds FKs
   Each of these has different locking behaviors; one failure rolls back everything
   Better: separate migrations for structure, data, indexes, constraints

❌ Deploying new code and its migration simultaneously with no backward compatibility
   If the deploy fails mid-way, old pods read new schema (or vice versa)
   Better: backward-compatible migration deployed separately before the code release

❌ No migration in dev environment (using ORM sync/auto-migrate)
   "Django syncdb", Hibernate auto-ddl, Mongoose auto-sync
   These never match what production will look like
   Better: same migration tool in dev as prod; always
```

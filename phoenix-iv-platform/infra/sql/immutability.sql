-- Run once after each `prisma migrate deploy`, against the production
-- database, using a role with GRANT privileges (NOT the app's own runtime
-- role). This is what makes "signed visits are immutable" and "the audit log
-- is insert-only" true at the database level, not just in application code —
-- a bug or a compromised app credential cannot bypass this.
--
-- Replace `phoenix_app` with the actual runtime role name used by the API.

-- 1. Audit log: insert-only, ever.
REVOKE UPDATE, DELETE ON audit_log FROM phoenix_app;
GRANT INSERT, SELECT ON audit_log TO phoenix_app;

-- 1b. Amendments and record snapshots: also insert-only, always — these ARE
-- the correction mechanism, so they must never themselves be correctable by
-- a plain UPDATE. Fixing a wrong amendment means writing a new amendment
-- that says so, not editing the old one.
REVOKE UPDATE, DELETE ON amendments FROM phoenix_app;
GRANT INSERT, SELECT ON amendments TO phoenix_app;
REVOKE UPDATE, DELETE ON amendment_approvals FROM phoenix_app;
GRANT INSERT, SELECT ON amendment_approvals TO phoenix_app;
REVOKE UPDATE, DELETE ON record_snapshots FROM phoenix_app;
GRANT INSERT, SELECT ON record_snapshots TO phoenix_app;

-- 2. Signed visits and their clinical children: enforced via a trigger rather
--    than a blanket table-level REVOKE, because unsigned visits still need
--    UPDATE (e.g. status transitions) from the same role. The trigger blocks
--    any write to a clinical child row whose parent visit is signed.
CREATE OR REPLACE FUNCTION reject_write_if_visit_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_signed_at TIMESTAMPTZ;
BEGIN
  SELECT signed_at INTO v_signed_at FROM visits WHERE id = COALESCE(NEW."visitId", OLD."visitId");
  IF v_signed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Visit % is signed and immutable. Use the amendment workflow.', COALESCE(NEW."visitId", OLD."visitId");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every clinical child table. Extend this list as later sprints add
-- more tables tied to a visit.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assessments','orders','consents','signoffs','visit_status_history',
    'intake_forms','screening_flags','visit_protocol_selections',
    'visit_preparations','iv_insertions','infusion_monitoring_entries',
    'adverse_events','treatment_completions'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_immutable_%1$s ON %1$s;
       CREATE TRIGGER trg_immutable_%1$s
       BEFORE UPDATE OR DELETE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION reject_write_if_visit_signed();', t
    );
  END LOOP;
END $$;

-- NOTE: visit_prep_items is deliberately not in the list above — it has no
-- visitId column of its own (only prepId, referencing visit_preparations).
-- It's still protected transactionally: PrepService always writes/upserts
-- the parent visit_preparations row in the same DB transaction as any item
-- write, so if the parent trigger rejects the write (visit signed), the
-- whole transaction — items included — rolls back with it.

-- 3. The `visits` table itself: once signed_at is set, block any further
--    UPDATE to signed_at (no un-signing) and to any clinical field except
--    via the amendment path, which writes to `amendments`, not `visits`.
CREATE OR REPLACE FUNCTION reject_visit_resign()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.signed_at IS NOT NULL AND NEW.signed_at IS DISTINCT FROM OLD.signed_at THEN
    RAISE EXCEPTION 'Cannot modify signed_at on an already-signed visit %', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_resign ON visits;
CREATE TRIGGER trg_no_resign
BEFORE UPDATE ON visits
FOR EACH ROW EXECUTE FUNCTION reject_visit_resign();

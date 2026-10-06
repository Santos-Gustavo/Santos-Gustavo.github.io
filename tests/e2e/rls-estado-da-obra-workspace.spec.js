// tests/e2e/rls-estado-da-obra-workspace.spec.js
//
// ESTADO-DA-OBRA-WORKSPACE-001 Phase 1 — focused RLS/security coverage for the
// three new canonical workspace tables (project_work_items, project_incidents,
// project_photos) added by
// supabase/migrations/20261005120000_estado_da_obra_workspace_tables.sql, and
// hardened by 20261006120000_estado_da_obra_workspace_remove_delete_policies.sql
// (no authenticated DELETE — the workspace is soft-delete-only). Nothing in
// the app reads/writes these tables yet, so this is pure DB-layer coverage:
// two real, separately-authenticated Supabase accounts (anon key, no service
// role for the RLS assertions themselves) probing the tables directly, the
// same way tests/e2e/rls-isolation.spec.js proves isolation comes from RLS
// itself and not from app/UI query filtering. The service-role client is used
// only for test-row cleanup, since authenticated DELETE is intentionally
// blocked.

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { APP_ENV } from "../../js/config/env.js";
import { tryReadFixtureState } from "./helpers/e2e-fixtures.js";
import { getServiceRoleClient, hasServiceRoleEnv } from "./helpers/supabase-admin.js";

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

const E2E_OTHER_EMAIL = process.env.E2E_OTHER_EMAIL?.trim();
const E2E_OTHER_PASSWORD = process.env.E2E_OTHER_PASSWORD;

// E2E-FIXTURES-001 — owner A's known project id comes from the fixture state
// file global setup writes (tests/e2e/global-setup.js), not a manually-set id.
const fixtureState = tryReadFixtureState();
const OWNER_A_PROJECT_ID = fixtureState?.projectId;

async function signIn(email, password) {
  const client = createClient(APP_ENV.SUPABASE_URL, APP_ENV.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();

  return client;
}

// Each entry describes just enough of its table's required columns to insert
// a valid row and perform one harmless update, scoped to whatever project_id
// is passed in.
const WORKSPACE_TABLES = [
  {
    table: "project_work_items",
    buildRow: (projectId, label) => ({
      project_id: projectId,
      type: "E2E RLS",
      area: "E2E RLS",
      description: `E2E RLS Workspace Test — ${label}`,
      status: "pending",
    }),
    harmlessUpdate: { status: "in_progress" },
  },
  {
    table: "project_incidents",
    buildRow: (projectId, label) => ({
      project_id: projectId,
      description: `E2E RLS Workspace Test — ${label}`,
    }),
    harmlessUpdate: { status: "resolved" },
  },
  {
    table: "project_photos",
    buildRow: (projectId, label) => ({
      project_id: projectId,
      storage_path: `e2e-rls-workspace-test/${label}.jpg`,
      description: `E2E RLS Workspace Test — ${label}`,
    }),
    harmlessUpdate: { include_in_reports: false },
  },
];

for (const { table, buildRow, harmlessUpdate } of WORKSPACE_TABLES) {
  test(`RLS on ${table}: owner can read/write own rows, a different owner is blocked at the DB layer`, async () => {
    test.setTimeout(30000);

    const missing = [
      !E2E_EMAIL && "E2E_EMAIL",
      !E2E_PASSWORD && "E2E_PASSWORD",
      !E2E_OTHER_EMAIL && "E2E_OTHER_EMAIL",
      !E2E_OTHER_PASSWORD && "E2E_OTHER_PASSWORD",
      !OWNER_A_PROJECT_ID && "fixture project id (run global setup)",
      !hasServiceRoleEnv() && "SUPABASE_SERVICE_ROLE_KEY (needed for test-row cleanup — authenticated DELETE is intentionally blocked)",
    ].filter(Boolean);

    test.skip(
      missing.length > 0,
      `Set ${missing.join(", ")} to enable cross-tenant RLS checks on ${table}.`
    );

    const clientA = await signIn(E2E_EMAIL, E2E_PASSWORD);
    const clientB = await signIn(E2E_OTHER_EMAIL, E2E_OTHER_PASSWORD);

    const label = `${Date.now()}`;
    let insertedId = null;

    try {
      // A. Owner A can INSERT, SELECT, and UPDATE a row on their own project.
      const { data: inserted, error: insertErrorA } = await clientA
        .from(table)
        .insert(buildRow(OWNER_A_PROJECT_ID, label))
        .select()
        .single();

      expect(insertErrorA).toBeNull();
      expect(inserted?.id).toBeTruthy();
      insertedId = inserted.id;

      const { data: readBackA, error: readErrorA } = await clientA
        .from(table)
        .select("*")
        .eq("id", insertedId)
        .maybeSingle();

      expect(readErrorA).toBeNull();
      expect(readBackA?.id).toBe(insertedId);

      const { data: updatedA, error: updateErrorA } = await clientA
        .from(table)
        .update(harmlessUpdate)
        .eq("id", insertedId)
        .select()
        .maybeSingle();

      expect(updateErrorA).toBeNull();
      expect(updatedA?.id).toBe(insertedId);

      // B. A different owner (real second Supabase account, not a UI check)
      // cannot SELECT, UPDATE, or INSERT against owner A's project.
      const { data: selectedByB, error: selectErrorB } = await clientB
        .from(table)
        .select("*")
        .eq("id", insertedId);

      expect(selectErrorB).toBeNull();
      expect(selectedByB).toEqual([]);

      const { data: updatedByB, error: updateErrorB } = await clientB
        .from(table)
        .update({ ...harmlessUpdate, description: "SHOULD NOT APPLY — RLS LEAK" })
        .eq("id", insertedId)
        .select();

      expect(updateErrorB).toBeNull();
      expect(updatedByB ?? []).toEqual([]);

      // Confirm B's update genuinely did not apply (RLS filtered the target
      // row to zero matches, it didn't silently succeed) by re-reading as A.
      const { data: stillUnchanged } = await clientA
        .from(table)
        .select("*")
        .eq("id", insertedId)
        .maybeSingle();

      expect(stillUnchanged?.description).not.toBe("SHOULD NOT APPLY — RLS LEAK");

      // C. Owner B supplying owner A's real project_id on INSERT must fail
      // through RLS's own WITH CHECK, not merely be hidden by app/UI logic —
      // this call goes straight to PostgREST with no UI involved.
      const { data: insertedByB, error: insertErrorB } = await clientB
        .from(table)
        .insert(buildRow(OWNER_A_PROJECT_ID, `${label}-B`))
        .select();

      expect(insertedByB == null || insertedByB.length === 0).toBe(true);
      expect(insertErrorB).toBeTruthy();

      // D. The canonical workspace is soft-delete-only — not even the row's
      // own owner can hard-delete it through authenticated PostgREST, since
      // the *_delete_own policy was intentionally removed. Normal removal is
      // an UPDATE setting deactivated_at, covered by the *_update_own policy
      // already exercised in step A — this only asserts the DELETE path
      // itself is closed.
      const { data: deletedByA, error: deleteErrorA } = await clientA
        .from(table)
        .delete()
        .eq("id", insertedId)
        .select();

      expect(deletedByA ?? []).toEqual([]);

      const { data: survivedDelete, error: survivedError } = await clientA
        .from(table)
        .select("*")
        .eq("id", insertedId)
        .maybeSingle();

      expect(survivedError).toBeNull();
      expect(survivedDelete?.id).toBe(insertedId);
    } finally {
      // Authenticated DELETE is blocked by design (step D above), so test-row
      // cleanup goes through the service-role client, which bypasses RLS —
      // the same pattern tests/e2e/helpers/e2e-fixtures.js uses for fixture
      // teardown.
      if (insertedId) {
        await getServiceRoleClient().from(table).delete().eq("id", insertedId);
      }

      await clientA.auth.signOut();
      await clientB.auth.signOut();
    }
  });
}

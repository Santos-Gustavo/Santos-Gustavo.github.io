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
const OWNER_A_COMPANY_ID = fixtureState?.companyId;

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
      // Phase 4: must be this project's own workspace folder.
      storage_path: `${OWNER_A_COMPANY_ID}/${projectId}/workspace/e2e-rls-${label}.jpg`,
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

// ESTADO-DA-OBRA-WORKSPACE-001 Phase 4 (M) — storage_path hardening at the DB
// boundary (supabase/migrations/20261006140000_generate_report_rpc.sql). A
// project photo may only point into {company_id}/{project_id}/workspace/ of
// its own project, and a report snapshot may only reference photos inside its
// own project's folder — because get-shared-report signs snapshot paths with
// the service-role key. Probed as the authenticated owner straight against
// PostgREST (no UI), plus once as service role to show the trigger isn't
// merely an RLS rule.
test("storage_path hardening: photo rows and report snapshots cannot point outside their own project folder", async () => {
  test.setTimeout(60000);

  const missing = [
    !E2E_EMAIL && "E2E_EMAIL",
    !E2E_PASSWORD && "E2E_PASSWORD",
    !OWNER_A_COMPANY_ID && "fixture company id (run global setup)",
    !hasServiceRoleEnv() && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  test.skip(missing.length > 0, `Set ${missing.join(", ")}.`);

  const admin = getServiceRoleClient();
  const owner = await signIn(E2E_EMAIL, E2E_PASSWORD);
  const stamp = Date.now();

  const { data: fixtureProject } = await admin.from("projects").select("client_id").eq("id", OWNER_A_PROJECT_ID).single();

  async function createProject(name) {
    const { data, error } = await admin
      .from("projects")
      .insert({ company_id: OWNER_A_COMPANY_ID, client_id: fixtureProject.client_id, name, status: 1 })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const projectA = await createProject(`E2E Photo Path A ${stamp}`);
  const projectB = await createProject(`E2E Photo Path B ${stamp}`);

  // Any company the E2E owner doesn't own — the trigger only compares the
  // path against the row's own project, so this is a pure string probe.
  const { data: foreignCompanies } = await admin
    .from("companies")
    .select("id")
    .neq("id", OWNER_A_COMPANY_ID)
    .limit(1);
  const otherCompanyId = foreignCompanies?.[0]?.id || crypto.randomUUID();

  const own = (project, rest) => `${OWNER_A_COMPANY_ID}/${project.id}/${rest}`;

  try {
    const badInsertPaths = {
      "another company": `${otherCompanyId}/${projectA.id}/workspace/x-${stamp}.jpg`,
      "another project (same company)": own(projectB, `workspace/x-${stamp}.jpg`),
      "unrelated folder in own project": own(projectA, `reports/${crypto.randomUUID()}/x-${stamp}.jpg`),
      "unrelated top-level folder": `e2e-unrelated/x-${stamp}.jpg`,
      "nested sub-folder": own(projectA, `workspace/sub/x-${stamp}.jpg`),
      "dot-dot segment": own(projectA, `workspace/../x-${stamp}.jpg`),
      "hidden file": own(projectA, `workspace/.x-${stamp}.jpg`),
      "empty file name": own(projectA, "workspace/"),
    };

    for (const [label, storagePath] of Object.entries(badInsertPaths)) {
      const { data, error } = await owner
        .from("project_photos")
        .insert({ project_id: projectA.id, storage_path: storagePath })
        .select();
      expect(error, `insert with ${label} must fail`).toBeTruthy();
      expect(data ?? []).toEqual([]);
    }

    // The trigger is unconditional — even the service role can't bypass it.
    const { error: adminBadError } = await admin
      .from("project_photos")
      .insert({ project_id: projectA.id, storage_path: badInsertPaths["another company"] });
    expect(adminBadError).toBeTruthy();

    const { count: noRows } = await admin
      .from("project_photos")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectA.id);
    expect(noRows).toBe(0);

    // A valid row, then storage_path / project_id UPDATEs that would re-point it.
    const validPath = own(projectA, `workspace/ok-${stamp}.jpg`);
    const { data: valid, error: validError } = await owner
      .from("project_photos")
      .insert({ project_id: projectA.id, storage_path: validPath })
      .select()
      .single();
    expect(validError).toBeNull();

    const badUpdates = {
      "path to another company": { storage_path: badInsertPaths["another company"] },
      "path to another project": { storage_path: badInsertPaths["another project (same company)"] },
      "path to unrelated folder": { storage_path: badInsertPaths["unrelated folder in own project"] },
      "project_id to another project": { project_id: projectB.id },
    };

    for (const [label, patch] of Object.entries(badUpdates)) {
      const { error } = await owner.from("project_photos").update(patch).eq("id", valid.id);
      expect(error, `update of ${label} must fail`).toBeTruthy();
    }

    const { data: unchanged } = await admin.from("project_photos").select("*").eq("id", valid.id).single();
    expect(unchanged.storage_path).toBe(validPath);
    expect(unchanged.project_id).toBe(projectA.id);

    // Metadata updates that don't touch the path still work.
    const { error: metaError } = await owner.from("project_photos").update({ description: "ok" }).eq("id", valid.id);
    expect(metaError).toBeNull();

    // Report snapshots: a client-written snapshot can't smuggle in a path from
    // outside the report's own project folder (the share link would sign it
    // with the service role) ...
    const snapshotWith = (storagePath) => ({
      schemaVersion: 1,
      meta: { mode: "weekly", reportNumber: 1, reportDate: "2026-10-06" },
      company: {},
      project: {},
      progress: {},
      alert: { enabled: false },
      incidents: { enabled: false, items: [] },
      works: [],
      photos: [{ id: null, storagePath, displayUrl: "" }],
      extras: [],
      nextSteps: [],
    });

    for (const storagePath of [badInsertPaths["another company"], badInsertPaths["another project (same company)"]]) {
      const { error } = await owner
        .from("reports")
        .insert({ project_id: projectA.id, report_num: 1, snapshot_json: snapshotWith(storagePath) })
        .select();
      expect(error, `snapshot with ${storagePath} must be rejected`).toBeTruthy();
    }

    // ... nor be attached later (legacy insert-then-attach path).
    const { data: shell, error: shellError } = await owner
      .from("reports")
      .insert({ project_id: projectA.id, report_num: 1 })
      .select()
      .single();
    expect(shellError).toBeNull();

    const { error: attachBadError } = await owner
      .from("reports")
      .update({ snapshot_json: snapshotWith(badInsertPaths["another company"]) })
      .eq("id", shell.id);
    expect(attachBadError).toBeTruthy();

    const { error: attachOkError } = await owner
      .from("reports")
      .update({ snapshot_json: snapshotWith(validPath) })
      .eq("id", shell.id);
    expect(attachOkError).toBeNull();

    // Once a snapshot exists, the report's frozen content is write-once.
    for (const patch of [
      { snapshot_json: snapshotWith(own(projectA, "workspace/other.jpg")) },
      { works: [{ desc: "rewritten" }] },
      { week_summary: "rewritten" },
      { report_num: 2 },
    ]) {
      const { error } = await owner.from("reports").update(patch).eq("id", shell.id);
      expect(error, `update ${Object.keys(patch)[0]} on a frozen report must fail`).toBeTruthy();
    }

    const { data: frozen } = await admin.from("reports").select("*").eq("id", shell.id).single();
    expect(frozen.snapshot_json.photos[0].storagePath).toBe(validPath);
    expect(frozen.report_num).toBe(1);
  } finally {
    await admin.from("projects").delete().in("id", [projectA.id, projectB.id]);
    await owner.auth.signOut();
  }
});

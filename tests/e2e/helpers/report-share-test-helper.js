// tests/e2e/helpers/report-share-test-helper.js
//
// Seeding helper for the CLIENT-SHARE-LINK-001 specs. Uses a service-role Supabase
// client — this is Node-side Playwright test code, never shipped to the browser, so it
// does not violate AC-04.5 (no service-role key in browser code). It talks to the same
// SECURITY DEFINER RPCs the create/revoke Edge Functions call, so it doesn't need those
// functions deployed just to seed state — only get-shared-report (what share.html
// actually calls) needs to be live for the specs' real assertions.

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const E2E_USER_ID = process.env.E2E_USER_ID;

export function missingShareLinkTestEnv() {
  const missing = [];

  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!E2E_USER_ID) missing.push("E2E_USER_ID");

  return missing;
}

let serviceClient = null;

export function getServiceRoleClient() {
  if (!serviceClient) {
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }

  return serviceClient;
}

export function getFunctionUrl(functionName) {
  return `${SUPABASE_URL}/functions/v1/${functionName}`;
}

export async function createTestShareLink(reportId, ttlHours = 168) {
  const client = getServiceRoleClient();

  const { data, error } = await client.rpc("create_report_share_link", {
    p_report_id: reportId,
    p_user_id: E2E_USER_ID,
    p_ttl_hours: ttlHours,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;

  if (!row?.token) {
    throw new Error(
      `create_report_share_link returned no row — is E2E_USER_ID the owner of report ${reportId}?`,
    );
  }

  return { linkId: row.id, token: row.token, expiresAt: row.expires_at };
}

export function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Backdates both created_at and expires_at (keeping expires_at > created_at, so the
// table's own check constraint still holds) rather than only expires_at, which alone
// would violate report_share_links_expires_after_created.
export async function forceExpireTestLink(token) {
  const client = getServiceRoleClient();
  const hash = tokenHash(token);

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { error } = await client
    .from("report_share_links")
    .update({ created_at: twoHoursAgo, expires_at: oneHourAgo })
    .eq("token_hash", hash);

  if (error) throw error;
}

export async function revokeTestShareLink(linkId) {
  const client = getServiceRoleClient();

  const { data, error } = await client.rpc("revoke_report_share_link", {
    p_link_id: linkId,
    p_user_id: E2E_USER_ID,
  });

  if (error) throw error;

  return Array.isArray(data) ? data[0] : null;
}

export function randomNeverIssuedToken() {
  return crypto.randomBytes(32).toString("base64url");
}

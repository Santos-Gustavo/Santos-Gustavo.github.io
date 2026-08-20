import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const E2E_EMAIL =
  process.env.E2E_EMAIL ||
  process.env.TEST_USER_EMAIL ||
  process.env.PLAYWRIGHT_EMAIL;

const E2E_PASSWORD =
  process.env.E2E_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  process.env.PLAYWRIGHT_PASSWORD;

// test("logged-in user cannot read a project they do not own", async () => {
//   if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
//     throw new Error(
//       "Missing Supabase config. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env."
//     );
//   }

//   if (!E2E_EMAIL || !E2E_PASSWORD) {
//     throw new Error(
//       "Missing E2E login credentials. Set E2E_EMAIL and E2E_PASSWORD in .env."
//     );
//   }

//   const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

//   const { data: authData, error: authError } =
//     await supabase.auth.signInWithPassword({
//       email: E2E_EMAIL,
//       password: E2E_PASSWORD,
//     });

//   if (authError) {
//     throw authError;
//   }

//   const currentUserId = authData.session?.user?.id;

//   if (!currentUserId) {
//     throw new Error("Login succeeded but no user id was returned.");
//   }

//   const { data: ownProjects, error: ownProjectsError } = await supabase
//     .from("projects")
//     .select("id, company_id, client_id, name")
//     .limit(5);

//   if (ownProjectsError) {
//     throw ownProjectsError;
//   }

//   expect(Array.isArray(ownProjects)).toBe(true);

//   const knownForeignProjectId = process.env.E2E_FOREIGN_PROJECT_ID;

//   if (!knownForeignProjectId) {
//     test.skip(
//       true,
//       "Set E2E_FOREIGN_PROJECT_ID in .env to a project owned by another user."
//     );
//   }

//   const { data: foreignProject, error: foreignProjectError } = await supabase
//     .from("projects")
//     .select("id, company_id, client_id, name")
//     .eq("id", knownForeignProjectId)
//     .maybeSingle();

//   if (foreignProjectError) {
//     throw foreignProjectError;
//   }

//   expect(foreignProject).toBeNull();
// });
const { createClient } = require("@supabase/supabase-js");

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function createAdminClient() {
  return createClient(
    requireEnv("E2E_SUPABASE_URL"),
    requireEnv("E2E_SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

async function deleteProjectsByNames(projectNames) {
  if (!Array.isArray(projectNames) || projectNames.length === 0) {
    return;
  }

  const names = [...new Set(projectNames.filter(Boolean))];

  if (names.length === 0) {
    return;
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("projects")
    .delete()
    .in("name", names);

  if (error) {
    throw new Error(`Failed to cleanup E2E projects by name: ${error.message}`);
  }
}

async function deleteProjectsByTestPrefixes() {
  const supabase = createAdminClient();

  const prefixes = [
    "E2E Obra%",
    "E2E_AUTO_%",
    "Refresh %",
    "Refresh Edited %",
    "Edit Persist %",
    "Persist Edited %",
    "Edited No Duplicate %",
    "Shared Company Obra %",
    "Lifecycle Obra %",
    "Bad Scenario %",
    "Cancelled Obra %",
    "No Client Obra %",
  ];

  for (const prefix of prefixes) {
    const { error } = await supabase
      .from("projects")
      .delete()
      .ilike("name", prefix);

    if (error) {
      throw new Error(
        `Failed to cleanup E2E projects with prefix "${prefix}": ${error.message}`
      );
    }
  }
}

async function countProjectsByTestPrefixes() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .or(
      [
        "name.ilike.E2E Obra%",
        "name.ilike.E2E_AUTO_%",
        "name.ilike.Refresh %",
        "name.ilike.Refresh Edited %",
        "name.ilike.Edit Persist %",
        "name.ilike.Persist Edited %",
        "name.ilike.Edited No Duplicate %",
        "name.ilike.Shared Company Obra %",
        "name.ilike.Lifecycle Obra %",
        "name.ilike.Bad Scenario %",
        "name.ilike.Cancelled Obra %",
        "name.ilike.No Client Obra %",
      ].join(",")
    );

  if (error) {
    throw new Error(`Failed to count E2E projects: ${error.message}`);
  }

  return data || [];
}

module.exports = {
  deleteProjectsByNames,
  deleteProjectsByTestPrefixes,
  countProjectsByTestPrefixes,
};
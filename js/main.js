import { supabaseClient } from "#database/supabase-client.js";

async function boot() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("[ESM boot] Supabase session check failed:", error);
    return;
  }

  console.info("[ESM boot] Native ES modules loaded.");
  console.info("[ESM boot] Session:", data.session ? "active" : "none");
}

boot();
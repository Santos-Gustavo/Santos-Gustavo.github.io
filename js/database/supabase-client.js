import { createClient } from "@supabase/supabase-js";
import { SUPABASE_CONFIG } from "#config/supabase-config.js";

export const supabaseClient = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);
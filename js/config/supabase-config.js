import { APP_ENV } from "#config/env.js";

function requireConfigValue(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required config value: ${name}`);
  }

  return value.trim();
}

export const SUPABASE_CONFIG = Object.freeze({
  url: requireConfigValue(APP_ENV.SUPABASE_URL, "SUPABASE_URL"),
  anonKey: requireConfigValue(APP_ENV.SUPABASE_ANON_KEY, "SUPABASE_ANON_KEY"),
});
// ES-module entry for the vendored @supabase/supabase-js 2.117.3 UMD build
// (vendor/supabase-js/supabase.js, MIT). The UMD file declares a global
// `supabase`, so app.html loads it with a classic <script> (which runs before
// any module) and its importmap maps "@supabase/supabase-js" here.
// Upgrading = replace supabase.js with the new dist/umd/supabase.js.
const { createClient } = globalThis.supabase;

export { createClient };

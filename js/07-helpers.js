// ── HELPERS ──────────────────────────────────────────────────────────
function uid() { return Date.now() + Math.random(); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function jobOpts(sel) { return JOB_TYPES.map(t => '<option value="'+esc(t)+'"'+(sel===t?' selected':'')+'>'+esc(t)+'</option>').join(''); }
function areaOpts(sel) { return AREAS.map(a => '<option value="'+esc(a)+'"'+(sel===a?' selected':'')+'>'+esc(a)+'</option>').join(''); }


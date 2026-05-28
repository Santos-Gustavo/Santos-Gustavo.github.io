// ── DATE HELPERS ────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '';
  const [y,m,day] = d.split('-');
  const ms = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return parseInt(day)+' de '+ms[parseInt(m)-1]+' de '+y;
}
function fmtShort(d) {
  if (!d) return '';
  const [y,m,day] = d.split('-'); return day+'/'+m+'/'+y;
}
function fmtRange(s, e) {
  if (!s && !e) return '';
  const ms = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const sa = s?s.split('-'):null, ea = e?e.split('-'):null;
  if (sa && ea) return parseInt(sa[2])+'–'+parseInt(ea[2])+' '+ms[parseInt(ea[1])-1]+' '+ea[0];
  if (sa) return parseInt(sa[2])+' '+ms[parseInt(sa[1])-1]+' '+sa[0];
  return '';
}


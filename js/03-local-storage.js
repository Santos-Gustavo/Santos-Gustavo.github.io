// ── LOCALSTORAGE ────────────────────────────────────────────────────
function loadProjects() {
  try { return JSON.parse(localStorage.getItem('obra_projects') || '[]'); }
  catch(e) { return []; }
}
function saveProjects(ps) {
  localStorage.setItem('obra_projects', JSON.stringify(ps));
}
function getProjectById(id) {
  return loadProjects().find(p => p.id === id) || null;
}


// ── PHASE PICKER ────────────────────────────────────────────────────
function selectPhase(el, phase) {
  document.querySelectorAll('.phase-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  S.phase = phase;
}

// ── TOGGLES ─────────────────────────────────────────────────────────
function toggleAlert() {
  S.alertOn = !S.alertOn;
  document.getElementById('alertToggle').classList.toggle('on', S.alertOn);
  document.getElementById('alertFields').classList.toggle('hidden', !S.alertOn);
}
function toggleIncidents() {
  S.incidentsOn = !S.incidentsOn;
  document.getElementById('incidentsToggle').classList.toggle('on', S.incidentsOn);
  document.getElementById('incidentFields').classList.toggle('hidden', !S.incidentsOn);
}

window.selectPhase = selectPhase;
window.toggleAlert = toggleAlert;
window.toggleIncidents = toggleIncidents;


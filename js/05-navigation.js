// ── NAVIGATION ──────────────────────────────────────────────────────
function getStepEl(id) {
  if (typeof id === 'string' && isNaN(id)) {
    return document.getElementById('step-' + id);
  }
  return document.getElementById('step' + id);
}

function goToStepId(id) {
  getStepEl(S.currentStepId).classList.remove('active');
  S.currentStepId = id;
  getStepEl(id).classList.add('active');
  updateTopBar(id);
  window.scrollTo(0, 0);
}

function updateTopBar(id) {
  const fill = document.getElementById('progressFill');
  const label = document.getElementById('stepLabel');

  if (id === 'projects') {
    fill.style.width = '0%';
    label.textContent = 'Obras';
    return;
  }
  if (id === 'mode') {
    fill.style.width = '3%';
    label.textContent = 'Tipo de Relatório';
    return;
  }

  // Pre-mode new project steps (1, 2)
  if (!S.flow) {
    const pos = id === 1 ? 1 : 2;
    fill.style.width = Math.round(pos / 2 * 100) + '%';
    label.textContent = 'Configuração ' + pos + ' de 2 — ' + (id === 1 ? 'Empresa' : 'Obra');
    return;
  }

  const idx = S.flow.indexOf(id);
  const pos = idx + 1;
  const total = S.flow.length;
  fill.style.width = Math.round(pos / total * 100) + '%';
  label.textContent = 'Passo ' + pos + ' de ' + total + ' — ' + (STEP_NAMES[id] || String(id));
}

function selectMode(mode) {
  S.mode = mode;
  S.flow = [...CONTENT_STEPS[mode]];
  // Reset report content state for a fresh report
  S.phase = '';
  S.alertOn = false;
  S.incidentsOn = false;
  S.works = [];
  S.photos = [];
  S.incidents = [];
  S.extras = [];
  S.nextSteps = [];
  document.getElementById('alertToggle').classList.remove('on');
  document.getElementById('alertFields').classList.add('hidden');
  document.getElementById('incidentsToggle').classList.remove('on');
  document.getElementById('incidentFields').classList.add('hidden');
  document.querySelectorAll('.phase-option').forEach(o => o.classList.remove('selected'));
  document.getElementById('progressSlider').value = 0;
  document.getElementById('progressPct').textContent = '0%';
  document.getElementById('weekSummary').value = '';
  document.getElementById('contractValue').value = '';
  document.getElementById('financialNote').value = '';
  document.getElementById('financialPreview').innerHTML = '';
  document.getElementById('workList').innerHTML = '';
  document.getElementById('photoList').innerHTML = '';
  document.getElementById('incidentList').innerHTML = '';
  document.getElementById('extrasList').innerHTML = '';
  document.getElementById('nextStepsList').innerHTML = '';
  document.getElementById('reviewContent').innerHTML = '';
  goToStepId(S.flow[0]);
}

async function goNext() {
  console.log("goNext clicked. Current step:", S.currentStepId);

  const cur = S.currentStepId;

  // Step 1: company info → project info
  if (cur === 1) {
    goToStepId(2);
    return;
  }

  // Step 2: project info → save project in DB → mode screen
  if (cur === 2) {
    console.log("Saving new project before going to mode...");

    const saved = await saveCurrentProjectFromForm();

    if (!saved) {
      console.warn("Project was not saved. Staying on step 2.");
      return;
    }

    const projectName =
      document.getElementById("projectName")?.value || "Nova Obra";

    document.getElementById("modeProjectLabel").textContent = projectName;

    goToStepId("mode");
    return;
  }

  if (!S.flow) {
    console.warn("No flow selected yet.");
    return;
  }

  const idx = S.flow.indexOf(cur);

  if (idx === -1) {
    console.warn("Current step not found in flow:", cur, S.flow);
    return;
  }

  if (cur === 10) updateFinancialPreview();

  if (idx === S.flow.length - 2) buildReview();

  if (idx < S.flow.length - 1) {
    goToStepId(S.flow[idx + 1]);
  }
}


function goBack() {
  const cur = S.currentStepId;
  if (cur === 1) { goToStepId('projects'); renderProjectList(); return; }
  if (cur === 2) { goToStepId(1); return; }
  if (cur === 'mode') { goToStepId('projects'); renderProjectList(); return; }

  if (!S.flow) return;
  const idx = S.flow.indexOf(cur);
  if (idx <= 0) goToStepId('mode');
  else goToStepId(S.flow[idx - 1]);
}



// ── EXPOSE NAVIGATION FUNCTIONS TO HTML ─────────────────────────────
// Required because index.html uses inline onclick="..."
window.getStepEl = getStepEl;
window.goToStepId = goToStepId;
window.updateTopBar = updateTopBar;
window.selectMode = selectMode;
window.goNext = goNext;
window.goBack = goBack;
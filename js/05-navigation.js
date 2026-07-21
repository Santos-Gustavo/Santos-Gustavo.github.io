// ── NAVIGATION ──────────────────────────────────────────────────────
function getStepEl(id) {
  if (typeof id === 'string' && isNaN(id)) {
    return document.getElementById('step-' + id);
  }
  return document.getElementById('step' + id);
}

function goToStepId(id) {
  const currentStep = getStepEl(S.currentStepId);

  if (currentStep) {
    currentStep.classList.remove("active");
    currentStep.style.display = "";
  }

  S.currentStepId = id;

  const nextStep = getStepEl(id);

  if (!nextStep) {
    console.error("Step not found:", id);
    return;
  }

  // Clear old forced display values from the previous goHome fix
  document.querySelectorAll(".step").forEach(step => {
    step.style.display = "";
  });

  nextStep.classList.add("active");

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

async function selectMode(mode) {
  S.mode = mode;

  if (mode === "weekly") {
    await prepareWeeklyReportFromPrevious();
  }

  if (mode === "weekly") {
    S.flow = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }

  if (mode === "final") {
    S.flow = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }

  if (mode === "financial") {
    S.flow = [10, 11, 12];
  }

  goToStepId(S.flow[0]);
}

async function goNext() {

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

function goHome() {
  S.currentStepId = "projects";
  S.mode = "";
  S.flow = null;

  // IMPORTANT:
  // Do not use style.display here.
  // The app navigation is controlled by the "active" class.
  document.querySelectorAll(".step").forEach(step => {
    step.classList.remove("active");
    step.style.display = "";
  });

  const projectsStep = document.getElementById("step-projects");

  if (projectsStep) {
    projectsStep.classList.add("active");
  }

  const stepLabel = document.getElementById("stepLabel");
  if (stepLabel) {
    stepLabel.textContent = "Obras";
  }

  const progressFill = document.getElementById("progressFill");
  if (progressFill) {
    progressFill.style.width = "0%";
  }

  const modeProjectLabel = document.getElementById("modeProjectLabel");
  if (modeProjectLabel) {
    modeProjectLabel.textContent = "";
  }

  if (typeof renderProjectList === "function") {
    renderProjectList();
  }

  window.scrollTo(0, 0);
}

function showPrefillNotice() {
  alert("Último relatório encontrado. Os dados foram pré-preenchidos. Atualize apenas o que mudou esta semana.");
}


async function prepareWeeklyReportFromPrevious() {
  if (!S.currentProjectId) {
    console.warn("No current project selected. Cannot load previous report.");
    return;
  }

  try {
    const previousReport = await getLatestReportForProject(S.currentProjectId);

    if (!previousReport) {
      console.log("No previous report found. Starting blank weekly report.");
      prepareBlankWeeklyReport();
      return;
    }

    console.log("Previous report loaded:", previousReport);

    applyPreviousReportToForm(previousReport);
    showPrefillNotice();

  } catch (error) {
    console.error("Error preparing weekly report:", error);
    alert("Não foi possível carregar o relatório anterior: " + error.message);

    prepareBlankWeeklyReport();
  }
}

function prepareBlankWeeklyReport() {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  setValue("p-reportNum", "1");
  setValue("p-reportDate", today);
  setValue("p-periodStart", weekAgo.toISOString().split("T")[0]);
  setValue("p-periodEnd", today);

  S.works = [];
  S.photos = [];
  S.incidents = [];
  S.extras = [];
  S.nextSteps = [];

  if (typeof renderWorks === "function") renderWorks();
  if (typeof renderPhotos === "function") renderPhotos();
  if (typeof renderIncidents === "function") renderIncidents();
  if (typeof renderExtras === "function") renderExtras();
  if (typeof renderNextSteps === "function") renderNextSteps();
}


// ── EXPOSE NAVIGATION FUNCTIONS TO HTML ─────────────────────────────
// Required because index.html uses inline onclick="..."

window.getStepEl = getStepEl;
window.goToStepId = goToStepId;
window.updateTopBar = updateTopBar;
window.selectMode = selectMode;
window.goNext = goNext;
window.goBack = goBack;
window.goHome = goHome;
window.selectMode = selectMode;
window.prepareWeeklyReportFromPrevious = prepareWeeklyReportFromPrevious;
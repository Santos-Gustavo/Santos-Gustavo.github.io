// ── PROJECT SELECTION ACTIONS ───────────────────────────────────────

function newProject() {
  S.isNewProject = true;
  S.isEditingProject = false;

  S.currentCompanyId = null;
  S.currentClientId = null;
  S.currentProjectId = null;

  S.flow = null;

  clearProjectForm();
  goToStepId(1);
}

function selectProject(id) {
  const proj = getProjectById(id);

  if (!proj) {
    alert("Obra não encontrada na base de dados.");
    return;
  }

  S.isNewProject = false;
  S.isEditingProject = false;

  S.currentCompanyId = proj.companyId;
  S.currentClientId = proj.clientId;
  S.currentProjectId = proj.id;

  loadProjectIntoForm(proj);

  const modeProjectLabel = document.getElementById("modeProjectLabel");
  if (modeProjectLabel) {
    modeProjectLabel.textContent = proj.name || proj.obra?.projectName || "";
  }

  goToStepId("mode");
}

function editProject(id) {
  const proj = getProjectById(id);

  console.log("EDIT PROJECT CLICKED:", id);
  console.log("PROJECT FOR EDIT:", proj);
  console.log("EDIT IDS:", {
    companyId: proj?.companyId,
    clientId: proj?.clientId,
    projectId: proj?.id
  });
  console.log("EDIT FORM DATA:", proj?.obra);

  if (!proj) {
    alert("Obra não encontrada.");
    return;
  }

  S.isNewProject = false;
  S.isEditingProject = true;

  S.currentCompanyId = proj.companyId;
  S.currentClientId = proj.clientId;
  S.currentProjectId = proj.id;

  loadProjectIntoForm(proj);

  console.log("COMPANY INPUT AFTER LOAD:", document.getElementById("companyName")?.value);
  console.log("PROJECT INPUT AFTER LOAD:", document.getElementById("projectName")?.value);

  goToStepId(1);
}


function getNextPeriodStart(previousPeriodEnd) {
  if (!previousPeriodEnd) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return weekAgo.toISOString().split("T")[0];
  }

  const d = new Date(previousPeriodEnd);
  d.setDate(d.getDate() + 1);

  return d.toISOString().split("T")[0];
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}

function denormalizeSentVia(value) {
  const text = String(value || "").toLowerCase();

  if (text === "whatsapp") return "WhatsApp";
  if (text === "email") return "Email";
  if (text === "pdf_download") return "PDF";
  if (text === "manual") return "Manual";

  return "WhatsApp";
}


function applyPreviousReportToForm(previousReport) {
  if (!previousReport) return;

  const today = new Date().toISOString().split("T")[0];

  const nextReportNum = Number(previousReport.report_num || 0) + 1;

  const nextPeriodStart = getNextPeriodStart(previousReport.period_end);
  const nextPeriodEnd = today;

  setValue("p-reportNum", nextReportNum);
  setValue("p-reportDate", today);
  setValue("p-periodStart", nextPeriodStart);
  setValue("p-periodEnd", nextPeriodEnd);

  setValue("p-distributedTo", previousReport.distributed_to || "");
  setValue("p-sentVia", denormalizeSentVia(previousReport.sent_via));

  setValue("progressPct", previousReport.progress_pct || 0);
  setValue("weekSummary", previousReport.week_summary || "");

  setValue("financialNote", previousReport.financial_note || "");

  setValue("alertTitle", previousReport.alert_title || "");
  setValue("alertDesc", previousReport.alert_desc || "");
  setValue("alertDeadline", previousReport.alert_deadline || "");
  setValue("alertConsequence", previousReport.alert_consequence || "");

  S.phase = previousReport.phase || S.phase || "";
  S.alertOn = Boolean(previousReport.alert_on);
  S.incidentsOn = Boolean(previousReport.incidents_on);

  S.works = Array.isArray(previousReport.works)
    ? structuredClone(previousReport.works)
    : [];

  S.extras = Array.isArray(previousReport.extras)
    ? structuredClone(previousReport.extras)
    : [];

  S.nextSteps = Array.isArray(previousReport.next_steps)
    ? structuredClone(previousReport.next_steps)
    : [];

  // Important: usually reset photos for the new weekly report.
  S.photos = [];

  // Safer default: only copy incidents if incidents were still active.
  S.incidents = previousReport.incidents_on && Array.isArray(previousReport.incidents)
    ? structuredClone(previousReport.incidents)
    : [];

  if (typeof renderWorks === "function") renderWorks();
  if (typeof renderExtras === "function") renderExtras();
  if (typeof renderNextSteps === "function") renderNextSteps();
  if (typeof renderIncidents === "function") renderIncidents();
  if (typeof renderPhotos === "function") renderPhotos();

  if (typeof updatePhaseUI === "function") updatePhaseUI();
  if (typeof updateAlertUI === "function") updateAlertUI();
  if (typeof updateIncidentsUI === "function") updateIncidentsUI();
}
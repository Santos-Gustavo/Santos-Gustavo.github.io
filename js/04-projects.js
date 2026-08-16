// ── PROJECT LIST ────────────────────────────────────────────────────

async function renderProjectList() {
  const el = document.getElementById("projectList");

  if (!el) return;

  el.innerHTML = '<p class="empty-hint">A carregar obras...</p>';

  const projects = await loadProjects();

  if (projects.length === 0) {
    el.innerHTML = `
      <p class="empty-hint">
        Ainda sem obras guardadas na base de dados.<br>
        Clique em "+ Nova Obra" para começar.
      </p>
    `;
    return;
  }

  el.innerHTML = projects.map(p => `
    <div class="project-card">
      <div onclick="selectProject('${esc(p.id)}')" style="cursor:pointer;">
        <div class="project-card-name">${esc(p.name || "—")}</div>
        <div class="project-card-sub">
          ${esc(p.obra.clientName || "")}
          ${p.obra.location ? " · " + esc(p.obra.location) : ""}
        </div>
        <div class="project-card-meta">
          Relatório #${p.lastReportNum || 0}
          ${p.obra.contractNum ? " · " + esc(p.obra.contractNum) : ""}
        </div>
      </div>

      <button class="btn-project-edit" onclick="event.stopPropagation(); editProject('${esc(p.id)}')">
        Editar Obra
      </button>
    </div>
  `).join("");
}

// ── PROJECT ACTIONS ─────────────────────────────────────────────────

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

function editProject(id) {
  const proj = getProjectById(id);

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

  goToStepId(1);
}

function selectProject(id) {
  const proj = getProjectById(id);

  if (!proj) {
    alert("Obra não encontrada na base de dados.");
    return;
  }

  S.isNewProject = false;

  S.currentCompanyId = proj.companyId;
  S.currentClientId = proj.clientId;
  S.currentProjectId = proj.id;

  loadProjectIntoForm(proj);

  document.getElementById("modeProjectLabel").textContent =
    proj.name || proj.obra.projectName || "";

  goToStepId("mode");
}

function clearProjectForm() {
  [
    "companyName",
    "companyTagline",
    "companyNif",
    "companyInci",
    "responsible",
    "companyPhone",
    "companyEmail",
    "projectName",
    "clientName",
    "location",
    "contractNum",
    "distributedTo"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const sentVia = document.getElementById("sentVia");
  if (sentVia) sentVia.value = "WhatsApp";
}

function loadProjectIntoForm(proj) {
  const e = proj.empresa || {};

  document.getElementById("companyName").value = e.companyName || "";
  document.getElementById("companyTagline").value = e.companyTagline || "";
  document.getElementById("companyNif").value = e.companyNif || "";
  document.getElementById("companyInci").value = e.companyInci || "";
  document.getElementById("responsible").value = e.responsible || "";
  document.getElementById("companyPhone").value = e.companyPhone || "";
  document.getElementById("companyEmail").value = e.companyEmail || "";

  const o = proj.obra || {};

  document.getElementById("projectName").value = o.projectName || "";
  document.getElementById("clientName").value = o.clientName || "";
  document.getElementById("location").value = o.location || "";
  document.getElementById("contractNum").value = o.contractNum || "";
  document.getElementById("distributedTo").value = o.distributedTo || "";
  document.getElementById("sentVia").value = o.sentVia || "WhatsApp";

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  document.getElementById("p-reportNum").value = (proj.lastReportNum || 0) + 1;
  document.getElementById("p-reportDate").value = today;
  document.getElementById("p-periodStart").value = weekAgo.toISOString().split("T")[0];
  document.getElementById("p-periodEnd").value = today;
  document.getElementById("p-distributedTo").value = o.distributedTo || "";
  document.getElementById("p-sentVia").value = o.sentVia || "WhatsApp";
}


async function saveCurrentProjectFromForm() {
  const v = getV();

  console.log("saveCurrentProjectFromForm values:", v);
  console.log("Editing mode:", S.isEditingProject);

  try {
    let company;
    let client;
    let project;

    if (
      S.isEditingProject &&
      S.currentCompanyId &&
      S.currentClientId &&
      S.currentProjectId
    ) {
      // EDIT MODE: update existing rows by ID
      company = await updateCompanyById(S.currentCompanyId, v);
      console.log("Company updated:", company);

      client = await updateClientById(S.currentClientId, company.id, v);
      console.log("Client updated:", client);

      project = await updateProjectById(S.currentProjectId, company.id, client.id, v);
      console.log("Project updated:", project);

    } else {
      // NEW PROJECT MODE: find or create rows
      company = await findOrCreateCompany(v);
      console.log("Company saved:", company);

      client = await findOrCreateClient(company.id, v);
      console.log("Client saved:", client);

      project = await findOrCreateProject(company.id, client.id, v);
      console.log("Project saved:", project);
    }

    S.currentCompanyId = company.id;
    S.currentClientId = client.id;
    S.currentProjectId = project.id;
    S.isNewProject = false;

    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    document.getElementById("p-reportNum").value = "1";
    document.getElementById("p-reportDate").value = today;
    document.getElementById("p-periodStart").value = weekAgo.toISOString().split("T")[0];
    document.getElementById("p-periodEnd").value = today;
    document.getElementById("p-distributedTo").value = v.distributedTo || "";
    document.getElementById("p-sentVia").value = v.sentVia || "WhatsApp";

    if (typeof renderProjectList === "function") {
      await renderProjectList();
    }

    return {
      company,
      client,
      project
    };

  } catch (error) {
    console.error("Error saving project:", error);
    alert("Erro ao guardar obra: " + error.message);
    return null;
  }
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


window.renderProjectList = renderProjectList;
window.newProject = newProject;
window.editProject = editProject;
window.selectProject = selectProject;
window.applyPreviousReportToForm = applyPreviousReportToForm;
window.saveCurrentProjectFromForm = saveCurrentProjectFromForm;

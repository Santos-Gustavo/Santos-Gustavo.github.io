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
    <div class="project-card" onclick="selectProject('${esc(p.id)}')">
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
  `).join("");
}


// ── PROJECT ACTIONS ─────────────────────────────────────────────────

function newProject() {
  S.isNewProject = true;

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

  try {
    const company = await findOrCreateCompany(v);
    const client = await findOrCreateClient(company.id, v);
    const project = await findOrCreateProject(company.id, client.id, v);

    S.currentCompanyId = company.id;
    S.currentClientId = client.id;
    S.currentProjectId = project.id;

    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    document.getElementById("p-reportNum").value = "1";
    document.getElementById("p-reportDate").value = today;
    document.getElementById("p-periodStart").value = weekAgo.toISOString().split("T")[0];
    document.getElementById("p-periodEnd").value = today;
    document.getElementById("p-distributedTo").value = v.distributedTo || "";
    document.getElementById("p-sentVia").value = v.sentVia || "WhatsApp";

    await renderProjectList();

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
// ── PROJECT LIST ────────────────────────────────────────────────────
function renderProjectList() {
  const projects = loadProjects();
  const el = document.getElementById('projectList');
  if (projects.length === 0) {
    el.innerHTML = '<p class="empty-hint">Ainda sem obras guardadas.<br>Clique em "+ Nova Obra" para começar.</p>';
    return;
  }
  el.innerHTML = projects.map(p => `
    <div class="project-card" onclick="selectProject('${esc(p.id)}')">
      <div class="project-card-name">${esc(p.name || '—')}</div>
      <div class="project-card-sub">${esc(p.obra.clientName || '')}${p.obra.location ? ' · ' + esc(p.obra.location) : ''}</div>
      <div class="project-card-meta">Relatório #${p.lastReportNum || 0}${p.obra.contractNum ? ' · ' + esc(p.obra.contractNum) : ''}</div>
    </div>
  `).join('');
}

// ── PROJECT ACTIONS ─────────────────────────────────────────────────
function newProject() {
  S.isNewProject = true;
  S.currentProjectId = null;
  S.flow = null;
  clearProjectForm();
  goToStepId(1);
}

function selectProject(id) {
  const proj = getProjectById(id);
  if (!proj) return;
  S.isNewProject = false;
  S.currentProjectId = id;
  loadProjectIntoForm(proj);
  document.getElementById('modeProjectLabel').textContent = proj.name || proj.obra.projectName || '';
  goToStepId('mode');
}

function clearProjectForm() {
  ['companyName','companyTagline','companyNif','companyInci','responsible','companyPhone','companyEmail',
   'projectName','clientName','location','contractNum','distributedTo'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('sentVia').value = 'WhatsApp';
}

function loadProjectIntoForm(proj) {
  const e = proj.empresa || {};
  document.getElementById('companyName').value = e.companyName || '';
  document.getElementById('companyTagline').value = e.companyTagline || '';
  document.getElementById('companyNif').value = e.companyNif || '';
  document.getElementById('companyInci').value = e.companyInci || '';
  document.getElementById('responsible').value = e.responsible || '';
  document.getElementById('companyPhone').value = e.companyPhone || '';
  document.getElementById('companyEmail').value = e.companyEmail || '';

  const o = proj.obra || {};
  document.getElementById('projectName').value = o.projectName || '';
  document.getElementById('clientName').value = o.clientName || '';
  document.getElementById('location').value = o.location || '';
  document.getElementById('contractNum').value = o.contractNum || '';
  document.getElementById('distributedTo').value = o.distributedTo || '';
  document.getElementById('sentVia').value = o.sentVia || 'WhatsApp';

  // Pre-fill period step
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  document.getElementById('p-reportNum').value = (proj.lastReportNum || 0) + 1;
  document.getElementById('p-reportDate').value = today;
  document.getElementById('p-periodStart').value = weekAgo.toISOString().split('T')[0];
  document.getElementById('p-periodEnd').value = today;
  document.getElementById('p-distributedTo').value = o.distributedTo || '';
  document.getElementById('p-sentVia').value = o.sentVia || 'WhatsApp';
}

function saveCurrentProjectFromForm() {
  const get = id => document.getElementById(id).value;
  const proj = {
    id: Date.now().toString(),
    name: get('projectName'),
    empresa: {
      companyName: get('companyName'), companyTagline: get('companyTagline'),
      companyNif: get('companyNif'), companyInci: get('companyInci'),
      responsible: get('responsible'), companyPhone: get('companyPhone'),
      companyEmail: get('companyEmail'),
    },
    obra: {
      projectName: get('projectName'), clientName: get('clientName'),
      location: get('location'), contractNum: get('contractNum'),
      distributedTo: get('distributedTo'), sentVia: get('sentVia'),
    },
    lastReportNum: 0,
  };
  const projects = loadProjects();
  projects.push(proj);
  saveProjects(projects);
  S.currentProjectId = proj.id;

  // Pre-fill period step for the new project
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  document.getElementById('p-reportNum').value = 1;
  document.getElementById('p-reportDate').value = today;
  document.getElementById('p-periodStart').value = weekAgo.toISOString().split('T')[0];
  document.getElementById('p-periodEnd').value = today;
  document.getElementById('p-distributedTo').value = proj.obra.distributedTo;
  document.getElementById('p-sentVia').value = proj.obra.sentVia;
}


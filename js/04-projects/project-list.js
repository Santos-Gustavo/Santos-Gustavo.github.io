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
  <div
  class="project-card"
  onclick="selectProject('${esc(p.id)}')"
>
  <div class="project-card-main">
    <div class="project-card-name">${esc(p.name || "—")}</div>

    <div class="project-card-sub">
      ${esc(p.obra?.clientName || "")}
      ${p.obra?.location ? " · " + esc(p.obra.location) : ""}
    </div>

    <div class="project-card-meta">
      Relatório #${p.lastReportNum || 0}
      ${p.obra?.contractNum ? " · " + esc(p.obra.contractNum) : ""}
    </div>
  </div>

  <div class="project-card-actions" onclick="event.stopPropagation()">
    <button
      type="button"
      class="btn-project-edit"
      onclick="editProject('${esc(p.id)}')"
    >
      Editar
    </button>

    <button
      type="button"
      class="btn-project-delete"
      onclick="deleteProject('${esc(p.id)}')"
    >
      Apagar
    </button>
  </div>
</div>
  `).join("");
}
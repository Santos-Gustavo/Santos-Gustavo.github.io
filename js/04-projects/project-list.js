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
          ${esc(p.obra?.clientName || "")}
          ${p.obra?.location ? " · " + esc(p.obra.location) : ""}
        </div>

        <div class="project-card-meta">
          Relatório #${p.lastReportNum || 0}
          ${p.obra?.contractNum ? " · " + esc(p.obra.contractNum) : ""}
        </div>
      </div>

      <button
        class="btn-project-edit"
        onclick="event.stopPropagation(); editProject('${esc(p.id)}')"
      >
        Editar Obra
      </button>
    </div>
  `).join("");
}
// js/projects/sections/review.js

import { appState } from "#state/app-state.js";
import { getReportFormValues } from "#forms/form-values.js";

let initialized = false;

export function initReviewSection() {
  if (initialized) return;
  initialized = true;

}

export function buildReview() {
  const el = document.getElementById("reviewContent");

  if (!el) {
    console.warn("Review container not found. Expected #reviewContent.");
    return;
  }

  const state = getRuntimeState();
  const values = getReportFormValues();

  if (state.mode === "legal") {
    el.innerHTML = buildLegalReview(values, state);
    return;
  }

  el.innerHTML = buildWeeklyReview(values, state);
}

function buildLegalReview(values, state) {
  const extras = Array.isArray(state.extras) ? state.extras : [];

  const approvedTotal = extras
    .filter((extra) => extra.status === "approved")
    .reduce((sum, extra) => sum + (parseFloat(extra.cost) || 0), 0);

  const pendingTotal = extras
    .filter((extra) => extra.status === "pending")
    .reduce((sum, extra) => sum + (parseFloat(extra.cost) || 0), 0);

  return `
    <div class="review-section">
      <h3>Empresa</h3>
      ${reviewRow("Nome", values.companyName)}
      ${reviewRow("Responsável", values.responsible)}
    </div>

    <div class="review-section">
      <h3>Projeto</h3>
      ${reviewRow("Cliente", values.clientName)}
      ${reviewRow("N.º Contrato", values.contractNum)}
      ${reviewRow("Relatório n.º", values.reportNum)}
    </div>

    <div class="review-section">
      <h3>Legal / Financeiro</h3>
      ${reviewRow("Trabalhos extra", `${extras.length} itens`)}
      ${reviewRow("Aprovados", formatEuro(approvedTotal))}
      ${reviewRow("Pendentes", formatEuro(pendingTotal))}
    </div>
  `;
}

function buildWeeklyReview(values, state) {
  const works = Array.isArray(state.works) ? state.works : [];
  const photos = Array.isArray(state.photos) ? state.photos : [];
  const nextSteps = Array.isArray(state.nextSteps) ? state.nextSteps : [];
  const incidents = Array.isArray(state.incidents) ? state.incidents : [];

  const done = works.filter((work) => work.status === "done").length;
  const progress = works.filter((work) => work.status === "progress").length;
  const blocked = works.filter((work) => work.status === "blocked").length;

  return `
    <div class="review-section">
      <h3>Empresa</h3>
      ${reviewRow("Nome", values.companyName)}
      ${reviewRow("Responsável", values.responsible)}
      ${reviewRow("NIF", values.companyNif)}
    </div>

    <div class="review-section">
      <h3>Projeto</h3>
      ${reviewRow("Nome", values.projectName)}
      ${reviewRow("Cliente", values.clientName)}
      ${reviewRow("Localização", values.location)}
      ${reviewRow("Contrato", values.contractNum)}
      ${reviewRow("Relatório n.º", values.reportNum)}
    </div>

    <div class="review-section">
      <h3>Progresso</h3>
      ${reviewRow("Fase", state.phase)}
      ${reviewRow("Concluído", `${values.progressPct || 0}%`)}
      ${reviewRow("Tarefas", `${done} concl. · ${progress} em curso · ${blocked} pend.`)}
    </div>

    <div class="review-section">
      <h3>Conteúdo</h3>
      ${reviewRow("Trabalhos", `${works.length} itens`)}
      ${reviewRow("Fotos", `${photos.length} fotos`)}
      ${reviewRow("Próximos passos", `${nextSteps.length} itens`)}
      ${reviewRow(
        "Incidentes",
        state.incidentsOn ? `${incidents.length} registado(s)` : "Sem ocorrências",
      )}
      ${reviewRow(
        "Alerta",
        state.alertOn ? `Sim — ${values.alertTitle || "sem título"}` : "Não",
      )}
    </div>
  `;
}

function reviewRow(label, value) {
  return `
    <div class="review-row">
      <span>${escapeHtml(label)}</span>
      <span>${escapeHtml(value || "—")}</span>
    </div>
  `;
}

function formatEuro(value) {
  return Number(value || 0).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
}

function getRuntimeState() {
  return appState;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
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

  el.innerHTML = buildLegalReview(values, state);
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
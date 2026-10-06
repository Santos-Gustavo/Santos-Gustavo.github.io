// js/reports/report-generation-panel.js
//
// ESTADO-DA-OBRA-WORKSPACE-001 Phase 4 — the result of "Gerar relatório" on
// Estado da Obra: loading → success ([Ver PDF] [Partilhar]) or error. Both
// actions work from the SAVED report row (snapshot_json), never from the
// live workspace: "Ver PDF" re-reads the report from the DB through the same
// path as the report history's "Abrir", and "Partilhar" creates the same
// client share link the history creates.

import { openSavedReport } from "#reports/report-history.js";
import { createReportShareLink, buildWhatsAppShareUrl } from "#reports/report-share.js";

const PANEL_ID = "workStatusReportResult";

let initialized = false;
let current = null; // { reportId, reportNum, projectName }

export function initReportGenerationPanel() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handlePanelClick);
}

export function clearGeneratedReportPanel() {
  current = null;
  const panel = getPanel();
  if (!panel) return;
  panel.hidden = true;
  panel.dataset.state = "";
  panel.innerHTML = "";
}

export function showReportGenerating() {
  current = null;
  render("loading", `<p class="report-result-text">A gerar relatório...</p>`);
}

export function showReportGenerationError(message) {
  current = null;
  render(
    "error",
    `<p class="report-result-text report-result-text--error">Erro ao gerar relatório: ${escapeHtml(message)}</p>`
  );
}

export function showGeneratedReport({ report, projectName }) {
  current = { reportId: report.id, reportNum: report.reportNum, projectName: projectName || "" };

  render(
    "success",
    `
      <p class="report-result-text">
        Relatório <strong>#${escapeHtml(String(report.reportNum).padStart(3, "0"))}</strong> gerado.
      </p>
      <div class="report-result-actions">
        <button type="button" class="secondary" data-generated-report-action="view-pdf">Ver PDF</button>
        <button type="button" class="secondary" data-generated-report-action="share">Partilhar</button>
      </div>
      <div class="report-result-share" data-generated-report-share hidden></div>
    `
  );

  const panel = getPanel();
  if (panel) panel.dataset.reportId = report.id;
}

function render(state, html) {
  const panel = getPanel();
  if (!panel) return;
  panel.hidden = false;
  panel.dataset.state = state;
  delete panel.dataset.reportId;
  panel.innerHTML = html;
}

function getPanel() {
  return document.getElementById(PANEL_ID);
}

async function handlePanelClick(event) {
  const button = event.target.closest("[data-generated-report-action]");
  if (!button || !button.closest(`#${PANEL_ID}`)) return;

  event.preventDefault();

  const action = button.dataset.generatedReportAction;

  if (action === "copy-link") {
    handleCopy(button);
    return;
  }

  if (!current?.reportId || button.disabled) return;

  if (action === "view-pdf") {
    try {
      await openSavedReport(current.reportId);
    } catch (error) {
      console.error("Failed to open generated report:", error);
      alert("Erro ao abrir relatório: " + error.message);
    }
    return;
  }

  if (action === "share") {
    await handleShare(button);
  }
}

async function handleShare(button) {
  const shareEl = getPanel()?.querySelector("[data-generated-report-share]");
  if (!shareEl) return;

  const reportId = current.reportId;
  button.disabled = true;

  try {
    const link = await createReportShareLink(reportId);
    if (current?.reportId !== reportId) return;

    const whatsAppUrl = buildWhatsAppShareUrl(link.shareUrl, current.projectName);

    shareEl.hidden = false;
    shareEl.dataset.shareUrl = link.shareUrl;
    shareEl.innerHTML = `
      <input type="text" class="share-link-input" value="${escapeHtml(link.shareUrl)}" readonly>
      <div class="share-panel-actions">
        <button type="button" class="secondary" data-generated-report-action="copy-link">Copiar link</button>
        <a class="secondary" href="${escapeHtml(whatsAppUrl)}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
      </div>
    `;
  } catch (error) {
    console.error("Failed to create share link:", error);
    alert("Erro ao criar link de partilha: " + error.message);
  } finally {
    button.disabled = false;
  }
}

function handleCopy(button) {
  const url = button.closest("[data-generated-report-share]")?.dataset.shareUrl;
  if (!url) return;

  navigator.clipboard
    .writeText(url)
    .then(() => {
      const original = button.textContent;
      button.textContent = "Copiado!";
      setTimeout(() => {
        button.textContent = original;
      }, 2000);
    })
    .catch((error) => {
      console.error("Failed to copy share link:", error);
      alert("Erro ao copiar link.");
    });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// js/reports/report-history.js

import {
  getReportById,
  loadReportsForProject,
} from "#database/db-reports.js";
import { hydrateReportPhotoUrls } from "#reports/report-photo-hydration.js";
import { renderReportHtml } from "#reports/report-renderer.js";
import { openHtmlReportPreview } from "#reports/report-preview.js";
import {
  createReportShareLink,
  revokeReportShareLink,
  buildWhatsAppShareUrl,
} from "#reports/report-share.js";
import { appState } from "#state/app-state.js";

let initialized = false;

export function initReportHistory() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleReportHistoryClick, true);

}

export async function renderReportHistory(projectId = null) {
  const target = document.getElementById("reportHistoryList");

  if (!target) {
    return;
  }

  const resolvedProjectId =
    projectId ||
    appState.currentProjectId ||
    null;

  if (!resolvedProjectId) {
    target.innerHTML = `<p class="empty-hint">Selecione um projeto para ver relatórios anteriores.</p>`;
    return;
  }

  try {
    const reports = await loadReportsForProject(resolvedProjectId);

    if (!reports.length) {
      target.innerHTML = `<p class="empty-hint">Ainda não existem relatórios guardados.</p>`;
      return;
    }

    target.innerHTML = reports.map(renderReportHistoryItem).join("");
  } catch (error) {
    console.error("Failed to render report history:", error);
    target.innerHTML = `<p class="empty-hint">Erro ao carregar relatórios anteriores.</p>`;
  }
}

export async function openSavedReport(reportId) {
  if (!reportId) {
    throw new Error("reportId é obrigatório.");
  }

  const report = await getReportById(reportId);

  if (!report) {
    throw new Error("Relatório não encontrado ou sem permissões.");
  }

  if (!report.snapshotJson) {
    throw new Error("Este relatório não tem snapshot_json.");
  }

  const hydrated = await hydrateReportPhotoUrls(report.snapshotJson);
  const html = renderReportHtml(hydrated);

  return openHtmlReportPreview(html);
}

function renderReportHistoryItem(report) {
  const hasSnapshot = Boolean(report.snapshotJson);

  return `
    <div class="project-card report-history-card" data-report-history-card="${escapeHtml(report.id)}">
      <div class="report-history-row">
        <div>
          <strong>Relatório #${escapeHtml(report.reportNum || "—")}</strong>
          <div class="muted">
            ${escapeHtml(formatShortDate(report.reportDate))}
            · ${hasSnapshot ? "Snapshot disponível" : "Sem snapshot"}
          </div>
        </div>

        <div class="report-history-actions">
          <button
            type="button"
            class="secondary"
            data-report-history-action="open"
            data-report-id="${escapeHtml(report.id)}"
            ${hasSnapshot ? "" : "disabled"}
          >
            Abrir
          </button>

          <button
            type="button"
            class="secondary"
            data-report-history-action="create-share-link"
            data-report-id="${escapeHtml(report.id)}"
            ${hasSnapshot ? "" : "disabled"}
          >
            Criar link para cliente
          </button>
        </div>
      </div>

      <div class="share-panel" data-share-panel hidden></div>
    </div>
  `;
}

function handleReportHistoryClick(event) {
  const button = event.target.closest("[data-report-history-action]");
  if (!button) return;

  const action = button.dataset.reportHistoryAction;
  const reportId = button.dataset.reportId;

  event.preventDefault();

  if (action === "open") {
    openSavedReport(reportId).catch((error) => {
      console.error("Failed to open saved report:", error);
      alert("Erro ao abrir relatório guardado: " + error.message);
    });
    return;
  }

  if (action === "create-share-link") {
    handleCreateShareLink(button, reportId);
    return;
  }

  if (action === "copy-share-link") {
    handleCopyShareLink(button);
    return;
  }

  if (action === "revoke-share-link") {
    handleRevokeShareLink(button);
    return;
  }
}

async function handleCreateShareLink(button, reportId) {
  const card = button.closest("[data-report-history-card]");
  const panel = card?.querySelector("[data-share-panel]");
  if (!panel) return;

  button.disabled = true;

  try {
    const link = await createReportShareLink(reportId);
    const projectName = appState.currentProject?.name || "";
    const whatsAppUrl = buildWhatsAppShareUrl(link.shareUrl, projectName);

    panel.hidden = false;
    panel.dataset.linkId = link.linkId;
    panel.dataset.shareUrl = link.shareUrl;
    panel.innerHTML = renderSharePanel(link.shareUrl, whatsAppUrl);
  } catch (error) {
    console.error("Failed to create share link:", error);
    alert("Erro ao criar link de partilha: " + error.message);
  } finally {
    button.disabled = false;
  }
}

function handleCopyShareLink(button) {
  const panel = button.closest("[data-share-panel]");
  const url = panel?.dataset.shareUrl;
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

async function handleRevokeShareLink(button) {
  const panel = button.closest("[data-share-panel]");
  const linkId = panel?.dataset.linkId;
  if (!linkId) return;

  button.disabled = true;

  try {
    await revokeReportShareLink(linkId);
    panel.innerHTML = `<p class="muted">Link revogado. O cliente deixa de conseguir aceder.</p>`;
  } catch (error) {
    console.error("Failed to revoke share link:", error);
    alert("Erro ao revogar link: " + error.message);
    button.disabled = false;
  }
}

function renderSharePanel(shareUrl, whatsAppUrl) {
  return `
    <input type="text" class="share-link-input" value="${escapeHtml(shareUrl)}" readonly>

    <div class="share-panel-actions">
      <button type="button" class="secondary" data-report-history-action="copy-share-link">
        Copiar link
      </button>

      <a class="secondary" href="${escapeHtml(whatsAppUrl)}" target="_blank" rel="noopener noreferrer">
        Abrir WhatsApp
      </a>

      <button type="button" class="secondary" data-report-history-action="revoke-share-link">
        Revogar link
      </button>
    </div>
  `;
}


function formatShortDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("pt-PT");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
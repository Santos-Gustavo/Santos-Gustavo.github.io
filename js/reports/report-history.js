// js/reports/report-history.js

import {
  getReportById,
  loadReportsForProject,
} from "#database/db-reports.js";
import { hydrateReportPhotoUrls } from "#reports/report-photo-hydration.js";
import { renderReportHtml } from "#reports/report-renderer.js";
import { openHtmlReportPreview } from "#reports/report-preview.js";
import { appState } from "#state/app-state.js";

let initialized = false;

export function initReportHistory() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleReportHistoryClick, true);

  installTemporaryReportHistoryBridge();
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
    target.innerHTML = `<p class="empty-hint">Selecione uma obra para ver relatórios anteriores.</p>`;
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
    <div class="project-card report-history-card">
      <div>
        <strong>Relatório #${escapeHtml(report.reportNum || "—")}</strong>
        <div class="muted">
          ${escapeHtml(formatShortDate(report.reportDate))}
          · ${hasSnapshot ? "Snapshot disponível" : "Sem snapshot"}
        </div>
      </div>

      <button
        type="button"
        class="secondary"
        data-report-history-action="open"
        data-report-id="${escapeHtml(report.id)}"
        ${hasSnapshot ? "" : "disabled"}
      >
        Abrir
      </button>
    </div>
  `;
}

function handleReportHistoryClick(event) {
  const button = event.target.closest("[data-report-history-action]");
  if (!button) return;

  const action = button.dataset.reportHistoryAction;

  if (action !== "open") return;

  event.preventDefault();

  openSavedReport(button.dataset.reportId).catch((error) => {
    console.error("Failed to open saved report:", error);
    alert("Erro ao abrir relatório guardado: " + error.message);
  });
}

function installTemporaryReportHistoryBridge() {
  window.renderReportHistory = renderReportHistory;
  window.openSavedReport = openSavedReport;
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
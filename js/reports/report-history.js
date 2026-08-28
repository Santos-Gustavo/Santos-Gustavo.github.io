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
  loadShareLinkStatusesForReports,
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

    const shareLinkStatuses = await loadShareLinkStatusesForReports(
      reports.map((report) => report.id)
    ).catch((error) => {
      console.error("Failed to load share link statuses:", error);
      return new Map();
    });

    target.innerHTML = reports
      .map((report) => renderReportHistoryItem(report, shareLinkStatuses.get(report.id)))
      .join("");
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

function renderReportHistoryItem(report, shareStatus) {
  const hasSnapshot = Boolean(report.snapshotJson);
  const view = computeShareStatusView(shareStatus);
  const linkIdAttr = shareStatus?.linkId
    ? ` data-link-id="${escapeHtml(shareStatus.linkId)}"`
    : "";

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

      <div class="share-panel" data-share-panel${linkIdAttr} ${view ? "" : "hidden"}>${
        view ? renderSharePanelContent({ view, shareUrl: null, whatsAppUrl: null }) : ""
      }</div>
    </div>
  `;
}

// Derives the badge/text state for a share link from the raw DB fields, per the
// precedence rules in docs/features/CLIENT-SHARE-LINK-001.md (Delivery Telemetry):
// revoked > expired > viewed/not-viewed by access_count. `status` is null when the
// report has no share link yet.
function computeShareStatusView(status) {
  if (!status) return null;

  if (status.revokedAt) {
    return {
      code: "revoked",
      isActive: false,
      badgeClass: "share-status-badge--revoked",
      badgeLabel: "Cancelado",
      secondaryText: "O acesso a este link foi revogado.",
      expiryText: null,
    };
  }

  const expiresAt = status.expiresAt ? new Date(status.expiresAt) : null;
  const isExpired =
    expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now();

  if (isExpired) {
    return {
      code: "expired",
      isActive: false,
      badgeClass: "share-status-badge--expired",
      badgeLabel: "Expirado",
      secondaryText: `Este link expirou em ${formatShortDate(status.expiresAt)}.`,
      expiryText: null,
    };
  }

  const expiryText = `Expira em: ${formatDateTime(status.expiresAt)}`;
  const accessCount = Number(status.accessCount) || 0;

  if (accessCount > 0) {
    // last_accessed_at can be null even when access_count > 0 (e.g. backfilled data) —
    // never fabricate a timestamp in that case, just drop the "Último acesso" prefix.
    const secondaryText = status.lastAccessedAt
      ? `Último acesso: ${formatDateTime(status.lastAccessedAt)} (${accessCount} visualizações)`
      : `${accessCount} visualizações`;

    return {
      code: "viewed",
      isActive: true,
      badgeClass: "share-status-badge--viewed",
      badgeLabel: "Visualizado",
      secondaryText,
      expiryText,
    };
  }

  return {
    code: "not-viewed",
    isActive: true,
    badgeClass: "share-status-badge--not-viewed",
    badgeLabel: "Não visualizado",
    secondaryText: "O cliente ainda não abriu este link.",
    expiryText,
  };
}

function renderShareStatusBlock(view) {
  const expiryHtml = view.expiryText
    ? `<div class="share-status-expiry">${escapeHtml(view.expiryText)}</div>`
    : "";

  return `
    <div class="share-status-row">
      <span class="share-status-badge ${view.badgeClass}">${escapeHtml(view.badgeLabel)}</span>
      <span class="share-status-text">${escapeHtml(view.secondaryText)}</span>
    </div>
    ${expiryHtml}
  `;
}

// A revoked/expired link shows only its status (no URL, no actions — nothing left to
// do with it). An active link shows its status plus whatever actions apply: the share
// URL/copy/WhatsApp only when we actually know the URL (i.e. right after creation —
// only the token hash is persisted, so a page reload can show status but never recover
// the URL), and "Revogar link" whenever the link is still active.
function renderSharePanelContent({ view, shareUrl, whatsAppUrl }) {
  const statusHtml = renderShareStatusBlock(view);

  if (!view.isActive) {
    return statusHtml;
  }

  const urlHtml = shareUrl
    ? `<input type="text" class="share-link-input" value="${escapeHtml(shareUrl)}" readonly>`
    : "";

  const linkActionsHtml = shareUrl
    ? `
      <button type="button" class="secondary" data-report-history-action="copy-share-link">
        Copiar link
      </button>

      <a class="secondary" href="${escapeHtml(whatsAppUrl)}" target="_blank" rel="noopener noreferrer">
        Abrir WhatsApp
      </a>
    `
    : "";

  return `
    ${statusHtml}
    ${urlHtml}
    <div class="share-panel-actions">
      ${linkActionsHtml}
      <button type="button" class="secondary" data-report-history-action="revoke-share-link">
        Revogar link
      </button>
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
    const view = computeShareStatusView({
      linkId: link.linkId,
      expiresAt: link.expiresAt,
      revokedAt: null,
      accessCount: 0,
      lastAccessedAt: null,
    });

    panel.hidden = false;
    panel.dataset.linkId = link.linkId;
    panel.dataset.shareUrl = link.shareUrl;
    panel.innerHTML = renderSharePanelContent({ view, shareUrl: link.shareUrl, whatsAppUrl });
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
    delete panel.dataset.shareUrl;
    panel.innerHTML = renderShareStatusBlock(computeShareStatusView({ revokedAt: new Date().toISOString() }));
  } catch (error) {
    console.error("Failed to revoke share link:", error);
    alert("Erro ao revogar link: " + error.message);
    button.disabled = false;
  }
}

function formatShortDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("pt-PT");
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const datePart = date.toLocaleDateString("pt-PT");
  const timePart = date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

  return `${datePart} ${timePart}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
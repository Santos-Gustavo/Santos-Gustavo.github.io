// js/reports/report-renderer.js

export function renderReportHtml(report) {
  validateReportDocument(report);

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(buildTitle(report))}</title>
  ${renderStyles()}
</head>

<body>
  <button class="print-btn no-print" onclick="window.print()">Imprimir / PDF</button>

  <div class="page">
    ${renderHeader(report)}
    ${report.meta.mode === "legal" ? "" : renderSummary(report)}

    <main class="content">
      ${
        report.meta.mode === "legal"
          ? renderLegalReport(report)
          : renderWeeklyReport(report)
      }
    </main>

    ${renderLegalStrip()}
    ${renderFooter(report)}
  </div>
</body>
</html>`;
}

function validateReportDocument(report) {
  if (!report || typeof report !== "object") {
    throw new Error("Invalid report document.");
  }

  if (!report.meta || !report.company || !report.project) {
    throw new Error("Invalid report document shape.");
  }

  if (!Array.isArray(report.works)) {
    throw new Error("Invalid report document: works must be an array.");
  }

  if (!Array.isArray(report.photos)) {
    throw new Error("Invalid report document: photos must be an array.");
  }

  if (!Array.isArray(report.extras)) {
    throw new Error("Invalid report document: extras must be an array.");
  }

  if (!Array.isArray(report.nextSteps)) {
    throw new Error("Invalid report document: nextSteps must be an array.");
  }
}

function buildTitle(report) {
  return `Relatório de Obra — ${report.project.name || "Obra"}`;
}

function renderHeader(report) {
  const reportId = buildReportId(report);

  return `
    <header class="header">
      <div class="header-top">
        <div class="logo-area">
          <div class="logo-placeholder">LOGO</div>

          <div>
            <div class="company-name">${escapeHtml(report.company.name || "Empresa de Construção")}</div>
            <div class="company-tagline">${escapeHtml(report.company.tagline || "")}</div>
          </div>
        </div>

        <div class="report-badge">
          <div class="label">${report.meta.mode === "legal" ? "Relatório Legal / Financeiro" : "Relatório Semanal"}</div>
          <div class="number">#${escapeHtml(String(report.meta.reportNumber).padStart(3, "0"))}</div>
          <div class="report-id">${escapeHtml(reportId)}</div>
        </div>
      </div>

      <div class="header-info">
        ${infoItem("Obra", report.project.name)}
        ${infoItem("Localização", report.project.location)}
        ${infoItem("Data do Relatório", formatLongDate(report.meta.reportDate))}
        ${infoItem("Cliente", report.project.clientName)}
        ${infoItem("Responsável de Obra", report.company.responsible)}
        ${infoItem("N.º Contrato", report.project.contractNumber, true)}
      </div>
    </header>
  `;
}

function renderSummary(report) {
  return `
    <section class="summary-banner">
      <strong>Resumo da Semana</strong>
      ${escapeHtml(report.progress.weekSummary || "—")}
    </section>
  `;
}

function renderWeeklyReport(report) {
  const done = report.works.filter((work) => work.status === "done").length;
  const progress = report.works.filter((work) => work.status === "progress").length;
  const blocked = report.works.filter((work) => work.status === "blocked").length;

  return `
    <section class="section">
      <div class="section-title">Estado Geral da Obra</div>

      <div class="status-grid">
        ${statusCard("done", "✓", done, "Concluídas")}
        ${statusCard("progress", "●", progress, "Em Curso")}
        ${statusCard("blocked", "!", blocked, "Pendentes")}
      </div>
    </section>

    <section class="section">
      <div class="section-title">Progresso Global da Obra</div>

      <div class="progress-section">
        <div class="progress-label">
          <span>${escapeHtml(report.progress.phase || "Fase atual")}</span>
          <span>${clampPercent(report.progress.percentage)}%</span>
        </div>

        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width:${clampPercent(report.progress.percentage)}%"></div>
        </div>
      </div>
    </section>

    ${renderPhotos(report.photos)}

    <div class="two-col">
      <section class="section">
        <div class="section-title">Trabalhos Concluídos</div>
        <ul class="work-list">
          ${renderWorkList(report.works.filter((work) => work.status === "done"))}
        </ul>
      </section>

      <section class="section">
        <div class="section-title">Em Curso e Pendentes</div>
        <ul class="work-list">
          ${renderWorkList(report.works.filter((work) => work.status !== "done"))}
        </ul>
      </section>
    </div>

    ${report.alert.enabled ? renderAlert(report.alert) : ""}

    <section class="section">
      <div class="section-title">Incidentes e Não-Conformidades</div>
      ${renderIncidents(report.incidents)}
    </section>

    <section class="section">
      <div class="section-title">Próximos Passos</div>
      <ol class="next-steps-list">
        ${renderNextSteps(report.nextSteps)}
      </ol>
    </section>
  `;
}

function renderLegalReport(report) {
  const approved = report.extras
    .filter((extra) => extra.status === "approved")
    .reduce((sum, extra) => sum + extra.cost, 0);

  const pending = report.extras
    .filter((extra) => extra.status === "pending")
    .reduce((sum, extra) => sum + extra.cost, 0);

  return `
    <section class="section">
      <div class="section-title">Trabalhos Extra / Alterações ao Contrato</div>

      ${
        report.extras.length > 0
          ? report.extras.map((extra) => renderExtra(extra, report)).join("")
          : `<p class="muted">Sem trabalhos extra registados.</p>`
      }
    </section>

    <section class="section">
      <div class="section-title">Resumo Financeiro Acumulado</div>

      <table class="financial-table">
        <tr>
          <td class="ft-label">Valor do contrato base</td>
          <td class="ft-value">${formatEuro(report.project.contractValue)}</td>
        </tr>

        ${
          approved > 0
            ? `
              <tr>
                <td class="ft-label ft-positive">Extras aprovados acumulados</td>
                <td class="ft-value ft-positive">+ ${formatEuro(approved)}</td>
              </tr>
            `
            : ""
        }

        ${
          pending > 0
            ? `
              <tr>
                <td class="ft-label ft-pending">Extras pendentes de aprovação</td>
                <td class="ft-value ft-pending">+ ${formatEuro(pending)} (pendente)</td>
              </tr>
            `
            : ""
        }

        <tr class="ft-total">
          <td class="ft-label ft-total-value">Total projetado sem pendentes</td>
          <td class="ft-value ft-total-value">${formatEuro(report.project.contractValue + approved)}</td>
        </tr>
      </table>

      <div class="financial-note">
        ${escapeHtml(
          report.financialNote ||
            `Valores sem IVA. Extras pendentes não incluídos no total até aprovação formal. Ref. contrato ${report.project.contractNumber || "—"}.`,
        )}
      </div>
    </section>

    ${renderAcknowledgement()}
  `;
}

function renderPhotos(photos) {
  const visiblePhotos = photos.filter((photo) => Boolean(photo.displayUrl));

  if (visiblePhotos.length === 0) {
    return "";
  }

  return `
    <section class="section">
      <div class="section-title">Registo Fotográfico</div>

      <div class="photo-grid">
        ${visiblePhotos.map(renderPhoto).join("")}
      </div>
    </section>
  `;
}

function renderPhoto(photo) {
  return `
    <div class="photo-card">
      <div class="photo-frame">
        <img src="${escapeHtml(photo.displayUrl)}" alt="">
      </div>

      <div class="photo-caption">
        <strong>${escapeHtml(photo.area || "Fotografia da obra")}</strong>
        ${escapeHtml(photo.description || "")}

        ${
          photo.worker
            ? `<br>Responsável: ${escapeHtml(photo.worker)}`
            : ""
        }
      </div>
    </div>
  `;
}

function renderWorkList(works) {
  if (!works.length) {
    return `
      <li class="work-item">
        <div class="work-dot progress"></div>
        <div class="work-text muted">—</div>
      </li>
    `;
  }

  return works
    .map((work) => {
      return `
        <li class="work-item">
          <div class="work-dot ${escapeHtml(work.status)}"></div>

          <div class="work-text">
            <span class="work-tag ${escapeHtml(work.status)}">
              ${escapeHtml(getWorkStatusLabel(work.status))}
            </span>

            <br>

            ${
              work.type
                ? `<strong>${escapeHtml(work.type)}</strong> — `
                : ""
            }

            ${escapeHtml(work.description || "—")}

            ${
              work.area
                ? `<div class="work-area">${escapeHtml(work.area)}</div>`
                : ""
            }
          </div>
        </li>
      `;
    })
    .join("");
}

function renderAlert(alert) {
  return `
    <section class="section">
      <div class="alert">
        <strong>▲ ${escapeHtml(alert.title || "Decisão necessária")}</strong>
        <br>
        ${escapeHtml(alert.description || "")}

        ${
          alert.deadline
            ? `
              <div class="alert-deadline">
                Prazo de resposta: ${formatShortDate(alert.deadline)}
                ${
                  alert.consequence
                    ? ` — ${escapeHtml(alert.consequence)}`
                    : ""
                }
              </div>
            `
            : ""
        }
      </div>
    </section>
  `;
}

function renderIncidents(incidents) {
  if (!incidents.enabled || incidents.items.length === 0) {
    return `
      <div class="incidents-empty">
        <div class="incidents-check">✓</div>
        Sem incidentes, não-conformidades ou ocorrências a registar neste período.
      </div>
    `;
  }

  return incidents.items
    .map((incident) => {
      return `
        <div class="incident-row">
          ${escapeHtml(incident.description || "—")}
        </div>
      `;
    })
    .join("");
}

function renderNextSteps(nextSteps) {
  if (!nextSteps.length) {
    return `
      <li class="next-step-item">
        <div class="step-number">1</div>
        <div class="step-text muted">—</div>
      </li>
    `;
  }

  return nextSteps
    .map((step, index) => {
      return `
        <li class="next-step-item">
          <div class="step-number">${index + 1}</div>

          <div class="step-text">
            ${escapeHtml(step.description || "—")}

            ${
              step.date
                ? `<div class="step-date">Previsto: ${formatShortDate(step.date)}</div>`
                : ""
            }
          </div>
        </li>
      `;
    })
    .join("");
}

function renderExtra(extra, report) {
  const isApproved = extra.status === "approved";

  return `
    <div class="extras-card ${isApproved ? "approved-card" : "pending-card"}">
      <div class="extras-header">
        <div class="extras-title-area">
          <div class="extras-ref">
            ${escapeHtml(extra.ref || "—")} · Ref. contrato ${escapeHtml(report.project.contractNumber || "—")}
          </div>

          <div class="extras-title">${escapeHtml(extra.title || "—")}</div>
        </div>

        <span class="extras-status ${isApproved ? "approved" : "pending"}">
          ${isApproved ? "Aprovado" : "Aguarda aprovação"}
        </span>
      </div>

      <div class="extras-desc">
        ${escapeHtml(extra.description || "—")}
      </div>

      <div class="extras-approval ${isApproved ? "" : "waiting"}">
        ${
          isApproved
            ? `
              <div class="approval-label">✓ Aprovação registada</div>
              Aprovado por: ${escapeHtml(extra.approvedBy || "—")}
              <br>
              Método: ${escapeHtml(extra.approvalMethod || "—")} · ${formatShortDate(extra.approvalDate)}
            `
            : `
              <div class="approval-label">■ Aguarda aprovação formal</div>
              ${
                extra.deadline
                  ? `Prazo de resposta: ${formatShortDate(extra.deadline)}<br>`
                  : ""
              }
              Este trabalho não será executado sem aprovação prévia por escrito.
            `
        }
      </div>

      <div class="extras-footer">
        <span>${isApproved ? `Aprovado: ${formatShortDate(extra.approvalDate)}` : "Pendente de aprovação"}</span>
        <span class="extras-cost">+ ${formatEuro(extra.cost)}</span>
      </div>
    </div>
  `;
}

function renderAcknowledgement() {
  return `
    <section class="section">
      <div class="ack-section">
        <div class="ack-header">Acuse de Recibo e Declaração do Cliente</div>

        <div class="ack-body">
          <div class="ack-notice">
            Eventuais discordâncias devem ser comunicadas por escrito no prazo de 48h.
            A falta de resposta não constitui aprovação de trabalhos extra, alterações de preço
            ou alterações ao projeto, salvo se tal estiver expressamente previsto no contrato.
          </div>

          <div class="ack-grid">
            <div class="ack-field">
              <label>Nome do cliente</label>
              <div class="ack-line"></div>
            </div>

            <div class="ack-field">
              <label>Data de receção</label>
              <div class="ack-line"></div>
            </div>

            <div class="ack-field">
              <label>Assinatura</label>
              <div class="ack-line"></div>
            </div>

            <div class="ack-field">
              <label>Observações</label>
              <div class="ack-line"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderLegalStrip() {
  return `
    <div class="legal-strip">
      Este relatório é emitido para efeitos de acompanhamento, comunicação e arquivo documental da obra.
      Não substitui o contrato de empreitada, o Livro de Obra, autos de medição, faturas, licenças,
      projetos aprovados, termos de responsabilidade ou aprovações formais exigidas por lei ou contrato.
      Trabalhos extra, alterações de preço, prazo ou projeto carecem de aprovação expressa por escrito,
      salvo disposição contratual em contrário.
    </div>
  `;
}

function renderFooter(report) {
  const reportId = buildReportId(report);

  return `
    <footer class="footer">
      <div class="footer-company">
        <strong>${escapeHtml(report.company.name || "—")}</strong>

        ${
          report.company.nif
            ? `NIF ${escapeHtml(report.company.nif)}`
            : ""
        }

        ${
          report.company.impic
            ? ` · INCI n.º ${escapeHtml(report.company.impic)}`
            : ""
        }

        <br>
        Relatório ${escapeHtml(reportId)} · gerado ${formatShortDate(report.meta.reportDate)}
      </div>

      <div class="footer-center">Página 1 de 1</div>

      <div class="footer-contact">
        ${escapeHtml(report.company.email || "")}

        ${
          report.company.phone
            ? ` · ${escapeHtml(report.company.phone)}`
            : ""
        }
      </div>
    </footer>
  `;
}

function renderStyles() {
  return `
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1a1a;background:#f5f5f0}
.page{width:210mm;min-height:297mm;margin:0 auto;background:white}
@media print{body{background:white}.page{margin:0;box-shadow:none}@page{margin:0}.no-print{display:none}}
.header{background:#1c2b3a;color:white;padding:28px 36px 24px}
.header-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
.logo-area{display:flex;align-items:center;gap:14px}
.logo-placeholder{width:44px;height:44px;border:2px solid #2e4158;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#8faabe;text-align:center}
.company-name{font-size:20px;font-weight:700}
.company-tagline{font-size:11px;color:#8faabe;margin-top:2px}
.report-badge{text-align:right}
.report-badge .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#8faabe}
.report-badge .number{font-size:22px;font-weight:700;color:#b88a3a}
.report-badge .report-id{font-size:10px;color:#6a8aab;font-family:"Courier New",monospace}
.header-info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;border-top:1px solid #2e4158;padding-top:16px}
.info-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#8faabe;margin-bottom:3px}
.info-value{font-size:12px;font-weight:500;color:white}
.info-value.mono{font-family:"Courier New",monospace;font-size:11px;color:#c8d8e8}
.summary-banner{background:#f0f4f0;border-left:4px solid #3d8b5e;padding:16px 36px;font-size:13px;line-height:1.6;color:#2d4a3a}
.summary-banner strong{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#3d8b5e;margin-bottom:6px}
.content{padding:28px 36px}
.section{margin-bottom:28px}
.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:14px}
.status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.status-card{border-radius:8px;padding:14px 16px;text-align:center}
.status-card.done{background:#f0faf4;border:1px solid #b7e4c7}
.status-card.progress{background:#fff8f0;border:1px solid #fcd9a8}
.status-card.blocked{background:#fff5f5;border:1px solid #fecaca}
.status-icon{font-size:16px;font-weight:700;margin-bottom:4px}
.status-number{font-size:24px;font-weight:700}
.status-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.photo-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px}
.photo-card{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#fff;break-inside:avoid;page-break-inside:avoid}
.photo-frame{width:100%;height:220px;background:#f3f4f6;overflow:hidden}
.photo-frame img{width:100%;height:100%;display:block;object-fit:cover;object-position:center}
.photo-caption{padding:10px 12px;font-size:12px;color:#374151;line-height:1.4}
.photo-caption strong{display:block;color:#111827;margin-bottom:4px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.work-list{list-style:none}
.work-item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #f3f4f6}
.work-dot{width:8px;height:8px;border-radius:50%;margin-top:4px;flex-shrink:0}
.work-dot.done{background:#16a34a}
.work-dot.progress{background:#d97706}
.work-dot.blocked{background:#dc2626}
.work-text{flex:1;font-size:12px;line-height:1.5}
.work-area{font-size:10px;color:#9ca3af;font-weight:500}
.work-tag{font-size:10px;padding:1px 7px;border-radius:4px;font-weight:600}
.work-tag.done{background:#dcfce7;color:#166534}
.work-tag.progress{background:#fef9c3;color:#854d0e}
.work-tag.blocked{background:#fee2e2;color:#991b1b}
.progress-section{background:#f9fafb;border-radius:8px;padding:14px 16px}
.progress-label{display:flex;justify-content:space-between;font-size:11px;font-weight:600;margin-bottom:6px}
.progress-bar-track{background:#e5e7eb;border-radius:99px;height:8px;overflow:hidden}
.progress-bar-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#3d8b5e,#5cb884)}
.alert{background:#fff8f0;border:1px solid #fcd9a8;border-left:4px solid #d97706;border-radius:8px;padding:12px 14px;font-size:11px;color:#78350f;line-height:1.5}
.alert strong{color:#92400e;font-size:12px}
.alert-deadline{margin-top:8px;font-size:10px;color:#a16207;font-weight:600}
.incidents-empty{background:#f9fafb;border:1px dashed #e5e7eb;border-radius:8px;padding:14px 16px;font-size:11px;color:#9ca3af;text-align:center}
.incidents-check{font-size:14px;font-weight:700;color:#16a34a;margin-bottom:4px}
.incident-row{padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:12px}
.next-steps-list{list-style:none}
.next-step-item{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6}
.step-number{width:20px;height:20px;border-radius:50%;background:#1c2b3a;color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.step-text{font-size:12px;line-height:1.5;flex:1}
.step-date{font-size:10px;color:#9ca3af}
.extras-card{border-radius:8px;padding:14px 16px;margin-bottom:10px}
.extras-card.approved-card{background:#f8fdf9;border:1px solid #b7e4c7}
.extras-card.pending-card{background:#fffbf0;border:1px solid #fcd9a8}
.extras-header{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px}
.extras-title-area{flex:1}
.extras-ref{font-size:10px;color:#9ca3af;font-family:"Courier New",monospace;margin-bottom:2px}
.extras-title{font-size:12px;font-weight:600;color:#1a1a1a}
.extras-status{font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px;white-space:nowrap}
.extras-status.pending{background:#fef3c7;color:#92400e}
.extras-status.approved{background:#dcfce7;color:#166534}
.extras-desc{font-size:11px;color:#374151;line-height:1.5;margin-bottom:10px}
.extras-approval{background:#f0faf4;border-radius:6px;padding:8px 10px;margin-bottom:8px;font-size:10px;color:#374151;line-height:1.7}
.extras-approval.waiting{background:#fffbf0}
.approval-label{font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.5px;font-size:10px}
.extras-approval.waiting .approval-label{color:#92400e}
.extras-footer{display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}
.extras-cost{font-weight:700;font-size:13px;color:#1a1a1a}
.financial-table{width:100%;border-collapse:collapse;font-size:12px}
.financial-table td{padding:7px 10px;border-bottom:1px solid #f3f4f6}
.ft-value{text-align:right;font-family:"Courier New",monospace}
.ft-total td{background:#f9fafb;font-weight:700;font-size:13px;border-top:2px solid #e5e7eb}
.ft-positive{color:#d97706}
.ft-pending{color:#9ca3af;font-style:italic}
.financial-note{font-size:11px;color:#6b7280;margin-top:10px;line-height:1.5}
.ack-section{border:1px solid #d1d5db;border-radius:8px;overflow:hidden}
.ack-header{background:#1c2b3a;color:white;padding:10px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.ack-body{padding:16px}
.ack-notice{font-size:11px;color:#374151;line-height:1.6;margin-bottom:14px;background:#f9fafb;padding:10px 12px;border-radius:6px;border-left:3px solid #9ca3af}
.ack-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.ack-field{display:flex;flex-direction:column;gap:4px}
.ack-field label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;font-weight:700}
.ack-line{border-bottom:1px solid #374151;height:24px;width:100%}
.legal-strip{background:#f9fafb;border-top:1px solid #e5e7eb;padding:12px 36px;font-size:9.5px;color:#9ca3af;line-height:1.7;text-align:justify}
.footer{background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 36px;display:flex;justify-content:space-between;align-items:center}
.footer-company{font-size:11px;color:#6b7280}
.footer-company strong{display:block;color:#374151;font-size:12px}
.footer-center{text-align:center;font-size:10px;color:#d1d5db}
.footer-contact{text-align:right;font-size:10px;color:#9ca3af;line-height:1.6}
.print-btn{position:fixed;bottom:24px;right:24px;background:#1c2b3a;color:white;border:none;border-radius:8px;padding:14px 20px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:999}
.muted{color:#9ca3af}
</style>`;
}

function infoItem(label, value, mono = false) {
  return `
    <div class="info-item">
      <div class="info-label">${escapeHtml(label)}</div>
      <div class="info-value ${mono ? "mono" : ""}">${escapeHtml(value || "—")}</div>
    </div>
  `;
}

function statusCard(type, icon, number, label) {
  return `
    <div class="status-card ${escapeHtml(type)}">
      <div class="status-icon">${escapeHtml(icon)}</div>
      <div class="status-number">${Number(number || 0)}</div>
      <div class="status-label">${escapeHtml(label)}</div>
    </div>
  `;
}

function getWorkStatusLabel(status) {
  if (status === "done") return "Concluído";
  if (status === "progress") return "Em Curso";
  if (status === "blocked") return "Pendente";
  return "Estado";
}

function buildReportId(report) {
  const clientSlug = buildClientSlug(report.project.clientName);
  const reportNumber = String(report.meta.reportNumber || "1").padStart(3, "0");

  return `PROJ-${clientSlug}-${reportNumber}`;
}

function buildClientSlug(clientName) {
  const firstName = String(clientName || "CLIENTE").split(" ")[0];

  return firstName
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z]/g, "") || "CLIENTE";
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function formatEuro(value) {
  return Number(value || 0).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
}

function formatLongDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("pt-PT", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
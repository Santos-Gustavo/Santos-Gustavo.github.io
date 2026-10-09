// js/reports/report-renderer-v1.js
//
// FROZEN archival presentation (REPORT-LAYOUT-V2). Every report generated
// before REPORT_LAYOUT_V2_CUTOVER (see report-renderer.js) renders through
// this file, byte-for-byte as it did when it was generated. Do not edit it,
// and do not share helpers/CSS/labels with the v2 renderer — the duplication
// is deliberate so later changes cannot leak into historical reports.

export function renderReportHtmlV1(report) {
  validateReportDocument(report);

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(buildTitle(report))}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
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
  return `Relatório de Projeto — ${report.project.name || "Projeto"}`;
}

function renderHeader(report) {
  const reportId = buildReportId(report);

  return `
    <header class="header">
      <div class="header-top">
        <div class="logo-area">
          ${renderLogo(report)}

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
        ${infoItem("Projeto", report.project.name)}
        ${infoItem("Localização", report.project.location)}
        ${renderReportDateItem(report)}
        ${infoItem("Cliente", report.project.clientName)}
        ${infoItem("Responsável de Projeto", report.company.responsible)}
        ${infoItem("N.º Contrato", report.project.contractNumber, true)}
      </div>
    </header>
  `;
}

function renderSummary(report) {
  const summary = report.progress.weekSummary;

  return `
    <section class="summary-banner">
      <strong>Resumo da Semana</strong>
      ${
        summary
          ? escapeHtml(summary)
          : `<span class="empty-state">Sem resumo registado para este período.</span>`
      }
    </section>
  `;
}

// Canonical snapshots (generate_report) store the Estado da Obra vocabulary
// pending/in_progress/done; legacy snapshots store blocked/progress/done.
// Both render identically — legacy "blocked" was always shown as "Pendente".
function toDisplayWorkStatus(status) {
  if (status === "pending") return "blocked";
  if (status === "in_progress") return "progress";
  return status;
}

function renderWeeklyReport(sourceReport) {
  const report = {
    ...sourceReport,
    works: sourceReport.works.map((work) => ({ ...work, status: toDisplayWorkStatus(work.status) })),
  };

  const done = report.works.filter((work) => work.status === "done").length;
  const progress = report.works.filter((work) => work.status === "progress").length;
  const blocked = report.works.filter((work) => work.status === "blocked").length;

  return `
    <section class="section">
      <div class="section-title">Estado Geral do Projeto</div>

      <div class="status-grid">
        ${statusCard("done", done, "Concluídas")}
        ${statusCard("progress", progress, "Em Curso")}
        ${statusCard("blocked", blocked, "Pendentes")}
      </div>
    </section>

    <section class="section">
      <div class="section-title">Progresso Global do Projeto</div>

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
          ${renderWorkList(
            report.works.filter((work) => work.status === "done"),
            "Sem trabalhos concluídos registados.",
          )}
        </ul>
      </section>

      <section class="section">
        <div class="section-title">Em Curso e Pendentes</div>
        <ul class="work-list">
          ${renderWorkList(
            report.works.filter((work) => work.status !== "done"),
            "Sem trabalhos em curso ou pendentes registados.",
          )}
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
        <strong>${escapeHtml(photo.area || "Fotografia do projeto")}</strong>
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

function renderWorkList(works, emptyMessage) {
  if (!works.length) {
    return `
      <li class="work-item">
        <div class="work-text empty-state">${escapeHtml(emptyMessage)}</div>
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
      // status only exists on canonical snapshots (open/resolved).
      const statusTag =
        incident.status === "resolved"
          ? `<span class="work-tag done">Resolvido</span> `
          : incident.status === "open"
            ? `<span class="work-tag open">Em aberto</span> `
            : "";

      return `
        <div class="incident-row">
          ${statusTag}${escapeHtml(incident.description || "—")}
        </div>
      `;
    })
    .join("");
}

function renderNextSteps(nextSteps) {
  if (!nextSteps.length) {
    return `
      <li class="next-step-item">
        <div class="step-text empty-state">Sem próximos passos registados.</div>
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
      Este relatório é emitido para efeitos de acompanhamento, comunicação e arquivo documental do projeto.
      Não substitui o contrato de empreitada, o Livro de Projeto, autos de medição, faturas, licenças,
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
  // "Tijolo e Cal": the contractor's identity leads; terracotta (#A84B2A /
  // #8F3D21) only as a thin rule and restrained section accents. Status tags
  // always carry a text label plus a bordered tint so they survive grayscale.
  return `
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,Arial,sans-serif;font-size:13px;color:#22252A;background:#F6F3EE}
.page{position:relative;width:210mm;margin:0 auto;background:#ffffff}
@media screen{.page{min-height:297mm}}
@media print{body{background:#ffffff}.page{margin:0;min-height:0;box-shadow:none;border:none}@page{size:A4;margin:6mm}.no-print{display:none}.header,.footer,.legal-strip,.progress-section{background:#ffffff}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.page::before,.page::after{content:"";position:absolute;top:10mm;width:10mm;height:10mm;pointer-events:none;z-index:1}
.page::before{left:10mm}
.page::after{right:10mm}
.header{background:#ffffff;color:#22252A;padding:28px 36px 24px;border-bottom:2px solid #A84B2A}
.header-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
.logo-area{display:flex;align-items:center;gap:14px}
.logo-placeholder{width:44px;height:44px;border:1px solid #8F8B83;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#5C5A55;text-align:center;background:#ffffff}
.logo-image{flex:0 0 64px;width:64px;height:64px;object-fit:contain;border-radius:6px;background:#ffffff;display:block}
.company-name{font-size:21px;font-weight:600;color:#22252A}
.company-tagline{font-size:11px;color:#5C5A55;margin-top:2px}
.report-badge{text-align:right}
.report-badge .label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:#5C5A55}
.report-badge .number{font-size:22px;font-weight:600;color:#22252A;font-variant-numeric:tabular-nums}
.report-badge .report-id{font-size:10px;color:#5C5A55}
.header-info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;border-top:1px solid #D9D2C7;padding-top:16px}
.info-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:#5C5A55;margin-bottom:3px}
.info-value{font-size:12px;font-weight:600;color:#22252A}
.info-value.mono{font-size:11px;font-weight:400;color:#22252A;font-variant-numeric:tabular-nums}
.summary-banner{background:#ffffff;border-left:3px solid #A84B2A;padding:16px 36px;font-size:13px;line-height:1.6;color:#22252A}
.summary-banner strong{display:block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:#8F3D21;margin-bottom:6px}
.summary-banner .empty-state{color:#5C5A55;font-style:italic}
.content{padding:28px 36px}
.content>:last-child{margin-bottom:0}
.section{margin-bottom:28px}
.section-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#8F3D21;border-bottom:1px solid #D9D2C7;padding-bottom:6px;margin-bottom:14px}
.status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.status-card{border-radius:4px;padding:12px 16px;text-align:left;background:#ffffff;border:1px solid #D9D2C7;border-left-width:3px}
.status-card.done{border-left-color:#1F5E3A}
.status-card.progress{border-left-color:#7A4A06}
.status-card.blocked{border-left-color:#3D4652}
.status-number{font-size:22px;font-weight:600;color:#22252A;font-variant-numeric:tabular-nums}
.status-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#5C5A55;margin-top:2px}
.photo-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px}
.photo-card{border:1px solid #D9D2C7;border-radius:4px;overflow:hidden;background:#fff;break-inside:avoid;page-break-inside:avoid}
.photo-frame{width:100%;height:220px;background:#F6F3EE;overflow:hidden}
.photo-frame img{width:100%;height:100%;display:block;object-fit:cover;object-position:center}
.photo-caption{padding:10px 12px;font-size:12px;color:#5C5A55;line-height:1.4}
.photo-caption strong{display:block;color:#22252A;margin-bottom:4px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.work-list{list-style:none}
.work-item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #D9D2C7}
.work-dot{width:8px;height:8px;border-radius:50%;margin-top:4px;flex-shrink:0}
.work-dot.done{background:#1F5E3A}
.work-dot.progress{background:#7A4A06}
.work-dot.blocked{background:#3D4652}
.work-text{flex:1;font-size:12px;line-height:1.5;color:#22252A}
.work-area{font-size:10px;color:#5C5A55}
.work-tag{display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:1px 7px;border-radius:3px;font-weight:600;border:1px solid currentColor;vertical-align:1px}
.work-tag.done{background:#E6F2EA;color:#1F5E3A}
.work-tag.progress{background:#FCF1DC;color:#7A4A06}
.work-tag.blocked{background:#ECEEF1;color:#3D4652}
.work-tag.open{background:#FBE8EC;color:#7A0D29}
.work-tag.open::before{content:"";width:10px;height:10px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2 1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2 1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z'/%3E%3C/svg%3E") center/contain no-repeat}
.empty-state{color:#5C5A55;font-style:italic;font-size:12px}
.progress-section{background:#ffffff;border-radius:4px;padding:14px 16px;border:1px solid #D9D2C7}
.progress-label{display:flex;justify-content:space-between;font-size:11px;font-weight:600;margin-bottom:6px;color:#22252A}
.progress-bar-track{background:#ECEEF1;border:1px solid #8F8B83;border-radius:99px;height:10px;overflow:hidden}
.progress-bar-fill{height:100%;border-radius:99px;background:#22252A}
.alert{background:#FCF1DC;border:1px solid #7A4A06;border-left:4px solid #7A4A06;border-radius:4px;padding:12px 14px;font-size:11px;color:#22252A;line-height:1.5}
.alert strong{color:#7A4A06;font-size:12px}
.alert-deadline{margin-top:8px;font-size:10px;color:#7A4A06;font-weight:600}
.incidents-empty{background:#E6F2EA;border:1px solid #1F5E3A;border-radius:4px;padding:14px 16px;font-size:11px;color:#22252A;text-align:center}
.incidents-check{font-size:14px;font-weight:600;color:#1F5E3A;margin-bottom:4px}
.incident-row{padding:10px 0;border-bottom:1px solid #D9D2C7;font-size:12px;color:#22252A}
.next-steps-list{list-style:none}
.next-step-item{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #D9D2C7}
.step-number{width:20px;height:20px;border-radius:50%;background:#ffffff;border:1px solid #22252A;color:#22252A;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.step-text{font-size:12px;line-height:1.5;flex:1;color:#22252A}
.step-date{font-size:10px;color:#5C5A55}
.extras-card{border-radius:4px;padding:14px 16px;margin-bottom:10px;background:#ffffff;border:1px solid #D9D2C7}
.extras-card.approved-card{border-left:3px solid #1F5E3A}
.extras-card.pending-card{border-left:3px solid #7A4A06}
.extras-header{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px}
.extras-title-area{flex:1}
.extras-ref{font-size:10px;color:#5C5A55;margin-bottom:2px}
.extras-title{font-size:12px;font-weight:600;color:#22252A}
.extras-status{font-size:10px;font-weight:600;padding:3px 10px;border-radius:3px;white-space:nowrap;border:1px solid currentColor}
.extras-status.pending{background:#FCF1DC;color:#7A4A06}
.extras-status.approved{background:#E6F2EA;color:#1F5E3A}
.extras-desc{font-size:11px;color:#5C5A55;line-height:1.5;margin-bottom:10px}
.extras-approval{background:#E6F2EA;border-radius:4px;padding:8px 10px;margin-bottom:8px;font-size:10px;color:#22252A;line-height:1.7}
.extras-approval.waiting{background:#FCF1DC}
.approval-label{font-weight:600;color:#1F5E3A;text-transform:uppercase;letter-spacing:.5px;font-size:10px}
.extras-approval.waiting .approval-label{color:#7A4A06}
.extras-footer{display:flex;justify-content:space-between;font-size:10px;color:#5C5A55;border-top:1px solid #D9D2C7;padding-top:8px}
.extras-cost{font-weight:600;font-size:13px;color:#22252A;font-variant-numeric:tabular-nums}
.financial-table{width:100%;border-collapse:collapse;font-size:12px}
.financial-table td{padding:7px 10px;border-bottom:1px solid #D9D2C7;color:#22252A}
.ft-value{text-align:right;font-variant-numeric:tabular-nums}
.ft-total td{background:#F6F3EE;font-weight:600;font-size:13px;border-top:2px solid #22252A}
.ft-positive{color:#7A4A06}
.ft-pending{color:#5C5A55;font-style:italic}
.financial-note{font-size:11px;color:#5C5A55;margin-top:10px;line-height:1.5}
.ack-section{border:1px solid #D9D2C7;border-radius:4px;overflow:hidden}
.ack-header{background:#22252A;color:#ffffff;padding:10px 16px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.ack-body{padding:16px}
.ack-notice{font-size:11px;color:#5C5A55;line-height:1.6;margin-bottom:14px;background:#F6F3EE;padding:10px 12px;border-radius:4px;border-left:3px solid #8F8B83}
.ack-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.ack-field{display:flex;flex-direction:column;gap:4px}
.ack-field label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#5C5A55;font-weight:600}
.ack-line{border-bottom:1px solid #22252A;height:24px;width:100%}
.legal-strip{background:#F6F3EE;border:1px solid #D9D2C7;border-left:3px solid #A84B2A;border-radius:4px;margin:0 36px 16px;padding:12px 14px;font-size:9.5px;color:#5C5A55;line-height:1.7;text-align:justify}
.footer{background:#ffffff;border-top:1px solid #D9D2C7;padding:16px 36px;display:flex;justify-content:space-between;align-items:center}
.footer-company{font-size:11px;color:#5C5A55}
.footer-company strong{display:block;color:#22252A;font-size:12px}
.footer-center{text-align:center;font-size:10px;color:#5C5A55}
.footer-contact{text-align:right;font-size:10px;color:#5C5A55;line-height:1.6}
.print-btn{position:fixed;bottom:24px;right:24px;background:#22252A;color:#ffffff;border:none;border-radius:8px;min-height:48px;padding:12px 20px;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:999}
.muted{color:#5C5A55}
</style>`;
}

// Company logo (company.logoUrl, signed from the snapshot's company.logoPath)
// in a fixed box with object-fit: contain, so every logo renders at the same
// size. Reports without one keep the original "LOGO" placeholder unchanged.
function renderLogo(report) {
  const logoUrl = report.company?.logoUrl;
  if (!logoUrl) {
    return `<div class="logo-placeholder">LOGO</div>`;
  }

  return `<img class="logo-image" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(report.company.name || "Logótipo")}" />`;
}

// The period is shown only on canonical reports (generate_report, which
// derives it server-side). Legacy snapshots stored a wizard-prefilled period
// that was never displayed and is often stale, so they render exactly as
// before.
function renderReportDateItem(report) {
  const { periodStart, periodEnd } = report.meta;
  if (report.source !== "canonical" || !periodStart || !periodEnd) {
    return infoItem("Data do Relatório", formatLongDate(report.meta.reportDate));
  }

  return `
    <div class="info-item">
      <div class="info-label">Data do Relatório</div>
      <div class="info-value">${escapeHtml(formatLongDate(report.meta.reportDate))}</div>
      <div class="info-value mono" data-report-period>Período ${escapeHtml(formatPeriodDate(periodStart))} – ${escapeHtml(formatPeriodDate(periodEnd))}</div>
    </div>
  `;
}

// "2026-09-30" -> "30/09/2026" without going through Date, so the viewer's
// time zone can never shift a date-only value by a day.
function formatPeriodDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : formatShortDate(value);
}

function infoItem(label, value, mono = false) {
  return `
    <div class="info-item">
      <div class="info-label">${escapeHtml(label)}</div>
      <div class="info-value ${mono ? "mono" : ""}">${escapeHtml(value || "—")}</div>
    </div>
  `;
}

function statusCard(type, number, label) {
  return `
    <div class="status-card ${escapeHtml(type)}">
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
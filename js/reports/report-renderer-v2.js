// js/reports/report-renderer-v2.js
//
// Report layout v2 (REPORT-LAYOUT-V2): reports generated on/after
// REPORT_LAYOUT_V2_CUTOVER (see report-renderer.js). Pure and import-free.
//
// On screen it is a responsive web document (the share link on a phone).
// Print/PDF goes through the vendored Paged.js (vendor/pagedjs/), loaded only
// when the reader clicks "Imprimir / PDF" (or Ctrl/Cmd+P): A4 pages, 18 mm
// margins, "Página X de Y" footer in the @page margin boxes, unbreakable
// cards, and "(cont.)" headings on lists that continue onto the next page.
// A print started from the browser menu skips Paged.js and falls back to the
// same @page CSS natively (no "(cont.)" headings there).

// Vendored assets, resolved at render time against the page doing the
// rendering (app.html / share.html, both at the site root): the rendered
// document itself is a blob: URL or an iframe srcdoc and has no usable base.
// Static Inter 400/600 (vendor/fonts/inter, OFL): Chrome embeds static fonts in
// the PDF as real, searchable fonts (Google's variable Inter only embeds as
// Type 3 outlines). No Google Fonts request: 'Inter' in FONT_STACK only
// matches a locally installed Inter, else system-ui.
const PAGED_JS_PATH = "vendor/pagedjs/paged.polyfill.min.js";
const INTER_400_PATH = "vendor/fonts/inter/inter-latin-400-normal.woff2";
const INTER_600_PATH = "vendor/fonts/inter/inter-latin-600-normal.woff2";
const FONT_STACK = "'Inter Report','Inter',system-ui,Arial,sans-serif";

// One mapping for every status shown in the report (tasks + ocorrências).
const STATUS_LABELS = {
  pending: "Pendente",
  in_progress: "Em curso",
  done: "Concluída",
  open: "Em aberto",
  resolved: "Resolvido",
};

// Legacy work codes (blocked/progress) → canonical vocabulary.
const LEGACY_WORK_STATUS = { blocked: "pending", progress: "in_progress" };

const STATUS_CLASS = {
  pending: "pending",
  in_progress: "in-progress",
  done: "done",
  open: "open",
  resolved: "resolved",
};

const PHOTO_STAGE_LABELS = { before: "Antes", during: "Durante", after: "Depois" };

const OTHER_CATEGORY = "Outro";

export function renderReportHtmlV2(report) {
  validateReportDocument(report);

  const works = report.works.map((work) => ({ ...work, status: normalizeWorkStatus(work.status) }));

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(buildTitle(report))}</title>
  ${renderStyles(report)}
</head>

<body>
  <button type="button" class="print-btn no-print" data-print-report onclick="window.__reportPrint && window.__reportPrint.print()">Imprimir / PDF</button>

  <div class="doc">
    ${renderHeader(report)}

    <main class="content">
      ${renderSituation(report)}
      ${renderStatusCounts(works)}
      ${renderPhotos(report.photos)}
      ${renderWorkSection("Trabalhos concluídos", works.filter((work) => work.status === "done"), "Sem trabalhos concluídos registados.")}
      ${renderWorkSection("Em curso e pendentes", works.filter((work) => work.status !== "done"), "Sem trabalhos em curso ou pendentes registados.")}
      ${report.alert?.enabled ? renderAlert(report.alert) : ""}
      ${renderOccurrences(report.incidents)}
      ${renderNextSteps(report.nextSteps)}
      ${renderProjectMeta(report)}
      ${renderDisclaimer()}
    </main>

    ${renderScreenFooter(report)}
  </div>

  ${renderPrintScript()}
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

  for (const key of ["works", "photos", "extras", "nextSteps"]) {
    if (!Array.isArray(report[key])) {
      throw new Error(`Invalid report document: ${key} must be an array.`);
    }
  }
}

function buildTitle(report) {
  const name = String(report.project.name || "").trim();
  return name ? `Relatório de Obra — ${name}` : "Relatório de Obra";
}

function normalizeWorkStatus(status) {
  return LEGACY_WORK_STATUS[status] || status;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function renderHeader(report) {
  const company = report.company;
  const tagline = String(company.tagline || "").trim();
  const projectName = String(report.project.name || "").trim();
  const dateLine = [formatLongDate(report.meta.reportDate), formatPeriod(report)].filter(Boolean);

  return `
    <header class="header">
      <div class="header-top">
        <div class="brand">
          ${renderLogo(report)}
          <div class="brand-text">
            ${company.name ? `<div class="company-name">${escapeHtml(company.name)}</div>` : ""}
            ${tagline ? `<div class="company-tagline">${escapeHtml(tagline)}</div>` : ""}
          </div>
        </div>

        <div class="report-badge">
          <div class="report-kind">Relatório de obra</div>
          <div class="report-number">N.º ${escapeHtml(formatReportNumber(report))}</div>
          <div class="report-ref">${escapeHtml(buildReportId(report))}</div>
        </div>
      </div>

      ${
        projectName || dateLine.length
          ? `<div class="header-sub">
              ${projectName ? `<div class="header-project">${escapeHtml(projectName)}</div>` : ""}
              ${dateLine.length ? `<div class="header-dates">${dateLine.map(escapeHtml).join(" · ")}</div>` : ""}
            </div>`
          : ""
      }
    </header>
  `;
}

function renderSituation(report) {
  const summary = String(report.progress?.weekSummary || "").trim();
  const phase = String(report.progress?.phase || "").trim();
  const percentage = clampPercent(report.progress?.percentage);

  return `
    <section class="section situation" data-section="situation">
      <div class="keep">
        <h2 class="section-title">Ponto da situação</h2>
        ${
          summary
            ? `<p class="summary-text">${escapeHtml(summary)}</p>`
            : `<p class="summary-text empty-state">Sem resumo registado para este período.</p>`
        }
      </div>

      <div class="phase-progress keep">
        ${phase ? `<div class="phase-line" data-phase>Fase atual: <strong>${escapeHtml(phase)}</strong></div>` : ""}
        <div class="progress-line" data-progress>Progresso da obra: <strong>${percentage}%</strong></div>
        <div class="progress-bar-track" role="img" aria-label="Progresso da obra: ${percentage}%">
          <div class="progress-bar-fill" style="width:${percentage}%"></div>
        </div>
      </div>
    </section>
  `;
}

function renderStatusCounts(works) {
  const count = (status) => works.filter((work) => work.status === status).length;

  return `
    <section class="section keep" data-section="status-counts">
      <h2 class="section-title">Estado da obra</h2>
      <div class="status-grid">
        ${statusCard("done", count("done"), "Concluídas")}
        ${statusCard("in_progress", count("in_progress"), "Em curso")}
        ${statusCard("pending", count("pending"), "Pendentes")}
      </div>
    </section>
  `;
}

function statusCard(status, number, label) {
  return `
    <div class="status-card ${STATUS_CLASS[status]}">
      <div class="status-number">${Number(number || 0)}</div>
      <div class="status-label">${escapeHtml(label)}</div>
    </div>
  `;
}

function renderPhotos(photos) {
  const visible = photos.filter((photo) => Boolean(photo.displayUrl));
  if (!visible.length) return "";

  const rows = [];
  for (let i = 0; i < visible.length; i += 2) {
    rows.push(`<div class="photo-row">${visible.slice(i, i + 2).map(renderPhoto).join("")}</div>`);
  }

  return renderListSection({ title: "Registo fotográfico", section: "photos", items: rows });
}

function renderPhoto(photo) {
  const heading = [String(photo.area || "").trim(), PHOTO_STAGE_LABELS[photo.stage] || ""]
    .filter(Boolean)
    .join(" · ");
  const description = String(photo.description || "").trim();
  const worker = String(photo.worker || "").trim();

  return `
    <figure class="photo-card">
      <div class="photo-frame"><img src="${escapeHtml(photo.displayUrl)}" alt="${escapeHtml(heading || "Fotografia da obra")}"></div>
      <figcaption class="photo-caption">
        ${heading ? `<strong data-photo-heading>${escapeHtml(heading)}</strong>` : ""}
        ${description ? `<span>${escapeHtml(description)}</span>` : ""}
        ${worker ? `<span class="photo-worker">Responsável: ${escapeHtml(worker)}</span>` : ""}
      </figcaption>
    </figure>
  `;
}

function renderWorkSection(title, works, emptyMessage) {
  const items = works.map(renderWorkItem);
  return renderListSection({
    title,
    section: title === "Trabalhos concluídos" ? "works-done" : "works-open",
    items,
    emptyHtml: `<p class="empty-state">${escapeHtml(emptyMessage)}</p>`,
  });
}

function renderWorkItem(work) {
  return `
    <div class="item work-item">
      ${statusTag(work.status)}
      <div class="item-text">
        ${renderWorkLabel(work)}
        ${work.area ? `<div class="item-sub">${escapeHtml(work.area)}</div>` : ""}
      </div>
    </div>
  `;
}

// "Categoria — Descrição"; the "Outro" category is noise, so only the description.
function renderWorkLabel(work) {
  const type = String(work.type || "").trim();
  const description = String(work.description || "").trim();

  if (!type || type === OTHER_CATEGORY) {
    return escapeHtml(description || type || "—");
  }

  return description
    ? `<strong>${escapeHtml(type)}</strong> — ${escapeHtml(description)}`
    : `<strong>${escapeHtml(type)}</strong>`;
}

function statusTag(status) {
  const label = STATUS_LABELS[status];
  if (!label) return "";
  return `<span class="status-tag ${STATUS_CLASS[status]}">${escapeHtml(label)}</span>`;
}

function renderAlert(alert) {
  return `
    <section class="section keep" data-section="alert">
      <div class="alert">
        <strong>▲ ${escapeHtml(alert.title || "Decisão necessária")}</strong>
        ${alert.description ? `<div>${escapeHtml(alert.description)}</div>` : ""}
        ${
          alert.deadline
            ? `<div class="alert-deadline">Prazo de resposta: ${escapeHtml(formatDateOnly(alert.deadline))}${
                alert.consequence ? ` — ${escapeHtml(alert.consequence)}` : ""
              }</div>`
            : ""
        }
      </div>
    </section>
  `;
}

function renderOccurrences(incidents) {
  const items = incidents?.enabled ? incidents.items || [] : [];

  return renderListSection({
    title: "Ocorrências",
    section: "occurrences",
    items: items.map(
      (incident) => `
        <div class="item occurrence-item">
          ${statusTag(incident.status)}
          <div class="item-text">${escapeHtml(incident.description || "—")}</div>
        </div>
      `,
    ),
    emptyHtml: `<p class="empty-state">Sem ocorrências registadas neste período.</p>`,
  });
}

function renderNextSteps(nextSteps) {
  return renderListSection({
    title: "Próximos passos",
    section: "next-steps",
    items: nextSteps.map(
      (step, index) => `
        <div class="item next-step-item">
          <div class="step-number">${index + 1}</div>
          <div class="item-text">
            ${escapeHtml(step.description || "—")}
            ${step.date ? `<div class="item-sub">Previsto: ${escapeHtml(formatDateOnly(step.date))}</div>` : ""}
          </div>
        </div>
      `,
    ),
    emptyHtml: `<p class="empty-state">Sem próximos passos registados.</p>`,
  });
}

// Heading + first item are wrapped together so the heading never ends a page
// alone; data-cont-title feeds the "(cont.)" heading Paged.js shows when the
// section's remaining items continue on the next page.
function renderListSection({ title, section, items, emptyHtml = "" }) {
  const [first = emptyHtml, ...rest] = items;

  return `
    <section class="section list-section" data-section="${escapeHtml(section)}" data-cont-title="${escapeHtml(`${title} (cont.)`)}">
      <div class="keep">
        <h2 class="section-title">${escapeHtml(title)}</h2>
        ${first}
      </div>
      ${rest.join("")}
    </section>
  `;
}

function renderProjectMeta(report) {
  const company = report.company;
  const fields = [
    ["Obra", report.project.name],
    ["Cliente", report.project.clientName],
    ["Localização", report.project.location],
    ["Responsável da obra", company.responsible],
    ["N.º Contrato", report.project.contractNumber],
    ["NIF", company.nif],
    ["INCI n.º", company.impic],
  ].filter(([, value]) => String(value ?? "").trim() !== "");

  if (!fields.length) return "";

  return `
    <section class="section keep project-meta" data-section="project-meta">
      <dl class="meta-grid">
        ${fields
          .map(
            ([label, value]) => `
              <div class="meta-item">
                <dt>${escapeHtml(label)}</dt>
                <dd>${escapeHtml(String(value).trim())}</dd>
              </div>
            `,
          )
          .join("")}
      </dl>
    </section>
  `;
}

// Text identical to v1's renderLegalStrip — do not edit the wording here
// (owner decision pending on "Livro de Projeto"); styling only.
function renderDisclaimer() {
  return `
    <div class="legal-strip keep" data-section="disclaimer">
      Este relatório é emitido para efeitos de acompanhamento, comunicação e arquivo documental do projeto.
      Não substitui o contrato de empreitada, o Livro de Projeto, autos de medição, faturas, licenças,
      projetos aprovados, termos de responsabilidade ou aprovações formais exigidas por lei ou contrato.
      Trabalhos extra, alterações de preço, prazo ou projeto carecem de aprovação expressa por escrito,
      salvo disposição contratual em contrário.
    </div>
  `;
}

// Screen only. In print the same line lives in the @page margin boxes, which
// also carry the only page counter.
function renderScreenFooter(report) {
  const parts = footerParts(report);

  return `
    <footer class="screen-footer">
      ${parts.map((part) => `<span>${escapeHtml(part)}</span>`).join("")}
    </footer>
  `;
}

function footerParts(report) {
  return [
    String(report.company.name || "").trim(),
    `Relatório N.º ${formatReportNumber(report)} · gerado ${formatGeneratedDate(report)}`,
    formatContact(report.company),
  ].filter(Boolean);
}

function renderLogo(report) {
  const logoUrl = report.company?.logoUrl;
  if (!logoUrl) return "";
  return `<img class="logo-image" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(report.company.name || "Logótipo")}">`;
}

// ---------------------------------------------------------------------------
// Print / PDF (Paged.js, loaded on demand)
// ---------------------------------------------------------------------------

function renderPrintScript() {
  return `<script>
(function () {
  var PAGED_SRC = ${JSON.stringify(assetUrl(PAGED_JS_PATH))};
  var state = "idle";
  var pending = null;

  function setBusy(busy) {
    var btn = document.querySelector("[data-print-report]");
    if (btn) { btn.disabled = busy; btn.textContent = busy ? "A preparar…" : "Imprimir / PDF"; }
  }

  function loadPaged() {
    return new Promise(function (resolve, reject) {
      window.PagedConfig = { auto: false };
      var script = document.createElement("script");
      script.src = PAGED_SRC;
      script.onload = resolve;
      script.onerror = function () { reject(new Error("Paged.js failed to load")); };
      document.head.appendChild(script);
    });
  }

  function addToolbar() {
    var style = document.createElement("style");
    style.setAttribute("data-pagedjs-ignore", "");
    style.textContent =
      "@media screen{html,body{background:#ECEEF1}.pagedjs_pages{padding:24px 0 96px}.pagedjs_page{background:#fff;margin:0 auto 16px;box-shadow:0 1px 4px rgba(0,0,0,.18)}}" +
      "@media print{.paged-toolbar{display:none!important}}" +
      ".paged-toolbar{position:fixed;right:16px;bottom:16px;display:flex;gap:8px;z-index:999}" +
      ".paged-toolbar button{font:600 15px Inter,system-ui,sans-serif;min-height:44px;padding:10px 16px;border-radius:8px;border:1px solid #22252A;cursor:pointer}" +
      ".paged-toolbar .primary{background:#22252A;color:#fff}.paged-toolbar .secondary{background:#fff;color:#22252A}";
    document.head.appendChild(style);

    var bar = document.createElement("div");
    bar.className = "paged-toolbar";
    bar.innerHTML = '<button type="button" class="secondary" data-paged-back>Voltar</button>' +
      '<button type="button" class="primary" data-paged-print>Imprimir / PDF</button>';
    bar.querySelector("[data-paged-back]").onclick = function () { location.reload(); };
    bar.querySelector("[data-paged-print]").onclick = function () { window.print(); };
    document.body.appendChild(bar);
  }

  function paginate() {
    if (state === "done") return Promise.resolve();
    if (pending) return pending;
    setBusy(true);
    pending = loadPaged()
      .then(function () { return document.fonts ? document.fonts.ready : null; })
      .then(function () { return window.PagedPolyfill.preview(); })
      .then(function () {
        state = "done";
        document.documentElement.setAttribute("data-paged", "done");
        addToolbar();
      })
      .catch(function (error) {
        pending = null;
        setBusy(false);
        throw error;
      });
    return pending;
  }

  function print() {
    paginate().then(
      function () { window.print(); },
      function (error) { console.error(error); window.print(); }
    );
  }

  document.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.key === "p" || event.key === "P")) {
      event.preventDefault();
      if (state === "done") { window.print(); } else { print(); }
    }
  });

  window.__reportPrint = { paginate: paginate, print: print };
})();
</script>`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function renderStyles(report) {
  const [companyName, reportLine, contact] = [
    String(report.company.name || "").trim(),
    `Relatório N.º ${formatReportNumber(report)} · gerado ${formatGeneratedDate(report)}`,
    formatContact(report.company),
  ];
  const footerFirstLine = [companyName, reportLine].filter(Boolean).join(" · ");

  // "Tijolo e Cal": the contractor's identity leads; terracotta (#A84B2A /
  // #8F3D21) only as a thin rule, section accents and the progress bar —
  // never for a status, an ocorrência or the disclaimer. Status tags always
  // carry a text label plus a bordered tint so they survive grayscale.
  return `
<style>
@font-face{font-family:'Inter Report';font-style:normal;font-weight:400;font-display:swap;src:url(${cssString(assetUrl(INTER_400_PATH))}) format("woff2")}
@font-face{font-family:'Inter Report';font-style:normal;font-weight:600;font-display:swap;src:url(${cssString(assetUrl(INTER_600_PATH))}) format("woff2")}
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:#22252A;background:#F6F3EE}
.doc{max-width:210mm;margin:0 auto;background:#ffffff;padding:28px 36px 24px}
.header{border-bottom:2px solid #A84B2A;padding-bottom:16px;margin-bottom:24px}
.header-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.brand{display:flex;align-items:center;gap:14px;min-width:0}
.brand-text{min-width:0}
.logo-image{flex:0 0 56px;width:56px;height:56px;object-fit:contain;border-radius:6px;display:block}
.company-name{font-size:20px;font-weight:600;line-height:1.2;overflow-wrap:anywhere}
.company-tagline{font-size:11px;color:#5C5A55;margin-top:2px}
.report-badge{text-align:right;flex-shrink:0}
.report-kind{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:#5C5A55}
.report-number{font-size:22px;font-weight:600;line-height:1.2;font-variant-numeric:tabular-nums}
.report-ref{font-size:10px;color:#5C5A55}
.header-sub{margin-top:14px}
.header-project{font-size:14px;font-weight:600;overflow-wrap:anywhere}
.header-dates{font-size:12px;color:#5C5A55;font-variant-numeric:tabular-nums}
.section{position:relative;margin-bottom:24px}
.section-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#8F3D21;border-bottom:1px solid #D9D2C7;padding-bottom:6px;margin-bottom:12px}
.section[data-split-from]{padding-top:30px!important}
.section[data-split-from]::before{content:attr(data-cont-title)!important;position:absolute;top:0;left:0;right:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#8F3D21;border-bottom:1px solid #D9D2C7;padding-bottom:6px}
.keep,.item,.photo-row,.photo-card,.status-grid,.meta-grid,.legal-strip,.alert{break-inside:avoid;page-break-inside:avoid}
.summary-text{font-size:13px;line-height:1.6;white-space:pre-line;overflow-wrap:anywhere}
.empty-state{color:#5C5A55;font-style:italic;font-size:12px}
.phase-progress{margin-top:14px}
.phase-line,.progress-line{font-size:12px;color:#22252A}
.progress-line{margin-top:4px}
.progress-bar-track{margin-top:6px;background:#ECEEF1;border:1px solid #8F8B83;border-radius:99px;height:10px;overflow:hidden}
.progress-bar-fill{height:100%;background:#A84B2A;border-radius:99px}
.status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.status-card{border:1px solid #D9D2C7;border-left-width:3px;border-radius:4px;padding:10px 14px;background:#ffffff}
.status-card.done{border-left-color:#1F5E3A}
.status-card.in-progress{border-left-color:#7A4A06}
.status-card.pending{border-left-color:#3D4652}
.status-number{font-size:22px;font-weight:600;line-height:1.2;font-variant-numeric:tabular-nums}
.status-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#5C5A55;margin-top:2px}
.photo-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.photo-card{border:1px solid #D9D2C7;border-radius:4px;overflow:hidden;background:#ffffff}
.photo-frame{height:220px;background:#F6F3EE;overflow:hidden}
.photo-frame img{width:100%;height:100%;display:block;object-fit:cover}
.photo-caption{display:flex;flex-direction:column;gap:2px;padding:8px 12px;font-size:12px;color:#5C5A55;line-height:1.4;overflow-wrap:anywhere}
.photo-caption strong{color:#22252A;font-weight:600}
.item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #D9D2C7}
.item-text{flex:1;min-width:0;font-size:12px;line-height:1.5;overflow-wrap:anywhere}
.item-text strong{font-weight:600}
.item-sub{font-size:10px;color:#5C5A55}
.status-tag{display:inline-flex;align-items:center;gap:4px;flex-shrink:0;font-size:10px;line-height:1.5;padding:1px 7px;border-radius:3px;font-weight:600;border:1px solid currentColor;white-space:nowrap;margin-top:1px}
.status-tag.done,.status-tag.resolved{background:#E6F2EA;color:#1F5E3A}
.status-tag.in-progress{background:#FCF1DC;color:#7A4A06}
.status-tag.pending{background:#ECEEF1;color:#3D4652}
.status-tag.open{background:#FBE8EC;color:#7A0D29}
.status-tag.open::before{content:"";width:10px;height:10px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2 1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2 1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z'/%3E%3C/svg%3E") center/contain no-repeat}
.step-number{width:20px;height:20px;border-radius:50%;border:1px solid #22252A;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.alert{background:#FCF1DC;border:1px solid #7A4A06;border-left:4px solid #7A4A06;border-radius:4px;padding:12px 14px;font-size:11px;line-height:1.5}
.alert strong{color:#7A4A06;font-size:12px}
.alert-deadline{margin-top:8px;font-size:10px;color:#7A4A06;font-weight:600}
.project-meta{border-top:1px solid #D9D2C7;padding-top:14px}
.meta-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px 16px}
.meta-item{min-width:0}
.meta-item dt{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:#5C5A55;margin-bottom:2px}
.meta-item dd{font-size:12px;font-weight:600;overflow-wrap:anywhere}
.legal-strip{background:#F6F3EE;border:1px solid #D9D2C7;border-left:3px solid #8F8B83;border-radius:4px;padding:12px 14px;font-size:9.5px;color:#5C5A55;line-height:1.7;text-align:justify}
.screen-footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 16px;border-top:1px solid #D9D2C7;margin-top:24px;padding-top:12px;font-size:10px;color:#5C5A55}
.screen-footer span:first-child{color:#22252A;font-weight:600}
.print-btn{position:fixed;bottom:20px;right:20px;background:#22252A;color:#ffffff;border:none;border-radius:8px;min-height:48px;padding:12px 20px;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:999}
.print-btn:disabled{opacity:.7;cursor:progress}
@media screen and (max-width:600px){
  body{background:#ffffff}
  .doc{padding:16px 16px 88px}
  .header{padding-bottom:12px;margin-bottom:16px}
  .header-top{gap:10px}
  .brand{gap:10px}
  .logo-image{flex-basis:40px;width:40px;height:40px}
  .company-name{font-size:17px}
  .report-number{font-size:18px}
  .header-sub{margin-top:10px}
  .section{margin-bottom:20px}
  .status-grid{gap:8px}
  .status-card{padding:8px 10px}
  .status-number{font-size:18px}
  .photo-row{grid-template-columns:1fr}
  .print-btn{bottom:12px;right:12px;min-height:44px;padding:10px 16px;font-size:15px}
}
@page{
  size:A4;
  margin:18mm 18mm 20mm;
  @bottom-left{content:${cssString(footerFirstLine)}${contact ? ` "\\A " ${cssString(contact)}` : ""};white-space:pre-wrap;font-family:${FONT_STACK};font-size:7.5pt;line-height:1.4;color:#5C5A55;vertical-align:top;padding-top:4mm}
  @bottom-right{content:"Página " counter(page) " de " counter(pages);width:32mm;max-width:32mm;white-space:nowrap;text-align:right;font-family:${FONT_STACK};font-size:7.5pt;line-height:1.4;color:#5C5A55;vertical-align:top;padding-top:4mm}
}
@media print{
  body{background:#ffffff}
  .doc{max-width:none;margin:0;padding:0}
  .no-print,.screen-footer{display:none}
  .photo-frame{height:170px}
  .section{margin-bottom:20px}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style>`;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatReportNumber(report) {
  return String(report.meta.reportNumber || "1").padStart(3, "0");
}

function buildReportId(report) {
  const firstName = String(report.project.clientName || "CLIENTE").split(" ")[0];
  const slug =
    firstName
      .toUpperCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Z]/g, "") || "CLIENTE";

  return `PROJ-${slug}-${formatReportNumber(report)}`;
}

// Shown only on canonical reports (server-derived period). Same-day → one date.
function formatPeriod(report) {
  const { periodStart, periodEnd } = report.meta;
  if (report.source !== "canonical" || !periodStart || !periodEnd) return "";

  const start = formatDateOnly(periodStart);
  const end = formatDateOnly(periodEnd);
  return start === end ? `Período: ${start}` : `Período: ${start} – ${end}`;
}

// "2026-09-30" → "30/09/2026" without going through Date, so the viewer's
// time zone can never shift a date-only value by a day.
function formatDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value ?? "") : date.toLocaleDateString("pt-PT");
}

function formatLongDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  if (!match) return "";

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).toLocaleDateString("pt-PT", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatGeneratedDate(report) {
  const date = new Date(report.meta.generatedAt);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
  }
  return formatDateOnly(report.meta.reportDate);
}

function formatContact(company) {
  return [formatPhone(company.phone), String(company.email || "").trim()].filter(Boolean).join(" · ");
}

// Portuguese numbers → "+351 900 000 001"; anything else is shown as typed.
export function formatPhone(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  let digits = raw.replace(/[\s.\-()/]/g, "");
  if (digits.startsWith("00351")) digits = `+351${digits.slice(5)}`;
  else if (/^351\d{9}$/.test(digits)) digits = `+${digits}`;

  const match = /^(?:\+351)?([239]\d{8})$/.exec(digits);
  if (!match) return raw;

  const n = match[1];
  return `+351 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}

function assetUrl(relativePath) {
  const base = globalThis.location?.href;
  if (!base || !/^https?:/.test(base)) return relativePath;
  return new URL(relativePath, base).href;
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(Math.max(0, Math.min(100, number)));
}

function cssString(value) {
  return `"${String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n\f]+/g, " ")
    .replace(/</g, "\\3C ")}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

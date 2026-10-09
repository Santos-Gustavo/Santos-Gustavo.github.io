// tests/e2e/report-layout-v2.spec.js
//
// REPORT-LAYOUT-V2: historical reports stay on the frozen v1 presentation,
// reports generated on/after REPORT_LAYOUT_V2_CUTOVER get v2, and v2's
// print/PDF pagination (vendored Paged.js) meets the A4 rules. No Supabase
// rows are touched — share-link rendering is exercised by stubbing the
// get-shared-report response.

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import {
  renderReportHtml,
  selectReportLayout,
  REPORT_LAYOUT_V2_CUTOVER,
} from "../../js/reports/report-renderer.js";
import { renderReportHtmlV1 } from "../../js/reports/report-renderer-v1.js";
import { formatPhone } from "../../js/reports/report-renderer-v2.js";
import {
  case1,
  case2,
  case3,
  case4,
  legacyPreCutover,
  canonicalPreCutover,
} from "./fixtures/report-layout-cases.js";

const FIXTURES = path.join(__dirname, "fixtures");
const golden = (name) =>
  fs.readFileSync(path.join(FIXTURES, name), "utf8").replace(/\r\n/g, "\n");

const withGeneratedAt = (snapshot, generatedAt) => ({ ...snapshot, meta: { ...snapshot.meta, generatedAt } });

// Must stay byte-identical to v1 (owner decision pending on "Livro de Projeto").
const DISCLAIMER = `
      Este relatório é emitido para efeitos de acompanhamento, comunicação e arquivo documental do projeto.
      Não substitui o contrato de empreitada, o Livro de Projeto, autos de medição, faturas, licenças,
      projetos aprovados, termos de responsabilidade ou aprovações formais exigidas por lei ou contrato.
      Trabalhos extra, alterações de preço, prazo ou projeto carecem de aprovação expressa por escrito,
      salvo disposição contratual em contrário.
    `;

function visibleText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

test.describe("report layout routing", () => {
  test("selection rule: pre-cutover/missing/invalid → v1, on/after cutover → v2", () => {
    const cutoverMs = Date.parse(REPORT_LAYOUT_V2_CUTOVER);
    expect(selectReportLayout(withGeneratedAt(case1, new Date(cutoverMs - 1).toISOString()))).toBe("v1");
    expect(selectReportLayout(withGeneratedAt(case1, REPORT_LAYOUT_V2_CUTOVER))).toBe("v2");
    expect(selectReportLayout(withGeneratedAt(case1, new Date(cutoverMs + 1).toISOString()))).toBe("v2");
    expect(selectReportLayout(withGeneratedAt(case1, undefined))).toBe("v1");
    expect(selectReportLayout(withGeneratedAt(case1, null))).toBe("v1");
    expect(selectReportLayout(withGeneratedAt(case1, "not a date"))).toBe("v1");
    // schemaVersion plays no part in the choice.
    expect(selectReportLayout({ ...case1, schemaVersion: 99 })).toBe("v2");
    expect(selectReportLayout({ ...legacyPreCutover, schemaVersion: 2 })).toBe("v1");
    // Legal-mode snapshots stay on v1 even after the cutover.
    expect(selectReportLayout({ ...case1, meta: { ...case1.meta, mode: "legal" } })).toBe("v1");

    // The rendered output follows the rule, one millisecond either side.
    const justBefore = renderReportHtml(withGeneratedAt(case1, new Date(cutoverMs - 1).toISOString()));
    const atCutover = renderReportHtml(withGeneratedAt(case1, REPORT_LAYOUT_V2_CUTOVER));
    expect(justBefore).toBe(renderReportHtmlV1(withGeneratedAt(case1, new Date(cutoverMs - 1).toISOString())));
    expect(justBefore).not.toContain('<div class="doc">');
    expect(atCutover).toContain('<div class="doc">');
  });

  test("historical snapshots still render byte-for-byte as before the v2 renderer existed", () => {
    // Golden files were produced by the pre-REPORT-LAYOUT-V2 report-renderer.js.
    expect(renderReportHtml(legacyPreCutover)).toBe(golden("report-v1-golden-legacy.html"));
    expect(renderReportHtml(canonicalPreCutover)).toBe(golden("report-v1-golden-canonical.html"));
    expect(renderReportHtmlV1(canonicalPreCutover)).toBe(golden("report-v1-golden-canonical.html"));
  });

  test("a post-cutover report uses v2", () => {
    const html = renderReportHtml(case1);
    expect(html).toContain('<div class="doc">');
    expect(html).toContain("Relatório de obra");
    expect(html).not.toContain("Relatório Semanal");
  });
});

test.describe("v2 text and template", () => {
  test("A1–A8 wording, labels and formatting", () => {
    const all = [case1, case2, case3, case4].map(renderReportHtml);
    const text = all.map(visibleText).join("\n");

    // A1 exact status labels; old casing gone.
    for (const label of ["Pendente", "Em curso", "Concluída", "Em aberto", "Resolvido"]) {
      expect(text).toContain(label);
    }
    expect(text).not.toMatch(/Concluído|Em Curso/);

    // A2 "Outro" shows the description only.
    expect(text).not.toContain("Outro —");
    expect(visibleText(renderReportHtml(case4))).toContain("Substituição do sifão do lava-loiça");

    // A3 title / number / ref / period.
    expect(text).toContain("N.º 072");
    expect(text).toContain("PROJ-ANTONIO-072");
    expect(text).not.toMatch(/semanal/i);
    expect(visibleText(renderReportHtml(case4))).toContain("Período: 08/10/2026");
    expect(visibleText(renderReportHtml(case4))).not.toContain("08/10/2026 – 08/10/2026");
    expect(visibleText(renderReportHtml(case1))).toContain("Período: 01/10/2026 – 08/10/2026");

    // A4 empty fields are not rendered (case1: no contract number; case4: no location).
    expect(visibleText(renderReportHtml(case1))).not.toContain("N.º Contrato");
    expect(visibleText(renderReportHtml(case4))).not.toContain("Localização");
    expect(all.join("")).not.toMatch(/<dd>\s*—\s*<\/dd>/);

    // A5 wording — "projeto" only survives inside the untouched disclaimer.
    for (const phrase of ["Ponto da situação", "Estado da obra", "Progresso da obra", "Responsável da obra", "Obra", "Ocorrências", "Registo fotográfico", "Trabalhos concluídos", "Em curso e pendentes", "Próximos passos"]) {
      expect(text).toContain(phrase);
    }
    expect(text).not.toMatch(/incidentes|não-conformidades|Resumo da semana/i);
    for (const html of all) {
      expect(visibleText(html.replace(DISCLAIMER, ""))).not.toMatch(/projeto/i);
    }
    expect(visibleText(renderReportHtml(case1))).toContain("Sem ocorrências registadas neste período.");
    expect(renderReportHtml(case1)).toContain("<title>Relatório de Obra — Remodelação T3 — Rua das Flores</title>");

    // A6 phone.
    expect(text).toContain("+351 935 121 546");
    expect(formatPhone("935121546")).toBe("+351 935 121 546");
    expect(formatPhone("+351935121546")).toBe("+351 935 121 546");
    expect(formatPhone("00351 213 456 789")).toBe("+351 213 456 789");
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");

    // A7 phase and progress separated.
    expect(text).toContain("Fase atual: Acabamentos");
    expect(text).toContain("Progresso da obra: 70%");
    expect(renderReportHtml(case4)).not.toContain("data-phase"); // empty phase → no line

    // A8 photo stage.
    expect(text).toContain("Casa de Banho 1 · Durante");

    // B5 disclaimer text identical to v1.
    expect(renderReportHtml(case1)).toContain(DISCLAIMER);
    expect(golden("report-v1-golden-legacy.html")).toContain(DISCLAIMER);
  });

  test("C content order", () => {
    const html = renderReportHtml(case3);
    const order = ["situation", "status-counts", "photos", "works-done", "works-open", "occurrences", "next-steps", "project-meta", "disclaimer"]
      .map((section) => html.indexOf(`data-section="${section}"`));
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

async function openReport(page, snapshot) {
  await page.goto("/");
  const url = await page.evaluate(async (snap) => {
    const { renderReportHtml } = await import("/js/reports/report-renderer.js");
    return URL.createObjectURL(new Blob([renderReportHtml(snap)], { type: "text/html;charset=utf-8" }));
  }, snapshot);
  await page.goto(url);
}

test.describe("v2 print pagination (Paged.js)", () => {
  test("long report: A4 pages, footer counter on every page, no split cards, (cont.) headings", async ({ page }) => {
    test.setTimeout(60000);
    await openReport(page, case2);
    await page.evaluate(() => window.__reportPrint.paginate());

    const result = await page.evaluate(() => {
      const pages = [...document.querySelectorAll(".pagedjs_page")];
      const mm = 96 / 25.4;
      const first = pages[0].getBoundingClientRect();
      return {
        pageCount: pages.length,
        pageSizesMm: pages.map((p) => [Math.round(p.getBoundingClientRect().width / mm), Math.round(p.getBoundingClientRect().height / mm)]),
        counters: pages.map((p) => p.querySelector(".pagedjs_margin-bottom-right").classList.contains("hasContent")),
        footers: pages.map((p) => p.querySelector(".pagedjs_margin-bottom-left").classList.contains("hasContent")),
        totalPagesVar: getComputedStyle(document.querySelector(".pagedjs_pages")).getPropertyValue("--pagedjs-page-count"),
        split: [...document.querySelectorAll(".item, .photo-row, .photo-card, .legal-strip, .keep")]
          .filter((el) => el.hasAttribute("data-split-from") || el.hasAttribute("data-split-to")).length,
        cont: [...document.querySelectorAll(".section[data-split-from]")].map((el) => getComputedStyle(el, "::before").content),
        orphanHeadings: [...document.querySelectorAll(".section-title")].filter((h) => !h.nextElementSibling).length,
        countsBottomMm: (pages[0].querySelector('[data-section="status-counts"]').getBoundingClientRect().bottom - first.top) / mm,
        htmlFooterVisible: [...document.querySelectorAll(".screen-footer")].some((el) => el.offsetParent !== null),
      };
    });

    expect(result.pageCount).toBeGreaterThanOrEqual(3);
    expect(new Set(result.pageSizesMm.map(String))).toEqual(new Set(["210,297"]));
    expect(result.counters.every(Boolean)).toBe(true);
    expect(result.footers.every(Boolean)).toBe(true);
    expect(result.split).toBe(0);
    expect(result.orphanHeadings).toBe(0);
    expect(result.cont.length).toBeGreaterThan(0);
    for (const content of result.cont) expect(content).toMatch(/^".+ \(cont\.\)"$/);
    expect(result.countsBottomMm).toBeLessThan(297 / 2);
    expect(result.htmlFooterVisible).toBe(false);

    // The printed PDF has exactly one page per paged page.
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const pdfPages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pdfPages).toBe(result.pageCount);
  });

  test("print button paginates before printing", async ({ page }) => {
    await openReport(page, case1);
    await page.evaluate(() => { window.print = () => { window.__printed = document.querySelectorAll(".pagedjs_page").length; }; });
    await page.locator("[data-print-report]").click();
    await expect.poll(() => page.evaluate(() => window.__printed || 0)).toBeGreaterThan(0);
  });
});

test.describe("client share link follows the same selection rule", () => {
  async function openShare(page, report) {
    await page.route("**/functions/v1/get-shared-report", (route) => route.fulfill({ json: { ok: true, report } }));
    await page.goto("/share.html#token=layout-v2-test");
    return page.frameLocator("iframe.share-frame");
  }

  test("pre-cutover snapshot → v1 in the share view", async ({ page }) => {
    const frame = await openShare(page, legacyPreCutover);
    await expect(frame.locator(".page .report-badge")).toContainText("Relatório Semanal");
    await expect(frame.locator(".doc")).toHaveCount(0);
  });

  test("post-cutover snapshot → v2; 390 px first screen shows header, summary, phase and progress", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 664 });
    const frame = await openShare(page, case1);
    await expect(frame.locator(".doc .report-kind")).toHaveText("Relatório de obra");
    await expect(page.locator("iframe.share-frame")).toHaveAttribute("sandbox", "allow-scripts allow-modals");

    for (const selector of [".header", ".summary-text", "[data-phase]", ".progress-bar-track"]) {
      const box = await frame.locator(selector).boundingBox();
      expect(box, selector).not.toBeNull();
      expect(box.y + box.height, selector).toBeLessThanOrEqual(664);
    }
    const widths = await frame.locator("html").evaluate((el) => [el.scrollWidth, el.clientWidth]);
    expect(widths[0]).toBeLessThanOrEqual(widths[1]);
  });
});

// js/projects/sections/financial.js

import { appState } from "#state/app-state.js";
import { getValue } from "#forms/form-values.js";

let initialized = false;

export function initFinancialSection() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("input", handleFinancialInput, true);
  document.addEventListener("change", handleFinancialInput, true);

}

export function updateFinancialPreview() {
  const el = document.getElementById("financialPreview");

  if (!el) {
    console.warn("Financial preview container not found. Expected #financialPreview.");
    return;
  }

  const state = getRuntimeState();

  const base = parseFloat(getValue("contractValue")) || 0;
  const extras = Array.isArray(state.extras) ? state.extras : [];

  const approved = extras
    .filter((extra) => extra.status === "approved")
    .reduce((sum, extra) => sum + (parseFloat(extra.cost) || 0), 0);

  const pending = extras
    .filter((extra) => extra.status === "pending")
    .reduce((sum, extra) => sum + (parseFloat(extra.cost) || 0), 0);

  el.innerHTML = `
    <div style="border:1px solid var(--paper-line);border-radius:8px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:10px 14px;color:var(--ink-soft);">Contrato base</td>
          <td style="padding:10px 14px;text-align:right;font-family:'IBM Plex Mono',monospace;">${formatEuro(base)}</td>
        </tr>

        ${
          approved > 0
            ? `
              <tr>
                <td style="padding:10px 14px;color:var(--amber);">Extras aprovados</td>
                <td style="padding:10px 14px;text-align:right;font-family:'IBM Plex Mono',monospace;color:var(--amber);">+ ${formatEuro(approved)}</td>
              </tr>
            `
            : ""
        }

        ${
          pending > 0
            ? `
              <tr>
                <td style="padding:10px 14px;color:var(--ink-soft);font-style:italic;">Extras pendentes</td>
                <td style="padding:10px 14px;text-align:right;font-family:'IBM Plex Mono',monospace;color:var(--ink-soft);">+ ${formatEuro(pending)} (pendente)</td>
              </tr>
            `
            : ""
        }

        <tr style="background:var(--input-bg);font-weight:700;border-top:2px solid var(--paper-line);">
          <td style="padding:10px 14px;">Total projetado</td>
          <td style="padding:10px 14px;text-align:right;font-family:'IBM Plex Mono',monospace;">${formatEuro(base + approved)}</td>
        </tr>
      </table>
    </div>
  `;
}

function handleFinancialInput(event) {
  const target = event.target;

  if (!target) return;

  if (
    target.id === "contractValue" ||
    target.closest?.("[data-extra-field]")
  ) {
    updateFinancialPreview();
  }
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


// js/projects/sections/financial.js

import { appState } from "#state/app-state.js";
import { getValue } from "#forms/form-values.js";

let initialized = false;

export function initFinancialSection() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("input", handleFinancialInput, true);
  document.addEventListener("change", handleFinancialInput, true);

  installTemporaryFinancialBridge();
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
    <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:10px 14px;color:#374151;">Contrato base</td>
          <td style="padding:10px 14px;text-align:right;font-family:monospace;">${formatEuro(base)}</td>
        </tr>

        ${
          approved > 0
            ? `
              <tr>
                <td style="padding:10px 14px;color:#d97706;">Extras aprovados</td>
                <td style="padding:10px 14px;text-align:right;font-family:monospace;color:#d97706;">+ ${formatEuro(approved)}</td>
              </tr>
            `
            : ""
        }

        ${
          pending > 0
            ? `
              <tr>
                <td style="padding:10px 14px;color:#9ca3af;font-style:italic;">Extras pendentes</td>
                <td style="padding:10px 14px;text-align:right;font-family:monospace;color:#9ca3af;">+ ${formatEuro(pending)} (pendente)</td>
              </tr>
            `
            : ""
        }

        <tr style="background:#f9fafb;font-weight:700;border-top:2px solid #e5e7eb;">
          <td style="padding:10px 14px;">Total projetado</td>
          <td style="padding:10px 14px;text-align:right;font-family:monospace;">${formatEuro(base + approved)}</td>
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

function installTemporaryFinancialBridge() {
  // Temporary bridge for old navigation/report files.
  window.updateFinancialPreview = updateFinancialPreview;
}
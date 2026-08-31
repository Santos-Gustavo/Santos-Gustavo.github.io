// js/company/company-index.js

import { appState } from "#state/app-state.js";
import {
  loadPrimaryCompanyIntoState,
  populateCompanyForm,
  saveCompanyProfileFromForm,
} from "#company/company-profile.js";
import { goToStepId, goHome } from "#navigation/navigation.js";

let initialized = false;

export function initCompanyProfile() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleCompanyClick);
}

// Opens the "Dados da Empresa" screen. Always re-reads the company from the
// DB first so edits made earlier in the session (or elsewhere) are reflected.
export async function openCompanyProfilePage() {
  const company = await loadPrimaryCompanyIntoState();
  populateCompanyForm(company);

  const isFirstTimeSetup = !company;
  setFirstTimeSetupNotice(isFirstTimeSetup);

  goToStepId("company");
}

async function handleCompanyClick(event) {
  const actionEl = event.target.closest("[data-company-action]");
  if (!actionEl) return;

  const action = actionEl.dataset.companyAction;

  event.preventDefault();
  event.stopPropagation();

  if (action === "save") {
    await saveCompanyProfile();
    return;
  }

  if (action === "cancel") {
    appState.pendingNewProjectAfterCompanySetup = false;
    goHome();
  }
}

async function saveCompanyProfile() {
  try {
    await saveCompanyProfileFromForm();

    if (appState.pendingNewProjectAfterCompanySetup) {
      appState.pendingNewProjectAfterCompanySetup = false;

      // Lazy import avoids a load-time circular dependency with
      // project-selection.js (which imports openCompanyProfilePage from here).
      const { newProject } = await import("#projects/project-selection.js");
      await newProject();
      return;
    }

    alert("Dados da empresa guardados com sucesso.");
    goHome();
  } catch (error) {
    console.error("Error saving company profile:", error);
    alert("Erro ao guardar dados da empresa: " + error.message);
  }
}

function setFirstTimeSetupNotice(isFirstTimeSetup) {
  const el = document.getElementById("companyFirstTimeNotice");
  if (!el) return;

  el.style.display = isFirstTimeSetup ? "block" : "none";
}

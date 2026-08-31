// js/company/company-profile.js
//
// Single primary company profile (COMPANY-PROFILE-001). One user = one
// company for this MVP: loaded once at boot, stable for the whole session,
// edited only through this module — never re-created or re-matched by
// project creation. See docs/features/COMPANY-PROFILE-001.md.

import { loadPrimaryCompany, createCompanyProfile, updateCompanyById } from "#database/db-companies.js";
import { appState } from "#state/app-state.js";

const FORM_FIELD_IDS = [
  "companyName",
  "companyNif",
  "companyInci",
  "responsible",
  "companyPhone",
  "companyEmail",
  "companyAddress",
];

// Boot-time (and on-demand) load of the user's one company into appState.
// Safe to call repeatedly — always re-reads from the DB so a save elsewhere
// (or in another tab) is picked up.
export async function loadPrimaryCompanyIntoState() {
  const company = await loadPrimaryCompany();

  appState.primaryCompanyId = company?.id || null;
  appState.currentCompanyId = company?.id || null;
  appState.currentCompany = company;

  return company;
}

export async function resolvePrimaryCompanyId() {
  if (appState.primaryCompanyId) {
    return appState.primaryCompanyId;
  }

  const company = await loadPrimaryCompanyIntoState();
  return company?.id || null;
}

// Fills the (shared, always-present) company form fields from a company row,
// or blanks them if none exists yet. Called both to show the "Dados da
// Empresa" screen and, silently, to keep those hidden fields in sync at the
// start of a project-creation session (project-selection.js) so the
// review-step summary and report snapshot builder read correct values even
// if the user never opens the company screen this session.
export function populateCompanyForm(company) {
  setValue("companyName", company?.name || "");
  setValue("companyNif", company?.nif || "");
  setValue("companyInci", company?.impic || "");
  setValue("responsible", company?.responsible || "");
  setValue("companyPhone", company?.phone || "");
  setValue("companyEmail", company?.email || "");
  setValue("companyAddress", company?.address || "");
}

export function getCompanyFormValues() {
  return {
    companyName: getValue("companyName"),
    companyNif: getValue("companyNif"),
    companyInci: getValue("companyInci"),
    responsible: getValue("responsible"),
    companyPhone: getValue("companyPhone"),
    companyEmail: getValue("companyEmail"),
    companyAddress: getValue("companyAddress"),
  };
}

// Create-once-if-none, update-in-place otherwise — never a name/nif match.
export async function saveCompanyProfileFromForm() {
  const values = getCompanyFormValues();

  const company = appState.primaryCompanyId
    ? await updateCompanyById(appState.primaryCompanyId, values)
    : await createCompanyProfile(values);

  appState.primaryCompanyId = company.id;
  appState.currentCompanyId = company.id;
  appState.currentCompany = company;

  return company;
}

function getValue(id) {
  return document.getElementById(id)?.value || "";
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}

export const COMPANY_FORM_FIELD_IDS = FORM_FIELD_IDS;

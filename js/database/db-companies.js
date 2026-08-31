import { supabaseClient } from "#database/supabase-client.js";
import {
  cleanText,
  toNullableText,
  throwIfDbError,
} from "#database/db-helpers.js";

export async function requireUser() {
  const attempts = 3;
  const retryDelayMs = 200;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { data, error } = await supabaseClient.auth.getSession();

    throwIfDbError(error, "Erro ao verificar utilizador.");

    if (data.session?.user) {
      return data.session.user;
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error("Precisa de entrar na conta antes de guardar.");
}

export async function loadCurrentUserCompanies() {
  const user = await requireUser();

  const { data, error } = await supabaseClient
    .from("companies")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  throwIfDbError(error, "Erro ao carregar empresas.");

  return data || [];
}

// The user's single primary company profile for this MVP — the oldest company
// row they own (loadCurrentUserCompanies orders by created_at ascending), or
// null if they have none yet. See docs/features/COMPANY-PROFILE-001.md: one
// primary company per user, project creation must never duplicate it.
export async function loadPrimaryCompany() {
  const companies = await loadCurrentUserCompanies();
  return companies[0] || null;
}

// Straight insert, no name/nif matching — only ever called once, when
// loadPrimaryCompany() has already confirmed the user has zero companies.
// This replaces the old findOrCreateCompany, whose read-then-write match by
// name-or-nif was not atomic and produced duplicate rows in practice (see
// COMPANY-PROFILE-001 §2 — the live DB had 9 duplicates for one owner).
export async function createCompanyProfile(values) {
  const user = await requireUser();

  const name = cleanText(values.companyName);

  if (!name) {
    throw new Error("Nome da empresa é obrigatório.");
  }

  const { data, error } = await supabaseClient
    .from("companies")
    .insert({
      owner_id: user.id,
      name,
      nif: toNullableText(values.companyNif),
      impic: toNullableText(values.companyInci),
      responsible: toNullableText(values.responsible),
      phone: toNullableText(values.companyPhone),
      email: toNullableText(values.companyEmail),
      address: toNullableText(values.companyAddress),
      default_vat_rate: 23.0,
    })
    .select()
    .single();

  throwIfDbError(error, "Erro ao criar empresa.");
  return data;
}

export async function updateCompanyById(companyId, values) {
  const user = await requireUser();

  if (!companyId) {
    throw new Error("ID da empresa em falta.");
  }

  const name = cleanText(values.companyName);

  if (!name) {
    throw new Error("Nome da empresa é obrigatório.");
  }

  const { data, error } = await supabaseClient
    .from("companies")
    .update({
      name,
      nif: toNullableText(values.companyNif),
      impic: toNullableText(values.companyInci),
      responsible: toNullableText(values.responsible),
      phone: toNullableText(values.companyPhone),
      email: toNullableText(values.companyEmail),
      address: toNullableText(values.companyAddress),
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId)
    .eq("owner_id", user.id)
    .select()
    .single();

  throwIfDbError(error, "Erro ao atualizar empresa.");
  return data;
}
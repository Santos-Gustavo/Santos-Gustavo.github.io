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

export async function findOrCreateCompany(values) {
  const user = await requireUser();

  const name = cleanText(values.companyName);
  const nif = cleanText(values.companyNif);

  if (!name) {
    throw new Error("Nome da empresa é obrigatório.");
  }

  let query = supabaseClient
    .from("companies")
    .select("*")
    .eq("owner_id", user.id)
    .limit(1);

  if (nif) {
    query = query.eq("nif", nif);
  } else {
    query = query.eq("name", name);
  }

  const { data: existing, error: findError } = await query.maybeSingle();
  throwIfDbError(findError, "Erro ao procurar empresa.");

  const payload = {
    name,
    nif: nif || null,
    impic: toNullableText(values.companyInci),
    responsible: toNullableText(values.responsible),
    phone: toNullableText(values.companyPhone),
    email: toNullableText(values.companyEmail),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabaseClient
      .from("companies")
      .update({
        ...payload,
        nif: payload.nif || existing.nif,
        impic: payload.impic || existing.impic,
        responsible: payload.responsible || existing.responsible,
        phone: payload.phone || existing.phone,
        email: payload.email || existing.email,
      })
      .eq("id", existing.id)
      .eq("owner_id", user.id)
      .select()
      .single();

    throwIfDbError(error, "Erro ao atualizar empresa.");
    return data;
  }

  const { data, error } = await supabaseClient
    .from("companies")
    .insert({
      owner_id: user.id,
      ...payload,
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId)
    .eq("owner_id", user.id)
    .select()
    .single();

  throwIfDbError(error, "Erro ao atualizar empresa.");
  return data;
}
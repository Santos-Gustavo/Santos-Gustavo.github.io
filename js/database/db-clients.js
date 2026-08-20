import { supabaseClient } from "#database/supabase-client.js";
import {
  cleanText,
  toNullableText,
  throwIfDbError,
} from "#database/db-helpers.js";

export async function loadClientsForCompany(companyId) {
  if (!companyId) return [];

  const { data, error } = await supabaseClient
    .from("clients")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  throwIfDbError(error, "Erro ao carregar clientes.");

  return data || [];
}

export async function findOrCreateClient(companyId, values) {
  if (!companyId) {
    throw new Error("Empresa é obrigatória para criar cliente.");
  }

  const name = cleanText(values.clientName);

  if (!name) {
    throw new Error("Nome do cliente é obrigatório.");
  }

  const { data: existing, error: findError } = await supabaseClient
    .from("clients")
    .select("*")
    .eq("company_id", companyId)
    .eq("name", name)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  throwIfDbError(findError, "Erro ao procurar cliente.");

  const payload = {
    company_id: companyId,
    name,
    phone: toNullableText(values.clientPhone),
    email: toNullableText(values.clientEmail),
    nif: toNullableText(values.clientNif),
    address: toNullableText(values.location),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabaseClient
      .from("clients")
      .update(payload)
      .eq("id", existing.id)
      .eq("company_id", companyId)
      .select()
      .single();

    throwIfDbError(error, "Erro ao atualizar cliente.");
    return data;
  }

  const { data, error } = await supabaseClient
    .from("clients")
    .insert(payload)
    .select()
    .single();

  throwIfDbError(error, "Erro ao criar cliente.");
  return data;
}

export async function updateClientById(clientId, companyId, values) {
  if (!clientId) {
    throw new Error("ID do cliente em falta.");
  }

  if (!companyId) {
    throw new Error("ID da empresa em falta.");
  }

  const name = cleanText(values.clientName);

  if (!name) {
    throw new Error("Nome do cliente é obrigatório.");
  }

  const { data, error } = await supabaseClient
    .from("clients")
    .update({
      company_id: companyId,
      name,
      phone: toNullableText(values.clientPhone),
      email: toNullableText(values.clientEmail),
      nif: toNullableText(values.clientNif),
      address: toNullableText(values.location),
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .eq("company_id", companyId)
    .select()
    .single();

  throwIfDbError(error, "Erro ao atualizar cliente.");
  return data;
}
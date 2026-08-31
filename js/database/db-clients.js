import { supabaseClient } from "#database/supabase-client.js";
import {
  cleanText,
  toNullableText,
  throwIfDbError,
} from "#database/db-helpers.js";

export async function loadClientsForCompany(companyId, { includeArchived = true } = {}) {
  if (!companyId) return [];

  let query = supabaseClient
    .from("clients")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query.order("name", { ascending: true });

  throwIfDbError(error, "Erro ao carregar clientes.");

  return data || [];
}

// Client directory for the Clientes page: active + archived clients for the
// company, each annotated with how many non-deleted projects reference it.
// Joined in app code (matching loadProjectsFromDb's pattern) rather than a
// PostgREST embedded count, since clients->projects is a composite FK and
// embedding relationships isn't guaranteed to resolve one the same way.
export async function loadClientDirectoryForCompany(companyId) {
  const clients = await loadClientsForCompany(companyId, { includeArchived: true });

  if (clients.length === 0) return [];

  const clientIds = clients.map((client) => client.id);

  const { data: projectRows, error } = await supabaseClient
    .from("projects")
    .select("client_id")
    .in("client_id", clientIds)
    .is("deleted_at", null);

  throwIfDbError(error, "Erro ao carregar projetos dos clientes.");

  const projectCountByClientId = new Map();

  for (const row of projectRows || []) {
    projectCountByClientId.set(
      row.client_id,
      (projectCountByClientId.get(row.client_id) || 0) + 1
    );
  }

  return clients.map((client) => ({
    ...client,
    projectCount: projectCountByClientId.get(client.id) || 0,
  }));
}

export async function countActiveProjectsForClient(clientId) {
  if (!clientId) return 0;

  const { count, error } = await supabaseClient
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .is("deleted_at", null);

  throwIfDbError(error, "Erro ao verificar obras associadas ao cliente.");

  return count || 0;
}

export async function createClient(companyId, values) {
  if (!companyId) {
    throw new Error("Empresa é obrigatória para criar cliente.");
  }

  const name = cleanText(values.name);

  if (!name) {
    throw new Error("Nome do cliente é obrigatório.");
  }

  const payload = {
    company_id: companyId,
    name,
    phone: toNullableText(values.phone),
    email: toNullableText(values.email),
    nif: toNullableText(values.nif),
    address: toNullableText(values.address),
  };

  const { data, error } = await supabaseClient
    .from("clients")
    .insert(payload)
    .select()
    .single();

  throwIfDbError(error, "Erro ao criar cliente.");
  return data;
}

export async function updateClientRecord(clientId, companyId, values) {
  if (!clientId) {
    throw new Error("ID do cliente em falta.");
  }

  if (!companyId) {
    throw new Error("ID da empresa em falta.");
  }

  const name = cleanText(values.name);

  if (!name) {
    throw new Error("Nome do cliente é obrigatório.");
  }

  const { data, error } = await supabaseClient
    .from("clients")
    .update({
      name,
      phone: toNullableText(values.phone),
      email: toNullableText(values.email),
      nif: toNullableText(values.nif),
      address: toNullableText(values.address),
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .eq("company_id", companyId)
    .select()
    .single();

  throwIfDbError(error, "Erro ao atualizar cliente.");
  return data;
}

const CANNOT_DELETE_WITH_PROJECTS_MESSAGE =
  "Não é possível eliminar um cliente com obras associadas. Utilize a opção Arquivar.";

export async function archiveClientById(clientId, companyId) {
  if (!clientId) {
    throw new Error("ID do cliente em falta.");
  }

  if (!companyId) {
    throw new Error("ID da empresa em falta.");
  }

  const { data, error } = await supabaseClient
    .from("clients")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .eq("company_id", companyId)
    .select()
    .single();

  throwIfDbError(error, "Erro ao arquivar cliente.");
  return data;
}

export async function unarchiveClientById(clientId, companyId) {
  if (!clientId) {
    throw new Error("ID do cliente em falta.");
  }

  if (!companyId) {
    throw new Error("ID da empresa em falta.");
  }

  const { data, error } = await supabaseClient
    .from("clients")
    .update({
      archived_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .eq("company_id", companyId)
    .select()
    .single();

  throwIfDbError(error, "Erro ao reativar cliente.");
  return data;
}

// Hard delete — only ever reachable for zero-history clients. The pre-check
// below covers the normal case; the FK RESTRICT on projects.client_id
// (projects_client_company_fkey) is the DB-level backstop for races or
// soft-deleted projects that still physically reference this client, and
// surfaces here as a Postgres 23503 error we translate to the same message.
export async function deleteClientById(clientId, companyId) {
  if (!clientId) {
    throw new Error("ID do cliente em falta.");
  }

  if (!companyId) {
    throw new Error("ID da empresa em falta.");
  }

  const linkedProjectCount = await countActiveProjectsForClient(clientId);

  if (linkedProjectCount > 0) {
    throw new Error(CANNOT_DELETE_WITH_PROJECTS_MESSAGE);
  }

  const { error } = await supabaseClient
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("company_id", companyId);

  if (error?.code === "23503") {
    throw new Error(CANNOT_DELETE_WITH_PROJECTS_MESSAGE);
  }

  throwIfDbError(error, "Erro ao eliminar cliente.");
  return true;
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
    .is("archived_at", null)
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
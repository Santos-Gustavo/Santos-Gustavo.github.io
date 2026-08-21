import { supabaseClient } from "#database/supabase-client.js";
import { loadCurrentUserCompanies } from "#database/db-companies.js";
import {
  cleanText,
  toNullableText,
  toNumberOrNull,
  throwIfDbError,
} from "#database/db-helpers.js";
import { PROJECT_STATUS } from "#database/db-codes.js";
import { mapProjectRowToAppProject } from "#mappers/project-mapper.js";

export async function loadProjectsFromDb() {
  const companies = await loadCurrentUserCompanies();

  if (companies.length === 0) {
    return [];
  }

  const companyIds = companies.map((company) => company.id);

  const { data: projectRows, error: projectError } = await supabaseClient
    .from("projects")
    .select("*")
    .in("company_id", companyIds)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  throwIfDbError(projectError, "Erro ao carregar obras.");

  const projects = projectRows || [];

  if (projects.length === 0) {
    return [];
  }

  const clientIds = [...new Set(projects.map((project) => project.client_id).filter(Boolean))];
  const projectIds = projects.map((project) => project.id);

  const { data: clients, error: clientsError } = await supabaseClient
    .from("clients")
    .select("*")
    .in("id", clientIds);

  throwIfDbError(clientsError, "Erro ao carregar clientes das obras.");

  const { data: reports, error: reportsError } = await supabaseClient
    .from("reports")
    .select("project_id, report_num")
    .in("project_id", projectIds)
    .is("deleted_at", null);

  throwIfDbError(reportsError, "Erro ao carregar relatórios das obras.");

  const companiesById = new Map(companies.map((company) => [company.id, company]));
  const clientsById = new Map((clients || []).map((client) => [client.id, client]));

  const lastReportNumByProjectId = new Map();

  for (const report of reports || []) {
    const current = lastReportNumByProjectId.get(report.project_id) || 0;
    const candidate = Number(report.report_num || 0);

    if (candidate > current) {
      lastReportNumByProjectId.set(report.project_id, candidate);
    }
  }

  return projects
    .map((project) =>
      mapProjectRowToAppProject(project, {
        company: companiesById.get(project.company_id),
        client: clientsById.get(project.client_id),
        lastReportNum: lastReportNumByProjectId.get(project.id) || 0,
      }),
    )
    .filter(Boolean);
}

export async function createProjectInDb({ companyId, clientId, values }) {
  const projectName = cleanText(values.projectName);

  if (!projectName) {
    throw new Error("Nome da obra é obrigatório.");
  }

  if (!companyId) {
    throw new Error("Empresa é obrigatória para criar obra.");
  }

  if (!clientId) {
    throw new Error("Cliente é obrigatório para criar obra.");
  }

  const payload = {
    company_id: companyId,
    client_id: clientId,
    name: projectName,
    site_address: toNullableText(values.location),
    type_of_work: toNullableText(values.typeOfWork),
    start_date: values.startDate || null,
    expected_end_date: values.expectedEndDate || null,
    actual_end_date: values.actualEndDate || null,
    contract_num: toNullableText(values.contractNum),
    contract_value: toNumberOrNull(values.contractValue),
    internal_notes: toNullableText(values.internalNotes),
    status: PROJECT_STATUS.ACTIVE,
  };

  const { data, error } = await supabaseClient
    .from("projects")
    .insert(payload)
    .select()
    .single();

  throwIfDbError(error, "Erro ao criar obra.");

  return data;
}

export async function updateProjectInDb(projectId, companyId, clientId, values) {
  if (!projectId) {
    throw new Error("ID da obra em falta.");
  }

  if (!companyId) {
    throw new Error("ID da empresa em falta.");
  }

  if (!clientId) {
    throw new Error("ID do cliente em falta.");
  }

  const name = cleanText(values.projectName);

  if (!name) {
    throw new Error("Nome da obra é obrigatório.");
  }

  const payload = {
    company_id: companyId,
    client_id: clientId,
    name,
    site_address: toNullableText(values.location),
    type_of_work: toNullableText(values.typeOfWork),
    start_date: values.startDate || null,
    expected_end_date: values.expectedEndDate || null,
    actual_end_date: values.actualEndDate || null,
    contract_num: toNullableText(values.contractNum),
    contract_value: toNumberOrNull(values.contractValue),
    internal_notes: toNullableText(values.internalNotes),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("projects")
    .update(payload)
    .eq("id", projectId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .select()
    .single();

  throwIfDbError(error, "Erro ao atualizar obra.");

  return data;
}

export async function deleteProjectViaFunction(projectId) {
  if (!projectId) {
    throw new Error("ID da obra em falta.");
  }

  const { data, error } = await supabaseClient.functions.invoke("delete-project", {
    body: {
      project_id: projectId,
    },
  });

  if (error) {
    throwIfDbError(error, "Erro ao apagar obra.");
  }

  if (!data?.ok) {
    throw new Error(data?.error || "Erro ao apagar obra.");
  }

  return data;
}
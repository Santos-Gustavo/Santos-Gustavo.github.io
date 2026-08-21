// js/mappers/project-mapper.js

export function mapProjectRowToAppProject(row, relations = {}) {
  if (!row) return null;

  const client = relations.client || null;
  const company = relations.company || null;
  const lastReportNum = relations.lastReportNum || 0;

  const project = {
    id: row.id,
    projectId: row.id,

    companyId: row.company_id,
    clientId: row.client_id,

    name: row.name || "",
    siteAddress: row.site_address || "",
    location: row.site_address || "",

    typeOfWork: row.type_of_work || "",
    contractNum: row.contract_num || "",
    contractValue: row.contract_value ?? null,

    status: row.status,

    createdAt: row.created_at,
    updatedAt: row.updated_at,

    clientName: client?.name || "",
    clientPhone: client?.phone || "",
    clientEmail: client?.email || "",
    clientNif: client?.nif || "",

    companyName: company?.name || "",
    companyNif: company?.nif || "",
    companyInci: company?.impic || "",
    responsible: company?.responsible || "",
    companyPhone: company?.phone || "",
    companyEmail: company?.email || "",

    lastReportNum,
  };

  // Temporary compatibility with old UI code.
  project.obra = buildLegacyObraView(project);

  return project;
}

export function buildLegacyObraView(project) {
  return {
    projectName: project.name || "",

    companyName: project.companyName || "",
    companyNif: project.companyNif || "",
    companyInci: project.companyInci || "",
    responsible: project.responsible || "",
    companyPhone: project.companyPhone || "",
    companyEmail: project.companyEmail || "",

    clientName: project.clientName || "",
    clientPhone: project.clientPhone || "",
    clientEmail: project.clientEmail || "",
    clientNif: project.clientNif || "",

    location: project.location || "",
    contractNum: project.contractNum || "",
    contractValue: project.contractValue ?? "",
  };
}
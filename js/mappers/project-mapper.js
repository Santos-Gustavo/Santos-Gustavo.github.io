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

    status: row.status,
    archivedAt: row.archived_at || null,
    hiddenAt: row.hidden_at || null,
    closureType: row.closure_type || null,
    closureReason: row.closure_reason || null,
    closedAt: row.closed_at || null,
    reopenedAt: row.reopened_at || null,
  };


  return project;
}

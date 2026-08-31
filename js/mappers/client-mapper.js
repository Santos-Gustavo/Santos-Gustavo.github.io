// js/mappers/client-mapper.js

export function mapClientRowToAppClient(row) {
  if (!row) return null;

  return {
    id: row.id,
    companyId: row.company_id,

    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    nif: row.nif || "",
    address: row.address || "",

    projectCount: row.projectCount ?? 0,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at || null,
    deletedAt: row.deleted_at || null,
  };
}

// js/mappers/photo-mapper.js

export function mapPhotoRowToAppPhoto(row, signedUrl = null) {
  if (!row) return null;

  return {
    id: row.id,
    photoId: row.id,
    reportId: row.report_id,

    storagePath: row.storage_path || null,
    signedUrl,
    fileUrl: signedUrl,

    area: row.area || "",
    desc: row.description || "",
    description: row.description || "",
    worker: row.worker || "",

    source: row.source,
    stage: row.stage,

    isClientVisible: row.is_client_visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
// js/database/db-photos.js

import { supabaseClient } from "#database/supabase-client.js";
import { cleanText, throwIfDbError } from "#database/db-helpers.js";
import { PHOTO_SOURCE, PHOTO_STAGE } from "#database/db-codes.js";
import { optimizeImageForUpload } from "#utils/image-processing.js";
import {
  uploadProjectPhoto,
  getSignedPhotoUrls,
  evictSignedPhotoUrl,
} from "#database/storage-service.js";
import { mapPhotoRowToAppPhoto } from "#mappers/photo-mapper.js";

export async function savePhotosForReport({
  reportId,
  companyId,
  projectId,
  photos,
}) {
  const photosToSave = Array.isArray(photos) ? photos : [];

  const resolvedCompanyId = companyId;
  const resolvedProjectId = projectId;

  if (!reportId) {
    throw new Error("reportId é obrigatório para guardar fotografias.");
  }

  if (!resolvedCompanyId) {
    throw new Error("companyId é obrigatório para guardar fotografias.");
  }

  if (!resolvedProjectId) {
    throw new Error("projectId é obrigatório para guardar fotografias.");
  }

  if (photosToSave.length === 0) {
    return [];
  }

  const insertedPhotos = [];

  for (const photo of photosToSave) {
    const uploaded = await uploadPhotoIfNeeded({
      photo,
      companyId: resolvedCompanyId,
      projectId: resolvedProjectId,
      reportId,
    });

    const payload = {
      report_id: reportId,
      file_url: null,
      storage_path: uploaded.storagePath,
      thumbnail_url: null,

      area: cleanText(photo.area) || null,
      description: cleanText(photo.desc || photo.description) || null,
      worker: cleanText(photo.worker) || null,

      is_client_visible: true,
      source: PHOTO_SOURCE.UPLOAD,
      stage: mapPhotoTypeToStage(photo.type),
    };

    const { data, error } = await supabaseClient
      .from("photos")
      .insert(payload)
      .select()
      .single();

    throwIfDbError(error, "Erro ao guardar fotografia.");

    const signedUrl = uploaded.storagePath
      ? await getSignedUrlSafe(uploaded.storagePath)
      : null;

    const mapped = mapPhotoRowToAppPhoto(data, signedUrl);

    if (photo) {
      photo.storagePath = uploaded.storagePath;
      photo.fileUrl = signedUrl;
      photo.signedUrl = signedUrl;
    }

    insertedPhotos.push(mapped);
  }

  return insertedPhotos;
}

export async function loadPhotosForReport(reportId) {
  if (!reportId) return [];

  const { data, error } = await supabaseClient
    .from("photos")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });

  throwIfDbError(error, "Erro ao carregar fotografias.");

  return hydratePhotosWithSignedUrls(data || []);
}

export async function hydratePhotosWithSignedUrls(photoRows) {
  const rows = Array.isArray(photoRows) ? photoRows : [];
  const paths = rows.map((row) => row.storage_path).filter(Boolean);

  const signedUrlsByPath = await getSignedPhotoUrls(paths);

  return rows
    .map((row) => mapPhotoRowToAppPhoto(row, signedUrlsByPath.get(row.storage_path) || null))
    .filter(Boolean);
}

export async function deletePhotoViaFunction(photoId) {
  if (!photoId) {
    throw new Error("ID da fotografia em falta.");
  }

  const { data, error } = await supabaseClient.functions.invoke("delete-photo", {
    body: {
      photo_id: photoId,
    },
  });

  if (error) {
    throwIfDbError(error, "Erro ao apagar fotografia.");
  }

  if (!data?.ok) {
    throw new Error(data?.error || "Erro ao apagar fotografia.");
  }

  if (data.deletedStoragePath) {
    evictSignedPhotoUrl(data.deletedStoragePath);
  }

  return data;
}

async function uploadPhotoIfNeeded({
  photo,
  companyId,
  projectId,
  reportId,
}) {
  if (photo.storagePath) {
    return {
      storagePath: photo.storagePath,
    };
  }

  if (!photo.dataUrl) {
    return {
      storagePath: null,
    };
  }

  const optimized = await optimizeImageForUpload(photo.dataUrl, {
    maxWidth: 1600,
    quality: 0.82,
    outputType: "image/jpeg",
  });

  const fileName = `${crypto.randomUUID()}.jpg`;

  return uploadProjectPhoto({
    blob: optimized.blob,
    companyId,
    projectId,
    reportId,
    fileName,
    contentType: optimized.contentType,
  });
}

async function getSignedUrlSafe(storagePath) {
  try {
    const urls = await getSignedPhotoUrls([storagePath]);
    return urls.get(storagePath) || null;
  } catch (error) {
    console.warn("Could not create signed URL for uploaded photo:", error);
    return null;
  }
}

function mapPhotoTypeToStage(type) {
  const normalized = String(type || "").trim().toLowerCase();

  if (normalized === "before") return PHOTO_STAGE.BEFORE;
  if (normalized === "after") return PHOTO_STAGE.AFTER;

  return PHOTO_STAGE.NORMAL;
}
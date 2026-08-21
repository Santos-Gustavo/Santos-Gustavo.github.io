// js/database/storage-service.js

import { supabaseClient } from "#database/supabase-client.js";

const PHOTO_BUCKET = "project-photos";
const SIGNED_URL_EXPIRES_SECONDS = 60 * 60;
const SIGNED_URL_REFRESH_AFTER_MS = 55 * 60 * 1000;
const SIGNED_URL_BATCH_SIZE = 50;

const signedPhotoUrlCache = new Map();

export function buildPhotoStoragePath({
  companyId,
  projectId,
  reportId,
  fileName,
}) {
  if (!companyId) throw new Error("companyId é obrigatório para guardar fotografia.");
  if (!projectId) throw new Error("projectId é obrigatório para guardar fotografia.");
  if (!reportId) throw new Error("reportId é obrigatório para guardar fotografia.");
  if (!fileName) throw new Error("fileName é obrigatório para guardar fotografia.");

  return `${companyId}/${projectId}/reports/${reportId}/${fileName}`;
}

export async function uploadProjectPhoto({
  blob,
  companyId,
  projectId,
  reportId,
  fileName,
  contentType,
}) {
  const storagePath = buildPhotoStoragePath({
    companyId,
    projectId,
    reportId,
    fileName,
  });

  const { data, error } = await supabaseClient.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, blob, {
      cacheControl: "3600",
      upsert: false,
      contentType: contentType || blob.type || "image/jpeg",
    });

  if (error) {
    throw error;
  }

  return {
    storagePath: data.path,
  };
}

export async function getSignedPhotoUrl(storagePath) {
  if (!storagePath) return null;

  const cached = signedPhotoUrlCache.get(storagePath);

  if (cached && Date.now() < cached.refreshAfter) {
    return cached.signedUrl;
  }

  const { data, error } = await supabaseClient.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_SECONDS);

  if (error) {
    throw error;
  }

  const signedUrl = data?.signedUrl || null;

  if (signedUrl) {
    signedPhotoUrlCache.set(storagePath, {
      signedUrl,
      refreshAfter: Date.now() + SIGNED_URL_REFRESH_AFTER_MS,
    });
  }

  return signedUrl;
}

export async function getSignedPhotoUrls(storagePaths) {
  const uniquePaths = [...new Set((storagePaths || []).filter(Boolean))];

  const result = new Map();

  const missingPaths = [];

  for (const path of uniquePaths) {
    const cached = signedPhotoUrlCache.get(path);

    if (cached && Date.now() < cached.refreshAfter) {
      result.set(path, cached.signedUrl);
    } else {
      missingPaths.push(path);
    }
  }

  for (const batch of chunkArray(missingPaths, SIGNED_URL_BATCH_SIZE)) {
    const { data, error } = await supabaseClient.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(batch, SIGNED_URL_EXPIRES_SECONDS);

    if (error) {
      throw error;
    }

    for (const item of data || []) {
      if (!item?.path || !item?.signedUrl) continue;

      signedPhotoUrlCache.set(item.path, {
        signedUrl: item.signedUrl,
        refreshAfter: Date.now() + SIGNED_URL_REFRESH_AFTER_MS,
      });

      result.set(item.path, item.signedUrl);
    }
  }

  return result;
}

export function evictSignedPhotoUrl(storagePath) {
  if (!storagePath) return;
  signedPhotoUrlCache.delete(storagePath);
}

export function evictSignedPhotoUrls(storagePaths) {
  for (const storagePath of storagePaths || []) {
    evictSignedPhotoUrl(storagePath);
  }
}

export function clearSignedPhotoUrlCache() {
  signedPhotoUrlCache.clear();
}

function chunkArray(items, size) {
  const chunks = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}
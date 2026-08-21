// js/reports/report-photo-hydration.js

import { getSignedPhotoUrls } from "#database/storage-service.js";

export async function hydrateReportPhotoUrls(reportDocument) {
  if (!reportDocument || typeof reportDocument !== "object") {
    throw new Error("Documento de relatório inválido.");
  }

  const photos = Array.isArray(reportDocument.photos)
    ? reportDocument.photos
    : [];

  if (photos.length === 0) {
    return reportDocument;
  }

  const storagePaths = photos
    .map((photo) => photo.storagePath)
    .filter(Boolean);

  if (storagePaths.length === 0) {
    return reportDocument;
  }

  const signedUrlsByPath = await getSignedPhotoUrls(storagePaths);

  return {
    ...reportDocument,
    photos: photos.map((photo) => {
      if (!photo.storagePath) {
        return photo;
      }

      return {
        ...photo,
        displayUrl: signedUrlsByPath.get(photo.storagePath) || "",
      };
    }),
  };
}
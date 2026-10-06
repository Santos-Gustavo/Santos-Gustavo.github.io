// js/reports/report-photo-hydration.js

import { getSignedPhotoUrls } from "#database/storage-service.js";

// Signs every storage path a report snapshot references — its photos and,
// since POST-RELEASE-POLISH-001, the company logo (company.logoPath →
// company.logoUrl) — so the renderer only ever sees display URLs.
export async function hydrateReportPhotoUrls(reportDocument) {
  if (!reportDocument || typeof reportDocument !== "object") {
    throw new Error("Documento de relatório inválido.");
  }

  const photos = Array.isArray(reportDocument.photos)
    ? reportDocument.photos
    : [];
  const logoPath = reportDocument.company?.logoPath || null;

  const storagePaths = [
    ...photos.map((photo) => photo.storagePath),
    logoPath,
  ].filter(Boolean);

  if (storagePaths.length === 0) {
    return reportDocument;
  }

  const signedUrlsByPath = await getSignedPhotoUrls(storagePaths);

  return {
    ...reportDocument,
    company: logoPath
      ? { ...reportDocument.company, logoUrl: signedUrlsByPath.get(logoPath) || "" }
      : reportDocument.company,
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

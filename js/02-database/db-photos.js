const PHOTO_BUCKET = "project-photos";

async function savePhotosForReport({ reportId }) {
  if (!Array.isArray(S.photos) || S.photos.length === 0) {
    return [];
  }

  if (!reportId) {
    throw new Error("reportId is required to save photos.");
  }

  const insertedPhotos = [];

  for (const photo of S.photos) {
    const uploaded = await uploadPhotoIfNeeded({
      photo,
      reportId
    });

    const photoPayload = {
      report_id: reportId,

      file_url: uploaded.fileUrl,
      storage_path: uploaded.storagePath,
      thumbnail_url: null,

      area: cleanText(photo.area) || null,
      description: cleanText(photo.desc) || null,
      worker: cleanText(photo.worker) || null,

      source: 1,
      
      is_client_visible: true,

      source: 1
    };

    console.log("PHOTO PAYLOAD BEING SENT:", photoPayload);

    const { data, error } = await supabaseClient
      .from("photos")
      .insert(photoPayload)
      .select()
      .single();

    if (error) throw error;

    insertedPhotos.push(data);
  }

  return insertedPhotos;
}

async function uploadPhotoIfNeeded({ photo, reportId }) {
  if (photo.storagePath && photo.fileUrl) {
    return {
      storagePath: photo.storagePath,
      fileUrl: photo.fileUrl
    };
  }

  if (!photo.dataUrl) {
    return {
      storagePath: null,
      fileUrl: null
    };
  }

  const blob = dataUrlToBlob(photo.dataUrl);
  const extension = guessExtensionFromDataUrl(photo.dataUrl);
  const fileName = `${crypto.randomUUID()}.${extension}`;

  const storagePath = [
    "reports",
    reportId,
    fileName
  ].join("/");

  const { data: uploadData, error: uploadError } = await supabaseClient.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, blob, {
      cacheControl: "3600",
      upsert: false,
      contentType: blob.type || "image/jpeg"
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabaseClient.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(uploadData.path);

  return {
    storagePath: uploadData.path,
    fileUrl: publicUrlData.publicUrl
  };
}

window.savePhotosForReport = savePhotosForReport;
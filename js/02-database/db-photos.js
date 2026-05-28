const PHOTO_BUCKET = "project-photos";

function mapPhotoTag(type) {
  const map = {
    before: "before",
    during: "other",
    after: "after",
    detail: "other",

    demolition: "demolition",
    plumbing: "plumbing",
    electrical: "electrical",
    flooring: "flooring",
    painting: "painting",
    carpentry: "carpentry",
    insulation: "insulation",
    issue: "issue",
    extra: "extra_work",
    extra_work: "extra_work",
    completed: "completed_work",
    completed_work: "completed_work"
  };

  return map[type] || "other";
}

async function savePhotosForReport({ companyId, clientId, projectId, reportId }) {
  if (!Array.isArray(S.photos) || S.photos.length === 0) {
    return [];
  }

  const insertedPhotos = [];

  for (const photo of S.photos) {
    const uploaded = await uploadPhotoIfNeeded({
      photo,
      companyId,
      projectId,
      reportId
    });

    const photoPayload = {
      company_id: companyId,
      client_id: clientId,
      project_id: projectId,
      report_id: reportId,

      file_url: uploaded.fileUrl,
      storage_path: uploaded.storagePath,
      thumbnail_url: null,

      tag: mapPhotoTag(photo.type),
      area: cleanText(photo.area) || null,
      description: cleanText(photo.desc) || null,
      worker: cleanText(photo.worker) || null,

      is_before: photo.type === "before",
      is_after: photo.type === "after",

      is_client_visible: true,

      source: "manual"
    };

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

async function uploadPhotoIfNeeded({ photo, companyId, projectId, reportId }) {
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
    "companies",
    companyId,
    "projects",
    projectId,
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

// js/utils/image-processing.js

const DEFAULT_MAX_WIDTH = 1600;
const DEFAULT_QUALITY = 0.82;
const DEFAULT_OUTPUT_TYPE = "image/jpeg";

export async function optimizeImageForUpload(fileOrDataUrl, options = {}) {
  const maxWidth = options.maxWidth || DEFAULT_MAX_WIDTH;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const outputType = options.outputType || DEFAULT_OUTPUT_TYPE;

  const blob = await inputToBlob(fileOrDataUrl);
  const imageBitmap = await createImageBitmap(blob);

  const scale = imageBitmap.width > maxWidth
    ? maxWidth / imageBitmap.width
    : 1;

  const targetWidth = Math.round(imageBitmap.width * scale);
  const targetHeight = Math.round(imageBitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Não foi possível preparar a imagem.");
  }

  ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
  imageBitmap.close?.();

  const optimizedBlob = await canvasToBlob(canvas, outputType, quality);

  return {
    blob: optimizedBlob,
    contentType: optimizedBlob.type || outputType,
    width: targetWidth,
    height: targetHeight,
  };
}

export async function resizeImageForPdf(fileOrDataUrl, options = {}) {
  return optimizeImageForUpload(fileOrDataUrl, {
    maxWidth: options.maxWidth || 800,
    quality: options.quality ?? 0.75,
    outputType: options.outputType || DEFAULT_OUTPUT_TYPE,
  });
}

async function inputToBlob(input) {
  if (input instanceof Blob) {
    return input;
  }

  if (typeof input === "string" && input.startsWith("data:")) {
    return dataUrlToBlob(input);
  }

  throw new Error("Formato de imagem inválido.");
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");

  if (!header || !base64) {
    throw new Error("Data URL inválido.");
  }

  const mimeMatch = header.match(/^data:(.*?);base64$/);
  const mimeType = mimeMatch?.[1] || DEFAULT_OUTPUT_TYPE;

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Falha ao comprimir imagem."));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
}
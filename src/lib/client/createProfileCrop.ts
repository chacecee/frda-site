export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CropOptions = {
  outputWidth: number;
  outputHeight: number;
  targetBytes?: number;
  initialQuality?: number;
};

type CropResult = {
  blob: Blob;
  width: number;
  height: number;
};

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error("The selected image could not be prepared for cropping."),
      );
    image.src = source;
  });
}

function canvasToWebp(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("The cropped image could not be created."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

export async function createProfileCrop(
  imageUrl: string,
  crop: PixelCrop,
  options: CropOptions,
): Promise<CropResult> {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = options.outputWidth;
  canvas.height = options.outputHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Your browser could not crop this image.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    options.outputWidth,
    options.outputHeight,
  );

  const targetBytes = options.targetBytes ?? 600 * 1024;
  let quality = options.initialQuality ?? 0.82;
  let blob = await canvasToWebp(canvas, quality);

  while (blob.size > targetBytes && quality > 0.5) {
    quality -= 0.07;
    blob = await canvasToWebp(canvas, quality);
  }

  return {
    blob,
    width: options.outputWidth,
    height: options.outputHeight,
  };
}
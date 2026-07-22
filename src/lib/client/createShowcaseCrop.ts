export type PixelCrop = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type ShowcaseCropResult = {
    blob: Blob;
    width: number;
    height: number;
};

const OUTPUT_WIDTH = 1600;
const OUTPUT_HEIGHT = 900;
const INITIAL_QUALITY = 0.82;
const TARGET_SIZE = 600 * 1024;

function loadImage(
    source: string
): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.crossOrigin = "anonymous";

        image.onload = () => resolve(image);

        image.onerror = () =>
            reject(
                new Error(
                    "The selected image could not be prepared for cropping."
                )
            );

        image.src = source;
    });
}

function canvasToWebp(
    canvas: HTMLCanvasElement,
    quality: number
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(
                        new Error(
                            "The cropped showcase image could not be created."
                        )
                    );

                    return;
                }

                resolve(blob);
            },
            "image/webp",
            quality
        );
    });
}

export async function createShowcaseCrop(
    imageUrl: string,
    crop: PixelCrop
): Promise<ShowcaseCropResult> {
    const image = await loadImage(imageUrl);

    const sourceCanvas =
        document.createElement("canvas");

    sourceCanvas.width = Math.max(
        1,
        Math.round(crop.width)
    );

    sourceCanvas.height = Math.max(
        1,
        Math.round(crop.height)
    );

    const sourceContext =
        sourceCanvas.getContext("2d");

    if (!sourceContext) {
        throw new Error(
            "Your browser could not crop this image."
        );
    }

    sourceContext.imageSmoothingEnabled = true;
    sourceContext.imageSmoothingQuality = "high";

    sourceContext.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height
    );

    const outputCanvas =
        document.createElement("canvas");

    outputCanvas.width = OUTPUT_WIDTH;
    outputCanvas.height = OUTPUT_HEIGHT;

    const outputContext =
        outputCanvas.getContext("2d");

    if (!outputContext) {
        throw new Error(
            "Your browser could not resize this image."
        );
    }

    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = "high";

    outputContext.drawImage(
        sourceCanvas,
        0,
        0,
        OUTPUT_WIDTH,
        OUTPUT_HEIGHT
    );

    let quality = INITIAL_QUALITY;

    let blob = await canvasToWebp(
        outputCanvas,
        quality
    );

    while (
        blob.size > TARGET_SIZE &&
        quality > 0.55
    ) {
        quality -= 0.07;

        blob = await canvasToWebp(
            outputCanvas,
            quality
        );
    }

    return {
        blob,
        width: OUTPUT_WIDTH,
        height: OUTPUT_HEIGHT,
    };
}
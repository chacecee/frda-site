const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1000;
const INITIAL_QUALITY = 0.82;
const TARGET_FILE_SIZE = 700 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(
                new Error(
                    "The selected image could not be processed."
                )
            );
        };

        image.src = objectUrl;
    });
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    quality: number
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(
                        new Error(
                            "The image could not be compressed."
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

export type CompressedDeveloperImage = {
    blob: Blob;
    width: number;
    height: number;
};

export async function compressDeveloperImage(
    file: File
): Promise<CompressedDeveloperImage> {
    if (!file.type.startsWith("image/")) {
        throw new Error(
            "Please select an image file."
        );
    }

    if (file.size > 10 * 1024 * 1024) {
        throw new Error(
            "The original image must be smaller than 10 MB."
        );
    }

    const image = await loadImage(file);

    const scale = Math.min(
        1,
        MAX_WIDTH / image.naturalWidth,
        MAX_HEIGHT / image.naturalHeight
    );

    const width = Math.max(
        1,
        Math.round(image.naturalWidth * scale)
    );

    const height = Math.max(
        1,
        Math.round(image.naturalHeight * scale)
    );

    const canvas =
        document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error(
            "Your browser could not process the image."
        );
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    context.drawImage(
        image,
        0,
        0,
        width,
        height
    );

    let quality = INITIAL_QUALITY;
    let blob = await canvasToBlob(
        canvas,
        quality
    );

    while (
        blob.size > TARGET_FILE_SIZE &&
        quality > 0.55
    ) {
        quality -= 0.07;

        blob = await canvasToBlob(
            canvas,
            quality
        );
    }

    return {
        blob,
        width,
        height,
    };
}
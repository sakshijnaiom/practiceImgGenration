import type { ImageInput } from "../product-input/product-input";
import type { InternalTemplateConfig } from "./template-library";

export interface LogoImageMetadata {
  readonly width: number;
  readonly height: number;
}

export interface LogoMetadataProvider {
  getMetadata(image: ImageInput): Promise<LogoImageMetadata>;
}

export interface LogoRenderCommand {
  readonly type: "logo";
  /** Original uploaded source; the logo is never regenerated or redesigned. */
  readonly source: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly preservedAspectRatio: true;
  readonly preserveOriginalPixels: true;
}

/**
 * Fits the original logo inside the internal template region using contain
 * behavior. No user-supplied position, scale, margin, or transformation is
 * accepted.
 */
export class LogoRenderer {
  constructor(private readonly metadataProvider: LogoMetadataProvider) {}

  async createRenderCommand(
    logo: ImageInput,
    template: InternalTemplateConfig,
  ): Promise<LogoRenderCommand> {
    const metadata = await this.metadataProvider.getMetadata(logo);
    if (metadata.width <= 0 || metadata.height <= 0) {
      throw new Error("Company logo dimensions must be positive.");
    }

    const region = template.logoPlacement.region;
    const regionWidth = Math.round(
      (region.right - region.left) * template.canvas.width,
    );
    const regionHeight = Math.round(
      (region.bottom - region.top) * template.canvas.height,
    );
    const regionX = Math.round(region.left * template.canvas.width);
    const regionY = Math.round(region.top * template.canvas.height);

    const aspectRatio = metadata.width / metadata.height;
    const scale = Math.min(
      regionWidth / metadata.width,
      regionHeight / metadata.height,
      // Do not enlarge a small source logo and introduce blur.
      1,
    );
    const scaledWidth = metadata.width * scale;
    const width = Math.max(1, Math.round(scaledWidth));
    const height = Math.max(1, Math.round(width / aspectRatio));

    // This assertion protects the no-stretch invariant if the calculation is
    // changed later.
    if (Math.abs(width / height - aspectRatio) > 0.02) {
      throw new Error("Logo placement would alter the original aspect ratio.");
    }

    return {
      type: "logo",
      source: logo.source,
      x: regionX + Math.round((regionWidth - width) / 2),
      y: regionY + Math.round((regionHeight - height) / 2),
      width,
      height,
      preservedAspectRatio: true,
      preserveOriginalPixels: true,
    };
  }
}

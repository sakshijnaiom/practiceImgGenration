import type { ReferenceImageAsset } from "../product-input/reference-image-preprocessor";
import { createSurfaceTransform } from "./dynamic-content-renderer";
import type {
  SurfaceTransformPlan,
  ContentRenderPlan,
  TransparentLayerAsset,
} from "./dynamic-content-renderer";
import type { InternalTemplateConfig } from "./template-library";
import {
  AutomaticRenderingValidator,
  RenderingValidationError,
} from "./rendering-validation";
import type { RenderingValidationEvidence } from "./rendering-validation";
import type { ProductInputData } from "../product-input/product-input";

export interface FinalImageCompositionRequest {
  readonly product: ProductInputData | undefined;
  readonly originalImage: ReferenceImageAsset;
  readonly cleanedSurface: ReferenceImageAsset;
  readonly dynamicContentLayer: TransparentLayerAsset;
  readonly contentPlan: ContentRenderPlan;
  readonly logoLayer: TransparentLayerAsset;
  readonly template: InternalTemplateConfig | undefined;
}

export interface PreparedProductSurface {
  readonly source: ReferenceImageAsset;
  readonly preservesOriginalAppearance: true;
}

export interface FinalProductImage {
  readonly image: ReferenceImageAsset;
  readonly templateId: InternalTemplateConfig["id"];
  readonly appliedTransform: SurfaceTransformPlan;
  readonly layerOrder: readonly ["surface", "dynamic-content", "logo"];
}

/**
 * Local raster operations used by the compositor. The implementation must
 * preserve the original silhouette, shadows, highlights, edges, texture, and
 * perspective while replacing packaging content on the prepared surface.
 */
export interface LocalCompositingBackend {
  prepareSurface(
    originalImage: ReferenceImageAsset,
    cleanedSurface: ReferenceImageAsset,
    template: InternalTemplateConfig,
  ): Promise<PreparedProductSurface>;

  transformLayer(
    layer: TransparentLayerAsset,
    transform: SurfaceTransformPlan,
  ): Promise<TransparentLayerAsset>;

  blendLayer(
    surface: PreparedProductSurface,
    layer: TransparentLayerAsset,
    layerName: "dynamic-content" | "logo",
  ): Promise<PreparedProductSurface>;

  flatten(
    surface: PreparedProductSurface,
    template: InternalTemplateConfig,
  ): Promise<ReferenceImageAsset>;

  inspectComposition(
    surface: PreparedProductSurface,
    dynamicContentLayer: TransparentLayerAsset,
    logoLayer: TransparentLayerAsset,
    template: InternalTemplateConfig,
  ): Promise<RenderingValidationEvidence>;
}

function assertImageSource(
  image: ReferenceImageAsset | TransparentLayerAsset,
  name: string,
): void {
  if (!image.source?.trim()) {
    throw new Error(`${name} is required for final image composition.`);
  }
}

function assertTransparentLayer(
  layer: TransparentLayerAsset,
  name: string,
): void {
  assertImageSource(layer, name);
  if (!layer.transparent || layer.mimeType !== "image/png") {
    throw new Error(`${name} must be a transparent PNG layer.`);
  }
  if (layer.width <= 0 || layer.height <= 0) {
    throw new Error(`${name} must have positive dimensions.`);
  }
}

export class FinalImageCompositor {
  constructor(
    private readonly backend: LocalCompositingBackend,
    private readonly validator = new AutomaticRenderingValidator(),
  ) {}

  async compose(
    request: FinalImageCompositionRequest,
  ): Promise<FinalProductImage> {
    if (!request.template) {
      throw new RenderingValidationError([
        {
          code: "TEMPLATE_MISSING",
          message: "No internal product template was resolved.",
        },
      ]);
    }

    assertImageSource(request.originalImage, "Original/reference image");
    assertImageSource(request.cleanedSurface, "Cleaned surface");
    assertTransparentLayer(request.dynamicContentLayer, "Dynamic content layer");
    assertTransparentLayer(request.logoLayer, "Logo layer");

    const surface = await this.backend.prepareSurface(
      request.originalImage,
      request.cleanedSurface,
      request.template,
    );
    const transform = createSurfaceTransform(request.template);

    // Transform and blend in this order so the logo remains a distinct,
    // preserved asset and is not regenerated or flattened into the text layer.
    const transformedContent = await this.backend.transformLayer(
      request.dynamicContentLayer,
      transform,
    );
    const withContent = await this.backend.blendLayer(
      surface,
      transformedContent,
      "dynamic-content",
    );

    const transformedLogo = await this.backend.transformLayer(
      request.logoLayer,
      transform,
    );
    const withLogo = await this.backend.blendLayer(
      withContent,
      transformedLogo,
      "logo",
    );

    const evidence = await this.backend.inspectComposition(
      withLogo,
      transformedContent,
      transformedLogo,
      request.template,
    );
    const validation = this.validator.validate({
      product: request.product,
      template: request.template,
      plan: request.contentPlan,
      evidence,
    });

    if (!validation.valid) {
      throw new RenderingValidationError(validation.errors);
    }

    const image = await this.backend.flatten(withLogo, request.template);
    assertImageSource(image, "Final image");

    return {
      image,
      templateId: request.template.id,
      appliedTransform: transform,
      layerOrder: ["surface", "dynamic-content", "logo"],
    };
  }
}

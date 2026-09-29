import {
  DEFAULT_PRODUCT_TYPE_REGISTRY,
  getTemplateForProductType,
} from "./product-type-registry";

import type {
  ProductTemplateId,
  ProductType,
  ProductTypeRegistry,
} from "./product-type-registry";

export interface ReferenceImageAsset {
  /** A local file path, data URL, or object-storage reference. */
  source: string;
  mimeType?: string;
}

export type SurfaceKind = "flat" | "curved" | "unknown";

export type ExistingContentKind =
  | "product-name"
  | "logo"
  | "manufacturer"
  | "branding"
  | "printed-text"
  | "label-content"
  | "packaging-information"
  | "unknown";

/** Internal coordinates are produced by image analysis, never by the user. */
export interface InternalRegionBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface DetectedContentRegion {
  id: string;
  kind: ExistingContentKind;
  surfaceId: string;
  confidence: number;
  bounds: InternalRegionBounds;
}

export interface DetectedProductSurface {
  id: string;
  kind: SurfaceKind;
  confidence: number;
  bounds: InternalRegionBounds;
  contentRegions: DetectedContentRegion[];
}

export interface ReferenceImageAnalysis {
  surfaces: DetectedProductSurface[];
  /** Pixels/features that must be preserved during reconstruction. */
  preservedFeatures: readonly PreservedFeature[];
}

export type PreservedFeature =
  | "product-silhouette"
  | "packaging-structure"
  | "edges"
  | "shadows"
  | "highlights"
  | "texture"
  | "perspective"
  | "realistic-appearance";

export type SurfaceReconstructionMethod =
  | "local-surface-reconstruction"
  | "texture-aware-inpainting"
  | "flat-surface-fill";

export interface ReferenceImagePreprocessingProfile {
  templateId: ProductTemplateId;
  reconstructionMethod: SurfaceReconstructionMethod;
  preserve: readonly PreservedFeature[];
  removeExistingContent: boolean;
}

export const DEFAULT_REFERENCE_IMAGE_PROFILE: ReferenceImagePreprocessingProfile = {
  templateId: "generic",
  reconstructionMethod: "local-surface-reconstruction",
  preserve: [
    "product-silhouette",
    "packaging-structure",
    "edges",
    "shadows",
    "highlights",
    "texture",
    "perspective",
    "realistic-appearance",
  ],
  removeExistingContent: true,
};

/** Template-specific behavior is configuration; it is not rendering code. */
export const DEFAULT_REFERENCE_IMAGE_PROFILES: Readonly<
  Record<string, ReferenceImagePreprocessingProfile>
> = {
  generic: DEFAULT_REFERENCE_IMAGE_PROFILE,
  box: {
    ...DEFAULT_REFERENCE_IMAGE_PROFILE,
    templateId: "box",
    reconstructionMethod: "flat-surface-fill",
  },
  bottle: {
    ...DEFAULT_REFERENCE_IMAGE_PROFILE,
    templateId: "bottle",
    reconstructionMethod: "texture-aware-inpainting",
  },
  drops: {
    ...DEFAULT_REFERENCE_IMAGE_PROFILE,
    templateId: "drops",
    reconstructionMethod: "texture-aware-inpainting",
  },
  tube: {
    ...DEFAULT_REFERENCE_IMAGE_PROFILE,
    templateId: "tube",
    reconstructionMethod: "texture-aware-inpainting",
  },
  serum: {
    ...DEFAULT_REFERENCE_IMAGE_PROFILE,
    templateId: "serum",
    reconstructionMethod: "texture-aware-inpainting",
  },
  vial: {
    ...DEFAULT_REFERENCE_IMAGE_PROFILE,
    templateId: "vial",
    reconstructionMethod: "texture-aware-inpainting",
  },
};

export interface ReferenceImagePreprocessingRequest {
  referenceImage: ReferenceImageAsset;
  productType: ProductType;
}

export interface PreprocessedReferenceImage {
  cleanReferenceImage: ReferenceImageAsset;
  productType: ProductType;
  templateId: ProductTemplateId;
  analysis: ReferenceImageAnalysis;
  profile: ReferenceImagePreprocessingProfile;
  warnings: string[];
}

/**
 * Local image-processing implementation supplied by the application.
 *
 * A backend must reconstruct the pixels under detected content instead of
 * compositing new text over the old pixels. It must preserve the features in
 * the selected profile. The interface permits different local implementations
 * without coupling this module to a rendering library or external AI API.
 */
export interface LocalImageProcessingBackend {
  analyzeReferenceImage(
    image: ReferenceImageAsset,
    profile: ReferenceImagePreprocessingProfile,
  ): Promise<ReferenceImageAnalysis>;

  reconstructCleanSurface(
    image: ReferenceImageAsset,
    analysis: ReferenceImageAnalysis,
    profile: ReferenceImagePreprocessingProfile,
  ): Promise<ReferenceImageAsset>;
}

export class ReferenceImagePreprocessor {
  private readonly profiles: Readonly<
    Record<string, ReferenceImagePreprocessingProfile>
  >;

  constructor(
    private readonly backend: LocalImageProcessingBackend,
    private readonly productTypeRegistry: ProductTypeRegistry =
      DEFAULT_PRODUCT_TYPE_REGISTRY,
    profiles: Readonly<Record<string, ReferenceImagePreprocessingProfile>> =
      DEFAULT_REFERENCE_IMAGE_PROFILES,
  ) {
    this.profiles = profiles;
  }

  async preprocess(
    request: ReferenceImagePreprocessingRequest,
  ): Promise<PreprocessedReferenceImage> {
    if (!request.referenceImage?.source?.trim()) {
      throw new Error("Reference image is required for preprocessing.");
    }

    const templateId = getTemplateForProductType(
      request.productType,
      this.productTypeRegistry,
    );
    const profile =
      this.profiles[templateId] ??
      this.profiles.generic ??
      DEFAULT_REFERENCE_IMAGE_PROFILE;

    if (!profile.removeExistingContent) {
      throw new Error(
        `Preprocessing profile '${templateId}' must remove existing content.`,
      );
    }

    const analysis = await this.backend.analyzeReferenceImage(
      request.referenceImage,
      profile,
    );

    if (analysis.surfaces.length === 0) {
      throw new Error(
        "No product surface could be detected in the reference image.",
      );
    }

    const cleanReferenceImage = await this.backend.reconstructCleanSurface(
      request.referenceImage,
      analysis,
      profile,
    );

    const warnings: string[] = [];
    if (
      analysis.surfaces.some(
        (surface) => surface.confidence < 0.7,
      )
    ) {
      warnings.push(
        "One or more product surfaces were detected with low confidence.",
      );
    }
    if (
      analysis.surfaces.some((surface) => surface.contentRegions.length === 0)
    ) {
      warnings.push(
        "No existing content region was detected on one or more surfaces; verify the cleaned image before rendering.",
      );
    }

    return {
      cleanReferenceImage,
      productType: request.productType,
      templateId,
      analysis,
      profile,
      warnings,
    };
  }
}

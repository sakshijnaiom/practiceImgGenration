import { selectInternalTemplate } from "./template-library";

import type {
  InternalTemplateConfig,
  InternalTemplateId,
} from "./template-library";
import type {
  ProductType,
  ProductTypeRegistry,
} from "../product-input/product-type-registry";
import { DEFAULT_PRODUCT_TYPE_REGISTRY } from "../product-input/product-type-registry";
import type { ReferenceImageAsset } from "../product-input/reference-image-preprocessor";

export type CleaningStrategyId =
  | "flat-box"
  | "bottle-label"
  | "curved-bottle"
  | "tube"
  | "drops-bottle";

export interface CleaningPipelineRequest {
  referenceImage: ReferenceImageAsset;
  productType: ProductType;
}

export interface DetectedCleaningSurface {
  readonly id: string;
  readonly kind: "flat" | "curved";
  readonly confidence: number;
}

export interface RemovedContentRegion {
  readonly id: string;
  readonly kind: string;
  readonly confidence: number;
}

export interface CleanProductSurface {
  readonly cleanImage: ReferenceImageAsset;
  readonly surface: DetectedCleaningSurface;
  readonly templateId: InternalTemplateId;
  readonly strategyId: CleaningStrategyId;
  readonly removedContent: readonly RemovedContentRegion[];
  readonly warnings: readonly string[];
}

export interface CleaningStrategyInput {
  readonly referenceImage: ReferenceImageAsset;
  readonly template: InternalTemplateConfig;
  readonly strategyId: CleaningStrategyId;
}

/**
 * Local operations required by the cleaning pipeline. Implementations may use
 * a local raster library, but this contract has no network or external AI API
 * dependency.
 */
export interface LocalCleaningOperations {
  identifyContentSurface(
    input: CleaningStrategyInput,
  ): Promise<DetectedCleaningSurface>;

  detectExistingContent(
    input: CleaningStrategyInput,
    surface: DetectedCleaningSurface,
  ): Promise<readonly RemovedContentRegion[]>;

  removeExistingContent(
    input: CleaningStrategyInput,
    surface: DetectedCleaningSurface,
    content: readonly RemovedContentRegion[],
  ): Promise<ReferenceImageAsset>;

  preserveProductAppearance(
    input: CleaningStrategyInput,
    surface: DetectedCleaningSurface,
    cleanedImage: ReferenceImageAsset,
  ): Promise<ReferenceImageAsset>;
}

export interface ReferenceImageCleaningStrategy {
  readonly id: CleaningStrategyId;
  clean(input: CleaningStrategyInput): Promise<CleanProductSurface>;
}

function createStrategy(
  id: CleaningStrategyId,
  operations: LocalCleaningOperations,
): ReferenceImageCleaningStrategy {
  return {
    id,
    async clean(input): Promise<CleanProductSurface> {
      const surface = await operations.identifyContentSurface(input);
      if (surface.confidence < 0.7) {
        throw new Error(
          `The ${id} cleaning strategy could not identify the product surface with sufficient confidence.`,
        );
      }

      const existingContent = await operations.detectExistingContent(
        input,
        surface,
      );
      const clearedImage = await operations.removeExistingContent(
        input,
        surface,
        existingContent,
      );
      const cleanImage = await operations.preserveProductAppearance(
        input,
        surface,
        clearedImage,
      );

      const warnings: string[] = [];
      if (existingContent.length === 0) {
        warnings.push(
          "No existing packaging content was detected; verify the clean surface before rendering.",
        );
      }

      return {
        cleanImage,
        surface,
        templateId: input.template.id,
        strategyId: id,
        removedContent: existingContent,
        warnings,
      };
    },
  };
}

/**
 * Creates the default strategy set. The strategies share one generic
 * execution pipeline; only their template configuration and strategy id
 * differ. This keeps cleaning behavior modular without separate renderers.
 */
export function createReferenceImageCleaningStrategies(
  operations: LocalCleaningOperations,
): Readonly<Record<CleaningStrategyId, ReferenceImageCleaningStrategy>> {
  return {
    "flat-box": createStrategy("flat-box", operations),
    "bottle-label": createStrategy("bottle-label", operations),
    "curved-bottle": createStrategy("curved-bottle", operations),
    tube: createStrategy("tube", operations),
    "drops-bottle": createStrategy("drops-bottle", operations),
  };
}

const TEMPLATE_TO_STRATEGY: Readonly<
  Record<InternalTemplateId, CleaningStrategyId>
> = {
  BOX: "flat-box",
  BOTTLE: "curved-bottle",
  DROPS_BOTTLE: "drops-bottle",
  TUBE: "tube",
};

export class ReferenceImageCleaningPipeline {
  constructor(
    private readonly strategies: Readonly<
      Record<CleaningStrategyId, ReferenceImageCleaningStrategy>
    >,
    private readonly productTypeRegistry: ProductTypeRegistry =
      DEFAULT_PRODUCT_TYPE_REGISTRY,
  ) {}

  async clean(
    request: CleaningPipelineRequest,
  ): Promise<CleanProductSurface> {
    if (!request.referenceImage?.source?.trim()) {
      throw new Error("Reference image is required for cleaning.");
    }

    const template = selectInternalTemplate(
      request.productType,
      this.productTypeRegistry,
    );
    const strategyId = TEMPLATE_TO_STRATEGY[template.id];
    const strategy = this.strategies[strategyId];

    if (!strategy) {
      throw new Error(
        `No reference-image cleaning strategy is configured for template '${template.id}'.`,
      );
    }

    return strategy.clean({
      referenceImage: request.referenceImage,
      template,
      strategyId,
    });
  }
}

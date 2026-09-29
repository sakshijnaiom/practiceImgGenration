import {
  validateProductInput,
} from "../product-input/product-input";
import type { ProductInputData } from "../product-input/product-input";
import type { ProductType } from "../product-input/product-type-registry";
import type { CleanProductSurface } from "./reference-image-cleaning-pipeline";
import type { DynamicContentRenderResult } from "./dynamic-content-renderer";
import type { TransparentLayerAsset } from "./dynamic-content-renderer";
import type { InternalTemplateConfig } from "./template-library";
import type {
  FinalProductImage,
  FinalImageCompositionRequest,
} from "./final-image-compositor";

export interface BulkGenerationRequest {
  readonly products: readonly unknown[];
}

export interface BulkGenerationError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface BulkGenerationItemResult {
  readonly index: number;
  readonly status: "succeeded" | "failed";
  readonly productName?: string;
  readonly productType?: string;
  readonly result?: FinalProductImage;
  readonly errors: readonly BulkGenerationError[];
}

export interface BulkGenerationResult {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly items: readonly BulkGenerationItemResult[];
}

export interface BulkGenerationDependencies {
  selectTemplate(productType: ProductType): Promise<InternalTemplateConfig> | InternalTemplateConfig;
  cleanReferenceImage(input: {
    readonly productType: ProductType;
    readonly referenceImage: ProductInputData["referenceImage"];
  }): Promise<CleanProductSurface>;
  renderDynamicContent(
    product: ProductInputData,
    template: InternalTemplateConfig,
  ): Promise<DynamicContentRenderResult>;
  renderLogoLayer(
    product: ProductInputData,
    template: InternalTemplateConfig,
  ): Promise<TransparentLayerAsset>;
  compose(request: FinalImageCompositionRequest): Promise<FinalProductImage>;
}

function errorFromUnknown(error: unknown): BulkGenerationError {
  if (error instanceof Error) {
    return { code: error.name, message: error.message };
  }
  return {
    code: "BULK_GENERATION_ERROR",
    message: "Product image generation failed.",
    details: error,
  };
}

export class BulkProductImageGenerator {
  constructor(private readonly dependencies: BulkGenerationDependencies) {}

  async generate(
    request: BulkGenerationRequest,
  ): Promise<BulkGenerationResult> {
    const items: BulkGenerationItemResult[] = [];

    for (const [index, rawProduct] of request.products.entries()) {
      items.push(await this.generateOne(index, rawProduct));
    }

    const succeeded = items.filter((item) => item.status === "succeeded").length;
    return {
      total: items.length,
      succeeded,
      failed: items.length - succeeded,
      items,
    };
  }

  private async generateOne(
    index: number,
    rawProduct: unknown,
  ): Promise<BulkGenerationItemResult> {
    const validation = validateProductInput(rawProduct);
    if (!validation.valid || !validation.value) {
      return {
        index,
        status: "failed",
        errors: validation.errors.map((error) => ({
          code: error.code,
          message: error.message,
          details: { field: error.field },
        })),
      };
    }

    const product = validation.value;
    const base = {
      index,
      productName: product.productName,
      productType: product.productType,
    };

    try {
      const template = await this.dependencies.selectTemplate(product.productType);
      const cleanedSurface = await this.dependencies.cleanReferenceImage({
        productType: product.productType,
        referenceImage: product.referenceImage,
      });
      const dynamicContent = await this.dependencies.renderDynamicContent(
        product,
        template,
      );
      const logoLayer = await this.dependencies.renderLogoLayer(
        product,
        template,
      );
      const result = await this.dependencies.compose({
        product,
        originalImage: product.referenceImage,
        cleanedSurface: cleanedSurface.cleanImage,
        dynamicContentLayer: dynamicContent.layer,
        contentPlan: dynamicContent.plan,
        logoLayer,
        template,
      });

      return { ...base, status: "succeeded", result, errors: [] };
    } catch (error) {
      return {
        ...base,
        status: "failed",
        errors: [errorFromUnknown(error)],
      };
    }
  }
}

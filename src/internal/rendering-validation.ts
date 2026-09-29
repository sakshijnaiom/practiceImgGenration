import type { ProductInputData } from "../product-input/product-input";
import type { InternalTemplateConfig } from "./template-library";
import type {
  ContentRenderPlan,
  RenderedLogoElement,
  RenderedTextElement,
} from "./dynamic-content-renderer";

export type RenderingValidationErrorCode =
  | "LOGO_DISTORTED"
  | "PRODUCT_NAME_CLIPPED"
  | "TEXT_OVERFLOW"
  | "CONTENT_OUTSIDE_SURFACE"
  | "OLD_CONTENT_VISIBLE"
  | "INVALID_IMAGE_DIMENSIONS"
  | "REQUIRED_PRODUCT_DATA_MISSING"
  | "TEMPLATE_MISSING"
  | "OUTPUT_CANNOT_BE_GENERATED";

export interface RenderingValidationIssue {
  readonly code: RenderingValidationErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface RenderingValidationEvidence {
  readonly logoAspectRatioPreserved: boolean;
  readonly contentOutsideSurface: boolean;
  readonly oldContentVisible: boolean;
  readonly outputCanBeGenerated: boolean;
}

export interface RenderingValidationContext {
  readonly product: ProductInputData | undefined;
  readonly template: InternalTemplateConfig | undefined;
  readonly plan: ContentRenderPlan;
  readonly evidence: RenderingValidationEvidence;
}

export interface RenderingValidationResult {
  readonly valid: boolean;
  readonly errors: readonly RenderingValidationIssue[];
}

function isInsideSurface(
  element: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  template: InternalTemplateConfig,
): boolean {
  const surface = template.contentSurface.region;
  const left = surface.left * template.canvas.width;
  const top = surface.top * template.canvas.height;
  const right = surface.right * template.canvas.width;
  const bottom = surface.bottom * template.canvas.height;
  return (
    element.x >= left &&
    element.y >= top &&
    element.x + element.width <= right &&
    element.y + element.height <= bottom
  );
}

function isWithinCanvas(
  element: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  template: InternalTemplateConfig,
): boolean {
  return (
    element.x >= 0 &&
    element.y >= 0 &&
    element.x + element.width <= template.canvas.width &&
    element.y + element.height <= template.canvas.height
  );
}

export class AutomaticRenderingValidator {
  validate(context: RenderingValidationContext): RenderingValidationResult {
    const errors: RenderingValidationIssue[] = [];
    const { product, template, plan, evidence } = context;

    if (!template) {
      errors.push({
        code: "TEMPLATE_MISSING",
        message: "No internal product template was resolved.",
      });
      return { valid: false, errors };
    }

    if (
      !product ||
      !product.productType ||
      !product.productName ||
      !product.referenceImage ||
      !product.companyLogo
    ) {
      errors.push({
        code: "REQUIRED_PRODUCT_DATA_MISSING",
        message: "Required product data is missing before rendering.",
        details: {
          productType: Boolean(product?.productType),
          productName: Boolean(product?.productName),
          referenceImage: Boolean(product?.referenceImage),
          companyLogo: Boolean(product?.companyLogo),
        },
      });
    }

    if (
      template.canvas.width <= 0 ||
      template.canvas.height <= 0 ||
      !Number.isFinite(template.canvas.width) ||
      !Number.isFinite(template.canvas.height)
    ) {
      errors.push({
        code: "INVALID_IMAGE_DIMENSIONS",
        message: "Template output dimensions are invalid.",
        details: { width: template.canvas.width, height: template.canvas.height },
      });
    }

    if (!evidence.logoAspectRatioPreserved) {
      errors.push({
        code: "LOGO_DISTORTED",
        message: "Logo aspect ratio was not preserved.",
      });
    }

    const textElements = plan.elements.filter(
      (element): element is RenderedTextElement => element.type === "text",
    );
    const logoElements = plan.elements.filter(
      (element): element is RenderedLogoElement => element.type === "logo",
    );

    for (const element of [...textElements, ...logoElements]) {
      if (!isWithinCanvas(element, template)) {
        errors.push({
          code: element.type === "text" && element.slot === "productName"
            ? "PRODUCT_NAME_CLIPPED"
            : "TEXT_OVERFLOW",
          message: `${element.type === "text" ? element.slot : "logo"} exceeds the output image bounds.`,
          details: { element },
        });
      }

      if (!isInsideSurface(element, template)) {
        errors.push({
          code: "CONTENT_OUTSIDE_SURFACE",
          message: `${element.type === "text" ? element.slot : "logo"} extends outside the packaging surface.`,
          details: { element },
        });
      }
    }

    const productName = textElements.find((element) => element.slot === "productName");
    if (product?.productName && !productName) {
      errors.push({
        code: "PRODUCT_NAME_CLIPPED",
        message: "Product name could not be placed within its template region.",
      });
    }

    if (evidence.contentOutsideSurface) {
      errors.push({
        code: "CONTENT_OUTSIDE_SURFACE",
        message: "The rendered content extends outside the packaging surface.",
      });
    }

    if (evidence.oldContentVisible) {
      errors.push({
        code: "OLD_CONTENT_VISIBLE",
        message: "Existing reference packaging content remains visible underneath the new content.",
      });
    }

    if (!evidence.outputCanBeGenerated) {
      errors.push({
        code: "OUTPUT_CANNOT_BE_GENERATED",
        message: "The output image backend cannot generate the requested final image.",
      });
    }

    return { valid: errors.length === 0, errors };
  }
}

export class RenderingValidationError extends Error {
  readonly code = "RENDERING_VALIDATION_FAILED";

  constructor(readonly errors: readonly RenderingValidationIssue[]) {
    super(
      `Rendering validation failed: ${errors
        .map((error) => error.message)
        .join("; ")}`,
    );
    this.name = "RenderingValidationError";
  }
}

/**
 * User-facing input for pharmaceutical product image generation.
 *
 * Placement and rendering controls intentionally do not belong to this model.
 * They are derived by the internal layout system after validation.
 */
import {
  DEFAULT_PRODUCT_TYPE_REGISTRY,
  isSupportedProductType,
  normalizeProductType,
  SUPPORTED_PRODUCT_TYPES,
} from "./product-type-registry";

import type { ProductType } from "./product-type-registry";

export { SUPPORTED_PRODUCT_TYPES } from "./product-type-registry";
export type { ProductType } from "./product-type-registry";

export interface ImageInput {
  /** A data URL, object-storage URL, or another supported image reference. */
  source: string;
  /** Optional MIME type, used when source is not a data URL. */
  mimeType?: string;
  /** Optional original filename for diagnostics and audit records. */
  fileName?: string;
}

export interface ProductInputData {
  productType: ProductType;
  productName: string;
  referenceImage: ImageInput;
  companyLogo: ImageInput;

  genericName?: string;
  composition?: string;
  strength?: string;
  packSize?: string;
  unit?: string;
  manufacturer?: string;
  additionalContent?: string;
}

export type ProductInputField =
  | "productType"
  | "productName"
  | "referenceImage"
  | "companyLogo"
  | "genericName"
  | "composition"
  | "strength"
  | "packSize"
  | "unit"
  | "manufacturer"
  | "additionalContent";

export type ProductInputErrorCode =
  | "MISSING_REFERENCE_IMAGE"
  | "MISSING_PRODUCT_TYPE"
  | "MISSING_PRODUCT_NAME"
  | "MISSING_LOGO"
  | "UNSUPPORTED_PRODUCT_TYPE"
  | "INVALID_IMAGE"
  | "INVALID_INPUT"
  | "FORBIDDEN_FIELD";

export interface ProductInputValidationError {
  field: ProductInputField | "input";
  code: ProductInputErrorCode;
  message: string;
}

export interface ProductInputValidationResult {
  valid: boolean;
  errors: ProductInputValidationError[];
  value?: ProductInputData;
}

// These fields are deliberately rejected if sent by a client. The client must
// never control placement or rendering decisions.
const FORBIDDEN_CLIENT_FIELDS = [
  "x",
  "y",
  "coordinates",
  "margins",
  "scale",
  "scaling",
  "mask",
  "maskCoordinates",
  "transformation",
  "transformationSettings",
  "fontCoordinates",
  "fontPosition",
  "imageDimensions",
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isImageInput(value: unknown): value is ImageInput {
  return (
    isObject(value) &&
    isNonEmptyString(value.source) &&
    (value.mimeType === undefined || isNonEmptyString(value.mimeType)) &&
    (value.fileName === undefined || isNonEmptyString(value.fileName))
  );
}

function addError(
  errors: ProductInputValidationError[],
  error: ProductInputValidationError,
): void {
  errors.push(error);
}

/**
 * Validates and normalizes user input. No placement or rendering settings are
 * accepted or returned.
 */
export function validateProductInput(
  input: unknown,
): ProductInputValidationResult {
  const errors: ProductInputValidationError[] = [];

  if (!isObject(input)) {
    return {
      valid: false,
      errors: [
        {
          field: "input",
          code: "INVALID_INPUT",
          message: "Product input must be an object.",
        },
      ],
    };
  }

  for (const field of FORBIDDEN_CLIENT_FIELDS) {
    if (field in input) {
      addError(errors, {
        field: "input",
        code: "FORBIDDEN_FIELD",
        message: `Field '${field}' is not accepted. Placement and rendering are controlled by the system.`,
      });
    }
  }

  if (!isImageInput(input.referenceImage)) {
    addError(errors, {
      field: "referenceImage",
      code: "MISSING_REFERENCE_IMAGE",
      message: "A reference image is required.",
    });
  }

  if (!isNonEmptyString(input.productType)) {
    addError(errors, {
      field: "productType",
      code: "MISSING_PRODUCT_TYPE",
      message: "Product type is required.",
    });
  }

  if (!isNonEmptyString(input.productName)) {
    addError(errors, {
      field: "productName",
      code: "MISSING_PRODUCT_NAME",
      message: "Product name is required.",
    });
  }

  if (!isImageInput(input.companyLogo)) {
    addError(errors, {
      field: "companyLogo",
      code: "MISSING_LOGO",
      message: "A company logo is required.",
    });
  }

  const normalizedProductType = isNonEmptyString(input.productType)
    ? normalizeProductType(input.productType)
    : undefined;

  if (
    normalizedProductType !== undefined &&
    !isSupportedProductType(normalizedProductType, DEFAULT_PRODUCT_TYPE_REGISTRY)
  ) {
    addError(errors, {
      field: "productType",
      code: "UNSUPPORTED_PRODUCT_TYPE",
      message: `Unsupported product type '${input.productType}'. Supported types: ${SUPPORTED_PRODUCT_TYPES.join(", ")}.`,
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    value: {
      productType: normalizedProductType!,
      productName: input.productName.trim(),
      referenceImage: input.referenceImage,
      companyLogo: input.companyLogo,
      ...(isNonEmptyString(input.genericName) && {
        genericName: input.genericName.trim(),
      }),
      ...(isNonEmptyString(input.composition) && {
        composition: input.composition.trim(),
      }),
      ...(isNonEmptyString(input.strength) && {
        strength: input.strength.trim(),
      }),
      ...(isNonEmptyString(input.packSize) && {
        packSize: input.packSize.trim(),
      }),
      ...(isNonEmptyString(input.unit) && { unit: input.unit.trim() }),
      ...(isNonEmptyString(input.manufacturer) && {
        manufacturer: input.manufacturer.trim(),
      }),
      ...(isNonEmptyString(input.additionalContent) && {
        additionalContent: input.additionalContent.trim(),
      }),
    },
  };
}

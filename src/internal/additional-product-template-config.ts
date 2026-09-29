/**
 * Data-only configurations for product types beyond the first four templates.
 *
 * These profiles reuse the existing BOX, BOTTLE, DROPS_BOTTLE, and TUBE
 * rendering families. No product-specific renderer implementation belongs in
 * this file.
 */

import type { ProductType } from "../product-input/product-type-registry";
import type { InternalTemplateId } from "./template-library";

export interface ProductTypeTemplateConfiguration {
  readonly productType: ProductType;
  readonly baseTemplate: InternalTemplateId;
  readonly contentSurface: "flat" | "label" | "small-label" | "tube-front";
  readonly notes?: readonly string[];
}

export const ADDITIONAL_PRODUCT_TEMPLATE_CONFIGS: Readonly<
  Partial<Record<ProductType, ProductTypeTemplateConfiguration>>
> = {
  TABLET: {
    productType: "TABLET",
    baseTemplate: "BOX",
    contentSurface: "flat",
  },
  CAPSULE: {
    productType: "CAPSULE",
    baseTemplate: "BOX",
    contentSurface: "flat",
  },
  SOFTGEL_CAPSULE: {
    productType: "SOFTGEL_CAPSULE",
    baseTemplate: "BOX",
    contentSurface: "flat",
  },
  HARDGEL_CAPSULE: {
    productType: "HARDGEL_CAPSULE",
    baseTemplate: "BOX",
    contentSurface: "flat",
  },
  CREAM: {
    productType: "CREAM",
    baseTemplate: "TUBE",
    contentSurface: "tube-front",
  },
  GEL: {
    productType: "GEL",
    baseTemplate: "TUBE",
    contentSurface: "tube-front",
  },
  LOTION: {
    productType: "LOTION",
    baseTemplate: "BOTTLE",
    contentSurface: "label",
  },
  OINTMENT: {
    productType: "OINTMENT",
    baseTemplate: "TUBE",
    contentSurface: "tube-front",
  },
  SYRUP: {
    productType: "SYRUP",
    baseTemplate: "BOTTLE",
    contentSurface: "label",
  },
  SUSPENSION: {
    productType: "SUSPENSION",
    baseTemplate: "BOTTLE",
    contentSurface: "label",
  },
  SERUM: {
    productType: "SERUM",
    baseTemplate: "BOTTLE",
    contentSurface: "label",
  },
  INHALER: {
    productType: "INHALER",
    baseTemplate: "BOTTLE",
    contentSurface: "label",
  },
  POWDER: {
    productType: "POWDER",
    baseTemplate: "BOX",
    contentSurface: "flat",
  },
  SACHET: {
    productType: "SACHET",
    baseTemplate: "BOX",
    contentSurface: "flat",
  },
  INJECTION: {
    productType: "INJECTION",
    baseTemplate: "BOTTLE",
    contentSurface: "label",
  },
  INFUSION: {
    productType: "INFUSION",
    baseTemplate: "BOTTLE",
    contentSurface: "label",
  },
  VIAL: {
    productType: "VIAL",
    baseTemplate: "BOTTLE",
    contentSurface: "label",
  },
  JAR: {
    productType: "JAR",
    baseTemplate: "BOTTLE",
    contentSurface: "label",
  },
  POUCH: {
    productType: "POUCH",
    baseTemplate: "BOX",
    contentSurface: "flat",
  },
};

export function getProductTypeTemplateConfiguration(
  productType: ProductType,
): ProductTypeTemplateConfiguration | undefined {
  return ADDITIONAL_PRODUCT_TEMPLATE_CONFIGS[productType];
}

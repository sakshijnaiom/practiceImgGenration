/**
 * Central registry for pharmaceutical product types.
 *
 * Product types resolve to generic templates. Rendering code should consume a
 * template identifier and must not branch on individual product types.
 */

export const SUPPORTED_PRODUCT_TYPES = [
  "TABLET",
  "CAPSULE",
  "SOFTGEL_CAPSULE",
  "HARDGEL_CAPSULE",
  "CREAM",
  "GEL",
  "LOTION",
  "OINTMENT",
  "SYRUP",
  "SUSPENSION",
  "DROPS",
  "SERUM",
  "INHALER",
  "POWDER",
  "SACHET",
  "INJECTION",
  "INFUSION",
  "VIAL",
  "TUBE",
  "BOTTLE",
  "BOX",
  "JAR",
  "POUCH",
] as const;

export type ProductType = (typeof SUPPORTED_PRODUCT_TYPES)[number];

/** A generic rendering template, not a product-specific renderer. */
export type ProductTemplateId = string;

export type ProductTypeTemplateMapping = Readonly<
  Record<ProductType, ProductTemplateId>
>;

export interface ProductTypeRegistry {
  readonly productTypes: readonly ProductType[];
  readonly templateMapping: ProductTypeTemplateMapping;
}

export const DEFAULT_PRODUCT_TYPE_TEMPLATE_MAPPING: ProductTypeTemplateMapping = {
  TABLET: "box",
  CAPSULE: "box",
  SOFTGEL_CAPSULE: "box",
  HARDGEL_CAPSULE: "box",
  CREAM: "tube",
  GEL: "tube",
  LOTION: "bottle",
  OINTMENT: "tube",
  SYRUP: "bottle",
  SUSPENSION: "bottle",
  DROPS: "drops-bottle",
  SERUM: "serum",
  INHALER: "inhaler",
  POWDER: "powder",
  SACHET: "sachet",
  INJECTION: "injection",
  INFUSION: "infusion",
  VIAL: "bottle",
  TUBE: "tube",
  BOTTLE: "bottle",
  BOX: "box",
  JAR: "jar",
  POUCH: "pouch",
};

export const DEFAULT_PRODUCT_TYPE_REGISTRY: ProductTypeRegistry = {
  productTypes: SUPPORTED_PRODUCT_TYPES,
  templateMapping: DEFAULT_PRODUCT_TYPE_TEMPLATE_MAPPING,
};

/**
 * Creates a registry with configurable template mappings while retaining the
 * complete supported product-type catalog.
 */
export function createProductTypeRegistry(
  templateOverrides: Partial<Record<ProductType, ProductTemplateId>> = {},
): ProductTypeRegistry {
  const templateMapping = {
    ...DEFAULT_PRODUCT_TYPE_TEMPLATE_MAPPING,
    ...templateOverrides,
  } as ProductTypeTemplateMapping;

  return {
    productTypes: SUPPORTED_PRODUCT_TYPES,
    templateMapping,
  };
}

export function normalizeProductType(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function isSupportedProductType(
  value: string,
  registry: ProductTypeRegistry = DEFAULT_PRODUCT_TYPE_REGISTRY,
): value is ProductType {
  return registry.productTypes.includes(normalizeProductType(value) as ProductType);
}

export function getTemplateForProductType(
  productType: ProductType,
  registry: ProductTypeRegistry = DEFAULT_PRODUCT_TYPE_REGISTRY,
): ProductTemplateId {
  return registry.templateMapping[productType];
}

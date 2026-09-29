/**
 * Internal template configuration.
 *
 * This module is intentionally not exported from the user input barrel. The
 * values below are system-owned layout decisions and are never accepted from
 * or shown to an end user.
 */

import {
  DEFAULT_PRODUCT_TYPE_REGISTRY,
  getTemplateForProductType,
} from "../product-input/product-type-registry";

import type {
  ProductTemplateId,
  ProductType,
  ProductTypeRegistry,
} from "../product-input/product-type-registry";

export type InternalTemplateId =
  | "BOX"
  | "BOTTLE"
  | "DROPS_BOTTLE"
  | "TUBE";

export type InternalTextSlot =
  | "logo"
  | "productName"
  | "genericName"
  | "strength"
  | "packSize"
  | "manufacturer";

interface InternalPoint {
  readonly x: number;
  readonly y: number;
}

interface InternalBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface InternalContentSurface {
  readonly kind: "flat" | "curved";
  readonly region: InternalBounds;
  readonly mask: readonly InternalPoint[];
}

export interface InternalPlacement {
  readonly slot: InternalTextSlot;
  readonly region: InternalBounds;
  readonly alignment: "left" | "center" | "right";
  readonly maxLines: number;
  readonly priority: number;
}

export interface InternalSurfaceMask {
  readonly type: "polygon" | "rounded-rectangle" | "ellipse";
  readonly points: readonly InternalPoint[];
  readonly featherPixels: number;
}

export interface InternalTextStyling {
  readonly fontFamily: string;
  readonly fontWeight: "regular" | "medium" | "bold";
  readonly color: string;
  readonly maxFontSize: number;
  readonly minFontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing: number;
}

export interface InternalOverflowBehavior {
  readonly strategy:
    | "shrink-to-fit"
    | "wrap-and-shrink"
    | "truncate-with-warning";
  readonly minimumReadableFontSize: number;
  readonly preserveRequiredFields: readonly InternalTextSlot[];
}

export interface InternalTemplateConfig {
  readonly id: InternalTemplateId;
  readonly version: number;
  readonly canvas: {
    readonly width: number;
    readonly height: number;
  };
  readonly contentSurface: InternalContentSurface;
  readonly placements: Readonly<Record<InternalTextSlot, InternalPlacement>>;
  readonly logoPlacement: InternalPlacement;
  readonly productNamePlacement: InternalPlacement;
  readonly genericNamePlacement: InternalPlacement;
  readonly strengthPlacement: InternalPlacement;
  readonly packSizePlacement: InternalPlacement;
  readonly manufacturerPlacement: InternalPlacement;
  readonly surfaceMask: InternalSurfaceMask;
  readonly transformationMethod:
    | "perspective-warp"
    | "cylindrical-warp"
    | "radial-warp";
  readonly textStyling: InternalTextStyling;
  readonly overflowBehavior: InternalOverflowBehavior;
  readonly contentClearingStrategy:
    | "flat-surface-reconstruction"
    | "texture-aware-inpainting";
}

const BOX_PLACEMENTS: Readonly<
  Record<InternalTextSlot, InternalPlacement>
> = {
  logo: {
    slot: "logo",
    region: { left: 0.08, top: 0.06, right: 0.92, bottom: 0.18 },
    alignment: "center",
    maxLines: 1,
    priority: 1,
  },
  productName: {
    slot: "productName",
    region: { left: 0.08, top: 0.24, right: 0.92, bottom: 0.47 },
    alignment: "center",
    maxLines: 2,
    priority: 1,
  },
  genericName: {
    slot: "genericName",
    region: { left: 0.12, top: 0.48, right: 0.88, bottom: 0.60 },
    alignment: "center",
    maxLines: 2,
    priority: 2,
  },
  strength: {
    slot: "strength",
    region: { left: 0.12, top: 0.61, right: 0.88, bottom: 0.70 },
    alignment: "center",
    maxLines: 1,
    priority: 2,
  },
  packSize: {
    slot: "packSize",
    region: { left: 0.10, top: 0.78, right: 0.90, bottom: 0.90 },
    alignment: "center",
    maxLines: 1,
    priority: 3,
  },
  manufacturer: {
    slot: "manufacturer",
    region: { left: 0.08, top: 0.91, right: 0.92, bottom: 0.98 },
    alignment: "center",
    maxLines: 1,
    priority: 3,
  },
};

const BOTTLE_PLACEMENTS: Readonly<
  Record<InternalTextSlot, InternalPlacement>
> = {
  logo: {
    slot: "logo",
    region: { left: 0.20, top: 0.15, right: 0.80, bottom: 0.27 },
    alignment: "center",
    maxLines: 1,
    priority: 1,
  },
  productName: {
    slot: "productName",
    region: { left: 0.12, top: 0.29, right: 0.88, bottom: 0.48 },
    alignment: "center",
    maxLines: 2,
    priority: 1,
  },
  genericName: {
    slot: "genericName",
    region: { left: 0.14, top: 0.49, right: 0.86, bottom: 0.59 },
    alignment: "center",
    maxLines: 2,
    priority: 2,
  },
  strength: {
    slot: "strength",
    region: { left: 0.16, top: 0.60, right: 0.84, bottom: 0.69 },
    alignment: "center",
    maxLines: 1,
    priority: 2,
  },
  packSize: {
    slot: "packSize",
    region: { left: 0.16, top: 0.74, right: 0.84, bottom: 0.83 },
    alignment: "center",
    maxLines: 1,
    priority: 3,
  },
  manufacturer: {
    slot: "manufacturer",
    region: { left: 0.15, top: 0.85, right: 0.85, bottom: 0.94 },
    alignment: "center",
    maxLines: 1,
    priority: 3,
  },
};

const TUBE_PLACEMENTS: Readonly<
  Record<InternalTextSlot, InternalPlacement>
> = {
  logo: {
    slot: "logo",
    region: { left: 0.10, top: 0.10, right: 0.90, bottom: 0.22 },
    alignment: "center",
    maxLines: 1,
    priority: 1,
  },
  productName: {
    slot: "productName",
    region: { left: 0.08, top: 0.27, right: 0.92, bottom: 0.47 },
    alignment: "center",
    maxLines: 2,
    priority: 1,
  },
  genericName: {
    slot: "genericName",
    region: { left: 0.12, top: 0.49, right: 0.88, bottom: 0.60 },
    alignment: "center",
    maxLines: 2,
    priority: 2,
  },
  strength: {
    slot: "strength",
    region: { left: 0.14, top: 0.61, right: 0.86, bottom: 0.70 },
    alignment: "center",
    maxLines: 1,
    priority: 2,
  },
  packSize: {
    slot: "packSize",
    region: { left: 0.15, top: 0.75, right: 0.85, bottom: 0.84 },
    alignment: "center",
    maxLines: 1,
    priority: 3,
  },
  manufacturer: {
    slot: "manufacturer",
    region: { left: 0.12, top: 0.86, right: 0.88, bottom: 0.95 },
    alignment: "center",
    maxLines: 1,
    priority: 3,
  },
};

function createTemplate(
  id: InternalTemplateId,
  kind: InternalContentSurface["kind"],
  placements: Readonly<Record<InternalTextSlot, InternalPlacement>>,
  transformationMethod: InternalTemplateConfig["transformationMethod"],
  contentClearingStrategy: InternalTemplateConfig["contentClearingStrategy"],
): InternalTemplateConfig {
  return {
    id,
    version: 1,
    canvas: { width: 1200, height: 1200 },
    contentSurface: {
      kind,
      region: { left: 0.05, top: 0.05, right: 0.95, bottom: 0.95 },
      mask: [
        { x: 0.05, y: 0.05 },
        { x: 0.95, y: 0.05 },
        { x: 0.95, y: 0.95 },
        { x: 0.05, y: 0.95 },
      ],
    },
    placements,
    logoPlacement: placements.logo,
    productNamePlacement: placements.productName,
    genericNamePlacement: placements.genericName,
    strengthPlacement: placements.strength,
    packSizePlacement: placements.packSize,
    manufacturerPlacement: placements.manufacturer,
    surfaceMask: {
      type: kind === "flat" ? "polygon" : "rounded-rectangle",
      points: [
        { x: 0.05, y: 0.05 },
        { x: 0.95, y: 0.05 },
        { x: 0.95, y: 0.95 },
        { x: 0.05, y: 0.95 },
      ],
      featherPixels: 3,
    },
    transformationMethod,
    textStyling: {
      fontFamily: "system-sans",
      fontWeight: "medium",
      color: "auto-contrast",
      maxFontSize: 72,
      minFontSize: 12,
      lineHeight: 1.15,
      letterSpacing: 0,
    },
    overflowBehavior: {
      strategy: "wrap-and-shrink",
      minimumReadableFontSize: 12,
      preserveRequiredFields: ["productName", "logo"],
    },
    contentClearingStrategy,
  };
}

export const INTERNAL_TEMPLATES: Readonly<
  Record<InternalTemplateId, InternalTemplateConfig>
> = {
  BOX: createTemplate(
    "BOX",
    "flat",
    BOX_PLACEMENTS,
    "perspective-warp",
    "flat-surface-reconstruction",
  ),
  BOTTLE: createTemplate(
    "BOTTLE",
    "curved",
    BOTTLE_PLACEMENTS,
    "cylindrical-warp",
    "texture-aware-inpainting",
  ),
  DROPS_BOTTLE: createTemplate(
    "DROPS_BOTTLE",
    "curved",
    BOTTLE_PLACEMENTS,
    "cylindrical-warp",
    "texture-aware-inpainting",
  ),
  TUBE: createTemplate(
    "TUBE",
    "curved",
    TUBE_PLACEMENTS,
    "cylindrical-warp",
    "texture-aware-inpainting",
  ),
};

const PRODUCT_TYPE_TO_INTERNAL_TEMPLATE: Readonly<
  Record<ProductType, InternalTemplateId>
> = {
  TABLET: "BOX",
  CAPSULE: "BOX",
  SOFTGEL_CAPSULE: "BOX",
  HARDGEL_CAPSULE: "BOX",
  CREAM: "TUBE",
  GEL: "TUBE",
  LOTION: "BOTTLE",
  OINTMENT: "TUBE",
  SYRUP: "BOTTLE",
  SUSPENSION: "BOTTLE",
  DROPS: "DROPS_BOTTLE",
  SERUM: "BOTTLE",
  INHALER: "BOTTLE",
  POWDER: "BOX",
  SACHET: "BOX",
  INJECTION: "BOTTLE",
  INFUSION: "BOTTLE",
  VIAL: "BOTTLE",
  TUBE: "TUBE",
  BOTTLE: "BOTTLE",
  BOX: "BOX",
  JAR: "BOTTLE",
  POUCH: "BOX",
};

/**
 * Resolves the internal template selected by product type. The returned
 * configuration is for trusted system components only.
 */
export function selectInternalTemplate(
  productType: ProductType,
  registry: ProductTypeRegistry = DEFAULT_PRODUCT_TYPE_REGISTRY,
  templateSource: Readonly<Record<InternalTemplateId, InternalTemplateConfig>> =
    INTERNAL_TEMPLATES,
): InternalTemplateConfig {
  const registryTemplate = getTemplateForProductType(productType, registry);
  const internalTemplateId = PRODUCT_TYPE_TO_INTERNAL_TEMPLATE[productType];

  if (!internalTemplateId) {
    throw new Error(`No internal template configured for '${productType}'.`);
  }

  // The registry can replace the generic template key, but it cannot expose
  // the internal layout object to the user-facing input model.
  const selectedId = registryTemplate === "drops-bottle"
    ? "DROPS_BOTTLE"
    : registryTemplate === "tube"
      ? "TUBE"
      : registryTemplate === "box"
        ? "BOX"
        : registryTemplate === "bottle"
          ? "BOTTLE"
          : internalTemplateId;

  return templateSource[selectedId];
}

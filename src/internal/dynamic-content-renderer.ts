import type { ProductInputData } from "../product-input/product-input";
import type { ImageInput } from "../product-input/product-input";
import type {
  InternalPlacement,
  InternalTemplateConfig,
  InternalTextSlot,
} from "./template-library";
import { LogoRenderer } from "./logo-renderer";
import type { LogoRenderCommand } from "./logo-renderer";

export interface ImageMetadata {
  readonly width: number;
  readonly height: number;
}

export interface TransparentLayerAsset {
  readonly source: string;
  readonly mimeType: "image/png";
  readonly width: number;
  readonly height: number;
  readonly transparent: true;
}

export interface RenderedTextElement {
  readonly type: "text";
  readonly slot: Exclude<InternalTextSlot, "logo">;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight: string;
  readonly color: string;
  readonly lineHeight: number;
  readonly alignment: "left" | "center" | "right";
  readonly lines: readonly string[];
}

export type RenderedLogoElement = LogoRenderCommand;

export type ContentRenderElement = RenderedTextElement | RenderedLogoElement;

export type SurfaceTransformMethod =
  | "perspective-warp"
  | "label-cylindrical-warp"
  | "small-label-cylindrical-warp"
  | "tube-front-warp";

/** Internal transform values derived from the selected template. */
export interface SurfaceTransformPlan {
  readonly method: SurfaceTransformMethod;
  readonly surface: "flat" | "label" | "small-label" | "tube-front";
  readonly perspectivePoints?: readonly [
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
  ];
  readonly curvature: number;
  readonly horizontalScale: number;
  readonly verticalScale: number;
}

export interface ContentRenderPlan {
  readonly width: number;
  readonly height: number;
  readonly transparent: true;
  readonly elements: readonly ContentRenderElement[];
  readonly surfaceTransform: SurfaceTransformPlan;
}

export interface DynamicContentRenderResult {
  readonly layer: TransparentLayerAsset;
  readonly plan: ContentRenderPlan;
  readonly warnings: readonly string[];
}

/** Local image metadata access; no external API is required. */
export interface LocalImageMetadataProvider {
  getMetadata(image: ImageInput): Promise<ImageMetadata>;
}

/**
 * Local raster renderer that draws the computed plan onto a transparent layer.
 * It must apply `plan.surfaceTransform` to the complete content layer before
 * returning the PNG. The transform is selected internally by the template.
 */
export interface TransparentContentLayerBackend {
  renderTransparentLayer(
    plan: ContentRenderPlan,
  ): Promise<TransparentLayerAsset>;
}

interface PixelBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function toPixelBounds(
  placement: InternalPlacement,
  template: InternalTemplateConfig,
): PixelBounds {
  return {
    x: Math.round(placement.region.left * template.canvas.width),
    y: Math.round(placement.region.top * template.canvas.height),
    width: Math.round(
      (placement.region.right - placement.region.left) * template.canvas.width,
    ),
    height: Math.round(
      (placement.region.bottom - placement.region.top) * template.canvas.height,
    ),
  };
}

export function createSurfaceTransform(
  template: InternalTemplateConfig,
): SurfaceTransformPlan {
  switch (template.id) {
    case "BOX":
      return {
        method: "perspective-warp",
        surface: "flat",
        perspectivePoints: [
          { x: 0.08, y: 0.08 },
          { x: 0.92, y: 0.05 },
          { x: 0.95, y: 0.94 },
          { x: 0.05, y: 0.97 },
        ],
        curvature: 0,
        horizontalScale: 1,
        verticalScale: 1,
      };
    case "DROPS_BOTTLE":
      return {
        method: "small-label-cylindrical-warp",
        surface: "small-label",
        curvature: 0.24,
        horizontalScale: 0.72,
        verticalScale: 0.72,
      };
    case "TUBE":
      return {
        method: "tube-front-warp",
        surface: "tube-front",
        curvature: 0.18,
        horizontalScale: 0.92,
        verticalScale: 1,
      };
    case "BOTTLE":
      return {
        method: "label-cylindrical-warp",
        surface: "label",
        curvature: 0.34,
        horizontalScale: 0.88,
        verticalScale: 1,
      };
  }
}

function wrapText(text: string, maxCharacters: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxCharacters) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }
  return lines;
}

function fitText(
  text: string,
  placement: InternalPlacement,
  template: InternalTemplateConfig,
): { fontSize: number; lines: string[]; lineHeight: number } | undefined {
  const bounds = toPixelBounds(placement, template);
  const style = template.textStyling;
  const maxLines = placement.maxLines;

  for (
    let fontSize = style.maxFontSize;
    fontSize >= style.minFontSize;
    fontSize -= 1
  ) {
    const estimatedCharacters = Math.max(
      1,
      Math.floor(bounds.width / (fontSize * 0.56)),
    );
    const lines = wrapText(text, estimatedCharacters);
    const lineHeight = Math.round(fontSize * style.lineHeight);
    const fitsHeight = lines.length <= maxLines && lineHeight * lines.length <= bounds.height;
    const fitsWidth = lines.every(
      (line) => line.length * fontSize * 0.56 <= bounds.width,
    );

    if (fitsHeight && fitsWidth) {
      return { fontSize, lines, lineHeight };
    }
  }

  return undefined;
}

function productText(
  product: ProductInputData,
  slot: Exclude<InternalTextSlot, "logo">,
): string | undefined {
  switch (slot) {
    case "productName":
      return product.productName;
    case "genericName":
      return [product.genericName, product.composition]
        .filter(Boolean)
        .join(" • ") || undefined;
    case "strength":
      return product.strength;
    case "packSize":
      return [product.packSize, product.unit].filter(Boolean).join(" ") || undefined;
    case "manufacturer":
      return product.manufacturer;
  }
}

function createTextElement(
  product: ProductInputData,
  slot: Exclude<InternalTextSlot, "logo">,
  placement: InternalPlacement,
  template: InternalTemplateConfig,
): RenderedTextElement | undefined {
  const text = productText(product, slot);
  if (!text) {
    return undefined;
  }

  const fit = fitText(text, placement, template);
  if (!fit) {
    return undefined;
  }

  const bounds = toPixelBounds(placement, template);
  return {
    type: "text",
    slot,
    text,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fontFamily: template.textStyling.fontFamily,
    fontSize: fit.fontSize,
    fontWeight: template.textStyling.fontWeight,
    color: template.textStyling.color,
    lineHeight: fit.lineHeight,
    alignment: placement.alignment,
    lines: fit.lines,
  };
}

export class DynamicContentRenderer {
  constructor(
    metadataProvider: LocalImageMetadataProvider,
    private readonly layerBackend: TransparentContentLayerBackend,
    private readonly logoRenderer = new LogoRenderer(metadataProvider),
  ) {}

  async render(
    product: ProductInputData,
    template: InternalTemplateConfig,
  ): Promise<DynamicContentRenderResult> {
    const warnings: string[] = [];
    const elements: ContentRenderElement[] = [];

    elements.push(
      await this.logoRenderer.createRenderCommand(
        product.companyLogo,
        template,
      ),
    );

    const textSlots: Exclude<InternalTextSlot, "logo">[] = [
      "productName",
      "genericName",
      "strength",
      "packSize",
      "manufacturer",
    ];

    for (const slot of textSlots) {
      const element = createTextElement(
        product,
        slot,
        template.placements[slot],
        template,
      );
      if (element) {
        elements.push(element);
      } else if (productText(product, slot)) {
        if (template.overflowBehavior.strategy === "truncate-with-warning") {
          warnings.push(`Content for '${slot}' could not fit and was omitted.`);
        } else {
          warnings.push(`Content for '${slot}' could not fit within its template region.`);
        }
      }
    }

    const plan: ContentRenderPlan = {
      width: template.canvas.width,
      height: template.canvas.height,
      transparent: true,
      elements,
      surfaceTransform: createSurfaceTransform(template),
    };
    const layer = await this.layerBackend.renderTransparentLayer(plan);

    if (!layer.transparent || layer.mimeType !== "image/png") {
      throw new Error("Content renderer backend must return a transparent PNG layer.");
    }

    return { layer, plan, warnings };
  }
}

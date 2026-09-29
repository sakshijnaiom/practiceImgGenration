import assert from "node:assert/strict";
import test from "node:test";

import {
  DynamicContentRenderer,
  LogoRenderer,
  ReferenceImageCleaningPipeline,
  createReferenceImageCleaningStrategies,
  selectInternalTemplate,
} from "../src/internal";
import { createSurfaceTransform } from "../src/internal/dynamic-content-renderer";
import { INTERNAL_TEMPLATES } from "../src/internal/template-library";

import type {
  LocalCleaningOperations,
} from "../src/internal/reference-image-cleaning-pipeline";
import type { ReferenceImageAsset } from "../src/product-input/reference-image-preprocessor";
import type { ProductInputData } from "../src/product-input/product-input";
import type { TransparentContentLayerBackend } from "../src/internal/dynamic-content-renderer";
import type { LogoMetadataProvider } from "../src/internal/logo-renderer";

const image = (source: string): ReferenceImageAsset => ({
  source,
  mimeType: "image/png",
});

const baseProduct = (productName: string): ProductInputData => ({
  productType: "BOX",
  productName,
  genericName: "Generic medicine",
  composition: "Active composition",
  strength: "500 mg",
  packSize: "10",
  unit: "tablets",
  manufacturer:
    "An intentionally long pharmaceutical manufacturer name for fitting",
  referenceImage: image("reference-large-with-old-text-and-logo"),
  companyLogo: image("logo-original"),
});

const templateCases = [
  { templateId: "BOX" as const, productType: "BOX" as const },
  { templateId: "BOTTLE" as const, productType: "BOTTLE" as const },
  { templateId: "DROPS_BOTTLE" as const, productType: "DROPS" as const },
  { templateId: "TUBE" as const, productType: "TUBE" as const },
];

test("selects only the first four templates correctly", () => {
  for (const testCase of templateCases) {
    const template = selectInternalTemplate(testCase.productType);
    assert.equal(template.id, testCase.templateId);
  }
});

test("uses the required surface transformation for each first-four template", () => {
  const expected = {
    BOX: "perspective-warp",
    BOTTLE: "label-cylindrical-warp",
    DROPS_BOTTLE: "small-label-cylindrical-warp",
    TUBE: "tube-front-warp",
  } as const;

  for (const templateId of Object.keys(expected) as (keyof typeof expected)[]) {
    assert.equal(
      createSurfaceTransform(INTERNAL_TEMPLATES[templateId]).method,
      expected[templateId],
    );
  }
});

test("routes the first four templates through automatic cleaning strategies", async () => {
  const seenStrategies: string[] = [];
  const operations: LocalCleaningOperations = {
    async identifyContentSurface(input) {
      seenStrategies.push(input.strategyId);
      return { id: "surface", kind: "flat", confidence: 0.99 };
    },
    async detectExistingContent() {
      return [
        { id: "old-text", kind: "printed-text", confidence: 0.99 },
        { id: "old-logo", kind: "logo", confidence: 0.99 },
      ];
    },
    async removeExistingContent(input) {
      return image(`${input.strategyId}-cleaned-surface`);
    },
    async preserveProductAppearance(input) {
      return image(`${input.strategyId}-preserved-product`);
    },
  };

  const strategies = createReferenceImageCleaningStrategies(operations);
  const pipeline = new ReferenceImageCleaningPipeline(strategies);

  for (const testCase of templateCases) {
    const result = await pipeline.clean({
      productType: testCase.productType,
      referenceImage: image(
        `reference-${testCase.templateId}-with-existing-text-and-logo`,
      ),
    });
    assert.equal(result.templateId, testCase.templateId);
    assert.equal(result.removedContent.length, 2);
    assert.equal(result.warnings.length, 0);
  }

  assert.deepEqual(seenStrategies, [
    "flat-box",
    "curved-bottle",
    "drops-bottle",
    "tube",
  ]);
});

test("preserves short and long product names without overflow", async () => {
  const metadataProvider: LogoMetadataProvider = {
    async getMetadata() {
      return { width: 400, height: 100 };
    },
  };
  const backend: TransparentContentLayerBackend = {
    async renderTransparentLayer(plan) {
      return {
        source: "transparent-content-layer",
        mimeType: "image/png",
        width: plan.width,
        height: plan.height,
        transparent: true,
      };
    },
  };

  const renderer = new DynamicContentRenderer(metadataProvider, backend);
  for (const testCase of templateCases) {
    for (const productName of [
      "Cure",
      "Extra Strength Advanced Daily Relief Pharmaceutical Tablets",
    ]) {
      const result = await renderer.render(
        baseProduct(productName),
        INTERNAL_TEMPLATES[testCase.templateId],
      );
      const productNameElement = result.plan.elements.find(
        (element) => element.type === "text" && element.slot === "productName",
      );
      assert.ok(productNameElement);
      assert.ok(productNameElement.lines.length <= 2);
      assert.equal(result.warnings.some((warning) => warning.includes("productName")), false);
    }
  }
});

test("fits wide, square, and tall logos without distortion", async () => {
  const rendererFor = (width: number, height: number) =>
    new LogoRenderer({
      async getMetadata() {
        return { width, height };
      },
    });

  for (const dimensions of [
    [1200, 200],
    [500, 500],
    [200, 1200],
  ] as const) {
    const command = await rendererFor(...dimensions).createRenderCommand(
      image("original-logo"),
      INTERNAL_TEMPLATES.BOTTLE,
    );
    assert.equal(command.source, "original-logo");
    assert.equal(command.preservedAspectRatio, true);
    assert.equal(command.preserveOriginalPixels, true);
    assert.ok(command.width > 0 && command.height > 0);
    assert.ok(Math.abs(command.width / command.height - dimensions[0] / dimensions[1]) < 0.02);
  }
});

test("accepts different reference image sizes and existing packaging content", async () => {
  const operations: LocalCleaningOperations = {
    async identifyContentSurface() {
      return { id: "surface", kind: "curved", confidence: 0.95 };
    },
    async detectExistingContent() {
      return [
        { id: "old-product-name", kind: "product-name", confidence: 0.95 },
        { id: "old-company-logo", kind: "logo", confidence: 0.95 },
      ];
    },
    async removeExistingContent(input) {
      return image(`${input.referenceImage.source}-clean`);
    },
    async preserveProductAppearance(input) {
      return image(`${input.referenceImage.source}-preserved`);
    },
  };
  const pipeline = new ReferenceImageCleaningPipeline(
    createReferenceImageCleaningStrategies(operations),
  );

  for (const referenceImage of [
    image("small-reference-with-text"),
    image("large-reference-with-logo"),
    image("large-reference-with-text-and-logo"),
  ]) {
    const result = await pipeline.clean({
      productType: "DROPS",
      referenceImage,
    });
    assert.equal(result.templateId, "DROPS_BOTTLE");
    assert.equal(result.removedContent.length, 2);
    assert.match(result.cleanImage.source, /preserved$/);
  }
});

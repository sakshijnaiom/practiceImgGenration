export { selectInternalTemplate } from "./template-library";
export {
  DynamicContentRenderer,
} from "./dynamic-content-renderer";
export { LogoRenderer } from "./logo-renderer";
export { FinalImageCompositor } from "./final-image-compositor";
export { BulkProductImageGenerator } from "./bulk-generation";
export {
  ADDITIONAL_PRODUCT_TEMPLATE_CONFIGS,
  getProductTypeTemplateConfiguration,
} from "./additional-product-template-config";
export {
  AutomaticRenderingValidator,
  RenderingValidationError,
} from "./rendering-validation";

export type {
  InternalContentSurface,
  InternalOverflowBehavior,
  InternalPlacement,
  InternalSurfaceMask,
  InternalTemplateConfig,
  InternalTemplateId,
  InternalTextSlot,
  InternalTextStyling,
} from "./template-library";

export {
  InMemoryInternalTemplateRepository,
  TemplateAdministrationException,
  TemplateAdministrationService,
} from "./template-administration";

export type {
  InternalTemplateRepository,
  TemplateAdminIdentity,
  TemplateAdminRole,
  TemplateAdministrationError,
  TemplateVersionRecord,
} from "./template-administration";

export type {
  ContentRenderElement,
  ContentRenderPlan,
  DynamicContentRenderResult,
  ImageMetadata,
  LocalImageMetadataProvider,
  RenderedLogoElement,
  RenderedTextElement,
  SurfaceTransformPlan,
  SurfaceTransformMethod,
  TransparentContentLayerBackend,
  TransparentLayerAsset,
} from "./dynamic-content-renderer";

export type {
  LogoImageMetadata,
  LogoMetadataProvider,
  LogoRenderCommand,
} from "./logo-renderer";

export type {
  FinalImageCompositionRequest,
  FinalProductImage,
  LocalCompositingBackend,
  PreparedProductSurface,
} from "./final-image-compositor";

export type {
  BulkGenerationDependencies,
  BulkGenerationError,
  BulkGenerationItemResult,
  BulkGenerationRequest,
  BulkGenerationResult,
} from "./bulk-generation";

export type {
  ProductTypeTemplateConfiguration,
} from "./additional-product-template-config";

export type {
  RenderingValidationContext,
  RenderingValidationErrorCode,
  RenderingValidationEvidence,
  RenderingValidationIssue,
  RenderingValidationResult,
} from "./rendering-validation";

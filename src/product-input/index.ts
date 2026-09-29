export {
  SUPPORTED_PRODUCT_TYPES,
  validateProductInput,
} from "./product-input";

export {
  DEFAULT_PRODUCT_TYPE_REGISTRY,
  DEFAULT_PRODUCT_TYPE_TEMPLATE_MAPPING,
  createProductTypeRegistry,
  getTemplateForProductType,
  isSupportedProductType,
  normalizeProductType,
} from "./product-type-registry";

export {
  DEFAULT_REFERENCE_IMAGE_PROFILE,
  DEFAULT_REFERENCE_IMAGE_PROFILES,
  ReferenceImagePreprocessor,
} from "./reference-image-preprocessor";

export type {
  ImageInput,
  ProductInputData,
  ProductInputErrorCode,
  ProductInputField,
  ProductInputValidationError,
  ProductInputValidationResult,
  ProductType,
} from "./product-input";

export type {
  ProductTemplateId,
  ProductTypeRegistry,
  ProductTypeTemplateMapping,
} from "./product-type-registry";

export type {
  DetectedContentRegion,
  DetectedProductSurface,
  ExistingContentKind,
  InternalRegionBounds,
  LocalImageProcessingBackend,
  PreprocessedReferenceImage,
  PreservedFeature,
  ReferenceImageAnalysis,
  ReferenceImageAsset,
  ReferenceImagePreprocessingProfile,
  ReferenceImagePreprocessingRequest,
  SurfaceKind,
  SurfaceReconstructionMethod,
} from "./reference-image-preprocessor";

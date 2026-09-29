import {
  INTERNAL_TEMPLATES,
  selectInternalTemplate,
} from "./template-library";

import type {
  InternalTemplateConfig,
  InternalTemplateId,
} from "./template-library";
import type {
  ProductType,
  ProductTypeRegistry,
} from "../product-input/product-type-registry";
import { DEFAULT_PRODUCT_TYPE_REGISTRY } from "../product-input/product-type-registry";

export type TemplateAdminRole = "template-admin" | "system-admin";

export interface TemplateAdminIdentity {
  readonly administratorId: string;
  readonly roles: readonly TemplateAdminRole[];
}

export interface TemplateVersionRecord {
  readonly templateId: InternalTemplateId;
  readonly version: number;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export interface TemplateAdministrationError {
  readonly code:
    | "UNAUTHORIZED"
    | "TEMPLATE_NOT_FOUND"
    | "VERSION_CONFLICT"
    | "INVALID_TEMPLATE";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class TemplateAdministrationException extends Error {
  readonly name = "TemplateAdministrationException";

  constructor(readonly error: TemplateAdministrationError) {
    super(error.message);
  }
}

export interface InternalTemplateRepository {
  list(): readonly InternalTemplateConfig[];
  get(templateId: InternalTemplateId): InternalTemplateConfig | undefined;
  save(template: InternalTemplateConfig, audit: TemplateVersionRecord): void;
  remove(templateId: InternalTemplateId): void;
}

/** Storage boundary for internal configuration, separate from product data. */
export class InMemoryInternalTemplateRepository
  implements InternalTemplateRepository
{
  private readonly templates = new Map<
    InternalTemplateId,
    InternalTemplateConfig
  >();
  private readonly audit = new Map<InternalTemplateId, TemplateVersionRecord>();

  constructor(seed: Readonly<Record<InternalTemplateId, InternalTemplateConfig>> = INTERNAL_TEMPLATES) {
    for (const template of Object.values(seed)) {
      this.templates.set(template.id, template);
    }
  }

  list(): readonly InternalTemplateConfig[] {
    return [...this.templates.values()];
  }

  get(templateId: InternalTemplateId): InternalTemplateConfig | undefined {
    return this.templates.get(templateId);
  }

  save(template: InternalTemplateConfig, audit: TemplateVersionRecord): void {
    this.templates.set(template.id, template);
    this.audit.set(template.id, audit);
  }

  remove(templateId: InternalTemplateId): void {
    this.templates.delete(templateId);
    this.audit.delete(templateId);
  }

  getAudit(templateId: InternalTemplateId): TemplateVersionRecord | undefined {
    return this.audit.get(templateId);
  }
}

function assertAuthorized(identity: TemplateAdminIdentity): void {
  if (
    !identity?.administratorId ||
    !identity.roles.some(
      (role) => role === "template-admin" || role === "system-admin",
    )
  ) {
    throw new TemplateAdministrationException({
      code: "UNAUTHORIZED",
      message: "Only authorized administrators can manage internal templates.",
    });
  }
}

function assertValidTemplate(template: InternalTemplateConfig): void {
  if (
    !template.id ||
    !Number.isInteger(template.version) ||
    template.version < 1 ||
    !Number.isFinite(template.canvas.width) ||
    !Number.isFinite(template.canvas.height) ||
    template.canvas.width <= 0 ||
    template.canvas.height <= 0
  ) {
    throw new TemplateAdministrationException({
      code: "INVALID_TEMPLATE",
      message: "Template configuration is invalid.",
    });
  }
}

export class TemplateAdministrationService {
  constructor(private readonly repository: InternalTemplateRepository) {}

  listTemplates(identity: TemplateAdminIdentity): readonly InternalTemplateConfig[] {
    assertAuthorized(identity);
    return this.repository.list();
  }

  getTemplate(
    identity: TemplateAdminIdentity,
    templateId: InternalTemplateId,
  ): InternalTemplateConfig {
    assertAuthorized(identity);
    const template = this.repository.get(templateId);
    if (!template) {
      throw new TemplateAdministrationException({
        code: "TEMPLATE_NOT_FOUND",
        message: `Internal template '${templateId}' was not found.`,
      });
    }
    return template;
  }

  updateTemplate(
    identity: TemplateAdminIdentity,
    template: InternalTemplateConfig,
    expectedVersion: number,
  ): InternalTemplateConfig {
    assertAuthorized(identity);
    const current = this.repository.get(template.id);
    if (!current) {
      throw new TemplateAdministrationException({
        code: "TEMPLATE_NOT_FOUND",
        message: `Internal template '${template.id}' was not found.`,
      });
    }
    if (current.version !== expectedVersion) {
      throw new TemplateAdministrationException({
        code: "VERSION_CONFLICT",
        message: `Template '${template.id}' has changed since version ${expectedVersion}.`,
        details: { currentVersion: current.version },
      });
    }

    const next = { ...template, version: current.version + 1 };
    assertValidTemplate(next);
    this.repository.save(next, {
      templateId: next.id,
      version: next.version,
      updatedBy: identity.administratorId,
      updatedAt: new Date().toISOString(),
    });
    return next;
  }

  resolveTemplate(
    productType: ProductType,
    registry: ProductTypeRegistry = DEFAULT_PRODUCT_TYPE_REGISTRY,
  ): InternalTemplateConfig {
    const source = Object.fromEntries(
      this.repository.list().map((template) => [template.id, template]),
    ) as Readonly<Record<InternalTemplateId, InternalTemplateConfig>>;
    const template = selectInternalTemplate(productType, registry, source);
    if (!template) {
      throw new TemplateAdministrationException({
        code: "TEMPLATE_NOT_FOUND",
        message: `No managed template is available for product type '${productType}'.`,
      });
    }
    return template;
  }
}

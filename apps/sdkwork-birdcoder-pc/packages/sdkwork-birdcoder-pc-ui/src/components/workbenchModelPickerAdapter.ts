import type {
  ModelsPickerGroup,
  ModelsPickerOption,
} from '@sdkwork/models-pc-picker';
import {
  getWorkbenchModelVendorLabel,
  type WorkbenchCodeEngineDefinition,
  type WorkbenchCodeEngineModelDefinition,
} from '@sdkwork/birdcoder-pc-codeengine';

export interface WorkbenchModelPickerSelection {
  engineId: string;
  modelId: string;
}

export interface WorkbenchModelPickerCatalog {
  groups: ModelsPickerGroup[];
  selectionByPickerId: ReadonlyMap<string, WorkbenchModelPickerSelection>;
}

export function buildWorkbenchModelPickerId(engineId: string, modelId: string): string {
  return `${encodeURIComponent(engineId)}::${encodeURIComponent(modelId)}`;
}

export function createWorkbenchModelPickerCatalog(
  engines: readonly WorkbenchCodeEngineDefinition[],
): WorkbenchModelPickerCatalog {
  const groupsByVendor = new Map<string, ModelsPickerGroup>();
  const selectionByPickerId = new Map<string, WorkbenchModelPickerSelection>();

  for (const engine of engines) {
    for (const model of engine.modelCatalog) {
      const vendorCode = model.modelVendor || model.vendor || 'custom';
      const group = groupsByVendor.get(vendorCode) ?? createVendorGroup(vendorCode);
      const pickerId = buildWorkbenchModelPickerId(engine.id, model.id);

      group.llms.push(createPickerOption(engine, model, pickerId));
      selectionByPickerId.set(pickerId, {
        engineId: engine.id,
        modelId: model.id,
      });
      groupsByVendor.set(vendorCode, group);
    }
  }

  return {
    groups: Array.from(groupsByVendor.values()),
    selectionByPickerId,
  };
}

function createVendorGroup(vendorCode: string): ModelsPickerGroup {
  return {
    id: vendorCode,
    vendor: {
      code: vendorCode,
      name: getWorkbenchModelVendorLabel(vendorCode),
    },
    llms: [],
    images: [],
    videos: [],
    audios: [],
    music: [],
    sfx: [],
  };
}

function createPickerOption(
  engine: WorkbenchCodeEngineDefinition,
  model: WorkbenchCodeEngineModelDefinition,
  pickerId: string,
): ModelsPickerOption {
  const sourceLabel = engine.label;

  return {
    id: pickerId,
    catalogKey: `birdcoder/${engine.id}/${model.id}`,
    model: model.id,
    name: model.label,
    displayName: model.label,
    desc: sourceLabel,
    description: sourceLabel,
    ver: 'workspace',
    versionLabel: 'workspace',
    vendorCode: model.modelVendor || model.vendor || 'custom',
    vendorName: getWorkbenchModelVendorLabel(model.modelVendor || model.vendor || 'custom'),
    modalities: ['text'],
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: ['chat', 'code'],
    providerCodes: model.providerId ? [model.providerId] : [engine.id],
    supportsStreaming: true,
    supportsTools: true,
    supportsJsonSchema: false,
    officialReferencePrices: [],
    priceAvailability: { status: 'unavailable' },
  };
}

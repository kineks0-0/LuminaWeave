import type { MessageSegment } from '../../xml-view/LVParser.js';
import type { ParsedViewComponent } from '@shared/ViewComponentRegistry.js';
import { parseCompositePath } from '../../utils/forgeDslUtils.js';

export type ForgeAutoSubmitTarget =
    | { kind: 'form'; id: string }
    | { kind: 'message'; id: string };

export interface ForgeAutoSubmitTargetDeps {
    hasStructuredFieldBinding(formId: string, fieldKey: string): boolean;
}

const INTERACTIVE_FORGE_COMPONENTS = new Set([
    'ForgeInput',
    'ForgeTextarea',
    'ForgeSelect',
    'ForgeChecklist',
    'ForgeChoiceGroup',
    'ForgeFacetChecklist'
]);

const normalizeString = (value: unknown): string => String(value || '').trim();

const resolveStructuredBinding = (
    component: ParsedViewComponent,
    deps: ForgeAutoSubmitTargetDeps
): { formId: string; fieldKey: string } | null => {
    const explicitFormId = normalizeString(component.props.formId);
    const rawFieldKey = normalizeString(component.props.fieldKey);
    const [pathFormId, pathFieldKey] = parseCompositePath(rawFieldKey);
    const formId = explicitFormId || pathFormId || '';
    const fieldKey = explicitFormId ? rawFieldKey : pathFieldKey;

    if (!formId || !fieldKey) {
        return null;
    }

    if (!deps.hasStructuredFieldBinding(formId, fieldKey)) {
        return null;
    }

    return { formId, fieldKey };
};

export const resolveForgeAutoSubmitTarget = (
    segments: MessageSegment[],
    messageId: string | null | undefined,
    deps: ForgeAutoSubmitTargetDeps
): ForgeAutoSubmitTarget | null => {
    const normalizedMessageId = normalizeString(messageId);
    if (!normalizedMessageId) {
        return null;
    }

    let hasPersistentForm = false;
    let hasInteractiveCollection = false;
    let hasMessageScopedCollection = false;
    const structuredFormIds = new Set<string>();

    for (const segment of segments) {
        if (segment.type !== 'view' || !segment.components?.length) {
            continue;
        }

        for (const component of segment.components) {
            if (component.component === 'ForgeForm') {
                hasPersistentForm = true;
                continue;
            }

            if (!INTERACTIVE_FORGE_COMPONENTS.has(component.component)) {
                continue;
            }

            hasInteractiveCollection = true;
            const binding = resolveStructuredBinding(component, deps);
            if (binding) {
                structuredFormIds.add(binding.formId);
            } else {
                hasMessageScopedCollection = true;
            }
        }
    }

    if (hasPersistentForm || !hasInteractiveCollection) {
        return null;
    }

    if (structuredFormIds.size > 0) {
        if (!hasMessageScopedCollection && structuredFormIds.size === 1) {
            return { kind: 'form', id: Array.from(structuredFormIds)[0] };
        }
        return null;
    }

    return hasMessageScopedCollection
        ? { kind: 'message', id: normalizedMessageId }
        : null;
};

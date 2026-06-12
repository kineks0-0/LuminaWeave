export const buildForgeChoiceGroupResetKey = (input: {
    label: string;
    options: string | string[];
}): string => JSON.stringify([input.label, input.options]);

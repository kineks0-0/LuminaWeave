export type PromptTemplateValue = string | number | boolean | null | undefined;

export class PromptTemplateEngine {
    private static readonly tokenPattern = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

    static render(template: string, values: object): string {
        if (!template) return '';

        return template.replace(this.tokenPattern, (_match, key: string) => {
            const value = (values as Record<string, PromptTemplateValue>)[key];
            if (value === null || value === undefined) {
                return '';
            }
            return String(value);
        });
    }
}

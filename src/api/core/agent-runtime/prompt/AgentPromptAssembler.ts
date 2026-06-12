export interface AgentPromptAssemblerOptions<TInput, TPrepared> {
    assemble: (input: TInput) => Promise<TPrepared>;
    resolveCacheKey?: (input: TInput) => string | null | undefined;
}

export class AgentPromptAssembler<TInput, TPrepared> {
    private readonly preparedByKey = new Map<string, TPrepared>();

    constructor(private readonly options: AgentPromptAssemblerOptions<TInput, TPrepared>) {}

    preview(input: TInput): Promise<TPrepared> {
        return this.getOrAssemble(input);
    }

    prepareForRun(input: TInput): Promise<TPrepared> {
        return this.getOrAssemble(input);
    }

    invalidate(input: TInput): void {
        const key = this.resolveCacheKey(input);
        if (key) this.preparedByKey.delete(key);
    }

    clear(): void {
        this.preparedByKey.clear();
    }

    private async getOrAssemble(input: TInput): Promise<TPrepared> {
        const key = this.resolveCacheKey(input);
        if (!key) return this.options.assemble(input);
        const existing = this.preparedByKey.get(key);
        if (existing) return existing;
        const prepared = await this.options.assemble(input);
        this.preparedByKey.set(key, prepared);
        return prepared;
    }

    private resolveCacheKey(input: TInput): string | null {
        return this.options.resolveCacheKey?.(input) ?? null;
    }
}

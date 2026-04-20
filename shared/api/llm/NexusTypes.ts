export type NexusProviderType = 'openai' | 'openai_compatible' | 'anthropic' | 'google' | 'st_current';

export interface NexusApiConfig {
    id: string;
    name?: string;
    type?: NexusProviderType;
    url?: string;
    key?: string;
}

export interface ModelOption {
    value: string | number;
    text: string;
}

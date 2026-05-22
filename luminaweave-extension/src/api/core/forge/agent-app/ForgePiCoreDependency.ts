import { Agent } from '@earendil-works/pi-agent-core';

export interface ForgePiCoreDependencyReport {
    rootImportAvailable: boolean;
    agentConstructorName: string;
}

export const getForgePiCoreDependencyReport = (): ForgePiCoreDependencyReport => ({
    rootImportAvailable: typeof Agent === 'function',
    agentConstructorName: Agent.name
});

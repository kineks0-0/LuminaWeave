import type { NetworkConfig, SecureFetch } from 'just-bash';
import type { ShellPermissionDecision, ShellSessionRef } from '@shared/resources/index.js';
import type { ShellPermissionService } from './ShellPermissionService.js';

export type ShellNetworkFailureReason = 'network_not_configured' | 'url_not_allowed' | 'method_not_allowed' | 'grant_required';

export interface ShellNetworkDecision extends ShellPermissionDecision {
    failureReason?: ShellNetworkFailureReason;
}

export interface ShellNetworkPolicyInput {
    network?: NetworkConfig;
    networkAllowList?: string[];
}

const DEFAULT_METHODS = ['GET', 'HEAD'];

const normalizeMethod = (method: string | undefined): string =>
    (method || 'GET').toUpperCase();

const entryToUrlPrefix = (entry: NonNullable<NetworkConfig['allowedUrlPrefixes']>[number]): string =>
    typeof entry === 'string' ? entry : entry.url;

export class ShellNetworkPolicyService {
    createNetworkConfig(input: ShellNetworkPolicyInput): NetworkConfig | null {
        if (input.network) return input.network;
        if (input.networkAllowList?.length) {
            return { allowedUrlPrefixes: input.networkAllowList };
        }
        return null;
    }

    listAllowedUrlPrefixes(network: NetworkConfig | null): string[] {
        if (!network) return [];
        if (network.dangerouslyAllowFullInternetAccess) return ['*'];
        return (network.allowedUrlPrefixes ?? []).map(entryToUrlPrefix);
    }

    isConfigured(network: NetworkConfig | null): boolean {
        if (!network) return false;
        return Boolean(network.dangerouslyAllowFullInternetAccess || network.allowedUrlPrefixes?.length);
    }

    checkAllowList(network: NetworkConfig | null, url: string, method = 'GET'): ShellNetworkDecision {
        if (!this.isConfigured(network)) {
            return {
                allowed: false,
                failureReason: 'network_not_configured',
                reason: `network not configured: ${url}`
            };
        }

        if (!this.methodAllowed(network!, method)) {
            return {
                allowed: false,
                failureReason: 'method_not_allowed',
                reason: `network method not allowed: ${normalizeMethod(method)}`
            };
        }

        if (network!.dangerouslyAllowFullInternetAccess) {
            return { allowed: true, reason: 'allow-list' };
        }

        const prefixes = this.listAllowedUrlPrefixes(network);
        if (!prefixes.some(prefix => url.startsWith(prefix))) {
            return {
                allowed: false,
                failureReason: 'url_not_allowed',
                reason: `network denied by allow-list: ${url}`
            };
        }

        return { allowed: true, reason: 'allow-list' };
    }

    checkAgentGrant(
        permissions: ShellPermissionService,
        session: ShellSessionRef,
        network: NetworkConfig | null,
        url: string,
        method = 'GET'
    ): ShellNetworkDecision {
        const allowList = this.checkAllowList(network, url, method);
        if (!allowList.allowed) return allowList;
        if (session.kind === 'user-terminal') return { allowed: true, reason: 'user-terminal' };

        const grant = permissions.listGrants(session).find(item =>
            item.operation === 'network'
            && Boolean(item.scope.urlPrefix)
            && url.startsWith(item.scope.urlPrefix!)
        );
        return grant
            ? { allowed: true, reason: 'grant', grant }
            : {
                allowed: false,
                failureReason: 'grant_required',
                reason: `network permission required: ${url}`
            };
    }

    createPermissionedFetch(
        permissions: ShellPermissionService,
        session: ShellSessionRef,
        network: NetworkConfig
    ): SecureFetch {
        return async (url, fetchOptions) => {
            const decision = this.checkAgentGrant(permissions, session, network, url, fetchOptions?.method);
            if (!decision.allowed) {
                throw new Error(decision.reason ?? `network permission denied: ${url}`);
            }
            const response = await fetch(url, {
                method: fetchOptions?.method ?? 'GET',
                headers: fetchOptions?.headers,
                body: fetchOptions?.body
            });
            const headers: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                headers[key] = value;
            });
            return {
                status: response.status,
                statusText: response.statusText,
                headers,
                body: new Uint8Array(await response.arrayBuffer()),
                url: response.url
            };
        };
    }

    private methodAllowed(network: NetworkConfig, method: string | undefined): boolean {
        if (network.dangerouslyAllowFullInternetAccess) return true;
        return (network.allowedMethods ?? DEFAULT_METHODS).some(allowedMethod => allowedMethod === normalizeMethod(method));
    }
}

export const shellNetworkPolicyService = new ShellNetworkPolicyService();

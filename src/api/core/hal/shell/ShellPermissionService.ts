import type {
    ShellPermissionDecision,
    ShellPermissionGrant,
    ShellPermissionOperation,
    ShellPermissionRequest,
    ShellPermissionScope,
    ShellSessionRef
} from '@shared/resources/index.js';
import { cleanPath as normalizePath } from '@shared/resources/vfsPath.js';
import { createPrefixedId as randomId } from '@shared/CommonUtils.js';

const now = () => Date.now();

const isSameOrChildPath = (path: string, prefix: string): boolean => {
    const normalizedPath = normalizePath(path);
    const normalizedPrefix = normalizePath(prefix);
    return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
};

const scopeMatchesPath = (scope: ShellPermissionScope, path: string): boolean =>
    Boolean(scope.pathPrefix && isSameOrChildPath(path, scope.pathPrefix));

const scopeMatchesUrl = (scope: ShellPermissionScope, url: string): boolean =>
    scope.allNetwork === true || Boolean(scope.urlPrefix && url.startsWith(scope.urlPrefix));

const sessionMatches = (left: ShellSessionRef, right: ShellSessionRef): boolean =>
    left.shellSessionId === right.shellSessionId
    || Boolean(left.parentShellSessionId && left.parentShellSessionId === right.shellSessionId);

export type ShellPermissionListener = () => void;

export class ShellPermissionService {
    private readonly requests = new Map<string, ShellPermissionRequest>();
    private readonly grants = new Map<string, ShellPermissionGrant>();
    private readonly listeners = new Set<ShellPermissionListener>();

    subscribe(listener: ShellPermissionListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    listRequests(): ShellPermissionRequest[] {
        return Array.from(this.requests.values());
    }

    listGrants(session?: ShellSessionRef): ShellPermissionGrant[] {
        const grants = Array.from(this.grants.values()).filter(grant => grant.status === 'approved' && !this.isExpired(grant));
        return session ? grants.filter(grant => sessionMatches(session, grant.session)) : grants;
    }

    requestPermission(input: Omit<ShellPermissionRequest, 'requestId' | 'createdAt' | 'status'>): ShellPermissionRequest {
        const request: ShellPermissionRequest = {
            ...input,
            requestId: randomId('shell-permission-request'),
            createdAt: now(),
            status: 'pending'
        };
        this.requests.set(request.requestId, request);
        this.notify();
        return request;
    }

    approveRequest(requestId: string, expiresAt?: number | null): ShellPermissionGrant {
        const request = this.requests.get(requestId);
        if (!request) throw new Error(`Shell permission request not found: ${requestId}`);
        request.status = 'approved';
        const grant: ShellPermissionGrant = {
            grantId: randomId('shell-permission-grant'),
            requestId,
            session: request.session,
            operation: request.operation,
            scope: request.scope,
            reason: request.reason,
            createdAt: now(),
            expiresAt: expiresAt ?? request.expiresAt ?? null,
            status: 'approved'
        };
        this.grants.set(grant.grantId, grant);
        this.notify();
        return grant;
    }

    rejectRequest(requestId: string, reason?: string): ShellPermissionRequest {
        const request = this.requests.get(requestId);
        if (!request) throw new Error(`Shell permission request not found: ${requestId}`);
        request.status = 'rejected';
        request.decisionReason = reason;
        this.notify();
        return request;
    }

    expireGrant(grantId: string): ShellPermissionGrant {
        const grant = this.grants.get(grantId);
        if (!grant) throw new Error(`Shell permission grant not found: ${grantId}`);
        grant.status = 'expired';
        grant.expiresAt = now();
        this.notify();
        return grant;
    }

    revokeGrant(grantId: string, session: ShellSessionRef): ShellPermissionGrant {
        if (session.kind !== 'user-terminal') {
            throw new Error('Only user terminal sessions can revoke shell grants');
        }
        const grant = this.grants.get(grantId);
        if (!grant) throw new Error(`Shell permission grant not found: ${grantId}`);
        grant.status = 'revoked';
        this.notify();
        return grant;
    }

    checkPath(session: ShellSessionRef, operation: 'read' | 'write', path: string): ShellPermissionDecision {
        const normalizedPath = normalizePath(path);

        if (session.kind === 'user-terminal') {
            return { allowed: true, reason: 'user-terminal' };
        }

        if (operation === 'read') {
            if (this.isSensitivePath(normalizedPath)) {
                return { allowed: false, reason: `permission denied: ${normalizedPath}` };
            }
            return { allowed: true, reason: 'default-read' };
        }

        const defaultWrite = this.defaultWritablePrefix(session);
        if (defaultWrite && isSameOrChildPath(normalizedPath, defaultWrite)) {
            return { allowed: true, reason: 'session-workspace-write' };
        }

        const grant = this.findGrant(session, operation, normalizedPath);
        if (grant) return { allowed: true, reason: 'grant', grant };

        return {
            allowed: false,
            reason: `permission denied: ${normalizedPath}; request with lw-permission request ${operation} ${normalizedPath} --reason "..."`
        };
    }

    checkNetwork(session: ShellSessionRef, url: string, allowList: string[]): ShellPermissionDecision {
        if (!allowList.some(prefix => prefix === '*' || url.startsWith(prefix))) {
            return { allowed: false, reason: `network denied by allow-list: ${url}` };
        }
        if (session.kind === 'user-terminal') {
            return { allowed: true, reason: 'user-terminal' };
        }
        const grant = this.listGrants(session).find(item => item.operation === 'network' && scopeMatchesUrl(item.scope, url));
        return grant
            ? { allowed: true, reason: 'grant', grant }
            : { allowed: false, reason: `network permission required: ${url}` };
    }

    private findGrant(session: ShellSessionRef, operation: ShellPermissionOperation, path: string): ShellPermissionGrant | null {
        return this.listGrants(session).find(grant =>
            grant.operation === operation && scopeMatchesPath(grant.scope, path)
        ) ?? null;
    }

    private defaultWritablePrefix(session: ShellSessionRef): string | null {
        if (session.kind === 'forge-agent' && session.projectId) {
            return `/workspaces/forge/${encodeURIComponent(session.projectId)}`;
        }
        if (session.kind === 'chat-agent' && session.conversationId) {
            return `/workspaces/chat/${encodeURIComponent(session.conversationId)}`;
        }
        if (session.kind === 'sub-agent') {
            if (session.projectId) return `/workspaces/forge/${encodeURIComponent(session.projectId)}`;
            if (session.conversationId) return `/workspaces/chat/${encodeURIComponent(session.conversationId)}`;
        }
        return null;
    }

    private isSensitivePath(path: string): boolean {
        return path.startsWith('/secrets') || path.startsWith('/system/private');
    }

    private isExpired(grant: ShellPermissionGrant): boolean {
        if (!grant.expiresAt) return false;
        if (grant.expiresAt > now()) return false;
        grant.status = 'expired';
        this.notify();
        return true;
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}

export const shellPermissionService = new ShellPermissionService();

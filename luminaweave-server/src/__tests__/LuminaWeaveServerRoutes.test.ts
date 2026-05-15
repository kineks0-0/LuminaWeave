import { describe, expect, it } from 'vitest';
import { API_ROUTES } from '@shared/ApiEndpoints.js';
import { LuminaWeaveServer } from '../index.js';

type RouteMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

class CapturingRouter {
    readonly routes: Array<{ method: RouteMethod; path: string }> = [];

    get(path: string): void {
        this.routes.push({ method: 'get', path });
    }

    post(path: string): void {
        this.routes.push({ method: 'post', path });
    }

    put(path: string): void {
        this.routes.push({ method: 'put', path });
    }

    patch(path: string): void {
        this.routes.push({ method: 'patch', path });
    }

    delete(path: string): void {
        this.routes.push({ method: 'delete', path });
    }
}

describe('LuminaWeaveServer routes', () => {
    it('registers one canonical non-SSE Nexus generate route', () => {
        const router = new CapturingRouter();
        const server = new LuminaWeaveServer('tmp/test_data_routes');

        server.init(router as any);

        const generateRoutes = router.routes.filter((route) => (
            route.method === 'post' && route.path === API_ROUTES.NEXUS.GENERATE
        ));
        expect(generateRoutes).toHaveLength(1);
    });
});

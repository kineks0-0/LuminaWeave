import { describe, expect, it } from 'vitest';
import { createRootSafeAreaBackdropController } from '../rootSafeAreaBackdrop.js';

describe('createRootSafeAreaBackdropController', () => {
  it('uses the last enabled top backdrop override', () => {
    const controller = createRootSafeAreaBackdropController();

    controller.register({
      sourceId: 'shell-header',
      topBackground: 'red'
    });
    controller.register({
      sourceId: 'detail-page',
      topBackground: 'blue'
    });

    expect(controller.snapshot.value).toEqual({
      sourceId: 'detail-page',
      topBackground: 'blue'
    });
  });

  it('restores the previous enabled override when the latest one is disabled', () => {
    const controller = createRootSafeAreaBackdropController();

    controller.register({
      sourceId: 'shell-header',
      topBackground: 'red'
    });
    const detail = controller.register({
      sourceId: 'detail-page',
      topBackground: 'blue'
    });

    detail.update({ enabled: false });

    expect(controller.snapshot.value).toEqual({
      sourceId: 'shell-header',
      topBackground: 'red'
    });

    detail.update({
      enabled: true,
      topBackground: 'green'
    });

    expect(controller.snapshot.value).toEqual({
      sourceId: 'detail-page',
      topBackground: 'green'
    });
  });

  it('cleans up overrides on unregister', () => {
    const controller = createRootSafeAreaBackdropController();

    const shell = controller.register({
      sourceId: 'shell-header',
      topBackground: 'red'
    });
    const detail = controller.register({
      sourceId: 'detail-page',
      topBackground: 'blue'
    });

    detail.unregister();

    expect(controller.snapshot.value).toEqual({
      sourceId: 'shell-header',
      topBackground: 'red'
    });

    shell.unregister();

    expect(controller.snapshot.value).toEqual({
      sourceId: null,
      topBackground: null
    });
  });
});

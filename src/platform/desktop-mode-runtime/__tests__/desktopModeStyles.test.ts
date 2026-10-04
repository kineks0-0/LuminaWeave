import { describe, expect, it } from 'vitest';
import {
    applyDesktopModeStyles,
    DESKTOP_MODE_STYLE_ATTRIBUTE,
    type DesktopModeStyleElement,
    type DesktopModeStyleHost
} from '../desktopModeStyles.js';

interface FakeStyleElement extends DesktopModeStyleElement {
    attributes: Record<string, string>;
    removed: boolean;
}

const createFakeHosts = (): { hosts: DesktopModeStyleHost[]; shadow: FakeStyleElement[]; head: FakeStyleElement[] } => {
    const shadow: FakeStyleElement[] = [];
    const head: FakeStyleElement[] = [];

    const createHost = (elements: FakeStyleElement[]): DesktopModeStyleHost => ({
        querySelector(selector) {
            const id = selector.match(/^style\[data-lw-desktop-mode="(.*)"\]$/)?.[1];
            return elements.find(
                element => !element.removed && element.attributes[DESKTOP_MODE_STYLE_ATTRIBUTE] === id
            ) ?? null;
        },
        appendToHost(element) {
            elements.push(element as FakeStyleElement);
        }
    });

    return { hosts: [createHost(shadow), createHost(head)], shadow, head };
};

const createStyleElement = (): FakeStyleElement => ({
    textContent: null,
    attributes: {},
    removed: false,
    setAttribute(name, value) {
        this.attributes[name] = value;
    },
    remove() {
        this.removed = true;
    }
});

describe('applyDesktopModeStyles', () => {
    it('injects a mode-scoped style element into the primary host', () => {
        const { hosts, shadow, head } = createFakeHosts();

        applyDesktopModeStyles('telegram', '[data-desktop-mode="telegram"] { color: red; }', hosts, createStyleElement);

        expect(shadow).toHaveLength(1);
        expect(head).toHaveLength(0);
        expect(shadow[0].attributes[DESKTOP_MODE_STYLE_ATTRIBUTE]).toBe('telegram');
        expect(shadow[0].textContent).toContain('color: red');
    });

    it('replaces an existing style element for the same mode', () => {
        const { hosts, shadow } = createFakeHosts();

        applyDesktopModeStyles('telegram', 'old', hosts, createStyleElement);
        applyDesktopModeStyles('telegram', 'new', hosts, createStyleElement);

        expect(shadow).toHaveLength(2);
        expect(shadow[0].removed).toBe(true);
        expect(shadow[1].textContent).toBe('new');
    });

    it('removes the style element from every host when styles are cleared', () => {
        const { hosts, shadow, head } = createFakeHosts();

        applyDesktopModeStyles('telegram', 'shadow-css', hosts, createStyleElement);
        const headStyle = createStyleElement();
        headStyle.setAttribute(DESKTOP_MODE_STYLE_ATTRIBUTE, 'telegram');
        head.push(headStyle);

        applyDesktopModeStyles('telegram', undefined, hosts, createStyleElement);

        expect(shadow[0].removed).toBe(true);
        expect(headStyle.removed).toBe(true);
    });

    it('does nothing without hosts', () => {
        expect(() => applyDesktopModeStyles('telegram', 'css', null, createStyleElement)).not.toThrow();
        expect(() => applyDesktopModeStyles('telegram', 'css', [], createStyleElement)).not.toThrow();
    });
});

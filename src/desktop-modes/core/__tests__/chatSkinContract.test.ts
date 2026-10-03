import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
// 先加载 registry，避免 builtins ↔ registry 循环导入时 builtins 尚未初始化
import { desktopModeRegistry } from '../registry.js';
import { builtinDesktopModes } from '../../builtins/index.js';
import { resolveThemeValueMap } from '../../builtins/shared.js';
import { CHAT_SKIN_VARS, resolveChatPageWidth } from '../chatSkinContract.js';
import { getSurfaceSkinContract } from '../surfaceSkinContracts.js';
import type { ResolvedDesktopAppearance } from '../types.js';

const srcRoot = resolve(__dirname, '../../..');
const chatRoots = ['plugins/chat/components', 'plugins/chat/surfaces'].map(path => join(srcRoot, path));

const listSourceFiles = (directory: string): string[] => readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : listSourceFiles(path);
    return /\.(vue|ts)$/.test(name) ? [path] : [];
});

const consumedChatVars = (): Set<string> => {
    const consumed = new Set<string>();
    chatRoots.flatMap(listSourceFiles).forEach((file) => {
        for (const match of readFileSync(file, 'utf8').matchAll(/var\((--lw-chat-[a-z0-9-]+)/g)) {
            consumed.add(match[1]);
        }
    });
    return consumed;
};

const resolveChatSkin = (modeId: string, appearance: ResolvedDesktopAppearance) => {
    const mode = builtinDesktopModes.find(candidate => candidate.id === modeId);
    const skin = mode?.surfaceSkins?.['chat.main'];
    return resolveThemeValueMap(skin?.cssVars, {
        activeSettings: { 'lumina-settings.activeDesktopMode': modeId },
        resolvedAppearance: appearance,
        desktopModeId: modeId
    });
};

void desktopModeRegistry;
const contract = new Set<string>(CHAT_SKIN_VARS);
const appearances: ResolvedDesktopAppearance[] = ['light', 'dark'];

describe('chat skin contract', () => {
    it('declares every chat variable consumed by chat components', () => {
        const missing = [...consumedChatVars()].filter(name => !contract.has(name));
        expect(missing).toEqual([]);
    });

    it('registers the contract for chat.main', () => {
        expect(getSurfaceSkinContract('chat.main')?.exposedCssVars).toEqual([...CHAT_SKIN_VARS]);
    });

    it.each(builtinDesktopModes.map(mode => mode.id))('resolves every contract variable and nothing else for %s', (modeId) => {
        appearances.forEach((appearance) => {
            const resolved = resolveChatSkin(modeId, appearance);
            const keys = Object.keys(resolved);
            expect(CHAT_SKIN_VARS.filter(name => !keys.includes(name)), `${modeId}/${appearance} missing`).toEqual([]);
            expect(keys.filter(name => !contract.has(name)), `${modeId}/${appearance} extra`).toEqual([]);
            expect(String(resolved['--lw-chat-page-width'])).toMatch(/^(100%|\d+px)$/);
        });
    });

    it('converts page width settings into valid CSS lengths', () => {
        expect(resolveChatPageWidth('auto')).toBe('100%');
        expect(resolveChatPageWidth(900)).toBe('900px');
        expect(resolveChatPageWidth('720')).toBe('720px');
        expect(resolveChatPageWidth(undefined)).toBe('100%');
    });

    it('does not reference the undefined --lw-text-primary token in chat sources', () => {
        const offenders = chatRoots.flatMap(listSourceFiles)
            .filter(file => readFileSync(file, 'utf8').includes('--lw-text-primary'));
        expect(offenders).toEqual([]);
    });
});

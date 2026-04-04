import { describe, expect, it } from 'vitest';
import { XMLInterceptor, BuiltinXMLTags } from '../XMLInterceptor';

describe('V Tag Persistence Reproducer', () => {
    it('should NOT strip <V> tags from deriveStreamState displayText', () => {
        const interceptor = new XMLInterceptor();
        const raw = '<Chat_Reply>Hello <V>Stat("HP", 100, 100)</V> World</Chat_Reply>';
        const state = interceptor.deriveStreamState(raw, true);

        // Expectation: <V> tags are preserved in displayText for MessageRenderer to pick up
        expect(state.displayText).toContain('<V>Stat("HP", 100, 100)</V>');
        expect(state.displayText).toBe('Hello <V>Stat("HP", 100, 100)</V> World');
    });

    it('should NOT strip <V> tags when extracting Chat_Reply content', () => {
        const raw = '<Chat_Reply>Hello <V>Stat("HP", 100, 100)</V> World</Chat_Reply>';
        const result = XMLInterceptor.extractTagContent(raw, BuiltinXMLTags.CHAT_REPLY);
        
        // Expectation: extractTagContent should return the raw content including nested tags
        expect(result[0]).toContain('<V>Stat("HP", 100, 100)</V>');
    });

    it('should NOT strip <V> tags from processAndCleanText (Display Text)', () => {
        const interceptor = new XMLInterceptor();
        const raw = '<Chat_Reply>Hello <V>Stat("HP", 100, 100)</V> World</Chat_Reply>';
        const clean = interceptor.processAndCleanText(raw);

        // Expectation: processAndCleanText should strip <Chat_Reply> (persistent) but keep <V> (presentational)
        expect(clean).toContain('<V>Stat("HP", 100, 100)</V>');
        expect(clean).toBe('Hello <V>Stat("HP", 100, 100)</V> World');
    });

    it('should PRESERVE unclosed <V> tags in processAndCleanText', () => {
        const interceptor = new XMLInterceptor();
        const raw = '<Chat_Reply>Hello <V>Stat("HP", 100, 100) and more...';
        const clean = interceptor.processAndCleanText(raw);

        // Current theory: This might FAIL because unclosed tags are currently stripped of their shells
        expect(clean).toContain('<V>');
        expect(clean).toBe('Hello <V>Stat("HP", 100, 100) and more...');
    });
    it('should STRIP <Character_Action> in deriveStreamState even if filtering is on', () => {
        const interceptor = new XMLInterceptor();
        const raw = '<Character_Action>Picking up a stone.</Character_Action><Chat_Reply>Hello!</Chat_Reply>';
        const state = interceptor.deriveStreamState(raw, true);

        // Expectation: Character_Action is transient, should be stripped
        expect(state.displayText).not.toContain('Picking up a stone');
        expect(state.displayText).toBe('Hello!');
    });

    it('should respect allowTopLevel flag in deriveStreamState', () => {
        const interceptor = new XMLInterceptor();
        const raw = 'Top level text. <Chat_Reply>Inside reply.</Chat_Reply>';
        
        // Scenario A: allowTopLevel = true (Default)
        const stateA = interceptor.deriveStreamState(raw, true, true);
        expect(stateA.displayText).toBe('Top level text. Inside reply.');

        // Scenario B: allowTopLevel = false
        const stateB = interceptor.deriveStreamState(raw, true, false);
        expect(stateB.displayText).toBe('Inside reply.');
    });

    it('should support aliased persistent tags in deriveStreamState', () => {
        const interceptor = new XMLInterceptor();
        // Register an alias for testing
        interceptor.registerXMLParser('Reply', 'persistent', (c) => c);
        
        const raw = '<Reply>Aliased content.</Reply>';
        const state = interceptor.deriveStreamState(raw, true, false);

        // Expectation: Even with top-level filtered out, 'Reply' (persistent) is shown
        expect(state.displayText).toBe('Aliased content.');
    });

    it('should support implicitStartThinking in deriveStreamState', () => {
        const interceptor = new XMLInterceptor();
        const raw = 'Implicit thoughts... <Chat_Reply>Real message</Chat_Reply>';
        
        // Scenario: implicitStartThinking = true
        // Top-level text at start should be treated as thinking (transient) and hidden
        const state = interceptor.deriveStreamState(raw, true, true, true);
        expect(state.displayText).not.toContain('Implicit thoughts');
        expect(state.displayText).toBe('Real message');
    });

    it('should handle orphan transient close tags with backsplash protection', () => {
        const interceptor = new XMLInterceptor();
        const raw = 'Phantom thoughts... </thinking> <Chat_Reply>Hello</Chat_Reply>';
        
        // Scenario: allowTopLevel = true, but orphan </thinking> should hide preceding top-level text
        const state = interceptor.deriveStreamState(raw, true, true, false);
        // Expectation: 'Phantom thoughts...' is hidden, but the space after </thinking> is top-level and preserved
        expect(state.displayText).not.toContain('Phantom thoughts');
        expect(state.displayText).toBe(' Hello');
    });

    it('should NOT backsplash if allowTopLevel is true and NO orphan transient tags exist', () => {
        const interceptor = new XMLInterceptor();
        const raw = 'Normal top-level. <Chat_Reply>Hello</Chat_Reply>';
        const state = interceptor.deriveStreamState(raw, true, true, false);
        expect(state.displayText).toBe('Normal top-level. Hello');
    });
});

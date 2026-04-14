import { ref } from 'vue';
import { SeedHandler, type Snippet } from '../../api/core/SeedHandler';

const buildSeedPrompt = (snippets: Snippet[]): string => {
    const combinedText = snippets
        .map((snippet) => `【素材参考】:\n${snippet.content}`)
        .join('\n\n');

    return `我提供了一些参考素材，请基于此开始建立人物基元表：\n\n${combinedText}`;
};

export const useForgeSeedImport = (applySeedPrompt: (text: string) => void) => {
    const seedInput = ref<HTMLInputElement | null>(null);
    const showSnippetSelector = ref(false);
    const extractedSnippets = ref<Snippet[]>([]);

    const openSeedInput = () => {
        seedInput.value?.click();
    };

    const handleSeedFile = async (event: Event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const text = await file.text();
        extractedSnippets.value = SeedHandler.extractSnippets(text, file.name);
        showSnippetSelector.value = true;

        if (seedInput.value) {
            seedInput.value.value = '';
        }
    };

    const closeSnippetSelector = () => {
        showSnippetSelector.value = false;
    };

    const onSnippetsSelected = (ids: string[]) => {
        const selected = extractedSnippets.value.filter((snippet) => ids.includes(snippet.id));
        if (selected.length > 0) {
            applySeedPrompt(buildSeedPrompt(selected));
        }
        showSnippetSelector.value = false;
    };

    return {
        seedInput,
        showSnippetSelector,
        extractedSnippets,
        openSeedInput,
        handleSeedFile,
        onSnippetsSelected,
        closeSnippetSelector
    };
};

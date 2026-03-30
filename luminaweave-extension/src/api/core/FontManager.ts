import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase';

export interface FontMetadata {
    id: string;
    family: string;
    label: string;
    source: 'google' | 'local' | 'custom';
    url?: string;
    category?: 'serif' | 'sans-serif' | 'display' | 'handwriting';
}

/**
 * FontManager - 负责远端字体的发现、元数据维护与动态 CSS 注入
 */
export class FontManager extends LuminaWeaveAPIBase {
    // 精选的高质量远端字体 (优先支持中文和设计类字体)
    private _catalog: FontMetadata[] = [
        { id: 'misans', family: 'MiSans', label: '小米 MiSans (远端)', source: 'google', url: 'https://fonts.googleapis.com/css2?family=MiSans:wght@400;700&display=swap' },
        { id: 'noto-sans-sc', family: 'Noto Sans SC', label: '思源黑体 (Noto Sans SC)', source: 'google', url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap' },
        { id: 'noto-serif-sc', family: 'Noto Serif SC', label: '思源宋体 (Noto Serif SC)', source: 'google', url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap' },
        { id: 'ma-shan-zheng', family: 'Ma Shan Zheng', label: '马善政毛笔体', source: 'google', url: 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&display=swap' },
        { id: 'zcool-kuaile', family: 'ZCOOL KuaiLe', label: '站酷快乐体', source: 'google', url: 'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap' },
        { id: 'inter', family: 'Inter', label: 'Inter (Modern Sans)', source: 'google', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap' },
        { id: 'outfit', family: 'Outfit', label: 'Outfit (Geometric)', source: 'google', url: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&display=swap' },
        { id: 'jet-brains-mono', family: 'JetBrains Mono', label: 'JetBrains Mono (码农推荐)', source: 'google', url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap' }
    ];

    private _loadedFonts: Set<string> = new Set();

    constructor() {
        super();
    }

    /**
     * 获取支持的字体目录
     */
    getFontCatalog(): FontMetadata[] {
        return this._catalog;
    }

    /**
     * 动态补全远端字体 CSS 注入
     * @param fontFamily 字体家族名称
     */
    ensureFontLoaded(fontFamily: string): void {
        const cleaned = fontFamily.replace(/['"]/g, '').trim();
        const meta = this._catalog.find(f => f.family.replace(/['"]/g, '') === cleaned);

        if (meta && meta.url && !this._loadedFonts.has(meta.id)) {
            console.log(`[FontManager] 正在注入远端字体: ${meta.label}`);
            this.injectStylesheet(meta.id, meta.url);
            this._loadedFonts.add(meta.id);
        }
    }

    private injectStylesheet(id: string, url: string): void {
        const linkId = `lw-font-${id}`;
        if (document.getElementById(linkId)) return;

        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.crossOrigin = 'anonymous';
        link.href = url;
        document.head.appendChild(link);
    }
}

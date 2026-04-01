import { prepare, layout } from '@chenglou/pretext';
import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase';

/**
 * 文本测量配置选项
 */
export interface MeasureOptions {
  /** 容器宽度 (px) */
  width: number;
  /** 行高 (px)，注意 pretext 要求的是绝对数值而非比例 */
  lineHeight: number;
  /** 字体家族 */
  fontFamily: string;
  /** 字号 (px) */
  fontSize: number;
  /** 字重 (如 400, 700, 'bold') */
  fontWeight?: string | number;
  /** 最大行数限制 (用于模拟 line-clamp) */
  maxLines?: number;
}

/**
 * 测量结果
 */
export interface MeasureResult {
  /** 总高度 (px) */
  height: number;
  /** 实际行数 */
  lineCount: number;
  /** 是否超出了最大行数限制 */
  isClamped: boolean;
}

/**
 * MeasureService - 封装 pretext 库的全局文本测量服务
 * 提供基于 LRU 策略的缓存机制，确保在大规模列表渲染下的性能
 */
export class MeasureService extends LuminaWeaveAPIBase {
  private _cache = new Map<string, { prepared: any; timestamp: number }>();
  private readonly MAX_CACHE_SIZE = 200;

  constructor() {
    super();
  }

  /**
   * 测量文本高度
   * @param text 待测量的原始文本 (会自动剔除 HTML 标签)
   * @param options 测量配置
   */
  measure(text: string, options: MeasureOptions): MeasureResult {
    // 1. 预处理文本：移除 HTML 标签并处理空字符串
    const plainText = (text || '').replace(/<[^>]+>/g, '').trim() || ' ';
    
    // 2. 构造字体字符串 (CSS 格式: [weight] size family)
    const fontStr = `${options.fontWeight || 400} ${options.fontSize}px ${options.fontFamily}`;
    
    // 3. 构建缓存 Key (考虑文本内容和关键字体属性)
    const cacheKey = `${plainText}_${fontStr}`;
    
    // 4. 获取或创建 Prepared 对象
    let prepared: any;
    const cached = this._cache.get(cacheKey);
    
    if (cached) {
      prepared = cached.prepared;
      cached.timestamp = Date.now(); // 更新时间戳 (LRU)
    } else {
      // 检查缓存容量并执行清理
      this._enforceCacheLimit();
      
      prepared = prepare(plainText, fontStr);
      this._cache.set(cacheKey, { prepared, timestamp: Date.now() });
    }
    
    // 5. 执行布局计算
    const { height, lineCount } = layout(prepared, options.width, options.lineHeight);
    
    // 6. 处理 line-clamp 逻辑
    let finalHeight = height;
    let isClamped = false;
    
    if (options.maxLines && lineCount > options.maxLines) {
      finalHeight = options.maxLines * options.lineHeight;
      isClamped = true;
    }
    
    return {
      height: Math.ceil(finalHeight),
      lineCount,
      isClamped
    };
  }

  /**
   * 清除所有缓存 (通常在全局设置变更或内存压力大时调用)
   */
  clearCache(): void {
    console.log('[MeasureService] Clearing text measurement cache.');
    this._cache.clear();
  }

  /**
   * 执行简单的 LRU 清理：移除最旧的条目
   */
  private _enforceCacheLimit(): void {
    if (this._cache.size < this.MAX_CACHE_SIZE) return;

    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, value] of this._cache.entries()) {
      if (value.timestamp < oldestTimestamp) {
        oldestTimestamp = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this._cache.delete(oldestKey);
    }
  }
}

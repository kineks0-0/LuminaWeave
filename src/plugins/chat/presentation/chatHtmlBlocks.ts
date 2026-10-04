/**
 * 聊天消息内联 HTML 交互块（沙箱）。
 *
 * 用途：预设/模型输出中的 ```html 代码块（常见于选项面板类预设）在消息里渲染为
 * sandbox iframe，并通过注入桥接脚本把「填入输入框 / 直接发送 / 自适应高度」转发给
 * Lumina 聊天，而不是让脚本直接访问宿主 DOM。
 *
 * 安全口径：iframe 使用 `sandbox="allow-scripts ..."`（不给 allow-same-origin），
 * 因此脚本运行在不透明源中，无法读取宿主页面、存储或 ST 全局；宿主 API 由桥接层模拟。
 */

export const HTML_BLOCK_MESSAGE_SOURCE = 'lumina-chat-html-block';

export type ChatHtmlBlockAction =
    | { type: 'fill'; text: string }
    | { type: 'send'; text: string }
    | { type: 'resize'; height: number };

export interface ChatHtmlBlockIncomingMessage {
    source?: string;
    type?: string;
    payload?: { text?: string; height?: number };
    /** 预设自带的 postMessage resize（`{ type: 'resizeIframe', height }`）。 */
    height?: number;
}

const BRIDGE_SCRIPT = `<script>
(function () {
  'use strict';
  var SOURCE = '${HTML_BLOCK_MESSAGE_SOURCE}';
  var textarea = null;
  var sendButton = null;
  var settings = {};
  function post(type, payload) {
    try { parent.postMessage({ source: SOURCE, type: type, payload: payload || {} }, '*'); } catch (error) {}
  }
  function ensureTextarea() {
    if (textarea) return textarea;
    textarea = document.createElement('textarea');
    textarea.id = 'send_textarea';
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;';
    textarea.addEventListener('input', function () { post('fill', { text: textarea.value }); });
    var attach = function () { document.body.appendChild(textarea); };
    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', attach);
    return textarea;
  }
  function ensureSendButton() {
    if (!sendButton) {
      sendButton = {
        click: function () {
          ensureTextarea();
          post('send', { text: textarea ? textarea.value : '' });
        }
      };
    }
    return sendButton;
  }
  window.__luminaVirtualDocument = {
    getElementById: function (id) {
      if (id === 'send_textarea') return ensureTextarea();
      if (id === 'send_but') return ensureSendButton();
      return null;
    },
    querySelectorAll: function () { return []; },
    querySelector: function () { return null; }
  };
  window.__luminaSillyTavern = {
    getContext: function () {
      return {
        extensionSettings: settings,
        saveSettingsDebounced: function () {},
        generate: function () {
          ensureTextarea();
          post('send', { text: textarea ? textarea.value : '' });
        }
      };
    }
  };
  window.addEventListener('message', function (event) {
    var data = event.data || {};
    if (data && data.type === 'resizeIframe' && typeof data.height === 'number') {
      post('resize', { height: data.height });
    }
  });
})();
</script>`;

const PARENT_REWRITES: ReadonlyArray<[string, string]> = [
    ['window.parent?.document', 'window.__luminaVirtualDocument'],
    ['window.top?.document', 'window.__luminaVirtualDocument'],
    ['window.parent.document', 'window.__luminaVirtualDocument'],
    ['window.top.document', 'window.__luminaVirtualDocument'],
    ['parent?.document', 'window.__luminaVirtualDocument'],
    ['parent.document', 'window.__luminaVirtualDocument'],
    ['window.parent?.SillyTavern', 'window.__luminaSillyTavern'],
    ['window.top?.SillyTavern', 'window.__luminaSillyTavern'],
    ['window.parent.SillyTavern', 'window.__luminaSillyTavern'],
    ['window.top.SillyTavern', 'window.__luminaSillyTavern']
];

/** 把预设 HTML 包装为沙箱文档：重写宿主访问 + 注入桥接脚本（先于页面脚本执行）。 */
export const buildHtmlBlockDocument = (rawHtml: string): string => {
    let html = rawHtml;
    for (const [from, to] of PARENT_REWRITES) {
        html = html.split(from).join(to);
    }
    if (/<\/head>/i.test(html)) {
        return html.replace(/<\/head>/i, `${BRIDGE_SCRIPT}</head>`);
    }
    return `${BRIDGE_SCRIPT}${html}`;
};

/**
 * 代码块内容是否为完整 HTML 文档。
 *
 * 用于识别无语言标记的围栏（如预设正则注入的 ` ```\n<!DOCTYPE html>…\n``` `），
 * 普通代码、JSON 与 HTML 片段返回 false，避免误判为交互块。
 */
export const isHtmlDocumentBlock = (raw: string): boolean => {
    const text = raw.trim();
    if (!text) return false;
    if (/^<!doctype\s+html[\s>]/i.test(text)) return true;
    return /^<html[\s>]/i.test(text) && /<\/html>$/i.test(text);
};

const toText = (value: unknown): string => typeof value === 'string' ? value : '';

/** 解析来自 HTML 块 iframe 的消息；不匹配返回 null。 */
export const parseHtmlBlockMessage = (data: unknown): ChatHtmlBlockAction | null => {
    if (!data || typeof data !== 'object') return null;
    const message = data as ChatHtmlBlockIncomingMessage;
    if (message.source === HTML_BLOCK_MESSAGE_SOURCE) {
        if (message.type === 'fill') return { type: 'fill', text: toText(message.payload?.text) };
        if (message.type === 'send') return { type: 'send', text: toText(message.payload?.text) };
        if (message.type === 'resize' && typeof message.payload?.height === 'number') {
            return { type: 'resize', height: message.payload.height };
        }
        return null;
    }
    // 预设原生的 resizeIframe 协议（未经过桥接转换）
    if (message.type === 'resizeIframe' && typeof message.height === 'number') {
        return { type: 'resize', height: message.height };
    }
    return null;
};

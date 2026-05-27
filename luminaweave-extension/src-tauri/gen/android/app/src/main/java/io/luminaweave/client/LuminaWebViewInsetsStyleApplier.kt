package io.luminaweave.client

import android.webkit.WebView

class LuminaWebViewInsetsStyleApplier {
  fun apply(webView: WebView, snapshot: LuminaNativeInsetsSnapshot) {
    webView.evaluateJavascript(buildApplyScript(snapshot), null)
  }

  private fun buildApplyScript(snapshot: LuminaNativeInsetsSnapshot): String =
    """
    (() => {
      $INSTALL_HELPER_SCRIPT
      window.__LUMINAWEAVE_NATIVE_INSETS__?.apply(${snapshot.toJson()});
    })();
    """.trimIndent()

  companion object {
    private val INSTALL_HELPER_SCRIPT =
      """
        const existingBridge = window.__LUMINAWEAVE_NATIVE_INSETS__;
        if (!existingBridge || typeof existingBridge.apply !== 'function') {
          const toPx = (value) => {
            const numberValue = Number(value);
            const safeValue = Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
            return safeValue.toFixed(2) + 'px';
          };
          const readTopPx = (root) =>
            root.style.getPropertyValue('--lw-native-safe-top') ||
            getComputedStyle(root).getPropertyValue('--lw-native-safe-top') ||
            'unset';

          window.__LUMINAWEAVE_NATIVE_INSETS__ = {
            apply(detail) {
              const root = document.documentElement;
              if (!root) return;

              const topPxBefore = readTopPx(root);
              root.style.setProperty('--lw-native-safe-top', toPx(detail.top));
              root.style.setProperty('--lw-native-safe-right', toPx(detail.right));
              root.style.setProperty('--lw-native-safe-bottom', toPx(detail.bottom));
              root.style.setProperty('--lw-native-safe-left', toPx(detail.left));
              root.style.setProperty('--lw-native-ime-bottom', toPx(detail.imeBottom));
              const topPxAfter = readTopPx(root);

              const eventDetail = {
                top: Number(detail.top) || 0,
                right: Number(detail.right) || 0,
                bottom: Number(detail.bottom) || 0,
                left: Number(detail.left) || 0,
                imeBottom: Number(detail.imeBottom) || 0,
                raw: detail.raw || {
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  imeBottom: 0,
                },
                density: Number(detail.density) || 1,
              };

              console.debug('[LuminaWeave][NativeInsets] topPx before/after', {
                phase: 'apply',
                topPxBefore,
                topPxAfter,
                rawTopPx: eventDetail.raw.top,
                cssTopPx: eventDetail.top,
                density: eventDetail.density,
              });
              window.dispatchEvent(new CustomEvent('lw:native-insets-change', { detail: eventDetail }));
            },
          };
        }
      """.trimIndent()

    val PAGE_READY_SCRIPT =
      """
      (() =>
        location.href !== 'about:blank' &&
        Boolean(document.documentElement) &&
        Boolean(document.getElementById('app') || document.querySelector('.luminaweave-app-root'))
      )();
      """.trimIndent()

    val DOCUMENT_START_SCRIPT =
      """
      (() => {
        $INSTALL_HELPER_SCRIPT
      })();
      """.trimIndent()
  }
}

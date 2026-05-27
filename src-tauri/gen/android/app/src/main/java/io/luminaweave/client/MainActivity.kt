package io.luminaweave.client

import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

private const val LUMINA_INSETS_LOG_TAG = "LuminaWeaveInsets"

class MainActivity : TauriActivity() {
  private val nativeInsetsBridge = LuminaNativeInsetsBridge()

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)

    webView.addJavascriptInterface(nativeInsetsBridge, "LuminaNativeInsets")
    if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
      WebViewCompat.addDocumentStartJavaScript(webView, nativeInsetsBootstrapScript, setOf("*"))
    }

    ViewCompat.setOnApplyWindowInsetsListener(webView) { view, windowInsets ->
      val insetTypes = WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      val safeInsets = windowInsets.getInsets(insetTypes)
      val imeInsets = windowInsets.getInsets(WindowInsetsCompat.Type.ime())
      val imeBottom = maxOf(0, imeInsets.bottom - safeInsets.bottom)
      val topPxBefore = nativeInsetsBridge.topPx()

      nativeInsetsBridge.update(
        top = safeInsets.top,
        right = safeInsets.right,
        bottom = safeInsets.bottom,
        left = safeInsets.left,
        imeBottom = imeBottom
      )
      val topPxAfter = nativeInsetsBridge.topPx()
      Log.d(
        LUMINA_INSETS_LOG_TAG,
        "WindowInsets topPx before=$topPxBefore after=$topPxAfter systemBarsTop=${safeInsets.top} layoutDirection=${view.layoutDirection}"
      )
      view.post {
        webView.evaluateJavascript(buildApplyNativeInsetsScript(nativeInsetsBridge.snapshotJson()), null)
      }

      windowInsets
    }
    ViewCompat.requestApplyInsets(webView)
  }

  private class LuminaNativeInsetsBridge {
    private var top: Int = 0
    private var right: Int = 0
    private var bottom: Int = 0
    private var left: Int = 0
    private var imeBottom: Int = 0

    @Synchronized
    fun update(top: Int, right: Int, bottom: Int, left: Int, imeBottom: Int) {
      this.top = top
      this.right = right
      this.bottom = bottom
      this.left = left
      this.imeBottom = imeBottom
    }

    @JavascriptInterface
    @Synchronized
    fun snapshotJson(): String =
      """{"top":$top,"right":$right,"bottom":$bottom,"left":$left,"imeBottom":$imeBottom}"""

    @Synchronized
    fun topPx(): Int = top
  }
}

private fun buildApplyNativeInsetsScript(snapshotJson: String): String =
  """
  (() => {
    const detail = $snapshotJson;
    const root = document.documentElement;
    if (!root) return;

    const toPx = (value) => Math.max(0, Math.round(Number(value) || 0)) + 'px';
    const topPxBefore = root.style.getPropertyValue('--lw-native-safe-top') || getComputedStyle(root).getPropertyValue('--lw-native-safe-top') || 'unset';
    root.style.setProperty('--lw-native-safe-top', toPx(detail.top));
    root.style.setProperty('--lw-native-safe-right', toPx(detail.right));
    root.style.setProperty('--lw-native-safe-bottom', toPx(detail.bottom));
    root.style.setProperty('--lw-native-safe-left', toPx(detail.left));
    root.style.setProperty('--lw-native-ime-bottom', toPx(detail.imeBottom));
    const topPxAfter = root.style.getPropertyValue('--lw-native-safe-top') || 'unset';
    console.debug('[LuminaWeave][NativeInsets] topPx before/after', {
      phase: 'apply',
      topPxBefore,
      topPxAfter,
      nativeTopPx: detail.top
    });
    window.dispatchEvent(new CustomEvent('lw:native-insets-change', { detail }));
  })();
  """.trimIndent()

private val nativeInsetsBootstrapScript = """
  (() => {
    const applyLatestLuminaNativeInsets = () => {
      const bridge = window.LuminaNativeInsets;
      if (!bridge || typeof bridge.snapshotJson !== 'function') return;

      try {
        const detail = JSON.parse(bridge.snapshotJson());
        const root = document.documentElement;
        if (!root) return;

        const toPx = (value) => Math.max(0, Math.round(Number(value) || 0)) + 'px';
        const topPxBefore = root.style.getPropertyValue('--lw-native-safe-top') || getComputedStyle(root).getPropertyValue('--lw-native-safe-top') || 'unset';
        root.style.setProperty('--lw-native-safe-top', toPx(detail.top));
        root.style.setProperty('--lw-native-safe-right', toPx(detail.right));
        root.style.setProperty('--lw-native-safe-bottom', toPx(detail.bottom));
        root.style.setProperty('--lw-native-safe-left', toPx(detail.left));
        root.style.setProperty('--lw-native-ime-bottom', toPx(detail.imeBottom));
        const topPxAfter = root.style.getPropertyValue('--lw-native-safe-top') || 'unset';
        console.debug('[LuminaWeave][NativeInsets] topPx before/after', {
          phase: 'bootstrap',
          topPxBefore,
          topPxAfter,
          nativeTopPx: detail.top
        });
        window.dispatchEvent(new CustomEvent('lw:native-insets-change', { detail }));
      } catch (_) {
      }
    };

    applyLatestLuminaNativeInsets();
    document.addEventListener('DOMContentLoaded', applyLatestLuminaNativeInsets, { once: true });
    window.addEventListener('load', applyLatestLuminaNativeInsets, { once: true });
  })();
""".trimIndent()

package io.luminaweave.client

import android.content.res.Resources
import android.os.Handler
import android.util.Log
import android.view.View
import android.webkit.WebView
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

private const val LUMINA_INSETS_LOG_TAG = "LuminaWeaveInsets"

class LuminaAndroidInsetsBridge(
  private val resources: Resources,
  private val contentRootProvider: () -> View?,
  private val webViewProvider: () -> WebView?,
  private val isDestroyed: () -> Boolean,
  private val mainHandler: Handler,
) {
  private val webViewInsetsStyleApplier = LuminaWebViewInsetsStyleApplier()
  private var isInsetsListenerAttached = false
  private var isInsetsPushScheduled = false
  private var isInsetsSyncScheduled = false
  private var hasPendingForcedInsetsPush = false
  private var hasReadyPageInsetsInjection = false
  private var hasPendingInsetsSync = false
  private var currentSnapshot = LuminaNativeInsetsSnapshot.zero(resources.displayMetrics.density)
  private var lastPushedInsetsSnapshot: LuminaNativeInsetsSnapshot? = null

  fun onCreate() {
    refreshInjection()
  }

  fun onWebViewAvailable(webView: WebView) {
    if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
      WebViewCompat.addDocumentStartJavaScript(
        webView,
        LuminaWebViewInsetsStyleApplier.DOCUMENT_START_SCRIPT,
        setOf("*"),
      )
    }
    resetWebViewInjectionState()
    refreshInjection()
  }

  fun onResume() {
    refreshInjection()
  }

  fun onConfigurationChanged() {
    resetWebViewInjectionState()
    refreshInjection()
  }

  private fun refreshInjection() {
    attachSystemInsetsListenerIfNeeded()
    requestSystemInsets()
    scheduleInsetsSyncWhenPageReady()
  }

  private fun resetWebViewInjectionState() {
    lastPushedInsetsSnapshot = null
    hasPendingForcedInsetsPush = false
    hasReadyPageInsetsInjection = false
  }

  private fun attachSystemInsetsListenerIfNeeded() {
    if (isInsetsListenerAttached) {
      return
    }

    val contentRoot = contentRootProvider() ?: return
    ViewCompat.setOnApplyWindowInsetsListener(contentRoot) { _, windowInsets ->
      updateWindowInsets(windowInsets)
      windowInsets
    }
    isInsetsListenerAttached = true
  }

  private fun requestSystemInsets() {
    contentRootProvider()?.let { ViewCompat.requestApplyInsets(it) }
  }

  private fun updateWindowInsets(windowInsets: WindowInsetsCompat) {
    val safeInsets = resolveSystemSafeInsets(windowInsets)
    val imeBottom = resolveImeBottom(windowInsets, safeInsets)
    val previousTop = currentSnapshot.top
    currentSnapshot =
      LuminaNativeInsetsSnapshot.fromRawInsets(
        top = safeInsets.top,
        right = safeInsets.right,
        bottom = safeInsets.bottom,
        left = safeInsets.left,
        imeBottom = imeBottom,
        density = resources.displayMetrics.density,
      )

    Log.d(
      LUMINA_INSETS_LOG_TAG,
      "WindowInsets topCssPx before=$previousTop after=${currentSnapshot.top} rawTopPx=${safeInsets.top} density=${currentSnapshot.density}",
    )
    pushInsetsToWebView(force = false)
    scheduleInsetsSyncWhenPageReady()
  }

  private fun resolveSystemSafeInsets(windowInsets: WindowInsetsCompat): Insets {
    val insetTypes = WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
    val visibleInsets = windowInsets.getInsets(insetTypes)
    val stableInsets = windowInsets.getInsetsIgnoringVisibility(insetTypes)

    return Insets.of(
      maxOf(visibleInsets.left, stableInsets.left),
      maxOf(visibleInsets.top, stableInsets.top),
      maxOf(visibleInsets.right, stableInsets.right),
      maxOf(visibleInsets.bottom, stableInsets.bottom),
    )
  }

  private fun resolveImeBottom(
    windowInsets: WindowInsetsCompat,
    safeInsets: Insets,
  ): Int {
    val imeType = WindowInsetsCompat.Type.ime()
    if (!windowInsets.isVisible(imeType)) {
      return 0
    }

    return maxOf(0, windowInsets.getInsets(imeType).bottom - safeInsets.bottom)
  }

  private fun pushInsetsToWebView(force: Boolean) {
    if (isDestroyed()) {
      return
    }

    val targetWebView = webViewProvider() ?: return
    hasPendingForcedInsetsPush = hasPendingForcedInsetsPush || force
    if (isInsetsPushScheduled) {
      return
    }
    isInsetsPushScheduled = true

    targetWebView.post {
      isInsetsPushScheduled = false
      val activeWebView = webViewProvider() ?: return@post
      val snapshot = currentSnapshot
      val shouldForcePush = hasPendingForcedInsetsPush
      hasPendingForcedInsetsPush = false

      if (!hasReadyPageInsetsInjection && !shouldForcePush) {
        return@post
      }

      if (!shouldForcePush && snapshot == lastPushedInsetsSnapshot) {
        return@post
      }

      webViewInsetsStyleApplier.apply(activeWebView, snapshot)
      lastPushedInsetsSnapshot = snapshot
      if (shouldForcePush) {
        hasReadyPageInsetsInjection = true
      }
    }
  }

  private fun scheduleInsetsSyncWhenPageReady() {
    if (webViewProvider() == null) {
      return
    }
    if (isInsetsSyncScheduled) {
      hasPendingInsetsSync = true
      return
    }

    isInsetsSyncScheduled = true
    hasPendingInsetsSync = false
    pollPageReady(attempt = 0)
  }

  private fun pollPageReady(attempt: Int) {
    if (isDestroyed()) {
      isInsetsSyncScheduled = false
      return
    }

    val targetWebView = webViewProvider() ?: run {
      isInsetsSyncScheduled = false
      return
    }

    targetWebView.post {
      val activeWebView = webViewProvider() ?: run {
        isInsetsSyncScheduled = false
        return@post
      }
      activeWebView.evaluateJavascript(LuminaWebViewInsetsStyleApplier.PAGE_READY_SCRIPT) { result ->
        if (isDestroyed()) {
          isInsetsSyncScheduled = false
          return@evaluateJavascript
        }

        if (result == "true") {
          isInsetsSyncScheduled = false
          hasPendingInsetsSync = false
          pushInsetsToWebView(force = true)
          return@evaluateJavascript
        }

        if (attempt >= MAX_READY_RETRY_COUNT) {
          isInsetsSyncScheduled = false
          if (hasPendingInsetsSync) {
            hasPendingInsetsSync = false
            scheduleInsetsSyncWhenPageReady()
          }
          return@evaluateJavascript
        }

        mainHandler.postDelayed(
          { pollPageReady(attempt = attempt + 1) },
          READY_RETRY_DELAY_MS,
        )
      }
    }
  }

  companion object {
    private const val READY_RETRY_DELAY_MS = 50L
    private const val MAX_READY_RETRY_COUNT = 40
  }
}

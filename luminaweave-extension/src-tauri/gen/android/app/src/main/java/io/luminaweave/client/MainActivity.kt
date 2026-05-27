package io.luminaweave.client

import android.content.res.Configuration
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var activeWebView: WebView? = null
  private val insetsBridge: LuminaAndroidInsetsBridge by lazy {
    LuminaAndroidInsetsBridge(
      resources = resources,
      contentRootProvider = { window.decorView.findViewById(android.R.id.content) },
      webViewProvider = { activeWebView },
      isDestroyed = { isDestroyed },
      mainHandler = mainHandler,
    )
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    insetsBridge.onCreate()
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    activeWebView = webView
    insetsBridge.onWebViewAvailable(webView)
  }

  override fun onResume() {
    super.onResume()
    insetsBridge.onResume()
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    insetsBridge.onConfigurationChanged()
  }

  override fun onDestroy() {
    mainHandler.removeCallbacksAndMessages(null)
    activeWebView = null
    super.onDestroy()
  }
}

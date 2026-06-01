package io.luminaweave.client

import android.graphics.Color
import android.os.Handler
import android.util.Log
import android.view.Window
import android.webkit.JavascriptInterface
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONException
import org.json.JSONObject

private const val LUMINA_STATUS_BAR_LOG_TAG = "LuminaWeaveStatusBar"

data class LuminaAndroidStatusBarAppearance(
  val iconColor: String,
  val safeArea: String,
) {
  companion object {
    fun fromJson(payload: String): LuminaAndroidStatusBarAppearance? =
      try {
        val json = JSONObject(payload)
        val iconColor = json.optString("iconColor", "dark")
        if (iconColor != "light" && iconColor != "dark") {
          Log.w(LUMINA_STATUS_BAR_LOG_TAG, "Ignoring unsupported status bar iconColor=$iconColor")
          null
        } else {
          LuminaAndroidStatusBarAppearance(
            iconColor = iconColor,
            safeArea = json.optString("safeArea", "shell").takeIf { it == "manual" } ?: "shell",
          )
        }
      } catch (error: JSONException) {
        Log.w(LUMINA_STATUS_BAR_LOG_TAG, "Ignoring malformed status bar payload", error)
        null
      }
  }
}

class LuminaAndroidStatusBarBridge(
  private val windowProvider: () -> Window?,
  private val isDestroyed: () -> Boolean,
  private val mainHandler: Handler,
) {
  private var lastAppearance = LuminaAndroidStatusBarAppearance(
    iconColor = "dark",
    safeArea = "shell",
  )

  @JavascriptInterface
  fun setAppearance(payload: String) {
    val appearance = LuminaAndroidStatusBarAppearance.fromJson(payload) ?: return
    mainHandler.post {
      if (isDestroyed()) {
        return@post
      }
      lastAppearance = appearance
      applyAppearance(appearance)
    }
  }

  fun reapplyLastAppearance() {
    mainHandler.post {
      if (!isDestroyed()) {
        applyAppearance(lastAppearance)
      }
    }
  }

  @Suppress("DEPRECATION")
  private fun applyAppearance(appearance: LuminaAndroidStatusBarAppearance) {
    val targetWindow = windowProvider() ?: return
    val decorView = targetWindow.decorView

    targetWindow.statusBarColor = Color.TRANSPARENT
    WindowInsetsControllerCompat(targetWindow, decorView).isAppearanceLightStatusBars =
      appearance.iconColor == "dark"

    Log.d(
      LUMINA_STATUS_BAR_LOG_TAG,
      "Applied status bar iconColor=${appearance.iconColor} safeArea=${appearance.safeArea}",
    )
  }

  companion object {
    const val JS_BRIDGE_NAME = "LuminaAndroidStatusBar"
  }
}

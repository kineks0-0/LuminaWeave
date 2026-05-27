package io.luminaweave.client

import java.util.Locale

data class LuminaRawInsets(
  val top: Int,
  val right: Int,
  val bottom: Int,
  val left: Int,
  val imeBottom: Int,
)

data class LuminaNativeInsetsSnapshot(
  val top: Double,
  val right: Double,
  val bottom: Double,
  val left: Double,
  val imeBottom: Double,
  val raw: LuminaRawInsets,
  val density: Float,
) {
  fun toJson(): String =
    """{"top":${formatCss(top)},"right":${formatCss(right)},"bottom":${formatCss(bottom)},"left":${formatCss(left)},"imeBottom":${formatCss(imeBottom)},"raw":{"top":${raw.top},"right":${raw.right},"bottom":${raw.bottom},"left":${raw.left},"imeBottom":${raw.imeBottom}},"density":${formatCss(density.toDouble())}}"""

  companion object {
    fun fromRawInsets(
      top: Int,
      right: Int,
      bottom: Int,
      left: Int,
      imeBottom: Int,
      density: Float,
    ): LuminaNativeInsetsSnapshot {
      val effectiveDensity = if (density > 0f) density else 1f
      fun toCssPx(value: Int): Double = maxOf(0, value).toDouble() / effectiveDensity.toDouble()

      return LuminaNativeInsetsSnapshot(
        top = toCssPx(top),
        right = toCssPx(right),
        bottom = toCssPx(bottom),
        left = toCssPx(left),
        imeBottom = toCssPx(imeBottom),
        raw = LuminaRawInsets(
          top = top,
          right = right,
          bottom = bottom,
          left = left,
          imeBottom = imeBottom,
        ),
        density = effectiveDensity,
      )
    }

    fun zero(density: Float): LuminaNativeInsetsSnapshot =
      fromRawInsets(
        top = 0,
        right = 0,
        bottom = 0,
        left = 0,
        imeBottom = 0,
        density = density,
      )

    private fun formatCss(value: Double): String = String.format(Locale.US, "%.4f", value)
  }
}

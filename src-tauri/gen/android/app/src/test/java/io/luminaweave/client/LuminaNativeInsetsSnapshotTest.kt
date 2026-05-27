package io.luminaweave.client

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LuminaNativeInsetsSnapshotTest {
  @Test
  fun convertsAndroidPhysicalPixelsToWebCssPixels() {
    val snapshot =
      LuminaNativeInsetsSnapshot.fromRawInsets(
        top = 134,
        right = 6,
        bottom = 36,
        left = 3,
        imeBottom = 240,
        density = 3f,
      )

    assertEquals(44.6667, snapshot.top, 0.0001)
    assertEquals(2.0, snapshot.right, 0.0001)
    assertEquals(12.0, snapshot.bottom, 0.0001)
    assertEquals(1.0, snapshot.left, 0.0001)
    assertEquals(80.0, snapshot.imeBottom, 0.0001)
    assertEquals(3f, snapshot.density, 0.0001f)
  }

  @Test
  fun serializesCssPixelsAndRawPixelsForTheWebContract() {
    val snapshot =
      LuminaNativeInsetsSnapshot.fromRawInsets(
        top = 134,
        right = 0,
        bottom = 0,
        left = 0,
        imeBottom = 0,
        density = 3f,
      )

    val json = snapshot.toJson()

    assertTrue(json.contains("\"top\":44.6667"))
    assertTrue(json.contains("\"imeBottom\":0.0000"))
    assertTrue(json.contains("\"raw\":{\"top\":134"))
    assertTrue(json.contains("\"density\":3.0000"))
  }
}

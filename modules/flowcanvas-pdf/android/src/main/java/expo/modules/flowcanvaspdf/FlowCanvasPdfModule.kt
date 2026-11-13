package expo.modules.flowcanvaspdf

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class FlowCanvasPdfModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FlowCanvasPdf")

    AsyncFunction("getPageCount") { pdfUri: String ->
      openDescriptor(pdfUri).use { pfd ->
        PdfRenderer(pfd).use { renderer ->
          renderer.pageCount
        }
      }
    }

    AsyncFunction("renderPage") { pdfUri: String, pageNumber: Int, targetWidth: Int ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("React context is unavailable.")

      openDescriptor(pdfUri).use { pfd ->
        PdfRenderer(pfd).use { renderer ->
          val pageIndex = pageNumber - 1
          if (pageIndex < 0 || pageIndex >= renderer.pageCount) {
            throw IllegalArgumentException("PDF page $pageNumber is out of range.")
          }
          renderer.openPage(pageIndex).use { page ->
            val desiredWidth = max(320, min(2400, targetWidth))
            val scale = desiredWidth.toFloat() / max(1, page.width).toFloat()
            val pixelWidth = max(1, (page.width * scale).roundToInt())
            val pixelHeight = max(1, (page.height * scale).roundToInt())

            val bitmap = Bitmap.createBitmap(pixelWidth, pixelHeight, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(Color.WHITE)
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

            val outFile = File(context.cacheDir, "pdf-page-${UUID.randomUUID()}.png")
            FileOutputStream(outFile).use { stream ->
              bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            }
            bitmap.recycle()

            mapOf(
              "pageNumber" to pageNumber,
              "uri" to Uri.fromFile(outFile).toString(),
              "width" to pixelWidth,
              "height" to pixelHeight,
              "mimeType" to "image/png"
            )
          }
        }
      }
    }
  }

  private fun openDescriptor(pdfUri: String): ParcelFileDescriptor {
    val parsed = Uri.parse(pdfUri)
    if (parsed.scheme == "content") {
      val resolver = appContext.reactContext?.contentResolver
        ?: throw IllegalStateException("ContentResolver unavailable.")
      return resolver.openFileDescriptor(parsed, "r")
        ?: throw IllegalStateException("Could not open PDF descriptor.")
    }
    val path = if (parsed.scheme == "file") parsed.path ?: pdfUri else pdfUri
    return ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY)
  }
}

import ExpoModulesCore
import PDFKit
import UIKit

public class FlowCanvasPdfModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FlowCanvasPdf")

    AsyncFunction("getPageCount") { (pdfUri: String) -> Int in
      let url = try self.resolveFileUrl(pdfUri)
      guard let document = PDFDocument(url: url) else {
        throw NSError(
          domain: "FlowCanvasPdf",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Could not open the selected PDF file."]
        )
      }
      return document.pageCount
    }

    AsyncFunction("renderPage") { (pdfUri: String, pageNumber: Int, targetWidth: Int) -> [String: Any] in
      let url = try self.resolveFileUrl(pdfUri)
      guard let document = PDFDocument(url: url) else {
        throw NSError(
          domain: "FlowCanvasPdf",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Could not open the selected PDF file."]
        )
      }
      let pageIndex = pageNumber - 1
      guard pageIndex >= 0, pageIndex < document.pageCount, let page = document.page(at: pageIndex) else {
        throw NSError(
          domain: "FlowCanvasPdf",
          code: 2,
          userInfo: [NSLocalizedDescriptionKey: "PDF page \(pageNumber) is out of range."]
        )
      }

      let mediaBox = page.bounds(for: .mediaBox)
      let safeBoxWidth = max(1.0, mediaBox.width)
      let safeBoxHeight = max(1.0, mediaBox.height)
      let desiredWidth = CGFloat(max(320, min(2400, targetWidth)))
      let scale = desiredWidth / safeBoxWidth
      let pixelWidth = Int(round(safeBoxWidth * scale))
      let pixelHeight = Int(round(safeBoxHeight * scale))
      let renderSize = CGSize(width: pixelWidth, height: pixelHeight)

      let format = UIGraphicsImageRendererFormat()
      format.scale = 1.0
      format.opaque = true

      let renderer = UIGraphicsImageRenderer(size: renderSize, format: format)
      let image = renderer.image { context in
        UIColor.white.setFill()
        context.fill(CGRect(origin: .zero, size: renderSize))

        let cgContext = context.cgContext
        cgContext.saveGState()
        cgContext.translateBy(x: 0, y: renderSize.height)
        cgContext.scaleBy(x: scale, y: -scale)
        cgContext.translateBy(x: -mediaBox.origin.x, y: -mediaBox.origin.y)
        page.draw(with: .mediaBox, to: cgContext)
        cgContext.restoreGState()
      }

      guard let pngData = image.pngData() else {
        throw NSError(
          domain: "FlowCanvasPdf",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "Could not encode PDF page \(pageNumber) as PNG."]
        )
      }

      let tempFile = FileManager.default.temporaryDirectory
        .appendingPathComponent("pdf-page-\(UUID().uuidString).png")
      try pngData.write(to: tempFile, options: .atomic)

      return [
        "pageNumber": pageNumber,
        "uri": tempFile.absoluteString,
        "width": pixelWidth,
        "height": pixelHeight,
        "mimeType": "image/png",
      ]
    }
  }

  private func resolveFileUrl(_ uriString: String) throws -> URL {
    if let url = URL(string: uriString), url.isFileURL {
      return url
    }
    if uriString.hasPrefix("/") {
      return URL(fileURLWithPath: uriString)
    }
    throw NSError(
      domain: "FlowCanvasPdf",
      code: 0,
      userInfo: [NSLocalizedDescriptionKey: "Invalid PDF file URI."]
    )
  }
}

/**
 * Pure multi-page PDF HTML layout builder.
 *
 * Kept free of Skia/Expo runtime imports so it can be verified directly in Node.
 */

export type PdfRenderedPage = {
  pixelWidth: number;
  pixelHeight: number;
  base64Png: string;
  name?: string;
};

export function escapePdfHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function computePdfPageSize(
  pixelWidth: number,
  pixelHeight: number,
  maxPageEdge = 792,
): { pageWidth: number; pageHeight: number } {
  const aspect = Math.max(1, pixelWidth) / Math.max(1, pixelHeight);
  const pageWidth = aspect >= 1 ? maxPageEdge : Math.max(200, Math.round(maxPageEdge * aspect));
  const pageHeight = aspect >= 1 ? Math.max(200, Math.round(maxPageEdge / aspect)) : maxPageEdge;
  return { pageWidth, pageHeight };
}

/**
 * Compose a multi-page HTML document with `page-break-after: always` between
 * pages for `expo-print` (`Print.printToFileAsync`).
 */
export function buildMultiPagePdfHtml(
  pages: readonly PdfRenderedPage[],
  boardTitle: string,
  backgroundHex: string,
): string {
  const firstSize =
    pages.length > 0
      ? computePdfPageSize(pages[0].pixelWidth, pages[0].pixelHeight)
      : { pageWidth: 612, pageHeight: 792 };

  const pageBlocks = pages
    .map((page, index) => {
      const isLast = index === pages.length - 1;
      const breakRule = isLast ? 'page-break-after: auto;' : 'page-break-after: always; break-after: page;';
      return `  <div class="pdf-page" style="${breakRule}">
    <img src="data:image/png;base64,${page.base64Png}" alt="${escapePdfHtml(page.name ?? `Page ${index + 1}`)}" />
  </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapePdfHtml(boardTitle || 'FlowCanvas Board')}</title>
<style>
  @page { margin: 0; size: ${firstSize.pageWidth}pt ${firstSize.pageHeight}pt; }
  html, body { margin: 0; padding: 0; background: ${backgroundHex}; }
  .pdf-page { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: ${backgroundHex}; overflow: hidden; }
  .pdf-page img { width: 100%; height: 100%; object-fit: contain; display: block; }
</style>
</head>
<body>
${pageBlocks}
</body>
</html>`;
}

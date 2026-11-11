# Local OCR

## Decision

FlowCanvas uses **`expo-mlkit-ocr` 0.2.7** as the on-device recognition adapter
and wraps it in `src/ocr/`. iOS is configured with `iosEngine: "vision"` so text
recognition runs on Apple's Vision framework; Android uses bundled Google ML Kit
Text Recognition v2. Recognition never leaves the device and the app makes no
cloud or AI-provider call.

Why this package:

- It is an Expo module with a config plugin, so it fits the existing managed
  Expo/prebuild workflow instead of needing a manual bare-RN linking setup.
- It returns blocks, lines, and elements with image-space bounding boxes, which
  is enough to order multiple text regions and show a meaningful review screen.
- It exposes `isSupported()` so a device that cannot run the engine can show an
  honest error while still placing the image.
- On iOS the `vision` engine avoids shipping Google ML Kit pods; on Android ML
  Kit's Latin text model is bundled with the app and works offline.

The package is a native module. It works in a development build, `expo prebuild`
+ `expo run:*`, or EAS Build. It does **not** work in Expo Go. The adapter resolves
the registered `ExpoMlkitOcr` module with `requireOptionalNativeModule` instead of
importing the package's JS wrapper (which throws while loading when the module is
missing), so Expo Go gets an error state in the review screen instead of a crash,
and `Add image only` remains available.

## Options evaluated

| Option | Offline | Expo fit | Result shape | Why not chosen |
|---|---|---|---|---|
| `expo-mlkit-ocr` 0.2.7 | ML Kit v2 on Android; Apple Vision or ML Kit on iOS | Expo module + config plugin | Blocks/lines/elements with bounding boxes | **Chosen** |
| `expo-text-extractor` 2.0.0 | ML Kit on Android; Vision on iOS | Expo module | `string[]` only | No region geometry, so block ordering and a multi-region review cannot be represented faithfully |
| `expo-ocr-kit` 0.1.4 | ML Kit on Android; Vision on iOS | Expo module + small config plugin | Blocks with bounding boxes | Viable fallback, but younger (0.1.x) and no device-support API at evaluation time |
| `@infinitered/react-native-mlkit-text-recognition` 5.0.1 | ML Kit | Expo module | Blocks/lines | Reputable maintainer but no README/API detail published for the version evaluated, and it pulls ML Kit pods on iOS |
| `@react-native-ml-kit/text-recognition` 2.0.0 | ML Kit | Bare React Native autolinking | Blocks/lines/elements | Legacy-bridge module, no Expo config plugin, ships several script models, and needs manual native setup |
| `react-native-image-analysis` 0.4.0 | Vision on iOS; ML Kit on Android | New Architecture module | Text geometry plus barcode/selection UI | Larger surface than needed (interactive Live Text, barcodes, background removal) and adds a second UI system |
| `tesseract.js` 7.0.0 | Yes, WASM + language data | Poor | Words/lines | Large worker/WASM/trained-data bundle, slower on phones, and React Native worker/file integration is fragile |
| `react-native-tesseract-ocr` 2.0.3 | Tesseract | Bare native wrapper | Plain text | Old, unmaintained, and Android-oriented |

## Recognition quality

Accuracy is improved in two places that do not depend on the native package:

- **Reading order.** Both engines report `blocks[].lines[]`, so the service
  flattens every block to its lines before ordering. Apple Vision's fallback
  returns one block containing the whole page; line-level flattening is what
  makes that page readable and stops the review screen from reporting one text
  region. Ordering projects line boxes onto the x axis, finds blank gutters, and
  reads genuine side-by-side columns left to right. Without a column, it splits
  at paragraph-sized horizontal gaps and reads top to bottom, then left to right
  within each row. A full-width title above two columns still reads first,
  because it spans the gutter and forces a horizontal split before the column
  split.
- **Input pixels.** The recognizer no longer reads the placed JPEG. The import
  flow builds a lossless PNG of the same crop, from the untouched original while
  it still matches the working size, otherwise from the rotated working copy.
  Crops with a long edge under 1600 px are enlarged up to 4× so their glyphs
  clear the engines' minimum text size. The copy lives in the cache directory
  and is deleted when the flow finishes.

## Flow and data model

```text
Pick or capture image
  → crop/rotate
  → store durable original + placed copies
  → build lossless OCR copy (cache)
  → OCR review screen (recognition starts immediately)
      loading / success / no text / error
      editable extracted text
      Add text to board | Add image only
  → place image; optionally place linked text below it
```

- The image is written to the media store **before** recognition starts. OCR is
  an enhancement: `Add image only` is enabled in every review state, including
  while recognition is still running and after it fails.
- `ImageObject.ocr` stores the reviewed text, engine id, region count, and
  recognition timestamp. It is optional so older image rows still load.
- `TextObject.sourceImageId` links an extracted text block back to its image.
- Both objects are inserted in one batched document command, so a placement is
  one undo step.
- The reviewed text is attached to the image even when the user chooses image
  only, so a later feature can re-run or re-place the extraction without another
  OCR pass. No text block is created in that case.
- Media asset metadata mirrors the OCR result on the placed asset row.
- Malformed OCR metadata is dropped without rejecting the image object; the
  board remains loadable.

## Permissions and privacy

- OCR requests **no permission of its own**. It reads the local placed copy that
  the existing image-import flow already stored after camera/photo permission
  was granted.
- If camera or photo access is denied, the existing source sheet explains the
  denial and links to Settings. Recognition is never reached, and no image is
  placed.
- There is no network request, cloud OCR, AI provider, upload, or telemetry in
  the recognition path. Text and pixels stay in the app container.
- The untouched original asset remains available alongside the placed copy, so
  a future re-run can use the source rather than the cropped copy.

## Limitations

- Not exercised on a physical device or simulator in this environment. The
  native module and both platform engines require a development build; Expo Go
  only shows the unavailable error state.
- iOS is pinned to Apple Vision through `iosEngine: "vision"` and the app's iOS
  deployment target is 16.4. Android uses ML Kit's bundled Latin model; other
  scripts would need a different ML Kit artifact and are not configured.
- Reading order is inferred from line geometry. Genuine side-by-side columns
  with a blank gutter are read column-first and a title above them stays first,
  but very dense, overlapping, or irregular layouts can still be misordered; the
  user can correct the text before adding it.
- Recognition quality depends on the platform engine, image sharpness, and
  handwriting. Handwriting and stylised lettering are best-effort, and very
  small or glare-washed text can still be missed.
- OCR reads a dedicated lossless copy of the placed crop. Source photos larger
  than the 4096 px working cap are recognized from the downsampled working
  pixels, not the untouched original, because the crop-screen geometry is
  measured against that working copy.
- Recognition can only be started during import. Re-running OCR from an image
  already on a board, and cleaning up a linked text block when its source image
  is deleted, are not exposed yet.
- No PDF or multi-page document OCR.

## Verification approach

`scripts/verify-ocr.mts` exercises the platform-independent contract:

- line-level flattening, including an Apple Vision payload with every line in a
  single block;
- out-of-order lines sort into reading order and join with newlines;
- two side-by-side columns read column-first, and a full-width title above them
  stays first;
- two lines on one visual row are read left to right when neither side has
  enough lines to be a column;
- lossless OCR copy sizing: small crops are enlarged up to 4×, large crops keep
  their source resolution;
- loading, success, no-text, and error states;
- corrected text and the disabled `Add text to board` state for empty text;
- permission-free adapter boundary: OCR only receives a local URI, and image
  import permission handling remains in the existing suite;
- linking (`TextObject.sourceImageId`) and one-step undo;
- image-only placement after a loading, empty, or failed recognition;
- persistence and relaunch from an on-disk SQLite database, including malformed
  or legacy OCR metadata.

Native recognition, permission dialogs, device kill/relaunch, and offline
behaviour still require a development build on a phone or simulator.

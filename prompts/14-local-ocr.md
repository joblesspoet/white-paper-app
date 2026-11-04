# Session 14 — Local OCR

Read docs and inspect image import. Evaluate React Native-compatible offline OCR options for the current Expo/native setup before choosing one. Document the choice and limitations.

Implement an OCR service adapter, loading/success/no-text/error states, and an OCR review screen with image preview and editable extracted text. Add `Add text to board` and `Add image only`; OCR must never block image placement. Link extracted text to its source image and persist the result. Test permissions, OCR failure, correction, multiple text regions, relaunch, and offline behavior. Do not add AI or cloud OCR. Update task status; next task is export/import.
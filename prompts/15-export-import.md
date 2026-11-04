# Session 15 — Export and import

Read docs and inspect the complete local MVP. Implement local export/import only.

Add visible-board and selected-region PNG/JPEG export, local PDF where supported, native share sheet, and versioned editable `.flowcanvas.json` export/import. Validate schemas, handle migration by creating a new board when appropriate, show progress for large exports, and never freeze the editor. Test empty boards, large boards, selections, invalid files, version mismatch, round-trip import, and share cancellation. Do not implement cloud sync. Update task status; next task is settings.
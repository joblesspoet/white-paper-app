# Session 12 — Local persistence

Read architecture, task status, and inspect the complete current local editor. Implement local persistence only.

Choose and install an appropriate Expo-compatible SQLite/local storage solution. Define versioned schemas for boards, pages, canvas objects, and media references. Persist board metadata and all current canvas objects with debounced autosave. Load on editor open, save viewport state, recover after app restart, and add a basic migration/version field. Keep the UI responsive and handle storage errors. Do not implement cloud sync, auth, AI, or OCR. Test create/edit/kill/relaunch/reopen and migration behavior. Update task status; next task is image import.
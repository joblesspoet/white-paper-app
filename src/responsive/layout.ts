/**
 * Pure responsive breakpoint, layout, safe-area, and keyboard calculations.
 *
 * Keeps phone vs tablet and portrait vs landscape rules in one deterministic
 * module so Home, Editor, Settings, and modal sheets adapt consistently across
 * small phones, large phones, Android phones, iPad portrait, and iPad landscape
 * without stretching phone layouts or crowding the canvas.
 */

import { spacing, touchTarget } from '../theme.ts';

export type ScreenOrientation = 'portrait' | 'landscape';

export type DeviceClass =
  | 'small-phone'
  | 'phone'
  | 'phone-landscape'
  | 'tablet-portrait'
  | 'tablet-landscape';

export type EdgeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const ZERO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Minimum interactive touch target across all controls (44pt). */
export const MIN_TOUCH_TARGET = touchTarget;
/** Minimum touch target for primary dock and tool rail buttons (48pt). */
export const DOCK_TOUCH_TARGET = 48;

/** Design system gutters: 16pt on phones, 32pt on tablets. */
export const PHONE_GUTTER = spacing.md;
export const TABLET_GUTTER = spacing.xl;

/**
 * A tablet must have both a short edge >= 600pt and a current window width >= 768pt.
 * Checking shortEdge prevents large phones in landscape (e.g. 932×430 or 915×412)
 * from being misclassified as tablets, while checking width >= 768 ensures iPad
 * Split View / Slide Over compact windows fall back to phone/compact chrome.
 */
export const TABLET_MIN_SHORT_EDGE = 600;
export const TABLET_MIN_WIDTH = 768;
export const COMPACT_PHONE_WIDTH = 360;
export const COMPACT_VIEWPORT_HEIGHT = 480;

/** Standard modal widths on tablet/landscape viewports. */
export const TABLET_MODAL_MAX_WIDTH = 480;
export const TABLET_WIDE_MODAL_MAX_WIDTH = 560;
export const SETTINGS_TABLET_MAX_WIDTH = 640;

/** Editor chrome dimensions. */
export const TOOL_RAIL_WIDTH = 84;
export const INSPECTOR_PANEL_WIDTH = 288;
export const INSPECTOR_EDGE_TAB_WIDTH = 44;
export const HOME_TWO_PANE_SIDEBAR_WIDTH = 268;

export type ViewportProfile = {
  width: number;
  height: number;
  shortEdge: number;
  longEdge: number;
  orientation: ScreenOrientation;
  isTablet: boolean;
  isTabletPortrait: boolean;
  isTabletLandscape: boolean;
  isPhoneLandscape: boolean;
  isCompactPhone: boolean;
  isCompactHeight: boolean;
  deviceClass: DeviceClass;
};

export function resolveViewportProfile(width: number, height: number): ViewportProfile {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const shortEdge = Math.min(safeWidth, safeHeight);
  const longEdge = Math.max(safeWidth, safeHeight);
  const orientation: ScreenOrientation = safeWidth > safeHeight ? 'landscape' : 'portrait';
  const isTablet = shortEdge >= TABLET_MIN_SHORT_EDGE && safeWidth >= TABLET_MIN_WIDTH;
  const isTabletPortrait = isTablet && orientation === 'portrait';
  const isTabletLandscape = isTablet && orientation === 'landscape';
  const isPhoneLandscape = !isTablet && orientation === 'landscape';
  const isCompactPhone = !isTablet && shortEdge < COMPACT_PHONE_WIDTH;
  const isCompactHeight = safeHeight < COMPACT_VIEWPORT_HEIGHT;

  let deviceClass: DeviceClass;
  if (isTabletLandscape) {
    deviceClass = 'tablet-landscape';
  } else if (isTabletPortrait) {
    deviceClass = 'tablet-portrait';
  } else if (isPhoneLandscape) {
    deviceClass = 'phone-landscape';
  } else if (isCompactPhone) {
    deviceClass = 'small-phone';
  } else {
    deviceClass = 'phone';
  }

  return {
    width: safeWidth,
    height: safeHeight,
    shortEdge,
    longEdge,
    orientation,
    isTablet,
    isTabletPortrait,
    isTabletLandscape,
    isPhoneLandscape,
    isCompactPhone,
    isCompactHeight,
    deviceClass,
  };
}

// ---------------------------------------------------------------- Home layout

export type HomeLayout = {
  profile: ViewportProfile;
  gutter: number;
  paddingLeft: number;
  paddingRight: number;
  paddingBottom: number;
  columns: number;
  cardGap: number;
  cardWidth: number;
  twoPane: boolean;
  sidebarWidth: number;
  gridAvailableWidth: number;
  customizeModalCentered: boolean;
  customizeModalMaxWidth: number;
};

export function resolveHomeLayout(
  width: number,
  height: number,
  insets: EdgeInsets = ZERO_INSETS,
): HomeLayout {
  const profile = resolveViewportProfile(width, height);
  const gutter = profile.isTablet ? TABLET_GUTTER : PHONE_GUTTER;
  const paddingLeft = gutter + Math.max(0, insets.left);
  const paddingRight = gutter + Math.max(0, insets.right);
  const paddingBottom = spacing.xl + Math.max(0, insets.bottom);
  const cardGap = spacing.md;

  const usableWidth = Math.max(240, profile.width - paddingLeft - paddingRight);
  const twoPane = profile.isTabletLandscape && usableWidth >= 860;
  const sidebarWidth = twoPane ? HOME_TWO_PANE_SIDEBAR_WIDTH : 0;
  const gridAvailableWidth = twoPane
    ? Math.max(320, usableWidth - sidebarWidth - gutter)
    : usableWidth;

  let columns: number;
  if (profile.isTabletPortrait) {
    columns = 4;
  } else if (profile.isTabletLandscape) {
    columns = gridAvailableWidth >= 840 ? 4 : 3;
  } else if (profile.isPhoneLandscape) {
    columns = gridAvailableWidth >= 600 ? 3 : 2;
  } else {
    columns = 2;
  }

  const totalGaps = cardGap * Math.max(0, columns - 1);
  const cardWidth = Math.max(120, Math.floor((gridAvailableWidth - totalGaps) / columns));

  return {
    profile,
    gutter,
    paddingLeft,
    paddingRight,
    paddingBottom,
    columns,
    cardGap,
    cardWidth,
    twoPane,
    sidebarWidth,
    gridAvailableWidth,
    customizeModalCentered: profile.isTablet || profile.isPhoneLandscape,
    customizeModalMaxWidth: TABLET_MODAL_MAX_WIDTH,
  };
}

// -------------------------------------------------------------- Editor layout

export type EditorNavigationMode = 'island' | 'rail';
export type InspectorPresentation = 'hidden' | 'sheet' | 'edge-tab' | 'overlay' | 'docked';
export type ToolOptionsVariant = 'bottom-sheet' | 'rail-popover';

export type EditorLayoutOptions = {
  hasSelection: boolean;
  /**
   * On tablet portrait the inspector starts collapsed to an edge tab; on tablet
   * landscape it starts open when a selection exists unless collapsed by the user.
   */
  inspectorOpen: boolean;
  isEditingText: boolean;
};

export type EditorLayout = {
  profile: ViewportProfile;
  navigationMode: EditorNavigationMode;
  topBarHeight: number;
  railWidth: number;
  inspectorPresentation: InspectorPresentation;
  inspectorWidth: number;
  toolOptionsVariant: ToolOptionsVariant;
  toolPopoverLeft: number;
  toolPopoverTop: number;
  toolPopoverMaxWidth: number;
  canvasMargin: number;
  islandBottom: number;
  optionsBottom: number;
  workspacePaddingLeft: number;
  workspacePaddingRight: number;
  canvasWidth: number;
  canvasHeight: number;
  /** Fraction of the safe workspace width occupied by the canvas (must remain dominant). */
  canvasWidthRatio: number;
};

export function resolveEditorLayout(
  width: number,
  height: number,
  insets: EdgeInsets = ZERO_INSETS,
  options: EditorLayoutOptions = { hasSelection: false, inspectorOpen: false, isEditingText: false },
  actionIslandHeight = 58,
): EditorLayout {
  const profile = resolveViewportProfile(width, height);
  const navigationMode: EditorNavigationMode = profile.isTablet ? 'rail' : 'island';
  const topBarHeight = profile.isCompactHeight ? 48 : 64;
  const railWidth = navigationMode === 'rail' ? TOOL_RAIL_WIDTH : 0;

  let inspectorPresentation: InspectorPresentation;
  if (!profile.isTablet) {
    inspectorPresentation = options.hasSelection && !options.isEditingText ? 'sheet' : 'hidden';
  } else if (!options.hasSelection || options.isEditingText) {
    inspectorPresentation = 'hidden';
  } else if (profile.isTabletLandscape) {
    inspectorPresentation = options.inspectorOpen ? 'docked' : 'edge-tab';
  } else {
    // Tablet portrait keeps the canvas wide by default; the inspector collapses
    // to a right-edge affordance and slides over as an overlay when opened.
    inspectorPresentation = options.inspectorOpen ? 'overlay' : 'edge-tab';
  }

  const dockedInspectorWidth = inspectorPresentation === 'docked' ? INSPECTOR_PANEL_WIDTH : 0;
  const toolOptionsVariant: ToolOptionsVariant = profile.isTablet ? 'rail-popover' : 'bottom-sheet';

  const workspacePaddingLeft = Math.max(0, insets.left);
  const workspacePaddingRight = Math.max(0, insets.right);

  const canvasMargin = profile.isCompactPhone || profile.isCompactHeight
    ? spacing.sm
    : profile.isTablet
      ? spacing.md
      : spacing.sm + 4;

  const islandBottom = Math.max(
    profile.isCompactHeight ? spacing.xs : spacing.md,
    Math.max(0, insets.bottom) + spacing.xs,
  );
  const optionsBottom = profile.isTablet
    ? Math.max(spacing.md, Math.max(0, insets.bottom) + spacing.xs)
    : actionIslandHeight + spacing.sm + islandBottom;

  const safeWorkspaceWidth = Math.max(1, profile.width - workspacePaddingLeft - workspacePaddingRight);
  const safeWorkspaceHeight = Math.max(1, profile.height - Math.max(0, insets.top) - topBarHeight);

  const canvasWidth = Math.max(
    1,
    safeWorkspaceWidth - railWidth - dockedInspectorWidth - canvasMargin * 2,
  );
  const canvasHeight = Math.max(1, safeWorkspaceHeight - canvasMargin * 2);
  const canvasWidthRatio = canvasWidth / safeWorkspaceWidth;

  const toolPopoverLeft = workspacePaddingLeft + railWidth + spacing.md;
  const toolPopoverTop = spacing.md;
  const toolPopoverMaxWidth = Math.min(400, Math.max(260, canvasWidth - spacing.lg));

  return {
    profile,
    navigationMode,
    topBarHeight,
    railWidth,
    inspectorPresentation,
    inspectorWidth: INSPECTOR_PANEL_WIDTH,
    toolOptionsVariant,
    toolPopoverLeft,
    toolPopoverTop,
    toolPopoverMaxWidth,
    canvasMargin,
    islandBottom,
    optionsBottom,
    workspacePaddingLeft,
    workspacePaddingRight,
    canvasWidth,
    canvasHeight,
    canvasWidthRatio,
  };
}

// ------------------------------------------------------- Modal & flow layouts

export type CropToolbarPlacement = 'bottom-bar' | 'right-rail';
export type OcrReviewLayoutMode = 'stacked' | 'two-column';

export type FlowModalLayout = {
  profile: ViewportProfile;
  centeredModal: boolean;
  modalMaxWidth: number;
  wideModalMaxWidth: number;
  imageSourceTwoColumn: boolean;
  cropToolbarPlacement: CropToolbarPlacement;
  cropRailWidth: number;
  ocrLayout: OcrReviewLayoutMode;
};

export function resolveFlowModalLayout(width: number, height: number): FlowModalLayout {
  const profile = resolveViewportProfile(width, height);
  const centeredModal = profile.isTablet || profile.isPhoneLandscape;
  const imageSourceTwoColumn = profile.isTablet || (profile.isPhoneLandscape && profile.width >= 568);
  const cropToolbarPlacement: CropToolbarPlacement =
    profile.orientation === 'landscape' ? 'right-rail' : 'bottom-bar';
  const cropRailWidth = profile.isTablet ? 220 : 148;
  const ocrLayout: OcrReviewLayoutMode =
    profile.isTablet || (profile.orientation === 'landscape' && profile.width >= 660)
      ? 'two-column'
      : 'stacked';

  return {
    profile,
    centeredModal,
    modalMaxWidth: TABLET_MODAL_MAX_WIDTH,
    wideModalMaxWidth: TABLET_WIDE_MODAL_MAX_WIDTH,
    imageSourceTwoColumn,
    cropToolbarPlacement,
    cropRailWidth,
    ocrLayout,
  };
}

// -------------------------------------------------- Keyboard & editing Chrome

/**
 * Hardware keyboards on iPad report 0 height (or only a ~55pt shortcut bar).
 * Only software keyboards that cover a meaningful portion of the screen need a
 * bottom style-sheet offset; on tablet or hardware keyboard the canvas stays put
 * unless the edited object is actually overlapped.
 */
export const SOFTWARE_KEYBOARD_MIN_HEIGHT = 120;

export function isSoftwareKeyboardVisible(keyboardHeight: number): boolean {
  return keyboardHeight >= SOFTWARE_KEYBOARD_MIN_HEIGHT;
}

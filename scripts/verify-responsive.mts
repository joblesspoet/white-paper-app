/// <reference types="node" />

import assert from 'node:assert/strict';

import {
  DOCK_TOUCH_TARGET,
  HOME_TWO_PANE_SIDEBAR_WIDTH,
  INSPECTOR_EDGE_TAB_WIDTH,
  INSPECTOR_PANEL_WIDTH,
  isSoftwareKeyboardVisible,
  MIN_TOUCH_TARGET,
  PHONE_GUTTER,
  resolveEditorLayout,
  resolveFlowModalLayout,
  resolveHomeLayout,
  resolveViewportProfile,
  SETTINGS_TABLET_MAX_WIDTH,
  TABLET_GUTTER,
  TABLET_MODAL_MAX_WIDTH,
  TABLET_WIDE_MODAL_MAX_WIDTH,
  TOOL_RAIL_WIDTH,
  ZERO_INSETS,
  type EdgeInsets,
} from '../src/responsive/layout.ts';
import { keepObjectAboveKeyboard, keyboardOverlap } from '../src/canvas/document.ts';
import { selectionActionRail } from '../src/canvas/selection.ts';

type TargetDeviceSpec = {
  name: string;
  category: 'small-phone' | 'large-phone' | 'android-phone' | 'ipad-portrait' | 'ipad-landscape';
  width: number;
  height: number;
  insets: EdgeInsets;
};

const TARGET_DEVICES: ReadonlyArray<TargetDeviceSpec> = [
  // Small phone
  {
    name: 'iPhone SE 1st gen (320×568)',
    category: 'small-phone',
    width: 320,
    height: 568,
    insets: { top: 20, right: 0, bottom: 0, left: 0 },
  },
  {
    name: 'iPhone SE 3rd gen (375×667)',
    category: 'small-phone',
    width: 375,
    height: 667,
    insets: { top: 20, right: 0, bottom: 0, left: 0 },
  },
  // Large phone (portrait & landscape)
  {
    name: 'iPhone 16 Pro Max portrait (430×932)',
    category: 'large-phone',
    width: 430,
    height: 932,
    insets: { top: 59, right: 0, bottom: 34, left: 0 },
  },
  {
    name: 'iPhone 16 Pro Max landscape (932×430)',
    category: 'large-phone',
    width: 932,
    height: 430,
    insets: { top: 0, right: 59, bottom: 21, left: 59 },
  },
  // Android phone (portrait & landscape)
  {
    name: 'Android compact portrait (360×800)',
    category: 'android-phone',
    width: 360,
    height: 800,
    insets: { top: 24, right: 0, bottom: 16, left: 0 },
  },
  {
    name: 'Pixel 8 portrait (412×915)',
    category: 'android-phone',
    width: 412,
    height: 915,
    insets: { top: 28, right: 0, bottom: 24, left: 0 },
  },
  {
    name: 'Pixel 8 landscape (915×412)',
    category: 'android-phone',
    width: 915,
    height: 412,
    insets: { top: 0, right: 24, bottom: 16, left: 28 },
  },
  // iPad portrait
  {
    name: 'iPad mini / 9th gen portrait (768×1024)',
    category: 'ipad-portrait',
    width: 768,
    height: 1024,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  },
  {
    name: 'iPad Air 11" portrait (820×1180)',
    category: 'ipad-portrait',
    width: 820,
    height: 1180,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  },
  {
    name: 'iPad Pro 11" portrait (834×1194)',
    category: 'ipad-portrait',
    width: 834,
    height: 1194,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  },
  // iPad landscape
  {
    name: 'iPad mini / 9th gen landscape (1024×768)',
    category: 'ipad-landscape',
    width: 1024,
    height: 768,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  },
  {
    name: 'iPad Air 11" landscape (1180×820)',
    category: 'ipad-landscape',
    width: 1180,
    height: 820,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  },
  {
    name: 'iPad Pro 12.9" landscape (1366×1024)',
    category: 'ipad-landscape',
    width: 1366,
    height: 1024,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  },
];

function testTouchTargetConstants(): void {
  assert.ok(MIN_TOUCH_TARGET >= 44, 'Minimum touch target must be at least 44pt');
  assert.ok(DOCK_TOUCH_TARGET >= 48, 'Dock/rail touch target must be at least 48pt');
  assert.ok(INSPECTOR_EDGE_TAB_WIDTH >= 44, 'Inspector edge tab must be at least 44pt wide');
  assert.equal(SETTINGS_TABLET_MAX_WIDTH, 640);
  assert.equal(PHONE_GUTTER, 16);
  assert.equal(TABLET_GUTTER, 32);
}

function testViewportClassification(): void {
  // Small phone
  const se1 = resolveViewportProfile(320, 568);
  assert.equal(se1.isTablet, false);
  assert.equal(se1.isCompactPhone, true);
  assert.equal(se1.deviceClass, 'small-phone');
  assert.equal(se1.orientation, 'portrait');

  // Standard phone
  const phone = resolveViewportProfile(390, 844);
  assert.equal(phone.isTablet, false);
  assert.equal(phone.isCompactPhone, false);
  assert.equal(phone.deviceClass, 'phone');

  // Large phone in landscape MUST NOT be classified as a tablet despite width >= 768
  const phoneLandscape = resolveViewportProfile(932, 430);
  assert.equal(phoneLandscape.isTablet, false);
  assert.equal(phoneLandscape.isPhoneLandscape, true);
  assert.equal(phoneLandscape.isCompactHeight, true);
  assert.equal(phoneLandscape.deviceClass, 'phone-landscape');

  // Android phone in landscape (915×412) MUST NOT be classified as a tablet
  const androidLandscape = resolveViewportProfile(915, 412);
  assert.equal(androidLandscape.isTablet, false);
  assert.equal(androidLandscape.isPhoneLandscape, true);
  assert.equal(androidLandscape.deviceClass, 'phone-landscape');

  // iPad Split View compact window (507×768) falls back to compact phone-style layout
  const splitView = resolveViewportProfile(507, 768);
  assert.equal(splitView.isTablet, false);
  assert.equal(splitView.deviceClass, 'phone');

  // iPad portrait
  const ipadPortrait = resolveViewportProfile(820, 1180);
  assert.equal(ipadPortrait.isTablet, true);
  assert.equal(ipadPortrait.isTabletPortrait, true);
  assert.equal(ipadPortrait.isTabletLandscape, false);
  assert.equal(ipadPortrait.deviceClass, 'tablet-portrait');

  // iPad landscape
  const ipadLandscape = resolveViewportProfile(1180, 820);
  assert.equal(ipadLandscape.isTablet, true);
  assert.equal(ipadLandscape.isTabletPortrait, false);
  assert.equal(ipadLandscape.isTabletLandscape, true);
  assert.equal(ipadLandscape.deviceClass, 'tablet-landscape');
}

function testHomeResponsiveLayout(): void {
  for (const device of TARGET_DEVICES) {
    const home = resolveHomeLayout(device.width, device.height, device.insets);

    // Safe area horizontal insets are always respected
    assert.ok(home.paddingLeft >= device.insets.left + (home.profile.isTablet ? TABLET_GUTTER : PHONE_GUTTER));
    assert.ok(home.paddingRight >= device.insets.right + (home.profile.isTablet ? TABLET_GUTTER : PHONE_GUTTER));

    // Card widths are bounded and never stretch a partial row across the screen
    assert.ok(home.cardWidth >= 120, `${device.name}: cardWidth (${home.cardWidth}) must be usable`);
    assert.ok(home.cardWidth <= 360, `${device.name}: cardWidth (${home.cardWidth}) must not stretch excessively`);

    const totalGridRowWidth =
      home.columns * home.cardWidth + (home.columns - 1) * home.cardGap;
    assert.ok(
      totalGridRowWidth <= home.gridAvailableWidth + 1,
      `${device.name}: grid row (${totalGridRowWidth}) must fit inside available width (${home.gridAvailableWidth})`,
    );

    if (device.category === 'ipad-portrait') {
      assert.equal(home.gutter, TABLET_GUTTER);
      assert.equal(home.twoPane, false);
      assert.equal(home.columns, 4, `${device.name} should use a 4-column board grid`);
      assert.equal(home.customizeModalCentered, true);
      assert.equal(home.customizeModalMaxWidth, TABLET_MODAL_MAX_WIDTH);
    } else if (device.category === 'ipad-landscape') {
      assert.equal(home.gutter, TABLET_GUTTER);
      assert.equal(home.twoPane, true, `${device.name} should enable two-pane layout`);
      assert.equal(home.sidebarWidth, HOME_TWO_PANE_SIDEBAR_WIDTH);
      assert.ok(home.columns >= 3 && home.columns <= 4);
      assert.equal(home.customizeModalCentered, true);
    } else {
      assert.equal(home.gutter, PHONE_GUTTER);
      assert.equal(home.twoPane, false);
      if (device.width > device.height) {
        assert.ok(home.columns >= 2 && home.columns <= 3);
        assert.equal(home.customizeModalCentered, true);
      } else {
        assert.equal(home.columns, 2);
        assert.equal(home.customizeModalCentered, false);
      }
    }
  }
}

function testEditorResponsiveLayoutAndCanvasDominance(): void {
  for (const device of TARGET_DEVICES) {
    // 1. No selection
    const idleLayout = resolveEditorLayout(device.width, device.height, device.insets, {
      hasSelection: false,
      inspectorOpen: false,
      isEditingText: false,
    });

    assert.ok(idleLayout.canvasWidth > 0, `${device.name}: canvasWidth must be positive`);
    assert.ok(idleLayout.canvasHeight > 0, `${device.name}: canvasHeight must be positive`);
    assert.ok(
      idleLayout.canvasWidthRatio >= 0.72,
      `${device.name}: idle canvasWidthRatio (${idleLayout.canvasWidthRatio.toFixed(2)}) must dominate viewport`,
    );

    // 2. Active selection with inspector open
    const selectedOpenLayout = resolveEditorLayout(device.width, device.height, device.insets, {
      hasSelection: true,
      inspectorOpen: true,
      isEditingText: false,
    });

    // Even with docked inspector on iPad landscape, canvas remains the dominant surface (>= 60% width)
    assert.ok(
      selectedOpenLayout.canvasWidthRatio >= 0.6,
      `${device.name}: selected canvasWidthRatio (${selectedOpenLayout.canvasWidthRatio.toFixed(2)}) must remain dominant`,
    );

    // 3. Active selection with inspector collapsed
    const selectedCollapsedLayout = resolveEditorLayout(device.width, device.height, device.insets, {
      hasSelection: true,
      inspectorOpen: false,
      isEditingText: false,
    });

    if (device.category === 'ipad-landscape') {
      assert.equal(idleLayout.navigationMode, 'rail');
      assert.equal(idleLayout.railWidth, TOOL_RAIL_WIDTH);
      assert.equal(idleLayout.toolOptionsVariant, 'rail-popover');
      assert.equal(selectedOpenLayout.inspectorPresentation, 'docked');
      assert.equal(selectedOpenLayout.inspectorWidth, INSPECTOR_PANEL_WIDTH);
      assert.equal(selectedCollapsedLayout.inspectorPresentation, 'edge-tab');
    } else if (device.category === 'ipad-portrait') {
      assert.equal(idleLayout.navigationMode, 'rail');
      assert.equal(idleLayout.railWidth, TOOL_RAIL_WIDTH);
      assert.equal(idleLayout.toolOptionsVariant, 'rail-popover');
      assert.equal(selectedOpenLayout.inspectorPresentation, 'overlay');
      assert.equal(selectedOpenLayout.inspectorWidth, INSPECTOR_PANEL_WIDTH);
      assert.equal(selectedCollapsedLayout.inspectorPresentation, 'edge-tab');
      // Portrait overlay does not shrink the underlying canvas width
      assert.equal(selectedOpenLayout.canvasWidth, idleLayout.canvasWidth);
    } else {
      // Phones (both portrait and landscape) use bottom ActionIsland so vertical tool rail never clips
      assert.equal(idleLayout.navigationMode, 'island', `${device.name} should use island navigation`);
      assert.equal(idleLayout.railWidth, 0);
      assert.equal(idleLayout.toolOptionsVariant, 'bottom-sheet');
      assert.equal(selectedOpenLayout.inspectorPresentation, 'sheet');
    }
  }
}

function testOrientationTransitions(): void {
  // Simulate rotating an iPad Air between portrait (820×1180) and landscape (1180×820)
  const portraitHome = resolveHomeLayout(820, 1180, ZERO_INSETS);
  const landscapeHome = resolveHomeLayout(1180, 820, ZERO_INSETS);
  assert.equal(portraitHome.twoPane, false);
  assert.equal(portraitHome.columns, 4);
  assert.equal(landscapeHome.twoPane, true);
  assert.equal(landscapeHome.columns, 3);

  const portraitEditor = resolveEditorLayout(820, 1180, ZERO_INSETS, {
    hasSelection: true,
    inspectorOpen: true,
    isEditingText: false,
  });
  const landscapeEditor = resolveEditorLayout(1180, 820, ZERO_INSETS, {
    hasSelection: true,
    inspectorOpen: true,
    isEditingText: false,
  });
  assert.equal(portraitEditor.inspectorPresentation, 'overlay');
  assert.equal(landscapeEditor.inspectorPresentation, 'docked');

  // Simulate rotating a large phone between portrait (430×932) and landscape (932×430)
  const phonePortraitEditor = resolveEditorLayout(
    430,
    932,
    { top: 59, right: 0, bottom: 34, left: 0 },
    { hasSelection: false, inspectorOpen: false, isEditingText: false },
  );
  const phoneLandscapeEditor = resolveEditorLayout(
    932,
    430,
    { top: 0, right: 59, bottom: 21, left: 59 },
    { hasSelection: false, inspectorOpen: false, isEditingText: false },
  );
  assert.equal(phonePortraitEditor.navigationMode, 'island');
  assert.equal(phoneLandscapeEditor.navigationMode, 'island');
  assert.equal(phonePortraitEditor.topBarHeight, 64);
  assert.equal(phoneLandscapeEditor.topBarHeight, 48);
}

function testModalAndFlowLayouts(): void {
  // Phone portrait -> bottom sheets, stacked OCR, bottom crop toolbar
  const phoneFlow = resolveFlowModalLayout(390, 844);
  assert.equal(phoneFlow.centeredModal, false);
  assert.equal(phoneFlow.imageSourceTwoColumn, false);
  assert.equal(phoneFlow.cropToolbarPlacement, 'bottom-bar');
  assert.equal(phoneFlow.ocrLayout, 'stacked');

  // Phone landscape -> centered modal, right-rail crop toolbar, two-column OCR on wide phones
  const phoneLandscapeFlow = resolveFlowModalLayout(932, 430);
  assert.equal(phoneLandscapeFlow.centeredModal, true);
  assert.equal(phoneLandscapeFlow.modalMaxWidth, TABLET_MODAL_MAX_WIDTH);
  assert.equal(phoneLandscapeFlow.cropToolbarPlacement, 'right-rail');
  assert.equal(phoneLandscapeFlow.ocrLayout, 'two-column');

  // iPad portrait -> centered modal, two-column image source, two-column OCR
  const ipadPortraitFlow = resolveFlowModalLayout(820, 1180);
  assert.equal(ipadPortraitFlow.centeredModal, true);
  assert.equal(ipadPortraitFlow.wideModalMaxWidth, TABLET_WIDE_MODAL_MAX_WIDTH);
  assert.equal(ipadPortraitFlow.imageSourceTwoColumn, true);
  assert.equal(ipadPortraitFlow.cropToolbarPlacement, 'bottom-bar');
  assert.equal(ipadPortraitFlow.ocrLayout, 'two-column');

  // iPad landscape -> centered modal, two-column image source, right-rail crop toolbar, two-column OCR
  const ipadLandscapeFlow = resolveFlowModalLayout(1180, 820);
  assert.equal(ipadLandscapeFlow.centeredModal, true);
  assert.equal(ipadLandscapeFlow.imageSourceTwoColumn, true);
  assert.equal(ipadLandscapeFlow.cropToolbarPlacement, 'right-rail');
  assert.equal(ipadLandscapeFlow.ocrLayout, 'two-column');
}

function testKeyboardAndSelectionClampingAcrossTargetSizes(): void {
  // Hardware keyboard accessory bar (~44pt) vs full software keyboard (>= 120pt)
  assert.equal(isSoftwareKeyboardVisible(0), false);
  assert.equal(isSoftwareKeyboardVisible(44), false);
  assert.equal(isSoftwareKeyboardVisible(55), false);
  assert.equal(isSoftwareKeyboardVisible(260), true);
  assert.equal(isSoftwareKeyboardVisible(340), true);

  for (const device of TARGET_DEVICES) {
    const editor = resolveEditorLayout(device.width, device.height, device.insets, {
      hasSelection: true,
      inspectorOpen: false,
      isEditingText: true,
    });

    const canvasRect = {
      x: device.insets.left + editor.railWidth + editor.canvasMargin,
      y: device.insets.top + editor.topBarHeight + editor.canvasMargin,
      width: editor.canvasWidth,
      height: editor.canvasHeight,
    };

    // Simulate an object near the bottom of the canvas covered by a software keyboard
    const simulatedKeyboardHeight = device.width > device.height ? 220 : 300;
    const overlap = keyboardOverlap(simulatedKeyboardHeight, canvasRect, device.height);
    assert.ok(overlap > 0, `${device.name}: software keyboard should overlap canvas`);

    const objectNearBottom = {
      x: canvasRect.x + 40,
      y: canvasRect.y + canvasRect.height - 60,
      width: 160,
      height: 110,
    };
    const currentViewport = { x: 100, y: -50, scale: 1.5 };
    const shiftedViewport = keepObjectAboveKeyboard({
      object: objectNearBottom,
      canvas: canvasRect,
      viewport: currentViewport,
      bottomInset: overlap + 16,
    });
    assert.ok(
      shiftedViewport.y < currentViewport.y,
      `${device.name}: keepObjectAboveKeyboard must pan viewport upward when object is covered`,
    );

    // Selection action rail must stay inside canvas bounds even near edges on small phones & tablets
    const railNearRightEdge = selectionActionRail(
      { x: editor.canvasWidth - 30, y: editor.canvasHeight - 30, width: 80, height: 80 },
      4,
      editor.canvasWidth,
      editor.canvasHeight,
    );
    assert.ok(railNearRightEdge.x >= 0, `${device.name}: selection rail x >= 0`);
    assert.ok(railNearRightEdge.y >= 0, `${device.name}: selection rail y >= 0`);
    assert.ok(
      railNearRightEdge.x + railNearRightEdge.width <= editor.canvasWidth,
      `${device.name}: selection rail fits horizontally inside canvas`,
    );
    assert.ok(
      railNearRightEdge.y + railNearRightEdge.height <= editor.canvasHeight,
      `${device.name}: selection rail fits vertically inside canvas`,
    );
  }
}

function main(): void {
  testTouchTargetConstants();
  testViewportClassification();
  testHomeResponsiveLayout();
  testEditorResponsiveLayoutAndCanvasDominance();
  testOrientationTransitions();
  testModalAndFlowLayouts();
  testKeyboardAndSelectionClampingAcrossTargetSizes();
  console.log(
    `responsive checks passed across ${TARGET_DEVICES.length} target device profiles (small phone, large phone, Android phone, iPad portrait, iPad landscape)`,
  );
}

main();

/**
 * Magnetic object connectors, port snapping, and `+` quick-branching helpers.
 *
 * Pure canvas-coordinate geometry kept free of React Native imports so it can
 * be shared across live Skia rendering, gesture snapping, `applyCommand`,
 * offscreen exports, and Node verification scripts.
 */

import type {
  CanvasObject,
  ConnectorObject,
  ShapeObject,
  StickyObject,
} from './document.ts';
import {
  DEFAULT_CONNECTOR_STROKE_WIDTH,
  DEFAULT_SHAPE_STROKE_WIDTH,
  geometryFromPoints,
  linePoints,
} from './shapes.ts';
import type { Point } from './viewport.ts';

const CONNECTOR_DEFAULT_COLOR = 'ink';
const CONNECTOR_DEFAULT_STYLE = 'arrow';
const SHAPE_DEFAULT_COLOR = 'ink';
const STICKY_DEFAULT_COLOR = 'butter';
const STICKY_DEFAULT_SIZE = 112;
const STICKY_DEFAULT_FONT_SIZE = 16;

function rotatePointLocal(point: Point, centre: Point, degrees: number): Point {
  if (degrees === 0) return point;
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  return {
    x: centre.x + dx * cos - dy * sin,
    y: centre.y + dx * sin + dy * cos,
  };
}

export type PortSide = 'top' | 'right' | 'bottom' | 'left' | 'center';
export type CardinalDirection = 'top' | 'right' | 'bottom' | 'left';

export type ConnectorBinding = {
  objectId: string;
  port: PortSide;
};

export type PortCandidate = {
  objectId: string;
  port: CardinalDirection;
  point: Point;
  distanceScreen: number;
};

export const CONNECTOR_SNAP_THRESHOLD_SCREEN = 24;
export const QUICK_BRANCH_GAP = 80;
export const CARDINAL_PORTS: readonly CardinalDirection[] = ['top', 'right', 'bottom', 'left'];

export function isValidPortSide(value: unknown): value is PortSide {
  return (
    value === 'top' ||
    value === 'right' ||
    value === 'bottom' ||
    value === 'left' ||
    value === 'center'
  );
}

export function isBindableObject(object: CanvasObject): boolean {
  return object.type !== 'connector';
}

export function oppositePort(direction: CardinalDirection): CardinalDirection {
  switch (direction) {
    case 'top':
      return 'bottom';
    case 'right':
      return 'left';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
  }
}

/**
 * Computes the world-space canvas coordinates of an object's port, taking its
 * rotation around its centre into account.
 */
export function getObjectPortPoint(object: CanvasObject, port: PortSide): Point {
  const centre: Point = {
    x: object.x + object.width / 2,
    y: object.y + object.height / 2,
  };
  let local: Point;
  switch (port) {
    case 'top':
      local = { x: centre.x, y: object.y };
      break;
    case 'right':
      local = { x: object.x + object.width, y: centre.y };
      break;
    case 'bottom':
      local = { x: centre.x, y: object.y + object.height };
      break;
    case 'left':
      local = { x: object.x, y: centre.y };
      break;
    case 'center':
    default:
      local = centre;
      break;
  }
  return object.rotation === 0 ? local : rotatePointLocal(local, centre, object.rotation);
}

export function getAllObjectPorts(
  object: CanvasObject,
): ReadonlyArray<{ port: CardinalDirection; point: Point }> {
  return CARDINAL_PORTS.map((port) => ({
    port,
    point: getObjectPortPoint(object, port),
  }));
}

/**
 * Finds the nearest cardinal port across bindable objects within
 * `thresholdScreen` screen points of `canvasPoint`.
 */
export function findNearestPortSnap(
  objects: readonly CanvasObject[],
  canvasPoint: Point,
  scale: number,
  thresholdScreen = CONNECTOR_SNAP_THRESHOLD_SCREEN,
  excludeObjectIds?: ReadonlySet<string>,
): PortCandidate | null {
  const safeScale = Math.max(0.1, scale);
  let best: PortCandidate | null = null;

  for (const object of objects) {
    if (!isBindableObject(object) || object.locked) continue;
    if (excludeObjectIds?.has(object.id)) continue;

    for (const { port, point } of getAllObjectPorts(object)) {
      const distScreen = Math.hypot(canvasPoint.x - point.x, canvasPoint.y - point.y) * safeScale;
      if (distScreen <= thresholdScreen && (!best || distScreen < best.distanceScreen)) {
        best = {
          objectId: object.id,
          port,
          point,
          distanceScreen: distScreen,
        };
      }
    }
  }

  return best;
}

/**
 * Recomputes a connector's box and direction from its `startBinding` and
 * `endBinding`. Returns the exact same connector reference if nothing changed.
 */
export function recomputeBoundConnector(
  connector: ConnectorObject,
  objectById: ReadonlyMap<string, CanvasObject>,
): ConnectorObject {
  if (!connector.startBinding && !connector.endBinding) {
    return connector;
  }

  const currentPoints = linePoints(
    connector.x,
    connector.y,
    connector.width,
    connector.height,
    connector.direction,
  );

  let nextStart = currentPoints.start;
  let nextEnd = currentPoints.end;
  let nextStartBinding = connector.startBinding;
  let nextEndBinding = connector.endBinding;

  if (connector.startBinding) {
    const target = objectById.get(connector.startBinding.objectId);
    if (target) {
      nextStart = getObjectPortPoint(target, connector.startBinding.port);
    } else {
      nextStartBinding = undefined;
    }
  }

  if (connector.endBinding) {
    const target = objectById.get(connector.endBinding.objectId);
    if (target) {
      nextEnd = getObjectPortPoint(target, connector.endBinding.port);
    } else {
      nextEndBinding = undefined;
    }
  }

  const geometry = geometryFromPoints(nextStart, nextEnd);
  const bindingsUnchanged =
    nextStartBinding === connector.startBinding && nextEndBinding === connector.endBinding;
  const geometryUnchanged =
    geometry.x === connector.x &&
    geometry.y === connector.y &&
    geometry.width === connector.width &&
    geometry.height === connector.height &&
    geometry.direction === connector.direction;

  if (bindingsUnchanged && geometryUnchanged) {
    return connector;
  }

  const updated: ConnectorObject = {
    ...connector,
    ...geometry,
  };
  if (nextStartBinding) {
    updated.startBinding = nextStartBinding;
  } else {
    delete updated.startBinding;
  }
  if (nextEndBinding) {
    updated.endBinding = nextEndBinding;
  } else {
    delete updated.endBinding;
  }
  return updated;
}

/**
 * Propagates geometry updates from modified objects to any connectors bound to them.
 */
export function propagateBoundConnectors(
  objects: readonly CanvasObject[],
  changedIds: ReadonlySet<string> | 'all',
): CanvasObject[] {
  if (changedIds !== 'all' && changedIds.size === 0) {
    return objects as CanvasObject[];
  }
  const objectById = new Map(objects.map((obj) => [obj.id, obj]));
  let anyChanged = false;

  const next = objects.map((obj) => {
    if (obj.type !== 'connector') return obj;
    const startMatch =
      changedIds === 'all' || (obj.startBinding ? changedIds.has(obj.startBinding.objectId) : false);
    const endMatch =
      changedIds === 'all' || (obj.endBinding ? changedIds.has(obj.endBinding.objectId) : false);
    if (!startMatch && !endMatch) return obj;
    const updated = recomputeBoundConnector(obj, objectById);
    if (updated !== obj) anyChanged = true;
    return updated;
  });

  return anyChanged ? next : (objects as CanvasObject[]);
}

export function canQuickBranchObject(object: CanvasObject): object is StickyObject | ShapeObject {
  return (object.type === 'sticky' || object.type === 'shape') && !object.locked;
}

export type QuickBranchSpec = {
  child: StickyObject | ShapeObject;
  connector: ConnectorObject;
};

/**
 * Builds a child sticky note or shape `QUICK_BRANCH_GAP` (80) canvas units
 * away from `source` in `direction`, plus a bound arrow `ConnectorObject`.
 */
export function buildQuickBranchSpec(input: {
  source: StickyObject | ShapeObject;
  direction: CardinalDirection;
  newNodeId: string;
  newConnectorId: string;
  gap?: number;
  connectorColorKey?: string;
}): QuickBranchSpec {
  const { source, direction, newNodeId, newConnectorId, gap = QUICK_BRANCH_GAP } = input;
  const childWidth = source.type === 'sticky' ? STICKY_DEFAULT_SIZE : Math.max(64, source.width);
  const childHeight = source.type === 'sticky' ? STICKY_DEFAULT_SIZE : Math.max(48, source.height);

  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;

  let childX: number;
  let childY: number;

  switch (direction) {
    case 'top':
      childX = Math.round(sourceCenterX - childWidth / 2);
      childY = Math.round(source.y - gap - childHeight);
      break;
    case 'right':
      childX = Math.round(source.x + source.width + gap);
      childY = Math.round(sourceCenterY - childHeight / 2);
      break;
    case 'bottom':
      childX = Math.round(sourceCenterX - childWidth / 2);
      childY = Math.round(source.y + source.height + gap);
      break;
    case 'left':
      childX = Math.round(source.x - gap - childWidth);
      childY = Math.round(sourceCenterY - childHeight / 2);
      break;
  }

  const child: StickyObject | ShapeObject =
    source.type === 'sticky'
      ? {
          id: newNodeId,
          type: 'sticky',
          text: '',
          x: childX,
          y: childY,
          width: childWidth,
          height: childHeight,
          rotation: 0,
          colorKey: source.colorKey ?? STICKY_DEFAULT_COLOR,
          fontSize: source.fontSize ?? STICKY_DEFAULT_FONT_SIZE,
          fontWeight: source.fontWeight ?? 'normal',
          fontStyle: source.fontStyle ?? 'normal',
        }
      : {
          id: newNodeId,
          type: 'shape',
          shape: source.shape === 'line' ? 'rounded-rectangle' : source.shape,
          x: childX,
          y: childY,
          width: childWidth,
          height: childHeight,
          direction: 'tlbr',
          rotation: 0,
          colorKey: source.colorKey ?? SHAPE_DEFAULT_COLOR,
          fillKey: source.fillKey ?? null,
          strokeWidth: source.strokeWidth ?? DEFAULT_SHAPE_STROKE_WIDTH,
        };

  const endPort = oppositePort(direction);
  const startPoint = getObjectPortPoint(source, direction);
  const endPoint = getObjectPortPoint(child, endPort);

  const connector: ConnectorObject = {
    id: newConnectorId,
    type: 'connector',
    style: CONNECTOR_DEFAULT_STYLE,
    ...geometryFromPoints(startPoint, endPoint),
    rotation: 0,
    colorKey: input.connectorColorKey ?? CONNECTOR_DEFAULT_COLOR,
    strokeWidth: DEFAULT_CONNECTOR_STROKE_WIDTH,
    startBinding: { objectId: source.id, port: direction },
    endBinding: { objectId: child.id, port: endPort },
  };

  return { child, connector };
}

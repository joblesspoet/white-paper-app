/**
 * Safe mathematical AST parser, curve sampler, key-point solver, and tangent
 * preview engine for `FunctionPlotObject` canvas objects.
 *
 * Pure TypeScript (zero `eval()`, zero React Native imports) so it is shared
 * across live Skia rendering, interactive parameter sliders, offscreen PNG/PDF
 * exports, and Node verification scripts.
 */

import type { Point } from './viewport.ts';

export type PlotDomain = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export const DEFAULT_PLOT_DOMAIN: PlotDomain = {
  xMin: -6,
  xMax: 6,
  yMin: -6,
  yMax: 6,
};

export const PLOT_PARAMETER_NAMES = ['a', 'b', 'c', 'k'] as const;
export type PlotParameterName = (typeof PLOT_PARAMETER_NAMES)[number];

export const DEFAULT_PLOT_WIDTH = 280;
export const DEFAULT_PLOT_HEIGHT = 240;
export const DEFAULT_PLOT_SAMPLE_COUNT = 120;

export type FunctionPlotObjectBase = {
  type: 'function-plot';
  latex: string;
  expression: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  params: Record<string, number>;
  parameterNames: string[];
  showKeyPoints: boolean;
  showTangent: boolean;
  tangentX: number;
  colorKey: string;
  sourceMathId?: string;
};

// ------------------------------------------------------------------ AST & lexer

export type MathAstNode =
  | { kind: 'number'; value: number }
  | { kind: 'var'; name: string }
  | { kind: 'unary'; op: '+' | '-'; arg: MathAstNode }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: MathAstNode; right: MathAstNode }
  | { kind: 'call'; fn: SupportedFn; arg: MathAstNode };

type SupportedFn = 'sin' | 'cos' | 'tan' | 'sqrt' | 'abs' | 'ln' | 'log' | 'exp';

const SUPPORTED_FNS = new Set<SupportedFn>([
  'sin',
  'cos',
  'tan',
  'sqrt',
  'abs',
  'ln',
  'log',
  'exp',
]);

const BUILTIN_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

const KNOWN_PARAMS = new Set<string>(['a', 'b', 'c', 'k', 'm']);

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { type: 'lparen' }
  | { type: 'rparen' };

function replaceBalancedCommand(
  input: string,
  command: string,
  replacer: (groups: string[]) => string,
  argCount: number,
): string {
  let out = input;
  let guard = 0;
  while (guard < 32) {
    guard += 1;
    const idx = out.indexOf(command);
    if (idx === -1) break;
    let cursor = idx + command.length;
    const groups: string[] = [];
    let valid = true;

    for (let g = 0; g < argCount; g += 1) {
      while (cursor < out.length && out[cursor] === ' ') cursor += 1;
      if (out[cursor] !== '{') {
        valid = false;
        break;
      }
      let depth = 0;
      const start = cursor + 1;
      let end = -1;
      while (cursor < out.length) {
        if (out[cursor] === '{') depth += 1;
        else if (out[cursor] === '}') {
          depth -= 1;
          if (depth === 0) {
            end = cursor;
            cursor += 1;
            break;
          }
        }
        cursor += 1;
      }
      if (end === -1) {
        valid = false;
        break;
      }
      groups.push(out.slice(start, end));
    }

    if (!valid) break;
    out = out.slice(0, idx) + replacer(groups) + out.slice(cursor);
  }
  return out;
}

/**
 * Converts a LaTeX-subset formula into a normalized algebraic expression string
 * (stripping an optional LHS like `y =` or `f(x) =`).
 */
export function normalizeMathExpression(rawLatex: string): {
  expression: string;
  hasSingleVariableLhs: boolean;
} {
  let text = rawLatex.trim();

  // Strip optional LHS: `y = ...`, `f(x) = ...`, `g(x) = ...`, `h(x) = ...`
  let hasSingleVariableLhs = true;
  const eqIndex = text.indexOf('=');
  if (eqIndex !== -1) {
    const lhs = text.slice(0, eqIndex).replace(/\\,/g, '').replace(/\s+/g, '');
    if (lhs === 'y' || /^[fgh]\(x\)$/i.test(lhs)) {
      text = text.slice(eqIndex + 1).trim();
    } else {
      hasSingleVariableLhs = false;
    }
  }

  text = text
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\left\|/g, '|')
    .replace(/\\right\|/g, '|')
    .replace(/\\cdot/g, '*')
    .replace(/\\times/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\pi\b/g, ' pi ')
    .replace(/\\theta\b/g, ' x ')
    .replace(/\\sin\b/g, ' sin ')
    .replace(/\\cos\b/g, ' cos ')
    .replace(/\\tan\b/g, ' tan ')
    .replace(/\\ln\b/g, ' ln ')
    .replace(/\\log\b/g, ' log ')
    .replace(/\\exp\b/g, ' exp ')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, ' pi ');

  text = replaceBalancedCommand(text, '\\frac', ([num, den]) => `((${num})/(${den}))`, 2);
  text = replaceBalancedCommand(text, '\\sqrt', ([rad]) => `sqrt(${rad})`, 1);

  // Convert remaining `{...}` (e.g., `x^{2}` or `e^{-x}`) to `(...)`
  text = text.replace(/\{/g, '(').replace(/\}/g, ')');

  // Convert simple `|...|` into `abs(...)`
  while (/\|[^|]+\|/.test(text)) {
    text = text.replace(/\|([^|]+)\|/g, 'abs($1)');
  }

  return { expression: text.trim(), hasSingleVariableLhs };
}

function tokenize(expression: string): Token[] | null {
  const rawTokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let end = i;
      let dots = 0;
      while (end < expression.length && /[0-9.]/.test(expression[end])) {
        if (expression[end] === '.') dots += 1;
        if (dots > 1) return null;
        end += 1;
      }
      const num = Number(expression.slice(i, end));
      if (!Number.isFinite(num)) return null;
      rawTokens.push({ type: 'number', value: num });
      i = end;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let end = i;
      while (end < expression.length && /[a-zA-Z]/.test(expression[end])) {
        end += 1;
      }
      const word = expression.slice(i, end).toLowerCase();
      if (SUPPORTED_FNS.has(word as SupportedFn) || word === 'pi') {
        rawTokens.push({ type: 'ident', value: word });
      } else {
        // Split run like `ax` or `bx` into single-letter tokens `a`, `x`
        for (const letter of word) {
          rawTokens.push({ type: 'ident', value: letter });
        }
      }
      i = end;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      rawTokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }
    if (ch === '(') {
      rawTokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      rawTokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }
    return null;
  }

  // Insert implicit `*` where needed: `2x`, `ax`, `2(x)`, `(x)(y)`, `x sin(x)`
  const tokens: Token[] = [];
  for (let idx = 0; idx < rawTokens.length; idx += 1) {
    const cur = rawTokens[idx];
    const prev = tokens[tokens.length - 1];
    if (prev) {
      const prevIsValue =
        prev.type === 'number' ||
        prev.type === 'rparen' ||
        (prev.type === 'ident' && !SUPPORTED_FNS.has(prev.value as SupportedFn));
      const curStartsValue =
        cur.type === 'number' || cur.type === 'ident' || cur.type === 'lparen';
      if (prevIsValue && curStartsValue) {
        tokens.push({ type: 'op', value: '*' });
      }
    }
    tokens.push(cur);
  }

  return tokens;
}

export function parseMathAst(expression: string): MathAstNode | null {
  const tokens = tokenize(expression);
  if (!tokens || tokens.length === 0) return null;
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const consume = (): Token | undefined => {
    const t = tokens[pos];
    pos += 1;
    return t;
  };

  function parseExpression(): MathAstNode | null {
    let left = parseTerm();
    if (!left) return null;
    while (peek()?.type === 'op' && (peek() as { type: 'op'; value: string }).value.match(/^[+-]$/)) {
      const op = (consume() as { type: 'op'; value: '+' | '-' }).value;
      const right = parseTerm();
      if (!right) return null;
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  function parseTerm(): MathAstNode | null {
    let left = parsePower();
    if (!left) return null;
    while (peek()?.type === 'op' && (peek() as { type: 'op'; value: string }).value.match(/^[*/]$/)) {
      const op = (consume() as { type: 'op'; value: '*' | '/' }).value;
      const right = parsePower();
      if (!right) return null;
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  function parsePower(): MathAstNode | null {
    const base = parseUnary();
    if (!base) return null;
    if (peek()?.type === 'op' && (peek() as { type: 'op'; value: string }).value === '^') {
      consume();
      const exponent = parsePower();
      if (!exponent) return null;
      return { kind: 'binary', op: '^', left: base, right: exponent };
    }
    return base;
  }

  function parseUnary(): MathAstNode | null {
    const next = peek();
    if (next?.type === 'op' && (next.value === '+' || next.value === '-')) {
      consume();
      const arg = parseUnary();
      if (!arg) return null;
      return { kind: 'unary', op: next.value, arg };
    }
    return parsePrimary();
  }

  function parsePrimary(): MathAstNode | null {
    const token = peek();
    if (!token) return null;
    if (token.type === 'number') {
      consume();
      return { kind: 'number', value: token.value };
    }
    if (token.type === 'lparen') {
      consume();
      const inner = parseExpression();
      if (!inner || peek()?.type !== 'rparen') return null;
      consume();
      return inner;
    }
    if (token.type === 'ident') {
      consume();
      if (SUPPORTED_FNS.has(token.value as SupportedFn)) {
        const fn = token.value as SupportedFn;
        if (peek()?.type === 'lparen') {
          consume();
          const arg = parseExpression();
          if (!arg || peek()?.type !== 'rparen') return null;
          consume();
          return { kind: 'call', fn, arg };
        }
        // Handle `\sin x` without parentheses
        const arg = parseUnary();
        if (!arg) return null;
        return { kind: 'call', fn, arg };
      }
      if (token.value in BUILTIN_CONSTANTS) {
        return { kind: 'number', value: BUILTIN_CONSTANTS[token.value] };
      }
      if (token.value === 'x' || KNOWN_PARAMS.has(token.value)) {
        return { kind: 'var', name: token.value };
      }
      return null;
    }
    return null;
  }

  const ast = parseExpression();
  if (!ast || pos !== tokens.length) return null;
  return ast;
}

function collectAstVariables(node: MathAstNode, vars: Set<string>): void {
  switch (node.kind) {
    case 'number':
      return;
    case 'var':
      vars.add(node.name);
      return;
    case 'unary':
    case 'call':
      collectAstVariables(node.arg, vars);
      return;
    case 'binary':
      collectAstVariables(node.left, vars);
      collectAstVariables(node.right, vars);
      return;
  }
}

export function extractPlotParameters(ast: MathAstNode): string[] {
  const vars = new Set<string>();
  collectAstVariables(ast, vars);
  const ordered: string[] = [];
  for (const name of PLOT_PARAMETER_NAMES) {
    if (vars.has(name)) ordered.push(name);
  }
  if (vars.has('m')) ordered.push('m');
  return ordered;
}

export function isPlottableMathLatex(latex: string): boolean {
  const { expression, hasSingleVariableLhs } = normalizeMathExpression(latex);
  if (!hasSingleVariableLhs || !expression) return false;
  const ast = parseMathAst(expression);
  if (!ast) return false;
  const vars = new Set<string>();
  collectAstVariables(ast, vars);
  return vars.has('x');
}

export function evaluateMathAst(
  node: MathAstNode,
  x: number,
  params: Readonly<Record<string, number>> = {},
): number {
  switch (node.kind) {
    case 'number':
      return node.value;
    case 'var':
      if (node.name === 'x') return x;
      return params[node.name] ?? (node.name === 'a' || node.name === 'k' ? 1 : 0);
    case 'unary': {
      const v = evaluateMathAst(node.arg, x, params);
      return node.op === '-' ? -v : v;
    }
    case 'binary': {
      const left = evaluateMathAst(node.left, x, params);
      const right = evaluateMathAst(node.right, x, params);
      if (!Number.isFinite(left) || !Number.isFinite(right)) return Number.NaN;
      switch (node.op) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return Math.abs(right) < 1e-12 ? Number.NaN : left / right;
        case '^':
          return Math.pow(left, right);
      }
    }
    case 'call': {
      const arg = evaluateMathAst(node.arg, x, params);
      if (!Number.isFinite(arg)) return Number.NaN;
      switch (node.fn) {
        case 'sin':
          return Math.sin(arg);
        case 'cos':
          return Math.cos(arg);
        case 'tan': {
          const c = Math.cos(arg);
          return Math.abs(c) < 1e-7 ? Number.NaN : Math.tan(arg);
        }
        case 'sqrt':
          return arg < 0 ? Number.NaN : Math.sqrt(arg);
        case 'abs':
          return Math.abs(arg);
        case 'ln':
          return arg <= 0 ? Number.NaN : Math.log(arg);
        case 'log':
          return arg <= 0 ? Number.NaN : Math.log10(arg);
        case 'exp':
          return Math.exp(arg);
      }
    }
  }
}

// ------------------------------------------------------------ curve & solver

export type FunctionKeyPoint = {
  kind: 'root' | 'y-intercept' | 'extrema';
  x: number;
  y: number;
  label: string;
};

export type FunctionTangentSegment = {
  x0: number;
  y0: number;
  slope: number;
  p1: Point;
  p2: Point;
};

export type SampledFunctionCurve = {
  branches: Point[][];
  keyPoints: FunctionKeyPoint[];
  tangent: FunctionTangentSegment | null;
};

function defaultParamValues(names: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const name of names) {
    result[name] = name === 'a' || name === 'k' || name === 'm' ? 1 : 0;
  }
  return result;
}

export function createFunctionPlotConfig(latex: string): Omit<
  FunctionPlotObjectBase,
  'type' | 'colorKey' | 'sourceMathId'
> | null {
  const { expression, hasSingleVariableLhs } = normalizeMathExpression(latex);
  if (!hasSingleVariableLhs || !expression) return null;
  const ast = parseMathAst(expression);
  if (!ast) return null;
  const parameterNames = extractPlotParameters(ast);
  return {
    latex,
    expression,
    xMin: DEFAULT_PLOT_DOMAIN.xMin,
    xMax: DEFAULT_PLOT_DOMAIN.xMax,
    yMin: DEFAULT_PLOT_DOMAIN.yMin,
    yMax: DEFAULT_PLOT_DOMAIN.yMax,
    params: defaultParamValues(parameterNames),
    parameterNames,
    showKeyPoints: true,
    showTangent: false,
    tangentX: 1,
  };
}

function isLikelyAsymptoteJump(
  ast: MathAstNode,
  params: Readonly<Record<string, number>>,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  ySpan: number,
): boolean {
  const dy = Math.abs(y2 - y1);
  if (dy <= ySpan * 1.1) return false;
  if (y1 * y2 >= 0) return false;
  // Probe midpoint: if midpoint is NaN or exceeds both endpoints dramatically, it's an asymptote.
  const midX = (x1 + x2) / 2;
  const midY = evaluateMathAst(ast, midX, params);
  if (!Number.isFinite(midY)) return true;
  return Math.abs(midY) > Math.max(Math.abs(y1), Math.abs(y2)) * 1.5;
}

function clipPointToDomain(p: Point, domain: PlotDomain): boolean {
  const margin = (domain.yMax - domain.yMin) * 0.25;
  return Number.isFinite(p.y) && p.y >= domain.yMin - margin && p.y <= domain.yMax + margin;
}

/**
 * Samples `ast` over `[xMin, xMax]` into continuous `Point[][]` branches,
 * splitting cleanly across asymptotes and domain gaps.
 */
export function sampleFunctionCurve(
  ast: MathAstNode,
  params: Readonly<Record<string, number>>,
  domain: PlotDomain = DEFAULT_PLOT_DOMAIN,
  sampleCount = DEFAULT_PLOT_SAMPLE_COUNT,
): Point[][] {
  const steps = Math.max(24, sampleCount);
  const dx = (domain.xMax - domain.xMin) / steps;
  const ySpan = Math.max(1e-3, domain.yMax - domain.yMin);

  const branches: Point[][] = [];
  let current: Point[] = [];
  let prev: Point | null = null;

  for (let i = 0; i <= steps; i += 1) {
    const x = domain.xMin + i * dx;
    const y = evaluateMathAst(ast, x, params);
    const point: Point = { x, y };

    if (!Number.isFinite(y) || !clipPointToDomain(point, domain)) {
      if (current.length >= 2) branches.push(current);
      current = [];
      prev = null;
      continue;
    }

    if (prev && isLikelyAsymptoteJump(ast, params, prev.x, prev.y, x, y, ySpan)) {
      if (current.length >= 2) branches.push(current);
      current = [point];
      prev = point;
      continue;
    }

    current.push(point);
    prev = point;
  }

  if (current.length >= 2) branches.push(current);
  return branches;
}

function formatCoord(n: number): string {
  const rounded = Math.abs(n) < 0.005 ? 0 : Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
}

function numericDerivative(
  ast: MathAstNode,
  params: Readonly<Record<string, number>>,
  x: number,
  h = 1e-4,
): number {
  const yPlus = evaluateMathAst(ast, x + h, params);
  const yMinus = evaluateMathAst(ast, x - h, params);
  if (!Number.isFinite(yPlus) || !Number.isFinite(yMinus)) return Number.NaN;
  return (yPlus - yMinus) / (2 * h);
}

function bisectRoot(
  fn: (x: number) => number,
  a: number,
  b: number,
  iterations = 24,
): number | null {
  let lo = a;
  let hi = b;
  let fLo = fn(lo);
  let fHi = fn(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return null;
  if (Math.abs(fLo) < 1e-8) return lo;
  if (Math.abs(fHi) < 1e-8) return hi;
  if (fLo * fHi > 0) return null;

  for (let i = 0; i < iterations; i += 1) {
    const mid = (lo + hi) / 2;
    const fMid = fn(mid);
    if (!Number.isFinite(fMid)) return null;
    if (Math.abs(fMid) < 1e-8) return mid;
    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  const root = (lo + hi) / 2;
  return Math.abs(fn(root)) < 0.1 ? root : null;
}

function addUniqueKeyPoint(list: FunctionKeyPoint[], candidate: FunctionKeyPoint): void {
  const duplicate = list.some(
    (item) =>
      item.kind === candidate.kind &&
      Math.hypot(item.x - candidate.x, item.y - candidate.y) < 0.08,
  );
  if (!duplicate) list.push(candidate);
}

/**
 * Solves roots ($y = 0$), $y$-intercept ($x = 0$), and local extrema ($f'(x) = 0$)
 * across `domain`.
 */
export function solveFunctionKeyPoints(
  ast: MathAstNode,
  params: Readonly<Record<string, number>>,
  domain: PlotDomain = DEFAULT_PLOT_DOMAIN,
): FunctionKeyPoint[] {
  const keyPoints: FunctionKeyPoint[] = [];
  const ySpan = Math.max(1e-3, domain.yMax - domain.yMin);
  const steps = 120;
  const dx = (domain.xMax - domain.xMin) / steps;

  // 1. y-intercept
  if (domain.xMin <= 0 && domain.xMax >= 0) {
    const y0 = evaluateMathAst(ast, 0, params);
    if (Number.isFinite(y0) && y0 >= domain.yMin && y0 <= domain.yMax) {
      keyPoints.push({
        kind: 'y-intercept',
        x: 0,
        y: y0,
        label: `(0, ${formatCoord(y0)})`,
      });
    }
  }

  // 2. Roots (x-intercepts) & 3. Local extrema
  const evalY = (x: number) => evaluateMathAst(ast, x, params);
  const evalDeriv = (x: number) => numericDerivative(ast, params, x);

  for (let i = 0; i < steps; i += 1) {
    const x1 = domain.xMin + i * dx;
    const x2 = x1 + dx;
    const y1 = evalY(x1);
    const y2 = evalY(x2);

    if (
      Number.isFinite(y1) &&
      Number.isFinite(y2) &&
      !isLikelyAsymptoteJump(ast, params, x1, y1, x2, y2, ySpan)
    ) {
      if (Math.abs(y1) < 1e-6) {
        addUniqueKeyPoint(keyPoints, {
          kind: 'root',
          x: x1,
          y: 0,
          label: `(${formatCoord(x1)}, 0)`,
        });
      } else if (y1 * y2 < 0) {
        const rootX = bisectRoot(evalY, x1, x2);
        if (rootX !== null) {
          addUniqueKeyPoint(keyPoints, {
            kind: 'root',
            x: rootX,
            y: 0,
            label: `(${formatCoord(rootX)}, 0)`,
          });
        }
      }
    }

    const d1 = evalDeriv(x1);
    const d2 = evalDeriv(x2);
    if (Number.isFinite(d1) && Number.isFinite(d2)) {
      if (Math.abs(d1) < 1e-4) {
        const yVal = evalY(x1);
        if (Number.isFinite(yVal) && yVal >= domain.yMin && yVal <= domain.yMax) {
          addUniqueKeyPoint(keyPoints, {
            kind: 'extrema',
            x: x1,
            y: yVal,
            label: `(${formatCoord(x1)}, ${formatCoord(yVal)})`,
          });
        }
      } else if (d1 * d2 < 0) {
        const extX = bisectRoot(evalDeriv, x1, x2);
        if (extX !== null) {
          const extY = evalY(extX);
          if (Number.isFinite(extY) && extY >= domain.yMin && extY <= domain.yMax) {
            addUniqueKeyPoint(keyPoints, {
              kind: 'extrema',
              x: extX,
              y: extY,
              label: `(${formatCoord(extX)}, ${formatCoord(extY)})`,
            });
          }
        }
      }
    }
  }

  return keyPoints;
}

export function computeTangentSegment(
  ast: MathAstNode,
  params: Readonly<Record<string, number>>,
  x0: number,
  domain: PlotDomain = DEFAULT_PLOT_DOMAIN,
): FunctionTangentSegment | null {
  const y0 = evaluateMathAst(ast, x0, params);
  const slope = numericDerivative(ast, params, x0);
  if (!Number.isFinite(y0) || !Number.isFinite(slope)) return null;
  const span = (domain.xMax - domain.xMin) * 0.22;
  const x1 = x0 - span;
  const x2 = x0 + span;
  return {
    x0,
    y0,
    slope,
    p1: { x: x1, y: y0 + slope * (x1 - x0) },
    p2: { x: x2, y: y0 + slope * (x2 - x0) },
  };
}

export function evaluateFunctionPlot(plot: FunctionPlotObjectBase): SampledFunctionCurve {
  const ast = parseMathAst(plot.expression);
  if (!ast) return { branches: [], keyPoints: [], tangent: null };
  const domain: PlotDomain = {
    xMin: plot.xMin,
    xMax: plot.xMax,
    yMin: plot.yMin,
    yMax: plot.yMax,
  };
  const branches = sampleFunctionCurve(ast, plot.params, domain);
  const keyPoints = plot.showKeyPoints ? solveFunctionKeyPoints(ast, plot.params, domain) : [];
  const tangent = plot.showTangent ? computeTangentSegment(ast, plot.params, plot.tangentX, domain) : null;
  return { branches, keyPoints, tangent };
}

/**
 * Maps a math-domain `(x, y)` coordinate into canvas coordinates inside a
 * `FunctionPlotObject` box.
 */
export function plotPointToCanvas(
  mathPoint: Point,
  box: { x: number; y: number; width: number; height: number },
  domain: PlotDomain,
): Point {
  const padding = 20;
  const plotW = Math.max(20, box.width - padding * 2);
  const plotH = Math.max(20, box.height - padding * 2);
  const nx = (mathPoint.x - domain.xMin) / Math.max(1e-6, domain.xMax - domain.xMin);
  const ny = (mathPoint.y - domain.yMin) / Math.max(1e-6, domain.yMax - domain.yMin);
  return {
    x: box.x + padding + nx * plotW,
    y: box.y + padding + (1 - ny) * plotH,
  };
}

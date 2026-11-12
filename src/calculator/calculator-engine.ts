/**
 * Deterministic scientific calculator expression evaluator (no `eval()`).
 *
 * Uses a tokenizer + recursive-descent parser with explicit error states
 * (`Division by zero`, `Invalid expression`, `Overflow`, `Domain error`).
 */

import {
  createTextObject,
  DEFAULT_TEXT_COLOR,
  measureTextBlock,
  type DocumentCommand,
  type TextObject,
} from '../canvas/document.ts';
import type { Point } from '../canvas/viewport';

export type AngleMode = 'DEG' | 'RAD';

export type CalculatorError =
  | 'Division by zero'
  | 'Invalid expression'
  | 'Overflow'
  | 'Domain error';

export type CalculatorResult =
  | { ok: true; value: number; formatted: string }
  | { ok: false; error: CalculatorError };

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; name: string }
  | { type: 'op'; op: '+' | '-' | '*' | '/' | '^' }
  | { type: 'postfix'; op: '!' | '%' }
  | { type: 'lparen' }
  | { type: 'rparen' };

const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'sqrt', 'log', 'ln', 'abs']);

class EvalErrorWithKind extends Error {
  readonly kind: CalculatorError;
  constructor(kind: CalculatorError) {
    super(kind);
    this.kind = kind;
  }
}

function cleanNumber(value: number): number {
  if (!Number.isFinite(value)) throw new EvalErrorWithKind('Overflow');
  if (Math.abs(value) < 1e-12) return 0;
  const rounded = Number(value.toPrecision(12));
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatCalculatorResult(value: number): string {
  if (!Number.isFinite(value)) return 'Error';
  const cleaned = cleanNumber(value);
  if (Math.abs(cleaned) >= 1e12 || (cleaned !== 0 && Math.abs(cleaned) < 1e-9)) {
    return cleaned.toExponential(6).replace(/\.?0+e/, 'e');
  }
  return String(cleaned);
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new EvalErrorWithKind('Domain error');
  }
  if (n > 170) {
    throw new EvalErrorWithKind('Overflow');
  }
  let acc = 1;
  for (let i = 2; i <= n; i += 1) acc *= i;
  return acc;
}

function tokenize(raw: string): Token[] {
  const input = raw.trim();
  if (!input) throw new EvalErrorWithKind('Invalid expression');

  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch) || ch === '°') {
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let start = i;
      let sawDot = false;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        if (input[i] === '.') {
          if (sawDot) throw new EvalErrorWithKind('Invalid expression');
          sawDot = true;
        }
        i += 1;
      }
      // Scientific notation e.g. 1e-5 or 2e3
      if (
        i < input.length &&
        (input[i] === 'e' || input[i] === 'E') &&
        i + 1 < input.length &&
        (/[0-9]/.test(input[i + 1]) ||
          ((input[i + 1] === '+' || input[i + 1] === '-') &&
            i + 2 < input.length &&
            /[0-9]/.test(input[i + 2])))
      ) {
        i += 1;
        if (input[i] === '+' || input[i] === '-') i += 1;
        while (i < input.length && /[0-9]/.test(input[i])) i += 1;
      }
      const numStr = input.slice(start, i);
      const parsed = Number(numStr);
      if (!Number.isFinite(parsed)) throw new EvalErrorWithKind('Invalid expression');
      tokens.push({ type: 'number', value: parsed });
      continue;
    }

    if (ch === 'π') {
      tokens.push({ type: 'ident', name: 'pi' });
      i += 1;
      continue;
    }

    if (ch === '√') {
      tokens.push({ type: 'ident', name: 'sqrt' });
      i += 1;
      continue;
    }

    if (/[a-zA-Z]/.test(ch)) {
      const start = i;
      while (i < input.length && /[a-zA-Z]/.test(input[i])) i += 1;
      tokens.push({ type: 'ident', name: input.slice(start, i).toLowerCase() });
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      tokens.push({ type: 'op', op: ch });
      i += 1;
      continue;
    }
    if (ch === '×') {
      tokens.push({ type: 'op', op: '*' });
      i += 1;
      continue;
    }
    if (ch === '÷') {
      tokens.push({ type: 'op', op: '/' });
      i += 1;
      continue;
    }
    if (ch === '−') {
      tokens.push({ type: 'op', op: '-' });
      i += 1;
      continue;
    }
    if (ch === '!' || ch === '%') {
      tokens.push({ type: 'postfix', op: ch });
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }

    throw new EvalErrorWithKind('Invalid expression');
  }

  // Insert implicit multiplication tokens where appropriate:
  // e.g. `2π`, `2(3)`, `(2)(3)`, `2sin(30)`, `π(2)`
  const expanded: Token[] = [];
  for (let idx = 0; idx < tokens.length; idx += 1) {
    const curr = tokens[idx];
    const prev = expanded[expanded.length - 1];
    if (prev) {
      const prevIsValue =
        prev.type === 'number' ||
        prev.type === 'rparen' ||
        prev.type === 'postfix' ||
        (prev.type === 'ident' && !FUNCTIONS.has(prev.name));
      const currStartsFactor =
        curr.type === 'lparen' || curr.type === 'ident' || curr.type === 'number';
      if (prevIsValue && currStartsFactor) {
        expanded.push({ type: 'op', op: '*' });
      }
    }
    expanded.push(curr);
  }

  return expanded;
}

export function evaluateExpression(
  expression: string,
  options: { angleMode?: AngleMode; ans?: number } = {},
): CalculatorResult {
  const angleMode = options.angleMode ?? 'DEG';
  const ans = options.ans ?? 0;

  try {
    const tokens = tokenize(expression);
    let pos = 0;

    const peek = (): Token | undefined => tokens[pos];
    const consume = (): Token | undefined => {
      const tok = tokens[pos];
      pos += 1;
      return tok;
    };

    const toAngle = (x: number): number => (angleMode === 'DEG' ? (x * Math.PI) / 180 : x);

    const evalFunction = (name: string, arg: number): number => {
      switch (name) {
        case 'sin':
          return cleanNumber(Math.sin(toAngle(arg)));
        case 'cos':
          return cleanNumber(Math.cos(toAngle(arg)));
        case 'tan': {
          if (angleMode === 'DEG') {
            const mod = ((arg % 180) + 180) % 180;
            if (Math.abs(mod - 90) < 1e-9) {
              throw new EvalErrorWithKind('Domain error');
            }
          }
          const cosVal = Math.cos(toAngle(arg));
          if (Math.abs(cosVal) < 1e-12) throw new EvalErrorWithKind('Domain error');
          return cleanNumber(Math.tan(toAngle(arg)));
        }
        case 'sqrt':
          if (arg < 0) throw new EvalErrorWithKind('Domain error');
          return cleanNumber(Math.sqrt(arg));
        case 'log':
          if (arg <= 0) throw new EvalErrorWithKind('Domain error');
          return cleanNumber(Math.log10(arg));
        case 'ln':
          if (arg <= 0) throw new EvalErrorWithKind('Domain error');
          return cleanNumber(Math.log(arg));
        case 'abs':
          return cleanNumber(Math.abs(arg));
        default:
          throw new EvalErrorWithKind('Invalid expression');
      }
    };

    const parseExpression = (): number => parseAddSub();

    const parseAddSub = (): number => {
      let left = parseMulDiv();
      while (true) {
        const tok = peek();
        if (tok?.type === 'op' && (tok.op === '+' || tok.op === '-')) {
          consume();
          const right = parseMulDiv();
          left = tok.op === '+' ? left + right : left - right;
        } else {
          break;
        }
      }
      return left;
    };

    const parseMulDiv = (): number => {
      let left = parseUnary();
      while (true) {
        const tok = peek();
        if (tok?.type === 'op' && (tok.op === '*' || tok.op === '/')) {
          consume();
          const right = parseUnary();
          if (tok.op === '/') {
            if (right === 0) throw new EvalErrorWithKind('Division by zero');
            left /= right;
          } else {
            left *= right;
          }
        } else {
          break;
        }
      }
      return left;
    };

    const parseUnary = (): number => {
      const tok = peek();
      if (tok?.type === 'op' && (tok.op === '+' || tok.op === '-')) {
        consume();
        const val = parseUnary();
        return tok.op === '-' ? -val : val;
      }
      return parsePower();
    };

    const parsePower = (): number => {
      const base = parsePostfix();
      const tok = peek();
      if (tok?.type === 'op' && tok.op === '^') {
        consume();
        const exponent = parseUnary();
        const res = Math.pow(base, exponent);
        if (Number.isNaN(res)) throw new EvalErrorWithKind('Domain error');
        if (!Number.isFinite(res)) throw new EvalErrorWithKind('Overflow');
        return res;
      }
      return base;
    };

    const parsePostfix = (): number => {
      let val = parsePrimary();
      while (true) {
        const tok = peek();
        if (tok?.type === 'postfix') {
          consume();
          if (tok.op === '!') {
            val = factorial(val);
          } else {
            val /= 100;
          }
        } else {
          break;
        }
      }
      return val;
    };

    const parsePrimary = (): number => {
      const tok = consume();
      if (!tok) throw new EvalErrorWithKind('Invalid expression');

      if (tok.type === 'number') return tok.value;

      if (tok.type === 'lparen') {
        const val = parseExpression();
        const closing = consume();
        if (closing?.type !== 'rparen') throw new EvalErrorWithKind('Invalid expression');
        return val;
      }

      if (tok.type === 'ident') {
        if (tok.name === 'pi') return Math.PI;
        if (tok.name === 'e') return Math.E;
        if (tok.name === 'ans') return ans;
        if (FUNCTIONS.has(tok.name)) {
          const next = peek();
          if (next?.type === 'lparen') {
            consume();
            const arg = parseExpression();
            const closing = consume();
            if (closing?.type !== 'rparen') throw new EvalErrorWithKind('Invalid expression');
            return evalFunction(tok.name, arg);
          }
          // Allow `√9` without parentheses
          const arg = parseUnary();
          return evalFunction(tok.name, arg);
        }
        throw new EvalErrorWithKind('Invalid expression');
      }

      throw new EvalErrorWithKind('Invalid expression');
    };

    const rawValue = parseExpression();
    if (pos < tokens.length) {
      throw new EvalErrorWithKind('Invalid expression');
    }

    const value = cleanNumber(rawValue);
    return {
      ok: true,
      value,
      formatted: formatCalculatorResult(value),
    };
  } catch (err) {
    if (err instanceof EvalErrorWithKind) {
      return { ok: false, error: err.kind };
    }
    return { ok: false, error: 'Invalid expression' };
  }
}

export function formatCalculatorBoardText(expression: string, result: string): string {
  return `${expression.trim()} = ${result.trim()}`;
}

export function createCalculatorPasteObject(
  expression: string,
  result: string,
  center: Point,
  id: string,
  colorKey: string = DEFAULT_TEXT_COLOR,
): TextObject {
  const base = createTextObject({
    id,
    point: center,
    colorKey,
    fontSize: 20,
    fontWeight: 'bold',
  });
  const text = formatCalculatorBoardText(expression, result);
  const measured = measureTextBlock(text, base.fontSize, base.width, base.fontWeight, base.fontStyle);
  return {
    ...base,
    text,
    width: base.width,
    height: measured.height,
    x: Math.round(center.x - base.width / 2),
    y: Math.round(center.y - measured.height / 2),
  };
}

export function createCalculatorPasteCommand(
  expression: string,
  result: string,
  center: Point,
  id: string,
  colorKey: string = DEFAULT_TEXT_COLOR,
): DocumentCommand {
  return {
    type: 'object.insert',
    object: createCalculatorPasteObject(expression, result, center, id, colorKey),
  };
}

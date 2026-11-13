/**
 * Pure recursive box-layout and vector path engine for mathematical expressions.
 *
 * Parses a LaTeX-subset string into an AST, lays out boxes with baseline
 * alignment, and emits positioned Skia glyphs + SVG vector paths (fraction
 * vinculum bars, dynamic radical hooks/overbars, summation/integral contours,
 * absolute value bars, vector arrows, and 2x2 / 3x3 matrix brackets) with
 * zero WebView or external font dependencies.
 */

export type MathSourceSpan = {
  start: number;
  end: number;
};

export type MathGlyph = {
  text: string;
  /** Left edge in layout-local coordinates. */
  x: number;
  /** Top edge in layout-local coordinates (for Skia Paragraph placement). */
  y: number;
  fontSize: number;
  italic: boolean;
  bold?: boolean;
  width?: number;
  height?: number;
  span?: MathSourceSpan;
};

export type MathEditSlot = {
  span: MathSourceSpan;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

export type MathLayoutResult = {
  width: number;
  height: number;
  baseline: number;
  glyphs: readonly MathGlyph[];
  slots: readonly MathEditSlot[];
  paths: readonly string[];
  vectorPathsSvg: string;
};

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

type MathNode =
  | { kind: 'row'; items: MathNode[] }
  | { kind: 'text'; text: string; italic: boolean; bold?: boolean; span?: MathSourceSpan }
  | { kind: 'space'; factor: number }
  | { kind: 'frac'; num: MathNode; den: MathNode }
  | { kind: 'sqrt'; index: MathNode | null; body: MathNode }
  | { kind: 'scripts'; base: MathNode; sup: MathNode | null; sub: MathNode | null }
  | { kind: 'bigop'; op: 'sum' | 'int' | 'prod' | 'lim'; sub: MathNode | null; sup: MathNode | null }
  | { kind: 'abs'; body: MathNode }
  | { kind: 'delim'; left: string; right: string; body: MathNode }
  | { kind: 'vec'; body: MathNode }
  | { kind: 'binom'; top: MathNode; bottom: MathNode }
  | {
      kind: 'matrix';
      style: 'bmatrix' | 'pmatrix' | 'vmatrix';
      rows: MathNode[][];
      cellSpans?: MathSourceSpan[][];
    };

const NAMED_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'arcsin', 'arccos', 'arctan',
  'sinh', 'cosh', 'tanh',
  'log', 'ln', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'gcd',
]);

const GREEK_AND_SYMBOLS: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
  pm: '±',
  mp: '∓',
  times: '×',
  div: '÷',
  cdot: '·',
  ast: '∗',
  star: '⋆',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  neq: '≠',
  ne: '≠',
  approx: '≈',
  equiv: '≡',
  sim: '∼',
  cong: '≅',
  propto: '∝',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  Leftarrow: '⇐',
  Leftrightarrow: '⇔',
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  subseteq: '⊆',
  supset: '⊃',
  supseteq: '⊇',
  cup: '∪',
  cap: '∩',
  emptyset: '∅',
  varnothing: '∅',
  forall: '∀',
  exists: '∃',
  neg: '¬',
  land: '∧',
  lor: '∨',
  angle: '∠',
  perp: '⊥',
  parallel: '∥',
  circ: '°',
  degree: '°',
  therefore: '∴',
  because: '∵',
  dots: '…',
  cdots: '⋯',
  ldots: '…',
};

const BLACKBOARD_BOLD: Record<string, string> = {
  R: 'ℝ',
  Z: 'ℤ',
  N: 'ℕ',
  Q: 'ℚ',
  C: 'ℂ',
};

class LatexParser {
  private readonly src: string;
  private pos = 0;

  constructor(src: string) {
    this.src = src;
  }

  parse(): MathNode {
    return this.parseRow();
  }

  private eof(): boolean {
    return this.pos >= this.src.length;
  }

  private peek(): string {
    return this.src[this.pos] ?? '';
  }

  private skipSpaces(): void {
    while (!this.eof() && /\s/.test(this.src[this.pos])) {
      this.pos += 1;
    }
  }

  private startsWith(token: string): boolean {
    return this.src.startsWith(token, this.pos);
  }

  private parseRow(stopTokens: readonly string[] = []): MathNode {
    const items: MathNode[] = [];
    while (!this.eof()) {
      this.skipSpaces();
      if (this.eof()) break;
      if (stopTokens.some((t) => this.startsWith(t))) break;
      const ch = this.peek();
      if (ch === '}' || ch === ']' && stopTokens.includes(']')) break;
      const atom = this.parseScriptedAtom();
      if (atom) items.push(atom);
    }
    if (items.length === 1) return items[0];
    return { kind: 'row', items };
  }

  private parseScriptedAtom(): MathNode | null {
    const base = this.parseAtom();
    if (!base) return null;

    let sub: MathNode | null = null;
    let sup: MathNode | null = null;

    for (let i = 0; i < 2; i += 1) {
      this.skipSpaces();
      if (this.peek() === '_' && sub === null) {
        this.pos += 1;
        sub = this.parseGroupOrAtom();
      } else if (this.peek() === '^' && sup === null) {
        this.pos += 1;
        sup = this.parseGroupOrAtom();
      } else {
        break;
      }
    }

    if (!sub && !sup) return base;
    if (base.kind === 'bigop') {
      return { ...base, sub: sub ?? base.sub, sup: sup ?? base.sup };
    }
    return { kind: 'scripts', base, sub, sup };
  }

  private parseGroupOrAtom(): MathNode {
    this.skipSpaces();
    if (this.peek() === '{') {
      this.pos += 1;
      const inner = this.parseRow(['}']);
      if (this.peek() === '}') this.pos += 1;
      return inner;
    }
    return this.parseAtom() ?? { kind: 'text', text: '', italic: false };
  }

  private parseAtom(): MathNode | null {
    this.skipSpaces();
    if (this.eof()) return null;

    const ch = this.peek();

    if (ch === '{') {
      this.pos += 1;
      const inner = this.parseRow(['}']);
      if (this.peek() === '}') this.pos += 1;
      return inner;
    }

    if (ch === '|') {
      this.pos += 1;
      // Check if there is a closing '|' ahead before '}' or end
      const saved = this.pos;
      const body = this.parseRow(['|', '}']);
      if (this.peek() === '|') {
        this.pos += 1;
        return { kind: 'abs', body };
      }
      this.pos = saved;
      return { kind: 'text', text: '|', italic: false };
    }

    if (ch === '\\') {
      return this.parseCommand();
    }

    if (/[a-zA-Z]/.test(ch)) {
      const start = this.pos;
      this.pos += 1;
      return { kind: 'text', text: ch, italic: true, span: { start, end: this.pos } };
    }

    if (/[0-9.]/.test(ch)) {
      const start = this.pos;
      let num = '';
      while (!this.eof() && /[0-9.]/.test(this.peek())) {
        num += this.peek();
        this.pos += 1;
      }
      return { kind: 'text', text: num, italic: false, span: { start, end: this.pos } };
    }

    // Operators & punctuation
    const start = this.pos;
    this.pos += 1;
    const display = ch === '-' ? '−' : ch;
    return { kind: 'text', text: display, italic: false, span: { start, end: this.pos } };
  }

  private parseCommand(): MathNode {
    const cmdStart = this.pos;
    this.pos += 1; // consume '\'
    if (this.eof()) return { kind: 'text', text: '\\', italic: false, span: { start: cmdStart, end: this.pos } };

    const next = this.peek();
    if (next === ',') {
      this.pos += 1;
      return { kind: 'space', factor: 0.25 };
    }
    if (next === ';' || next === ' ') {
      this.pos += 1;
      return { kind: 'space', factor: 0.4 };
    }
    if (next === '{' || next === '}' || next === '|') {
      this.pos += 1;
      return { kind: 'text', text: next, italic: false, span: { start: cmdStart, end: this.pos } };
    }

    let cmd = '';
    while (!this.eof() && /[a-zA-Z]/.test(this.peek())) {
      cmd += this.peek();
      this.pos += 1;
    }

    if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') {
      const num = this.parseGroupOrAtom();
      const den = this.parseGroupOrAtom();
      return { kind: 'frac', num, den };
    }

    if (cmd === 'binom') {
      const top = this.parseGroupOrAtom();
      const bottom = this.parseGroupOrAtom();
      return { kind: 'binom', top, bottom };
    }

    if (cmd === 'sqrt') {
      this.skipSpaces();
      let index: MathNode | null = null;
      if (this.peek() === '[') {
        this.pos += 1;
        index = this.parseRow([']']);
        if (this.peek() === ']') this.pos += 1;
      }
      const body = this.parseGroupOrAtom();
      return { kind: 'sqrt', index, body };
    }

    if (cmd === 'vec' || cmd === 'overrightarrow') {
      const body = this.parseGroupOrAtom();
      return { kind: 'vec', body };
    }

    if (cmd === 'abs') {
      const body = this.parseGroupOrAtom();
      return { kind: 'abs', body };
    }

    if (cmd === 'mathbb') {
      const arg = this.parseGroupOrAtom();
      const letter = arg.kind === 'text' ? arg.text : '';
      return {
        kind: 'text',
        text: BLACKBOARD_BOLD[letter] ?? letter,
        italic: false,
        bold: true,
        span: { start: cmdStart, end: this.pos },
      };
    }

    if (cmd === 'sum' || cmd === 'int' || cmd === 'prod' || cmd === 'lim') {
      return { kind: 'bigop', op: cmd, sub: null, sup: null };
    }

    if (cmd === 'left') {
      this.skipSpaces();
      const leftDelim = this.consumeDelimiter();
      const body = this.parseRow(['\\right']);
      if (this.startsWith('\\right')) {
        this.pos += '\\right'.length;
        this.skipSpaces();
        const rightDelim = this.consumeDelimiter();
        return { kind: 'delim', left: leftDelim, right: rightDelim, body };
      }
      return { kind: 'delim', left: leftDelim, right: '', body };
    }

    if (cmd === 'begin') {
      const envNode = this.parseGroupOrAtom();
      const envName = envNode.kind === 'text' ? envNode.text : this.extractPlainText(envNode);
      const style: 'bmatrix' | 'pmatrix' | 'vmatrix' =
        envName === 'pmatrix' ? 'pmatrix' : envName === 'vmatrix' ? 'vmatrix' : 'bmatrix';
      const { rows, cellSpans } = this.parseMatrixRows(envName);
      return { kind: 'matrix', style, rows, cellSpans };
    }

    if (NAMED_FUNCTIONS.has(cmd)) {
      return { kind: 'text', text: cmd, italic: false, span: { start: cmdStart, end: this.pos } };
    }

    if (cmd in GREEK_AND_SYMBOLS) {
      return { kind: 'text', text: GREEK_AND_SYMBOLS[cmd], italic: false, span: { start: cmdStart, end: this.pos } };
    }

    return { kind: 'text', text: cmd, italic: false, span: { start: cmdStart, end: this.pos } };
  }

  private consumeDelimiter(): string {
    if (this.eof()) return '';
    const ch = this.peek();
    if (ch === '.') {
      this.pos += 1;
      return '';
    }
    if (ch === '\\') {
      this.pos += 1;
      const next = this.peek();
      this.pos += 1;
      return next;
    }
    this.pos += 1;
    return ch;
  }

  private extractPlainText(node: MathNode): string {
    if (node.kind === 'text') return node.text;
    if (node.kind === 'row') return node.items.map((i) => this.extractPlainText(i)).join('');
    return '';
  }

  private parseMatrixRows(envName: string): { rows: MathNode[][]; cellSpans: MathSourceSpan[][] } {
    const endToken = `\\end{${envName}}`;
    const rows: MathNode[][] = [];
    const cellSpans: MathSourceSpan[][] = [];
    let currentRow: MathNode[] = [];
    let currentSpanRow: MathSourceSpan[] = [];

    while (!this.eof()) {
      this.skipSpaces();
      if (this.startsWith(endToken)) {
        this.pos += endToken.length;
        break;
      }
      const cellStart = this.pos;
      const cell = this.parseRow(['&', '\\\\', endToken]);
      let cellEnd = this.pos;
      while (cellEnd > cellStart && /\s/.test(this.src[cellEnd - 1])) {
        cellEnd -= 1;
      }
      currentRow.push(cell);
      currentSpanRow.push({ start: cellStart, end: cellEnd });

      this.skipSpaces();
      if (this.peek() === '&') {
        this.pos += 1;
        continue;
      }
      if (this.startsWith('\\\\')) {
        this.pos += 2;
        rows.push(currentRow);
        cellSpans.push(currentSpanRow);
        currentRow = [];
        currentSpanRow = [];
        continue;
      }
    }

    if (currentRow.length > 0) {
      rows.push(currentRow);
      cellSpans.push(currentSpanRow);
    }
    if (rows.length === 0) {
      return { rows: [[{ kind: 'text', text: ' ', italic: false }]], cellSpans: [] };
    }
    return { rows, cellSpans };
  }
}

// ---------------------------------------------------------------------------
// Recursive Box Layout Engine
// ---------------------------------------------------------------------------

type LayoutBox = {
  width: number;
  ascent: number;
  descent: number;
  render: (
    x: number,
    baselineY: number,
    glyphs: MathGlyph[],
    paths: string[],
    slots?: MathEditSlot[],
  ) => void;
};

const MIN_FONT_SIZE = 9;

function estimateGlyphWidth(text: string, fontSize: number, italic: boolean): number {
  if (text.length === 0) return 0;
  let w = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === 'i' || ch === 'l' || ch === '1' || ch === '|' || ch === '.' || ch === ',') {
      w += fontSize * 0.34;
    } else if (ch === 'm' || ch === 'w' || ch === 'M' || ch === 'W' || ch === '∑' || ch === 'Δ') {
      w += fontSize * 0.78;
    } else if (ch === ' ') {
      w += fontSize * 0.28;
    } else {
      w += fontSize * (italic ? 0.56 : 0.58);
    }
  }
  return w;
}

function makeTextBox(
  text: string,
  fontSize: number,
  italic: boolean,
  bold = false,
  span?: MathSourceSpan,
): LayoutBox {
  const width = estimateGlyphWidth(text, fontSize, italic);
  const ascent = fontSize * 0.78;
  const descent = fontSize * 0.24;
  return {
    width,
    ascent,
    descent,
    render: (x, baselineY, glyphs) => {
      if (text.length === 0) return;
      glyphs.push({
        text,
        x,
        y: baselineY - fontSize * 0.86,
        fontSize,
        italic,
        width,
        height: ascent + descent,
        ...(bold ? { bold: true } : {}),
        ...(span ? { span } : {}),
      });
    },
  };
}

function makeEmptyBox(fontSize: number): LayoutBox {
  return {
    width: fontSize * 0.35,
    ascent: fontSize * 0.65,
    descent: fontSize * 0.2,
    render: () => {},
  };
}

function layoutNode(node: MathNode, fontSize: number): LayoutBox {
  const fs = Math.max(MIN_FONT_SIZE, fontSize);

  switch (node.kind) {
    case 'text':
      return makeTextBox(node.text, fs, node.italic, node.bold, node.span);

    case 'space':
      return {
        width: fs * node.factor,
        ascent: fs * 0.5,
        descent: fs * 0.1,
        render: () => {},
      };

    case 'row': {
      if (node.items.length === 0) return makeEmptyBox(fs);
      const boxes = node.items.map((item) => layoutNode(item, fs));
      const gap = fs * 0.08;
      let width = 0;
      let ascent = fs * 0.6;
      let descent = fs * 0.2;
      for (let i = 0; i < boxes.length; i += 1) {
        width += boxes[i].width + (i > 0 ? gap : 0);
        ascent = Math.max(ascent, boxes[i].ascent);
        descent = Math.max(descent, boxes[i].descent);
      }
      return {
        width,
        ascent,
        descent,
        render: (x, baselineY, glyphs, paths, slots) => {
          let cursor = x;
          for (let i = 0; i < boxes.length; i += 1) {
            if (i > 0) cursor += gap;
            boxes[i].render(cursor, baselineY, glyphs, paths, slots);
            cursor += boxes[i].width;
          }
        },
      };
    }

    case 'frac': {
      const childFs = Math.max(MIN_FONT_SIZE, fs * 0.82);
      const numBox = layoutNode(node.num, childFs);
      const denBox = layoutNode(node.den, childFs);
      const padX = fs * 0.16;
      const barGap = Math.max(2, fs * 0.14);
      const barThickness = Math.max(1.2, fs * 0.065);
      const axisOffset = fs * 0.28;
      const innerWidth = Math.max(numBox.width, denBox.width, fs * 0.6);
      const width = innerWidth + padX * 2;
      const numHeight = numBox.ascent + numBox.descent;
      const denHeight = denBox.ascent + denBox.descent;
      const ascent = axisOffset + barGap + numHeight;
      const descent = Math.max(fs * 0.24, barGap + denHeight - axisOffset);

      return {
        width,
        ascent,
        descent,
        render: (x, baselineY, glyphs, paths) => {
          const barY = baselineY - axisOffset;
          paths.push(
            `M ${x.toFixed(2)} ${barY.toFixed(2)} L ${(x + width).toFixed(2)} ${barY.toFixed(2)}`,
          );
          const numX = x + (width - numBox.width) / 2;
          const numBaseline = barY - barGap - numBox.descent;
          numBox.render(numX, numBaseline, glyphs, paths);

          const denX = x + (width - denBox.width) / 2;
          const denBaseline = barY + barGap + denBox.ascent;
          denBox.render(denX, denBaseline, glyphs, paths);
        },
      };
    }

    case 'sqrt': {
      const bodyBox = layoutNode(node.body, fs);
      const indexBox = node.index ? layoutNode(node.index, Math.max(MIN_FONT_SIZE, fs * 0.58)) : null;
      const hookWidth = fs * 0.52;
      const indexWidth = indexBox ? Math.max(0, indexBox.width - hookWidth * 0.35) : 0;
      const padTop = Math.max(3, fs * 0.16);
      const padRight = fs * 0.12;
      const width = indexWidth + hookWidth + bodyBox.width + padRight;
      const ascent = bodyBox.ascent + padTop;
      const descent = Math.max(bodyBox.descent, fs * 0.24);

      return {
        width,
        ascent,
        descent,
        render: (x, baselineY, glyphs, paths) => {
          const topY = baselineY - ascent + 1;
          const bottomY = baselineY + descent - 1;
          const midY = baselineY + descent * 0.1;
          const hookStartX = x + indexWidth;
          const hookTipX = hookStartX + hookWidth * 0.45;
          const overbarStartX = hookStartX + hookWidth;
          const overbarEndX = x + width;

          // Dynamic radical hook + overbar
          paths.push(
            `M ${hookStartX.toFixed(2)} ${midY.toFixed(2)} ` +
              `L ${(hookStartX + hookWidth * 0.18).toFixed(2)} ${midY.toFixed(2)} ` +
              `L ${hookTipX.toFixed(2)} ${bottomY.toFixed(2)} ` +
              `L ${overbarStartX.toFixed(2)} ${topY.toFixed(2)} ` +
              `L ${overbarEndX.toFixed(2)} ${topY.toFixed(2)}`,
          );

          if (indexBox) {
            indexBox.render(x, midY - fs * 0.12, glyphs, paths);
          }
          bodyBox.render(overbarStartX + fs * 0.05, baselineY, glyphs, paths);
        },
      };
    }

    case 'scripts': {
      const baseBox = layoutNode(node.base, fs);
      const scriptFs = Math.max(MIN_FONT_SIZE, fs * 0.66);
      const supBox = node.sup ? layoutNode(node.sup, scriptFs) : null;
      const subBox = node.sub ? layoutNode(node.sub, scriptFs) : null;
      const scriptWidth = Math.max(supBox?.width ?? 0, subBox?.width ?? 0);
      const gap = fs * 0.04;
      const width = baseBox.width + gap + scriptWidth;

      const supBaselineOffset = baseBox.ascent * 0.55;
      const subBaselineOffset = baseBox.descent + scriptFs * 0.35;

      const ascent = Math.max(
        baseBox.ascent,
        supBox ? supBaselineOffset + supBox.ascent : 0,
      );
      const descent = Math.max(
        baseBox.descent,
        subBox ? subBaselineOffset + subBox.descent : 0,
      );

      return {
        width,
        ascent,
        descent,
        render: (x, baselineY, glyphs, paths) => {
          baseBox.render(x, baselineY, glyphs, paths);
          const scriptX = x + baseBox.width + gap;
          if (supBox) {
            supBox.render(scriptX, baselineY - supBaselineOffset, glyphs, paths);
          }
          if (subBox) {
            subBox.render(scriptX, baselineY + subBaselineOffset, glyphs, paths);
          }
        },
      };
    }

    case 'bigop': {
      const limitFs = Math.max(MIN_FONT_SIZE, fs * 0.62);
      const subBox = node.sub ? layoutNode(node.sub, limitFs) : null;
      const supBox = node.sup ? layoutNode(node.sup, limitFs) : null;

      if (node.op === 'lim') {
        const limBox = makeTextBox('lim', fs, false);
        const width = Math.max(limBox.width, subBox?.width ?? 0);
        const gap = fs * 0.1;
        const ascent = limBox.ascent;
        const descent = limBox.descent + (subBox ? gap + subBox.ascent + subBox.descent : 0);
        return {
          width,
          ascent,
          descent,
          render: (x, baselineY, glyphs, paths) => {
            limBox.render(x + (width - limBox.width) / 2, baselineY, glyphs, paths);
            if (subBox) {
              subBox.render(
                x + (width - subBox.width) / 2,
                baselineY + limBox.descent + gap + subBox.ascent,
                glyphs,
                paths,
              );
            }
          },
        };
      }

      const opW = node.op === 'int' ? fs * 0.65 : fs * 0.95;
      const opAscent = fs * 0.95;
      const opDescent = fs * 0.45;
      const limitGap = fs * 0.12;
      const width = Math.max(opW, subBox?.width ?? 0, supBox?.width ?? 0) + fs * 0.12;
      const ascent = opAscent + (supBox ? limitGap + supBox.ascent + supBox.descent : 0);
      const descent = opDescent + (subBox ? limitGap + subBox.ascent + subBox.descent : 0);

      return {
        width,
        ascent,
        descent,
        render: (x, baselineY, glyphs, paths) => {
          const cx = x + width / 2;
          const top = baselineY - opAscent;
          const bot = baselineY + opDescent;

          if (node.op === 'sum') {
            const half = opW * 0.44;
            const midY = (top + bot) / 2;
            paths.push(
              `M ${(cx + half).toFixed(2)} ${(top + 2).toFixed(2)} ` +
                `L ${(cx + half).toFixed(2)} ${top.toFixed(2)} ` +
                `L ${(cx - half).toFixed(2)} ${top.toFixed(2)} ` +
                `L ${(cx + half * 0.15).toFixed(2)} ${midY.toFixed(2)} ` +
                `L ${(cx - half).toFixed(2)} ${bot.toFixed(2)} ` +
                `L ${(cx + half).toFixed(2)} ${bot.toFixed(2)} ` +
                `L ${(cx + half).toFixed(2)} ${(bot - 2).toFixed(2)}`,
            );
          } else if (node.op === 'int') {
            const hw = opW * 0.34;
            paths.push(
              `M ${(cx + hw).toFixed(2)} ${(top + 2).toFixed(2)} ` +
                `C ${(cx + hw * 0.2).toFixed(2)} ${(top - 2).toFixed(2)} ` +
                `${(cx + 1).toFixed(2)} ${(top + 6).toFixed(2)} ` +
                `${cx.toFixed(2)} ${((top + bot) / 2).toFixed(2)} ` +
                `C ${(cx - 1).toFixed(2)} ${(bot - 6).toFixed(2)} ` +
                `${(cx - hw * 0.2).toFixed(2)} ${(bot + 2).toFixed(2)} ` +
                `${(cx - hw).toFixed(2)} ${(bot - 2).toFixed(2)}`,
            );
          } else {
            // \prod
            const half = opW * 0.42;
            paths.push(
              `M ${(cx - half).toFixed(2)} ${top.toFixed(2)} ` +
                `L ${(cx + half).toFixed(2)} ${top.toFixed(2)} ` +
                `M ${(cx - half * 0.65).toFixed(2)} ${top.toFixed(2)} ` +
                `L ${(cx - half * 0.65).toFixed(2)} ${bot.toFixed(2)} ` +
                `M ${(cx + half * 0.65).toFixed(2)} ${top.toFixed(2)} ` +
                `L ${(cx + half * 0.65).toFixed(2)} ${bot.toFixed(2)}`,
            );
          }

          if (supBox) {
            supBox.render(cx - supBox.width / 2, top - limitGap - supBox.descent, glyphs, paths);
          }
          if (subBox) {
            subBox.render(cx - subBox.width / 2, bot + limitGap + subBox.ascent, glyphs, paths);
          }
        },
      };
    }

    case 'abs': {
      const bodyBox = layoutNode(node.body, fs);
      const pad = fs * 0.22;
      const width = bodyBox.width + pad * 2;
      const ascent = bodyBox.ascent + 2;
      const descent = bodyBox.descent + 2;
      return {
        width,
        ascent,
        descent,
        render: (x, baselineY, glyphs, paths) => {
          const top = baselineY - ascent;
          const bot = baselineY + descent;
          const lx = x + pad * 0.45;
          const rx = x + width - pad * 0.45;
          paths.push(
            `M ${lx.toFixed(2)} ${top.toFixed(2)} L ${lx.toFixed(2)} ${bot.toFixed(2)} ` +
              `M ${rx.toFixed(2)} ${top.toFixed(2)} L ${rx.toFixed(2)} ${bot.toFixed(2)}`,
          );
          bodyBox.render(x + pad, baselineY, glyphs, paths);
        },
      };
    }

    case 'delim': {
      const bodyBox = layoutNode(node.body, fs);
      const delimW = fs * 0.34;
      const leftW = node.left ? delimW : 0;
      const rightW = node.right ? delimW : 0;
      const pad = fs * 0.08;
      const width = leftW + rightW + bodyBox.width + pad * 2;
      const ascent = bodyBox.ascent + 2;
      const descent = bodyBox.descent + 2;
      return {
        width,
        ascent,
        descent,
        render: (x, baselineY, glyphs, paths) => {
          const top = baselineY - ascent;
          const bot = baselineY + descent;
          if (node.left) {
            drawDelimiterPath(node.left, x + leftW * 0.5, top, bot, true, paths);
          }
          bodyBox.render(x + leftW + pad, baselineY, glyphs, paths);
          if (node.right) {
            drawDelimiterPath(node.right, x + width - rightW * 0.5, top, bot, false, paths);
          }
        },
      };
    }

    case 'vec': {
      const bodyBox = layoutNode(node.body, fs);
      const arrowGap = Math.max(2, fs * 0.14);
      const arrowH = Math.max(3, fs * 0.18);
      const width = Math.max(bodyBox.width, fs * 0.45);
      const ascent = bodyBox.ascent + arrowGap + arrowH;
      const descent = bodyBox.descent;
      return {
        width,
        ascent,
        descent,
        render: (x, baselineY, glyphs, paths) => {
          const ay = baselineY - bodyBox.ascent - arrowGap;
          const x1 = x + 1;
          const x2 = x + width - 1;
          paths.push(
            `M ${x1.toFixed(2)} ${ay.toFixed(2)} L ${x2.toFixed(2)} ${ay.toFixed(2)} ` +
              `M ${(x2 - arrowH * 0.85).toFixed(2)} ${(ay - arrowH * 0.65).toFixed(2)} ` +
              `L ${x2.toFixed(2)} ${ay.toFixed(2)} ` +
              `L ${(x2 - arrowH * 0.85).toFixed(2)} ${(ay + arrowH * 0.65).toFixed(2)}`,
          );
          bodyBox.render(x + (width - bodyBox.width) / 2, baselineY, glyphs, paths);
        },
      };
    }

    case 'binom': {
      const childFs = Math.max(MIN_FONT_SIZE, fs * 0.8);
      const topBox = layoutNode(node.top, childFs);
      const botBox = layoutNode(node.bottom, childFs);
      const innerW = Math.max(topBox.width, botBox.width);
      const delimW = fs * 0.36;
      const gap = fs * 0.18;
      const width = innerW + delimW * 2 + fs * 0.16;
      const ascent = fs * 0.28 + gap / 2 + topBox.ascent + topBox.descent;
      const descent = Math.max(fs * 0.28, gap / 2 + botBox.ascent + botBox.descent - fs * 0.28);
      return {
        width,
        ascent,
        descent,
        render: (x, baselineY, glyphs, paths) => {
          const top = baselineY - ascent;
          const bot = baselineY + descent;
          drawDelimiterPath('(', x + delimW * 0.5, top, bot, true, paths);
          drawDelimiterPath(')', x + width - delimW * 0.5, top, bot, false, paths);
          const axisY = baselineY - fs * 0.28;
          topBox.render(x + (width - topBox.width) / 2, axisY - gap / 2 - topBox.descent, glyphs, paths);
          botBox.render(x + (width - botBox.width) / 2, axisY + gap / 2 + botBox.ascent, glyphs, paths);
        },
      };
    }

    case 'matrix': {
      const cellFs = Math.max(MIN_FONT_SIZE, fs * 0.84);
      const cellBoxes = node.rows.map((row) => row.map((cell) => layoutNode(cell, cellFs)));
      const numRows = cellBoxes.length;
      const numCols = Math.max(1, ...cellBoxes.map((r) => r.length));
      const colWidths = new Array<number>(numCols).fill(cellFs * 0.5);
      const rowAscents = new Array<number>(numRows).fill(cellFs * 0.65);
      const rowDescents = new Array<number>(numRows).fill(cellFs * 0.22);

      for (let r = 0; r < numRows; r += 1) {
        for (let c = 0; c < cellBoxes[r].length; c += 1) {
          const box = cellBoxes[r][c];
          colWidths[c] = Math.max(colWidths[c], box.width);
          rowAscents[r] = Math.max(rowAscents[r], box.ascent);
          rowDescents[r] = Math.max(rowDescents[r], box.descent);
        }
      }

      const colGap = cellFs * 0.55;
      const rowGap = cellFs * 0.35;
      const bracketW = fs * 0.36;
      const padX = fs * 0.16;

      const gridWidth =
        colWidths.reduce((sum, w) => sum + w, 0) + Math.max(0, numCols - 1) * colGap;
      const gridHeight =
        rowAscents.reduce((s, a) => s + a, 0) +
        rowDescents.reduce((s, d) => s + d, 0) +
        Math.max(0, numRows - 1) * rowGap;

      const width = bracketW * 2 + padX * 2 + gridWidth;
      const axisOffset = fs * 0.28;
      const ascent = gridHeight / 2 + axisOffset;
      const descent = Math.max(fs * 0.24, gridHeight / 2 - axisOffset);

      return {
        width,
        ascent,
        descent,
        render: (x, baselineY, glyphs, paths, slots) => {
          const top = baselineY - ascent;
          const bot = baselineY + descent;
          const leftChar = node.style === 'pmatrix' ? '(' : node.style === 'vmatrix' ? '|' : '[';
          const rightChar = node.style === 'pmatrix' ? ')' : node.style === 'vmatrix' ? '|' : ']';

          drawDelimiterPath(leftChar, x + bracketW * 0.45, top, bot, true, paths);
          drawDelimiterPath(rightChar, x + width - bracketW * 0.45, top, bot, false, paths);

          let rowTop = top;
          for (let r = 0; r < numRows; r += 1) {
            const rowBaseY = rowTop + rowAscents[r];
            const rowHeight = rowAscents[r] + rowDescents[r];
            let colX = x + bracketW + padX;
            for (let c = 0; c < numCols; c += 1) {
              const box = cellBoxes[r][c];
              if (box) {
                box.render(colX + (colWidths[c] - box.width) / 2, rowBaseY, glyphs, paths, slots);
              }
              const cellSpan = node.cellSpans?.[r]?.[c];
              if (cellSpan && slots) {
                slots.push({
                  span: cellSpan,
                  x: colX - 4,
                  y: rowTop - 2,
                  width: colWidths[c] + 8,
                  height: rowHeight + 4,
                  label: `(${r + 1},${c + 1})`,
                });
              }
              colX += colWidths[c] + colGap;
            }
            rowTop += rowHeight + rowGap;
          }
        },
      };
    }
  }
}

function drawDelimiterPath(
  char: string,
  cx: number,
  top: number,
  bot: number,
  isLeft: boolean,
  paths: string[],
): void {
  const hook = Math.min(8, Math.max(4, (bot - top) * 0.14));
  if (char === '|') {
    paths.push(`M ${cx.toFixed(2)} ${top.toFixed(2)} L ${cx.toFixed(2)} ${bot.toFixed(2)}`);
    return;
  }
  if (char === '[' || char === ']') {
    const dir = char === '[' ? 1 : -1;
    paths.push(
      `M ${(cx + dir * hook).toFixed(2)} ${top.toFixed(2)} ` +
        `L ${cx.toFixed(2)} ${top.toFixed(2)} ` +
        `L ${cx.toFixed(2)} ${bot.toFixed(2)} ` +
        `L ${(cx + dir * hook).toFixed(2)} ${bot.toFixed(2)}`,
    );
    return;
  }
  // Parenthesis '(' or ')'
  const curveDir = isLeft ? -1 : 1;
  const midY = (top + bot) / 2;
  paths.push(
    `M ${(cx - curveDir * hook * 0.5).toFixed(2)} ${top.toFixed(2)} ` +
      `Q ${(cx + curveDir * hook * 1.1).toFixed(2)} ${midY.toFixed(2)} ` +
      `${(cx - curveDir * hook * 0.5).toFixed(2)} ${bot.toFixed(2)}`,
  );
}

/**
 * Parse `latex` and compute positioned Skia glyphs + SVG vector paths.
 */
export function layoutMathExpression(
  latex: string,
  baseFontSize = 22,
): MathLayoutResult {
  if (!latex.trim()) {
    return {
      width: baseFontSize,
      height: baseFontSize * 1.2,
      baseline: baseFontSize * 0.9,
      glyphs: [],
      slots: [],
      paths: [],
      vectorPathsSvg: '',
    };
  }

  const ast = new LatexParser(latex).parse();
  const rootBox = layoutNode(ast, baseFontSize);
  const glyphs: MathGlyph[] = [];
  const slots: MathEditSlot[] = [];
  const paths: string[] = [];

  rootBox.render(0, rootBox.ascent, glyphs, paths, slots);

  return {
    width: Math.max(12, Math.ceil(rootBox.width)),
    height: Math.max(16, Math.ceil(rootBox.ascent + rootBox.descent)),
    baseline: rootBox.ascent,
    glyphs,
    slots,
    paths,
    vectorPathsSvg: paths.join(' '),
  };
}

/**
 * Find the best editable slot (matrix cell first, then glyph) at `(localX, localY)`.
 */
export function hitTestMathSlot(
  layout: MathLayoutResult,
  localX: number,
  localY: number,
): MathEditSlot | null {
  const pad = 8;
  for (const slot of layout.slots) {
    if (
      localX >= slot.x - pad &&
      localX <= slot.x + slot.width + pad &&
      localY >= slot.y - pad &&
      localY <= slot.y + slot.height + pad
    ) {
      return slot;
    }
  }
  if (layout.slots.length > 0) {
    let bestSlot: MathEditSlot | null = null;
    let bestDistSq = 40 * 40;
    for (const slot of layout.slots) {
      const cx = slot.x + slot.width / 2;
      const cy = slot.y + slot.height / 2;
      const d2 = (localX - cx) * (localX - cx) + (localY - cy) * (localY - cy);
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestSlot = slot;
      }
    }
    if (bestSlot) return bestSlot;
  }

  const glyph = hitTestMathGlyph(layout, localX, localY);
  if (!glyph?.span) return null;
  return {
    span: glyph.span,
    x: glyph.x,
    y: glyph.y,
    width: glyph.width ?? glyph.fontSize * 0.6,
    height: glyph.height ?? glyph.fontSize * 1.02,
  };
}

/**
 * Return all editable slots in source order (matrix cells when present, otherwise glyphs).
 */
export function getEditableMathSlots(layout: MathLayoutResult): readonly MathEditSlot[] {
  if (layout.slots.length > 0) {
    return layout.slots.slice().sort((a, b) => a.span.start - b.span.start);
  }
  return getEditableMathSpans(layout).map((g) => ({
    span: g.span!,
    x: g.x,
    y: g.y,
    width: g.width ?? g.fontSize * 0.6,
    height: g.height ?? g.fontSize * 1.02,
  }));
}

/**
 * Find the rendered glyph (with source span) closest to `(localX, localY)` in
 * layout-local coordinates.
 */
export function hitTestMathGlyph(
  layout: MathLayoutResult,
  localX: number,
  localY: number,
): MathGlyph | null {
  const candidates = layout.glyphs.filter((g) => g.span !== undefined);
  if (candidates.length === 0) return null;

  const pad = 8;
  for (const glyph of candidates) {
    const w = glyph.width ?? glyph.fontSize * 0.6;
    const h = glyph.height ?? glyph.fontSize * 1.02;
    if (
      localX >= glyph.x - pad &&
      localX <= glyph.x + w + pad &&
      localY >= glyph.y - pad &&
      localY <= glyph.y + h + pad
    ) {
      return glyph;
    }
  }

  let best: MathGlyph | null = null;
  let bestDistSq = 36 * 36;
  for (const glyph of candidates) {
    const w = glyph.width ?? glyph.fontSize * 0.6;
    const h = glyph.height ?? glyph.fontSize * 1.02;
    const cx = glyph.x + w / 2;
    const cy = glyph.y + h / 2;
    const dx = localX - cx;
    const dy = localY - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDistSq) {
      bestDistSq = d2;
      best = glyph;
    }
  }
  return best;
}

/**
 * Return all editable glyphs in source order (for Next/Prev stepping).
 */
export function getEditableMathSpans(layout: MathLayoutResult): readonly MathGlyph[] {
  return layout.glyphs
    .filter((g) => g.span !== undefined)
    .slice()
    .sort((a, b) => a.span!.start - b.span!.start);
}

/**
 * Replace `span` inside `latex` with `replacement`, automatically wrapping in
 * `{...}` when a bare `^` or `_` script is replaced by multi-character text.
 */
export function applyMathSpanEdit(
  latex: string,
  span: MathSourceSpan,
  replacement: string,
): { latex: string; span: MathSourceSpan } {
  const prevChar = span.start > 0 ? latex[span.start - 1] : '';
  const needsBraces =
    (prevChar === '^' || prevChar === '_') &&
    replacement.length > 1 &&
    !replacement.startsWith('{') &&
    !replacement.startsWith('\\');

  if (needsBraces) {
    const wrapped = `{${replacement}}`;
    const nextLatex = latex.slice(0, span.start) + wrapped + latex.slice(span.end);
    return {
      latex: nextLatex,
      span: { start: span.start + 1, end: span.start + 1 + replacement.length },
    };
  }

  const nextLatex = latex.slice(0, span.start) + replacement + latex.slice(span.end);
  return {
    latex: nextLatex,
    span: { start: span.start, end: span.start + replacement.length },
  };
}

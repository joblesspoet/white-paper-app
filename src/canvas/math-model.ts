/**
 * Math formula domain model, curriculum templates, and keypad definitions.
 *
 * Pure TypeScript so it can be shared between the Skia layout engine,
 * MathKeyboardSheet, SQLite persistence, and Node verification scripts.
 */

export type MathDomain = 'algebra' | 'trig' | 'calculus' | 'matrices' | 'sets';

export type MathKeyItem = {
  id: string;
  label: string;
  insertLatex: string;
  /** Optional cursor offset from end of inserted string (negative moves left). */
  cursorBack?: number;
  accessibilityLabel: string;
};

export type MathQuickFormula = {
  id: string;
  title: string;
  domain: MathDomain;
  latex: string;
  previewLabel: string;
};

export type MathKeypadTab = {
  id: MathDomain | 'formulas';
  label: string;
  keys: readonly MathKeyItem[];
};

export type MathObjectBase = {
  type: 'math';
  /** Structured math expression (LaTeX-subset string). */
  latex: string;
  /** Plain-text accessible spoken/readable representation. */
  displayText: string;
  colorKey: string;
  fontSize: number;
};

export const MATH_FONT_SIZES = [18, 22, 28] as const;
export const DEFAULT_MATH_FONT_SIZE = 22;

export const MATH_QUICK_FORMULAS: readonly MathQuickFormula[] = [
  {
    id: 'quadratic',
    title: 'Quadratic Formula',
    domain: 'algebra',
    latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    previewLabel: 'x = (-b ± √(b² - 4ac)) / 2a',
  },
  {
    id: 'pythagorean',
    title: 'Pythagorean Theorem',
    domain: 'trig',
    latex: 'a^2 + b^2 = c^2',
    previewLabel: 'a² + b² = c²',
  },
  {
    id: 'law-of-cosines',
    title: 'Law of Cosines',
    domain: 'trig',
    latex: 'c^2 = a^2 + b^2 - 2ab\\cos\\theta',
    previewLabel: 'c² = a² + b² - 2ab cos θ',
  },
  {
    id: 'distance',
    title: 'Distance Formula',
    domain: 'algebra',
    latex: 'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}',
    previewLabel: 'd = √((x₂ - x₁)² + (y₂ - y₁)²)',
  },
  {
    id: 'slope-intercept',
    title: 'Slope-Intercept Form',
    domain: 'algebra',
    latex: 'y = mx + b',
    previewLabel: 'y = mx + b',
  },
  {
    id: 'compound-interest',
    title: 'Compound Interest',
    domain: 'algebra',
    latex: 'A = P\\left(1 + \\frac{r}{n}\\right)^{nt}',
    previewLabel: 'A = P(1 + r/n)^(nt)',
  },
  {
    id: 'derivative-def',
    title: 'Derivative Definition',
    domain: 'calculus',
    latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}",
    previewLabel: "f'(x) = lim(h→0) (f(x+h)-f(x))/h",
  },
  {
    id: 'ftc',
    title: 'Fundamental Theorem of Calculus',
    domain: 'calculus',
    latex: '\\int_{a}^{b} f(x)\\,dx = F(b) - F(a)',
    previewLabel: '∫[a,b] f(x) dx = F(b) - F(a)',
  },
  {
    id: 'gaussian-pdf',
    title: 'Gaussian Normal PDF',
    domain: 'calculus',
    latex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}',
    previewLabel: 'f(x) = 1/(σ√(2π)) e^(-(x-μ)²/(2σ²))',
  },
  {
    id: 'binomial',
    title: 'Binomial Theorem',
    domain: 'algebra',
    latex: '(a + b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k',
    previewLabel: '(a + b)ⁿ = Σ C(n,k) aⁿ⁻ᵏ bᵏ',
  },
  {
    id: 'euler-identity',
    title: "Euler's Identity",
    domain: 'trig',
    latex: 'e^{i\\pi} + 1 = 0',
    previewLabel: 'e^(iπ) + 1 = 0',
  },
  {
    id: 'newtons-second',
    title: "Newton's Second Law",
    domain: 'matrices',
    latex: '\\vec{F} = m \\cdot \\vec{a}',
    previewLabel: 'F⃗ = m · a⃗',
  },
] as const;

export const MATH_KEYPAD_TABS: readonly MathKeypadTab[] = [
  {
    id: 'algebra',
    label: 'Algebra',
    keys: [
      { id: 'frac', label: 'a/b', insertLatex: '\\frac{}{}', cursorBack: 3, accessibilityLabel: 'Fraction' },
      { id: 'sup', label: 'x²', insertLatex: '^{}', cursorBack: 1, accessibilityLabel: 'Superscript exponent' },
      { id: 'sub', label: 'xₙ', insertLatex: '_{}', cursorBack: 1, accessibilityLabel: 'Subscript' },
      { id: 'sqrt', label: '√x', insertLatex: '\\sqrt{}', cursorBack: 1, accessibilityLabel: 'Square root' },
      { id: 'nrt', label: 'ⁿ√x', insertLatex: '\\sqrt[n]{}', cursorBack: 1, accessibilityLabel: 'Nth root' },
      { id: 'abs', label: '|x|', insertLatex: '|x|', cursorBack: 1, accessibilityLabel: 'Absolute value' },
      { id: 'pm', label: '±', insertLatex: ' \\pm ', accessibilityLabel: 'Plus or minus' },
      { id: 'times', label: '×', insertLatex: ' \\times ', accessibilityLabel: 'Multiply' },
      { id: 'div', label: '÷', insertLatex: ' \\div ', accessibilityLabel: 'Divide' },
      { id: 'leq', label: '≤', insertLatex: ' \\le ', accessibilityLabel: 'Less than or equal' },
      { id: 'geq', label: '≥', insertLatex: ' \\ge ', accessibilityLabel: 'Greater than or equal' },
      { id: 'neq', label: '≠', insertLatex: ' \\neq ', accessibilityLabel: 'Not equal' },
      { id: 'approx', label: '≈', insertLatex: ' \\approx ', accessibilityLabel: 'Approximately equal' },
      { id: 'parens', label: '( )', insertLatex: '\\left(\\right)', cursorBack: 7, accessibilityLabel: 'Parentheses' },
      { id: 'plus', label: '+', insertLatex: ' + ', accessibilityLabel: 'Plus' },
      { id: 'minus', label: '−', insertLatex: ' - ', accessibilityLabel: 'Minus' },
      { id: 'eq', label: '=', insertLatex: ' = ', accessibilityLabel: 'Equals' },
      { id: 'x', label: 'x', insertLatex: 'x', accessibilityLabel: 'Variable x' },
      { id: 'y', label: 'y', insertLatex: 'y', accessibilityLabel: 'Variable y' },
      { id: 'n', label: 'n', insertLatex: 'n', accessibilityLabel: 'Variable n' },
    ],
  },
  {
    id: 'trig',
    label: 'Trig',
    keys: [
      { id: 'sin', label: 'sin', insertLatex: '\\sin ', accessibilityLabel: 'Sine' },
      { id: 'cos', label: 'cos', insertLatex: '\\cos ', accessibilityLabel: 'Cosine' },
      { id: 'tan', label: 'tan', insertLatex: '\\tan ', accessibilityLabel: 'Tangent' },
      { id: 'cot', label: 'cot', insertLatex: '\\cot ', accessibilityLabel: 'Cotangent' },
      { id: 'sec', label: 'sec', insertLatex: '\\sec ', accessibilityLabel: 'Secant' },
      { id: 'csc', label: 'csc', insertLatex: '\\csc ', accessibilityLabel: 'Cosecant' },
      { id: 'asin', label: 'sin⁻¹', insertLatex: '\\sin^{-1}', accessibilityLabel: 'Inverse sine' },
      { id: 'pi', label: 'π', insertLatex: '\\pi', accessibilityLabel: 'Pi' },
      { id: 'theta', label: 'θ', insertLatex: '\\theta', accessibilityLabel: 'Theta' },
      { id: 'alpha', label: 'α', insertLatex: '\\alpha', accessibilityLabel: 'Alpha' },
      { id: 'beta', label: 'β', insertLatex: '\\beta', accessibilityLabel: 'Beta' },
      { id: 'gamma', label: 'γ', insertLatex: '\\gamma', accessibilityLabel: 'Gamma' },
      { id: 'delta', label: 'Δ', insertLatex: '\\Delta', accessibilityLabel: 'Delta' },
      { id: 'deg', label: '°', insertLatex: '^\\circ', accessibilityLabel: 'Degrees' },
      { id: 'angle', label: '∠', insertLatex: '\\angle ', accessibilityLabel: 'Angle' },
      { id: 'perp', label: '⊥', insertLatex: ' \\perp ', accessibilityLabel: 'Perpendicular' },
      { id: 'parallel', label: '∥', insertLatex: ' \\parallel ', accessibilityLabel: 'Parallel' },
      { id: 'cong', label: '≅', insertLatex: ' \\cong ', accessibilityLabel: 'Congruent' },
      { id: 'sim', label: '∼', insertLatex: ' \\sim ', accessibilityLabel: 'Similar' },
    ],
  },
  {
    id: 'calculus',
    label: 'Calculus',
    keys: [
      { id: 'int-def', label: '∫ₐᵇ', insertLatex: '\\int_{a}^{b} ', accessibilityLabel: 'Definite integral' },
      { id: 'int', label: '∫', insertLatex: '\\int ', accessibilityLabel: 'Indefinite integral' },
      { id: 'sum', label: 'Σ', insertLatex: '\\sum_{i=1}^{n} ', accessibilityLabel: 'Summation' },
      { id: 'prod', label: '∏', insertLatex: '\\prod_{i=1}^{n} ', accessibilityLabel: 'Product' },
      { id: 'lim', label: 'lim', insertLatex: '\\lim_{x \\to 0} ', accessibilityLabel: 'Limit' },
      { id: 'dydx', label: 'dy/dx', insertLatex: '\\frac{dy}{dx}', accessibilityLabel: 'Derivative dy by dx' },
      { id: 'partial-frac', label: '∂f/∂x', insertLatex: '\\frac{\\partial f}{\\partial x}', accessibilityLabel: 'Partial derivative' },
      { id: 'prime', label: "f'(x)", insertLatex: "f'(x)", accessibilityLabel: 'Prime notation' },
      { id: 'dx', label: 'dx', insertLatex: '\\,dx', accessibilityLabel: 'Differential dx' },
      { id: 'infty', label: '∞', insertLatex: '\\infty', accessibilityLabel: 'Infinity' },
      { id: 'partial', label: '∂', insertLatex: '\\partial ', accessibilityLabel: 'Partial symbol' },
      { id: 'nabla', label: '∇', insertLatex: '\\nabla ', accessibilityLabel: 'Nabla gradient' },
      { id: 'to', label: '→', insertLatex: ' \\to ', accessibilityLabel: 'Approaches' },
      { id: 'log', label: 'log', insertLatex: '\\log ', accessibilityLabel: 'Logarithm' },
      { id: 'ln', label: 'ln', insertLatex: '\\ln ', accessibilityLabel: 'Natural logarithm' },
      { id: 'sigma', label: 'σ', insertLatex: '\\sigma', accessibilityLabel: 'Sigma' },
      { id: 'mu', label: 'μ', insertLatex: '\\mu', accessibilityLabel: 'Mu' },
    ],
  },
  {
    id: 'matrices',
    label: 'Matrices & Sets',
    keys: [
      { id: 'mat2', label: '[2×2]', insertLatex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', accessibilityLabel: '2 by 2 matrix' },
      { id: 'mat3', label: '[3×3]', insertLatex: '\\begin{bmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{bmatrix}', accessibilityLabel: '3 by 3 matrix' },
      { id: 'det2', label: '|2×2|', insertLatex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}', accessibilityLabel: '2 by 2 determinant' },
      { id: 'binom', label: 'nCk', insertLatex: '\\binom{n}{k}', accessibilityLabel: 'Binomial coefficient' },
      { id: 'vec', label: 'v⃗', insertLatex: '\\vec{v}', accessibilityLabel: 'Vector arrow' },
      { id: 'in', label: '∈', insertLatex: ' \\in ', accessibilityLabel: 'Element of' },
      { id: 'notin', label: '∉', insertLatex: ' \\notin ', accessibilityLabel: 'Not element of' },
      { id: 'subset', label: '⊂', insertLatex: ' \\subset ', accessibilityLabel: 'Proper subset' },
      { id: 'subseteq', label: '⊆', insertLatex: ' \\subseteq ', accessibilityLabel: 'Subset or equal' },
      { id: 'cup', label: '∪', insertLatex: ' \\cup ', accessibilityLabel: 'Union' },
      { id: 'cap', label: '∩', insertLatex: ' \\cap ', accessibilityLabel: 'Intersection' },
      { id: 'empty', label: '∅', insertLatex: '\\emptyset', accessibilityLabel: 'Empty set' },
      { id: 'forall', label: '∀', insertLatex: '\\forall ', accessibilityLabel: 'For all' },
      { id: 'exists', label: '∃', insertLatex: '\\exists ', accessibilityLabel: 'There exists' },
      { id: 'implies', label: '⇒', insertLatex: ' \\Rightarrow ', accessibilityLabel: 'Implies' },
      { id: 'iff', label: '⇔', insertLatex: ' \\Leftrightarrow ', accessibilityLabel: 'If and only if' },
      { id: 'reals', label: 'ℝ', insertLatex: '\\mathbb{R}', accessibilityLabel: 'Real numbers' },
      { id: 'ints', label: 'ℤ', insertLatex: '\\mathbb{Z}', accessibilityLabel: 'Integers' },
      { id: 'nats', label: 'ℕ', insertLatex: '\\mathbb{N}', accessibilityLabel: 'Natural numbers' },
    ],
  },
  {
    id: 'formulas',
    label: 'Formulas',
    keys: [],
  },
] as const;

const SYMBOL_TEXT_REPLACEMENTS: readonly [RegExp, string][] = [
  [/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)'],
  [/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, '$1√($2)'],
  [/\\sqrt\{([^{}]+)\}/g, '√($1)'],
  [/\\vec\{([^{}]+)\}/g, '$1⃗'],
  [/\\binom\{([^{}]+)\}\{([^{}]+)\}/g, 'C($1, $2)'],
  [/\\mathbb\{R\}/g, 'ℝ'],
  [/\\mathbb\{Z\}/g, 'ℤ'],
  [/\\mathbb\{N\}/g, 'ℕ'],
  [/\\alpha/g, 'α'],
  [/\\beta/g, 'β'],
  [/\\gamma/g, 'γ'],
  [/\\delta/g, 'δ'],
  [/\\Delta/g, 'Δ'],
  [/\\theta/g, 'θ'],
  [/\\lambda/g, 'λ'],
  [/\\mu/g, 'μ'],
  [/\\pi/g, 'π'],
  [/\\sigma/g, 'σ'],
  [/\\phi/g, 'φ'],
  [/\\omega/g, 'ω'],
  [/\\Omega/g, 'Ω'],
  [/\\pm/g, '±'],
  [/\\mp/g, '∓'],
  [/\\times/g, '×'],
  [/\\div/g, '÷'],
  [/\\cdot/g, '·'],
  [/\\le/g, '≤'],
  [/\\ge/g, '≥'],
  [/\\neq/g, '≠'],
  [/\\approx/g, '≈'],
  [/\\equiv/g, '≡'],
  [/\\to/g, '→'],
  [/\\Rightarrow/g, '⇒'],
  [/\\Leftrightarrow/g, '⇔'],
  [/\\infty/g, '∞'],
  [/\\partial/g, '∂'],
  [/\\nabla/g, '∇'],
  [/\\sum/g, 'Σ'],
  [/\\int/g, '∫'],
  [/\\prod/g, 'Π'],
  [/\\in/g, '∈'],
  [/\\notin/g, '∉'],
  [/\\subseteq/g, '⊆'],
  [/\\subset/g, '⊂'],
  [/\\cup/g, '∪'],
  [/\\cap/g, '∩'],
  [/\\emptyset/g, '∅'],
  [/\\forall/g, '∀'],
  [/\\exists/g, '∃'],
  [/\\angle/g, '∠'],
  [/\\perp/g, '⊥'],
  [/\\parallel/g, '∥'],
  [/\\cong/g, '≅'],
  [/\\sim/g, '∼'],
  [/\\circ/g, '°'],
  [/\\left|\\right|/g, '|'],
  [/\\left/g, ''],
  [/\\right/g, ''],
  [/\\,/g, ' '],
  [/\\begin\{[a-z]+\}/g, '['],
  [/\\end\{[a-z]+\}/g, ']'],
  [/\\\\/g, '; '],
  [/&/g, ', '],
  [/\\([a-zA-Z]+)/g, '$1'],
  [/[{}]/g, ''],
];

/** Convert a LaTeX-subset string into a readable plain-text string for accessibility. */
export function latexToDisplayText(latex: string): string {
  let out = latex.trim();
  for (let pass = 0; pass < 3; pass += 1) {
    for (const [pattern, replacement] of SYMBOL_TEXT_REPLACEMENTS) {
      out = out.replace(pattern, replacement);
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

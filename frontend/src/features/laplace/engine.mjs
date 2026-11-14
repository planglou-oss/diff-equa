// Calculation engine extracted from the user-provided Laplace_tools.html.
'use strict';

/* =====================================================================
 * 1. EXACT RATIONAL & NUMBER HELPERS
 * ===================================================================== */
const EPS = 1e-10;

function gcd(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

// Approximate real number as rational p/q if denominator <= 10000
function toRational(x) {
  if (!Number.isFinite(x)) return null;
  if (Math.abs(x) < EPS) return { n: 0, d: 1 };
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  if (Math.abs(ax - Math.round(ax)) < EPS) {
    return { n: sign * Math.round(ax), d: 1 };
  }
  let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
  let b = ax;
  for (let i = 0; i < 18; i++) {
    const a = Math.floor(b);
    const h = a * h1 + h2;
    const k = a * k1 + k2;
    if (k > 10000) break;
    h2 = h1; h1 = h;
    k2 = k1; k1 = k;
    if (Math.abs(ax - h / k) < 1e-9) {
      const g = gcd(h, k);
      return { n: sign * (h / g), d: k / g };
    }
    const rem = b - a;
    if (Math.abs(rem) < 1e-12) break;
    b = 1 / rem;
  }
  return null;
}

function formatNumberPlain(x) {
  if (Math.abs(x) < EPS) return '0';
  const r = toRational(x);
  if (r) {
    if (r.d === 1) return String(r.n);
    return r.n + '/' + r.d;
  }
  return Number(x.toPrecision(6)).toString();
}

function formatNumberTex(x) {
  if (Math.abs(x) < EPS) return '0';
  // Check multiples of pi
  const piRatio = toRational(x / Math.PI);
  if (piRatio && Math.abs(piRatio.n) <= 24 && piRatio.d <= 24) {
    const sign = piRatio.n < 0 ? '-' : '';
    const an = Math.abs(piRatio.n);
    const numStr = an === 1 ? '\\pi' : an + '\\pi';
    if (piRatio.d === 1) return sign + numStr;
    return sign + '\\frac{' + numStr + '}{' + piRatio.d + '}';
  }
  const r = toRational(x);
  if (r) {
    if (r.d === 1) return String(r.n);
    const sign = r.n < 0 ? '-' : '';
    return sign + '\\frac{' + Math.abs(r.n) + '}{' + r.d + '}';
  }
  const formatted = Number(x.toPrecision(6)).toString();
  return formatted.replace(/^(.+)e([+-]?\d+)$/, (_, mantissa, power) => mantissa + '\\times 10^{' + Number(power) + '}');
}

function factorial(n) {
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

// Lanczos approximation for Gamma(z), z > 0
function gammaFunc(z) {
  const g = 7;
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gammaFunc(1 - z));
  }
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) {
    x += p[i] / (z + i);
  }
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

/* =====================================================================
 * 2. SPECIAL MATH FUNCTIONS (REAL EVALUATION FOR NUMERICAL ENGINE)
 * ===================================================================== */
const EULER_GAMMA = 0.5772156649015329;

function erfReal(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

function erfcReal(x) {
  return 1 - erfReal(x);
}

function besselJ0(x) {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const num = 57568490574.0 + y * (-13362590354.0 + y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 + y * (-184.9052456)))));
    const den = 57568490411.0 + y * (1029532985.0 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y))));
    return num / den;
  }
  const z = 8 / ax;
  const y = z * z;
  const xx = ax - 0.785398164;
  const p = 1 + y * (-0.1098628627e-2 + y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
  const q = -0.1562499995e-1 + y * (0.1430488765e-3 + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934945152e-7)));
  return Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q);
}

function besselJ1(x) {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const num = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.48260 + y * (-30.16036606))))));
    const den = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return num / den;
  }
  const z = 8 / ax;
  const y = z * z;
  const xx = ax - 2.356194491;
  const p = 1 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * (-0.240337019e-6))));
  const q = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q);
  return x < 0 ? -ans : ans;
}

function besselI0(x) {
  const ax = Math.abs(x);
  if (ax < 3.75) {
    const y = (x / 3.75) * (x / 3.75);
    return 1 + y * (3.5156229 + y * (3.0899424 + y * (1.2067492 + y * (0.2659732 + y * (0.0360768 + y * 0.0045813)))));
  }
  const y = 3.75 / ax;
  return (Math.exp(ax) / Math.sqrt(ax)) * (0.39894228 + y * (0.01328592 + y * (0.00225319 + y * (-0.00157565 + y * (0.00916281 + y * (-0.02057706 + y * (0.02635537 + y * (-0.01647633 + y * 0.00392377))))))));
}

function sineIntegral(x) {
  if (Math.abs(x) < 1e-12) return 0;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  if (ax <= 4) {
    let sum = ax, term = ax;
    for (let k = 1; k <= 25; k++) {
      term *= -(ax * ax) / ((2 * k) * (2 * k + 1));
      sum += term / (2 * k + 1);
      if (Math.abs(term) < 1e-14) break;
    }
    return sign * sum;
  }
  const inv = 1 / (ax * ax);
  const fApprox = (1 / ax) * (1 - 2 * inv + 24 * inv * inv);
  const gApprox = inv * (1 - 6 * inv + 120 * inv * inv);
  return sign * (Math.PI / 2 - fApprox * Math.cos(ax) - gApprox * Math.sin(ax));
}

function cosineIntegral(x) {
  const ax = Math.abs(x);
  if (ax < 1e-12) return -1e99;
  if (ax <= 4) {
    let sum = EULER_GAMMA + Math.log(ax);
    let term = 1;
    for (let k = 1; k <= 25; k++) {
      term *= -(ax * ax) / ((2 * k - 1) * (2 * k));
      sum += term / (2 * k);
      if (Math.abs(term) < 1e-14) break;
    }
    return sum;
  }
  const inv = 1 / (ax * ax);
  const fApprox = (1 / ax) * (1 - 2 * inv + 24 * inv * inv);
  const gApprox = inv * (1 - 6 * inv + 120 * inv * inv);
  return fApprox * Math.sin(ax) - gApprox * Math.cos(ax);
}

/* =====================================================================
 * 3. TOKENIZER & PARSER (EXTENDED SYNTAX & UNICODE SYMBOLS)
 * ===================================================================== */
const FUNC_ALIASES = {
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
  arcsin: 'asin', asin: 'asin', arccos: 'acos', acos: 'acos', arctan: 'atan', atan: 'atan',
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', coth: 'coth', sech: 'sech', csch: 'csch',
  arcsinh: 'asinh', asinh: 'asinh', arccosh: 'acosh', acosh: 'acosh', arctanh: 'atanh', atanh: 'atanh',
  exp: 'exp', ln: 'ln', log: 'log', sqrt: 'sqrt', cbrt: 'cbrt', abs: 'abs',
  u: 'u', heaviside: 'u', step: 'u',
  delta: 'delta', dirac: 'delta',
  sinc: 'sinc',
  j0: 'j0', besselj0: 'j0',
  j1: 'j1', besselj1: 'j1',
  i0: 'i0', besseli0: 'i0',
  erf: 'erf', erfc: 'erfc',
  si: 'si', ci: 'ci',
  rect: 'rect', boxcar: 'rect',
  tri: 'tri',
  floor: 'floor', ceil: 'ceil',
  sawtooth: 'sawtooth', saw: 'sawtooth',
  square: 'square', sq: 'square',
  sgn: 'sgn', sign: 'sgn'
};
const KNOWN_CONSTS = new Set(['pi', 'e', 'gamma']);

function normalizeUnicodeMath(raw) {
  let s = raw
    .replace(/−/g, '-')
    .replace(/×|·/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/δ/g, 'delta')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([a-zA-Z0-9_.]+)/g, 'sqrt($1)')
    .replace(/∛\s*\(/g, 'cbrt(')
    .replace(/∛\s*([a-zA-Z0-9_.]+)/g, 'cbrt($1)')
    .replace(/⌊([^⌋]+)⌋/g, 'floor($1)')
    .replace(/⌈([^⌉]+)⌉/g, 'ceil($1)');

  // Superscript digits e.g. t² -> t^(2), t⁻³ -> t^(-3)
  const supMap = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, function (m) {
    let digits = '';
    for (const ch of m) digits += supMap[ch] || '';
    return '^(' + digits + ')';
  });

  // Convert |expr| into abs(expr) with proper nesting
  let out = '';
  let barDepth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '|') {
      const prevTrim = out.trimEnd();
      const prevChar = prevTrim[prevTrim.length - 1] || '';
      const isOpen = barDepth === 0 || '([+-*/^=,'.includes(prevChar) || prevChar === '';
      if (isOpen) {
        out += 'abs(';
        barDepth++;
      } else {
        out += ')';
        barDepth = Math.max(0, barDepth - 1);
      }
    } else {
      out += s[i];
    }
  }
  while (barDepth > 0) {
    out += ')';
    barDepth--;
  }
  return out;
}

function tokenize(raw, varName = 't') {
  const otherVar = varName === 't' ? 's' : 't';
  const str = normalizeUnicodeMath(raw);
  const rawTokens = [];
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(str[i + 1] || ''))) {
      let numStr = '';
      let dotCount = 0;
      while (i < str.length && (/\d/.test(str[i]) || str[i] === '.')) {
        if (str[i] === '.') dotCount++;
        if (dotCount > 1) throw new Error('รูปแบบตัวเลขทศนิยมไม่ถูกต้อง');
        numStr += str[i++];
      }
      rawTokens.push({ type: 'num', value: parseFloat(numStr) });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < str.length && /[a-zA-Z0-9_]/.test(str[i])) {
        id += str[i++];
      }
      const lower = id.toLowerCase();

      if (lower === varName) {
        rawTokens.push({ type: 'var', value: varName });
        continue;
      }
      if (KNOWN_CONSTS.has(lower)) {
        rawTokens.push({ type: 'const', value: lower });
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(FUNC_ALIASES, lower)) {
        rawTokens.push({ type: 'func', value: FUNC_ALIASES[lower] });
        continue;
      }
      // Handle shorthand like tsin(2t), se^(-2s), ss, tt
      if (lower.length > 1 && lower[0] === varName) {
        const rest = lower.slice(1);
        if (rest === varName) {
          rawTokens.push({ type: 'var', value: varName });
          rawTokens.push({ type: 'var', value: varName });
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(FUNC_ALIASES, rest)) {
          rawTokens.push({ type: 'var', value: varName });
          rawTokens.push({ type: 'func', value: FUNC_ALIASES[rest] });
          continue;
        }
        if (KNOWN_CONSTS.has(rest)) {
          rawTokens.push({ type: 'var', value: varName });
          rawTokens.push({ type: 'const', value: rest });
          continue;
        }
      }
      if (lower === otherVar) {
        if (varName === 't') {
          throw new Error('พบตัวแปร "s" ในอินพุต กรุณาป้อนฟังก์ชันในโดเมนเวลาโดยใช้ตัวแปร "t" (หรือสลับไปโหมดแปลงผกผัน ℒ⁻¹{F(s)})');
        }
        throw new Error('พบตัวแปร "t" ในอินพุต โหมดแปลงผกผันกรุณาป้อนฟังก์ชันในโดเมนความถี่โดยใช้ตัวแปร "s"');
      }
      throw new Error('ไม่รู้จักตัวแปรหรือฟังก์ชัน "' + id + '" (กรุณาใช้ตัวแปร "' + varName + '" หรือเลือกฟังก์ชันจากแป้นพิมพ์สัญลักษณ์)');
    }
    if ('+-*/^'.includes(ch)) {
      rawTokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      rawTokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      rawTokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }
    throw new Error('พบอักขระที่ไม่รองรับ: "' + ch + '"');
  }

  // Rewrite function powers like sin^2(2t) -> (sin(2t))^2
  const expandedTrigPow = rewriteFuncPowers(rawTokens);

  // Insert implicit multiplication '*'
  const tokens = [];
  for (let k = 0; k < expandedTrigPow.length; k++) {
    const curr = expandedTrigPow[k];
    if (tokens.length > 0) {
      const prev = tokens[tokens.length - 1];
      const prevCanEnd = (
        prev.type === 'num' ||
        prev.type === 'var' ||
        prev.type === 'const' ||
        prev.type === 'rparen'
      );
      const currCanStart = (
        curr.type === 'num' ||
        curr.type === 'var' ||
        curr.type === 'const' ||
        curr.type === 'func' ||
        curr.type === 'lparen'
      );
      if (prevCanEnd && currCanStart) {
        tokens.push({ type: 'op', value: '*' });
      }
    }
    tokens.push(curr);
  }
  return tokens;
}

function rewriteFuncPowers(tokens) {
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    if (
      tokens[i].type === 'func' &&
      i + 3 < tokens.length &&
      tokens[i + 1].type === 'op' && tokens[i + 1].value === '^' &&
      tokens[i + 2].type === 'num' &&
      tokens[i + 3].type === 'lparen'
    ) {
      const fnTok = tokens[i];
      const powTok = tokens[i + 2];
      let depth = 0;
      let j = i + 3;
      while (j < tokens.length) {
        if (tokens[j].type === 'lparen') depth++;
        else if (tokens[j].type === 'rparen') {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      if (j >= tokens.length) {
        throw new Error('วงเล็บเปิดและวงเล็บปิดไม่สมดุลกัน');
      }
      const innerSlice = rewriteFuncPowers(tokens.slice(i + 4, j));
      out.push({ type: 'lparen', value: '(' });
      out.push(fnTok);
      out.push({ type: 'lparen', value: '(' });
      for (const t of innerSlice) out.push(t);
      out.push({ type: 'rparen', value: ')' });
      out.push({ type: 'rparen', value: ')' });
      out.push({ type: 'op', value: '^' });
      out.push(powTok);
      i = j + 1;
    } else {
      out.push(tokens[i]);
      i++;
    }
  }
  return out;
}

function parseExpression(raw, varName = 't') {
  const cleaned = raw.replace(/^\s*(?:[fygFHYG]\s*\(\s*[ts]\s*\)|[fygFHYG])\s*=\s*/, '');
  const tokens = tokenize(cleaned, varName);
  if (tokens.length === 0) {
    throw new Error(varName === 't' ? 'กรุณาป้อนฟังก์ชัน f(t)' : 'กรุณาป้อนฟังก์ชัน F(s)');
  }
  let pos = 0;

  function peek() { return tokens[pos] || null; }
  function consume() { return tokens[pos++]; }

  function parseAddSub() {
    let left = parseMulDiv();
    while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseMulDiv();
      left = { type: 'bin', op, left, right };
    }
    return left;
  }

  function parseMulDiv() {
    let left = parseUnary();
    while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
      const op = consume().value;
      const right = parseUnary();
      left = { type: 'bin', op, left, right };
    }
    return left;
  }

  function parseUnary() {
    if (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const arg = parseUnary();
      return op === '-' ? { type: 'neg', arg } : arg;
    }
    return parsePower();
  }

  function parsePower() {
    const base = parsePrimary();
    if (peek() && peek().type === 'op' && peek().value === '^') {
      consume();
      const exp = parseUnary();
      if (base.type === 'const' && base.name === 'e') {
        return { type: 'call', fn: 'exp', arg: exp };
      }
      return { type: 'bin', op: '^', left: base, right: exp };
    }
    return base;
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) {
      throw new Error('นิพจน์ไม่สมบูรณ์ กรุณาตรวจสอบตัวดำเนินการท้ายสมการ');
    }
    if (tok.type === 'num') {
      consume();
      return { type: 'num', value: tok.value };
    }
    if (tok.type === 'var') {
      consume();
      return { type: 'var' };
    }
    if (tok.type === 'const') {
      consume();
      if (tok.value === 'pi') return { type: 'const', name: 'pi', value: Math.PI };
      if (tok.value === 'e') return { type: 'const', name: 'e', value: Math.E };
      if (tok.value === 'gamma') return { type: 'const', name: 'gamma', value: EULER_GAMMA };
    }
    if (tok.type === 'func') {
      const fnName = consume().value;
      if (!peek() || peek().type !== 'lparen') {
        throw new Error('ฟังก์ชัน "' + fnName + '" ต้องตามด้วยวงเล็บ เช่น ' + fnName + '(t)');
      }
      consume(); // '('
      if (peek() && peek().type === 'rparen') {
        throw new Error('ภายในวงเล็บของ "' + fnName + '()" ต้องมีอาร์กิวเมนต์');
      }
      const arg = parseAddSub();
      if (!peek() || peek().type !== 'rparen') {
        throw new Error('กรุณาใส่วงเล็บปิด ")" ให้ครบสำหรับฟังก์ชัน ' + fnName);
      }
      consume(); // ')'
      if (fnName === 'sqrt') {
        return { type: 'bin', op: '^', left: arg, right: { type: 'num', value: 0.5 } };
      }
      if (fnName === 'cbrt') {
        return { type: 'bin', op: '^', left: arg, right: { type: 'num', value: 1 / 3 } };
      }
      return { type: 'call', fn: fnName, arg };
    }
    if (tok.type === 'lparen') {
      consume();
      if (peek() && peek().type === 'rparen') {
        throw new Error('พบวงเล็บว่าง "()"');
      }
      const inner = parseAddSub();
      if (!peek() || peek().type !== 'rparen') {
        throw new Error('วงเล็บเปิดและวงเล็บปิดไม่สมดุลกัน');
      }
      consume();
      return inner;
    }
    throw new Error('รูปแบบนิพจน์ไม่ถูกต้องบริเวณ "' + tok.value + '"');
  }

  const ast = parseAddSub();
  if (pos < tokens.length) {
    throw new Error('นิพจน์ไม่ถูกต้องบริเวณ "' + tokens[pos].value + '"');
  }
  return ast;
}

/* =====================================================================
 * 3. AST UTILITIES & ALGEBRAIC EXPANSION
 * ===================================================================== */
function dependsOnT(node) {
  switch (node.type) {
    case 'num':
    case 'const':
      return false;
    case 'var':
      return true;
    case 'neg':
      return dependsOnT(node.arg);
    case 'bin':
      return dependsOnT(node.left) || dependsOnT(node.right);
    case 'call':
      return dependsOnT(node.arg);
    default:
      return false;
  }
}

function evalAt(node, tVal) {
  switch (node.type) {
    case 'num':
      return node.value;
    case 'const':
      return node.value;
    case 'var':
      return tVal;
    case 'neg':
      return -evalAt(node.arg, tVal);
    case 'bin': {
      const l = evalAt(node.left, tVal);
      const r = evalAt(node.right, tVal);
      if (node.op === '+') return l + r;
      if (node.op === '-') return l - r;
      if (node.op === '*') return l * r;
      if (node.op === '/') {
        if (Math.abs(r) < 1e-14) throw new Error('พบการหารด้วยศูนย์');
        return l / r;
      }
      if (node.op === '^') {
        const val = Math.pow(l, r);
        if (!Number.isFinite(val)) throw new Error('ค่าเลขยกกำลังไม่เป็นจำนวนจริง');
        return val;
      }
      break;
    }
    case 'call': {
      const a = evalAt(node.arg, tVal);
      switch (node.fn) {
        case 'sin': return Math.sin(a);
        case 'cos': return Math.cos(a);
        case 'tan': return Math.tan(a);
        case 'cot': return 1 / Math.tan(a);
        case 'sec': return 1 / Math.cos(a);
        case 'csc': return 1 / Math.sin(a);
        case 'asin': return Math.asin(a);
        case 'acos': return Math.acos(a);
        case 'atan': return Math.atan(a);
        case 'sinh': return Math.sinh(a);
        case 'cosh': return Math.cosh(a);
        case 'tanh': return Math.tanh(a);
        case 'coth': return 1 / Math.tanh(a);
        case 'sech': return 1 / Math.cosh(a);
        case 'csch': return 1 / Math.sinh(a);
        case 'asinh': return Math.asinh(a);
        case 'acosh': return Math.acosh(a);
        case 'atanh': return Math.atanh(a);
        case 'exp': return Math.exp(a);
        case 'ln': return Math.log(a);
        case 'log': return Math.log10(a);
        case 'abs': return Math.abs(a);
        case 'u': return a >= 0 ? 1 : 0;
        case 'sinc': return Math.abs(a) < 1e-12 ? 1 : Math.sin(a) / a;
        case 'j0': return besselJ0(a);
        case 'j1': return besselJ1(a);
        case 'i0': return besselI0(a);
        case 'erf': return erfReal(a);
        case 'erfc': return erfcReal(a);
        case 'si': return sineIntegral(a);
        case 'ci': return cosineIntegral(a);
        case 'rect': return (a >= 0 && a < 1) ? 1 : 0;
        case 'tri': return (a >= 0 && a < 1) ? a : ((a >= 1 && a < 2) ? (2 - a) : 0);
        case 'floor': return Math.floor(a);
        case 'ceil': return Math.ceil(a);
        case 'sawtooth': return a - Math.floor(a);
        case 'square': return (Math.floor(a) % 2 === 0) ? 1 : -1;
        case 'sgn': return a > 0 ? 1 : (a < 0 ? -1 : 0);
        case 'delta': throw new Error('ไม่สามารถประเมินค่า delta เชิงตัวเลขโดยตรงได้');
      }
      break;
    }
  }
  throw new Error('ไม่สามารถคำนวณค่าคงที่ได้');
}

function substituteTShift(node, shift) {
  // Replaces t with (t + shift)
  if (Math.abs(shift) < EPS) return node;
  switch (node.type) {
    case 'num':
    case 'const':
      return node;
    case 'var':
      return {
        type: 'bin',
        op: '+',
        left: { type: 'var' },
        right: { type: 'num', value: shift }
      };
    case 'neg':
      return { type: 'neg', arg: substituteTShift(node.arg, shift) };
    case 'bin':
      return {
        type: 'bin',
        op: node.op,
        left: substituteTShift(node.left, shift),
        right: substituteTShift(node.right, shift)
      };
    case 'call':
      return {
        type: 'call',
        fn: node.fn,
        arg: substituteTShift(node.arg, shift)
      };
  }
  return node;
}

// Extract linear form a*t + b from an AST node; returns { a, b } or null
function extractLinearT(node) {
  const terms = expandToSumOfProducts(node);
  let a = 0;
  let b = 0;
  for (const term of terms) {
    if (term.factors.length === 0) {
      b += term.coeff;
    } else if (term.factors.length === 1 && term.factors[0].kind === 'powT' && Math.abs(term.factors[0].p - 1) < EPS) {
      a += term.coeff;
    } else {
      return null;
    }
  }
  return { a, b };
}

// Expand an AST node into an array of { coeff: number, factors: Factor[] }
// Factor kinds:
//   { kind: 'powT', p: number }
//   { kind: 'exp', rate: number }          // e^(rate * t)
//   { kind: 'sin', w: number }             // sin(w * t), w > 0
//   { kind: 'cos', w: number }             // cos(w * t), w > 0
//   { kind: 'sinh', a: number }            // sinh(a * t), a > 0
//   { kind: 'cosh', a: number }            // cosh(a * t), a > 0
//   { kind: 'u', delay: number }           // u(t - delay)
//   { kind: 'delta', delay: number }       // delta(t - delay)
function expandToSumOfProducts(node) {
  if (!dependsOnT(node)) {
    return [{ coeff: evalAt(node, 0), factors: [] }];
  }

  if (node.type === 'var') {
    return [{ coeff: 1, factors: [{ kind: 'powT', p: 1 }] }];
  }

  if (node.type === 'neg') {
    return expandToSumOfProducts(node.arg).map(term => ({
      coeff: -term.coeff,
      factors: term.factors.slice()
    }));
  }

  if (node.type === 'bin') {
    if (node.op === '+') {
      return combineTerms([
        ...expandToSumOfProducts(node.left),
        ...expandToSumOfProducts(node.right)
      ]);
    }
    if (node.op === '-') {
      const rTerms = expandToSumOfProducts(node.right).map(t => ({
        coeff: -t.coeff,
        factors: t.factors.slice()
      }));
      return combineTerms([...expandToSumOfProducts(node.left), ...rTerms]);
    }
    if (node.op === '*') {
      return multiplyTermLists(
        expandToSumOfProducts(node.left),
        expandToSumOfProducts(node.right)
      );
    }
    if (node.op === '/') {
      if (!dependsOnT(node.right)) {
        const denom = evalAt(node.right, 0);
        if (Math.abs(denom) < 1e-14) throw new Error('พบการหารด้วยศูนย์');
        return expandToSumOfProducts(node.left).map(t => ({
          coeff: t.coeff / denom,
          factors: t.factors.slice()
        }));
      }
      // Handle division by single-term t^p or e^(a*t)
      const denTerms = expandToSumOfProducts(node.right);
      if (denTerms.length === 1 && Math.abs(denTerms[0].coeff) > 1e-14) {
        const invFactors = [];
        let ok = true;
        for (const f of denTerms[0].factors) {
          if (f.kind === 'powT') {
            invFactors.push({ kind: 'powT', p: -f.p });
          } else if (f.kind === 'exp') {
            invFactors.push({ kind: 'exp', rate: -f.rate });
          } else {
            ok = false;
            break;
          }
        }
        if (ok) {
          return multiplyTermLists(
            expandToSumOfProducts(node.left),
            [{ coeff: 1 / denTerms[0].coeff, factors: invFactors }]
          );
        }
      }
      throw new Error('ไม่รองรับการหารด้วยนิพจน์ของ t ที่ซับซ้อน (ยกเว้นการหารด้วยค่าคงที่, t^p หรือ e^(a*t))');
    }
    if (node.op === '^') {
      if (dependsOnT(node.right)) {
        // Check if base is constant > 0, e.g., 2^(3*t) = e^(3*ln(2)*t)
        if (!dependsOnT(node.left)) {
          const baseVal = evalAt(node.left, 0);
          if (baseVal > 0) {
            return expandToSumOfProducts({
              type: 'call',
              fn: 'exp',
              arg: {
                type: 'bin',
                op: '*',
                left: { type: 'num', value: Math.log(baseVal) },
                right: node.right
              }
            });
          }
        }
        throw new Error('เลขชี้กำลังที่มีตัวแปร t รองรับเฉพาะรูปแบบฐานค่าคงที่บวก เช่น e^(a*t)');
      }
      const expVal = evalAt(node.right, 0);
      if (Math.abs(expVal) < EPS) {
        return [{ coeff: 1, factors: [] }];
      }
      // Non-negative integer power <= 8: expand algebraically
      if (expVal > 0 && Math.abs(expVal - Math.round(expVal)) < EPS && Math.round(expVal) <= 8) {
        const n = Math.round(expVal);
        const baseTerms = expandToSumOfProducts(node.left);
        if (baseTerms.length === 1 && baseTerms[0].factors.length === 1 && baseTerms[0].factors[0].kind === 'powT') {
          return [{
            coeff: Math.pow(baseTerms[0].coeff, n),
            factors: [{ kind: 'powT', p: baseTerms[0].factors[0].p * n }]
          }];
        }
        let acc = [{ coeff: 1, factors: [] }];
        for (let k = 0; k < n; k++) {
          acc = multiplyTermLists(acc, baseTerms);
        }
        return acc;
      }
      // Fractional or negative power of single monomial (c * t^k)^p or (e^(a*t))^p
      const baseTerms = expandToSumOfProducts(node.left);
      if (baseTerms.length === 1 && baseTerms[0].coeff > 0) {
        const bt = baseTerms[0];
        if (bt.factors.length === 1 && bt.factors[0].kind === 'powT') {
          return [{
            coeff: Math.pow(bt.coeff, expVal),
            factors: [{ kind: 'powT', p: bt.factors[0].p * expVal }]
          }];
        }
        if (bt.factors.length === 1 && bt.factors[0].kind === 'exp') {
          return [{
            coeff: Math.pow(bt.coeff, expVal),
            factors: [{ kind: 'exp', rate: bt.factors[0].rate * expVal }]
          }];
        }
      }
      throw new Error('เลขยกกำลังที่ไม่ใช่จำนวนเต็มบวก รองรับเฉพาะฐานตัวแปรเดียว เช่น t^(1/2) หรือ sqrt(t)');
    }
  }

  if (node.type === 'call') {
    const lin = extractLinearT(node.arg);
    if (!lin) {
      throw new Error('อาร์กิวเมนต์ภายใน ' + node.fn + '(...) ต้องเป็นฟังก์ชันเชิงเส้นของ t เช่น ' + node.fn + '(2*t)');
    }
    const { a, b } = lin;

    if (node.fn === 'exp') {
      const c = Math.exp(b);
      if (Math.abs(a) < EPS) return [{ coeff: c, factors: [] }];
      return [{ coeff: c, factors: [{ kind: 'exp', rate: a }] }];
    }

    if (node.fn === 'sin') {
      // sin(a*t + b) = sin(a*t)*cos(b) + cos(a*t)*sin(b)
      if (Math.abs(a) < EPS) return [{ coeff: Math.sin(b), factors: [] }];
      const signA = a < 0 ? -1 : 1;
      const w = Math.abs(a);
      const out = [];
      const cosB = Math.cos(b);
      const sinB = Math.sin(b);
      if (Math.abs(cosB) > EPS) {
        out.push({ coeff: signA * cosB, factors: [{ kind: 'sin', w }] });
      }
      if (Math.abs(sinB) > EPS) {
        out.push({ coeff: sinB, factors: [{ kind: 'cos', w }] });
      }
      return out.length ? out : [{ coeff: 0, factors: [] }];
    }

    if (node.fn === 'cos') {
      // cos(a*t + b) = cos(a*t)*cos(b) - sin(a*t)*sin(b)
      if (Math.abs(a) < EPS) return [{ coeff: Math.cos(b), factors: [] }];
      const signA = a < 0 ? -1 : 1;
      const w = Math.abs(a);
      const out = [];
      const cosB = Math.cos(b);
      const sinB = Math.sin(b);
      if (Math.abs(cosB) > EPS) {
        out.push({ coeff: cosB, factors: [{ kind: 'cos', w }] });
      }
      if (Math.abs(sinB) > EPS) {
        out.push({ coeff: -signA * sinB, factors: [{ kind: 'sin', w }] });
      }
      return out.length ? out : [{ coeff: 0, factors: [] }];
    }

    if (node.fn === 'sinh') {
      // sinh(a*t + b) = sinh(a*t)*cosh(b) + cosh(a*t)*sinh(b)
      if (Math.abs(a) < EPS) return [{ coeff: Math.sinh(b), factors: [] }];
      const signA = a < 0 ? -1 : 1;
      const w = Math.abs(a);
      const out = [];
      const coshB = Math.cosh(b);
      const sinhB = Math.sinh(b);
      if (Math.abs(coshB) > EPS) {
        out.push({ coeff: signA * coshB, factors: [{ kind: 'sinh', a: w }] });
      }
      if (Math.abs(sinhB) > EPS) {
        out.push({ coeff: sinhB, factors: [{ kind: 'cosh', a: w }] });
      }
      return out;
    }

    if (node.fn === 'cosh') {
      // cosh(a*t + b) = cosh(a*t)*cosh(b) + sinh(a*t)*sinh(b)
      if (Math.abs(a) < EPS) return [{ coeff: Math.cosh(b), factors: [] }];
      const signA = a < 0 ? -1 : 1;
      const w = Math.abs(a);
      const out = [];
      const coshB = Math.cosh(b);
      const sinhB = Math.sinh(b);
      if (Math.abs(coshB) > EPS) {
        out.push({ coeff: coshB, factors: [{ kind: 'cosh', a: w }] });
      }
      if (Math.abs(sinhB) > EPS) {
        out.push({ coeff: signA * sinhB, factors: [{ kind: 'sinh', a: w }] });
      }
      return out;
    }

    if (node.fn === 'u') {
      if (a < 0) {
        throw new Error('ฟังก์ชันขั้นบันไดรองรับเฉพาะรูปแบบ u(t - a) เมื่อสัมประสิทธิ์หน้า t เป็นบวก');
      }
      if (Math.abs(a) < EPS) {
        return [{ coeff: b >= 0 ? 1 : 0, factors: [] }];
      }
      const delay = -b / a;
      if (delay <= EPS) {
        // For t >= 0, u(t + |c|) = 1
        return [{ coeff: 1, factors: [] }];
      }
      return [{ coeff: 1, factors: [{ kind: 'u', delay }] }];
    }

    if (node.fn === 'delta') {
      if (Math.abs(a) < EPS) {
        throw new Error('อาร์กิวเมนต์ของ delta ต้องขึ้นกับตัวแปร t เช่น delta(t) หรือ delta(t - 2)');
      }
      const scale = 1 / Math.abs(a); // delta(a*t + b) = (1/|a|) * delta(t + b/a)
      const delay = -b / a;
      if (delay < -EPS) {
        // Impulse occurs at t < 0, outside unilateral Laplace [0, inf)
        return [{ coeff: 0, factors: [] }];
      }
      return [{ coeff: scale, factors: [{ kind: 'delta', delay: Math.max(0, delay) }] }];
    }
  }

  throw new Error('ไม่สามารถกระจายนิพจน์นี้ได้');
}

// Multiply and reduce two term lists using trig/hyperbolic/exp identities
function multiplyTermLists(listA, listB) {
  let result = [];
  for (const ta of listA) {
    for (const tb of listB) {
      const c = ta.coeff * tb.coeff;
      if (Math.abs(c) < 1e-14) continue;
      const merged = reduceSingleProduct(c, [...ta.factors, ...tb.factors]);
      result.push(...merged);
    }
  }
  return combineTerms(result);
}

function reduceSingleProduct(coeff, factors) {
  // Check if hyperbolic appears alongside other trig/hyperbolic; if so, expand sinh/cosh to exponentials
  const trigHypCount = factors.filter(f =>
    f.kind === 'sin' || f.kind === 'cos' || f.kind === 'sinh' || f.kind === 'cosh'
  ).length;
  const hasHyp = factors.some(f => f.kind === 'sinh' || f.kind === 'cosh');

  if (hasHyp && trigHypCount >= 2) {
    const idx = factors.findIndex(f => f.kind === 'sinh' || f.kind === 'cosh');
    const hf = factors[idx];
    const rest = factors.filter((_, i) => i !== idx);
    const sign2 = hf.kind === 'sinh' ? -1 : 1;
    return [
      ...reduceSingleProduct(coeff * 0.5, [...rest, { kind: 'exp', rate: hf.a }]),
      ...reduceSingleProduct(coeff * 0.5 * sign2, [...rest, { kind: 'exp', rate: -hf.a }])
    ];
  }

  // Product-to-sum for two trigonometric factors
  const trigIndices = [];
  for (let i = 0; i < factors.length; i++) {
    if (factors[i].kind === 'sin' || factors[i].kind === 'cos') trigIndices.push(i);
  }
  if (trigIndices.length >= 2) {
    const i1 = trigIndices[0];
    const i2 = trigIndices[1];
    const f1 = factors[i1];
    const f2 = factors[i2];
    const rest = factors.filter((_, idx) => idx !== i1 && idx !== i2);
    const sumW = f1.w + f2.w;
    const diffW = f1.w - f2.w;

    if (f1.kind === 'sin' && f2.kind === 'sin') {
      // sin(A)sin(B) = 1/2 [cos(A-B) - cos(A+B)]
      const branch1 = Math.abs(diffW) < EPS
        ? reduceSingleProduct(coeff * 0.5, rest)
        : reduceSingleProduct(coeff * 0.5, [...rest, { kind: 'cos', w: Math.abs(diffW) }]);
      const branch2 = reduceSingleProduct(-coeff * 0.5, [...rest, { kind: 'cos', w: sumW }]);
      return [...branch1, ...branch2];
    }
    if (f1.kind === 'cos' && f2.kind === 'cos') {
      // cos(A)cos(B) = 1/2 [cos(A-B) + cos(A+B)]
      const branch1 = Math.abs(diffW) < EPS
        ? reduceSingleProduct(coeff * 0.5, rest)
        : reduceSingleProduct(coeff * 0.5, [...rest, { kind: 'cos', w: Math.abs(diffW) }]);
      const branch2 = reduceSingleProduct(coeff * 0.5, [...rest, { kind: 'cos', w: sumW }]);
      return [...branch1, ...branch2];
    }
    // sin(A)cos(B) = 1/2 [sin(A+B) + sin(A-B)]
    const sinF = f1.kind === 'sin' ? f1 : f2;
    const cosF = f1.kind === 'cos' ? f1 : f2;
    const d = sinF.w - cosF.w;
    const s = sinF.w + cosF.w;
    const b1 = reduceSingleProduct(coeff * 0.5, [...rest, { kind: 'sin', w: s }]);
    const b2 = Math.abs(d) < EPS
      ? []
      : reduceSingleProduct(coeff * 0.5 * (d < 0 ? -1 : 1), [...rest, { kind: 'sin', w: Math.abs(d) }]);
    return [...b1, ...b2];
  }

  // Consolidate powT, exp, u, delta
  let powP = 0;
  let hasPow = false;
  let expRate = 0;
  let maxDelayU = null;
  const deltas = [];
  const others = [];

  for (const f of factors) {
    if (f.kind === 'powT') {
      powP += f.p;
      hasPow = true;
    } else if (f.kind === 'exp') {
      expRate += f.rate;
    } else if (f.kind === 'u') {
      maxDelayU = maxDelayU === null ? f.delay : Math.max(maxDelayU, f.delay);
    } else if (f.kind === 'delta') {
      deltas.push(f.delay);
    } else {
      others.push(f);
    }
  }

  if (deltas.length > 1) {
    throw new Error('ไม่รองรับผลคูณระหว่างฟังก์ชันอิมพัลส์ delta มากกว่า 1 พจน์');
  }

  const clean = [];
  if (maxDelayU !== null && maxDelayU > EPS) {
    clean.push({ kind: 'u', delay: maxDelayU });
  }
  if (deltas.length === 1) {
    clean.push({ kind: 'delta', delay: deltas[0] });
  }
  if (hasPow && Math.abs(powP) > EPS) {
    clean.push({ kind: 'powT', p: powP });
  }
  if (Math.abs(expRate) > EPS) {
    clean.push({ kind: 'exp', rate: expRate });
  }
  for (const o of others) clean.push(o);

  return [{ coeff, factors: clean }];
}

function termSignature(factors) {
  return factors
    .map(f => {
      if (f.kind === 'powT') return 'T:' + formatNumberPlain(f.p);
      if (f.kind === 'exp') return 'E:' + formatNumberPlain(f.rate);
      if (f.kind === 'sin') return 'S:' + formatNumberPlain(f.w);
      if (f.kind === 'cos') return 'C:' + formatNumberPlain(f.w);
      if (f.kind === 'sinh') return 'SH:' + formatNumberPlain(f.a);
      if (f.kind === 'cosh') return 'CH:' + formatNumberPlain(f.a);
      if (f.kind === 'u') return 'U:' + formatNumberPlain(f.delay);
      if (f.kind === 'delta') return 'D:' + formatNumberPlain(f.delay);
      return '';
    })
    .sort()
    .join('|');
}

function combineTerms(terms) {
  const map = new Map();
  for (const t of terms) {
    if (Math.abs(t.coeff) < 1e-13) continue;
    const sig = termSignature(t.factors);
    if (map.has(sig)) {
      map.get(sig).coeff += t.coeff;
    } else {
      map.set(sig, { coeff: t.coeff, factors: t.factors });
    }
  }
  const out = [];
  for (const item of map.values()) {
    if (Math.abs(item.coeff) > 1e-12) out.push(item);
  }
  return out;
}

/* =====================================================================
 * 4. POLYNOMIAL IN u = (s - shift) & SYMBOLIC DIFFERENTIATION
 * ===================================================================== */
// Polynomial represented as coeffs array: coeffs[i] is coefficient of u^i
function trimPoly(p) {
  const out = p.slice();
  while (out.length > 1 && Math.abs(out[out.length - 1]) < 1e-12) {
    out.pop();
  }
  return out;
}

function polyDeriv(p) {
  if (p.length <= 1) return [0];
  const out = [];
  for (let i = 1; i < p.length; i++) {
    out.push(p[i] * i);
  }
  return trimPoly(out);
}

function polyMul(a, b) {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] += a[i] * b[j];
    }
  }
  return trimPoly(out);
}

function polySub(a, b) {
  const len = Math.max(a.length, b.length);
  const out = new Array(len).fill(0);
  for (let i = 0; i < len; i++) {
    out[i] = (a[i] || 0) - (b[i] || 0);
  }
  return trimPoly(out);
}

function polyScale(p, c) {
  return trimPoly(p.map(v => v * c));
}

// Differentiate P(u) / B(u)^k once and multiply by -1 (for multiplying by t in time domain)
function negDiffRational(rat) {
  // -(P' * B - k * P * B') / B^(k + 1) = (k * P * B' - P' * B) / B^(k + 1)
  const pPrime = polyDeriv(rat.P);
  const bPrime = polyDeriv(rat.B);
  const term1 = polyScale(polyMul(rat.P, bPrime), rat.k);
  const term2 = polyMul(pPrime, rat.B);
  return {
    P: polySub(term1, term2),
    B: rat.B,
    k: rat.k + 1
  };
}

function formatShiftedVar(shift, needParens) {
  if (Math.abs(shift) < EPS) {
    return { tex: 's', plain: 's' };
  }
  const op = shift > 0 ? ' - ' : ' + ';
  const absTex = formatNumberTex(Math.abs(shift));
  const absPlain = formatNumberPlain(Math.abs(shift));
  const innerTex = 's' + op + absTex;
  const innerPlain = 's' + op + absPlain;
  return {
    tex: needParens ? '(' + innerTex + ')' : innerTex,
    plain: needParens ? '(' + innerPlain + ')' : innerPlain
  };
}

function formatPolyInShiftedS(coeffs, shift) {
  const p = trimPoly(coeffs);
  const deg = p.length - 1;
  if (deg === 0) {
    return {
      tex: formatNumberTex(p[0]),
      plain: formatNumberPlain(p[0]),
      isNegativeLeading: p[0] < -EPS
    };
  }

  let tex = '';
  let plain = '';
  let first = true;
  let isNegativeLeading = false;

  for (let d = deg; d >= 0; d--) {
    const c = p[d];
    if (Math.abs(c) < 1e-12) continue;
    const neg = c < 0;
    const ac = Math.abs(c);

    if (first) {
      isNegativeLeading = neg;
      if (neg) {
        tex += '-';
        plain += '-';
      }
    } else {
      tex += neg ? ' - ' : ' + ';
      plain += neg ? ' - ' : ' + ';
    }

    if (d === 0) {
      tex += formatNumberTex(ac);
      plain += formatNumberPlain(ac);
    } else {
      const needParen = Math.abs(shift) > EPS && (d > 1 || Math.abs(ac - 1) > EPS || !first || deg > 1);
      const sv = formatShiftedVar(shift, Math.abs(shift) > EPS);
      const powTex = d === 1 ? sv.tex : sv.tex + '^{' + d + '}';
      const powPlain = d === 1 ? sv.plain : sv.plain + '^' + d;

      if (Math.abs(ac - 1) < EPS) {
        // If standalone linear term with shift (e.g. s + 3), omit outer parens
        if (deg === 1 && d === 1 && Math.abs(p[0] || 0) < EPS) {
          const bare = formatShiftedVar(shift, false);
          tex += neg ? '(' + bare.tex + ')' : bare.tex;
          plain += neg ? '(' + bare.plain + ')' : bare.plain;
        } else {
          tex += powTex;
          plain += powPlain;
        }
      } else {
        const cTex = formatNumberTex(ac);
        const cPlain = formatNumberPlain(ac);
        const useParenPlain = cPlain.includes('/');
        tex += cTex + (needParen ? '' : '') + powTex;
        plain += (useParenPlain ? '(' + cPlain + ')' : cPlain) + '*' + powPlain;
      }
    }
    first = false;
  }

  return { tex: tex || '0', plain: plain || '0', isNegativeLeading };
}

/* =====================================================================
 * 5. LAPLACE TRANSFORM OF SINGLE NORMALIZED TERMS & FULL SUM
 * ===================================================================== */
function evalFactorsAtT(factors, tVal) {
  let val = 1;
  for (const f of factors) {
    if (f.kind === 'powT') val *= Math.pow(tVal, f.p);
    else if (f.kind === 'exp') val *= Math.exp(f.rate * tVal);
    else if (f.kind === 'sin') val *= Math.sin(f.w * tVal);
    else if (f.kind === 'cos') val *= Math.cos(f.w * tVal);
    else if (f.kind === 'sinh') val *= Math.sinh(f.a * tVal);
    else if (f.kind === 'cosh') val *= Math.cosh(f.a * tVal);
    else if (f.kind === 'u') val *= (tVal >= f.delay - EPS ? 1 : 0);
  }
  return val;
}

function termFactorsToAst(coeff, factors) {
  let node = { type: 'num', value: coeff };
  for (const f of factors) {
    let fNode;
    if (f.kind === 'powT') {
      fNode = Math.abs(f.p - 1) < EPS
        ? { type: 'var' }
        : { type: 'bin', op: '^', left: { type: 'var' }, right: { type: 'num', value: f.p } };
    } else if (f.kind === 'exp') {
      fNode = {
        type: 'call',
        fn: 'exp',
        arg: { type: 'bin', op: '*', left: { type: 'num', value: f.rate }, right: { type: 'var' } }
      };
    } else if (f.kind === 'sin' || f.kind === 'cos') {
      fNode = {
        type: 'call',
        fn: f.kind,
        arg: { type: 'bin', op: '*', left: { type: 'num', value: f.w }, right: { type: 'var' } }
      };
    } else if (f.kind === 'sinh' || f.kind === 'cosh') {
      fNode = {
        type: 'call',
        fn: f.kind,
        arg: { type: 'bin', op: '*', left: { type: 'num', value: f.a }, right: { type: 'var' } }
      };
    } else if (f.kind === 'u' || f.kind === 'delta') {
      fNode = {
        type: 'call',
        fn: f.kind,
        arg: Math.abs(f.delay) < EPS
          ? { type: 'var' }
          : { type: 'bin', op: '-', left: { type: 'var' }, right: { type: 'num', value: f.delay } }
      };
    }
    node = { type: 'bin', op: '*', left: node, right: fNode };
  }
  return node;
}

function formatTermTimeTex(coeff, factors) {
  if (factors.length === 0) {
    return formatNumberTex(coeff);
  }
  const sign = coeff < 0 ? '-' : '';
  const ac = Math.abs(coeff);
  const cTex = Math.abs(ac - 1) < EPS ? '' : formatNumberTex(ac);

  const parts = [];
  // Order nicely: u, delta, powT, exp, trig/hyp
  const order = { u: 1, delta: 2, powT: 3, exp: 4, sin: 5, cos: 5, sinh: 5, cosh: 5 };
  const sorted = factors.slice().sort((a, b) => (order[a.kind] || 9) - (order[b.kind] || 9));

  for (const f of sorted) {
    if (f.kind === 'powT') {
      if (Math.abs(f.p - 1) < EPS) parts.push('t');
      else if (Math.abs(f.p - 0.5) < EPS) parts.push('\\sqrt{t}');
      else if (Math.abs(f.p + 0.5) < EPS) parts.push('\\frac{1}{\\sqrt{t}}');
      else parts.push('t^{' + formatNumberTex(f.p) + '}');
    } else if (f.kind === 'exp') {
      const rTex = Math.abs(f.rate - 1) < EPS ? 't' : (Math.abs(f.rate + 1) < EPS ? '-t' : formatNumberTex(f.rate) + 't');
      parts.push('e^{' + rTex + '}');
    } else if (f.kind === 'sin' || f.kind === 'cos' || f.kind === 'sinh' || f.kind === 'cosh') {
      const param = (f.kind === 'sin' || f.kind === 'cos') ? f.w : f.a;
      const argTex = Math.abs(param - 1) < EPS ? 't' : formatNumberTex(param) + 't';
      parts.push('\\' + f.kind + '(' + argTex + ')');
    } else if (f.kind === 'u') {
      parts.push('u(t - ' + formatNumberTex(f.delay) + ')');
    } else if (f.kind === 'delta') {
      parts.push(Math.abs(f.delay) < EPS ? '\\delta(t)' : '\\delta(t - ' + formatNumberTex(f.delay) + ')');
    }
  }
  return sign + cTex + (cTex && parts.length ? ' ' : '') + parts.join(' ');
}

// Transform a single term { coeff, factors } -> { sign, texAbs, plainAbs, roc, ruleName, termTimeTex }
function transformSingleTerm(term) {
  const { coeff, factors } = term;
  const termTimeTex = formatTermTimeTex(coeff, factors);

  // Case 1: Dirac delta term g(t) * delta(t - a) = g(a) * delta(t - a)
  const deltaIdx = factors.findIndex(f => f.kind === 'delta');
  if (deltaIdx !== -1) {
    const delay = factors[deltaIdx].delay;
    const otherFactors = factors.filter((_, i) => i !== deltaIdx);
    // Check powT at delay=0 with negative exponent
    for (const ofac of otherFactors) {
      if (ofac.kind === 'powT' && delay < EPS && ofac.p < 0) {
        throw new Error('ผลคูณ t^(' + formatNumberPlain(ofac.p) + ') กับ delta(t) ไม่นิยามที่ t = 0');
      }
    }
    const sampled = coeff * evalFactorsAtT(otherFactors, delay);
    if (Math.abs(sampled) < 1e-13) {
      return null;
    }
    const sign = sampled < 0 ? -1 : 1;
    const ac = Math.abs(sampled);
    let texAbs, plainAbs;
    if (Math.abs(delay) < EPS) {
      texAbs = formatNumberTex(ac);
      plainAbs = formatNumberPlain(ac);
    } else {
      const dTex = Math.abs(delay - 1) < EPS ? 's' : formatNumberTex(delay) + 's';
      const dPlain = Math.abs(delay - 1) < EPS ? 's' : formatNumberPlain(delay) + '*s';
      const expTex = 'e^{-' + dTex + '}';
      const expPlain = 'exp(-' + dPlain + ')';
      if (Math.abs(ac - 1) < EPS) {
        texAbs = expTex;
        plainAbs = expPlain;
      } else {
        texAbs = formatNumberTex(ac) + ' ' + expTex;
        plainAbs = formatNumberPlain(ac) + '*' + expPlain;
      }
    }
    return {
      sign,
      texAbs,
      plainAbs,
      roc: -Infinity,
      ruleName: Math.abs(delay) < EPS ? 'ฟังก์ชันอิมพัลส์หนึ่งหน่วย δ(t)' : 'สมบัติการสุ่มค่าและเลื่อนเวลา δ(t - a)',
      termTimeTex
    };
  }

  // Case 2: Heaviside step u(t - a) with a > 0 -> L{u(t - a) h(t)} = e^(-a*s) L{h(t + a)}
  const uIdx = factors.findIndex(f => f.kind === 'u');
  if (uIdx !== -1) {
    const delay = factors[uIdx].delay;
    const restFactors = factors.filter((_, i) => i !== uIdx);
    const restAst = termFactorsToAst(coeff, restFactors);
    const shiftedAst = substituteTShift(restAst, delay);
    const subTerms = expandToSumOfProducts(shiftedAst);
    const subResults = [];
    let roc = -Infinity;
    for (const st of subTerms) {
      const tr = transformSingleTerm(st);
      if (tr) {
        subResults.push(tr);
        roc = Math.max(roc, tr.roc);
      }
    }
    if (subResults.length === 0) return null;

    const dTex = Math.abs(delay - 1) < EPS ? 's' : formatNumberTex(delay) + 's';
    const dPlain = Math.abs(delay - 1) < EPS ? 's' : formatNumberPlain(delay) + '*s';
    const expTex = 'e^{-' + dTex + '}';
    const expPlain = 'exp(-' + dPlain + ')';

    if (subResults.length === 1) {
      const only = subResults[0];
      const texAbs = only.texAbs === '1' ? expTex : expTex + ' ' + only.texAbs;
      const plainAbs = only.plainAbs === '1' ? expPlain : expPlain + '*(' + only.plainAbs + ')';
      return {
        sign: only.sign,
        texAbs,
        plainAbs,
        roc,
        ruleName: 'ทฤษฎีบทการเลื่อนที่สอง u(t - a) (Time-Shifting)',
        termTimeTex
      };
    }

    const leadSign = subResults[0].sign < 0 ? -1 : 1;
    const normalizedSub = leadSign < 0
      ? subResults.map(item => ({ ...item, sign: -item.sign }))
      : subResults;
    const joined = joinTransformedTerms(normalizedSub);

    return {
      sign: leadSign,
      texAbs: expTex + ' \\left(' + joined.tex + '\\right)',
      plainAbs: expPlain + '*(' + joined.plain + ')',
      roc,
      ruleName: 'ทฤษฎีบทการเลื่อนที่สอง u(t - a) (Time-Shifting)',
      termTimeTex
    };
  }

  // Case 3: Standard core term: coeff * t^p * e^(rate*t) * [1 | sin | cos | sinh | cosh]
  let p = 0;
  let shift = 0;
  let osc = null;
  for (const f of factors) {
    if (f.kind === 'powT') p = f.p;
    else if (f.kind === 'exp') shift = f.rate;
    else osc = f;
  }

  // Subcase 3A: No trig/hyperbolic factor -> coeff * t^p * e^(shift*t)
  if (!osc) {
    if (p <= -1 + EPS) {
      throw new Error('อินทิกรัลการแปลงลาปลาซของ t^(' + formatNumberPlain(p) + ') ลู่ออก (ต้องมีเลขชี้กำลัง p > -1)');
    }

    const sign = coeff < 0 ? -1 : 1;
    const ac = Math.abs(coeff);
    const roc = shift;
    const isInt = Math.abs(p - Math.round(p)) < EPS;
    const isHalfInt = Math.abs(2 * p - Math.round(2 * p)) < EPS && !isInt;

    let ruleName = 'การแปลงค่าคงที่';
    if (Math.abs(p) > EPS && Math.abs(shift) > EPS) {
      ruleName = 'สมบัติการเลื่อนความถี่ s-shift ของ t^n e^(at)';
    } else if (Math.abs(p) > EPS) {
      ruleName = isInt ? 'การแปลงเลขยกกำลัง t^n' : 'การแปลงเลขยกกำลังทั่วไป Γ(p+1)/s^(p+1)';
    } else if (Math.abs(shift) > EPS) {
      ruleName = 'การแปลงฟังก์ชันเอ็กซ์โพเนนเชียล e^(at)';
    }

    if (isInt) {
      const n = Math.round(p);
      const numVal = ac * factorial(n);
      const power = n + 1;
      const sv = formatShiftedVar(shift, power > 1 && Math.abs(shift) > EPS);
      const denTex = power === 1 ? sv.tex : sv.tex + '^{' + power + '}';
      const svPlain = formatShiftedVar(shift, Math.abs(shift) > EPS);
      const denPlain = power === 1 ? svPlain.plain : svPlain.plain + '^' + power;

      // Clean fraction formatting if numVal is rational p/q
      const r = toRational(numVal);
      let texAbs, plainAbs;
      if (r && r.d > 1) {
        texAbs = '\\frac{' + Math.abs(r.n) + '}{' + r.d + (power === 1 && Math.abs(shift) > EPS ? '(' + sv.tex + ')' : denTex) + '}';
        plainAbs = Math.abs(r.n) + '/(' + r.d + '*' + denPlain + ')';
      } else {
        const nTex = formatNumberTex(numVal);
        const nPlain = formatNumberPlain(numVal);
        texAbs = '\\frac{' + nTex + '}{' + denTex + '}';
        plainAbs = nPlain + '/' + (power === 1 && Math.abs(shift) > EPS ? '(' + formatShiftedVar(shift, false).plain + ')' : denPlain);
      }
      return { sign, texAbs, plainAbs, roc, ruleName, termTimeTex };
    }

    if (isHalfInt) {
      // p = m + 0.5 where m >= -1. Gamma(m + 1.5) = sqrt(pi) * (2m+1)!! / 2^(m+1)
      const twoP = Math.round(2 * p); // e.g. -1 for p=-0.5, 1 for p=0.5, 3 for p=1.5
      const m = (twoP - 1) / 2;
      let oddProd = 1;
      for (let j = 1; j <= 2 * m + 1; j += 2) oddProd *= j;
      const twoPow = m >= 0 ? Math.pow(2, m + 1) : 1;
      const scaleR = toRational(ac * oddProd / twoPow);
      const expNum = twoP + 2; // s^((twoP+2)/2)
      const sv = formatShiftedVar(shift, Math.abs(shift) > EPS);
      const sPowTex = sv.tex + '^{' + expNum + '/2}';
      const sPowPlain = sv.plain + '^(' + expNum + '/2)';

      let texAbs, plainAbs;
      if (scaleR) {
        const rn = Math.abs(scaleR.n);
        const rd = scaleR.d;
        const numTex = (rn === 1 ? '' : rn) + '\\sqrt{\\pi}';
        const denTex = (rd === 1 ? '' : rd) + sPowTex;
        texAbs = '\\frac{' + numTex + '}{' + denTex + '}';
        const numPlain = (rn === 1 ? '' : rn + '*') + 'sqrt(pi)';
        const denPlain = (rd === 1 ? '' : rd + '*') + sPowPlain;
        plainAbs = numPlain + '/(' + denPlain + ')';
      } else {
        const gVal = ac * gammaFunc(p + 1);
        texAbs = '\\frac{' + formatNumberTex(gVal) + '}{' + sPowTex + '}';
        plainAbs = formatNumberPlain(gVal) + '/(' + sPowPlain + ')';
      }
      return { sign, texAbs, plainAbs, roc, ruleName, termTimeTex };
    }

    // General real p > -1
    const gVal = ac * gammaFunc(p + 1);
    const sv = formatShiftedVar(shift, Math.abs(shift) > EPS);
    const pPlus1Tex = formatNumberTex(p + 1);
    const pPlus1Plain = formatNumberPlain(p + 1);
    return {
      sign,
      texAbs: '\\frac{' + formatNumberTex(gVal) + '}{' + sv.tex + '^{' + pPlus1Tex + '}}',
      plainAbs: formatNumberPlain(gVal) + '/(' + sv.plain + '^(' + pPlus1Plain + '))',
      roc,
      ruleName,
      termTimeTex
    };
  }

  // Subcase 3B: Oscillatory / Hyperbolic factor with optional integer t^n and e^(shift*t)
  if (p < -EPS || Math.abs(p - Math.round(p)) > EPS) {
    throw new Error('ผลคูณของ t^p กับฟังก์ชันตรีโกณมิติ/ไฮเพอร์โบลิก รองรับเมื่อ p เป็นจำนวนเต็มไม่ลบ (เช่น t*sin(2*t))');
  }
  const n = Math.round(p);
  if (n > 6) {
    throw new Error('รองรับดีกรีของ t^n คูณฟังก์ชันตรีโกณมิติสูงสุดถึง n = 6');
  }

  let baseRat;
  let roc;
  let baseRule = '';

  if (osc.kind === 'sin') {
    baseRat = { P: [osc.w], B: [osc.w * osc.w, 0, 1], k: 1 };
    roc = shift;
    baseRule = 'การแปลง sin(ωt)';
  } else if (osc.kind === 'cos') {
    baseRat = { P: [0, 1], B: [osc.w * osc.w, 0, 1], k: 1 };
    roc = shift;
    baseRule = 'การแปลง cos(ωt)';
  } else if (osc.kind === 'sinh') {
    baseRat = { P: [osc.a], B: [-osc.a * osc.a, 0, 1], k: 1 };
    roc = shift + Math.abs(osc.a);
    baseRule = 'การแปลง sinh(at)';
  } else if (osc.kind === 'cosh') {
    baseRat = { P: [0, 1], B: [-osc.a * osc.a, 0, 1], k: 1 };
    roc = shift + Math.abs(osc.a);
    baseRule = 'การแปลง cosh(at)';
  }

  for (let i = 0; i < n; i++) {
    baseRat = negDiffRational(baseRat);
  }

  const scaledP = polyScale(baseRat.P, coeff);
  const topLead = scaledP[scaledP.length - 1];
  const sign = topLead < 0 ? -1 : 1;
  const absP = polyScale(scaledP, sign);

  const numFmt = formatPolyInShiftedS(absP, shift);
  // Remove any bare outer parens if numerator is single s+a
  const numTex = numFmt.tex.replace(/^\((s [+-] [^()]+)\)$/, '$1');
  const numPlain = numFmt.plain;

  // Format denominator B(s - shift)^k
  const sv = formatShiftedVar(shift, Math.abs(shift) > EPS);
  const c0 = Math.abs(baseRat.B[0]);
  const opSign = baseRat.B[0] >= 0 ? ' + ' : ' - ';
  const baseDenTex = sv.tex + '^{2}' + opSign + formatNumberTex(c0);
  const baseDenPlain = sv.plain + '^2' + opSign + formatNumberPlain(c0);

  const denTex = baseRat.k === 1
    ? baseDenTex
    : '\\left(' + baseDenTex + '\\right)^{' + baseRat.k + '}';
  const denPlain = baseRat.k === 1
    ? '(' + baseDenPlain + ')'
    : '(' + baseDenPlain + ')^' + baseRat.k;

  const hasPlusMinusInNum = absP.filter(v => Math.abs(v) > 1e-12).length > 1 || (absP.length === 2 && Math.abs(shift) > EPS && Math.abs(absP[0]) < 1e-12);
  const wrappedNumPlain = (hasPlusMinusInNum || numPlain.includes(' + ') || numPlain.includes(' - '))
    ? '(' + numPlain + ')'
    : numPlain;

  let ruleParts = [baseRule];
  if (n > 0) ruleParts.push('อนุพันธ์ในโดเมนความถี่ (-d/ds)^' + n);
  if (Math.abs(shift) > EPS) ruleParts.push('การเลื่อนความถี่ s-shift');

  return {
    sign,
    texAbs: '\\frac{' + numTex + '}{' + denTex + '}',
    plainAbs: wrappedNumPlain + '/' + denPlain,
    roc,
    ruleName: ruleParts.join(' + '),
    termTimeTex
  };
}

function joinTransformedTerms(items) {
  if (items.length === 0) {
    return { tex: '0', plain: '0' };
  }
  let tex = '';
  let plain = '';
  items.forEach((item, idx) => {
    if (idx === 0) {
      tex += (item.sign < 0 ? '-' : '') + item.texAbs;
      plain += (item.sign < 0 ? '-' : '') + item.plainAbs;
    } else {
      tex += (item.sign < 0 ? ' - ' : ' + ') + item.texAbs;
      plain += (item.sign < 0 ? ' - ' : ' + ') + item.plainAbs;
    }
  });
  return { tex, plain };
}

/* =====================================================================
 * 5B. EXTENDED SPECIAL SYMBOLIC RULES & NUMERICAL QUADRATURE ENGINE
 * ===================================================================== */
function tryLinearT(node) {
  try {
    return extractLinearT(node);
  } catch (_) {
    return null;
  }
}

// Extract a * sqrt(t) from node (returns a > 0 or null)
function tryCoeffSqrtT(node) {
  if (node.type === 'bin' && node.op === '^' && node.left.type === 'var' && !dependsOnT(node.right)) {
    if (Math.abs(evalAt(node.right, 0) - 0.5) < EPS) return 1;
  }
  if (node.type === 'bin' && node.op === '*') {
    if (!dependsOnT(node.left)) {
      const sub = tryCoeffSqrtT(node.right);
      if (sub !== null) return evalAt(node.left, 0) * sub;
    }
    if (!dependsOnT(node.right)) {
      const sub = tryCoeffSqrtT(node.left);
      if (sub !== null) return evalAt(node.right, 0) * sub;
    }
  }
  return null;
}

// Extract quadratic c2 * t^2 + c0 (no linear term)
function tryPureQuadraticT(node) {
  try {
    const terms = expandToSumOfProducts(node);
    let c2 = 0, c0 = 0;
    for (const tm of terms) {
      if (tm.factors.length === 0) c0 += tm.coeff;
      else if (tm.factors.length === 1 && tm.factors[0].kind === 'powT' && Math.abs(tm.factors[0].p - 2) < EPS) c2 += tm.coeff;
      else return null;
    }
    return { c2, c0 };
  } catch (_) {
    return null;
  }
}

// Rewrite piecewise constructs (abs, rect, tri, sgn) with linear arguments into exact u(t-a) forms
function rewritePiecewiseAst(node) {
  if (!node || typeof node !== 'object') return node;
  if (node.type === 'neg') return { type: 'neg', arg: rewritePiecewiseAst(node.arg) };
  if (node.type === 'bin') {
    return {
      type: 'bin',
      op: node.op,
      left: rewritePiecewiseAst(node.left),
      right: rewritePiecewiseAst(node.right)
    };
  }
  if (node.type === 'call') {
    const arg = rewritePiecewiseAst(node.arg);
    const lin = tryLinearT(arg);
    if (node.fn === 'abs' && lin) {
      const { a, b } = lin;
      if (Math.abs(a) < EPS) return { type: 'num', value: Math.abs(b) };
      const t0 = -b / a;
      const sgnA = a > 0 ? 1 : -1;
      if (t0 <= EPS) {
        return { type: 'bin', op: '*', left: { type: 'num', value: sgnA }, right: arg };
      }
      // -sgn(a)*(a*t + b) + 2*|a|*(t - t0)*u(t - t0)
      const tMinusT0 = { type: 'bin', op: '-', left: { type: 'var' }, right: { type: 'num', value: t0 } };
      const part1 = { type: 'bin', op: '*', left: { type: 'num', value: -sgnA }, right: arg };
      const part2 = {
        type: 'bin',
        op: '*',
        left: { type: 'bin', op: '*', left: { type: 'num', value: 2 * Math.abs(a) }, right: tMinusT0 },
        right: { type: 'call', fn: 'u', arg: tMinusT0 }
      };
      return { type: 'bin', op: '+', left: part1, right: part2 };
    }
    if (node.fn === 'rect' && lin && lin.a > EPS) {
      // u(arg) - u(arg - 1)
      const argMinus1 = { type: 'bin', op: '-', left: arg, right: { type: 'num', value: 1 } };
      return {
        type: 'bin',
        op: '-',
        left: { type: 'call', fn: 'u', arg },
        right: { type: 'call', fn: 'u', arg: argMinus1 }
      };
    }
    if (node.fn === 'tri' && lin && lin.a > EPS) {
      // x*u(x) - 2*(x-1)*u(x-1) + (x-2)*u(x-2)
      const xm1 = { type: 'bin', op: '-', left: arg, right: { type: 'num', value: 1 } };
      const xm2 = { type: 'bin', op: '-', left: arg, right: { type: 'num', value: 2 } };
      const p1 = { type: 'bin', op: '*', left: arg, right: { type: 'call', fn: 'u', arg } };
      const p2 = { type: 'bin', op: '*', left: { type: 'bin', op: '*', left: { type: 'num', value: 2 }, right: xm1 }, right: { type: 'call', fn: 'u', arg: xm1 } };
      const p3 = { type: 'bin', op: '*', left: xm2, right: { type: 'call', fn: 'u', arg: xm2 } };
      return { type: 'bin', op: '+', left: { type: 'bin', op: '-', left: p1, right: p2 }, right: p3 };
    }
    if (node.fn === 'sgn' && lin && Math.abs(lin.a) > EPS) {
      const t0 = -lin.b / lin.a;
      const sgnA = lin.a > 0 ? 1 : -1;
      if (t0 <= EPS) return { type: 'num', value: sgnA };
      const tMinusT0 = { type: 'bin', op: '-', left: { type: 'var' }, right: { type: 'num', value: t0 } };
      return {
        type: 'bin',
        op: '*',
        left: { type: 'num', value: sgnA },
        right: {
          type: 'bin',
          op: '+',
          left: { type: 'num', value: -1 },
          right: { type: 'bin', op: '*', left: { type: 'num', value: 2 }, right: { type: 'call', fn: 'u', arg: tMinusT0 } }
        }
      };
    }
    return { type: 'call', fn: node.fn, arg };
  }
  return node;
}

function astToTex(node, parentPrec = 0, varName = 't') {
  if (node.type === 'num') return formatNumberTex(node.value);
  if (node.type === 'var') return varName;
  if (node.type === 'const') {
    if (node.name === 'pi') return '\\pi';
    if (node.name === 'gamma') return '\\gamma';
    return 'e';
  }
  if (node.type === 'neg') {
    const inner = astToTex(node.arg, 3, varName);
    const s = '-' + inner;
    return parentPrec > 3 ? '\\left(' + s + '\\right)' : s;
  }
  if (node.type === 'bin') {
    if (node.op === '+' || node.op === '-') {
      const l = astToTex(node.left, 1, varName);
      const r = astToTex(node.right, node.op === '-' ? 2 : 1, varName);
      const s = l + ' ' + node.op + ' ' + r;
      return parentPrec > 1 ? '\\left(' + s + '\\right)' : s;
    }
    if (node.op === '*') {
      const l = astToTex(node.left, 2, varName);
      const r = astToTex(node.right, 2, varName);
      const sep = (/^\d/.test(r) ? ' \\cdot ' : ' ');
      const s = (Math.abs((node.left.type === 'num' ? node.left.value : 99) - 1) < EPS) ? r : (l + sep + r);
      return parentPrec > 2 ? '\\left(' + s + '\\right)' : s;
    }
    if (node.op === '/') {
      return '\\frac{' + astToTex(node.left, 0, varName) + '}{' + astToTex(node.right, 0, varName) + '}';
    }
    if (node.op === '^') {
      if (!dependsOnT(node.right) && Math.abs(evalAt(node.right, 0) - 0.5) < EPS) {
        return '\\sqrt{' + astToTex(node.left, 0, varName) + '}';
      }
      const b = astToTex(node.left, 4, varName);
      const needWrap = node.left.type === 'bin' || node.left.type === 'neg' || node.left.type === 'call';
      const bStr = needWrap ? '\\left(' + b + '\\right)' : b;
      return bStr + '^{' + astToTex(node.right, 0, varName) + '}';
    }
  }
  if (node.type === 'call') {
    const a = astToTex(node.arg, 0, varName);
    const fnMap = {
      sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot', sec: '\\sec', csc: '\\csc',
      asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan',
      sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', coth: '\\coth', sech: '\\operatorname{sech}', csch: '\\operatorname{csch}',
      asinh: '\\operatorname{arsinh}', acosh: '\\operatorname{arcosh}', atanh: '\\operatorname{artanh}',
      ln: '\\ln', log: '\\log_{10}', sinc: '\\operatorname{sinc}',
      j0: 'J_0', j1: 'J_1', i0: 'I_0',
      erf: '\\operatorname{erf}', erfc: '\\operatorname{erfc}',
      si: '\\operatorname{Si}', ci: '\\operatorname{Ci}',
      u: 'u', delta: '\\delta', rect: '\\operatorname{rect}', tri: '\\operatorname{tri}',
      sgn: '\\operatorname{sgn}', sawtooth: '\\operatorname{sawtooth}', square: '\\operatorname{square}'
    };
    if (node.fn === 'exp') return 'e^{' + a + '}';
    if (node.fn === 'abs') return '\\left|' + a + '\\right|';
    if (node.fn === 'floor') return '\\lfloor ' + a + ' \\rfloor';
    if (node.fn === 'ceil') return '\\lceil ' + a + ' \\rceil';
    const fnTex = fnMap[node.fn] || ('\\operatorname{' + node.fn + '}');
    return fnTex + '\\left(' + a + '\\right)';
  }
  return '';
}

// Flatten top-level + / - into list of AST nodes with signs merged
function flattenAdditiveAst(node, sign = 1) {
  if (node.type === 'neg') return flattenAdditiveAst(node.arg, -sign);
  if (node.type === 'bin' && node.op === '+') {
    return [...flattenAdditiveAst(node.left, sign), ...flattenAdditiveAst(node.right, sign)];
  }
  if (node.type === 'bin' && node.op === '-') {
    return [...flattenAdditiveAst(node.left, sign), ...flattenAdditiveAst(node.right, -sign)];
  }
  return [sign < 0 ? { type: 'neg', arg: node } : node];
}

// Extract multiplicative constant C and exponential shift e^(shift*t) from an AST term
function peelConstAndExpShift(node) {
  let coeff = 1;
  let shift = 0;
  const rem = [];

  function collect(n) {
    if (!dependsOnT(n)) {
      coeff *= evalAt(n, 0);
      return;
    }
    if (n.type === 'neg') {
      coeff *= -1;
      collect(n.arg);
      return;
    }
    if (n.type === 'bin' && n.op === '*') {
      collect(n.left);
      collect(n.right);
      return;
    }
    if (n.type === 'bin' && n.op === '/' && !dependsOnT(n.right)) {
      coeff /= evalAt(n.right, 0);
      collect(n.left);
      return;
    }
    if (n.type === 'call' && n.fn === 'exp') {
      const lin = tryLinearT(n.arg);
      if (lin) {
        coeff *= Math.exp(lin.b);
        shift += lin.a;
        return;
      }
    }
    // Separate the numerator of a quotient so e^(-a*s)/G(s) retains its delay.
    if (n.type === 'bin' && n.op === '/') {
      const numerator = peelConstAndExpShift(n.left);
      if (Math.abs(numerator.shift) > EPS) {
        coeff *= numerator.coeff;
        shift += numerator.shift;
        rem.push({ type: 'bin', op: '/', left: numerator.core, right: n.right });
        return;
      }
    }
    rem.push(n);
  }

  collect(node);
  let core = rem.length === 0 ? { type: 'num', value: 1 } : rem[0];
  for (let i = 1; i < rem.length; i++) {
    core = { type: 'bin', op: '*', left: core, right: rem[i] };
  }
  return { coeff, shift, core };
}

// Special closed-form Laplace rules for extended functions
function tryTransformSpecialAstTerm(termNode) {
  const { coeff, shift, core } = peelConstAndExpShift(termNode);
  if (Math.abs(coeff) < 1e-14) return null;

  const sign = coeff < 0 ? -1 : 1;
  const ac = Math.abs(coeff);
  const cTex = Math.abs(ac - 1) < EPS ? '' : formatNumberTex(ac) + ' ';
  const cPlain = Math.abs(ac - 1) < EPS ? '' : formatNumberPlain(ac) + '*';
  const svBare = formatShiftedVar(shift, false);
  const svParen = formatShiftedVar(shift, Math.abs(shift) > EPS);
  const termTimeTex = astToTex(termNode);
  const sShiftSuffix = Math.abs(shift) > EPS ? ' + s-shift' : '';

  function wrapScale(texExpr, plainExpr, flipSign = false) {
    const finalSign = flipSign ? -sign : sign;
    const tx = Math.abs(ac - 1) < EPS ? texExpr : formatNumberTex(ac) + ' \\cdot ' + texExpr;
    const pl = Math.abs(ac - 1) < EPS ? plainExpr : formatNumberPlain(ac) + '*(' + plainExpr + ')';
    return { finalSign, tx, pl };
  }

  // 1. ln(a*t) or log(a*t)
  if (core.type === 'call' && (core.fn === 'ln' || core.fn === 'log')) {
    const lin = tryLinearT(core.arg);
    if (lin && Math.abs(lin.b) < EPS && lin.a > EPS) {
      const a = lin.a;
      const scaleFactor = core.fn === 'log' ? 1 / Math.LN10 : 1;
      const effAc = ac * scaleFactor;
      const lnArgTex = Math.abs(a - 1) < EPS ? svParen.tex : '\\frac{' + svBare.tex + '}{' + formatNumberTex(a) + '}';
      const lnArgPlain = Math.abs(a - 1) < EPS ? svBare.plain : '(' + svBare.plain + ')/' + formatNumberPlain(a);
      const numPrefixTex = Math.abs(effAc - 1) < EPS ? '' : formatNumberTex(effAc);
      const numPrefixPlain = Math.abs(effAc - 1) < EPS ? '' : formatNumberPlain(effAc) + '*';
      return {
        sign: -sign,
        texAbs: '\\frac{' + numPrefixTex + '\\left(\\gamma + \\ln\\left(' + lnArgTex + '\\right)\\right)}{' + svBare.tex + '}',
        plainAbs: numPrefixPlain + '(gamma + ln(' + lnArgPlain + '))/(' + svBare.plain + ')',
        roc: shift,
        ruleName: 'การแปลงลอการิทึม ln(at) (ค่าคงที่ออยเลอร์ γ ≈ 0.5772)' + sShiftSuffix,
        termTimeTex
      };
    }
  }

  // 2. t^n * ln(t)
  if (core.type === 'bin' && core.op === '*') {
    let powN = null, lnNode = null;
    const checkPow = (nd) => {
      if (nd.type === 'var') return 1;
      if (nd.type === 'bin' && nd.op === '^' && nd.left.type === 'var' && !dependsOnT(nd.right)) {
        const v = evalAt(nd.right, 0);
        if (v >= 1 && Math.abs(v - Math.round(v)) < EPS && v <= 6) return Math.round(v);
      }
      return null;
    };
    if (core.right.type === 'call' && core.right.fn === 'ln') { powN = checkPow(core.left); lnNode = core.right; }
    else if (core.left.type === 'call' && core.left.fn === 'ln') { powN = checkPow(core.right); lnNode = core.left; }
    if (powN !== null && lnNode) {
      const lin = tryLinearT(lnNode.arg);
      if (lin && Math.abs(lin.b) < EPS && lin.a > EPS) {
        let hn = 0;
        for (let k = 1; k <= powN; k++) hn += 1 / k;
        const numVal = ac * factorial(powN);
        const lnArgTex = Math.abs(lin.a - 1) < EPS ? svParen.tex : '\\frac{' + svBare.tex + '}{' + formatNumberTex(lin.a) + '}';
        const lnArgPlain = Math.abs(lin.a - 1) < EPS ? svBare.plain : '(' + svBare.plain + ')/' + formatNumberPlain(lin.a);
        return {
          sign,
          texAbs: '\\frac{' + formatNumberTex(numVal) + '}{' + svParen.tex + '^{' + (powN + 1) + '}}\\left(' + formatNumberTex(hn) + ' - \\gamma - \\ln\\left(' + lnArgTex + '\\right)\\right)',
          plainAbs: formatNumberPlain(numVal) + '/(' + svParen.plain + '^' + (powN + 1) + ')*(' + formatNumberPlain(hn) + ' - gamma - ln(' + lnArgPlain + '))',
          roc: shift,
          ruleName: 'การแปลง t^n ln(at)' + sShiftSuffix,
          termTimeTex
        };
      }
    }
  }

  // 3. sinc(a*t) = sin(a*t)/(a*t)
  if (core.type === 'call' && core.fn === 'sinc') {
    const lin = tryLinearT(core.arg);
    if (lin && Math.abs(lin.b) < EPS && Math.abs(lin.a) > EPS) {
      const w = Math.abs(lin.a);
      const effAc = ac / w;
      const prefTex = Math.abs(effAc - 1) < EPS ? '' : formatNumberTex(effAc) + ' ';
      const prefPlain = Math.abs(effAc - 1) < EPS ? '' : formatNumberPlain(effAc) + '*';
      return {
        sign,
        texAbs: prefTex + '\\arctan\\left(\\frac{' + formatNumberTex(w) + '}{' + svBare.tex + '}\\right)',
        plainAbs: prefPlain + 'arctan(' + formatNumberPlain(w) + '/(' + svBare.plain + '))',
        roc: shift,
        ruleName: 'การแปลงฟังก์ชัน sinc(at) = sin(at)/(at)' + sShiftSuffix,
        termTimeTex
      };
    }
  }

  // 4. Division by t: f(t)/t -> frequency-domain integration
  if (core.type === 'bin' && core.op === '/' && core.right.type === 'var') {
    const top = core.left;
    // 4a. sin(a*t)/t
    if (top.type === 'call' && top.fn === 'sin') {
      const lin = tryLinearT(top.arg);
      if (lin && Math.abs(lin.b) < EPS && Math.abs(lin.a) > EPS) {
        const sgnW = lin.a < 0 ? -1 : 1;
        const w = Math.abs(lin.a);
        return {
          sign: sign * sgnW,
          texAbs: cTex + '\\arctan\\left(\\frac{' + formatNumberTex(w) + '}{' + svBare.tex + '}\\right)',
          plainAbs: cPlain + 'arctan(' + formatNumberPlain(w) + '/(' + svBare.plain + '))',
          roc: shift,
          ruleName: 'สมบัติการหารด้วย t: ∫_s^∞ F(u) du ของ sin(at)/t' + sShiftSuffix,
          termTimeTex
        };
      }
    }
    // 4b. sinh(a*t)/t
    if (top.type === 'call' && top.fn === 'sinh') {
      const lin = tryLinearT(top.arg);
      if (lin && Math.abs(lin.b) < EPS && Math.abs(lin.a) > EPS) {
        const sgnW = lin.a < 0 ? -1 : 1;
        const w = Math.abs(lin.a);
        const halfAc = ac * 0.5;
        const prefTex = Math.abs(halfAc - 1) < EPS ? '' : formatNumberTex(halfAc) + ' ';
        const prefPlain = Math.abs(halfAc - 1) < EPS ? '' : formatNumberPlain(halfAc) + '*';
        return {
          sign: sign * sgnW,
          texAbs: prefTex + '\\ln\\left(\\frac{' + formatShiftedVar(shift - w, false).tex + '}{' + formatShiftedVar(shift + w, false).tex + '}\\right)',
          plainAbs: prefPlain + 'ln((' + formatShiftedVar(shift - w, false).plain + ')/(' + formatShiftedVar(shift + w, false).plain + '))',
          roc: shift + w,
          ruleName: 'สมบัติการหารด้วย t ของ sinh(at)/t' + sShiftSuffix,
          termTimeTex
        };
      }
    }
    // 4c. (cos(a*t) - cos(b*t))/t or (1 - cos(b*t))/t or (e^(b*t) - e^(a*t))/t
    try {
      const topTerms = expandToSumOfProducts(top);
      if (topTerms.length === 2 && Math.abs(topTerms[0].coeff + topTerms[1].coeff) < EPS) {
        const cTop = topTerms[0].coeff;
        const f0 = topTerms[0].factors;
        const f1 = topTerms[1].factors;
        // (1 - cos(w*t))/t or (cos(a*t) - cos(b*t))/t
        const isUnitOrCos = (fs) => fs.length === 0 || (fs.length === 1 && fs[0].kind === 'cos');
        if (isUnitOrCos(f0) && isUnitOrCos(f1)) {
          const w0 = f0.length === 0 ? 0 : f0[0].w;
          const w1 = f1.length === 0 ? 0 : f1[0].w;
          // cTop * (cos(w0 t) - cos(w1 t)) / t = cTop * 1/2 * ln((s^2 + w1^2)/(s^2 + w0^2))
          const eff = coeff * cTop * 0.5;
          const fSign = eff < 0 ? -1 : 1;
          const aEff = Math.abs(eff);
          const prefTex = Math.abs(aEff - 1) < EPS ? '' : formatNumberTex(aEff) + ' ';
          const prefPlain = Math.abs(aEff - 1) < EPS ? '' : formatNumberPlain(aEff) + '*';
          const numIn = Math.abs(w1) < EPS ? svParen.tex + '^{2}' : svParen.tex + '^{2} + ' + formatNumberTex(w1 * w1);
          const denIn = Math.abs(w0) < EPS ? svParen.tex + '^{2}' : svParen.tex + '^{2} + ' + formatNumberTex(w0 * w0);
          const numPl = Math.abs(w1) < EPS ? svParen.plain + '^2' : svParen.plain + '^2 + ' + formatNumberPlain(w1 * w1);
          const denPl = Math.abs(w0) < EPS ? svParen.plain + '^2' : svParen.plain + '^2 + ' + formatNumberPlain(w0 * w0);
          return {
            sign: fSign,
            texAbs: prefTex + '\\ln\\left(\\frac{' + numIn + '}{' + denIn + '}\\right)',
            plainAbs: prefPlain + 'ln((' + numPl + ')/(' + denPl + '))',
            roc: shift,
            ruleName: 'สมบัติการหารด้วย t: (cos(at) - cos(bt))/t' + sShiftSuffix,
            termTimeTex
          };
        }
        // (e^(r0 t) - e^(r1 t))/t -> ln((s - r1)/(s - r0))
        const isUnitOrExp = (fs) => fs.length === 0 || (fs.length === 1 && fs[0].kind === 'exp');
        if (isUnitOrExp(f0) && isUnitOrExp(f1)) {
          const r0 = f0.length === 0 ? 0 : f0[0].rate;
          const r1 = f1.length === 0 ? 0 : f1[0].rate;
          const eff = coeff * cTop;
          const fSign = eff < 0 ? -1 : 1;
          const aEff = Math.abs(eff);
          const prefTex = Math.abs(aEff - 1) < EPS ? '' : formatNumberTex(aEff) + ' ';
          const prefPlain = Math.abs(aEff - 1) < EPS ? '' : formatNumberPlain(aEff) + '*';
          return {
            sign: fSign,
            texAbs: prefTex + '\\ln\\left(\\frac{' + formatShiftedVar(shift + r1, false).tex + '}{' + formatShiftedVar(shift + r0, false).tex + '}\\right)',
            plainAbs: prefPlain + 'ln((' + formatShiftedVar(shift + r1, false).plain + ')/(' + formatShiftedVar(shift + r0, false).plain + '))',
            roc: shift + Math.max(r0, r1),
            ruleName: 'สมบัติการหารด้วย t: (e^(bt) - e^(at))/t' + sShiftSuffix,
            termTimeTex
          };
        }
      }
    } catch (_) {}
  }

  // 5. Bessel J0(a*t), J1(a*t), I0(a*t)
  if (core.type === 'call' && (core.fn === 'j0' || core.fn === 'j1' || core.fn === 'i0')) {
    const lin = tryLinearT(core.arg);
    if (lin && Math.abs(lin.b) < EPS && Math.abs(lin.a) > EPS) {
      const a = Math.abs(lin.a);
      const a2Tex = formatNumberTex(a * a);
      const a2Plain = formatNumberPlain(a * a);
      if (core.fn === 'j0') {
        return {
          sign,
          texAbs: '\\frac{' + formatNumberTex(ac) + '}{\\sqrt{' + svParen.tex + '^{2} + ' + a2Tex + '}}',
          plainAbs: formatNumberPlain(ac) + '/sqrt(' + svParen.plain + '^2 + ' + a2Plain + ')',
          roc: shift,
          ruleName: 'ฟังก์ชันเบสเซลชนิดที่หนึ่ง J₀(at)' + sShiftSuffix,
          termTimeTex
        };
      }
      if (core.fn === 'j1') {
        const sgnA = lin.a < 0 ? -1 : 1;
        const radTex = '\\sqrt{' + svParen.tex + '^{2} + ' + a2Tex + '}';
        const radPlain = 'sqrt(' + svParen.plain + '^2 + ' + a2Plain + ')';
        const aDenTex = Math.abs(a - 1) < EPS ? '' : formatNumberTex(a);
        return {
          sign: sign * sgnA,
          texAbs: cTex + '\\frac{' + radTex + ' - ' + svParen.tex + '}{' + aDenTex + radTex + '}',
          plainAbs: cPlain + '(' + radPlain + ' - ' + svParen.plain + ')/(' + formatNumberPlain(a) + '*' + radPlain + ')',
          roc: shift,
          ruleName: 'ฟังก์ชันเบสเซลชนิดที่หนึ่ง J₁(at)' + sShiftSuffix,
          termTimeTex
        };
      }
      if (core.fn === 'i0') {
        return {
          sign,
          texAbs: '\\frac{' + formatNumberTex(ac) + '}{\\sqrt{' + svParen.tex + '^{2} - ' + a2Tex + '}}',
          plainAbs: formatNumberPlain(ac) + '/sqrt(' + svParen.plain + '^2 - ' + a2Plain + ')',
          roc: shift + a,
          ruleName: 'ฟังก์ชันเบสเซลดัดแปร I₀(at)' + sShiftSuffix,
          termTimeTex
        };
      }
    }
  }

  // 6. Error functions erf / erfc
  if (core.type === 'call' && (core.fn === 'erf' || core.fn === 'erfc')) {
    const sq = tryCoeffSqrtT(core.arg);
    if (sq !== null && Math.abs(sq) > EPS) {
      const sgnSq = sq < 0 ? -1 : 1;
      const a = Math.abs(sq);
      const radTex = '\\sqrt{' + svBare.tex + ' + ' + formatNumberTex(a * a) + '}';
      const radPlain = 'sqrt(' + svBare.plain + ' + ' + formatNumberPlain(a * a) + ')';
      if (core.fn === 'erf') {
        return {
          sign: sign * sgnSq,
          texAbs: '\\frac{' + formatNumberTex(ac * a) + '}{' + svParen.tex + ' ' + radTex + '}',
          plainAbs: formatNumberPlain(ac * a) + '/(' + svParen.plain + '*' + radPlain + ')',
          roc: shift,
          ruleName: 'ฟังก์ชันค่าคลาดเคลื่อน erf(a√t)' + sShiftSuffix,
          termTimeTex
        };
      }
      if (sq > 0) {
        return {
          sign,
          texAbs: cTex + '\\frac{' + radTex + ' - ' + formatNumberTex(a) + '}{' + svParen.tex + ' ' + radTex + '}',
          plainAbs: cPlain + '(' + radPlain + ' - ' + formatNumberPlain(a) + ')/(' + svParen.plain + '*' + radPlain + ')',
          roc: shift,
          ruleName: 'ฟังก์ชันค่าคลาดเคลื่อนเติมเต็ม erfc(a√t)' + sShiftSuffix,
          termTimeTex
        };
      }
    }
    const lin = tryLinearT(core.arg);
    if (lin && Math.abs(lin.b) < EPS && Math.abs(lin.a) > EPS) {
      const sgnA = lin.a < 0 ? -1 : 1;
      const a = Math.abs(lin.a);
      const d4a2Tex = formatNumberTex(4 * a * a);
      const d2aTex = formatNumberTex(2 * a);
      const expPartTex = 'e^{\\frac{' + svParen.tex + '^{2}}{' + d4a2Tex + '}} \\operatorname{erfc}\\left(\\frac{' + svBare.tex + '}{' + d2aTex + '}\\right)';
      const expPartPlain = 'exp((' + svParen.plain + ')^2/' + formatNumberPlain(4 * a * a) + ')*erfc((' + svBare.plain + ')/' + formatNumberPlain(2 * a) + ')';
      if (core.fn === 'erf') {
        return {
          sign: sign * sgnA,
          texAbs: '\\frac{' + (Math.abs(ac - 1) < EPS ? '' : formatNumberTex(ac) + ' ') + expPartTex + '}{' + svBare.tex + '}',
          plainAbs: cPlain + '(' + expPartPlain + ')/(' + svBare.plain + ')',
          roc: shift,
          ruleName: 'ฟังก์ชันค่าคลาดเคลื่อน erf(at)' + sShiftSuffix,
          termTimeTex
        };
      }
      if (lin.a > 0) {
        return {
          sign,
          texAbs: '\\frac{' + (Math.abs(ac - 1) < EPS ? '' : formatNumberTex(ac)) + '\\left(1 - ' + expPartTex + '\\right)}{' + svBare.tex + '}',
          plainAbs: cPlain + '(1 - ' + expPartPlain + ')/(' + svBare.plain + ')',
          roc: shift,
          ruleName: 'ฟังก์ชันค่าคลาดเคลื่อนเติมเต็ม erfc(at)' + sShiftSuffix,
          termTimeTex
        };
      }
    }
  }

  // 7. Sine & Cosine Integrals Si(at), Ci(at)
  if (core.type === 'call' && (core.fn === 'si' || core.fn === 'ci')) {
    const lin = tryLinearT(core.arg);
    if (lin && Math.abs(lin.b) < EPS && lin.a > EPS) {
      const a = lin.a;
      if (core.fn === 'si') {
        return {
          sign,
          texAbs: cTex + '\\frac{\\arctan\\left(\\frac{' + formatNumberTex(a) + '}{' + svBare.tex + '}\\right)}{' + svBare.tex + '}',
          plainAbs: cPlain + 'arctan(' + formatNumberPlain(a) + '/(' + svBare.plain + '))/(' + svBare.plain + ')',
          roc: shift,
          ruleName: 'อินทิกรัลไซน์ Si(at)' + sShiftSuffix,
          termTimeTex
        };
      }
      return {
        sign: -sign,
        texAbs: cTex + '\\frac{\\ln\\left(1 + \\frac{' + svParen.tex + '^{2}}{' + formatNumberTex(a * a) + '}\\right)}{2' + svParen.tex + '}',
        plainAbs: cPlain + 'ln(1 + (' + svParen.plain + ')^2/' + formatNumberPlain(a * a) + ')/(2*' + svParen.plain + ')',
        roc: shift,
        ruleName: 'อินทิกรัลโคไซน์ Ci(at)' + sShiftSuffix,
        termTimeTex
      };
    }
  }

  // 8. Gaussian exp(-a * t^2)
  if (core.type === 'call' && core.fn === 'exp') {
    const q = tryPureQuadraticT(core.arg);
    if (q && q.c2 < -EPS) {
      const a = -q.c2;
      const extraC = Math.exp(q.c0);
      const totalAc = ac * extraC * 0.5 * Math.sqrt(Math.PI / a);
      const rCheck = toRational(ac * extraC / 2);
      let coefTex;
      if (rCheck && Math.abs(a - 1) < EPS) {
        coefTex = (rCheck.n === 1 ? '' : rCheck.n) + '\\frac{\\sqrt{\\pi}}{' + rCheck.d + '}';
      } else {
        coefTex = formatNumberTex(totalAc);
      }
      const d4aTex = formatNumberTex(4 * a);
      const argErfcTex = Math.abs(a - 1) < EPS
        ? '\\frac{' + svBare.tex + '}{2}'
        : '\\frac{' + svBare.tex + '}{2\\sqrt{' + formatNumberTex(a) + '}}';
      return {
        sign,
        texAbs: coefTex + ' e^{\\frac{' + svParen.tex + '^{2}}{' + d4aTex + '}} \\operatorname{erfc}\\left(' + argErfcTex + '\\right)',
        plainAbs: formatNumberPlain(totalAc) + '*exp((' + svParen.plain + ')^2/' + formatNumberPlain(4 * a) + ')*erfc((' + svBare.plain + ')/(2*sqrt(' + formatNumberPlain(a) + ')))',
        roc: -Infinity,
        ruleName: 'ฟังก์ชันเกาส์เซียน e^(-at²)' + sShiftSuffix,
        termTimeTex
      };
    }
  }

  // 9. Rational functions 1/(a*t + b) and 1/(c + a*t^2)
  if (core.type === 'bin' && core.op === '/' && !dependsOnT(core.left)) {
    const topVal = evalAt(core.left, 0);
    const eff = coeff * topVal;
    const fSign = eff < 0 ? -1 : 1;
    const aEff = Math.abs(eff);
    const linDen = tryLinearT(core.right);
    if (linDen && Math.abs(linDen.a) > EPS && linDen.b / linDen.a > EPS) {
      // eff / (a*(t + t0)) = (eff/a) * e^(t0*s) E1(t0*s)
      const t0 = linDen.b / linDen.a;
      const scale = aEff / Math.abs(linDen.a);
      const finSign = fSign * (linDen.a < 0 ? -1 : 1);
      const pTex = Math.abs(scale - 1) < EPS ? '' : formatNumberTex(scale) + ' ';
      const pPlain = Math.abs(scale - 1) < EPS ? '' : formatNumberPlain(scale) + '*';
      const argTex = Math.abs(t0 - 1) < EPS ? svBare.tex : formatNumberTex(t0) + svParen.tex;
      const argPlain = Math.abs(t0 - 1) < EPS ? svBare.plain : formatNumberPlain(t0) + '*' + svParen.plain;
      return {
        sign: finSign,
        texAbs: pTex + 'e^{' + argTex + '} E_1\\left(' + argTex + '\\right)',
        plainAbs: pPlain + 'exp(' + argPlain + ')*E1(' + argPlain + ')',
        roc: shift,
        ruleName: 'การแปลงเศษส่วน 1/(t + a) ด้วยอินทิกรัลเอ็กซ์โพเนนเชียล E₁' + sShiftSuffix,
        termTimeTex
      };
    }
    const quadDen = tryPureQuadraticT(core.right);
    if (quadDen && quadDen.c2 > EPS && quadDen.c0 > EPS) {
      // eff / (c2 * (t^2 + w^2)) where w = sqrt(c0 / c2)
      const w = Math.sqrt(quadDen.c0 / quadDen.c2);
      const scale = aEff / (quadDen.c2 * w);
      const pTex = Math.abs(scale - 1) < EPS ? '' : formatNumberTex(scale) + ' ';
      const pPlain = Math.abs(scale - 1) < EPS ? '' : formatNumberPlain(scale) + '*';
      const wsTex = Math.abs(w - 1) < EPS ? svBare.tex : formatNumberTex(w) + svParen.tex;
      const wsPlain = Math.abs(w - 1) < EPS ? svBare.plain : formatNumberPlain(w) + '*' + svParen.plain;
      return {
        sign: fSign,
        texAbs: pTex + '\\left[\\operatorname{Ci}\\left(' + wsTex + '\\right)\\sin\\left(' + wsTex + '\\right) + \\left(\\frac{\\pi}{2} - \\operatorname{Si}\\left(' + wsTex + '\\right)\\right)\\cos\\left(' + wsTex + '\\right)\\right]',
        plainAbs: pPlain + '(Ci(' + wsPlain + ')*sin(' + wsPlain + ') + (pi/2 - Si(' + wsPlain + '))*cos(' + wsPlain + '))',
        roc: shift,
        ruleName: 'การแปลงเศษส่วนตรรกยะ 1/(c + at²) ด้วยฟังก์ชัน Si และ Ci' + sShiftSuffix,
        termTimeTex
      };
    }
  }

  // 10. Staircase & Periodic functions: floor, ceil, sawtooth, square
  if (core.type === 'call' && ['floor', 'ceil', 'sawtooth', 'square'].includes(core.fn)) {
    const lin = tryLinearT(core.arg);
    if (lin && Math.abs(lin.b) < EPS && lin.a > EPS) {
      const a = lin.a;
      const sOverATex = Math.abs(a - 1) < EPS ? svBare.tex : '\\frac{' + svBare.tex + '}{' + formatNumberTex(a) + '}';
      const sOverAPlain = Math.abs(a - 1) < EPS ? svBare.plain : '(' + svBare.plain + ')/' + formatNumberPlain(a);
      if (core.fn === 'floor') {
        return {
          sign,
          texAbs: '\\frac{' + formatNumberTex(ac) + '}{' + svParen.tex + '\\left(e^{' + sOverATex + '} - 1\\right)}',
          plainAbs: formatNumberPlain(ac) + '/(' + svParen.plain + '*(exp(' + sOverAPlain + ') - 1))',
          roc: shift,
          ruleName: 'ฟังก์ชันขั้นบันไดไต่ระดับ ⌊at⌋' + sShiftSuffix,
          termTimeTex
        };
      }
      if (core.fn === 'ceil') {
        return {
          sign,
          texAbs: '\\frac{' + (Math.abs(ac - 1) < EPS ? '' : formatNumberTex(ac) + ' ') + 'e^{' + sOverATex + '}}{' + svParen.tex + '\\left(e^{' + sOverATex + '} - 1\\right)}',
          plainAbs: cPlain + 'exp(' + sOverAPlain + ')/(' + svParen.plain + '*(exp(' + sOverAPlain + ') - 1))',
          roc: shift,
          ruleName: 'ฟังก์ชันเพดาน ⌈at⌉' + sShiftSuffix,
          termTimeTex
        };
      }
      if (core.fn === 'sawtooth') {
        return {
          sign,
          texAbs: cTex + '\\left(\\frac{' + formatNumberTex(a) + '}{' + svParen.tex + '^{2}} - \\frac{1}{' + svParen.tex + '\\left(e^{' + sOverATex + '} - 1\\right)}\\right)',
          plainAbs: cPlain + '(' + formatNumberPlain(a) + '/(' + svParen.plain + '^2) - 1/(' + svParen.plain + '*(exp(' + sOverAPlain + ') - 1)))',
          roc: shift,
          ruleName: 'การแปลงฟังก์ชันเป็นคาบ: คลื่นฟันเลื่อย sawtooth(at)' + sShiftSuffix,
          termTimeTex
        };
      }
      if (core.fn === 'square') {
        const halfOverATex = '\\frac{' + svBare.tex + '}{' + formatNumberTex(2 * a) + '}';
        const halfOverAPlain = '(' + svBare.plain + ')/' + formatNumberPlain(2 * a);
        const wr = wrapScale('\\frac{1}{' + svBare.tex + '}\\tanh\\left(' + halfOverATex + '\\right)', 'tanh(' + halfOverAPlain + ')/(' + svBare.plain + ')');
        return {
          sign: wr.finalSign,
          texAbs: wr.tx,
          plainAbs: wr.pl,
          roc: shift,
          ruleName: 'การแปลงฟังก์ชันเป็นคาบ: คลื่นสี่เหลี่ยม square(at)' + sShiftSuffix,
          termTimeTex
        };
      }
    }
  }

  return null;
}

// 8-point Gauss-Legendre nodes & weights on [-1, 1] for composite numerical Laplace integration
const GL8_X = [
  -0.9602898564975363, -0.7966664774136267, -0.5255324099163290, -0.1834346424956498,
   0.1834346424956498,  0.5255324099163290,  0.7966664774136267,  0.9602898564975363
];
const GL8_W = [
  0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.3626837833783620,
  0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763
];

function numericLaplaceIntegral(ast, sigma, omega) {
  if (!Number.isFinite(sigma) || !Number.isFinite(omega)) {
    return { ok: false, reason: 'ค่า s ไม่ถูกต้อง' };
  }
  // Integrate on [0, T] with fine composite panels + tail transformation u in [0, 1) -> t = T + scale * u / (1 - u)
  let reSum = 0;
  let imSum = 0;
  let badCount = 0;

  // Partition [0, 20] unevenly (finer near t = 0 for integrable singularities like ln(t), 1/sqrt(t))
  const breaks = [0, 0.01, 0.05, 0.2, 0.6, 1.5, 3, 5, 8, 12, 18, 26, 38];
  // Add extra subdivisions if |omega| is large
  const subPerSpan = Math.min(24, Math.max(4, Math.ceil(Math.abs(omega) * 1.5)));

  for (let b = 0; b < breaks.length - 1; b++) {
    const tStart = breaks[b];
    const tEnd = breaks[b + 1];
    const h = (tEnd - tStart) / subPerSpan;
    for (let m = 0; m < subPerSpan; m++) {
      const a0 = tStart + m * h;
      const b0 = a0 + h;
      const mid = 0.5 * (a0 + b0);
      const half = 0.5 * (b0 - a0);
      for (let k = 0; k < 8; k++) {
        const t = mid + half * GL8_X[k];
        const damp = Math.exp(-sigma * t);
        if (damp < 1e-18) continue;
        let ft;
        try {
          ft = evalAt(ast, t);
        } catch (_) {
          badCount++;
          continue;
        }
        if (!Number.isFinite(ft)) {
          badCount++;
          continue;
        }
        const w = half * GL8_W[k] * damp * ft;
        if (!Number.isFinite(w) || Math.abs(w) > 1e14) {
          return { ok: false, reason: 'อินทิกรัลลู่ออกที่ค่า Re(s) นี้ หรือมีภาวะเอกฐานไม่ลู่เข้า' };
        }
        reSum += w * Math.cos(omega * t);
        imSum -= w * Math.sin(omega * t);
      }
    }
  }

  // Tail [38, inf): t = 38 + 8 * u / (1 - u), dt = 8 / (1 - u)^2 du for u in [0, 1)
  const T0 = breaks[breaks.length - 1];
  const tailPanels = 16;
  for (let m = 0; m < tailPanels; m++) {
    const u0 = m / tailPanels;
    const u1 = (m + 1) / tailPanels;
    const mid = 0.5 * (u0 + u1);
    const half = 0.5 * (u1 - u0);
    for (let k = 0; k < 8; k++) {
      const u = mid + half * GL8_X[k];
      if (u >= 0.9999) continue;
      const oneMinusU = 1 - u;
      const t = T0 + (8 * u) / oneMinusU;
      const logDamp = -sigma * t;
      if (logDamp < -45) continue;
      let ft;
      try {
        ft = evalAt(ast, t);
      } catch (_) {
        continue;
      }
      if (!Number.isFinite(ft)) continue;
      const jac = 8 / (oneMinusU * oneMinusU);
      const prod = ft * Math.exp(logDamp) * jac;
      if (!Number.isFinite(prod) || Math.abs(prod) > 1e13) {
        return { ok: false, reason: 'อินทิกรัลลู่ออกเมื่อ t → ∞ สำหรับ σ = ' + sigma };
      }
      const w = half * GL8_W[k] * prod;
      reSum += w * Math.cos(omega * t);
      imSum -= w * Math.sin(omega * t);
    }
  }

  if (badCount > 40 || !Number.isFinite(reSum) || !Number.isFinite(imSum)) {
    return { ok: false, reason: 'ฟังก์ชันมีจุดไม่นิยามหรือลู่ออกบนช่วง t ≥ 0' };
  }
  return { ok: true, re: reSum, im: imSum };
}

function formatComplexVal(re, im) {
  const cleanRe = Math.abs(re) < 1e-11 ? 0 : Number(re.toPrecision(7));
  const cleanIm = Math.abs(im) < 1e-11 ? 0 : Number(im.toPrecision(7));
  if (cleanIm === 0) return String(cleanRe);
  const sign = cleanIm < 0 ? ' - ' : ' + ';
  return cleanRe + sign + Math.abs(cleanIm) + 'j';
}

function computeLaplace(rawInput) {
  const rawAst = parseExpression(rawInput);
  const ast = rewritePiecewiseAst(rawAst);

  // Try symbolic transformation additive-term by additive-term
  const additiveNodes = flattenAdditiveAst(ast);
  const transformed = [];
  let overallRoc = -Infinity;
  const steps = [];
  let allSymbolic = true;
  let divergenceError = null;

  for (const subNode of additiveNodes) {
    // 1) Try special symbolic rules first (ln, sinc, J0, erf, Gaussian, floor, etc.)
    const spec = tryTransformSpecialAstTerm(subNode);
    if (spec) {
      transformed.push(spec);
      overallRoc = Math.max(overallRoc, spec.roc);
      const signedResTex = (spec.sign < 0 ? '-' : '') + spec.texAbs;
      steps.push({
        ruleName: spec.ruleName,
        stepTex: '\\mathcal{L}\\left\\{' + spec.termTimeTex + '\\right\\} = ' + signedResTex
      });
      continue;
    }

    // 2) Try algebraic/trig/step/delta expansion engine
    try {
      const expandedTerms = expandToSumOfProducts(subNode);
      for (const term of expandedTerms) {
        const res = transformSingleTerm(term);
        if (res) {
          transformed.push(res);
          overallRoc = Math.max(overallRoc, res.roc);
          const signedResTex = (res.sign < 0 ? '-' : '') + res.texAbs;
          steps.push({
            ruleName: res.ruleName,
            stepTex: '\\mathcal{L}\\left\\{' + res.termTimeTex + '\\right\\} = ' + signedResTex
          });
        }
      }
    } catch (err) {
      if (err && err.message && err.message.includes('ลู่ออก')) {
        divergenceError = err;
      }
      allSymbolic = false;
      break;
    }
  }

  if (divergenceError) {
    throw divergenceError;
  }

  if (allSymbolic) {
    if (transformed.length === 0) {
      return {
        isNumericFallback: false,
        ast: rawAst,
        parsedTex: 'f(t) = 0',
        resultTex: 'F(s) = 0',
        plainFs: '0',
        rocText: 'ROC: ทุกค่า s ∈ ℂ',
        steps: [{
          ruleName: 'ฟังก์ชันศูนย์บนช่วง t ≥ 0',
          stepTex: '\\mathcal{L}\\{0\\} = 0'
        }]
      };
    }

    const joined = joinTransformedTerms(transformed);
    const rocText = overallRoc === -Infinity
      ? 'ROC: ทุกค่า s ∈ ℂ'
      : 'ROC: Re(s) > ' + formatNumberPlain(overallRoc);

    return {
      isNumericFallback: false,
      ast: rawAst,
      parsedTex: 'f(t) = ' + astToTex(rawAst),
      resultTex: 'F(s) = ' + joined.tex,
      plainFs: joined.plain,
      rocText,
      steps
    };
  }

  // 3) Universal Integral & Numerical Quadrature Mode for arbitrary f(t)
  const ftTex = astToTex(rawAst);
  const testAt2 = numericLaplaceIntegral(rawAst, 2, 0);
  const testAt5 = numericLaplaceIntegral(rawAst, 5, 0);
  if (!testAt2.ok && !testAt5.ok) {
    throw new Error(testAt2.reason || 'ไม่สามารถอินทิเกรตฟังก์ชันนี้บนช่วง t ≥ 0 ได้ (ฟังก์ชันอาจลู่ออกเร็วเกินระดับเอ็กซ์โพเนนเชียลหรือมีจุดไม่นิยาม)');
  }

  const cleanRawPlain = rawInput.replace(/^\s*(?:[fyg]\s*\(\s*t\s*\)|[fyg])\s*=\s*/i, '').trim();
  return {
    isNumericFallback: true,
    ast: rawAst,
    parsedTex: 'f(t) = ' + ftTex,
    resultTex: 'F(s) = \\int_0^{\\infty} e^{-st} \\left(' + ftTex + '\\right) dt',
    plainFs: 'integral(0, inf, exp(-s*t)*(' + cleanRawPlain + '), t)',
    rocText: 'คำนวณเชิงตัวเลข (Numerical Quadrature)',
    steps: [
      {
        ruleName: 'นิยามอินทิกรัลการแปลงลาปลาซทั่วไป',
        stepTex: '\\mathcal{L}\\left\\{' + ftTex + '\\right\\} = \\int_0^{\\infty} e^{-st} \\left(' + ftTex + '\\right) dt'
      },
      {
        ruleName: 'การประมาณค่าเชิงตัวเลข Gauss-Legendre Quadrature',
        stepTex: 's = \\sigma + j\\omega \\implies F(s) = \\int_0^{\\infty} e^{-\\sigma t}\\cos(\\omega t)f(t)\\,dt - j\\int_0^{\\infty} e^{-\\sigma t}\\sin(\\omega t)f(t)\\,dt'
      }
    ]
  };
}

/* =====================================================================
 * 5C. INVERSE LAPLACE TRANSFORM ENGINE L^-1{F(s)} -> f(t)
 * ===================================================================== */
function polyAdd(a, b) {
  const len = Math.max(a.length, b.length);
  const out = new Array(len).fill(0);
  for (let i = 0; i < len; i++) out[i] = (a[i] || 0) + (b[i] || 0);
  return trimPoly(out);
}

function polyPow(p, n) {
  let acc = [1];
  for (let i = 0; i < n; i++) acc = polyMul(acc, p);
  return acc;
}

function polyDivMod(num, den) {
  const d = trimPoly(den);
  const degD = d.length - 1;
  const leadD = d[degD];
  if (Math.abs(leadD) < 1e-14) throw new Error('พบการหารด้วยพหุนามศูนย์');
  let rem = trimPoly(num);
  if (rem.length - 1 < degD) return { quot: [0], rem };
  const quot = new Array(rem.length - degD).fill(0);
  while (rem.length - 1 >= degD && !(rem.length === 1 && Math.abs(rem[0]) < 1e-13)) {
    const degR = rem.length - 1;
    const shift = degR - degD;
    const factor = rem[degR] / leadD;
    quot[shift] += factor;
    for (let i = 0; i <= degD; i++) {
      rem[i + shift] -= factor * d[i];
    }
    rem = trimPoly(rem);
    if (degR === rem.length - 1) break;
  }
  return { quot: trimPoly(quot), rem };
}

function astToRationalPoly(node) {
  if (!dependsOnT(node)) {
    return { num: [evalAt(node, 0)], den: [1] };
  }
  if (node.type === 'var') {
    return { num: [0, 1], den: [1] };
  }
  if (node.type === 'neg') {
    const sub = astToRationalPoly(node.arg);
    if (!sub) return null;
    return { num: polyScale(sub.num, -1), den: sub.den };
  }
  if (node.type === 'bin') {
    if (node.op === '+' || node.op === '-') {
      const l = astToRationalPoly(node.left);
      const r = astToRationalPoly(node.right);
      if (!l || !r) return null;
      const t1 = polyMul(l.num, r.den);
      const t2 = polyMul(r.num, l.den);
      return {
        num: node.op === '+' ? polyAdd(t1, t2) : polySub(t1, t2),
        den: polyMul(l.den, r.den)
      };
    }
    if (node.op === '*') {
      const l = astToRationalPoly(node.left);
      const r = astToRationalPoly(node.right);
      if (!l || !r) return null;
      return { num: polyMul(l.num, r.num), den: polyMul(l.den, r.den) };
    }
    if (node.op === '/') {
      const l = astToRationalPoly(node.left);
      const r = astToRationalPoly(node.right);
      if (!l || !r) return null;
      if (r.num.length === 1 && Math.abs(r.num[0]) < 1e-14) {
        throw new Error('พบการหารด้วยศูนย์ใน F(s)');
      }
      return { num: polyMul(l.num, r.den), den: polyMul(l.den, r.num) };
    }
    if (node.op === '^' && !dependsOnT(node.right)) {
      const expVal = evalAt(node.right, 0);
      if (Math.abs(expVal - Math.round(expVal)) < EPS && Math.abs(expVal) <= 10) {
        const n = Math.round(expVal);
        const base = astToRationalPoly(node.left);
        if (!base) return null;
        if (n === 0) return { num: [1], den: [1] };
        if (n > 0) return { num: polyPow(base.num, n), den: polyPow(base.den, n) };
        return { num: polyPow(base.den, -n), den: polyPow(base.num, -n) };
      }
    }
  }
  return null;
}

function snapScalar(x) {
  if (Math.abs(x) < 1e-7) return 0;
  const r = toRational(x);
  if (r && r.d <= 200 && Math.abs(x - r.n / r.d) < 1e-5) {
    return r.n / r.d;
  }
  return x;
}

function evalMonicComplex(coeffs, re, im) {
  const deg = coeffs.length - 1;
  let pr = 1, pi = 0;
  for (let k = deg - 1; k >= 0; k--) {
    const nr = pr * re - pi * im + coeffs[k];
    const ni = pr * im + pi * re;
    pr = nr;
    pi = ni;
  }
  return { re: pr, im: pi };
}

// Factor monic polynomial into realFactors: [{ r, m }] and quadFactors: [{ alpha, w, k }] where B(s) = (s - alpha)^2 + w^2
function factorMonicPolynomial(monic) {
  let p = monic.slice();
  const realFactors = [];
  const quadFactors = [];

  // 1. Deflate exact s = 0 roots
  let zeroMult = 0;
  while (p.length > 1 && Math.abs(p[0]) < 1e-11) {
    zeroMult++;
    p = p.slice(1);
  }
  if (zeroMult > 0) realFactors.push({ r: 0, m: zeroMult });

  const deg = p.length - 1;
  if (deg === 0) return { realFactors, quadFactors };
  if (deg === 1) {
    realFactors.push({ r: snapScalar(-p[0]), m: 1 });
    return { realFactors, quadFactors };
  }
  if (deg === 2) {
    const b = p[1], c = p[0];
    const disc = b * b - 4 * c;
    if (Math.abs(disc) < 1e-9) {
      realFactors.push({ r: snapScalar(-b / 2), m: 2 });
    } else if (disc > 0) {
      const sq = Math.sqrt(disc);
      realFactors.push({ r: snapScalar((-b - sq) / 2), m: 1 });
      realFactors.push({ r: snapScalar((-b + sq) / 2), m: 1 });
    } else {
      const alpha = snapScalar(-b / 2);
      const w = snapScalar(Math.sqrt(-disc) / 2);
      quadFactors.push({ alpha, w, k: 1 });
    }
    return { realFactors, quadFactors };
  }

  // Repeated roots lose precision. Snap a cluster only when the original
  // polynomial and all required derivatives verify the rational root.
  function verifiedRoot(x, multiplicity) {
    for (let denominator = 1; denominator <= 200; denominator++) {
      const candidate = Math.round(x * denominator) / denominator;
      if (Math.abs(candidate - x) > 1e-5) continue;
      let derivative = p;
      let verified = true;
      for (let order = 0; order < multiplicity; order++) {
        const residual = derivative.reduceRight((sum, coefficient) => sum * candidate + coefficient, 0);
        const scale = derivative.reduce((sum, coefficient, degree) => sum + Math.abs(coefficient) * Math.max(1, Math.abs(candidate)) ** degree, 0);
        if (Math.abs(residual) > 1e-12 * Math.max(1, scale)) { verified = false; break; }
        derivative = polyDeriv(derivative);
      }
      if (verified) return candidate;
    }
    return snapScalar(x);
  }
  // Durand-Kerner complex root finder for deg >= 3
  const roots = [];
  let seedRe = 0.4123, seedIm = 0.8765;
  for (let k = 0; k < deg; k++) {
    roots.push({ re: seedRe, im: seedIm });
    const nr = seedRe * 0.4123 - seedIm * 0.8765;
    const ni = seedRe * 0.8765 + seedIm * 0.4123;
    seedRe = nr;
    seedIm = ni;
  }

  for (let iter = 0; iter < 180; iter++) {
    let maxDelta = 0;
    for (let i = 0; i < deg; i++) {
      const val = evalMonicComplex(p, roots[i].re, roots[i].im);
      let dr = 1, di = 0;
      for (let j = 0; j < deg; j++) {
        if (i === j) continue;
        const diffR = roots[i].re - roots[j].re;
        const diffI = roots[i].im - roots[j].im;
        const nr = dr * diffR - di * diffI;
        const ni = dr * diffI + di * diffR;
        dr = nr;
        di = ni;
      }
      const denom = dr * dr + di * di;
      if (denom < 1e-30) continue;
      const stepR = (val.re * dr + val.im * di) / denom;
      const stepI = (val.im * dr - val.re * di) / denom;
      roots[i].re -= stepR;
      roots[i].im -= stepI;
      maxDelta = Math.max(maxDelta, Math.hypot(stepR, stepI));
    }
    if (maxDelta < 1e-13) break;
  }

  // Cluster roots (tolerance 5e-3 for multiple roots whose precision is eps^(1/m))
  const used = new Array(deg).fill(false);
  const clusters = [];
  for (let i = 0; i < deg; i++) {
    if (used[i]) continue;
    const group = [roots[i]];
    used[i] = true;
    for (let j = i + 1; j < deg; j++) {
      if (!used[j] && Math.hypot(roots[i].re - roots[j].re, roots[i].im - roots[j].im) < 6e-3) {
        group.push(roots[j]);
        used[j] = true;
      }
    }
    const avgRe = group.reduce((s, z) => s + z.re, 0) / group.length;
    const avgIm = group.reduce((s, z) => s + z.im, 0) / group.length;
    clusters.push({ re: avgRe, im: avgIm, count: group.length, paired: false });
  }

  for (let i = 0; i < clusters.length; i++) {
    const cl = clusters[i];
    if (cl.paired) continue;
    if (Math.abs(cl.im) < 5e-3) {
      realFactors.push({ r: verifiedRoot(cl.re, cl.count), m: cl.count });
      cl.paired = true;
    } else {
      // Find conjugate cluster
      let conjIdx = -1;
      for (let j = i + 1; j < clusters.length; j++) {
        if (!clusters[j].paired && Math.hypot(cl.re - clusters[j].re, cl.im + clusters[j].im) < 1e-2) {
          conjIdx = j;
          break;
        }
      }
      if (conjIdx !== -1) {
        clusters[conjIdx].paired = true;
        cl.paired = true;
        const alpha = snapScalar(0.5 * (cl.re + clusters[conjIdx].re));
        const w = snapScalar(0.5 * (Math.abs(cl.im) + Math.abs(clusters[conjIdx].im)));
        quadFactors.push({ alpha, w, k: cl.count });
      } else {
        realFactors.push({ r: verifiedRoot(cl.re, cl.count), m: cl.count });
        cl.paired = true;
      }
    }
  }
  return { realFactors, quadFactors };
}

function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    if (pivot !== col) {
      const tmp = M[col];
      M[col] = M[pivot];
      M[pivot] = tmp;
    }
    const div = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= div;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      if (Math.abs(factor) < 1e-15) continue;
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }
  return M.map(row => row[n]);
}

function formatTimeMonomialExpTrig(coeff, powT, expRate, trigKind, trigW) {
  const sign = coeff < 0 ? -1 : 1;
  const ac = snapScalar(Math.abs(coeff));
  const hasFunc = powT > 0 || Math.abs(expRate) > EPS || Boolean(trigKind);
  const cTex = (!hasFunc || Math.abs(ac - 1) > EPS) ? formatNumberTex(ac) : '';
  const cPlain = (!hasFunc || Math.abs(ac - 1) > EPS) ? formatNumberPlain(ac) : '';

  const texParts = [];
  const plainParts = [];
  if (powT > 0) {
    texParts.push(powT === 1 ? 't' : 't^{' + powT + '}');
    plainParts.push(powT === 1 ? 't' : 't^' + powT);
  }
  if (Math.abs(expRate) > EPS) {
    const rTex = Math.abs(expRate - 1) < EPS ? 't' : (Math.abs(expRate + 1) < EPS ? '-t' : formatNumberTex(expRate) + 't');
    const rPlain = Math.abs(expRate - 1) < EPS ? 't' : (Math.abs(expRate + 1) < EPS ? '-t' : formatNumberPlain(expRate) + '*t');
    texParts.push('e^{' + rTex + '}');
    plainParts.push('exp(' + rPlain + ')');
  }
  if (trigKind) {
    const wTex = Math.abs(trigW - 1) < EPS ? 't' : formatNumberTex(trigW) + 't';
    const wPlain = Math.abs(trigW - 1) < EPS ? 't' : formatNumberPlain(trigW) + '*t';
    texParts.push('\\' + trigKind + '(' + wTex + ')');
    plainParts.push(trigKind + '(' + wPlain + ')');
  }

  const texBody = [cTex, ...texParts].filter(Boolean).join(' ');
  const wrapCPlain = cPlain.includes('/') && plainParts.length > 0 ? '(' + cPlain + ')' : cPlain;
  const plainBody = [wrapCPlain, ...plainParts].filter(Boolean).join('*');
  return { sign, texAbs: texBody || '0', plainAbs: plainBody || '0' };
}

function invertRationalPoly(rat) {
  const dTrim = trimPoly(rat.den);
  const degD = dTrim.length - 1;
  const leadD = dTrim[degD];
  if (Math.abs(leadD) < 1e-14) throw new Error('ตัวส่วนของ F(s) เป็นศูนย์');

  const monicDen = dTrim.map(v => v / leadD);
  const scaledNum = trimPoly(rat.num.map(v => v / leadD));

  const { quot, rem } = polyDivMod(scaledNum, monicDen);
  const timeItems = [];
  const steps = [];

  // 1. Polynomial quotient -> Dirac delta & derivatives
  if (!(quot.length === 1 && Math.abs(quot[0]) < 1e-11)) {
    for (let k = 0; k < quot.length; k++) {
      const qk = snapScalar(quot[k]);
      if (Math.abs(qk) < 1e-10) continue;
      const sign = qk < 0 ? -1 : 1;
      const aq = Math.abs(qk);
      const cTex = Math.abs(aq - 1) < EPS ? '' : formatNumberTex(aq) + ' ';
      const cPlain = Math.abs(aq - 1) < EPS ? '' : formatNumberPlain(aq) + '*';
      const dSymTex = k === 0 ? '\\delta(t)' : (k === 1 ? "\\delta'(t)" : (k === 2 ? "\\delta''(t)" : '\\delta^{(' + k + ')}(t)'));
      const dSymPlain = k === 0 ? 'delta(t)' : 'delta^(' + k + ')(t)';
      const sTermTex = k === 0 ? formatNumberTex(qk) : ((Math.abs(aq - 1) < EPS ? (sign < 0 ? '-' : '') : formatNumberTex(qk)) + (k === 1 ? 's' : 's^{' + k + '}'));
      timeItems.push({
        sign,
        texAbs: cTex + dSymTex,
        plainAbs: cPlain + dSymPlain,
        isDeltaOnly: k === 0
      });
      steps.push({
        ruleName: k === 0 ? 'พจน์ค่าคงที่ → อิมพัลส์ δ(t)' : 'เศษส่วนไม่แท้ (หารยาวพหุนาม) → อนุพันธ์ของ δ(t)',
        stepTex: '\\mathcal{L}^{-1}\\left\\{' + sTermTex + '\\right\\} = ' + (sign < 0 ? '-' : '') + cTex + dSymTex
      });
    }
  }

  if (rem.length === 1 && Math.abs(rem[0]) < 1e-11) {
    return { timeItems, steps };
  }

  if (degD > 12) return null;

  // 2. Factor monic denominator and build exact Partial Fraction linear system
  const { realFactors, quadFactors } = factorMonicPolynomial(monicDen);
  let rebuild = [1];
  for (const rf of realFactors) {
    rebuild = polyMul(rebuild, polyPow([-rf.r, 1], rf.m));
  }
  for (const qf of quadFactors) {
    if (qf.k > 3) return null;
    rebuild = polyMul(rebuild, polyPow([qf.alpha * qf.alpha + qf.w * qf.w, -2 * qf.alpha, 1], qf.k));
  }
  if (rebuild.length !== monicDen.length) return null;
  for (let i = 0; i < monicDen.length; i++) {
    if (Math.abs(rebuild[i] - monicDen[i]) > 1e-3 * Math.max(1, Math.abs(monicDen[i]))) {
      return null;
    }
  }

  const basis = [];
  for (const rf of realFactors) {
    for (let mu = 1; mu <= rf.m; mu++) {
      const denomFactor = polyPow([-rf.r, 1], mu);
      const colPoly = polyDivMod(rebuild, denomFactor).quot;
      basis.push({ kind: 'real', r: rf.r, mu, colPoly });
    }
  }
  for (const qf of quadFactors) {
    const quadBase = [qf.alpha * qf.alpha + qf.w * qf.w, -2 * qf.alpha, 1];
    for (let nu = 1; nu <= qf.k; nu++) {
      const denomFactor = polyPow(quadBase, nu);
      const qOverB = polyDivMod(rebuild, denomFactor).quot;
      basis.push({
        kind: 'quadCos',
        alpha: qf.alpha,
        w: qf.w,
        nu,
        colPoly: polyMul([-qf.alpha, 1], qOverB)
      });
      basis.push({
        kind: 'quadSin',
        alpha: qf.alpha,
        w: qf.w,
        nu,
        colPoly: polyScale(qOverB, qf.w)
      });
    }
  }

  const N = degD;
  if (basis.length !== N) return null;
  const mat = Array.from({ length: N }, () => new Array(N).fill(0));
  const rhs = new Array(N).fill(0);
  for (let row = 0; row < N; row++) {
    rhs[row] = rem[row] || 0;
    for (let col = 0; col < N; col++) {
      mat[row][col] = basis[col].colPoly[row] || 0;
    }
  }

  const weights = solveLinearSystem(mat, rhs);
  if (!weights) return null;

  for (let j = 0; j < N; j++) {
    const wVal = snapScalar(weights[j]);
    if (Math.abs(wVal) < 1e-8) continue;
    const bItem = basis[j];

    if (bItem.kind === 'real') {
      const timeCoeff = wVal / factorial(bItem.mu - 1);
      const fmt = formatTimeMonomialExpTrig(timeCoeff, bItem.mu - 1, bItem.r, null, 0);
      timeItems.push(fmt);

      const sv = formatShiftedVar(bItem.r, bItem.mu > 1 && Math.abs(bItem.r) > EPS);
      const denTex = bItem.mu === 1 ? sv.tex : sv.tex + '^{' + bItem.mu + '}';
      const pfeTex = (wVal < 0 ? '-' : '') + '\\frac{' + formatNumberTex(Math.abs(wVal)) + '}{' + denTex + '}';
      steps.push({
        ruleName: bItem.mu === 1 ? 'แยกเศษส่วนย่อย (ขั้วจริงเดี่ยว)' : 'แยกเศษส่วนย่อย (ขั้วจริงซ้ำอันดับ ' + bItem.mu + ')',
        stepTex: '\\mathcal{L}^{-1}\\left\\{' + pfeTex + '\\right\\} = ' + (fmt.sign < 0 ? '-' : '') + fmt.texAbs
      });
    } else if (bItem.kind === 'quadCos') {
      const sv = formatShiftedVar(bItem.alpha, Math.abs(bItem.alpha) > EPS);
      const svBare = formatShiftedVar(bItem.alpha, false);
      const baseDen = sv.tex + '^{2} + ' + formatNumberTex(bItem.w * bItem.w);
      const denTex = bItem.nu === 1 ? baseDen : '\\left(' + baseDen + '\\right)^{' + bItem.nu + '}';
      const numTex = (Math.abs(Math.abs(wVal) - 1) < EPS ? '' : formatNumberTex(Math.abs(wVal))) + (Math.abs(bItem.alpha) > EPS && Math.abs(Math.abs(wVal) - 1) > EPS ? '(' + svBare.tex + ')' : svBare.tex);
      const pfeTex = (wVal < 0 ? '-' : '') + '\\frac{' + numTex + '}{' + denTex + '}';

      if (bItem.nu === 1) {
        const fmt = formatTimeMonomialExpTrig(wVal, 0, bItem.alpha, 'cos', bItem.w);
        timeItems.push(fmt);
        steps.push({
          ruleName: 'แยกเศษส่วนย่อย (ขั้วเชิงซ้อนส่วนโคไซน์)',
          stepTex: '\\mathcal{L}^{-1}\\left\\{' + pfeTex + '\\right\\} = ' + (fmt.sign < 0 ? '-' : '') + fmt.texAbs
        });
      } else if (bItem.nu === 2) {
        const fmt = formatTimeMonomialExpTrig(wVal / (2 * bItem.w), 1, bItem.alpha, 'sin', bItem.w);
        timeItems.push(fmt);
        steps.push({
          ruleName: 'ขั้วเชิงซ้อนซ้ำอันดับ 2',
          stepTex: '\\mathcal{L}^{-1}\\left\\{' + pfeTex + '\\right\\} = ' + (fmt.sign < 0 ? '-' : '') + fmt.texAbs
        });
      } else if (bItem.nu === 3) {
        const f1 = formatTimeMonomialExpTrig(wVal / (8 * Math.pow(bItem.w, 3)), 1, bItem.alpha, 'sin', bItem.w);
        const f2 = formatTimeMonomialExpTrig(-wVal / (8 * bItem.w * bItem.w), 2, bItem.alpha, 'cos', bItem.w);
        timeItems.push(f1, f2);
        const joinedStep = joinTransformedTerms([f1, f2]);
        steps.push({
          ruleName: 'ขั้วเชิงซ้อนซ้ำอันดับ 3',
          stepTex: '\\mathcal{L}^{-1}\\left\\{' + pfeTex + '\\right\\} = ' + joinedStep.tex
        });
      }
    } else if (bItem.kind === 'quadSin') {
      const sv = formatShiftedVar(bItem.alpha, Math.abs(bItem.alpha) > EPS);
      const baseDen = sv.tex + '^{2} + ' + formatNumberTex(bItem.w * bItem.w);
      const denTex = bItem.nu === 1 ? baseDen : '\\left(' + baseDen + '\\right)^{' + bItem.nu + '}';
      const pfeTex = (wVal < 0 ? '-' : '') + '\\frac{' + formatNumberTex(Math.abs(wVal * bItem.w)) + '}{' + denTex + '}';

      if (bItem.nu === 1) {
        const fmt = formatTimeMonomialExpTrig(wVal, 0, bItem.alpha, 'sin', bItem.w);
        timeItems.push(fmt);
        steps.push({
          ruleName: 'แยกเศษส่วนย่อย (ขั้วเชิงซ้อนส่วนไซน์)',
          stepTex: '\\mathcal{L}^{-1}\\left\\{' + pfeTex + '\\right\\} = ' + (fmt.sign < 0 ? '-' : '') + fmt.texAbs
        });
      } else if (bItem.nu === 2) {
        const f1 = formatTimeMonomialExpTrig(wVal / (2 * bItem.w * bItem.w), 0, bItem.alpha, 'sin', bItem.w);
        const f2 = formatTimeMonomialExpTrig(-wVal / (2 * bItem.w), 1, bItem.alpha, 'cos', bItem.w);
        timeItems.push(f1, f2);
        const joinedStep = joinTransformedTerms([f1, f2]);
        steps.push({
          ruleName: 'ขั้วเชิงซ้อนซ้ำอันดับ 2',
          stepTex: '\\mathcal{L}^{-1}\\left\\{' + pfeTex + '\\right\\} = ' + joinedStep.tex
        });
      } else if (bItem.nu === 3) {
        const cBase = wVal / (8 * Math.pow(bItem.w, 4));
        const f1 = formatTimeMonomialExpTrig(3 * cBase, 0, bItem.alpha, 'sin', bItem.w);
        const f2 = formatTimeMonomialExpTrig(-cBase * bItem.w * bItem.w, 2, bItem.alpha, 'sin', bItem.w);
        const f3 = formatTimeMonomialExpTrig(-3 * cBase * bItem.w, 1, bItem.alpha, 'cos', bItem.w);
        timeItems.push(f1, f2, f3);
        const joinedStep = joinTransformedTerms([f1, f2, f3]);
        steps.push({
          ruleName: 'ขั้วเชิงซ้อนซ้ำอันดับ 3',
          stepTex: '\\mathcal{L}^{-1}\\left\\{' + pfeTex + '\\right\\} = ' + joinedStep.tex
        });
      }
    }
  }

  return { timeItems, steps };
}

// Safely replace variable t with (t - delay) without touching LaTeX commands or function names
function shiftTimeStringsByDelay(item, delay) {
  const dTex = formatNumberTex(delay);
  const dPlain = formatNumberPlain(delay);
  if (item.isDeltaOnly) {
    return {
      sign: item.sign,
      texAbs: item.texAbs.replace('\\delta(t)', '\\delta(t - ' + dTex + ')'),
      plainAbs: item.plainAbs.replace('delta(t)', 'delta(t - ' + dPlain + ')')
    };
  }
  const shiftedTex = item.texAbs
    .replace(/(^|[^\\a-zA-Z])t(?![a-zA-Z])/g, '$1(t - ' + dTex + ')')
    .replace(/\(\(t - ([^()]+)\)\)/g, '(t - $1)');
  const shiftedPlain = item.plainAbs
    .replace(/(^|[^a-zA-Z])t(?![a-zA-Z])/g, '$1(t - ' + dPlain + ')')
    .replace(/\(\(t - ([^()]+)\)\)/g, '(t - $1)');
  return {
    sign: item.sign,
    texAbs: (shiftedTex === '1' ? '' : shiftedTex + ' ') + 'u(t - ' + dTex + ')',
    plainAbs: (shiftedPlain === '1' ? '' : '(' + shiftedPlain + ')*') + 'u(t - ' + dPlain + ')'
  };
}

// Match special non-rational F(s) forms: 1/(s-a)^p, 1/sqrt(s^2 +- a^2), arctan(a/(s-alpha)), ln((s-b)/(s-a)), ln(1 + a^2/s^2), exp(-a*sqrt(s)), etc.
function trySpecialInverseTerm(core, coeff) {
  const sign = coeff < 0 ? -1 : 1;
  const ac = Math.abs(coeff);
  const cTex = Math.abs(ac - 1) < EPS ? '' : formatNumberTex(ac) + ' ';
  const cPlain = Math.abs(ac - 1) < EPS ? '' : formatNumberPlain(ac) + '*';

  // Helper for linear a*s + b in s-AST
  const linS = (nd) => tryLinearT(nd); // var is 's', tryLinearT works on node.type === 'var'

  // 1. Fractional power: coeff / (a*s + b)^p or coeff * (a*s + b)^(-p), p > 0
  let baseLin = null;
  let negPow = null;
  if (core.type === 'bin' && core.op === '^' && !dependsOnT(core.right)) {
    const v = evalAt(core.right, 0);
    if (v < -EPS) {
      baseLin = linS(core.left);
      negPow = -v;
    }
  } else if (core.type === 'bin' && core.op === '/' && !dependsOnT(core.left)) {
    const topVal = evalAt(core.left, 0);
    if (core.right.type === 'bin' && core.right.op === '^' && !dependsOnT(core.right.right)) {
      const pVal = evalAt(core.right.right, 0);
      if (pVal > EPS) {
        baseLin = linS(core.right.left);
        negPow = pVal;
        coeff *= topVal;
      }
    }
  }
  if (baseLin && negPow !== null && baseLin.a > EPS && negPow > EPS && Math.abs(negPow - Math.round(negPow)) > EPS) {
    // coeff / (a*(s - alpha))^p = (coeff / a^p) * t^(p - 1) * e^(alpha*t) / Gamma(p)
    const alpha = -baseLin.b / baseLin.a;
    const totalScale = coeff / Math.pow(baseLin.a, negPow);
    const fSign = totalScale < 0 ? -1 : 1;
    const aScale = Math.abs(totalScale);
    const expTex = Math.abs(alpha) < EPS ? '' : ' e^{' + (Math.abs(alpha - 1) < EPS ? 't' : (Math.abs(alpha + 1) < EPS ? '-t' : formatNumberTex(alpha) + 't')) + '}';
    const expPlain = Math.abs(alpha) < EPS ? '' : '*exp(' + formatNumberPlain(alpha) + '*t)';

    // Special clean half-integer formatting: p = 1/2 -> 1/sqrt(pi*t), p = 3/2 -> 2*sqrt(t/pi)
    if (Math.abs(negPow - 0.5) < EPS) {
      const numT = formatNumberTex(aScale);
      return {
        sign: fSign,
        texAbs: '\\frac{' + numT + '}{\\sqrt{\\pi t}}' + expTex,
        plainAbs: formatNumberPlain(aScale) + '/sqrt(pi*t)' + expPlain,
        ruleName: 'การแปลงผกผันกำลังเศษส่วน 1/√(s - a)'
      };
    }
    if (Math.abs(negPow - 1.5) < EPS) {
      const k2 = 2 * aScale;
      return {
        sign: fSign,
        texAbs: formatNumberTex(k2) + '\\sqrt{\\frac{t}{\\pi}}' + expTex,
        plainAbs: formatNumberPlain(k2) + '*sqrt(t/pi)' + expPlain,
        ruleName: 'การแปลงผกผันกำลังเศษส่วน 1/(s - a)^(3/2)'
      };
    }
    const cVal = aScale / gammaFunc(negPow);
    const pMinus1Tex = formatNumberTex(negPow - 1);
    const pMinus1Plain = formatNumberPlain(negPow - 1);
    return {
      sign: fSign,
      texAbs: formatNumberTex(cVal) + ' t^{' + pMinus1Tex + '}' + expTex,
      plainAbs: formatNumberPlain(cVal) + '*t^(' + pMinus1Plain + ')' + expPlain,
      ruleName: 'การแปลงผกผันทั่วไป t^(p-1) / Γ(p)'
    };
  }

  // 2. Bessel 1 / sqrt((s - alpha)^2 +- a^2)
  if (core.type === 'bin' && core.op === '/' && !dependsOnT(core.left)) {
    const topVal = evalAt(core.left, 0);
    const eff = coeff * topVal;
    const fSign = eff < 0 ? -1 : 1;
    const aEff = Math.abs(eff);
    const rDen = core.right;
    if (rDen.type === 'bin' && rDen.op === '^' && !dependsOnT(rDen.right) && Math.abs(evalAt(rDen.right, 0) - 0.5) < EPS) {
      const quadRat = astToRationalPoly(rDen.left);
      if (quadRat && quadRat.den.length === 1 && quadRat.num.length === 3 && quadRat.num[2] / quadRat.den[0] > EPS) {
        const lead = quadRat.num[2] / quadRat.den[0];
        const b1 = quadRat.num[1] / (quadRat.den[0] * lead);
        const c0 = quadRat.num[0] / (quadRat.den[0] * lead);
        // (s - alpha)^2 + remC where alpha = -b1/2, remC = c0 - alpha^2
        const alpha = snapScalar(-b1 / 2);
        const remC = snapScalar(c0 - alpha * alpha);
        const scale = aEff / Math.sqrt(lead);
        if (Math.abs(remC) > EPS) {
          const aParam = snapScalar(Math.sqrt(Math.abs(remC)));
          const fnSym = remC > 0 ? 'J_0' : 'I_0';
          const fnPlain = remC > 0 ? 'J0' : 'I0';
          const sTex = Math.abs(scale - 1) < EPS ? '' : formatNumberTex(scale) + ' ';
          const sPlain = Math.abs(scale - 1) < EPS ? '' : formatNumberPlain(scale) + '*';
          const eTex = Math.abs(alpha) < EPS ? '' : 'e^{' + formatNumberTex(alpha) + 't} ';
          const ePlain = Math.abs(alpha) < EPS ? '' : 'exp(' + formatNumberPlain(alpha) + '*t)*';
          const argT = Math.abs(aParam - 1) < EPS ? 't' : formatNumberTex(aParam) + 't';
          const argP = Math.abs(aParam - 1) < EPS ? 't' : formatNumberPlain(aParam) + '*t';
          return {
            sign: fSign,
            texAbs: sTex + eTex + fnSym + '(' + argT + ')',
            plainAbs: sPlain + ePlain + fnPlain + '(' + argP + ')',
            ruleName: remC > 0 ? 'การแปลงผกผันสู่ฟังก์ชันเบสเซล J₀(at)' : 'การแปลงผกผันสู่ฟังก์ชันเบสเซลดัดแปร I₀(at)'
          };
        }
      }
    }
    // 2b. 1 / (s * sqrt(s + a^2)) -> (1/a) * erf(a * sqrt(t))
    if (rDen.type === 'bin' && rDen.op === '*' && rDen.left.type === 'var' &&
        rDen.right.type === 'bin' && rDen.right.op === '^' && !dependsOnT(rDen.right.right) &&
        Math.abs(evalAt(rDen.right.right, 0) - 0.5) < EPS) {
      const insideLin = linS(rDen.right.left);
      if (insideLin && Math.abs(insideLin.a - 1) < EPS && insideLin.b > EPS) {
        const aParam = snapScalar(Math.sqrt(insideLin.b));
        const outScale = aEff / aParam;
        const sTex = Math.abs(outScale - 1) < EPS ? '' : formatNumberTex(outScale) + ' ';
        const sPlain = Math.abs(outScale - 1) < EPS ? '' : formatNumberPlain(outScale) + '*';
        const aT = Math.abs(aParam - 1) < EPS ? '' : formatNumberTex(aParam);
        const aP = Math.abs(aParam - 1) < EPS ? '' : formatNumberPlain(aParam) + '*';
        return {
          sign: fSign,
          texAbs: sTex + '\\operatorname{erf}\\left(' + aT + '\\sqrt{t}\\right)',
          plainAbs: sPlain + 'erf(' + aP + 'sqrt(t))',
          ruleName: 'การแปลงผกผันสู่ฟังก์ชันค่าคลาดเคลื่อน erf(a√t)'
        };
      }
    }
  }

  // 3. arctan(a / (s - alpha)) -> e^(alpha*t) * sin(a*t) / t
  if (core.type === 'call' && core.fn === 'atan') {
    if (core.arg.type === 'bin' && core.arg.op === '/' && !dependsOnT(core.arg.left)) {
      const topA = evalAt(core.arg.left, 0);
      const denLin = linS(core.arg.right);
      if (denLin && Math.abs(denLin.a) > EPS) {
        const w = topA / denLin.a;
        const alpha = -denLin.b / denLin.a;
        const sgnW = w < 0 ? -1 : 1;
        const aw = snapScalar(Math.abs(w));
        const eTex = Math.abs(alpha) < EPS ? '' : 'e^{' + formatNumberTex(alpha) + 't} ';
        const ePlain = Math.abs(alpha) < EPS ? '' : 'exp(' + formatNumberPlain(alpha) + '*t)*';
        const wT = Math.abs(aw - 1) < EPS ? 't' : formatNumberTex(aw) + 't';
        const wP = Math.abs(aw - 1) < EPS ? 't' : formatNumberPlain(aw) + '*t';
        return {
          sign: sign * sgnW,
          texAbs: cTex + '\\frac{' + eTex + '\\sin(' + wT + ')}{t}',
          plainAbs: cPlain + ePlain + 'sin(' + wP + ')/t',
          ruleName: 'การแปลงผกผันของ arctan(a/(s - α)) → e^(αt) sin(at)/t'
        };
      }
    }
  }

  // 4. arctan(a / s) / s -> Si(a*t)
  if (core.type === 'bin' && core.op === '/' && core.right.type === 'var' &&
      core.left.type === 'call' && core.left.fn === 'atan' &&
      core.left.arg.type === 'bin' && core.left.arg.op === '/' &&
      !dependsOnT(core.left.arg.left) && core.left.arg.right.type === 'var') {
    const w = evalAt(core.left.arg.left, 0);
    const sgnW = w < 0 ? -1 : 1;
    const aw = snapScalar(Math.abs(w));
    return {
      sign: sign * sgnW,
      texAbs: cTex + '\\operatorname{Si}(' + (Math.abs(aw - 1) < EPS ? 't' : formatNumberTex(aw) + 't') + ')',
      plainAbs: cPlain + 'Si(' + (Math.abs(aw - 1) < EPS ? 't' : formatNumberPlain(aw) + '*t') + ')',
      ruleName: 'การแปลงผกผันสู่ฟังก์ชันอินทิกรัลไซน์ Si(at)'
    };
  }

  // 5. Logarithmic F(s): ln((s - b)/(s - a)) and ln((s^2 + b^2)/(s^2 + a^2)) or ln(1 + a^2/s^2)
  if (core.type === 'call' && core.fn === 'ln') {
    const ratIn = astToRationalPoly(core.arg);
    if (ratIn) {
      const pN = trimPoly(ratIn.num);
      const pD = trimPoly(ratIn.den);
      // Linear / Linear: (s - b) / (s - a) -> (e^(a*t) - e^(b*t)) / t
      if (pN.length === 2 && pD.length === 2 && Math.abs(pN[1] - pD[1]) < EPS) {
        const bVal = snapScalar(-pN[0] / pN[1]);
        const aVal = snapScalar(-pD[0] / pD[1]);
        const eaTex = Math.abs(aVal) < EPS ? '1' : 'e^{' + (Math.abs(aVal - 1) < EPS ? 't' : (Math.abs(aVal + 1) < EPS ? '-t' : formatNumberTex(aVal) + 't')) + '}';
        const ebTex = Math.abs(bVal) < EPS ? '1' : 'e^{' + (Math.abs(bVal - 1) < EPS ? 't' : (Math.abs(bVal + 1) < EPS ? '-t' : formatNumberTex(bVal) + 't')) + '}';
        const eaPl = Math.abs(aVal) < EPS ? '1' : 'exp(' + formatNumberPlain(aVal) + '*t)';
        const ebPl = Math.abs(bVal) < EPS ? '1' : 'exp(' + formatNumberPlain(bVal) + '*t)';
        return {
          sign,
          texAbs: cTex + '\\frac{' + eaTex + ' - ' + ebTex + '}{t}',
          plainAbs: cPlain + '(' + eaPl + ' - ' + ebPl + ')/t',
          ruleName: 'การแปลงผกผันของ ln((s - b)/(s - a))'
        };
      }
      // Quadratic / Quadratic: (s^2 + w1^2) / (s^2 + w0^2) -> 2*(cos(w0*t) - cos(w1*t)) / t
      if (pN.length === 3 && pD.length === 3 && Math.abs(pN[1]) < EPS && Math.abs(pD[1]) < EPS &&
          Math.abs(pN[2] - pD[2]) < EPS && pN[0] / pN[2] >= -EPS && pD[0] / pD[2] >= -EPS) {
        const w1 = snapScalar(Math.sqrt(Math.max(0, pN[0] / pN[2])));
        const w0 = snapScalar(Math.sqrt(Math.max(0, pD[0] / pD[2])));
        const k2 = 2 * ac;
        const kTex = Math.abs(k2 - 1) < EPS ? '' : formatNumberTex(k2);
        const kPl = Math.abs(k2 - 1) < EPS ? '' : formatNumberPlain(k2) + '*';
        const c0Tex = Math.abs(w0) < EPS ? '1' : '\\cos(' + (Math.abs(w0 - 1) < EPS ? 't' : formatNumberTex(w0) + 't') + ')';
        const c1Tex = Math.abs(w1) < EPS ? '1' : '\\cos(' + (Math.abs(w1 - 1) < EPS ? 't' : formatNumberTex(w1) + 't') + ')';
        const c0Pl = Math.abs(w0) < EPS ? '1' : 'cos(' + formatNumberPlain(w0) + '*t)';
        const c1Pl = Math.abs(w1) < EPS ? '1' : 'cos(' + formatNumberPlain(w1) + '*t)';
        return {
          sign,
          texAbs: '\\frac{' + kTex + '(' + c0Tex + ' - ' + c1Tex + ')}{t}',
          plainAbs: kPl + '(' + c0Pl + ' - ' + c1Pl + ')/t',
          ruleName: 'การแปลงผกผันของ ln((s² + b²)/(s² + a²))'
        };
      }
    }
  }

  // 6. exp(-a*sqrt(s)) and exp(-a*sqrt(s))/s
  if (core.type === 'call' && core.fn === 'exp') {
    const sq = tryCoeffSqrtT(core.arg);
    if (sq !== null && sq < -EPS) {
      const a = -sq;
      return {
        sign,
        texAbs: '\\frac{' + formatNumberTex(ac * a) + '}{2\\sqrt{\\pi}\\,t^{3/2}} e^{-\\frac{' + formatNumberTex(a * a) + '}{4t}}',
        plainAbs: formatNumberPlain(ac * a) + '/(2*sqrt(pi)*t^(3/2))*exp(-' + formatNumberPlain(a * a) + '/(4*t))',
        ruleName: 'การแปลงผกผันของ e^(-a√s)'
      };
    }
  }
  if (core.type === 'bin' && core.op === '/' && core.right.type === 'var' &&
      core.left.type === 'call' && core.left.fn === 'exp') {
    const sq = tryCoeffSqrtT(core.left.arg);
    if (sq !== null && sq < -EPS) {
      const a = -sq;
      return {
        sign,
        texAbs: cTex + '\\operatorname{erfc}\\left(\\frac{' + formatNumberTex(a) + '}{2\\sqrt{t}}\\right)',
        plainAbs: cPlain + 'erfc(' + formatNumberPlain(a) + '/(2*sqrt(t)))',
        ruleName: 'การแปลงผกผันของ e^(-a√s)/s → erfc(a/(2√t))'
      };
    }
  }

  return null;
}

// Complex evaluation of s-AST for Fixed Talbot Numerical Bromwich Inversion
function cAdd(a, b) { return { re: a.re + b.re, im: a.im + b.im }; }
function cSub(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
function cMul(a, b) { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }
function cDiv(a, b) {
  const d = b.re * b.re + b.im * b.im;
  if (d < 1e-30) return { re: NaN, im: NaN };
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
function cExp(z) {
  const ea = Math.exp(z.re);
  return { re: ea * Math.cos(z.im), im: ea * Math.sin(z.im) };
}
function cLog(z) {
  return { re: 0.5 * Math.log(z.re * z.re + z.im * z.im), im: Math.atan2(z.im, z.re) };
}
function cPow(base, exp) {
  if (Math.abs(base.re) < 1e-30 && Math.abs(base.im) < 1e-30) {
    return exp.re > 0 ? { re: 0, im: 0 } : { re: NaN, im: NaN };
  }
  return cExp(cMul(exp, cLog(base)));
}
function cSin(z) {
  return { re: Math.sin(z.re) * Math.cosh(z.im), im: Math.cos(z.re) * Math.sinh(z.im) };
}
function cCos(z) {
  return { re: Math.cos(z.re) * Math.cosh(z.im), im: -Math.sin(z.re) * Math.sinh(z.im) };
}
function cSinh(z) {
  return { re: Math.sinh(z.re) * Math.cos(z.im), im: Math.cosh(z.re) * Math.sin(z.im) };
}
function cCosh(z) {
  return { re: Math.cosh(z.re) * Math.cos(z.im), im: Math.sinh(z.re) * Math.sin(z.im) };
}

function evalComplexAst(node, z) {
  if (node.type === 'num' || node.type === 'const') return { re: node.value, im: 0 };
  if (node.type === 'var') return z;
  if (node.type === 'neg') {
    const a = evalComplexAst(node.arg, z);
    return { re: -a.re, im: -a.im };
  }
  if (node.type === 'bin') {
    const l = evalComplexAst(node.left, z);
    const r = evalComplexAst(node.right, z);
    if (node.op === '+') return cAdd(l, r);
    if (node.op === '-') return cSub(l, r);
    if (node.op === '*') return cMul(l, r);
    if (node.op === '/') return cDiv(l, r);
    if (node.op === '^') return cPow(l, r);
  }
  if (node.type === 'call') {
    const a = evalComplexAst(node.arg, z);
    const iz = { re: -a.im, im: a.re };
    switch (node.fn) {
      case 'exp': return cExp(a);
      case 'ln': return cLog(a);
      case 'log': { const lg = cLog(a); return { re: lg.re / Math.LN10, im: lg.im / Math.LN10 }; }
      case 'sin': return cSin(a);
      case 'cos': return cCos(a);
      case 'tan': return cDiv(cSin(a), cCos(a));
      case 'cot': return cDiv(cCos(a), cSin(a));
      case 'sinh': return cSinh(a);
      case 'cosh': return cCosh(a);
      case 'tanh': return cDiv(cSinh(a), cCosh(a));
      case 'atan': {
        // 1/(2i) * ln((1 + i*a)/(1 - i*a))
        const lg = cLog(cDiv({ re: 1 + iz.re, im: iz.im }, { re: 1 - iz.re, im: -iz.im }));
        return { re: 0.5 * lg.im, im: -0.5 * lg.re };
      }
      case 'sinc': return cDiv(cSin(a), a);
    }
  }
  return { re: NaN, im: NaN };
}

// Fixed Talbot Contour Quadrature (Abate & Valko, M = 16)
function talbotNumericInverse(ast, tVal) {
  if (!Number.isFinite(tVal) || tVal <= 0) {
    return { ok: false, reason: 'กรุณาระบุเวลา t > 0' };
  }
  const M = 16;
  const r = (2 * M) / (5 * tVal);
  const fAtR = evalComplexAst(ast, { re: r, im: 0 });
  if (!Number.isFinite(fAtR.re) || !Number.isFinite(fAtR.im)) {
    return { ok: false, reason: 'ไม่สามารถประเมินค่า F(s) บนเส้นทางเชิงซ้อนได้' };
  }
  let sum = 0.5 * Math.exp(r * tVal) * fAtR.re;
  for (let k = 1; k < M; k++) {
    const theta = (k * Math.PI) / M;
    const cot = 1 / Math.tan(theta);
    const sTheta = { re: r * theta * cot, im: r * theta };
    const sigma = theta + (theta * cot - 1) * cot;
    const fz = evalComplexAst(ast, sTheta);
    if (!Number.isFinite(fz.re) || !Number.isFinite(fz.im)) {
      return { ok: false, reason: 'F(s) มีจุดเอกฐานบนเส้นทางอินทิเกรตที่ t = ' + tVal };
    }
    const ets = cExp({ re: tVal * sTheta.re, im: tVal * sTheta.im });
    const prod = cMul(cMul(ets, fz), { re: 1, im: sigma });
    sum += prod.re;
  }
  const val = (r / M) * sum;
  if (!Number.isFinite(val)) return { ok: false, reason: 'ผลการอินทิเกรตลู่ออก' };
  return { ok: true, value: Math.abs(val) < 1e-11 ? 0 : val };
}

function computeInverseLaplace(rawInput) {
  const rawAst = parseExpression(rawInput, 's');
  const fsTex = astToTex(rawAst, 0, 's');

  // Try whole-expression rational inversion first (handles sums of fractions or single rational)
  const wholeRat = astToRationalPoly(rawAst);
  if (wholeRat) {
    const invWhole = invertRationalPoly(wholeRat);
    if (invWhole) {
      if (invWhole.timeItems.length === 0) {
        return {
          isNumericFallback: false,
          ast: rawAst,
          parsedTex: 'F(s) = 0',
          resultTex: 'f(t) = 0',
          plainOut: '0',
          badgeText: 'โดเมน: t ≥ 0',
          steps: [{ ruleName: 'ฟังก์ชันศูนย์', stepTex: '\\mathcal{L}^{-1}\\{0\\} = 0' }]
        };
      }
      const joined = joinTransformedTerms(invWhole.timeItems);
      return {
        isNumericFallback: false,
        ast: rawAst,
        parsedTex: 'F(s) = ' + fsTex,
        resultTex: 'f(t) = ' + joined.tex,
        plainOut: joined.plain,
        badgeText: 'โดเมน: t ≥ 0 (Unilateral)',
        steps: invWhole.steps
      };
    }
  }

  // Additive term-by-term symbolic inversion (handles e^(-a*s)*G(s), radicals, ln, arctan, etc.)
  const additiveNodes = flattenAdditiveAst(rawAst);
  const allTimeItems = [];
  const allSteps = [];
  let allSymbolic = true;
  let causalError = null;

  for (const subNode of additiveNodes) {
    // Peel constant C and exp(shift * s) where shift = -delay
    const peeled = peelConstAndExpShift(subNode);
    if (Math.abs(peeled.coeff) < 1e-14) continue;

    if (peeled.shift > EPS) {
      causalError = new Error('พบพจน์ e^(+' + formatNumberPlain(peeled.shift) + 's) ซึ่งเป็นการเลื่อนเวลาล่วงหน้า (t + a) อยู่นอกนิยามการแปลงลาปลาซข้างเดียว (ต้องใช้ e^(-as) เมื่อ a > 0)');
      break;
    }
    const delay = Math.abs(peeled.shift) > EPS ? -peeled.shift : 0;
    const coreScaledAst = { type: 'bin', op: '*', left: { type: 'num', value: peeled.coeff }, right: peeled.core };

    // 1) Try rational inversion on coreScaledAst
    let subItems = null;
    let subSteps = null;
    const subRat = astToRationalPoly(coreScaledAst);
    if (subRat) {
      const invSub = invertRationalPoly(subRat);
      if (invSub) {
        subItems = invSub.timeItems;
        subSteps = invSub.steps;
      }
    }

    // 2) Try special non-rational inverse rules on peeled.core
    if (!subItems) {
      const spec = trySpecialInverseTerm(peeled.core, peeled.coeff);
      if (spec) {
        subItems = [{ sign: spec.sign, texAbs: spec.texAbs, plainAbs: spec.plainAbs }];
        const fsSubTex = astToTex(coreScaledAst, 0, 's');
        subSteps = [{
          ruleName: spec.ruleName,
          stepTex: '\\mathcal{L}^{-1}\\left\\{' + fsSubTex + '\\right\\} = ' + (spec.sign < 0 ? '-' : '') + spec.texAbs
        }];
      }
    }

    if (!subItems) {
      allSymbolic = false;
      break;
    }

    if (delay > EPS) {
      const shiftedItems = subItems.map(it => shiftTimeStringsByDelay(it, delay));
      allTimeItems.push(...shiftedItems);
      const joinedShifted = joinTransformedTerms(shiftedItems);
      allSteps.push({
        ruleName: 'ทฤษฎีบทการเลื่อนเวลา e^(-as)F(s) → f(t - a)u(t - a)',
        stepTex: '\\mathcal{L}^{-1}\\left\\{' + astToTex(subNode, 0, 's') + '\\right\\} = ' + joinedShifted.tex
      });
    } else {
      allTimeItems.push(...subItems);
      allSteps.push(...subSteps);
    }
  }

  if (causalError) throw causalError;

  if (allSymbolic) {
    const joined = joinTransformedTerms(allTimeItems);
    return {
      isNumericFallback: false,
      ast: rawAst,
      parsedTex: 'F(s) = ' + fsTex,
      resultTex: 'f(t) = ' + joined.tex,
      plainOut: joined.plain,
      badgeText: 'โดเมน: t ≥ 0 (Unilateral)',
      steps: allSteps.length ? allSteps : [{ ruleName: 'ฟังก์ชันศูนย์', stepTex: '\\mathcal{L}^{-1}\\{0\\} = 0' }]
    };
  }

  // 3) Universal Numerical Bromwich / Talbot Contour Inversion for arbitrary F(s)
  const testT1 = talbotNumericInverse(rawAst, 1);
  const testT05 = talbotNumericInverse(rawAst, 0.5);
  if (!testT1.ok && !testT05.ok) {
    throw new Error(testT1.reason || 'ไม่สามารถคำนวณการแปลงลาปลาซผกผันของฟังก์ชัน F(s) นี้ได้');
  }

  const cleanRawPlain = rawInput.replace(/^\s*(?:[fygFHYG]\s*\(\s*s\s*\)|[fygFHYG])\s*=\s*/, '').trim();
  return {
    isNumericFallback: true,
    ast: rawAst,
    parsedTex: 'F(s) = ' + fsTex,
    resultTex: 'f(t) = \\frac{1}{2\\pi j}\\int_{\\gamma - j\\infty}^{\\gamma + j\\infty} e^{st}\\left(' + fsTex + '\\right) ds',
    plainOut: 'inv_laplace(' + cleanRawPlain + ', s, t)',
    badgeText: 'อินทิกรัลบรอมวิชเชิงตัวเลข (Talbot)',
    steps: [
      {
        ruleName: 'อินทิกรัลผกผันของบรอมวิช (Bromwich Contour Integral)',
        stepTex: '\\mathcal{L}^{-1}\\left\\{' + fsTex + '\\right\\} = \\frac{1}{2\\pi j}\\int_{\\gamma - j\\infty}^{\\gamma + j\\infty} e^{st} F(s)\\,ds'
      },
      {
        ruleName: 'การประมาณค่าเชิงตัวเลขด้วยวิธี Fixed Talbot Quadrature',
        stepTex: 'f(t) \\approx \\frac{r}{M}\\left[\\frac{1}{2}e^{rt}F(r) + \\sum_{k=1}^{M-1}\\operatorname{Re}\\left\\{e^{ts(\\theta_k)}F(s(\\theta_k))(1 + j\\sigma(\\theta_k))\\right\\}\\right]'
      }
    ]
  };
}


export { evalAt, computeLaplace, computeInverseLaplace, numericLaplaceIntegral, talbotNumericInverse, formatComplexVal, parseExpression };

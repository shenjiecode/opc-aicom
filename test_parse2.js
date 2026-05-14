const cleaned = `{"msg": "你好\n世界", "options": ["A\nB", "C"]}`;
let inString = false;
let sanitized = '';
for (let i = 0; i < cleaned.length; i++) {
  const c = cleaned[i];
  if (c === '"' && (i === 0 || cleaned[i - 1] !== '\\')) {
    inString = !inString;
  }
  if (c === '\n') {
    sanitized += inString ? '\\n' : '';
  } else if (c === '\r') {
    sanitized += inString ? '\\r' : '';
  } else if (c === '\t') {
    sanitized += inString ? '\\t' : '';
  } else {
    sanitized += c;
  }
}
console.log("sanitized:", sanitized);
console.log("parsed:", JSON.parse(sanitized));

// Builds a seamless 480×480 tile of CivicEvents+ logo fragments.
// usage (from frontend/): npm run build:pattern
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const svg = fs.readFileSync(path.join(dir, 'logo.svg'), 'utf8');
const [BLUE, YELLOW] = [...svg.matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
const T = 480, SW = 13; // tile size, stroke weight (matches logo's line weight at this scale)
const pt = (r, deg) => [+(r * Math.cos(deg * Math.PI / 180)).toFixed(2), +(r * Math.sin(deg * Math.PI / 180)).toFixed(2)];
const arc = (r, a0, a1) => { const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1); const large = ((a1 - a0 + 360) % 360) > 180 ? 1 : 0; return `M${x0},${y0}A${r},${r} 0 ${large} 1 ${x1},${y1}`; };
const S = (d, c) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${SW}"/>`;
const shapes = {
  mark: (p, a) => `<g transform="scale(0.42) translate(-128,-66)"><path fill="${p}" d="${BLUE}"/><path fill="${a}" d="${YELLOW}"/></g>`,
  swoosh: (p, a) => `<path fill="${a}" transform="translate(-197,-112)" d="${YELLOW}"/>`,
  c: (p) => S(arc(32, 45, 315), p),
  e: (p) => S(arc(28, 40, 360) + `M-28,0H28`, p),
  half: (p) => S(arc(30, 0, 180), p),
  quarter: (p) => S(arc(30, 180, 270), p),
  dot: (p) => `<circle r="9" fill="${p}"/>`,
  dotA: (p, a) => `<circle r="9" fill="${a}"/>`,
  dash: (p) => `<rect x="-20" y="-6.5" width="40" height="13" fill="${p}"/>`,
};
// [type, x, y, rotation]  — hand-placed on a jittered 4×4 grid, plus filler dots/dashes
const pieces = [
  ['mark', 84, 62, -14], ['dot', 196, 22, 0], ['c', 270, 78, 25], ['swoosh', 388, 60, 168],
  ['swoosh', 40, 182, 18], ['e', 172, 168, -22], ['dash', 238, 206, 62], ['half', 330, 180, -30], ['dotA', 418, 150, 0],
  ['dash', 30, 276, -8], ['c', 108, 296, 200], ['mark', 270, 300, 12], ['dot', 376, 246, 0], ['e', 430, 318, 160],
  ['half', 52, 396, 150], ['dotA', 160, 380, 0], ['swoosh', 222, 418, -24], ['dash', 322, 388, -40], ['c', 384, 448, 110],
  ['dot', 470, 400, 0],
];
function tile(p, a) {
  let body = '';
  for (const [t, x, y, r] of pieces)
    for (const dx of [-T, 0, T]) for (const dy of [-T, 0, T])
      if (x + dx > -110 && x + dx < T + 110 && y + dy > -110 && y + dy < T + 110)
        body += `<g transform="translate(${x + dx} ${y + dy}) rotate(${r}) scale(1.35)">${shapes[t](p, a)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}" viewBox="0 0 ${T} ${T}">${body}</svg>\n`;
}
fs.writeFileSync(path.join(dir, 'logo-pattern.svg'), tile('#2187E7', '#F4D531'));
console.log('ok');

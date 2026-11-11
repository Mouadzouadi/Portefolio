// Sert la copie du site (mirror.py) comme le serveur en ligne : compression gzip et Cache-Control repris de
// _headers.json (en-tetes releves sur le vrai site). Pour Lighthouse et le rendu JS sur un poste qui joint mal le site.
//   node tools/seo-audit/serve.js <dossier de la copie> [port]
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.resolve(process.argv[2]), port = Number(process.argv[3] || 5600);
const headers = JSON.parse(fs.readFileSync(path.join(root, '_headers.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let p = decodeURIComponent(u.pathname);
  let file = path.join(root, p); if (p.endsWith('/')) file = path.join(file, 'index.html');
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const nf = path.join(root, '404.html'); res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'introuvable');
  }
  const live = headers[p + u.search] || headers[p] || {};
  const h = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' };
  if (live.cache) h['Cache-Control'] = live.cache;
  let body = fs.readFileSync(file);
  if (live.encoding === 'gzip' && /gzip/.test(req.headers['accept-encoding'] || '')) { body = zlib.gzipSync(body); h['Content-Encoding'] = 'gzip'; }
  res.writeHead(200, h); res.end(body);
}).listen(port, '127.0.0.1', () => console.log('copie servie sur http://127.0.0.1:' + port));

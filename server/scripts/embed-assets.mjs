// Genera src/assets.gen.js con la web compilada embebida en el Worker (mapa ruta -> contenido).
import fs from 'node:fs';
import path from 'node:path';

const [srcDir, base = '/app'] = process.argv.slice(2);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp' };
const BINARY = new Set(['.png', '.ico', '.webp']);

const files = {};
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) { walk(full); continue; }
    const ext = path.extname(name);
    if (!TYPES[ext]) throw new Error(`Tipo de archivo no soportado para embeber: ${full}`);
    const rel = '/' + path.relative(srcDir, full).split(path.sep).join('/');
    files[base + rel] = BINARY.has(ext)
      ? { type: TYPES[ext], b64: fs.readFileSync(full).toString('base64') }
      : { type: TYPES[ext], body: fs.readFileSync(full, 'utf8') };
  }
})(srcDir);

const out = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'assets.gen.js');
fs.writeFileSync(out, `// Generado por scripts/embed-assets.mjs. No editar.\nexport default ${JSON.stringify(files)};\n`);
console.log(`Embebidos ${Object.keys(files).length} archivos en ${path.relative(process.cwd(), out)}`);

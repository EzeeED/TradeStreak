// Cloudflare Worker: API (Hono + D1) y frontend embebido, publicado en delorrio.com/app.
import { createApp } from './app.js';
import { makeConfig } from './config.js';
import { d1Adapter } from './db/d1.js';
import assets from './assets.gen.js';

let app;

function serveAsset(file, request, immutable) {
  const headers = {
    'content-type': file.type,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  };
  return new Response(request.method === 'HEAD' ? null : file.body, { headers });
}

export default {
  async fetch(request, env, ctx) {
    const base = (env.BASE_PATH || '').replace(/\/+$/, '');
    const url = new URL(request.url);

    if (url.pathname.startsWith(`${base}/api/`) || url.pathname === `${base}/api`) {
      app ??= createApp({ basePath: base, resolve: (c) => ({ db: d1Adapter(c.env.DB), config: makeConfig(c.env) }) });
      return app.fetch(request, env, ctx);
    }

    // Fuera de la subruta (p. ej. app.delorrio.com/) o en su raíz: al dashboard.
    if (base && !url.pathname.startsWith(`${base}/`) && url.pathname !== base) {
      return Response.redirect(`${url.origin}${base}/dashboard`, 302);
    }
    if (url.pathname === base || url.pathname === `${base}/`) {
      return Response.redirect(`${url.origin}${base}/dashboard`, 302);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Método no permitido', { status: 405, headers: { allow: 'GET, HEAD' } });
    }

    // Archivos de la web (los de /assets/ llevan hash en el nombre: caché permanente).
    const file = assets[url.pathname];
    if (file) return serveAsset(file, request, url.pathname.startsWith(`${base}/assets/`));
    if (url.pathname.startsWith(`${base}/assets/`)) return new Response('No encontrado', { status: 404 });

    // Cualquier otra ruta la resuelve la SPA.
    return serveAsset(assets[`${base}/index.html`], request, false);
  },
};

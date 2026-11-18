// Cloudflare Worker: publica TradeStreak en delorrio.com/app/* reenviando las peticiones
// al servidor Node donde corre la app (BACKEND_ORIGIN), sin tocar el resto del dominio.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/app')) return fetch(request); // por si la ruta es más amplia

    const backend = new URL(env.BACKEND_ORIGIN);
    url.protocol = backend.protocol;
    url.host = backend.host;

    const headers = new Headers(request.headers);
    headers.set('x-forwarded-host', new URL(request.url).host);
    headers.set('x-forwarded-proto', 'https');

    const res = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });

    // Reescribe redirecciones del backend para que apunten al dominio público.
    const location = res.headers.get('location');
    if (location) {
      const out = new Response(res.body, res);
      out.headers.set('location', location.replace(backend.origin, new URL(request.url).origin));
      return out;
    }
    return res;
  },
};

import { NextRequest } from 'next/server';
import { Agent } from 'undici';

// Use Node runtime — Edge cannot stream arbitrary binary upstream bodies safely
// and we need full Headers + cookie / location rewriting.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Long SSE chat completions and large file downloads need headroom (Vercel).
export const maxDuration = 300;

const SPACE_AGENT_URL = process.env.SPACE_AGENT_URL || 'http://localhost:3009';
const PREFIX = '/space';

// Dedicated dispatcher — undici default of 5 connections/origin serializes at
// burst. 256 supports thousands of concurrent users on a long-running Node
// server. On Vercel serverless this matters less per-invocation.
const upstreamAgent = new Agent({
  connections: 256,
  pipelining: 1,
  keepAliveTimeout: 30_000,
});

// Headers stripped before forwarding upstream — RFC 7230 hop-by-hop list plus
// host (we set it explicitly to upstream.host).
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'strict-transport-security', // never propagate HSTS from upstream to browser
  'alt-svc',                   // never propagate HTTP/2 upgrade hints
]);

async function proxy(req: NextRequest, ctx: { params: { path?: string[] } }) {
  const subpath = '/' + (ctx.params.path?.join('/') ?? '');

  // Path traversal defense (defense in depth — URL parser already normalizes
  // but explicit reject avoids any future surprise).
  if (subpath.includes('..') || subpath.includes('\\') || subpath.includes('\0')) {
    return new Response('Bad path', { status: 400 });
  }

  const search = req.nextUrl.search;
  const upstream = new URL(SPACE_AGENT_URL);
  upstream.pathname = subpath === '/' ? '/' : subpath;
  upstream.search = search;

  // Build forward headers
  const fwdHeaders = new Headers();
  req.headers.forEach((v, k) => {
    if (!HOP_BY_HOP.has(k.toLowerCase())) fwdHeaders.set(k, v);
  });
  // Make upstream see its own host so URL generation stays correct
  fwdHeaders.set('host', upstream.host);

  // X-Forwarded-* — REPLACE, don't concatenate (attacker can spoof IPs).
  fwdHeaders.delete('x-forwarded-for');
  fwdHeaders.delete('x-forwarded-host');
  fwdHeaders.delete('x-forwarded-proto');
  fwdHeaders.delete('forwarded');
  fwdHeaders.set('x-forwarded-for', (req.ip ?? '').slice(0, 64));
  fwdHeaders.set('x-forwarded-host', (req.headers.get('host') ?? '').slice(0, 128));
  fwdHeaders.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', ''));

  // Make upstream see its own origin (defense against future CORS additions).
  fwdHeaders.set('origin', SPACE_AGENT_URL);
  const ref = req.headers.get('referer');
  if (ref) fwdHeaders.set('referer', ref.replace(req.nextUrl.origin, SPACE_AGENT_URL));

  // Always identity-encode upstream so we can mutate HTML safely and so SSE
  // doesn't get held by an edge gzip buffer.
  fwdHeaders.set('accept-encoding', 'identity');

  // Body: stream for non-GET/HEAD. Next.js gives us a Web ReadableStream.
  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream.toString(), {
      method,
      headers: fwdHeaders,
      body: hasBody ? req.body : undefined,
      // @ts-ignore duplex required for streaming uploads in undici
      duplex: hasBody ? 'half' : undefined,
      redirect: 'manual',
      cache: 'no-store',
      // @ts-ignore -- undici Agent typing not part of standard fetch RequestInit
      dispatcher: upstreamAgent,
    });
  } catch (err) {
    return new Response(`Space Agent unreachable: ${(err as Error).message}`, {
      status: 502,
    });
  }

  // Build response headers, rewriting Set-Cookie and Location.
  const respHeaders = new Headers();
  upstreamRes.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (HOP_BY_HOP.has(lk)) return;
    if (lk === 'set-cookie') return; // handled below
    if (lk === 'content-length') return; // body length may change after rewrite
    if (lk === 'location') {
      respHeaders.set(k, rewriteLocation(v));
      return;
    }
    respHeaders.set(k, v);
  });

  // Set-Cookie handling — Web Headers exposes getSetCookie() in Node 18.14+.
  const isHttps = req.nextUrl.protocol === 'https:';
  const setCookies =
    typeof (upstreamRes.headers as any).getSetCookie === 'function'
      ? (upstreamRes.headers as any).getSetCookie()
      : upstreamRes.headers.get('set-cookie')
        ? [upstreamRes.headers.get('set-cookie') as string]
        : [];
  for (const c of setCookies) respHeaders.append('set-cookie', rewriteCookie(c, isHttps));

  const ct = upstreamRes.headers.get('content-type') ?? '';
  const isHtml = ct.includes('text/html');

  // Hard cap on HTML buffering — protects against thundering-herd OOM. If a
  // response claims > 1 MB HTML we stream it raw (bypasses rewrite, so static
  // asset URLs won't get the /space prefix; acceptable failure mode vs OOM).
  const cl = Number(upstreamRes.headers.get('content-length') ?? '0');
  if (isHtml && cl > 1_000_000) {
    console.warn('[space-proxy] HTML > 1MB, streaming raw without rewrite');
    return new Response(upstreamRes.body, { status: upstreamRes.status, headers: respHeaders });
  }

  // SSE flush hints — without these, Vercel/nginx/Render edge may buffer the
  // stream until completion, breaking agent chat.
  if (ct.includes('text/event-stream')) {
    respHeaders.set('cache-control', 'no-cache, no-transform');
    respHeaders.set('x-accel-buffering', 'no');
    respHeaders.set('content-encoding', 'identity');
  }

  // Cache static assets — Space Agent doesn't emit Cache-Control; browsers
  // fall back to heuristic caching causing repeat re-downloads.
  if (/^\/(mod|pages|L0|L1|L2)\//.test(subpath) && upstreamRes.status === 200 && !isHtml) {
    respHeaders.set('cache-control', 'public, max-age=300, must-revalidate');
    respHeaders.set('vary', 'cookie');
  }

  // CSP override — Space Agent uses dynamic imports + inline scripts + web
  // components. The injected runtime monkey-patch is itself an inline script.
  if (isHtml) {
    respHeaders.delete('content-security-policy');
    respHeaders.delete('content-security-policy-report-only');
    // Permissive CSP — Space Agent uses dynamic imports, inline scripts,
    // blob URLs, and connects to same-origin /space/api endpoints. The
    // earlier policy `connect-src 'self' https:` excluded http://localhost
    // explicitly enough to break dev. Now allow all http/https.
    respHeaders.set(
      'content-security-policy',
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; " +
        "img-src 'self' data: blob: http: https:; " +
        "connect-src 'self' http: https: blob: data:; " +
        "frame-ancestors 'self'",
    );
  }

  // HTML rewriting — buffer + rewrite + return. Already gated on the 1 MB cap
  // above. Always set no-store on HTML so browsers re-fetch the rewriter
  // output rather than caching the raw upstream version.
  if (isHtml) {
    const text = await upstreamRes.text();
    const rewritten = rewriteHtml(text);
    respHeaders.set('cache-control', 'no-store');
    return new Response(rewritten, {
      status: upstreamRes.status,
      headers: respHeaders,
    });
  }

  // Pass-through stream for everything else (binaries, JSON, JS, CSS, fonts,
  // SSE).
  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: respHeaders,
  });
}

function rewriteLocation(loc: string): string {
  // Absolute-path → prefix it (unless already prefixed).
  if (loc.startsWith('/') && !loc.startsWith('//') && !loc.startsWith(PREFIX)) {
    return PREFIX + loc;
  }
  // Absolute URL pointing back to Space Agent's host → strip + prefix.
  try {
    const u = new URL(loc);
    if (u.host === new URL(SPACE_AGENT_URL).host) {
      return PREFIX + u.pathname + u.search + u.hash;
    }
  } catch {
    /* relative or malformed — leave alone */
  }
  return loc;
}

function rewriteCookie(c: string, isHttps: boolean): string {
  if (!isHttps) {
    // Strip Secure on http (localhost dev) — browsers reject otherwise.
    c = c.replace(/;\s*Secure/i, '');
    // SameSite=None requires Secure; downgrade to Lax when Secure stripped.
    c = c.replace(/;\s*SameSite=None/i, '; SameSite=Lax');
  }
  return c.replace(/(;\s*Path=)([^;]*)/i, (_m, head, val) => {
    const trimmed = (val as string).trim();
    // IMPORTANT: use '/space' (no trailing slash) so the cookie matches
    // both '/space' AND '/space/foo' per RFC 6265 §5.1.4. With a trailing
    // slash, Next.js's trailing-slash redirect would strip '/space/' to
    // '/space' and the cookie wouldn't be sent → infinite redirect loop.
    if (trimmed === '/' || trimmed === '') return `${head}/space`;
    if (trimmed.startsWith('/') && !trimmed.startsWith('/space')) return `${head}/space${trimmed}`;
    return `${head}${val}`;
  });
}

function rewriteHtml(html: string): string {
  let out = html;

  // a) Static href / src / action absolute-path attributes that don't already
  //    start with /space/ and aren't protocol-relative.
  const attrRe = /(\s(?:href|src|action)=)(["'])(\/(?!\/|space\/)[^"'#?]*)/gi;
  out = out.replace(attrRe, (_m, attr, q, path) => `${attr}${q}${PREFIX}${path}`);

  // b) Two known dynamic-import strings in index.html — import() does NOT go
  //    through window.fetch, so we must rewrite at HTML-rewrite time.
  out = out.replace(
    /import\((["'])\/pages\/res\/(state-version|user-crypto)\.js\1\)/g,
    (_m, q, name) => `import(${q}${PREFIX}/pages/res/${name}.js${q})`,
  );

  // c) Importmap (FIRST in <head>, before runtime patch) catches future
  //    dynamic imports the runtime fetch patch cannot intercept.
  const importmap =
    '<script type="importmap">\n' +
    '{"scopes":{"/space/":{"/pages/":"/space/pages/","/mod/":"/space/mod/","/L0/":"/space/L0/","/L1/":"/space/L1/","/L2/":"/space/L2/","/api/":"/space/api/"}}}\n' +
    '</script>';

  // d) Runtime monkey-patch — wraps fetch / XHR / WebSocket / Location methods
  //    / Location.href setter / history.pushState+replaceState /
  //    serviceWorker.register so absolute-path URLs get prefixed at runtime.
  const runtimePatch =
    '<script>(function(){' +
    "var P='/space';" +
    'function fix(u){' +
    "if(typeof u!=='string')return u;" +
    // Same-origin absolute URL (e.g. "http://localhost:3006/api/foo"):
    // strip the origin, prefix the pathname with /space, re-attach origin.
    "if(u.indexOf(location.origin)===0){" +
    "var rest=u.slice(location.origin.length);" +
    "if(rest.charAt(0)==='/'&&rest.indexOf(P+'/')!==0&&rest!==P)return location.origin+P+rest;" +
    "return u;" +
    '}' +
    // Absolute path (starts with single /): prefix with /space if not already.
    "if(u.charAt(0)==='/'&&u.charAt(1)!=='/'&&u.indexOf(P+'/')!==0&&u!==P)return P+u;" +
    'return u;' +
    '}' +
    'var of=window.fetch;' +
    'window.fetch=function(input,init){' +
    "if(typeof input==='string')return of(fix(input),init);" +
    'if(input&&input.url){try{return of(new Request(fix(input.url),input),init);}catch(_e){}}' +
    'return of(input,init);' +
    '};' +
    'var oo=XMLHttpRequest.prototype.open;' +
    'XMLHttpRequest.prototype.open=function(m,u){' +
    'var a=Array.prototype.slice.call(arguments);a[1]=fix(u);' +
    'return oo.apply(this,a);' +
    '};' +
    'var ows=window.WebSocket;' +
    "if(ows){window.WebSocket=function(u,p){return new ows(typeof u==='string'?fix(u):u,p);};window.WebSocket.prototype=ows.prototype;}" +
    'var olr=Location.prototype.replace,ola=Location.prototype.assign;' +
    'Location.prototype.replace=function(u){return olr.call(this,fix(u));};' +
    'Location.prototype.assign=function(u){return ola.call(this,fix(u));};' +
    "var d=Object.getOwnPropertyDescriptor(Location.prototype,'href');" +
    'if(d&&d.set){' +
    "Object.defineProperty(Location.prototype,'href',{" +
    'enumerable:d.enumerable,configurable:d.configurable,get:d.get,' +
    'set:function(v){return d.set.call(this,fix(v));}' +
    '});' +
    '}' +
    "['pushState','replaceState'].forEach(function(m){" +
    'var orig=history[m];' +
    'history[m]=function(s,t,u){return orig.call(this,s,t,u==null?u:fix(u));};' +
    '});' +
    'if(navigator.serviceWorker&&navigator.serviceWorker.register){' +
    'var ro=navigator.serviceWorker.register.bind(navigator.serviceWorker);' +
    'navigator.serviceWorker.register=function(u,o){return ro(fix(u),o);};' +
    '}' +
    '})();</script>';

  // Inject importmap THEN runtime patch as the FIRST elements in <head>.
  out = out.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${importmap}${runtimePatch}`);

  return out;
}

export async function GET(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function HEAD(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function POST(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function PUT(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function OPTIONS(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}

// Painel 4D - Projeto Alpha
// Guarda o painel no aparelho para abrir sem internet.
//
// Duas caixas separadas, de proposito:
//   CASCA  - o painel em si (html + controles + programacoes). ~1,4 MB. Baixa sozinha.
//   AREAS  - os arquivos pesados do modelo 3D, um por area. ~172 MB no total,
//            por isso NAO baixa tudo: guarda so a area que a pessoa abriu.
//
// O servidor dos apontamentos nunca e guardado: ou e ao vivo, ou nao e.

const V = 'p4d-v1';
const CASCA = V + '-casca';
const AREAS = V + '-areas';

const SHELL = ['./', './index.html', './controles.json', './programacoes.json'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CASCA);
    // addAll falha inteiro se um arquivo falhar; aqui um faltando nao pode derrubar o resto
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CASCA && k !== AREAS).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// os pedacos do modelo 3D saem como .wasm em dm/, d/ ou dhq/ conforme o aparelho
const ehArea = u => /\.wasm$/.test(u.pathname);

self.addEventListener('fetch', e => {
  const q = e.request;
  if (q.method !== 'GET') return;

  const u = new URL(q.url);

  // outro dominio (o servidor dos apontamentos, por exemplo): passa direto, sem guardar
  if (u.origin !== self.location.origin) return;

  // abrir o painel: tenta a rede primeiro para pegar versao nova, cai no guardado se nao tiver sinal
  if (q.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const r = await fetch(q);
        const c = await caches.open(CASCA);
        c.put('./index.html', r.clone()).catch(() => {});
        return r;
      } catch (x) {
        return (await caches.match('./index.html')) || (await caches.match('./')) ||
               new Response('Painel nao esta guardado neste aparelho. Abra uma vez com internet.',
                            { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // arquivos de area do modelo 3D: se ja esta guardado usa o guardado (e rapido e funciona sem rede)
  if (ehArea(u)) {
    e.respondWith((async () => {
      const g = await caches.match(q);
      if (g) return g;
      const r = await fetch(q);
      if (r && r.ok) {
        // pode estourar a cota do aparelho; se estourar, segue sem guardar
        caches.open(AREAS).then(c => c.put(q, r.clone())).catch(() => {});
      }
      return r;
    })());
    return;
  }

  // o resto (controles, programacoes, imagens): rede primeiro, guardado como reserva
  e.respondWith((async () => {
    try {
      const r = await fetch(q);
      if (r && r.ok) caches.open(CASCA).then(c => c.put(q, r.clone())).catch(() => {});
      return r;
    } catch (x) {
      const g = await caches.match(q);
      if (g) return g;
      throw x;
    }
  })());
});

// a pagina pede: guarde estas areas agora, que vou para o campo
self.addEventListener('message', async ev => {
  const m = ev.data || {};
  if (m.tipo !== 'guardar-areas' || !Array.isArray(m.urls)) return;
  const resp = p => { try { ev.source && ev.source.postMessage(p) } catch (x) {} };
  let ok = 0, falhou = 0;
  try {
    const c = await caches.open(AREAS);
    for (const u of m.urls.slice(0, 60)) {
      try {
        if (await c.match(u)) { ok++; resp({ tipo: 'guardando', ok, falhou, total: m.urls.length }); continue }
        const r = await fetch(u, { cache: 'no-store' });
        if (!r.ok) throw new Error(r.status);
        await c.put(u, r.clone());
        ok++;
      } catch (x) { falhou++ }
      resp({ tipo: 'guardando', ok, falhou, total: m.urls.length });
    }
  } catch (x) { falhou++ }
  resp({ tipo: 'guardado', ok, falhou, total: m.urls.length });
});

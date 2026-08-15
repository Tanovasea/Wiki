// Wiki Personal — Service Worker v20260815i

const CACHE = 'wiki-v20260815i';

// Pagina e salvata sub toate numele sub care poate fi deschisa aplicatia
// (radacina, wikitano.html, index.html). Daca unul lipseste, nu conteaza.
const PRECACHE = ['./', './wikitano.html', './index.html'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return Promise.all(PRECACHE.map(function(u) {
        // cache:'reload' = ia fisierul de la server, nu din cache-ul browserului
        return c.add(new Request(u, { cache: 'reload' })).catch(function() { return null; });
      }));
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    }).then(function() { return self.clients.claim(); })
  );
});

// Cautare in cache tolerantă: ignoreVary evita ratarile cand serverul trimite
// antetul Vary, ignoreSearch acopera adresele cu ?parametri.
function fromCache(req) {
  return caches.match(req, { ignoreVary: true }).then(function(r) {
    return r || caches.match(req, { ignoreVary: true, ignoreSearch: true });
  });
}

// Ultima plasa de siguranta pentru navigare: orice copie a aplicatiei
function appShell() {
  return caches.open(CACHE).then(function(c) {
    return c.keys().then(function(reqs) {
      for (var i = 0; i < reqs.length; i++) {
        if (/\.html$|\/$/.test(new URL(reqs[i].url).pathname)) return c.match(reqs[i]);
      }
      return null;
    });
  });
}

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;
  var url = new URL(req.url);

  // Resursele externe raman in seama browserului
  // (aplicatia nu foloseste niciuna: fonturile si iconurile sunt in fisier)
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fromCache(req).then(function(cached) {
      var network = fetch(req).then(function(resp) {
        // raspunsurile redirectionate nu se pun in cache: nu pot fi refolosite la navigare
        if (resp && resp.status === 200 && !resp.redirected) {
          var clone = resp.clone();
          caches.open(CACHE).then(function(c) { c.put(req, clone); });
        }
        return resp;
      }).catch(function() { return null; });

      // Avem copie locala: raspundem imediat si actualizam in fundal
      if (cached) {
        e.waitUntil(network);
        return cached;
      }

      // Fara copie locala: incercam reteaua
      return network.then(function(resp) {
        if (resp) return resp;
        // Offline si fara copie exacta — la navigare servim aplicatia
        if (req.mode === 'navigate') {
          return appShell().then(function(shell) {
            return shell || new Response(
              '<!DOCTYPE html><meta charset="utf-8"><body style="font:16px Georgia,serif;padding:40px">' +
              'Aplicatia nu a fost salvata local inca. Deschide-o o data cu internet pornit.</body>',
              { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        }
        return new Response('', { status: 504 });
      });
    })
  );
});

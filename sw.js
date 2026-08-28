/* =========================================================================
   Macro Carnet — service worker
   Rôle : rendre l'app ouvrable sans réseau, sans jamais servir une version
   périmée quand la connexion est là.
   Stratégie : réseau d'abord pour la page (les mises à jour arrivent tout de
   suite), cache d'abord pour les icônes. Rien du domaine des polices ni
   d'Open Food Facts n'est mis en cache.
   ========================================================================= */
const VERSION = 'macro-carnet-v7';
const RESSOURCES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icone-192.png',
  './icone-512.png'
];

self.addEventListener('install', function(ev){
  ev.waitUntil(
    caches.open(VERSION).then(function(cache){
      // Chaque ressource est ajoutée séparément : un fichier manquant ne doit
      // pas faire échouer l'installation entière.
      return Promise.all(RESSOURCES.map(function(url){
        return cache.add(url).catch(function(){ return null; });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(ev){
  ev.waitUntil(
    caches.keys().then(function(cles){
      return Promise.all(cles.map(function(c){ return c === VERSION ? null : caches.delete(c); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(ev){
  const req = ev.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);
  const memeOrigine = url.origin === self.location.origin;
  if(!memeOrigine) return;                    // polices, Open Food Facts : on laisse passer

  // La page elle-même : réseau d'abord, cache en secours hors ligne.
  if(req.mode === 'navigate'){
    ev.respondWith(
      fetch(req).then(function(rep){
        const copie = rep.clone();
        caches.open(VERSION).then(function(c){ c.put('./index.html', copie); });
        return rep;
      }).catch(function(){
        return caches.match('./index.html').then(function(r){ return r || caches.match('./'); });
      })
    );
    return;
  }

  // Icônes et manifeste : cache d'abord, rafraîchis en arrière-plan.
  ev.respondWith(
    caches.match(req).then(function(enCache){
      const reseau = fetch(req).then(function(rep){
        if(rep && rep.status === 200){
          const copie = rep.clone();
          caches.open(VERSION).then(function(c){ c.put(req, copie); });
        }
        return rep;
      }).catch(function(){ return enCache; });
      return enCache || reseau;
    })
  );
});

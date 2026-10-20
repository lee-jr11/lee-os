const CACHE = 'leeos-shell-v14';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.add(new Request(OFFLINE, {cache: 'reload'}))));
});
// Let open Hub pages finish naturally. Never force activation or reload owner work.
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('leeos-shell-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 // API requests must fail normally, including when opened as a browser navigation.
 if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
 event.respondWith(fetch(event.request).catch(async () => {
  const cache = await caches.open(CACHE);
  return await cache.match(OFFLINE) || new Response('LeeOS is unavailable. Reconnect and inspect saved work before repeating an action.', {status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}});
 }));
});

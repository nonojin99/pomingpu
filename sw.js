/* 포밍뿌 서비스 워커 — 캐시 우선(오프라인 실행), 버전 올리면 구캐시 정리 */
var CACHE = 'pomingpu-v1';
var ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/engine.js',
  'js/app.js',
  'manifest.webmanifest',
  'assets/characters/porongi.png',
  'assets/characters/mingttu.png',
  'assets/characters/pubi.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        // 폰트 등 성공 응답은 캐시에 적재
        if (res && res.status === 200 && (e.request.url.indexOf(location.origin) === 0 || e.request.url.indexOf('fonts.g') > -1)) {
          var clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      });
    }).catch(function () { return caches.match('index.html'); })
  );
});

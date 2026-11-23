// 球場実況 オフライン対応（ネット優先・失敗したらキャッシュ＝球場の弱い電波でも一度開けば動く）
const CACHE = 'yakyu-v3';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png', './moji.html', './yasashii.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  // 同じサイト（shintaro60320-blip.github.io）に他のアプリも同居しとるので、消すのは自分の古い箱（yakyu-）だけ
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('yakyu-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // よそのサーバー（Firebase の生中継・ログイン）は触らん。生中継をしまい込もうとすると届かんくなる
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    // cache:'no-cache'＝ブラウザの手元のしまい（GitHub は10分ため込む）を使わず、毎回サイトに新しいか聞く。更新がすぐ届く
    fetch(e.request, { cache: 'no-cache' }).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() =>
      caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match('./index.html'))
    )
  );
});

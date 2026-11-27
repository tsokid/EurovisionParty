// Imported by the generated service worker (vite.config.ts, workbox
// importScripts). When a new version of the site replaces an older one,
// every open tab is reloaded so no one keeps playing on old code: the server
// keeps all game progress (099), so a reload at worst shows the «Έναρξη»
// screen. A first visit (no older version) is never reloaded.
let replacesOlderVersion = false;

self.addEventListener('install', () => {
  replacesOlderVersion = !!self.registration.active;
});

self.addEventListener('activate', (event) => {
  if (!replacesOlderVersion) return;
  event.waitUntil(
    self.clients.claim().then(() =>
      self.clients.matchAll({ type: 'window' }).then((tabs) =>
        Promise.all(tabs.map((tab) => tab.navigate(tab.url).catch(() => undefined))),
      ),
    ),
  );
});

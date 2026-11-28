// Imported by the generated service worker (vite.config.ts, workbox
// importScripts). When a new version of the site replaces an older one, open
// tabs move to it so no one keeps playing on old code: the server keeps all
// game progress (099), so a reload at worst shows the «Έναρξη» screen.
// A first visit (no older version) is never reloaded.
//
// Only a tab in front is reloaded at once. A hidden or minimised tab is told
// and reloads itself when it comes back to the front (main.tsx), so a
// background tab never starts loading on its own (28 Nov 2026).
let replacesOlderVersion = false;

self.addEventListener('install', () => {
  replacesOlderVersion = !!self.registration.active;
});

self.addEventListener('activate', (event) => {
  if (!replacesOlderVersion) return;
  event.waitUntil(
    self.clients.claim().then(() =>
      self.clients.matchAll({ type: 'window' }).then((tabs) =>
        Promise.all(tabs.map((tab) => (tab.visibilityState === 'visible'
          ? tab.navigate(tab.url).catch(() => undefined)
          : Promise.resolve(tab.postMessage({ type: 'new-version' }))))),
      ),
    ),
  );
});

// Service worker do painel: só mostra as notificações (não guarda páginas em cache).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let n = {};
  try { n = e.data ? e.data.json() : {}; } catch (x) { n = { corpo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(n.titulo || 'Família Alcançar', {
    body: n.corpo || '', icon: 'icone-192.png', badge: 'icone-192.png', tag: n.tag || undefined,
    renotify: !!n.tag, data: { url: n.url || '/' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin);
  const ir = url.hash.slice(1);
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = abertas.find(w => new URL(w.url).origin === url.origin);
    if (c) { await c.focus(); c.postMessage({ ir }); return; }
    await self.clients.openWindow(url.href);
  })());
});

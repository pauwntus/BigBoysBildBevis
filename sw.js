self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Åre Olympiaden', {
      body: data.body || '',
      icon: 'https://pauwntus.github.io/BigBoysBildBevis/icon-192.png',
      badge: 'https://pauwntus.github.io/BigBoysBildBevis/icon-192.png',
      data: { url: data.url || 'https://pauwntus.github.io/BigBoysBildBevis/' },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('BigBoysBildBevis') && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(e.notification.data.url);
    })
  );
});

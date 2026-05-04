self.addEventListener('install', () => {
  self.skipWaiting();
});

const SNAPLINK_ICON_PATH = '/icons/snaplink-icon-192.png?v=20260504';

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {};
    }
  })();

  event.waitUntil(
    self.registration.showNotification(payload.title || 'SnapLink', {
      body: payload.body || 'You have a new notification.',
      icon: payload.icon || SNAPLINK_ICON_PATH,
      badge: payload.badge || SNAPLINK_ICON_PATH,
      tag: payload.tag || `snaplink-${Date.now()}`,
      actions: Array.isArray(payload.actions)
        ? payload.actions.map((action) => ({
            action: action.action,
            title: action.title,
          }))
        : [],
      data: {
        url: payload.url || '/notifications',
        actions: payload.actions || [],
      },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const actions = Array.isArray(event.notification.data?.actions) ? event.notification.data.actions : [];
  const actionTarget = actions.find((action) => action.action === event.action)?.url;
  const targetUrl = actionTarget || event.notification.data?.url || '/notifications';

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        client.navigate(targetUrl);
        return client.focus();
      }
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
  })());
});

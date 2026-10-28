// Service Worker for Task Tracker Windows Desktop Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle clicking on Windows OS notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const taskId = notificationData.taskId;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a Task Tracker tab is already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (taskId) {
            client.postMessage({
              type: 'NAVIGATE_TO_TASK',
              taskId: taskId
            });
          }
          return;
        }
      }
      // If no tab is open, open a new window
      if (self.clients.openWindow) {
        const targetUrl = taskId ? `/?taskId=${taskId}` : '/';
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

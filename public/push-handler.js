self.addEventListener('push', (event) => {
  let dados = {};

  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = {
      title: 'MIL-LIN',
      body: event.data ? event.data.text() : 'Nova notificacao.'
    };
  }

  const titulo = dados.title || 'MIL-LIN';
  const opcoes = {
    body: dados.body || 'Nova atualizacao no painel.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: dados.tag || 'mil-lin-agencia',
    data: {
      url: dados.url || '/',
      ...(dados.data || {})
    },
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const destino = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((janelas) => {
        const aberta = janelas.find((janela) => janela.url.startsWith(self.location.origin));

        if (aberta) {
          aberta.focus();
          return aberta.navigate(destino);
        }

        return self.clients.openWindow(destino);
      })
  );
});

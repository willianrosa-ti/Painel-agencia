const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';

function base64UrlParaUint8Array(valor) {
  const padding = '='.repeat((4 - (valor.length % 4)) % 4);
  const base64 = `${valor}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const dadosBrutos = window.atob(base64);
  const saida = new Uint8Array(dadosBrutos.length);

  for (let i = 0; i < dadosBrutos.length; i += 1) {
    saida[i] = dadosBrutos.charCodeAt(i);
  }

  return saida;
}

export function navegadorSuportaPush() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function obterStatusPushAgencia() {
  if (!navegadorSuportaPush()) return 'indisponivel';

  if (Notification.permission === 'denied') return 'bloqueado';

  const registro = await navigator.serviceWorker.getRegistration();
  const assinatura = await registro?.pushManager.getSubscription();

  if (assinatura) return 'ativo';
  if (Notification.permission === 'granted') return 'permitido';

  return 'pendente';
}

export async function ativarPushAgencia(token) {
  if (!navegadorSuportaPush()) {
    throw new Error('Este navegador nao suporta Web Push.');
  }

  if (!token) {
    throw new Error('Sessao da agencia expirada.');
  }

  const respostaChave = await fetch(`${API_BASE}/api/Agencia/web-push-public-key`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!respostaChave.ok) {
    throw new Error('Nao foi possivel verificar as notificacoes push.');
  }

  const dadosChave = await respostaChave.json();
  if (!dadosChave.habilitado || !dadosChave.publicKey) {
    throw new Error('Web Push ainda nao esta configurado no servidor.');
  }

  const permissao = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permissao !== 'granted') {
    throw new Error('Permissao de notificacao nao foi concedida.');
  }

  const registro = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let assinatura = await registro.pushManager.getSubscription();

  if (!assinatura) {
    assinatura = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaUint8Array(dadosChave.publicKey)
    });
  }

  const respostaSalvar = await fetch(`${API_BASE}/api/Agencia/web-push-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      ...assinatura.toJSON(),
      userAgent: navigator.userAgent
    })
  });

  if (!respostaSalvar.ok) {
    throw new Error('Nao foi possivel salvar a inscricao push.');
  }

  return assinatura;
}

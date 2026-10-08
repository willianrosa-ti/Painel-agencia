import { lerAudioLocal, salvarAudioLocal } from './chatLocal.js';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';
export const DURACAO_MAXIMA_MS = 120_000;

// MP4/AAC toca em qualquer aparelho (Android, iPhone, PC); WebM fica como alternativa.
const FORMATOS = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

// Textos antigos do servidor começavam com o emoji de microfone; o painel mostra o ícone desenhado no lugar.
export function textoSemIcone(texto) {
  return String(texto ?? '').replace(/^\u{1F3A4}\s*/u, '');
}

export function formatarDuracao(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function gravacaoSuportada() {
  return Boolean(globalThis.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

export async function iniciarGravacao() {
  if (!gravacaoSuportada()) throw new Error('Este aparelho não permite gravar áudio.');
  let fluxo;
  try {
    fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    throw new Error('Permita o uso do microfone para gravar o áudio.');
  }
  const tipo = FORMATOS.find(f => MediaRecorder.isTypeSupported(f));
  const gravador = new MediaRecorder(fluxo, { ...(tipo ? { mimeType: tipo } : {}), audioBitsPerSecond: 48_000 });
  const partes = [];
  const inicio = Date.now();
  gravador.ondataavailable = e => { if (e.data?.size) partes.push(e.data); };
  gravador.start(250);
  const liberar = () => fluxo.getTracks().forEach(t => t.stop());
  return {
    inicio,
    parar: () => new Promise((resolve, reject) => {
      gravador.onstop = () => {
        liberar();
        const blob = new Blob(partes, { type: (gravador.mimeType || tipo || 'audio/webm').split(';')[0] });
        if (!blob.size) reject(new Error('A gravação ficou vazia. Tente de novo.'));
        else resolve({ blob, duracaoMs: Math.min(Date.now() - inicio, DURACAO_MAXIMA_MS) });
      };
      if (gravador.state === 'inactive') gravador.onstop(); else gravador.stop();
    }),
    cancelar: () => { gravador.onstop = liberar; if (gravador.state !== 'inactive') gravador.stop(); else liberar(); },
  };
}

// Envia a gravação e guarda a cópia neste aparelho. Para a agência, informe o motorista da conversa/corrida.
export async function enviarAudio({ blob, duracaoMs }, motoristaId) {
  const extensao = blob.type.includes('webm') ? 'webm' : 'm4a';
  const formulario = new FormData();
  formulario.append('arquivo', blob, `audio.${extensao}`);
  formulario.append('duracaoMs', String(Math.round(duracaoMs)));
  if (motoristaId) formulario.append('motoristaId', String(motoristaId));
  const resposta = await fetch(`${API_BASE}/api/Audios`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('tokenAgencia')}` },
    body: formulario,
  });
  const texto = await resposta.text();
  let dados = {};
  try { dados = texto ? JSON.parse(texto) : {}; } catch { dados = {}; }
  if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível enviar o áudio.');
  await salvarAudioLocal(dados.id, blob);
  return dados;
}

const baixando = new Map();
// Usa a cópia deste aparelho; se ainda não tiver, baixa do servidor e guarda.
export function obterAudio(id) {
  if (!id) return Promise.reject(new Error('Áudio indisponível.'));
  if (!baixando.has(id)) {
    const promessa = (async () => {
      const local = await lerAudioLocal(id);
      if (local) return local;
      const resposta = await fetch(`${API_BASE}/api/Audios/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('tokenAgencia')}` } });
      if (!resposta.ok) throw new Error('Áudio indisponível neste aparelho.');
      const blob = await resposta.blob();
      await salvarAudioLocal(id, blob);
      return blob;
    })();
    baixando.set(id, promessa);
    promessa.catch(() => baixando.delete(id));
  }
  return baixando.get(id);
}

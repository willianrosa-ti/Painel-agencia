// O histórico do chat fica neste computador/celular (IndexedDB, que não é apagado no "Sair").
// O servidor guarda cada mensagem só até a entrega e a leitura.
const BANCO = 'millin-chat';
const TABELA = 'conversas';
const TABELA_AUDIOS = 'audios';
export const LIMITE_MENSAGENS_LOCAIS = 500;

let conexao = null;
function abrir() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  conexao ??= new Promise(resolve => {
    const pedido = indexedDB.open(BANCO, 2);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains(TABELA)) db.createObjectStore(TABELA);
      if (!db.objectStoreNames.contains(TABELA_AUDIOS)) db.createObjectStore(TABELA_AUDIOS);
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => resolve(null);
  });
  return conexao;
}

// Áudios (de chat e de corrida) também ficam guardados neste aparelho.
export async function lerAudioLocal(id) {
  const db = await abrir();
  if (!db) return null;
  return new Promise(resolve => {
    const pedido = db.transaction(TABELA_AUDIOS).objectStore(TABELA_AUDIOS).get(String(id));
    pedido.onsuccess = () => resolve(pedido.result instanceof Blob ? pedido.result : null);
    pedido.onerror = () => resolve(null);
  });
}

export async function salvarAudioLocal(id, blob) {
  const db = await abrir();
  if (!db || !blob) return;
  await new Promise(resolve => {
    const transacao = db.transaction(TABELA_AUDIOS, 'readwrite');
    transacao.objectStore(TABELA_AUDIOS).put(blob, String(id));
    transacao.oncomplete = transacao.onerror = transacao.onabort = () => resolve();
  });
}

const chave = (agenciaId, motoristaId) => `${agenciaId}:${motoristaId}`;

export function juntarMensagens(lista, novas) {
  const porId = new Map(lista.map(m => [m.id, m]));
  for (const nova of novas) {
    const atual = porId.get(nova.id);
    porId.set(nova.id, atual ? { ...atual, ...nova, lidaEm: nova.lidaEm ?? atual.lidaEm } : nova);
  }
  return [...porId.values()].sort((a, b) => a.id - b.id);
}

export async function lerConversa(agenciaId, motoristaId) {
  const db = await abrir();
  if (!db) return [];
  return new Promise(resolve => {
    const pedido = db.transaction(TABELA).objectStore(TABELA).get(chave(agenciaId, motoristaId));
    pedido.onsuccess = () => resolve(Array.isArray(pedido.result) ? pedido.result : []);
    pedido.onerror = () => resolve([]);
  });
}

export async function salvarConversa(agenciaId, motoristaId, mensagens) {
  const db = await abrir();
  if (!db || !mensagens.length) return;
  await new Promise(resolve => {
    const transacao = db.transaction(TABELA, 'readwrite');
    transacao.objectStore(TABELA).put(mensagens.slice(-LIMITE_MENSAGENS_LOCAIS), chave(agenciaId, motoristaId));
    transacao.oncomplete = transacao.onerror = transacao.onabort = () => resolve();
  });
}

export async function acrescentarMensagem(agenciaId, motoristaId, mensagem) {
  await salvarConversa(agenciaId, motoristaId, juntarMensagens(await lerConversa(agenciaId, motoristaId), [mensagem]));
}

// Última mensagem guardada de cada motorista, para a lista de conversas quando o servidor já apagou o histórico.
export async function ultimasMensagens(agenciaId) {
  const db = await abrir();
  if (!db) return {};
  return new Promise(resolve => {
    const resultado = {};
    const prefixo = `${agenciaId}:`;
    const pedido = db.transaction(TABELA).objectStore(TABELA).openCursor(IDBKeyRange.bound(prefixo, `${prefixo}￿`));
    pedido.onsuccess = () => {
      const cursor = pedido.result;
      if (!cursor) { resolve(resultado); return; }
      const ultima = Array.isArray(cursor.value) ? cursor.value.at(-1) : null;
      if (ultima) resultado[String(cursor.key).slice(prefixo.length)] = ultima.texto;
      cursor.continue();
    };
    pedido.onerror = () => resolve(resultado);
  });
}

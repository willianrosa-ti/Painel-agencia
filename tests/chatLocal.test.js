import test from 'node:test';
import assert from 'node:assert/strict';
import { juntarMensagens } from '../src/Services/chatLocal.js';

const msg = (id, extra = {}) => ({ id, motoristaId: 3, remetente: 'Motorista', texto: `m${id}`, criadoEm: '2026-10-06T10:00:00Z', ...extra });

test('histórico do computador mantém mensagens já apagadas do servidor e a confirmação de leitura', () => {
  const local = [msg(1, { lidaEm: '2026-10-06T10:01:00Z' }), msg(4)];
  const servidor = [msg(4, { lidaEm: '2026-10-06T10:05:00Z' }), msg(9)];
  const juntas = juntarMensagens(local, servidor);
  assert.deepEqual(juntas.map(m => m.id), [1, 4, 9]);
  assert.equal(juntas[0].lidaEm, '2026-10-06T10:01:00Z');
  assert.equal(juntas[1].lidaEm, '2026-10-06T10:05:00Z');
  assert.equal(juntarMensagens(juntas, [msg(4, { lidaEm: null })])[1].lidaEm, '2026-10-06T10:05:00Z');
});

test('duração do áudio aparece como minutos e segundos', async () => {
  const { formatarDuracao } = await import('../src/Services/audio.js');
  assert.equal(formatarDuracao(0), '0:00');
  assert.equal(formatarDuracao(9_400), '0:09');
  assert.equal(formatarDuracao(125_000), '2:05');
  assert.equal(formatarDuracao(undefined), '0:00');
});

test('textos antigos com emoji de microfone aparecem sem o emoji', async () => {
  const { textoSemIcone } = await import('../src/Services/audio.js');
  assert.equal(textoSemIcone('\u{1F3A4} Mensagem de voz'), 'Mensagem de voz');
  assert.equal(textoSemIcone('Olá'), 'Olá');
  assert.equal(textoSemIcone(null), '');
});

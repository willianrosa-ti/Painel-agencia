import test from 'node:test';
import assert from 'node:assert/strict';
import { COR_CAPACETE, COR_CAPACETE_PASSAGEIRO, distribuirMarcadores, svgMoto } from '../src/Pages/Monitoramento/mapaMotoristas.js';

test('motorista isolado mantém exatamente a posição original', () => {
  assert.deepEqual(distribuirMarcadores([{ id: 1, x: 15, y: 25 }]), [{ id: 1, x: 15, y: 25 }]);
});
test('até 50 motoristas juntos ficam clicáveis sem alterar os dados de GPS', () => {
  for (const n of [2, 3, 10, 50]) {
    const pontos = Array.from({ length: n }, (_, id) => ({ id, x: 0, y: 0 }));
    const original = structuredClone(pontos); const resultado = distribuirMarcadores(pontos, 64);
    assert.deepEqual(pontos, original); assert.equal(resultado.length, n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
      assert.ok(Math.hypot(resultado[i].x - resultado[j].x, resultado[i].y - resultado[j].y) >= 63.99);
    assert.deepEqual(distribuirMarcadores([...pontos].reverse(), 64), resultado);
  }
});
test('expandir um grupo não sobrepõe motoristas vizinhos', () => {
  const r = distribuirMarcadores([{ id: 1, x: 0, y: 0 }, { id: 2, x: 10, y: 0 }, { id: 3, x: 5, y: 120 }], 64);
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++)
    assert.ok(Math.hypot(r[i].x - r[j].x, r[i].y - r[j].y) >= 63.99);
});
test('ícone com passageiro inclui o segundo capacete', () => {
  assert.ok(!svgMoto(false).includes(COR_CAPACETE_PASSAGEIRO)); assert.ok(svgMoto(true).includes(COR_CAPACETE_PASSAGEIRO));
});
test('capacete do piloto fica verde livre, vermelho em corrida e mantém o cinza offline', () => {
  assert.ok(svgMoto(false, COR_CAPACETE.livre).includes('fill="#16a34a"'));
  assert.ok(svgMoto(true, COR_CAPACETE.em_corrida).includes('fill="#dc2626"'));
  assert.ok(svgMoto(false).includes('fill="#f1f5f9"'));
});

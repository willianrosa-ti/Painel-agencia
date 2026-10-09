import { useEffect, useState } from 'react';

// Conta "somente comunicação" (rádio, áudio e texto): sem corridas, monitoramento ou financeiro.
// Vem do login e é confirmada pelo servidor sempre que o rádio conecta (RadioProvider).
export const ehComunicacao = () => localStorage.getItem('agenciaComunicacao') === 'true';

export function useAgenciaComunicacao() {
  const [comunicacao, setComunicacao] = useState(ehComunicacao);
  useEffect(() => {
    const atualizar = () => setComunicacao(ehComunicacao());
    window.addEventListener('agenciaComunicacao', atualizar);
    window.addEventListener('storage', atualizar);
    return () => { window.removeEventListener('agenciaComunicacao', atualizar); window.removeEventListener('storage', atualizar); };
  }, []);
  return comunicacao;
}

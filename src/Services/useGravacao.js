import { useCallback, useEffect, useRef, useState } from 'react';
import { iniciarGravacao } from './audio';

// Controla uma gravação do microfone: começar, acompanhar o tempo, parar (devolve { blob, duracaoMs }) ou cancelar.
export function useGravacao() {
  const [gravando, setGravando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const gravadorRef = useRef(null);

  const comecar = useCallback(async () => {
    const gravador = await iniciarGravacao();
    gravadorRef.current = gravador;
    setTempo(0);
    setGravando(true);
  }, []);

  const parar = useCallback(async () => {
    const gravador = gravadorRef.current;
    if (!gravador) return null;
    gravadorRef.current = null;
    setGravando(false);
    return gravador.parar();
  }, []);

  const cancelar = useCallback(() => {
    gravadorRef.current?.cancelar();
    gravadorRef.current = null;
    setGravando(false);
  }, []);

  useEffect(() => {
    if (!gravando) return undefined;
    const intervalo = setInterval(() => setTempo(Date.now() - (gravadorRef.current?.inicio ?? Date.now())), 250);
    return () => clearInterval(intervalo);
  }, [gravando]);

  useEffect(() => () => gravadorRef.current?.cancelar(), []);

  return { gravando, tempo, comecar, parar, cancelar };
}

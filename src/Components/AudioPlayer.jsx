import { useEffect, useState, useRef } from 'react';
import { observarMicrofone, radioOcupado } from '../Services/audioFocus';
import { obterAudio } from '../Services/audio';
import { IconeMicrofone } from './Icones';
import './Audio.css';

// Toca um áudio guardado neste aparelho (ou baixa do servidor e guarda na primeira vez).
export default function AudioPlayer({ audioId, blob, className = '' }) {
  const [url, setUrl] = useState(null);
  const [erro, setErro] = useState('');
  const player = useRef(null);
  useEffect(() => observarMicrofone(tipo => { if (tipo === 'radio') player.current?.pause(); }), []);

  useEffect(() => {
    let ativo = true;
    let criado = null;
    const usar = arquivo => {
      if (!ativo) return;
      criado = URL.createObjectURL(arquivo);
      setUrl(criado);
      setErro('');
    };
    if (blob) usar(blob);
    else obterAudio(audioId).then(usar).catch(e => { if (ativo) setErro(e.message); });
    return () => {
      ativo = false;
      if (criado) URL.revokeObjectURL(criado);
    };
  }, [audioId, blob]);

  if (erro) return <span className={`audio-aviso ${className}`}><IconeMicrofone tamanho={15} /> {erro}</span>;
  if (!url) return <span className={`audio-aviso ${className}`}><IconeMicrofone tamanho={15} /> Carregando áudio…</span>;
  return <audio ref={player} onPlay={() => { if (radioOcupado()) player.current?.pause(); }} className={`audio-player ${className}`} controls preload="metadata" src={url} />;
}

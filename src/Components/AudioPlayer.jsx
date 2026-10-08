import { useEffect, useState } from 'react';
import { obterAudio } from '../Services/audio';
import './Audio.css';

// Toca um áudio guardado neste aparelho (ou baixa do servidor e guarda na primeira vez).
export default function AudioPlayer({ audioId, blob, className = '' }) {
  const [url, setUrl] = useState(null);
  const [erro, setErro] = useState('');

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

  if (erro) return <span className={`audio-aviso ${className}`}>🎤 {erro}</span>;
  if (!url) return <span className={`audio-aviso ${className}`}>🎤 Carregando áudio…</span>;
  return <audio className={`audio-player ${className}`} controls preload="metadata" src={url} />;
}

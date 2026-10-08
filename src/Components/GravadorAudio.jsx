import { useEffect, useState } from 'react';
import { DURACAO_MAXIMA_MS, formatarDuracao } from '../Services/audio';
import { useGravacao } from '../Services/useGravacao';
import AudioPlayer from './AudioPlayer';
import { IconeMicrofone } from './Icones';
import './Audio.css';

// Grava um áudio para enviar depois: gravar → parar → ouvir → regravar ou descartar.
export default function GravadorAudio({ gravacao, onGravacao, desabilitado = false }) {
  const { gravando, tempo, comecar, parar, cancelar } = useGravacao();
  const [erro, setErro] = useState('');

  async function concluir() {
    try { onGravacao(await parar()); } catch (e) { setErro(e.message); }
  }

  useEffect(() => {
    if (gravando && tempo >= DURACAO_MAXIMA_MS) concluir();
    // concluir usa apenas funções estáveis do hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gravando, tempo]);

  async function iniciar() {
    setErro('');
    try { await comecar(); } catch (e) { setErro(e.message); }
  }

  return (
    <div className="gravador-audio">
      {gravando ? (
        <div className="gravador-audio__linha">
          <span className="gravador-audio__ponto" aria-hidden="true" />
          <strong>Gravando {formatarDuracao(tempo)}</strong>
          <small>máx. {formatarDuracao(DURACAO_MAXIMA_MS)}</small>
          <button type="button" className="gravador-audio__parar" onClick={concluir}>■ Parar</button>
          <button type="button" className="gravador-audio__secundario" onClick={cancelar}>Cancelar</button>
        </div>
      ) : gravacao ? (
        <div className="gravador-audio__pronto">
          <AudioPlayer blob={gravacao.blob} />
          <div className="gravador-audio__linha">
            <small>Áudio de {formatarDuracao(gravacao.duracaoMs)}</small>
            <button type="button" className="gravador-audio__secundario" onClick={() => { onGravacao(null); iniciar(); }} disabled={desabilitado}>Regravar</button>
            <button type="button" className="gravador-audio__secundario" onClick={() => onGravacao(null)} disabled={desabilitado}>Descartar</button>
          </div>
        </div>
      ) : (
        <button type="button" className="gravador-audio__gravar" onClick={iniciar} disabled={desabilitado}>
          <IconeMicrofone tamanho={22} /> Gravar áudio com o endereço
        </button>
      )}
      {erro && <p className="gravador-audio__erro" role="alert">{erro}</p>}
    </div>
  );
}

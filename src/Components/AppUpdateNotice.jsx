import { useEffect, useState } from 'react';
import './AppUpdateNotice.css';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';
const APP_VERSION = '1.0.6';
const DISMISS_STORAGE_PREFIX = 'milLinPainelUpdateDismissed';

export default function AppUpdateNotice() {
  const [atualizacao, setAtualizacao] = useState(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function verificarAtualizacao() {
      try {
        const params = new URLSearchParams({
          produto: 'painel-agencia',
          versaoAtual: APP_VERSION,
          canal: 'main'
        });

        const resposta = await fetch(`${API_BASE}/api/Atualizacoes/mais-recente?${params.toString()}`);
        if (!resposta.ok) return;

        const dados = await resposta.json();
        const novaAtualizacao = dados?.atualizacao;

        if (!dados?.atualizacaoDisponivel || !novaAtualizacao || cancelado) return;

        const dispensada = localStorage.getItem(`${DISMISS_STORAGE_PREFIX}:${novaAtualizacao.versao}`);
        const obrigatoria = Boolean(novaAtualizacao.obrigatoria);

        if (dispensada && !obrigatoria) return;

        setAtualizacao(novaAtualizacao);
        setVisivel(true);
      } catch (erro) {
        console.warn('Nao foi possivel consultar atualizacao do painel:', erro);
      }
    }

    verificarAtualizacao();

    return () => {
      cancelado = true;
    };
  }, []);

  async function copiarLink() {
    const link = atualizacao?.linkDownload || atualizacao?.link;
    if (!link) return;

    await navigator.clipboard.writeText(link);
  }

  function dispensar() {
    if (atualizacao?.versao) {
      localStorage.setItem(`${DISMISS_STORAGE_PREFIX}:${atualizacao.versao}`, 'true');
    }

    setVisivel(false);
  }

  if (!visivel || !atualizacao) return null;

  const link = atualizacao.linkDownload || atualizacao.link;
  const obrigatoria = Boolean(atualizacao.obrigatoria);

  return (
    <div className={`app-update-notice ${obrigatoria ? 'app-update-notice--required' : ''}`} role="status">
      <div className="app-update-notice__text">
        <strong>Nova versao do painel: {atualizacao.versao}</strong>
        {atualizacao.changelog && <span>{atualizacao.changelog}</span>}
      </div>

      <div className="app-update-notice__actions">
        {link && (
          <button type="button" onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}>
            Baixar
          </button>
        )}
        {link && (
          <button type="button" onClick={copiarLink}>
            Copiar link
          </button>
        )}
        {!obrigatoria && (
          <button type="button" onClick={dispensar}>
            Depois
          </button>
        )}
      </div>
    </div>
  );
}

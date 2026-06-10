import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useFeedback } from './Feedback/useFeedback';
import {
  ativarPushAgencia,
  navegadorSuportaPush,
  obterStatusPushAgencia
} from '../Services/agenciaPushNotifications';
import './Navbar.css';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';

const RESPOSTA_PADRAO_AGENCIA =
  'Recebemos sua mensagem e estamos trabalhando para resolver, entraremos em contato em breve pelo Whatsapp assim que houver atualização.';

function corValida(valor, corPadrao) {
  if (typeof valor !== 'string') return corPadrao;

  const cor = valor.trim();

  if (!cor || cor.toLowerCase() === 'null' || cor.toLowerCase() === 'undefined') {
    return corPadrao;
  }

  const ehHexadecimal = /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(cor);

  return ehHexadecimal ? cor : corPadrao;
}

function aplicarTemaAgencia() {
  const corPrimaria = corValida(
    localStorage.getItem('corAgenciaPrimaria'),
    '#111827'
  );

  const corSecundaria = corValida(
    localStorage.getItem('corAgenciaSecundaria'),
    '#38bdf8'
  );

  const corFonteCabecalho = corValida(
    localStorage.getItem('corFonteCabecalhoAgencia'),
    '#ffffff'
  );

  document.documentElement.style.setProperty('--cor-agencia', corPrimaria);
  document.documentElement.style.setProperty(
    '--cor-agencia-secundaria',
    corSecundaria
  );
  document.documentElement.style.setProperty(
    '--cor-fonte-cabecalho',
    corFonteCabecalho
  );

  return {
    corPrimaria,
    corSecundaria,
    corFonteCabecalho
  };
}

export default function Navbar({ nomeAgencia }) {
  const navegar = useNavigate();
  const { erro: mostrarErro, sucesso: mostrarSucesso, aviso } = useFeedback();

  const [notificacoes, setNotificacoes] = useState([]);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [respondendoId, setRespondendoId] = useState(null);
  const [pushStatus, setPushStatus] = useState('indisponivel');
  const [ativandoPush, setAtivandoPush] = useState(false);
  const notificacaoRef = useRef(null);

  const nomeExibido = useMemo(() => {
    return nomeAgencia || localStorage.getItem('nomeAgencia') || 'Agência';
  }, [nomeAgencia]);

  const buscarNotificacoes = useCallback(async () => {
    const token = localStorage.getItem('tokenAgencia');

    if (!token) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const resposta = await fetch(`${API_BASE}/api/Suporte/notificacoes`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (resposta.status === 401) {
        localStorage.clear();
        navegar('/login');
        return;
      }

      if (resposta.ok) {
        const dados = await resposta.json();
        setNotificacoes(Array.isArray(dados) ? dados : []);
      }
    } catch (erro) {
      if (erro.name !== 'AbortError') {
        console.error('Erro ao buscar notificações de suporte:', erro);
      }
    } finally {
      clearTimeout(timeout);
    }
  }, [navegar]);

  useEffect(() => {
    aplicarTemaAgencia();
  }, []);

  useEffect(() => {
    if (!navegadorSuportaPush()) {
      setPushStatus('indisponivel');
      return undefined;
    }

    let ativo = true;

    obterStatusPushAgencia()
      .then((status) => {
        if (ativo) setPushStatus(status);
      })
      .catch(() => {
        if (ativo) setPushStatus('pendente');
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    buscarNotificacoes();

    const intervalo = setInterval(buscarNotificacoes, 15000);

    return () => clearInterval(intervalo);
  }, [buscarNotificacoes]);


  useEffect(() => {
    if (!dropdownAberto) return;

    const fecharAoClicarFora = (evento) => {
      if (notificacaoRef.current && !notificacaoRef.current.contains(evento.target)) {
        setDropdownAberto(false);
      }
    };

    document.addEventListener('mousedown', fecharAoClicarFora);
    document.addEventListener('touchstart', fecharAoClicarFora);

    return () => {
      document.removeEventListener('mousedown', fecharAoClicarFora);
      document.removeEventListener('touchstart', fecharAoClicarFora);
    };
  }, [dropdownAberto]);

  const handleSair = () => {
    localStorage.clear();

    document.documentElement.style.setProperty('--cor-agencia', '#111827');
    document.documentElement.style.setProperty(
      '--cor-agencia-secundaria',
      '#38bdf8'
    );
    document.documentElement.style.setProperty('--cor-fonte-cabecalho', '#ffffff');

    navegar('/login');
  };

  const ativarNotificacoesPush = async () => {
    const token = localStorage.getItem('tokenAgencia');

    if (!token) {
      navegar('/login');
      return;
    }

    try {
      setAtivandoPush(true);
      await ativarPushAgencia(token);
      setPushStatus('ativo');
      mostrarSucesso('Notificacoes push ativadas neste dispositivo.');
    } catch (erro) {
      console.error('Erro ao ativar Web Push da agencia:', erro);

      if (erro.message?.includes('Permissao')) {
        setPushStatus('bloqueado');
        aviso('Permissao de notificacao nao concedida no navegador.');
      } else {
        mostrarErro(erro.message || 'Nao foi possivel ativar as notificacoes push.');
      }
    } finally {
      setAtivandoPush(false);
    }
  };

  const formatarData = (valor) => {
    if (!valor) return '';

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) return '';

    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const responderNotificacao = async (id) => {
    const token = localStorage.getItem('tokenAgencia');

    if (!token) return;

    try {
      setRespondendoId(id);

      const resposta = await fetch(`${API_BASE}/api/Suporte/responder/${id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resposta: RESPOSTA_PADRAO_AGENCIA })
      });

      if (resposta.ok) {
        setNotificacoes((listaAtual) =>
          listaAtual.filter((item) => item.id !== id)
        );
        mostrarSucesso('A notificação foi respondida e removida da lista.');
      } else {
        const texto = await resposta.text();
        mostrarErro(texto || 'Não foi possível responder a notificação.');
      }
    } catch (erro) {
      console.error('Erro ao responder suporte:', erro);
      mostrarErro('Erro de conexão ao responder a notificação.');
    } finally {
      setRespondendoId(null);
    }
  };

  return (
    <nav className="navbar-container">
      <div className="navbar-logo">
        <Link to="/painel" className="navbar-link-logo">
          <h1>{nomeExibido}</h1>
        </Link>
      </div>

      <div className="navbar-menu">
        <Link to="/painel" className="navbar-link">
          Operar
        </Link>

        <Link to="/monitoramento" className="navbar-link">
          Monitorar
        </Link>

        <Link to="/motoristas" className="navbar-link">
          Frota
        </Link>

        <Link to="/financeiro" className="navbar-link">
          Financeiro
        </Link>
      </div>

      <div className="navbar-direita">
        <div
          ref={notificacaoRef}
          className="navbar-notificacao"
          onClick={() => setDropdownAberto((aberto) => !aberto)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="navbar-sino-svg"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>

          {notificacoes.length > 0 && (
            <span className="navbar-badge">{notificacoes.length}</span>
          )}

          {dropdownAberto && (
            <div
              className="navbar-dropdown-notificacoes"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="navbar-dropdown-cabecalho">
                <strong>Suporte técnico</strong>

                <div className="navbar-dropdown-acoes">
                  {pushStatus !== 'indisponivel' && pushStatus !== 'ativo' && (
                    <button
                      type="button"
                      onClick={ativarNotificacoesPush}
                      className="navbar-botao-push"
                      disabled={ativandoPush || pushStatus === 'bloqueado'}
                    >
                      {ativandoPush ? 'Ativando...' : 'Ativar push'}
                    </button>
                  )}

                  {pushStatus === 'ativo' && (
                    <span className="navbar-push-ativo">Push ativo</span>
                  )}

                  <button
                    type="button"
                    onClick={buscarNotificacoes}
                    className="navbar-botao-atualizar"
                  >
                    Atualizar
                  </button>
                </div>
              </div>

              {notificacoes.length === 0 ? (
                <div className="navbar-sem-notificacoes">
                  Nenhuma solicitação de suporte pendente.
                </div>
              ) : (
                <div className="navbar-lista-notificacoes">
                  {notificacoes.map((item) => (
                    <div key={item.id} className="navbar-card-notificacao">
                      <div className="navbar-card-topo">
                        <strong>{item.motorista || 'Motorista'}</strong>
                        <span>{formatarData(item.dataEnvio)}</span>
                      </div>

                      <p className="navbar-problema">{item.tipoProblema}</p>

                      {item.descricao && (
                        <p className="navbar-descricao">{item.descricao}</p>
                      )}

                      <div className="navbar-dados-motorista">
                        {item.telefone && <span>Tel: {item.telefone}</span>}
                        {item.placaMoto && <span>Placa: {item.placaMoto}</span>}
                      </div>

                      <button
                        type="button"
                        className="navbar-botao-responder"
                        onClick={() => responderNotificacao(item.id)}
                        disabled={respondendoId === item.id}
                      >
                        {respondendoId === item.id
                          ? 'Enviando...'
                          : 'Responder padrão'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
             </div>
          )}
        </div>

        <span className="navbar-usuario">
          Olá, <strong>{nomeExibido}</strong>
        </span>

        <button onClick={handleSair} className="botao-sair-navbar">
          Sair
        </button>
      </div>
    </nav>
  );
}

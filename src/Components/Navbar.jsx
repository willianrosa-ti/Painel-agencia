import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Navbar.css';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';

const RESPOSTA_PADRAO_AGENCIA = 'Recebemos sua mensagem e estamos trabalhando para resolver, entraremos em contato em breve pelo Whatsapp assim que houver alguma atualização.';

export default function Navbar({ nomeAgencia }) {
  const navegar = useNavigate();

  const [notificacoes, setNotificacoes] = useState([]);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [respondendoId, setRespondendoId] = useState(null);

  const buscarNotificacoes = async () => {
    const token = localStorage.getItem('tokenAgencia');
    if (!token) return;

    try {
      const resposta = await fetch(`${API_BASE}/api/Suporte/notificacoes`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (resposta.ok) {
        const dados = await resposta.json();
        setNotificacoes(Array.isArray(dados) ? dados : []);
      }
    } catch (erro) {
      console.error('Erro ao buscar notificações de suporte:', erro);
    }
  };

  useEffect(() => {
    buscarNotificacoes();

    // Mantém o sininho atualizado mesmo se o SignalR não estiver conectado no navegador.
    const intervalo = setInterval(buscarNotificacoes, 5000);
    return () => clearInterval(intervalo);
  }, []);

  const handleSair = () => {
    localStorage.clear();
    navegar('/login');
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
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resposta: RESPOSTA_PADRAO_AGENCIA })
      });

      if (resposta.ok) {
        setNotificacoes((listaAtual) => listaAtual.filter((item) => item.id !== id));
      } else {
        const texto = await resposta.text();
        alert(texto || 'Não foi possível responder a notificação.');
      }
    } catch (erro) {
      console.error('Erro ao responder suporte:', erro);
      alert('Erro de conexão ao responder a notificação.');
    } finally {
      setRespondendoId(null);
    }
  };

  return (
    <nav className="navbar-container">
      <div className="navbar-logo">
        <Link to="/painel" className="navbar-link-logo"> MOTO-TAXI THALES</Link>
      </div>
      
      <div className="navbar-menu">
        <Link to="/painel" className="navbar-link"> Operar</Link>
        <Link to="/motoristas" className="navbar-link"> Frota</Link>
        <Link to="/financeiro" className="navbar-link"> Financeiro</Link>
      </div>

      <div className="navbar-direita">
        <div className="navbar-notificacao" onClick={() => setDropdownAberto((aberto) => !aberto)}>
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
            <div className="navbar-dropdown-notificacoes" onClick={(e) => e.stopPropagation()}>
              <div className="navbar-dropdown-cabecalho">
                <strong>Suporte técnico</strong>
                <button type="button" onClick={buscarNotificacoes} className="navbar-botao-atualizar">Atualizar</button>
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
                        {respondendoId === item.id ? 'Enviando...' : 'Responder padrão'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        <span className="navbar-usuario">Olá, <strong>{nomeAgencia}</strong></span>
        <button onClick={handleSair} className="botao-sair-navbar">Sair</button>
      </div>
    </nav>
  );
}

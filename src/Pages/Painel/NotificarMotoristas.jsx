import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFeedback } from '../../Components/Feedback/useFeedback';

const API_BASE = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';
const LIMITE_TEXTO = 1000;

function formatarDataHora(valor) {
  const data = new Date(/Z|[+-]\d\d:\d\d$/.test(valor) ? valor : `${valor}Z`);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// O aviso aparece no meio da tela do app do motorista, em qualquer página, e fica guardado nas Notificações dele.
export default function NotificarMotoristas({ frota }) {
  const { sucesso, erro: mostrarErro, aviso } = useFeedback();
  const [texto, setTexto] = useState('');
  const [modo, setModo] = useState('todos');
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviados, setEnviados] = useState([]);

  const motoristas = useMemo(() => [...frota].sort((a, b) => String(a.nome).localeCompare(String(b.nome))), [frota]);
  const filtrados = motoristas.filter(m => `${m.nome} ${m.placaMoto || ''}`.toLowerCase().includes(busca.toLowerCase()));

  const carregarEnviados = useCallback(async () => {
    const token = localStorage.getItem('tokenAgencia');
    if (!token) return;
    try {
      const resposta = await fetch(`${API_BASE}/api/Avisos/enviados`, { headers: { Authorization: `Bearer ${token}` } });
      if (resposta.ok) setEnviados(await resposta.json());
    } catch { /* Sem conexão: o histórico é atualizado na próxima consulta. */ }
  }, []);

  useEffect(() => {
    carregarEnviados();
    const intervalo = setInterval(() => { if (document.visibilityState === 'visible') carregarEnviados(); }, 30000);
    return () => clearInterval(intervalo);
  }, [carregarEnviados]);

  function alternarMotorista(id) {
    setSelecionados(atual => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  async function enviar(e) {
    e.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo) { aviso('Escreva o aviso antes de enviar.'); return; }
    if (modo === 'escolher' && selecionados.size === 0) { aviso('Escolha ao menos um motorista.'); return; }

    setEnviando(true);
    try {
      const resposta = await fetch(`${API_BASE}/api/Avisos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('tokenAgencia')}` },
        body: JSON.stringify({ texto: conteudo, todos: modo === 'todos', motoristaIds: modo === 'todos' ? null : [...selecionados] })
      });
      const corpo = await resposta.text();
      let dados = {};
      try { dados = corpo ? JSON.parse(corpo) : {}; } catch { dados = {}; }
      if (!resposta.ok) { mostrarErro(dados.mensagem || 'Não foi possível enviar o aviso.', 'Erro ao notificar'); return; }

      sucesso(dados.enviados === 1 ? 'Aviso enviado para 1 motorista.' : `Aviso enviado para ${dados.enviados} motoristas.`);
      setTexto('');
      setSelecionados(new Set());
      carregarEnviados();
    } catch {
      mostrarErro('Erro de conexão ao enviar o aviso.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <h3 className="titulo-verde">📣 Notificar motoristas</h3>
      <form onSubmit={enviar} className="formulario-corrida formulario-aviso">
        <textarea
          className="input-padrao aviso-texto"
          placeholder="Escreva o aviso para os motoristas…"
          value={texto}
          maxLength={LIMITE_TEXTO}
          rows={4}
          onChange={e => setTexto(e.target.value)}
          required
        />
        <small className="aviso-contador">{texto.length}/{LIMITE_TEXTO}</small>

        <div className="grupo-radio-valor aviso-destino">
          <span className="label-valor">Enviar para:</span>
          <label className="opcao-radio"><input type="radio" checked={modo === 'todos'} onChange={() => setModo('todos')} /> Todos os motoristas ({motoristas.length})</label>
          <label className="opcao-radio"><input type="radio" checked={modo === 'escolher'} onChange={() => setModo('escolher')} /> Escolher motoristas</label>
        </div>

        {modo === 'escolher' && (
          <div className="aviso-escolha">
            <div className="aviso-escolha-acoes">
              <input type="search" className="input-padrao" placeholder="Buscar motorista ou placa…" value={busca} onChange={e => setBusca(e.target.value)} />
              <button type="button" onClick={() => setSelecionados(new Set(filtrados.map(m => m.id)))}>Marcar todos</button>
              <button type="button" onClick={() => setSelecionados(new Set())}>Limpar</button>
            </div>
            <ul className="aviso-lista-motoristas">
              {filtrados.map(m => (
                <li key={m.id}>
                  <label>
                    <input type="checkbox" checked={selecionados.has(m.id)} onChange={() => alternarMotorista(m.id)} />
                    <span className={`aviso-status ${m.online ? 'aviso-status--online' : ''}`} aria-hidden="true" />
                    <strong>{m.nome}</strong>
                    <small>{m.placaMoto}{m.online ? ' · online' : ' · offline'}</small>
                  </label>
                </li>
              ))}
              {filtrados.length === 0 && <li className="aviso-vazio">Nenhum motorista encontrado.</li>}
            </ul>
            <small className="aviso-contador">{selecionados.size} selecionado{selecionados.size === 1 ? '' : 's'}</small>
          </div>
        )}

        <button type="submit" className="botao-despachar" disabled={enviando}>
          {enviando ? 'ENVIANDO...' : 'ENVIAR AVISO'}
        </button>
      </form>

      <div className="avisos-enviados">
        <h4>Último aviso enviado</h4>
        {enviados.length === 0 ? (
          <p className="texto-vazio">Nenhum aviso enviado ainda.</p>
        ) : enviados.slice(0, 1).map(lote => (
          <div key={lote.loteId} className="aviso-enviado">
            <p>{lote.texto}</p>
            <small>
              {formatarDataHora(lote.criadoEm)} · {lote.total === 1 ? lote.destinatarios[0] : `${lote.total} motoristas`} · visto por {lote.vistos}/{lote.total}
            </small>
          </div>
        ))}
      </div>
    </>
  );
}

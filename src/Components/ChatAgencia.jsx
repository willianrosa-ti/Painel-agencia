import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { ativarPushAgencia } from '../Services/agenciaPushNotifications';
import { acrescentarMensagem, juntarMensagens as juntar, lerConversa, salvarConversa, ultimasMensagens } from '../Services/chatLocal';
import { DURACAO_MAXIMA_MS, enviarAudio, formatarDuracao, obterAudio, textoSemIcone } from '../Services/audio';
import { IconeLixeira, IconeMicrofone } from './Icones';
import { useGravacao } from '../Services/useGravacao';
import AudioPlayer from './AudioPlayer';
import './ChatAgencia.css';
import { useRadio } from '../Services/radioContext';
import { RadioIcon } from './RadioProvider';

const API = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';
const hora = data => new Date(/Z|[+-]\d\d:\d\d$/.test(data) ? data : `${data}Z`).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const agenciaAtual = () => localStorage.getItem('idAgencia') || 'agencia';
async function api(caminho, init = {}) {
  const res = await fetch(`${API}/api/Chat${caminho}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('tokenAgencia')}`, ...init.headers } });
  if (!res.ok) throw new Error(res.status === 401 ? 'Sua sessão expirou. Entre novamente.' : 'Sem conexão com a conversa. Tente novamente.');
  return res.status === 204 ? null : res.json();
}

export default function ChatAgencia() {
  const { chamar, alertar } = useRadio();
  const [aviso, setAviso] = useState('');
  const location = useLocation();
  const ativo = Boolean(localStorage.getItem('tokenAgencia')) && !/^\/(login|admin)/.test(location.pathname);
  const [aberto, setAberto] = useState(false);
  const [conversas, setConversas] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [anteriores, setAnteriores] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [previas, setPrevias] = useState({});
  const [audioPendente, setAudioPendente] = useState(null);
  const gravacao = useGravacao();
  const { cancelar: cancelarGravacao } = gravacao;
  const selecionadoRef = useRef(null);
  const abertoRef = useRef(false);
  const historicoRef = useRef(null);
  const campoRef = useRef(null);
  const envioRef = useRef(false);
  const acompanharRef = useRef(true);
  const alturaAnteriorRef = useRef(null);
  const historicoInicialRef = useRef(true);
  const sincronizadoRef = useRef(0);
  const conversaProntaRef = useRef(null);
  const rascunhosRef = useRef(new Map());
  const pendenteRef = useRef(new Map());
  const recebidasRef = useRef(new Set());
  const audioRef = useRef(null);
  const total = conversas.reduce((n, c) => n + c.naoLidas, 0);

  const atualizarPrevias = useCallback(() => { ultimasMensagens(agenciaAtual()).then(setPrevias).catch(() => {}); }, []);
  const carregarConversas = useCallback(async () => {
    const conta = localStorage.getItem('tokenAgencia');
    try { const lista = await api('/conversas'); if (localStorage.getItem('tokenAgencia') === conta) setConversas(lista); } catch (e) { if (abertoRef.current) setErro(e.message); }
  }, []);
  const ler = useCallback(async (id, ateId) => {
    if (!ateId || document.visibilityState !== 'visible') return;
    await api('/ler', { method: 'POST', body: JSON.stringify({ motoristaId: id, ateId }) });
    setConversas(lista => lista.map(c => c.motoristaId === id ? { ...c, naoLidas: 0 } : c));
  }, []);
  const carregarMensagens = useCallback(async (id, antigas = null) => {
    const conta = localStorage.getItem('tokenAgencia');
    try {
      const dados = await api(`/mensagens?motoristaId=${id}${antigas ? `&antesId=${antigas}` : ''}`);
      let lista = dados.mensagens;
      // Busca no servidor o que chegou entre a última mensagem guardada neste aparelho e as 60 mais recentes.
      const sincronizado = antigas ? 0 : sincronizadoRef.current;
      let temMais = dados.temAnteriores;
      for (let paginas = 0; sincronizado > 0 && temMais && lista.length && lista[0].id > sincronizado && paginas < 10; paginas++) {
        const pagina = await api(`/mensagens?motoristaId=${id}&antesId=${lista[0].id}`);
        lista = [...pagina.mensagens, ...lista]; temMais = pagina.temAnteriores;
      }
      if (selecionadoRef.current !== id || localStorage.getItem('tokenAgencia') !== conta) return;
      setMensagens(atual => juntar(atual, lista));
      if (antigas) setAnteriores(dados.temAnteriores);
      else if (historicoInicialRef.current) setAnteriores(dados.temAnteriores && sincronizadoRef.current === 0);
      if (!antigas && lista.length) sincronizadoRef.current = Math.max(sincronizadoRef.current, lista.at(-1).id);
      historicoInicialRef.current = false;
      if (abertoRef.current && dados.naoLidas) await ler(id, dados.mensagens.at(-1)?.id);
      setErro('');
    } catch (e) { setErro(e.message); }
    finally { setCarregando(false); }
  }, [ler]);

  const selecionar = useCallback(async id => {
    acompanharRef.current = true; historicoInicialRef.current = true; alturaAnteriorRef.current = null; sincronizadoRef.current = 0; conversaProntaRef.current = null;
    cancelarGravacao(); setAudioPendente(null);
    selecionadoRef.current = id; setSelecionado(id); setMensagens([]); setAnteriores(false);
    setTexto(rascunhosRef.current.get(id) || ''); setCarregando(true);
    const locais = await lerConversa(agenciaAtual(), id);
    if (selecionadoRef.current !== id) return;
    if (locais.length) { setMensagens(atual => juntar(locais, atual)); sincronizadoRef.current = locais.at(-1).id; }
    conversaProntaRef.current = id;
    carregarMensagens(id);
    setTimeout(() => campoRef.current?.focus(), 0);
  }, [carregarMensagens, cancelarGravacao]);

  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 2500); return () => clearTimeout(t); }, [aviso]);

  // Alerta recebido → "Abrir conversa": abre o chat já na conversa do motorista.
  useEffect(() => {
    const abrir = e => { abertoRef.current = true; setAberto(true); carregarConversas(); atualizarPrevias(); selecionar(e.detail); };
    window.addEventListener('abrirChatMotorista', abrir);
    return () => window.removeEventListener('abrirChatMotorista', abrir);
  }, [carregarConversas, atualizarPrevias, selecionar]);

  // Áudios recebidos também ficam guardados neste aparelho, mesmo antes de serem ouvidos.
  useEffect(() => {
    mensagens.forEach(m => { if (m.audioId) obterAudio(m.audioId).catch(() => {}); });
  }, [mensagens]);

  // Gravação no limite de tempo: para e deixa pronta para enviar.
  useEffect(() => {
    if (!gravacao.gravando || gravacao.tempo < DURACAO_MAXIMA_MS) return;
    gravacao.parar().then(g => setAudioPendente({ ...g, clienteId: crypto.randomUUID() })).catch(e => setErro(e.message));
  }, [gravacao]);

  // Guarda neste aparelho o histórico da conversa aberta.
  useEffect(() => {
    if (!selecionado || conversaProntaRef.current !== selecionado || !mensagens.length) return;
    salvarConversa(agenciaAtual(), selecionado, mensagens).then(atualizarPrevias);
  }, [mensagens, selecionado, atualizarPrevias]);

  useEffect(() => {
    if (!ativo) {
      abertoRef.current = false; selecionadoRef.current = null; conversaProntaRef.current = null;
      setAberto(false); setSelecionado(null); setMensagens([]); setConversas([]); setTexto('');
      rascunhosRef.current.clear(); pendenteRef.current.clear();
      return;
    }
    let encerrado = false;
    let tentativa;
    const conexao = new signalR.HubConnectionBuilder().withUrl(`${API}/hub-corridas`, {
      accessTokenFactory: () => localStorage.getItem('tokenAgencia') || '',
    }).withAutomaticReconnect().build();
    const atualizar = () => { carregarConversas(); if (abertoRef.current && selecionadoRef.current && conversaProntaRef.current === selecionadoRef.current) carregarMensagens(selecionadoRef.current); };
    conexao.on('ChatMensagem', m => {
      if (m.motoristaId === selecionadoRef.current && conversaProntaRef.current === m.motoristaId) {
        setMensagens(lista => juntar(lista, [m]));
        if (abertoRef.current) ler(m.motoristaId, m.id).catch(() => {});
      } else acrescentarMensagem(agenciaAtual(), m.motoristaId, m).then(atualizarPrevias).catch(() => {});
      if (m.audioId) obterAudio(m.audioId).catch(() => {});
      carregarConversas();
      if (m.remetente !== 'Motorista' || recebidasRef.current.has(m.id)) return;
      recebidasRef.current.add(m.id);
      if (recebidasRef.current.size > 500) recebidasRef.current.delete(recebidasRef.current.values().next().value);
      if (abertoRef.current && selecionadoRef.current === m.motoristaId && document.visibilityState === 'visible') return;
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'visible') {
        const aviso = new Notification('Mensagem do motorista', { body: textoSemIcone(m.texto), tag: `chat-${m.id}` });
        aviso.onclick = () => { window.focus(); abertoRef.current = true; setAberto(true); selecionar(m.motoristaId); aviso.close(); };
      } else if (audioRef.current?.state === 'running') {
        const ctx = audioRef.current, oscilador = ctx.createOscillator(), ganho = ctx.createGain();
        oscilador.frequency.value = 760; ganho.gain.setValueAtTime(0.05, ctx.currentTime);
        ganho.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        oscilador.connect(ganho); ganho.connect(ctx.destination); oscilador.start(); oscilador.stop(ctx.currentTime + 0.25);
      }
    });
    conexao.on('ChatLida', d => {
      if (d.motoristaId === selecionadoRef.current && d.lidaPor === 'Motorista') setMensagens(lista => lista.map(m => m.id <= d.ateId && m.remetente === 'Agencia' ? { ...m, lidaEm: d.lidaEm } : m));
      carregarConversas();
    });
    conexao.onreconnecting(() => setConectado(false));
    conexao.onreconnected(() => { setConectado(true); atualizar(); });
    const iniciar = async () => {
      try { await conexao.start(); if (!encerrado) { setConectado(true); atualizar(); } }
      catch { if (!encerrado) tentativa = setTimeout(iniciar, 5000); }
    };
    conexao.onclose(() => { setConectado(false); if (!encerrado) tentativa = setTimeout(iniciar, 5000); });
    iniciar(); carregarConversas(); atualizarPrevias();
    const intervalo = setInterval(() => { if (document.visibilityState === 'visible') atualizar(); }, 15000);
    const visibilidade = () => { if (document.visibilityState === 'visible') atualizar(); };
    const abrir = e => { abertoRef.current = true; setAberto(true); if (e.detail?.motoristaId) selecionar(Number(e.detail.motoristaId)); };
    document.addEventListener('visibilitychange', visibilidade);
    window.addEventListener('abrir-chat-motorista', abrir);
    return () => { encerrado = true; clearTimeout(tentativa); clearInterval(intervalo); conexao.stop(); document.removeEventListener('visibilitychange', visibilidade); window.removeEventListener('abrir-chat-motorista', abrir); };
  }, [ativo, carregarConversas, carregarMensagens, ler, selecionar, atualizarPrevias]);

  useEffect(() => {
    const id = Number(new URLSearchParams(location.search).get('chat'));
    if (ativo && id) { abertoRef.current = true; setAberto(true); selecionar(id); }
  }, [location.search, ativo, selecionar]);

  useEffect(() => {
    const el = historicoRef.current;
    if (!el || carregando) return;
    if (alturaAnteriorRef.current !== null) { el.scrollTop += el.scrollHeight - alturaAnteriorRef.current; alturaAnteriorRef.current = null; }
    else if (acompanharRef.current) el.scrollTop = el.scrollHeight;
  }, [mensagens.length, carregando]);

  async function enviar(e) {
    e.preventDefault();
    const conteudo = texto.trim(), id = selecionadoRef.current;
    if (!conteudo || !id || envioRef.current) return;
    envioRef.current = true; setEnviando(true); setErro('');
    let pendente = pendenteRef.current.get(id);
    if (pendente?.texto !== conteudo) { pendente = { texto: conteudo, clienteId: crypto.randomUUID() }; pendenteRef.current.set(id, pendente); }
    try {
      const m = await api('/mensagens', { method: 'POST', body: JSON.stringify({ ...pendente, motoristaId: id }) });
      if (selecionadoRef.current === id) { setMensagens(lista => juntar(lista, [m])); setTexto(''); }
      rascunhosRef.current.delete(id); pendenteRef.current.delete(id); carregarConversas();
    } catch (e) { setErro(`${e.message} A mensagem foi preservada.`); }
    finally { envioRef.current = false; setEnviando(false); campoRef.current?.focus(); }
  }

  async function gravarAudio() {
    setErro('');
    try { await gravacao.comecar(); } catch (e) { setErro(e.message); }
  }

  function descartarAudio() {
    cancelarGravacao();
    setAudioPendente(null);
    campoRef.current?.focus();
  }

  async function enviarAudioAtual() {
    const id = selecionadoRef.current;
    if (!id || envioRef.current) return;
    let pendente = audioPendente;
    if (gravacao.gravando) {
      try { pendente = { ...(await gravacao.parar()), clienteId: crypto.randomUUID() }; setAudioPendente(pendente); }
      catch (e) { setErro(e.message); return; }
    }
    if (!pendente) return;
    envioRef.current = true; setEnviando(true); setErro('');
    try {
      if (!pendente.audioId) { pendente = { ...pendente, audioId: (await enviarAudio(pendente, id)).id }; setAudioPendente(pendente); }
      const m = await api('/mensagens', { method: 'POST', body: JSON.stringify({ motoristaId: id, clienteId: pendente.clienteId, audioId: pendente.audioId }) });
      if (selecionadoRef.current === id) setMensagens(lista => juntar(lista, [m]));
      setAudioPendente(null); carregarConversas();
    } catch (e) { setErro(`${e.message} O áudio foi preservado.`); }
    finally { envioRef.current = false; setEnviando(false); }
  }

  function alternar() {
    if (!audioRef.current && window.AudioContext) audioRef.current = new AudioContext();
    audioRef.current?.resume().catch(() => {});
    abertoRef.current = !aberto; setAberto(!aberto); if (!aberto) { carregarConversas(); atualizarPrevias(); }
  }
  if (!ativo) return null;
  const motorista = conversas.find(c => c.motoristaId === selecionado);
  // radio: "radio" (pode bipar), "alerta" (só alerta), "ocupado" ou "nenhum" (servidores antigos: sempre rádio).
  const disponivel = motorista?.radio || 'radio';
  const situacao = disponivel === 'ocupado' ? 'Ocupado · não recebe rádio nem alerta' : motorista?.online ? 'Online'
    : disponivel === 'radio' ? 'Offline · recebe rádio' : disponivel === 'alerta' ? 'Offline · recebe só alerta' : 'Offline · pode deixar mensagem';
  return createPortal(<div className="chat-agencia-root">
    {aberto && <section className={`chat-agencia-window ${selecionado ? 'chat-agencia-window--selected' : ''}`} role="dialog" aria-label="Mensagens com motoristas" onKeyDown={e => { if (e.key === 'Escape') alternar(); }}>
      <header className="chat-agencia-header"><div><strong>Conversas</strong><small><i className={conectado ? 'conectado' : ''} />{conectado ? 'Em tempo real' : 'Reconectando…'}</small></div><div className="chat-header-actions"><button title="Ativar notificações do dispositivo" aria-label="Ativar notificações" onClick={async () => { try { await ativarPushAgencia(localStorage.getItem('tokenAgencia')); setErro(''); } catch (e) { setErro(e.message); } }}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6" /></svg></button><button aria-label="Fechar conversas" onClick={alternar}>×</button></div></header>
      <div className="chat-agencia-body">
        <aside className="chat-agencia-contacts"><input aria-label="Buscar motorista" placeholder="Buscar motorista…" value={busca} onChange={e => setBusca(e.target.value)} /><div className="chat-contact-list">{conversas.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase())).map(c => <button key={c.motoristaId} className={selecionado === c.motoristaId ? 'selected' : ''} onClick={() => selecionar(c.motoristaId)}><span className="chat-contact-avatar">{c.nome.slice(0, 1)}</span><span><strong>{c.nome}</strong><small>{textoSemIcone(c.ultimaMensagem || previas[c.motoristaId]) || 'Iniciar conversa'}</small></span>{c.naoLidas > 0 && <b>{c.naoLidas}</b>}</button>)}</div></aside>
        <div className="chat-agencia-conversation">{motorista ? <>
          <div className="chat-person-header"><button className="chat-back" onClick={() => { selecionadoRef.current = null; conversaProntaRef.current = null; setSelecionado(null); }} aria-label="Voltar aos motoristas">←</button><strong>{motorista.nome}<span className="chat-person-status">{situacao}</span></strong>
            <button className="chat-alert-btn" title="Enviar alerta (BIP BIP ALERTA)" aria-label="Enviar alerta" disabled={!['radio', 'alerta'].includes(disponivel)}
              onClick={async () => { try { setAviso(await alertar('Motorista', selecionado) || 'Alerta enviado.'); setErro(''); } catch (e) { setErro(e.message); } }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6" /></svg>
            </button>
            <button className="radio-beep" title="Bipar para chamar no rádio" disabled={disponivel !== 'radio'} onClick={() => chamar('Motorista', selecionado)}><RadioIcon />Bipar</button></div>
          {aviso && <p className="chat-agencia-aviso" aria-live="polite">{aviso}</p>}
          <div className="chat-agencia-history" ref={historicoRef} aria-live="polite" onScroll={e => { const el = e.currentTarget; acompanharRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
            {anteriores && <button className="chat-older" disabled={carregando} onClick={() => { alturaAnteriorRef.current = historicoRef.current?.scrollHeight ?? null; acompanharRef.current = false; setCarregando(true); carregarMensagens(selecionado, mensagens[0]?.id); }}>Carregar anteriores</button>}
            {!mensagens.length && <p className="chat-empty">{carregando ? 'Carregando…' : 'Este é o início da conversa. Envie uma mensagem.'}</p>}
            {mensagens.map(m => <div key={m.id} className={`chat-bubble ${m.remetente === 'Agencia' ? 'sent' : 'received'}${m.audioId ? ' chat-bubble--audio' : ''}`}>{m.audioId ? <AudioPlayer audioId={m.audioId} /> : <p>{m.texto}</p>}<small>{hora(m.criadoEm)}{m.remetente === 'Agencia' ? m.lidaEm ? ' · Lida' : ' · Enviada' : ''}</small></div>)}
          </div>
          {/* readOnly (e não disabled) durante o envio: o campo mantém o foco e o próximo texto já pode ser digitado após o Enter. */}
          <form className="chat-agencia-compose" onSubmit={enviar}>
            {gravacao.gravando ? <div className="chat-gravacao" aria-live="polite"><span className="chat-gravacao-ponto" aria-hidden="true" />Gravando {formatarDuracao(gravacao.tempo)}</div>
              : audioPendente ? <div className="chat-gravacao"><AudioPlayer blob={audioPendente.blob} /></div>
              : <textarea ref={campoRef} aria-label={`Mensagem para ${motorista.nome}`} placeholder="Escreva uma mensagem…" value={texto} readOnly={enviando} maxLength={2000} rows={2} onChange={e => { setTexto(e.target.value); rascunhosRef.current.set(selecionado, e.target.value); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(e); } }} />}
            {gravacao.gravando || audioPendente ? <>
              <button type="button" className="chat-descartar" onClick={descartarAudio} disabled={enviando} aria-label="Descartar áudio"><IconeLixeira tamanho={21} /></button>
              <button type="button" onClick={enviarAudioAtual} disabled={enviando} aria-label="Enviar áudio">{enviando ? '…' : '↑'}</button>
            </> : texto.trim() ? <button disabled={enviando} aria-label="Enviar mensagem">{enviando ? '…' : '↑'}</button>
              : <button type="button" className="chat-microfone" onClick={gravarAudio} aria-label="Gravar áudio"><IconeMicrofone tamanho={23} /></button>}
          </form>
        </> : <div className="chat-empty"><span>↗</span><strong>Fale com sua frota</strong><p>Escolha um motorista para iniciar uma conversa.</p></div>}</div>
      </div>
      {erro && <p className="chat-agencia-error" role="alert">{erro}</p>}
    </section>}
    <button className="chat-agencia-fab" aria-label={`Mensagens, ${total} não lidas`} aria-expanded={aberto} onClick={alternar}><svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 10 10 0 0 1-4-.8L3 21l1.5-5A8 8 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01" strokeWidth="3" strokeLinecap="round"/></svg>{total > 0 && <b>{total > 99 ? '99+' : total}</b>}</button>
  </div>, document.body);
}

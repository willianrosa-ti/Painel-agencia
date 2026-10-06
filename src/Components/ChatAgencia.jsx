import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { ativarPushAgencia } from '../Services/agenciaPushNotifications';
import './ChatAgencia.css';

const API = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';
const juntar = (lista, novas) => [...new Map([...lista, ...novas].map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id);
const hora = data => new Date(/Z|[+-]\d\d:\d\d$/.test(data) ? data : `${data}Z`).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
async function api(caminho, init = {}) {
  const res = await fetch(`${API}/api/Chat${caminho}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('tokenAgencia')}`, ...init.headers } });
  if (!res.ok) throw new Error(res.status === 401 ? 'Sua sessão expirou. Entre novamente.' : 'Sem conexão com a conversa. Tente novamente.');
  return res.status === 204 ? null : res.json();
}

export default function ChatAgencia() {
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
  const selecionadoRef = useRef(null);
  const abertoRef = useRef(false);
  const historicoRef = useRef(null);
  const envioRef = useRef(false);
  const acompanharRef = useRef(true);
  const alturaAnteriorRef = useRef(null);
  const historicoInicialRef = useRef(true);
  const rascunhosRef = useRef(new Map());
  const pendenteRef = useRef(new Map());
  const recebidasRef = useRef(new Set());
  const audioRef = useRef(null);
  const total = conversas.reduce((n, c) => n + c.naoLidas, 0);

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
      if (selecionadoRef.current !== id || localStorage.getItem('tokenAgencia') !== conta) return;
      setMensagens(lista => juntar(lista, dados.mensagens));
      if (antigas || historicoInicialRef.current) setAnteriores(dados.temAnteriores);
      historicoInicialRef.current = false;
      if (abertoRef.current && dados.naoLidas) await ler(id, dados.mensagens.at(-1)?.id);
      setErro('');
    } catch (e) { setErro(e.message); }
    finally { setCarregando(false); }
  }, [ler]);

  const selecionar = useCallback(id => {
    acompanharRef.current = true; historicoInicialRef.current = true; alturaAnteriorRef.current = null;
    selecionadoRef.current = id; setSelecionado(id); setMensagens([]); setAnteriores(false);
    setTexto(rascunhosRef.current.get(id) || ''); setCarregando(true); carregarMensagens(id);
  }, [carregarMensagens]);

  useEffect(() => {
    if (!ativo) {
      abertoRef.current = false; selecionadoRef.current = null;
      setAberto(false); setSelecionado(null); setMensagens([]); setConversas([]); setTexto('');
      rascunhosRef.current.clear(); pendenteRef.current.clear();
      return;
    }
    let encerrado = false;
    let tentativa;
    const conexao = new signalR.HubConnectionBuilder().withUrl(`${API}/hub-corridas`, {
      accessTokenFactory: () => localStorage.getItem('tokenAgencia') || '',
    }).withAutomaticReconnect().build();
    const atualizar = () => { carregarConversas(); if (abertoRef.current && selecionadoRef.current) carregarMensagens(selecionadoRef.current); };
    conexao.on('ChatMensagem', m => {
      if (m.motoristaId === selecionadoRef.current) {
        setMensagens(lista => juntar(lista, [m]));
        if (abertoRef.current) ler(m.motoristaId, m.id).catch(() => {});
      }
      carregarConversas();
      if (m.remetente !== 'Motorista' || recebidasRef.current.has(m.id)) return;
      recebidasRef.current.add(m.id);
      if (recebidasRef.current.size > 500) recebidasRef.current.delete(recebidasRef.current.values().next().value);
      if (abertoRef.current && selecionadoRef.current === m.motoristaId && document.visibilityState === 'visible') return;
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'visible') {
        const aviso = new Notification('Mensagem do motorista', { body: m.texto, tag: `chat-${m.id}` });
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
    iniciar(); carregarConversas();
    const intervalo = setInterval(() => { if (document.visibilityState === 'visible') atualizar(); }, 15000);
    const visibilidade = () => { if (document.visibilityState === 'visible') atualizar(); };
    const abrir = e => { abertoRef.current = true; setAberto(true); if (e.detail?.motoristaId) selecionar(Number(e.detail.motoristaId)); };
    document.addEventListener('visibilitychange', visibilidade);
    window.addEventListener('abrir-chat-motorista', abrir);
    return () => { encerrado = true; clearTimeout(tentativa); clearInterval(intervalo); conexao.stop(); document.removeEventListener('visibilitychange', visibilidade); window.removeEventListener('abrir-chat-motorista', abrir); };
  }, [ativo, carregarConversas, carregarMensagens, ler, selecionar]);

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
    finally { envioRef.current = false; setEnviando(false); }
  }

  function alternar() {
    if (!audioRef.current && window.AudioContext) audioRef.current = new AudioContext();
    audioRef.current?.resume().catch(() => {});
    abertoRef.current = !aberto; setAberto(!aberto); if (!aberto) carregarConversas();
  }
  if (!ativo) return null;
  const motorista = conversas.find(c => c.motoristaId === selecionado);
  return createPortal(<div className="chat-agencia-root">
    {aberto && <section className={`chat-agencia-window ${selecionado ? 'chat-agencia-window--selected' : ''}`} role="dialog" aria-label="Mensagens com motoristas" onKeyDown={e => { if (e.key === 'Escape') alternar(); }}>
      <header className="chat-agencia-header"><div><strong>Conversas</strong><small><i className={conectado ? 'conectado' : ''} />{conectado ? 'Em tempo real' : 'Reconectando…'}</small></div><div className="chat-header-actions"><button title="Ativar notificações do dispositivo" aria-label="Ativar notificações" onClick={async () => { try { await ativarPushAgencia(localStorage.getItem('tokenAgencia')); setErro(''); } catch (e) { setErro(e.message); } }}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6" /></svg></button><button aria-label="Fechar conversas" onClick={alternar}>×</button></div></header>
      <div className="chat-agencia-body">
        <aside className="chat-agencia-contacts"><input aria-label="Buscar motorista" placeholder="Buscar motorista…" value={busca} onChange={e => setBusca(e.target.value)} /><div className="chat-contact-list">{conversas.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase())).map(c => <button key={c.motoristaId} className={selecionado === c.motoristaId ? 'selected' : ''} onClick={() => selecionar(c.motoristaId)}><span className="chat-contact-avatar">{c.nome.slice(0, 1)}</span><span><strong>{c.nome}</strong><small>{c.ultimaMensagem || 'Iniciar conversa'}</small></span>{c.naoLidas > 0 && <b>{c.naoLidas}</b>}</button>)}</div></aside>
        <div className="chat-agencia-conversation">{motorista ? <>
          <div className="chat-person-header"><button className="chat-back" onClick={() => { selecionadoRef.current = null; setSelecionado(null); }} aria-label="Voltar aos motoristas">←</button><strong>{motorista.nome}</strong><span>Motorista</span></div>
          <div className="chat-agencia-history" ref={historicoRef} aria-live="polite" onScroll={e => { const el = e.currentTarget; acompanharRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
            {anteriores && <button className="chat-older" disabled={carregando} onClick={() => { alturaAnteriorRef.current = historicoRef.current?.scrollHeight ?? null; acompanharRef.current = false; setCarregando(true); carregarMensagens(selecionado, mensagens[0]?.id); }}>Carregar anteriores</button>}
            {!mensagens.length && <p className="chat-empty">{carregando ? 'Carregando…' : 'Este é o início da conversa. Envie uma mensagem.'}</p>}
            {mensagens.map(m => <div key={m.id} className={`chat-bubble ${m.remetente === 'Agencia' ? 'sent' : 'received'}`}><p>{m.texto}</p><small>{hora(m.criadoEm)}{m.remetente === 'Agencia' ? m.lidaEm ? ' · Lida' : ' · Enviada' : ''}</small></div>)}
          </div>
          <form className="chat-agencia-compose" onSubmit={enviar}><textarea aria-label={`Mensagem para ${motorista.nome}`} placeholder="Escreva uma mensagem…" value={texto} disabled={enviando} maxLength={2000} rows={2} onChange={e => { setTexto(e.target.value); rascunhosRef.current.set(selecionado, e.target.value); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(e); } }} /><button disabled={enviando || !texto.trim()} aria-label="Enviar mensagem">{enviando ? '…' : '↑'}</button></form>
        </> : <div className="chat-empty"><span>↗</span><strong>Fale com sua frota</strong><p>Escolha um motorista para iniciar uma conversa.</p></div>}</div>
      </div>
      {erro && <p className="chat-agencia-error" role="alert">{erro}</p>}
    </section>}
    <button className="chat-agencia-fab" aria-label={`Mensagens, ${total} não lidas`} aria-expanded={aberto} onClick={alternar}><svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 10 10 0 0 1-4-.8L3 21l1.5-5A8 8 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01" strokeWidth="3" strokeLinecap="round"/></svg>{total > 0 && <b>{total > 99 ? '99+' : total}</b>}</button>
  </div>, document.body);
}

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { RadioClient } from '../Services/RadioClient';
import { radioMedia } from '../Services/radioMedia';
import { RadioContext } from '../Services/radioContext';
import './Radio.css';
import { IconeAlerta } from './Icones';

const API = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';
const vazio = { chamada: null, eu: null, conectado: false, preparando: false, erro: '' };
// Duração do PRI RADIO: o microfone só abre depois do bipe, como num rádio comunicador.
const DURACAO_BIPE_MS = 650;
const volumeBipe = () => { try { const v = Number(localStorage.getItem('volumeBipeRadio') ?? 1); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; } catch { return 1; } };
export default function RadioProvider({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('tokenAgencia');
  const ativo = !!token && !/^\/(login|admin)/.test(location.pathname);
  const [estado, setEstado] = useState(vazio);
  const client = useRef(null), beep = useRef(null), bipeRadio = useRef(null), botao = useRef(null), somAlerta = useRef(null);
  // Alertas recebidos pelo chat (motoristas): ficam na tela até a agência abrir, chamar ou fechar.
  const [alertas, setAlertas] = useState([]);
  useEffect(() => {
    if (!ativo) return;
    const hub = new signalR.HubConnectionBuilder().withUrl(`${API}/hub-radio`, { accessTokenFactory: () => localStorage.getItem('tokenAgencia') || '' }).withAutomaticReconnect().build();
    const c = new RadioClient({ hub, media: radioMedia, update: setEstado,
      config: async () => {
        const r = await fetch(`${API}/api/Radio/config`, { headers: { Authorization: `Bearer ${localStorage.getItem('tokenAgencia')}` } });
        if (!r.ok) throw new Error('Sessão indisponível. Entre novamente.');
        const dados = await r.json();
        // Conta só de comunicação (rádio, áudio e texto): o menu esconde corridas e financeiro.
        const comunicacao = String(!!dados.comunicacao);
        if (localStorage.getItem('agenciaComunicacao') !== comunicacao) { localStorage.setItem('agenciaComunicacao', comunicacao); window.dispatchEvent(new Event('agenciaComunicacao')); }
        return dados;
      },
      aoAlertaAvulso: alerta => {
        somAlerta.current ??= new Audio(`${import.meta.env.BASE_URL}sounds/bip-alerta.mp3`);
        somAlerta.current.currentTime = 0; somAlerta.current.play().catch(() => {});
        setAlertas(lista => [alerta, ...lista.filter(a => a.de.chave !== alerta.de.chave)].slice(0, 5));
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          const n = new Notification(`Alerta · ${alerta.de.nome}`, { body: 'O motorista está chamando a agência.', tag: `radio-avulso-${alerta.id}` });
          n.onclick = () => { window.focus(); n.close(); };
        }
      },
      // Rádio pelo servidor, sem "atender": com o painel visível, a conexão é feita na hora.
      autoAtender: () => !document.hidden,
      bipe: () => {
        // Volume do bipe escolhido na tela do rádio (a voz não muda); mudo = não toca e o microfone abre na hora.
        const volume = volumeBipe();
        if (volume <= 0) return 0;
        bipeRadio.current ??= new Audio(`${import.meta.env.BASE_URL}sounds/pri-radio.mp3`);
        bipeRadio.current.volume = volume;
        bipeRadio.current.currentTime = 0; bipeRadio.current.play().catch(() => {});
        return DURACAO_BIPE_MS;
      },
      invite: chamada => {
        beep.current ??= new Audio(`${import.meta.env.BASE_URL}sounds/radio-bipe.wav`); beep.current.play().catch(() => {});
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          const n = new Notification(`Rádio · ${chamada.origem.nome}`, { body: 'Rádio chamando. Abra o painel para conectar.', tag: `radio-${chamada.id}` });
          n.onclick = () => { window.focus(); n.close(); };
        }
      },
    });
    client.current = c; c.start();
    const release = () => c.release();
    const visibilidade = () => { c.release(); if (!document.hidden) c.atenderPendente(); };
    window.addEventListener('blur', release); document.addEventListener('visibilitychange', visibilidade);
    return () => { window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', visibilidade); client.current = null; c.dispose(); setEstado(vazio); };
  }, [ativo, token]);
  const call = estado.chamada, incoming = call?.status === 'Tocando' && call.destino.chave === estado.eu?.chave;
  const other = call?.origem.chave === estado.eu?.chave ? call?.destino : call?.origem;
  const falando = !!call?.falante && call.falante === estado.eu?.chave;
  const aberto = ativo && (!!call || !!estado.erro || estado.preparando);
  useEffect(() => { if (aberto) botao.current?.focus(); }, [aberto]);
  const fecharAlerta = id => setAlertas(lista => lista.filter(a => a.id !== id));
  return <RadioContext.Provider value={{ chamar: (perfil, id) => client.current?.call(perfil, id), estado,
    alertar: async (perfil, id) => { if (!client.current) throw new Error('Rádio indisponível.'); return client.current.alertarAvulso(perfil, id); } }}>
    {children}
    {ativo && alertas.length > 0 && createPortal(<div className="radio-alertas" role="region" aria-label="Alertas recebidos">
      {alertas.map(a => <div key={a.id} className="radio-alerta" role="alert">
        <span className="radio-alerta-icone" aria-hidden="true"><IconeAlerta tamanho={22} /></span>
        <div><strong>{a.de.nome}</strong><small>enviou um alerta · {new Date(a.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></div>
        <div className="radio-alerta-acoes">
          <button onClick={() => { fecharAlerta(a.id); window.dispatchEvent(new CustomEvent('abrirChatMotorista', { detail: a.de.id })); }}>Abrir conversa</button>
          <button className="radio-alerta-radio" onClick={() => { fecharAlerta(a.id); client.current?.call('Motorista', a.de.id); }}><RadioIcon />Chamar</button>
          <button className="radio-alerta-fechar" aria-label="Fechar alerta" onClick={() => fecharAlerta(a.id)}>×</button>
        </div>
      </div>)}
    </div>, document.body)}
    {aberto && createPortal(<div className="radio-backdrop">
      <section className="radio-card" role="dialog" aria-modal="true" aria-labelledby="radio-titulo" onKeyDown={e => {
        if (e.key === 'Escape') client.current?.end();
        if (e.key === 'Tab') { const focus = [...e.currentTarget.querySelectorAll('button:not([disabled])')]; const next = e.shiftKey ? focus.at(-1) : focus[0]; if (document.activeElement === (e.shiftKey ? focus[0] : focus.at(-1))) { e.preventDefault(); next?.focus(); } }
      }}>
        <div className="radio-mark"><RadioIcon /></div><small>RÁDIO PRIVADO</small><h2 id="radio-titulo">{other?.nome || 'Rádio'}</h2>
        {call && <p aria-live="polite">{call.status === 'Tocando' ? incoming ? 'Conectando o rádio…' : 'Chamando… conectando o rádio' : call.status === 'Ativa' ? falando ? 'Você está falando' : call.falante ? `${other?.nome} está falando` : 'Canal livre' : 'Conectando áudio…'}</p>}
        {estado.preparando && <p>Abrindo o rádio…</p>}
        {estado.erro && <p className="radio-error" role="alert">{estado.erro}</p>}
        {call?.status === 'Ativa' && <>
          <button className={`radio-talk ${falando ? 'speaking' : ''}`} aria-label="Segure para falar no rádio" onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); client.current?.press(); }}
            onPointerUp={() => client.current?.release()} onPointerCancel={() => client.current?.release()} onLostPointerCapture={() => client.current?.release()} onBlur={() => client.current?.release()}
            onKeyDown={e => { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); if (!e.repeat) client.current?.press(); } }} onKeyUp={e => { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); client.current?.release(); } }}>
            <RadioIcon />{falando ? 'Falando…' : 'Segure para falar'}
          </button><span className="radio-help">Espere o bipe para falar · solte para ouvir · até 20 s por fala</span>
          <label className="radio-volume">Volume do bipe
            <input type="range" min="0" max="1" step="0.25" defaultValue={volumeBipe()} aria-valuetext={`${Math.round(volumeBipe() * 100)}%`}
              onChange={e => { try { localStorage.setItem('volumeBipeRadio', e.target.value); } catch { /* sem armazenamento */ } }} />
          </label>
        </>}
        <button ref={botao} className="radio-end" onClick={() => client.current?.end()}>{call ? 'Encerrar rádio' : 'Fechar'}</button>
      </section>
    </div>, document.body)}
  </RadioContext.Provider>;
}
export function RadioIcon() { return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="6" y="8" width="12" height="13" rx="3"/><path d="M9 8V3m6 5V6M9 12h6m-6 4h6M3 7a8 8 0 0 1 0-4m18 4a8 8 0 0 0 0-4"/></svg>; }

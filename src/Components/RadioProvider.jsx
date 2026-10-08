import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { RadioClient } from '../Services/RadioClient';
import { radioMedia } from '../Services/radioMedia';
import { RadioContext } from '../Services/radioContext';
import './Radio.css';

const API = 'https://motoapp-bwadauh0dbcqbubb.centralus-01.azurewebsites.net';
const vazio = { chamada: null, eu: null, conectado: false, preparando: false, erro: '' };
export default function RadioProvider({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('tokenAgencia');
  const ativo = !!token && !/^\/(login|admin)/.test(location.pathname);
  const [estado, setEstado] = useState(vazio);
  const client = useRef(null), beep = useRef(null), botao = useRef(null);
  useEffect(() => {
    if (!ativo) return;
    const hub = new signalR.HubConnectionBuilder().withUrl(`${API}/hub-radio`, { accessTokenFactory: () => localStorage.getItem('tokenAgencia') || '' }).withAutomaticReconnect().build();
    const c = new RadioClient({ hub, media: radioMedia, update: setEstado,
      config: async (voz = false) => {
        const r = await fetch(`${API}/api/Radio/config?voz=${voz}`, { headers: { Authorization: `Bearer ${localStorage.getItem('tokenAgencia')}` } });
        if (!r.ok) throw new Error('Sessão indisponível. Entre novamente.'); return r.json();
      },
      invite: chamada => {
        beep.current ??= new Audio(`${import.meta.env.BASE_URL}sounds/radio-bipe.wav`); beep.current.play().catch(() => {});
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          const n = new Notification(`Rádio · ${chamada.origem.nome}`, { body: 'Bipe! Abra o painel para atender.', tag: `radio-${chamada.id}` });
          n.onclick = () => { window.focus(); n.close(); };
        }
      },
    });
    client.current = c; c.start();
    const release = () => c.release();
    window.addEventListener('blur', release); document.addEventListener('visibilitychange', release);
    return () => { window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', release); client.current = null; c.dispose(); setEstado(vazio); };
  }, [ativo, token]);
  const call = estado.chamada, incoming = call?.status === 'Tocando' && call.destino.chave === estado.eu?.chave;
  const other = call?.origem.chave === estado.eu?.chave ? call?.destino : call?.origem;
  const falando = !!call?.falante && call.falante === estado.eu?.chave;
  const aberto = ativo && (!!call || !!estado.erro || estado.preparando);
  useEffect(() => { if (aberto) botao.current?.focus(); }, [aberto]);
  return <RadioContext.Provider value={{ chamar: (perfil, id) => client.current?.call(perfil, id), estado }}>
    {children}
    {aberto && createPortal(<div className="radio-backdrop">
      <section className="radio-card" role="dialog" aria-modal="true" aria-labelledby="radio-titulo" onKeyDown={e => {
        if (e.key === 'Escape') client.current?.end();
        if (e.key === 'Tab') { const focus = [...e.currentTarget.querySelectorAll('button:not([disabled])')]; const next = e.shiftKey ? focus.at(-1) : focus[0]; if (document.activeElement === (e.shiftKey ? focus[0] : focus.at(-1))) { e.preventDefault(); next?.focus(); } }
      }}>
        <div className="radio-mark"><RadioIcon /></div><small>RÁDIO PRIVADO</small><h2 id="radio-titulo">{other?.nome || 'Rádio'}</h2>
        {call && <p aria-live="polite">{call.status === 'Tocando' ? incoming ? 'Quer falar com você' : 'Bipando… aguardando resposta' : call.status === 'Ativa' ? falando ? 'Você está falando' : call.falante ? `${other?.nome} está falando` : 'Canal livre' : 'Conectando áudio…'}</p>}
        {estado.preparando && <p>Preparando microfone…</p>}
        {estado.erro && <p className="radio-error" role="alert">{estado.erro}</p>}
        {incoming ? <button className="radio-accept" disabled={estado.preparando} onClick={() => client.current?.accept()}>Atender bipe</button> : call?.status === 'Ativa' && <>
          <button className={`radio-talk ${falando ? 'speaking' : ''}`} aria-label="Segure para falar no rádio" onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); client.current?.press(); }}
            onPointerUp={() => client.current?.release()} onPointerCancel={() => client.current?.release()} onLostPointerCapture={() => client.current?.release()} onBlur={() => client.current?.release()}
            onKeyDown={e => { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); if (!e.repeat) client.current?.press(); } }} onKeyUp={e => { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); client.current?.release(); } }}>
            <RadioIcon />{falando ? 'Falando…' : 'Segure para falar'}
          </button><span className="radio-help">Solte para ouvir · até 20 s por fala</span>
        </>}
        <button ref={botao} className="radio-end" onClick={() => client.current?.end()}>{call ? incoming ? 'Recusar' : 'Encerrar rádio' : 'Fechar'}</button>
      </section>
    </div>, document.body)}
  </RadioContext.Provider>;
}
export function RadioIcon() { return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="6" y="8" width="12" height="13" rx="3"/><path d="M9 8V3m6 5V6M9 12h6m-6 4h6M3 7a8 8 0 0 1 0-4m18 4a8 8 0 0 0 0-4"/></svg>; }

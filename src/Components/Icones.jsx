// Ícones de áudio no mesmo desenho do app do motorista (microfone e lixeira).
export function IconeMicrofone({ tamanho = 20, className = '' }) {
  return (
    <svg className={`icone ${className}`} viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 15.25a3.75 3.75 0 0 0 3.75-3.75V5.75a3.75 3.75 0 0 0-7.5 0v5.75A3.75 3.75 0 0 0 12 15.25Z" />
      <path d="M18.5 11.25a1 1 0 1 0-2 0 4.5 4.5 0 0 1-9 0 1 1 0 1 0-2 0 6.5 6.5 0 0 0 5.5 6.42V20.5H8.75a1 1 0 1 0 0 2h6.5a1 1 0 1 0 0-2H13v-2.83a6.5 6.5 0 0 0 5.5-6.42Z" />
    </svg>
  );
}

export function IconeLixeira({ tamanho = 20, className = '' }) {
  return (
    <svg className={`icone ${className}`} viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

// Alerta (BIP BIP ALERTA): bola vermelha com "riscos vibrantes" dos dois lados, igual ao app do motorista.
export function IconeAlerta({ tamanho = 22, cor = '#dc2626', className = '' }) {
  return (
    <svg className={`icone ${className}`} viewBox="0 0 32 20" width={tamanho * 1.6} height={tamanho} aria-hidden="true" focusable="false">
      <circle cx="16" cy="10" r="4.6" fill={cor} />
      <path d="M10.6 5.4a6.5 6.5 0 0 0 0 9.2M7 2.6a10.5 10.5 0 0 0 0 14.8M21.4 5.4a6.5 6.5 0 0 1 0 9.2M25 2.6a10.5 10.5 0 0 1 0 14.8" fill="none" stroke={cor} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

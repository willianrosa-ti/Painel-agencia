import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FeedbackContext } from './FeedbackContext';
import './Feedback.css';

const TITULOS_PADRAO = {
  sucesso: 'Tudo certo',
  erro: 'Não foi possível concluir',
  aviso: 'Atenção',
  info: 'Informação'
};

function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmacao, setConfirmacao] = useState(null);
  const toastIdRef = useRef(0);
  const resolverConfirmacaoRef = useRef(null);

  const removerToast = useCallback((id) => {
    setToasts((listaAtual) => listaAtual.filter((toast) => toast.id !== id));
  }, []);

  const mostrarToast = useCallback(
    ({ tipo = 'info', titulo, mensagem, duracao = 4800 }) => {
      const id = toastIdRef.current + 1;
      toastIdRef.current = id;

      setToasts((listaAtual) =>
        [
          ...listaAtual,
          {
            id,
            tipo,
            titulo: titulo || TITULOS_PADRAO[tipo] || TITULOS_PADRAO.info,
            mensagem
          }
        ].slice(-4)
      );

      if (duracao > 0) {
        window.setTimeout(() => removerToast(id), duracao);
      }

      return id;
    },
    [removerToast]
  );

  const sucesso = useCallback(
    (mensagem, titulo = TITULOS_PADRAO.sucesso) =>
      mostrarToast({ tipo: 'sucesso', titulo, mensagem }),
    [mostrarToast]
  );

  const erro = useCallback(
    (mensagem, titulo = TITULOS_PADRAO.erro) =>
      mostrarToast({ tipo: 'erro', titulo, mensagem, duracao: 6800 }),
    [mostrarToast]
  );

  const aviso = useCallback(
    (mensagem, titulo = TITULOS_PADRAO.aviso) =>
      mostrarToast({ tipo: 'aviso', titulo, mensagem }),
    [mostrarToast]
  );

  const info = useCallback(
    (mensagem, titulo = TITULOS_PADRAO.info) =>
      mostrarToast({ tipo: 'info', titulo, mensagem }),
    [mostrarToast]
  );

  const confirmar = useCallback((opcoes = {}) => {
    if (resolverConfirmacaoRef.current) {
      resolverConfirmacaoRef.current(false);
    }

    return new Promise((resolve) => {
      resolverConfirmacaoRef.current = resolve;
      setConfirmacao({
        titulo: opcoes.titulo || 'Confirmar ação',
        mensagem: opcoes.mensagem || 'Deseja continuar?',
        textoConfirmar: opcoes.textoConfirmar || 'Confirmar',
        textoCancelar: opcoes.textoCancelar || 'Cancelar',
        tipo: opcoes.tipo || 'padrao'
      });
    });
  }, []);

  const fecharConfirmacao = useCallback((resultado) => {
    if (resolverConfirmacaoRef.current) {
      resolverConfirmacaoRef.current(resultado);
      resolverConfirmacaoRef.current = null;
    }

    setConfirmacao(null);
  }, []);

  useEffect(() => {
    if (!confirmacao) return undefined;

    const fecharComEsc = (evento) => {
      if (evento.key === 'Escape') {
        fecharConfirmacao(false);
      }
    };

    document.addEventListener('keydown', fecharComEsc);

    return () => document.removeEventListener('keydown', fecharComEsc);
  }, [confirmacao, fecharConfirmacao]);

  useEffect(() => {
    return () => {
      if (resolverConfirmacaoRef.current) {
        resolverConfirmacaoRef.current(false);
      }
    };
  }, []);

  const valorContexto = useMemo(
    () => ({
      toast: mostrarToast,
      sucesso,
      erro,
      aviso,
      info,
      confirmar
    }),
    [aviso, confirmar, erro, info, mostrarToast, sucesso]
  );

  return (
    <FeedbackContext.Provider value={valorContexto}>
      {children}

      <div className="feedback-toast-area" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`feedback-toast feedback-toast--${toast.tipo}`}
            role={toast.tipo === 'erro' ? 'alert' : 'status'}
          >
            <span className="feedback-toast__marcador" aria-hidden="true" />

            <div className="feedback-toast__conteudo">
              <strong>{toast.titulo}</strong>
              {toast.mensagem && <p>{toast.mensagem}</p>}
            </div>

            <button
              type="button"
              className="feedback-toast__fechar"
              onClick={() => removerToast(toast.id)}
              aria-label="Fechar notificação"
            >
              x
            </button>
          </div>
        ))}
      </div>

      {confirmacao && (
        <div className="feedback-modal-fundo">
          <div
            className={`feedback-modal feedback-modal--${confirmacao.tipo}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-titulo"
          >
            <div className="feedback-modal__cabecalho">
              <span className="feedback-modal__marcador" aria-hidden="true" />
              <h2 id="feedback-modal-titulo">{confirmacao.titulo}</h2>
            </div>

            <p className="feedback-modal__mensagem">{confirmacao.mensagem}</p>

            <div className="feedback-modal__acoes">
              <button
                type="button"
                className="feedback-modal__botao feedback-modal__botao--secundario"
                onClick={() => fecharConfirmacao(false)}
              >
                {confirmacao.textoCancelar}
              </button>

              <button
                type="button"
                className="feedback-modal__botao feedback-modal__botao--principal"
                onClick={() => fecharConfirmacao(true)}
              >
                {confirmacao.textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export default FeedbackProvider;

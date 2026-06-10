import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { KeepAwake } from '@capacitor-community/keep-awake';
import AppOverlay from '../Native/Overlay';

function detectarIos() {
  const userAgent = window.navigator.userAgent || '';
  const plataforma = window.navigator.platform || '';

  return /iPad|iPhone|iPod/i.test(userAgent) ||
    (plataforma === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function detectarMobile() {
  return detectarIos() || /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(window.navigator.userAgent || '');
}

function detectarStandalone() {
  return window.navigator.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true;
}

function NativeAppSetup() {
  useEffect(() => {
    let ativo = true;
    const plataformaNativa = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : null;
    const ehNativo = Boolean(plataformaNativa);
    const ehIos = plataformaNativa === 'ios' || detectarIos();
    const ehMobile = ehNativo || detectarMobile();
    const ehStandalone = ehNativo || detectarStandalone();

    const atualizarAlturaViewport = () => {
      const altura = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--app-viewport-height', `${altura}px`);
    };

    document.body.classList.toggle('app-agencia-nativo', ehNativo);
    document.body.classList.toggle('app-agencia-mobile', ehMobile);
    document.body.classList.toggle('app-agencia-ios', ehIos);
    document.body.classList.toggle('app-agencia-standalone', ehStandalone);

    atualizarAlturaViewport();
    window.addEventListener('resize', atualizarAlturaViewport);
    window.addEventListener('orientationchange', atualizarAlturaViewport);
    window.visualViewport?.addEventListener('resize', atualizarAlturaViewport);

    async function limparCacheWebDoApp() {
      try {
        if ('serviceWorker' in navigator) {
          const registros = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registros.map((registro) => registro.unregister()));
        }

        if ('caches' in window) {
          const chaves = await caches.keys();
          await Promise.all(chaves.map((chave) => caches.delete(chave)));
        }
      } catch (erro) {
        console.warn('[APP NATIVO] Nao foi possivel limpar o cache web:', erro);
      }
    }

    async function configurarSobreposicao() {
      try {
        const suporte = await AppOverlay.isSupported();
        if (!suporte?.isSupported) return;

        const permissao = await AppOverlay.hasPermission();
        if (permissao?.granted) {
          await AppOverlay.showOverlay({
            label: localStorage.getItem('nomeAgencia') || 'MIL-LIN'
          });
          return;
        }

        if (!localStorage.getItem('permissaoSobreposicaoSolicitada')) {
          localStorage.setItem('permissaoSobreposicaoSolicitada', 'true');
          await AppOverlay.requestPermission();
        }
      } catch (erro) {
        console.warn('[APP NATIVO] Nao foi possivel configurar a sobreposicao:', erro);
      }
    }

    async function configurarAppNativo() {
      if (!ehNativo) return;

      try {
        await limparCacheWebDoApp();
        await ScreenOrientation.unlock();

        const suporte = await KeepAwake.isSupported();
        if (ativo && suporte.isSupported) {
          await KeepAwake.keepAwake();
        }

        if (ativo) {
          await configurarSobreposicao();
        }
      } catch (erro) {
        console.warn('[APP NATIVO] Não foi possível aplicar recursos nativos:', erro);
      }
    }

    configurarAppNativo();

    return () => {
      ativo = false;
      document.body.classList.remove('app-agencia-nativo');
      document.body.classList.remove('app-agencia-mobile');
      document.body.classList.remove('app-agencia-ios');
      document.body.classList.remove('app-agencia-standalone');
      window.removeEventListener('resize', atualizarAlturaViewport);
      window.removeEventListener('orientationchange', atualizarAlturaViewport);
      window.visualViewport?.removeEventListener('resize', atualizarAlturaViewport);
    };
  }, []);

  return null;
}

export default NativeAppSetup;

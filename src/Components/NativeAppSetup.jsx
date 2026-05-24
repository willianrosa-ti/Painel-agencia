import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { KeepAwake } from '@capacitor-community/keep-awake';
import AppOverlay from '../Native/Overlay';

function NativeAppSetup() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let ativo = true;
    document.body.classList.add('app-agencia-nativo');

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
    };
  }, []);

  return null;
}

export default NativeAppSetup;

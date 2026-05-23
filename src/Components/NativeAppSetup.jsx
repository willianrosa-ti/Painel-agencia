import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { KeepAwake } from '@capacitor-community/keep-awake';

function NativeAppSetup() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let ativo = true;

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

    async function configurarAppNativo() {
      try {
        await limparCacheWebDoApp();
        await ScreenOrientation.unlock();

        const suporte = await KeepAwake.isSupported();
        if (ativo && suporte.isSupported) {
          await KeepAwake.keepAwake();
        }
      } catch (erro) {
        console.warn('[APP NATIVO] Não foi possível aplicar recursos nativos:', erro);
      }
    }

    configurarAppNativo();

    return () => {
      ativo = false;
    };
  }, []);

  return null;
}

export default NativeAppSetup;

# Mobile app

Este projeto agora tem tres caminhos usando a mesma base React:

- Web desktop: `npm run dev`
- PWA instalavel: `npm run build` e publicar a pasta `dist`
- Android com Capacitor: pasta `android/`
- iPhone/iPad: PWA pelo Safari ou Capacitor iOS em um Mac com Xcode

## PWA

O PWA e gerado pelo Vite durante:

```bash
npm run build
```

Depois de publicar o `dist` em HTTPS, o cliente pode abrir pelo celular e usar a opcao de adicionar a tela inicial.

## Android

Requisitos da maquina:

- Android Studio instalado
- JDK configurado no PATH ou em `JAVA_HOME`
- Android SDK instalado pelo Android Studio

Com os requisitos prontos:

```bash
npm run android:sync
npm run android:open
```

Para gerar um APK de teste:

```bash
npm run android:build:debug
```

O APK debug fica em:

```txt
android/app/build/outputs/apk/debug/app-debug.apk
```

Para gerar AAB de publicacao:

```bash
npm run android:build:release
```

O AAB fica em:

```txt
android/app/build/outputs/bundle/release/app-release.aab
```

Antes de publicar na Play Store, configure assinatura de release no Android Studio.

## iPhone / iPad

O painel esta preparado para iPhone como PWA. Publique o `dist` em HTTPS, abra no Safari e use a opcao de adicionar a Tela de Inicio.

Notificacoes push no iPhone funcionam quando o painel esta instalado na Tela de Inicio e o usuario toca em `Ativar push` no sino de notificacoes. O backend precisa estar com `WebPush:PublicKey`, `WebPush:PrivateKey` e `WebPush:Subject` configurados no ambiente.

Para criar o app iOS nativo com Capacitor, use um Mac com Xcode:

```bash
npm run ios:add
npm run ios:sync
npm run ios:open
```

No Xcode, configure o time de assinatura, Bundle Identifier e gere o arquivo para TestFlight/App Store. No Windows nao e possivel gerar `.ipa` porque a Apple exige Xcode/macOS.

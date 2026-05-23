# Mobile app

Este projeto agora tem tres caminhos usando a mesma base React:

- Web desktop: `npm run dev`
- PWA instalavel: `npm run build` e publicar a pasta `dist`
- Android com Capacitor: pasta `android/`

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

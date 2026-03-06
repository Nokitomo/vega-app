![vega-high-resolution-logo-transparent](./assets/readme/vega-high-resolution-logo-transparent.png)

# Vega-App
App Android e iOS per lo streaming di contenuti multimediali.
### Funzionalita
- Streaming e download senza pubblicita.
- Provider/sorgenti multipli.
- Sottotitoli e opzioni stream multiple quando disponibili.
- WatchList.
- Supporto player esterni e downloader.
- Provider dinamici con aggiornamenti automatici.
- Interfaccia in inglese e italiano (i18n).
<br>

[![Discord](https://custom-icon-badges.demolab.com/badge/-Join_Discord-6567a5?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/cr42m6maWy)

___

## Download  ![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/Nokitomo/vega-app/total?link=https%3A%2F%2Fgithub.com%2FNokitomo%2Fvega-app%2Freleases)
> <sub>Scarica la versione Universal se non sai scegliere tra armeabi-v7a o arm64-v8a.</sub>

[![Download Apk](https://custom-icon-badges.demolab.com/badge/-Download_Apk-blue?style=for-the-badge&logo=download&logoColor=white "Download Apk")](https://github.com/Nokitomo/vega-app/releases/latest)

<br>

## Screenshot
![Screenshots](https://github.com/user-attachments/assets/b86af756-e66e-4ae7-b2af-61b25cfd8d4e)

___

## Stack
<p align="left">
     
[![React-Native](https://custom-icon-badges.demolab.com/badge/-React_Native-287aad?style=for-the-badge&logo=react&logoColor=white)](https://reactnative.dev/)
[![TypeScript](https://custom-icon-badges.demolab.com/badge/Typescript-3078C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NativeWind](https://custom-icon-badges.demolab.com/badge/Native_Wind-0CA6E9?style=for-the-badge&logo=tailwind&logoColor=white)](https://www.nativewind.dev/)
[![React-Navigation](https://custom-icon-badges.demolab.com/badge/React_Navigation-6838d9?style=for-the-badge&logo=menu&logoColor=white)](https://reactnavigation.org/)
[![Expo-Modules](https://custom-icon-badges.demolab.com/badge/Expo_Modules-black?style=for-the-badge&logo=expo&logoColor=white)](https://docs.expo.dev/modules/overview/)
[![React-Native-Video](https://custom-icon-badges.demolab.com/badge/React_native_video-38d9c9?style=for-the-badge&logo=video&logoColor=white)](https://thewidlarzgroup.github.io/react-native-video/)
[![MMKV-Storage](https://custom-icon-badges.demolab.com/badge/MMKV_Storage-yellow?style=for-the-badge&logo=zap&logoColor=white)](https://github.com/mrousavy/react-native-mmkv)



</p>

## Build e sviluppo
0. Configura l'ambiente React Native se non lo hai gia fatto. [Guida](https://reactnative.dev/docs/set-up-your-environment)

1. Clona
     ```bash
     git clone https://github.com/Nokitomo/vega-app.git
     ```
     ```bash
     cd vega-app
     ```
2. Installa
     ```bash
     npm install
     ```
3. Avvia Metro (dev client)
     ```bash
     npx expo start -c --dev-client --scheme com.vega --port 8081
     ```
4. Avvia Android (dev client)
     ```bash
     npx expo run:android --device "Medium_phone_API_35"
     ```
5. Avvia iOS (dev client)
     ```bash
     npx expo run:ios
     ```
6. Prebuild pulito (se necessario, ma puo sovrascrivere customizzazioni native)
     ```bash
     npx expo prebuild -p android --clean
     npx expo prebuild -p ios --clean
     ```

Nota: Expo Go non e supportato per le funzionalita native.

Build apk/aab
https://reactnative.dev/docs/signed-apk-android

---
> [!IMPORTANT]
> Vega App non memorizza alcun file multimediale sui propri server e non e direttamente collegata ai media. Tutti i media sono ospitati da servizi di terze parti e Vega App fornisce solo uno strumento di ricerca e web scraping che indicizza dati pubblicamente disponibili. Non siamo responsabili dei contenuti o della disponibilita dei media, poiche non li ospitiamo ne li controlliamo.


## Stelle
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Nokitomo/vega-app&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Nokitomo/vega-app&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Nokitomo/vega-app&type=Date" />
 </picture>
</a>

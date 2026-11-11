# Boom Desktop

Application de bureau (Windows et macOS) de **Boom — Films & Séries**.

C'est une coquille [Electron](https://www.electronjs.org/) qui charge le site hébergé
**https://boomplay.live**. Il n'y a aucun serveur embarqué : chaque déploiement de
[deployapp](https://github.com/RICKOLLAS12/deployapp) est visible tout de suite par les
utilisateurs, sans nouvelle version de l'application.

## Télécharger

- Page de téléchargement : https://boomplay.live/download
- Ou directement dans les [Releases](https://github.com/RICKOLLAS12/BoomDesktop/releases/latest) :

| Plateforme | Fichier |
|---|---|
| Windows | `Boom-Setup-<version>.exe` |
| macOS Apple Silicon (M1/M2/M3/M4) | `Boom-<version>-mac-arm64.dmg` |
| macOS Intel | `Boom-<version>-mac-x64.dmg` |

> **Version minimale : 1.1.1.** La 1.1.0 ouvrait des fenêtres en boucle sous Windows
> (voir [Historique](#historique)). Si elle est installée, désinstalle-la puis installe la dernière version.

### Premier lancement

- **Windows** : l'installeur n'est pas signé, SmartScreen peut afficher « application non reconnue ».
  Clique sur *Informations complémentaires*, puis *Exécuter quand même*.
- **macOS** : l'application n'est pas signée par Apple. Clic droit sur Boom, puis *Ouvrir*.

## Développement

```bash
npm install
npm start                          # ouvre https://boomplay.live
BOOM_URL=http://localhost:3000 npm start   # pointe vers un autre hôte (ex. deployapp en local)
```

### Structure

| Fichier | Rôle |
|---|---|
| `electron/main.js` | Processus principal : splash, fenêtre, instance unique, auto-update |
| `electron/preload.js` | Expose `window.electronApp` (version, événements de mise à jour) |
| `electron/splash.html` | Écran de démarrage |
| `electron/offline.html` | Page « Connexion impossible » avec réessai automatique toutes les 5 s |
| `build/adhoc-sign.js` | Hook `afterPack` : signature ad-hoc de l'app macOS |
| `build/icon.ico`, `build/icon.png` | Icônes (l'`.icns` macOS est généré depuis le PNG) |

Comportement à connaître :

- **Instance unique** (`requestSingleInstanceLock`) : un second lancement ramène la fenêtre existante.
- Les liens vers un autre domaine que `boomplay.live` s'ouvrent dans le navigateur. Les redirections
  de la fenêtre (connexion Google par exemple) ne sont pas bloquées.
- L'application a besoin d'internet. Sans connexion, la page hors-ligne s'affiche puis recharge le site dès que possible.

## Construire

Les installeurs sortent dans `dist/`.

```bash
# Windows (x64), construit depuis Windows ou macOS
npm run build:win

# macOS, Intel et Apple Silicon
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --x64 --arm64
```

`CSC_IDENTITY_AUTO_DISCOVERY=false` est nécessaire : sans lui, `electron-builder` prend un certificat
« Apple Development » du trousseau s'il en trouve un, ce qui est inutile pour distribuer (et échoue si
le certificat est révoqué). Le hook `build/adhoc-sign.js` signe ensuite l'app en ad-hoc, sinon un Mac
Apple Silicon refuse de la lancer (« endommagée »).

## Publier une version

1. Mettre à jour le numéro de version **aux deux endroits** : `package.json` et `electron/preload.js`
   (`version` exposée à la page).
2. Construire Windows et macOS (voir ci-dessus).
3. Renommer le `.exe` pour qu'il corresponde à `latest.yml` : `Boom Setup X.Y.Z.exe` → `Boom-Setup-X.Y.Z.exe`
   (idem pour le `.blockmap`).
4. Créer la release GitHub `vX.Y.Z` avec : `Boom-Setup-X.Y.Z.exe`, `Boom-Setup-X.Y.Z.exe.blockmap`,
   `latest.yml`, `Boom-X.Y.Z-mac-arm64.dmg`, `Boom-X.Y.Z-mac-x64.dmg`.

```bash
gh release create vX.Y.Z Boom-Setup-X.Y.Z.exe Boom-Setup-X.Y.Z.exe.blockmap latest.yml \
  Boom-X.Y.Z-mac-arm64.dmg Boom-X.Y.Z-mac-x64.dmg --latest --title "vX.Y.Z"
```

### Lien avec le site

La route `GET /api/desktop` de deployapp redirige vers la dernière release, d'après le **nom** des fichiers :

| URL | Fichier choisi |
|---|---|
| `/api/desktop` | `*.exe` |
| `/api/desktop?os=mac&arch=arm64` | `*-mac-arm64.dmg` |
| `/api/desktop?os=mac&arch=x64` | `*-mac-x64.dmg` |

Ne change donc pas ces suffixes. La route ignore toute release inférieure à 1.1.1.

### Mises à jour automatiques

- **Windows** : `electron-updater` lit `latest.yml` sur GitHub, 5 secondes après l'ouverture de la fenêtre
  (application installée uniquement).
- **macOS** : pas de mise à jour automatique, car elle exige une application signée et notarisée
  (compte Apple Developer). Il faut réinstaller le `.dmg`. Le contenu du site, lui, est toujours à jour.

## Historique

- **1.1.1** : corrige l'ouverture de fenêtres en boucle sous Windows. Le serveur embarqué est supprimé :
  l'application charge `https://boomplay.live`. Ajout de l'instance unique, de la page hors-ligne et des builds macOS.
- **1.1.0** : version défectueuse. Elle lançait `process.execPath` (c'est-à-dire `Boom.exe`) pour démarrer
  un serveur Next.js embarqué, sans `ELECTRON_RUN_AS_NODE` : chaque instance en relançait une autre.
  Le serveur contenait en plus un `.env` (base de données, JWT, Monetbil) et des binaires macOS inutilisables sous Windows.

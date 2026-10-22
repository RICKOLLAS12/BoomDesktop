const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

// Boom is a thin shell around the hosted site: every deployment of the web app reaches
// desktop users immediately, and no server, database credential or native binary
// is shipped in the installer. BOOM_URL is only meant for testing against another host.
const APP_URL = process.env.BOOM_URL || "https://boomplay.live";
const APP_ORIGIN = new URL(APP_URL).origin;
let mainWindow = null;
let splashWindow = null;

// ─── Auto-updater config ─────────────────────────────────────────
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on("update-available", (info) => {
  if (mainWindow) {
    mainWindow.webContents.send("update-available", info.version);
  }
});

autoUpdater.on("update-downloaded", () => {
  if (mainWindow) {
    mainWindow.webContents.send("update-downloaded");
  }
});

autoUpdater.on("error", (err) => {
  console.error("AutoUpdater error:", err.message);
});

ipcMain.on("install-update", () => {
  autoUpdater.quitAndInstall();
});

// ─── Splash screen ───────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.center();
}

// ─── Main window ─────────────────────────────────────────────────
function createMain() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: "Boom",
    backgroundColor: "#0D0D0D",
    icon: path.join(__dirname, "..", "build", "icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL(APP_URL);

  // Offline / site unreachable: show a retry page instead of a blank window.
  // errorCode -3 is a navigation aborted by a redirect, not a real failure.
  mainWindow.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    console.error(`[boom] failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    mainWindow.loadFile(path.join(__dirname, "offline.html"), { query: { url: APP_URL } });
  });

  mainWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();

    // Check for updates 5 seconds after launch (not packaged = dev mode)
    if (app.isPackaged) {
      setTimeout(() => autoUpdater.checkForUpdates(), 5000);
    }
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin !== APP_ORIGIN) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ─── App lifecycle ────────────────────────────────────────────────
// Only one Boom at a time: a second launch focuses the existing window instead of
// opening another one (and a stray extra instance can never pile up).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  if (!gotLock) return;
  createSplash();
  createMain();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createMain();
});

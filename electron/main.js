const { app, BrowserWindow, shell, session, ipcMain, Notification } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const { autoUpdater } = require("electron-updater");

const PORT = 3210;
let mainWindow = null;
let splashWindow = null;
let serverProcess = null;

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
      session: session.defaultSession,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

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
    if (!url.startsWith(`http://localhost:${PORT}`)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ─── Start Next.js server ────────────────────────────────────────
function startServer() {
  const serverDir = app.isPackaged
    ? path.join(process.resourcesPath, "server")
    : path.join(__dirname, "..", "server");

  const serverScript = path.join(serverDir, "server.js");

  serverProcess = spawn(process.execPath, [serverScript], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
    },
    cwd: serverDir,
  });

  serverProcess.stdout?.on("data", (d) => console.log("[server]", d.toString().trim()));
  serverProcess.stderr?.on("data", (d) => console.error("[server]", d.toString().trim()));
}

// ─── Wait until Next.js is ready ────────────────────────────────
function waitForServer(retries = 30, delay = 500) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http.get(`http://localhost:${PORT}`, (res) => {
        if (res.statusCode < 500) resolve();
        else setTimeout(attempt, delay);
      }).on("error", () => {
        if (retries-- <= 0) reject(new Error("Server did not start"));
        else setTimeout(attempt, delay);
      });
    };
    attempt();
  });
}

// ─── App lifecycle ────────────────────────────────────────────────
app.whenReady().then(async () => {
  createSplash();
  startServer();

  try {
    await waitForServer();
  } catch {
    console.error("Server failed to start");
  }

  createMain();
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) serverProcess.kill();
});

app.on("activate", () => {
  if (!mainWindow) createMain();
});

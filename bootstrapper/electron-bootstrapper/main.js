/**
 * RobBob Bootstrapper - Minimal Launcher
 *
 * This small app:
 * 1. Checks if RobBob is installed locally
 * 2. Downloads/updates RobBob files from server
 * 3. Runs the main RobBob application with admin rights
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn, exec } = require('child_process');

// ============================================
// CONFIGURATION - CHANGE THESE URLs
// ============================================
const CONFIG = {
  // URL to version.json on your server
  versionUrl: 'http://185.185.142.190/robbob/version.json',
  
  // URL to download RobBob app archive
  appDownloadUrl: 'http://185.185.142.190/robbob/RobBob-App.zip',
  
  // Local paths
  appFolder: 'RobBob',                       // Folder name for app files
  appExecutable: 'RobBob Launcher.exe',      // Main executable name (matches productName in package.json)
  versionFile: 'version.txt'                 // Local version file
};

let mainWindow;
let isDownloading = false;
let customInstallPath = null; // User-selected custom install path

// Get paths - uses custom path if set, otherwise default AppData
function getAppDataPath() {
  if (customInstallPath) {
    return path.join(customInstallPath, CONFIG.appFolder);
  }
  return path.join(app.getPath('userData'), '..', CONFIG.appFolder);
}

// Get default install path for display
function getDefaultInstallPath() {
  return path.join(app.getPath('userData'), '..', CONFIG.appFolder);
}

function getLocalVersionPath() {
  return path.join(getAppDataPath(), CONFIG.versionFile);
}

function getAppExecutablePath() {
  return path.join(getAppDataPath(), CONFIG.appExecutable);
}

// Create window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 340,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('src/index.html');
  mainWindow.center();
}

// Fetch JSON from URL
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, {
      headers: { 'User-Agent': 'RobBob-Bootstrapper' }
    }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchJson(res.headers.location).then(resolve).catch(reject);
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Download file with progress
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    // Ensure directory exists
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const req = protocol.get(url, {
      headers: { 'User-Agent': 'RobBob-Bootstrapper' }
    }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadFile(res.headers.location, destPath, onProgress)
          .then(resolve).catch(reject);
        return;
      }
      
      const totalSize = parseInt(res.headers['content-length'], 10);
      let downloadedSize = 0;
      
      const file = fs.createWriteStream(destPath);
      
      res.on('data', (chunk) => {
        downloadedSize += chunk.length;
        file.write(chunk);
        
        if (totalSize && onProgress) {
          const percent = Math.round((downloadedSize / totalSize) * 100);
          onProgress(percent, downloadedSize, totalSize);
        }
      });
      
      res.on('end', () => {
        file.end();
        resolve();
      });
      
      res.on('error', (err) => {
        file.destroy();
        fs.unlinkSync(destPath);
        reject(err);
      });
    });
    
    req.on('error', reject);
  });
}

// Extract ZIP archive using PowerShell
function extractZip(zipPath, destPath) {
  return new Promise((resolve, reject) => {
    // Create destination folder if it doesn't exist
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }
    
    const cmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destPath}' -Force"`;
    
    exec(cmd, { windowsHide: true }, (err) => {
      // Delete zip file after extraction
      try {
        fs.unlinkSync(zipPath);
      } catch (e) {}
      
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Create desktop shortcut to BOOTSTRAPPER (not the main app)
// This ensures users always get update checks when launching
function createDesktopShortcut() {
  return new Promise((resolve, reject) => {
    const desktopPath = path.join(require('os').homedir(), 'Desktop');
    const shortcutPath = path.join(desktopPath, 'RobBob Launcher.lnk');
    
    // Get path to the bootstrapper itself (current executable)
    const bootstrapperPath = app.getPath('exe');
    const bootstrapperDir = path.dirname(bootstrapperPath);
    
    // PowerShell command to create shortcut pointing to BOOTSTRAPPER
    const psCommand = `
      $WshShell = New-Object -comObject WScript.Shell;
      $Shortcut = $WshShell.CreateShortcut('${shortcutPath}');
      $Shortcut.TargetPath = '${bootstrapperPath}';
      $Shortcut.WorkingDirectory = '${bootstrapperDir}';
      $Shortcut.Description = 'RobBob Launcher - Всегда актуальная версия';
      $Shortcut.Save()
    `.replace(/\n/g, ' ');
    
    exec(`powershell -Command "${psCommand}"`, { windowsHide: true }, (err) => {
      if (err) {
        console.error('Failed to create desktop shortcut:', err);
        // Don't fail the whole process if shortcut creation fails
        resolve();
      } else {
        console.log('Desktop shortcut created successfully (pointing to bootstrapper)');
        resolve();
      }
    });
  });
}

// Get local version
function getLocalVersion() {
  try {
    const versionPath = getLocalVersionPath();
    if (fs.existsSync(versionPath)) {
      return fs.readFileSync(versionPath, 'utf-8').trim();
    }
  } catch (e) {}
  return null;
}

// Save local version
function saveLocalVersion(version) {
  try {
    const versionPath = getLocalVersionPath();
    const dir = path.dirname(versionPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(versionPath, version);
  } catch (e) {
    console.error('Failed to save version:', e);
  }
}

// Check if app is installed
function isAppInstalled() {
  return fs.existsSync(getAppExecutablePath());
}

// Run the main app WITH ADMIN RIGHTS
function runApp() {
  const exePath = getAppExecutablePath();
  
  if (!fs.existsSync(exePath)) {
    sendStatus('error', 'Приложение не найдено');
    return;
  }
  
  sendStatus('status', 'Запуск с правами администратора...');
  
  // Launch with admin rights using PowerShell Start-Process -Verb RunAs
  // This will trigger UAC prompt if needed
  const child = spawn('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Start-Process -FilePath "${exePath}" -ArgumentList "--elevated" -Verb RunAs -WorkingDirectory "${getAppDataPath()}"`
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  
  child.unref();
  
  // Close bootstrapper after short delay
  setTimeout(() => {
    app.quit();
  }, 1000);
}

// Send status to renderer
function sendStatus(type, message, progress = null) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('status', { type, message, progress });
  }
}

// Main bootstrap process
async function bootstrap() {
  try {
    sendStatus('status', 'Проверка обновлений...');
    
    // Get server version
    let serverVersion = null;
    let downloadUrl = CONFIG.appDownloadUrl;
    
    try {
      const versionInfo = await fetchJson(CONFIG.versionUrl);
      serverVersion = versionInfo.version;
      if (versionInfo.downloadUrl) {
        downloadUrl = versionInfo.downloadUrl;
      }
    } catch (e) {
      console.log('Failed to fetch version info:', e.message);
      // If we can't reach server but app is installed, just run it
      if (isAppInstalled()) {
        runApp();
        return;
      }
      sendStatus('error', 'Не удалось подключиться к серверу');
      return;
    }
    
    const localVersion = getLocalVersion();
    const needsDownload = !isAppInstalled() || (serverVersion && serverVersion !== localVersion);
    
    if (needsDownload) {
      isDownloading = true;
      
      sendStatus('status', 'Загрузка обновления...', 0);
      
      const tempZip = path.join(app.getPath('temp'), 'robbob-update.zip');
      
      // Download the app
      await downloadFile(downloadUrl, tempZip, (percent) => {
        sendStatus('status', `Загрузка: ${percent}%`, percent);
      });
      
      sendStatus('status', 'Распаковка файлов...', 100);
      
      // Extract
      await extractZip(tempZip, getAppDataPath());
      
      // Save version
      if (serverVersion) {
        saveLocalVersion(serverVersion);
      }
      
      // Create desktop shortcut (points to bootstrapper for auto-updates)
      sendStatus('status', 'Создание ярлыка...', 100);
      await createDesktopShortcut();
      
      isDownloading = false;
    }
    
    // Run the app
    runApp();
    
  } catch (err) {
    console.error('Bootstrap error:', err);
    isDownloading = false;
    sendStatus('error', `Ошибка: ${err.message}`);
  }
}

// IPC handlers
ipcMain.handle('retry', () => {
  bootstrap();
});

// Get current install path
ipcMain.handle('get-install-path', () => {
  return {
    path: getAppDataPath(),
    isCustom: customInstallPath !== null
  };
});

// Get default install path
ipcMain.handle('get-default-path', () => {
  return getDefaultInstallPath();
});

// Select custom install path
ipcMain.handle('select-install-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите папку для установки',
    defaultPath: customInstallPath || getDefaultInstallPath(),
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Выбрать'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    customInstallPath = result.filePaths[0];
    return {
      success: true,
      path: path.join(customInstallPath, CONFIG.appFolder)
    };
  }
  return { success: false };
});

// Reset to default path
ipcMain.handle('reset-install-path', () => {
  customInstallPath = null;
  return {
    path: getAppDataPath()
  };
});

ipcMain.on('window-close', () => {
  app.quit();
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  
  // Start bootstrap after window loads
  mainWindow.webContents.on('did-finish-load', () => {
    bootstrap();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

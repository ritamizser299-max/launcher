const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn, execSync } = require('child_process');
const Store = require('electron-store');
const https = require('https');
const http = require('http');

// Встроенные конфигурации сетевого режима
const { getBypassConfig, getAvailableModes: getEmbeddedModes } = require('./lib/bypass-configs');
// Модуль контроля доступа (Telegram верификация)
const GameFilter = require('./lib/game-filter');
// Конфигурация
const config = require('./lib/config');
// Автоопределение провайдера
const ProviderDetector = require('./lib/provider-detector');

const store = new Store();

// ============================================
// SINGLE INSTANCE LOCK - только один лаунчер
// ============================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Уже запущен другой экземпляр - выходим
  app.quit();
} else {
  // Когда пытаются запустить второй экземпляр - показываем окно первого
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

let mainWindow;
let tray = null;
let winwsProcess = null;

// Проверка прав администратора на Windows (синхронная версия)
function isAdmin() {
  if (process.platform !== 'win32') return true;

  try {
    // Проверка прав через команду net session
    execSync('net session', {
      windowsHide: true,
      stdio: 'ignore'
    });
    return true;
  } catch (e) {
    return false;
  }
}

// Перезапуск приложения с правами администратора
function restartAsAdmin() {
  if (process.platform !== 'win32') return;

  const appPath = app.getPath('exe');

  // Используем PowerShell для запуска с правами админа
  const args = process.argv.slice(1);
  const argsStr = args.map(a => `"${a}"`).join(' ');

  spawn('powershell.exe', [
    '-Command',
    `Start-Process -FilePath "${appPath}" -ArgumentList '${argsStr}' -Verb RunAs`
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });

  app.quit();
}

// Проверяем права администратора при запуске
if (process.platform === 'win32' && !process.argv.includes('--no-admin-check')) {
  // Проверка через создание тестового файла в системной папке
  const testPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'temp', 'admin_test_' + process.pid);

  try {
    fs.writeFileSync(testPath, 'test');
    fs.unlinkSync(testPath);
    // Права есть, продолжаем
  } catch (e) {
    // Нет прав администратора - перезапускаем
    console.log('Requesting administrator privileges...');
    restartAsAdmin();
  }
}

// СРАЗУ убиваем все существующие winws.exe при старте лаунчера
if (process.platform === 'win32') {
  try {
    require('child_process').execSync('taskkill /F /IM winws.exe 2>nul', {
      windowsHide: true,
      stdio: 'ignore'
    });
    console.log('Killed existing winws.exe processes');
  } catch (e) {
    // Процесс не найден - это нормально
  }
}

// Режимы обхода теперь определены в lib/bypass-configs.js

// Путь к встроенному bypass
function getBypassPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bypass');
  }
  return path.join(__dirname, 'resources', 'bypass');
}

function createWindow() {
  // Build window options
  const windowOptions = {
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0b0f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  };

  // Add icon only if it exists
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  
  if (process.platform === 'win32' && fs.existsSync(icoPath)) {
    windowOptions.icon = icoPath;
  } else if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile('src/index.html');

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // Try to load icon, use fallback if not found
  let trayIcon;
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  
  try {
    if (process.platform === 'win32' && fs.existsSync(icoPath)) {
      trayIcon = nativeImage.createFromPath(icoPath);
    } else if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
    } else {
      // Create a simple fallback icon (16x16 purple square)
      trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4jWNgGAWjYBSMglEwCkbBKBgFo2AUDAYAAAPgAAEeqVKiAAAAAElFTkSuQmCC');
    }
  } catch (err) {
    console.error('Error loading tray icon:', err);
    // Create a simple fallback icon
    trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4jWNgGAWjYBSMglEwCkbBKBgFo2AUDAYAAAPgAAEeqVKiAAAAAElFTkSuQmCC');
  }

  try {
    tray = new Tray(trayIcon);
  } catch (err) {
    console.error('Failed to create tray:', err);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Развернуть',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Запустить Roblox',
      click: () => launchRoblox()
    },
    { type: 'separator' },
    {
      label: 'Сетевой режим: Вкл',
      click: () => startBypass()
    },
    {
      label: 'Сетевой режим: Выкл',
      click: () => stopBypass()
    },
    { type: 'separator' },
    {
      label: 'Закрыть',
      click: () => {
        app.isQuitting = true;
        stopBypass();
        app.quit();
      }
    }
  ]);

  tray.setToolTip('RobBob Launcher');
  tray.setContextMenu(contextMenu);

  // Single click shows context menu (default behavior)
  // Double click opens the window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // On single click, also show the window on Windows
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function launchRoblox() {
  shell.openExternal('roblox-player:1+launchmode').catch(err => {
    console.error('Failed to launch Roblox:', err);
  });
}

// Проверка наличия файлов bypass
function checkBypassFiles() {
  const bypassPath = getBypassPath();
  const winwsPath = path.join(bypassPath, 'bin', 'winws.exe');
  try {
    return fs.existsSync(winwsPath);
  } catch (err) {
    return false;
  }
}

// BAT файлы удалены - конфигурации встроены в lib/bypass-configs.js

// ============================================
// ZAPRET / WINWS.EXE - НАДЕЖНАЯ РЕАЛИЗАЦИЯ
// Запуск обхода DPI блокировок
// ============================================

/**
 * Проверка всех необходимых файлов перед запуском
 */
function verifyBypassFiles(bypassPath) {
  const requiredFiles = [
    path.join(bypassPath, 'bin', 'winws.exe'),
    path.join(bypassPath, 'bin', 'WinDivert.dll'),
    path.join(bypassPath, 'bin', 'WinDivert64.sys'),
    path.join(bypassPath, 'lists', 'list-general.txt')
  ];
  
  const missing = [];
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      missing.push(path.basename(file));
    }
  }
  
  if (missing.length > 0) {
    console.error('Missing bypass files:', missing);
    return { ok: false, missing };
  }
  
  return { ok: true };
}

// Аргументы теперь берутся из lib/bypass-configs.js

/**
 * Запуск winws.exe напрямую из лаунчера
 * ВАЖНО: Процесс запускается ВНУТРИ лаунчера без отдельных окон
 * BAT файлы удалены - используем встроенные конфигурации
 */
function startBypassDirect(bypassPath, mode) {
  const winwsPath = path.join(bypassPath, 'bin', 'winws.exe');
  const binPath = path.join(bypassPath, 'bin');
  const listsPath = path.join(bypassPath, 'lists');
  
  // Получаем аргументы из встроенных конфигураций (BAT файлы удалены)
  const config = getBypassConfig(mode, binPath, listsPath);
  const args = config.args;
  
  console.log('Starting winws.exe directly from launcher...');
  console.log('Path:', winwsPath);
  console.log('Args count:', args.length);
  console.log('Mode:', mode);
  
  try {
    // КРИТИЧЕСКИ ВАЖНО: windowsHide: true предотвращает создание окна
    // CREATE_NO_WINDOW флаг гарантирует, что процесс не создает консоль
    winwsProcess = spawn(winwsPath, args, {
      cwd: binPath,  // Рабочая директория - bin/
      windowsHide: true,  // Скрываем окно
      detached: false,    // Привязываем к родительскому процессу (лаунчеру)
      stdio: 'ignore',    // Игнорируем потоки ввода-вывода
      shell: false        // Не используем shell (cmd.exe)
    });
    
    // НЕ используем unref() - процесс должен быть привязан к лаунчеру
    // Когда лаунчер закроется, winws.exe тоже закроется автоматически
    
    winwsProcess.on('error', (err) => {
      console.error('winws.exe spawn error:', err);
      winwsProcess = null;
    });
    
    winwsProcess.on('exit', (code, signal) => {
      console.log(`winws.exe exited with code ${code}, signal ${signal}`);
      winwsProcess = null;
    });
    
    return true;
  } catch (err) {
    console.error('Failed to spawn winws.exe:', err);
    return false;
  }
}

/**
 * Главная функция запуска сетевого режима
 * ВАЖНО: Запускает winws.exe как дочерний процесс лаунчера
 */
function startBypass(mode = null) {
  const bypassPath = getBypassPath();
  const selectedMode = mode || store.get('bypassMode', 'ALT7');

  console.log('=== Starting Network Mode ===');
  console.log('Path:', bypassPath);
  console.log('Mode:', selectedMode);

  // Проверяем подписку через GameFilter
  if (!GameFilter.canStartNetworkMode()) {
    console.log('GameFilter: Access denied - subscription required');
    if (mainWindow) {
      mainWindow.webContents.send('network-status', {
        running: false,
        needsVerification: true,
        error: 'Требуется подтверждение подписки на Telegram канал'
      });
      // Отправляем событие для показа модального окна
      mainWindow.webContents.send('show-telegram-modal');
    }
    return;
  }

  // Проверяем файлы
  const verification = verifyBypassFiles(bypassPath);
  if (!verification.ok) {
    console.error('Network mode files verification failed');
    if (mainWindow) {
      mainWindow.webContents.send('network-status', {
        running: false,
        error: 'Отсутствуют файлы: ' + verification.missing.join(', ')
      });
    }
    return;
  }
  
  // Убиваем существующие процессы
  killAllWinwsSync();
  
  // ВСЕГДА запускаем напрямую из лаунчера - никаких отдельных окон!
  const started = startBypassDirect(bypassPath, selectedMode);
  
  if (!started) {
    console.error('Failed to start bypass');
    if (mainWindow) {
      mainWindow.webContents.send('network-status', {
        running: false,
        error: 'Не удалось запустить обход. Проверьте права администратора.'
      });
    }
    return;
  }
  
  // Проверяем результат через 2 секунды
  setTimeout(async () => {
    const isRunning = await checkBypassRunning();
    
    console.log('Bypass check result:', isRunning);
    store.set('bypassRunning', isRunning);
    
    if (mainWindow) {
      mainWindow.webContents.send('network-status', {
        running: isRunning,
        mode: selectedMode,
        error: isRunning ? null : 'Не удалось запустить обход. Проверьте права администратора.'
      });
    }
  }, 2000);
  
  // Оптимистичное обновление UI
  if (mainWindow) {
    mainWindow.webContents.send('network-status', { running: true, mode: selectedMode });
  }
}

/**
 * Синхронное завершение всех winws процессов
 */
function killAllWinwsSync() {
  try {
    require('child_process').execSync('taskkill /F /IM winws.exe 2>nul', {
      windowsHide: true,
      stdio: 'ignore'
    });
    console.log('Killed existing winws.exe processes');
  } catch (e) {
    // Процесс не найден - это нормально
  }
}

/**
 * Остановка Bypass
 * ВАЖНО: Останавливает процесс winws.exe привязанный к лаунчеру
 */
function stopBypass() {
  console.log('=== Stopping Bypass ===');
  store.set('bypassRunning', false);

  // Убиваем процесс, если есть ссылка на него
  if (winwsProcess && !winwsProcess.killed) {
    try {
      console.log('Killing winws process via reference...');
      winwsProcess.kill('SIGKILL'); // Используем SIGKILL для принудительной остановки
    } catch (err) {
      console.error('Error killing winws process:', err);
    }
  }

  // Дополнительно используем taskkill для гарантии остановки всех экземпляров
  killAllWinwsSync();

  winwsProcess = null;

  if (mainWindow) {
    mainWindow.webContents.send('network-status', { running: false });
  }
}

// Проверка работает ли winws.exe
function checkBypassRunning() {
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq winws.exe" /NH', { windowsHide: true }, (err, stdout) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(stdout.toLowerCase().includes('winws.exe'));
    });
  });
}

// Принудительно завершить все процессы winws.exe
function killAllWinws() {
  return new Promise((resolve) => {
    exec('taskkill /F /IM winws.exe', { windowsHide: true }, (err) => {
      // Игнорируем ошибки - процесс может не существовать
      resolve();
    });
  });
}

// Автозапуск bypass при старте приложения с автоопределением провайдера
async function autoStartBypass() {
  const bypassEnabled = store.get('bypassEnabled', true);
  if (bypassEnabled && checkBypassFiles()) {
    // Проверяем, было ли уже автоопределение провайдера
    const providerDetected = store.get('providerDetected', false);
    
    if (!providerDetected) {
      console.log('First launch - auto-detecting ISP provider...');
      try {
        const recommendation = await ProviderDetector.getRecommendedBypassMode();
        
        if (recommendation.autoDetected) {
          // Сохраняем определенный режим
          store.set('bypassMode', recommendation.mode);
          store.set('detectedProvider', recommendation.provider);
          store.set('providerDetected', true);
          
          console.log('Auto-detected provider:', recommendation.provider);
          console.log('Set optimal mode:', recommendation.mode);
          
          if (mainWindow) {
            mainWindow.webContents.send('provider-detected', {
              provider: recommendation.provider,
              mode: recommendation.mode
            });
          }
        } else {
          // Не удалось определить - используем режим по умолчанию
          store.set('providerDetected', true);
        }
      } catch (error) {
        console.error('Provider detection failed:', error);
      }
    }
    
    // winws.exe уже убит при старте лаунчера, просто запускаем свой
    setTimeout(() => {
      startBypass();
    }, 1000);
  }
}

// Получить список доступных режимов (из встроенных конфигураций)
function getAvailableModes() {
  // BAT файлы удалены - используем встроенные конфигурации
  return getEmbeddedModes();
}

// IPC обработчики
ipcMain.handle('get-settings', () => {
  return {
    theme: store.get('theme', 'dark'),
    bypassEnabled: store.get('bypassEnabled', true),
    bypassMode: store.get('bypassMode', 'ALT7'),
    autostart: store.get('autostart', false),
    minimizeToTray: store.get('minimizeToTray', true),
    robloxProfile: store.get('robloxProfile', null)
  };
});

ipcMain.handle('set-setting', async (event, key, value) => {
  store.set(key, value);

  // Если меняется настройка bypass
  if (key === 'bypassEnabled') {
    if (value) {
      startBypass();
    } else {
      stopBypass();
    }
  }

  // Если меняется режим bypass
  if (key === 'bypassMode') {
    const isEnabled = store.get('bypassEnabled', true);
    if (isEnabled) {
      // Перезапускаем с новым режимом
      stopBypass();
      setTimeout(() => {
        startBypass(value);
      }, 1000);
    }
  }

  return true;
});

ipcMain.handle('launch-roblox', () => {
  launchRoblox();
  return true;
});

// Открыть внешнюю ссылку в браузере
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (err) {
    console.error('Failed to open external URL:', err);
    return false;
  }
});

// Helper function for HTTPS requests
function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

// Получить профиль Roblox по username
ipcMain.handle('get-roblox-profile', async (event, username) => {
  try {
    // Сначала получаем userId по username
    const postData = JSON.stringify({
      usernames: [username],
      excludeBannedUsers: false
    });

    const userIdResponse = await httpsRequest({
      hostname: 'users.roblox.com',
      path: '/v1/usernames/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);

    if (!userIdResponse.data || userIdResponse.data.length === 0) {
      return { success: false, error: 'Пользователь не найден' };
    }

    const userId = userIdResponse.data[0].id;
    const displayName = userIdResponse.data[0].displayName;
    const name = userIdResponse.data[0].name;

    // Получаем детальную информацию о пользователе (дата регистрации)
    const userDetails = await httpsGet(`https://users.roblox.com/v1/users/${userId}`);

    let createdDate = null;
    if (userDetails && userDetails.created) {
      createdDate = userDetails.created;
    }

    // Получаем аватар-headshot (для topbar)
    const headshotResponse = await httpsGet(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
    );

    let headshotUrl = null;
    if (headshotResponse.data && headshotResponse.data.length > 0) {
      headshotUrl = headshotResponse.data[0].imageUrl;
    }

    // Получаем полный аватар (для модального окна)
    const fullAvatarResponse = await httpsGet(
      `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=352x352&format=Png&isCircular=false`
    );

    let fullAvatarUrl = null;
    if (fullAvatarResponse.data && fullAvatarResponse.data.length > 0) {
      fullAvatarUrl = fullAvatarResponse.data[0].imageUrl;
    }

    return {
      success: true,
      userId,
      username: name,
      displayName,
      avatarUrl: headshotUrl,
      fullAvatarUrl: fullAvatarUrl,
      created: createdDate,
      description: userDetails.description || ''
    };

  } catch (err) {
    console.error('Error fetching Roblox profile:', err);
    return { success: false, error: 'Ошибка получения профиля' };
  }
});

ipcMain.handle('start-bypass', (event, mode) => {
  startBypass(mode);
  return true;
});

ipcMain.handle('stop-bypass', () => {
  stopBypass();
  return true;
});

ipcMain.handle('get-network-status', async () => {
  const isRunning = await checkBypassRunning();
  return {
    running: isRunning,
    available: checkBypassFiles(),
    mode: store.get('bypassMode', 'ALT7')
  };
});

ipcMain.handle('get-bypass-modes', () => {
  return getAvailableModes();
});

// Alias for get-network-status (preload.js uses get-bypass-status)
ipcMain.handle('get-bypass-status', async () => {
  const isRunning = await checkBypassRunning();
  return {
    running: isRunning,
    available: checkBypassFiles(),
    mode: store.get('bypassMode', 'ALT7')
  };
});

// ============================================
// TELEGRAM VERIFICATION IPC HANDLERS
// ============================================

// Получить статус Telegram верификации
ipcMain.handle('get-telegram-status', () => {
  return GameFilter.getStatus();
});

// Верифицировать код от Telegram бота
ipcMain.handle('telegram-verify', async (event, code) => {
  const result = await GameFilter.verifyCode(code);
  
  // Если верификация успешна - запускаем сетевой режим
  if (result.success) {
    const bypassEnabled = store.get('bypassEnabled', true);
    if (bypassEnabled) {
      setTimeout(() => startBypass(), 500);
    }
  }
  
  return result;
});

// Получить ссылки на Telegram
ipcMain.handle('get-telegram-links', () => {
  return GameFilter.getLinks();
});

// Сбросить верификацию
ipcMain.handle('telegram-reset', () => {
  GameFilter.reset();
  stopBypass();
  return { success: true };
});

// Обновить статус подписки
ipcMain.handle('telegram-refresh', async () => {
  await GameFilter.refreshSubscriptionStatus();
  return GameFilter.getStatus();
});

// ============================================
// PROVIDER AUTO-DETECTION IPC HANDLERS
// ============================================

// Определить провайдера и получить рекомендуемый режим
ipcMain.handle('detect-provider', async () => {
  try {
    const recommendation = await ProviderDetector.getRecommendedBypassMode();
    
    // Сохраняем результаты автоопределения
    if (recommendation.autoDetected) {
      store.set('detectedProvider', recommendation.provider);
      store.set('bypassMode', recommendation.mode);
      store.set('providerDetected', true);
    }
    
    return recommendation;
  } catch (error) {
    console.error('Provider detection failed:', error);
    return {
      provider: 'default',
      mode: 'ALT7',
      autoDetected: false,
      error: error.message
    };
  }
});

// Получить текущий определенный провайдер
ipcMain.handle('get-detected-provider', () => {
  return {
    provider: store.get('detectedProvider', null),
    mode: store.get('bypassMode', 'ALT7'),
    detected: store.get('providerDetected', false)
  };
});

// Сбросить автоопределение провайдера (для переопределения)
ipcMain.handle('reset-provider-detection', () => {
  store.delete('providerDetected');
  store.delete('detectedProvider');
  return { success: true };
});

// ============================================
// AUTO-UPDATER / DOWNLOADER
// Загрузка компонентов с вашего сервера
// ============================================

// =============================================
// НАСТРОЙКИ СЕРВЕРА - ИЗМЕНИТЕ НА СВОИ URL
// =============================================
const UPDATE_CONFIG = {
  // URL вашего сервера с информацией о версии лаунчера
  // Должен возвращать JSON: { "version": "1.0.0", "downloadUrl": "https://...", "releaseNotes": "..." }
  versionUrl: 'https://your-server.com/api/launcher/version.json',
  
  // URL для скачивания лаунчера (можно указать здесь напрямую или в version.json)
  downloadUrl: 'https://your-server.com/files/RobBob-Setup.exe',
  
  // URL для bypass файлов
  bypassVersionUrl: 'https://your-server.com/api/bypass/version.json',
  bypassDownloadUrl: 'https://your-server.com/files/bypass.zip'
};

const CURRENT_VERSION = require('./package.json').version;

// =============================================
// GITHUB REPOSITORY SETTINGS FOR BYPASS DOWNLOAD
// =============================================
const GITHUB_OWNER = 'yamineki';  // Change to your GitHub username
const GITHUB_REPO = 'roboby-files';  // Change to your repository name
const BYPASS_ASSET_NAME = 'bypass.zip';  // Name of the bypass archive in releases

// ============================================
// SELF-UPDATE SYSTEM
// Обязательная проверка обновлений при запуске
// ============================================

let isUpdating = false;

/**
 * Check if launcher update is available from your server
 */
async function checkForLauncherUpdate() {
  try {
    const versionInfo = await fetchVersionInfo(UPDATE_CONFIG.versionUrl);
    if (!versionInfo || !versionInfo.version) {
      return { hasUpdate: false, error: 'Не удалось проверить обновления' };
    }
    
    const latestVersion = versionInfo.version.replace('v', '');
    const currentVersion = CURRENT_VERSION.replace('v', '');
    
    // Version comparison
    const needsUpdate = compareVersions(latestVersion, currentVersion) > 0;
    
    if (needsUpdate) {
      return {
        hasUpdate: true,
        mandatory: true,  // Обновление обязательно
        currentVersion: CURRENT_VERSION,
        latestVersion: versionInfo.version,
        downloadUrl: versionInfo.downloadUrl || UPDATE_CONFIG.downloadUrl,
        releaseNotes: versionInfo.releaseNotes || ''
      };
    }
    
    return { hasUpdate: false, currentVersion: CURRENT_VERSION };
  } catch (err) {
    console.error('Error checking for updates:', err);
    return { hasUpdate: false, error: err.message };
  }
}

/**
 * Compare semantic versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

/**
 * Fetch version info from your server
 */
function fetchVersionInfo(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'RobBob-Launcher',
        'Accept': 'application/json'
      }
    }, (res) => {
      // Handle redirects
      if (res.statusCode === 302 || res.statusCode === 301) {
        fetchVersionInfo(res.headers.location).then(resolve).catch(reject);
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Download and apply launcher update
 */
async function downloadLauncherUpdate(downloadUrl) {
  if (isUpdating) return { success: false, error: 'Update already in progress' };
  isUpdating = true;
  
  try {
    const tempDir = path.join(app.getPath('temp'), 'robbob-update');
    const zipPath = path.join(tempDir, 'update.zip');
    
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Send progress
    if (mainWindow) {
      mainWindow.webContents.send('update-progress', { percent: 0, status: 'Начало загрузки...' });
    }
    
    // Download update
    await downloadFile(downloadUrl, zipPath, (percent) => {
      if (mainWindow) {
        mainWindow.webContents.send('update-progress', {
          percent: Math.round(percent * 0.7),
          status: `Загрузка: ${Math.round(percent)}%`
        });
      }
    });
    
    if (mainWindow) {
      mainWindow.webContents.send('update-progress', { percent: 75, status: 'Подготовка к установке...' });
    }
    
    // Create update script that will:
    // 1. Wait for launcher to close
    // 2. Extract update
    // 3. Restart launcher
    const appPath = app.getPath('exe');
    const appDir = path.dirname(appPath);
    const updateScript = path.join(tempDir, 'update.bat');
    
    const scriptContent = `
@echo off
echo Updating RobBob Launcher...
timeout /t 2 /nobreak > nul
powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${appDir}' -Force"
del "${zipPath}"
start "" "${appPath}"
del "%~f0"
`;
    
    fs.writeFileSync(updateScript, scriptContent);
    
    if (mainWindow) {
      mainWindow.webContents.send('update-progress', { percent: 90, status: 'Перезапуск...' });
    }
    
    // Run update script and quit
    spawn('cmd.exe', ['/c', updateScript], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();
    
    setTimeout(() => {
      app.quit();
    }, 500);
    
    return { success: true };
    
  } catch (err) {
    console.error('Update error:', err);
    isUpdating = false;
    return { success: false, error: err.message };
  }
}

// IPC handlers for self-update
ipcMain.handle('check-launcher-update', async () => {
  return await checkForLauncherUpdate();
});

ipcMain.handle('download-launcher-update', async (event, downloadUrl) => {
  return await downloadLauncherUpdate(downloadUrl);
});

ipcMain.handle('get-launcher-version', () => {
  return CURRENT_VERSION;
});

// Проверка наличия файлов bypass
ipcMain.handle('check-bypass-files', async () => {
  const bypassPath = getBypassPath();
  const winwsPath = path.join(bypassPath, 'bin', 'winws.exe');

  const exists = fs.existsSync(winwsPath);
  const currentVersion = store.get('bypassVersion', null);

  return {
    exists,
    needsDownload: !exists,
    currentVersion
  };
});

// Скачивание файлов bypass с GitHub
ipcMain.handle('download-bypass-files', async () => {
  try {
    // Отправляем начальный статус
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', {
        percent: 0,
        status: 'Получение информации о релизе...'
      });
    }

    // Получаем информацию о последнем релизе
    const releaseInfo = await getLatestRelease();
    if (!releaseInfo) {
      return { success: false, error: 'Не удалось получить информацию о релизе' };
    }

    // Ищем нужный asset
    const asset = releaseInfo.assets.find(a => a.name === BYPASS_ASSET_NAME);
    if (!asset) {
      return { success: false, error: 'Файл bypass.zip не найден в релизе' };
    }

    if (mainWindow) {
      mainWindow.webContents.send('download-progress', {
        percent: 5,
        status: 'Начинаем загрузку...'
      });
    }

    // Создаём папку для bypass
    const bypassPath = getBypassPath();
    if (!fs.existsSync(bypassPath)) {
      fs.mkdirSync(bypassPath, { recursive: true });
    }

    const zipPath = path.join(bypassPath, 'bypass.zip');

    // Скачиваем файл
    await downloadFile(asset.browser_download_url, zipPath, (percent) => {
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
          percent: 5 + (percent * 0.7), // 5-75%
          status: 'Загрузка: ' + Math.round(percent) + '%'
        });
      }
    });

    if (mainWindow) {
      mainWindow.webContents.send('download-progress', {
        percent: 80,
        status: 'Распаковка файлов...'
      });
    }

    // Распаковываем архив
    await extractZip(zipPath, bypassPath);

    // Удаляем zip
    try {
      fs.unlinkSync(zipPath);
    } catch (e) {}

    // Сохраняем версию
    store.set('bypassVersion', releaseInfo.tag_name);

    if (mainWindow) {
      mainWindow.webContents.send('download-progress', {
        percent: 100,
        status: 'Готово!'
      });
    }

    return { success: true, version: releaseInfo.tag_name };

  } catch (err) {
    console.error('Download error:', err);
    return { success: false, error: err.message };
  }
});

// Получить информацию о последнем релизе
function getLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'RobBob-Launcher',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
}

// Скачать файл с прогрессом
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const handleResponse = (res) => {
      // Если редирект - следуем за ним
      if (res.statusCode === 302 || res.statusCode === 301) {
        downloadFile(res.headers.location, destPath, onProgress)
          .then(resolve)
          .catch(reject);
        return;
      }

      const totalSize = parseInt(res.headers['content-length'], 10);
      let downloadedSize = 0;

      const file = fs.createWriteStream(destPath);

      res.on('data', (chunk) => {
        downloadedSize += chunk.length;
        file.write(chunk);

        if (totalSize && onProgress) {
          onProgress((downloadedSize / totalSize) * 100);
        }
      });

      res.on('end', () => {
        file.end();
        resolve();
      });

      res.on('error', reject);
    };

    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'RobBob-Launcher'
      }
    }, handleResponse);

    req.on('error', reject);
  });
}

// Распаковать ZIP архив
function extractZip(zipPath, destPath) {
  return new Promise((resolve, reject) => {
    // Используем PowerShell для распаковки на Windows
    if (process.platform === 'win32') {
      const cmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destPath}' -Force"`;

      exec(cmd, { windowsHide: true }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    } else {
      // На других платформах используем unzip
      exec(`unzip -o "${zipPath}" -d "${destPath}"`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }
  });
}

// Управление окном
ipcMain.on('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow.close();
});

// Запуск приложения
app.whenReady().then(() => {
  // Инициализация GameFilter с колбэком для отзыва доступа
  GameFilter.init(() => {
    console.log('Access revoked - user left Telegram channel');
    // Останавливаем сетевой режим
    stopBypass();
    // Уведомляем фронтенд об отзыве доступа
    if (mainWindow) {
      mainWindow.webContents.send('telegram-access-revoked');
    }
  });
  
  createWindow();
  createTray();

  mainWindow.webContents.on('did-finish-load', () => {
    autoStartBypass();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// КРИТИЧЕСКИ ВАЖНО: Останавливаем bypass при выходе из лаунчера
app.on('before-quit', () => {
  console.log('=== Launcher quitting, stopping bypass ===');
  stopBypass();
});

// Дополнительная очистка при закрытии
app.on('will-quit', (event) => {
  console.log('=== Launcher will quit, final cleanup ===');
  // Принудительно убиваем все процессы winws.exe
  killAllWinwsSync();
});

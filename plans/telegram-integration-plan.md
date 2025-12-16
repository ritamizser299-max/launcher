# План реализации: Telegram интеграция и улучшения лаунчера

## Обзор задач

1. **Game Filter** - блокировка bypass до подписки на Telegram канал
2. **Переименование UI** - убрать все упоминания "bypass/обход" на нейтральные названия
3. **Логотип** - заменить градиентный логотип на иконку лаунчера
4. **Telegram Bot** - создать бота для проверки подписки
5. **Интеграция** - встроить проверку подписки в лаунчер

---

## Архитектура решения

```
┌─────────────────────────────────────────────────────────────────┐
│                        ЛАУНЧЕР                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    │
│  │   UI Layer  │───▶│  Main Process │───▶│  Telegram API   │    │
│  │  index.html │    │   main.js     │    │  Verification   │    │
│  └─────────────┘    └──────────────┘    └─────────────────┘    │
│         │                  │                     │              │
│         ▼                  ▼                     ▼              │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    │
│  │ Telegram    │    │  Game Filter │    │  Subscription   │    │
│  │ Auth Modal  │    │  Controller  │    │  Status Cache   │    │
│  └─────────────┘    └──────────────┘    └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TELEGRAM BOT                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Cloudflare Worker / Node.js Server                      │   │
│  │  - /start - регистрация пользователя                    │   │
│  │  - /verify - получение кода верификации                  │   │
│  │  - /check - API для проверки подписки                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Задача 1: Game Filter - Блокировка bypass

### Текущее состояние
- Файл `game_filter.enabled` существует, но не используется в коде
- Bypass запускается автоматически при старте лаунчера

### Реализация

**Файл:** `lib/game-filter.js` (новый)
```javascript
// Контроллер game filter
// Блокирует bypass до подтверждения подписки на Telegram канал

const GameFilter = {
  isEnabled: true,  // По умолчанию включен
  isSubscribed: false,  // Статус подписки
  
  // Проверка разрешен ли bypass
  canStartBypass() {
    if (!this.isEnabled) return true;
    return this.isSubscribed;
  },
  
  // Установка статуса подписки
  setSubscriptionStatus(status) {
    this.isSubscribed = status;
  }
};
```

**Изменения в** `main.js`:
- Импортировать game-filter.js
- В функции `startBypass()` добавить проверку `GameFilter.canStartBypass()`
- Если не подписан - отправить событие в renderer для показа модального окна Telegram

---

## Задача 2: Переименование UI элементов

### Что переименовать

| Текущее | Новое |
|---------|-------|
| `general` (Обычный) | Вариант 1 |
| `ALT` | Вариант 2 |
| `ALT2` | Вариант 3 |
| `ALT3` | Вариант 4 |
| `ALT4` | Вариант 5 |
| `ALT5` | Вариант 6 |
| `FAKE_TLS` | Вариант 7 |
| `SIMPLE` | Вариант 8 |
| Режим оптимизации сети | Сетевой режим |
| Режим подключения | Метод подключения |

### Файлы для изменения
1. `lib/bypass-configs.js` - названия режимов
2. `src/index.html` - тексты в UI
3. `src/scripts/bypass.js` - toast сообщения

---

## Задача 3: Замена логотипа

### Текущий логотип
```css
.titlebar .logo-icon {
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, var(--accent), var(--green));
  border-radius: 4px;
}
```

### Новый логотип
```css
.titlebar .logo-icon {
  width: 20px;
  height: 20px;
  background: url('../assets/icon.png') center/contain no-repeat;
  border-radius: 4px;
}
```

### Файлы для изменения
1. `src/styles/main.css` - стили логотипа
2. Возможно `src/index.html` - если нужно изменить структуру

---

## Задача 4: Telegram Bot

### Функционал бота
1. **Команда /start** - приветствие и инструкции
2. **Команда /verify** - генерация кода верификации
3. **Webhook API /check** - проверка подписки по user_id

### Код бота (Cloudflare Worker)

**Файл:** `telegram-bot/worker.js`
```javascript
// Конфигурация
const BOT_TOKEN = 'YOUR_BOT_TOKEN';
const CHANNEL_ID = '@YOUR_CHANNEL';  // или числовой ID
const SECRET_KEY = 'YOUR_SECRET_KEY';  // для подписи запросов

// Обработка webhook от Telegram
async function handleTelegramWebhook(request) {
  const update = await request.json();
  
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text;
    const userId = update.message.from.id;
    
    if (text === '/start') {
      await sendMessage(chatId, `Привет! Я бот RobBob.
      
Чтобы получить доступ к лаунчеру:
1. Подпишитесь на канал ${CHANNEL_ID}
2. Нажмите /verify для получения кода
3. Введите код в лаунчере`);
    }
    
    if (text === '/verify') {
      // Проверяем подписку на канал
      const isMember = await checkChannelMembership(userId);
      
      if (isMember) {
        // Генерируем код верификации
        const code = generateVerificationCode(userId);
        await sendMessage(chatId, `Ваш код верификации: ${code}
        
Введите этот код в лаунчере.`);
      } else {
        await sendMessage(chatId, `Вы не подписаны на канал ${CHANNEL_ID}!
        
Подпишитесь и попробуйте снова.`);
      }
    }
  }
  
  return new Response('OK');
}

// Проверка членства в канале
async function checkChannelMembership(userId) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`
  );
  const data = await response.json();
  
  if (data.ok) {
    const status = data.result.status;
    return ['creator', 'administrator', 'member'].includes(status);
  }
  return false;
}

// Генерация кода верификации
function generateVerificationCode(userId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const data = `${userId}:${timestamp}:${SECRET_KEY}`;
  // Простой hash для кода
  const hash = btoa(data).slice(0, 12).toUpperCase();
  return hash;
}

// API для проверки кода из лаунчера
async function handleVerifyCode(request) {
  const { code, userId } = await request.json();
  
  // Проверяем код
  const isValid = validateVerificationCode(code, userId);
  
  if (isValid) {
    // Дополнительно проверяем подписку
    const isMember = await checkChannelMembership(userId);
    return new Response(JSON.stringify({
      success: true,
      subscribed: isMember
    }), { headers: { 'Content-Type': 'application/json' } });
  }
  
  return new Response(JSON.stringify({
    success: false,
    error: 'Invalid code'
  }), { headers: { 'Content-Type': 'application/json' } });
}

// Роутинг
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleTelegramWebhook(request);
    }
    
    if (url.pathname === '/api/verify' && request.method === 'POST') {
      return handleVerifyCode(request);
    }
    
    if (url.pathname === '/api/check-subscription' && request.method === 'POST') {
      const { userId } = await request.json();
      const isMember = await checkChannelMembership(userId);
      return new Response(JSON.stringify({ subscribed: isMember }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('RobBob Bot API', { status: 200 });
  }
};
```

---

## Задача 5: Интеграция в лаунчер

### Новый модуль: `lib/telegram-auth.js`
```javascript
const https = require('https');

const TelegramAuth = {
  API_URL: 'https://your-worker.workers.dev',  // URL Cloudflare Worker
  
  // Проверка подписки по коду
  async verifyCode(code, userId) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ code, userId });
      
      const req = https.request({
        hostname: 'your-worker.workers.dev',
        path: '/api/verify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  },
  
  // Прямая проверка подписки
  async checkSubscription(userId) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ userId });
      
      const req = https.request({
        hostname: 'your-worker.workers.dev',
        path: '/api/check-subscription',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }
};

module.exports = TelegramAuth;
```

### Изменения в main.js
```javascript
const TelegramAuth = require('./lib/telegram-auth');

// Новые IPC обработчики
ipcMain.handle('telegram-verify', async (event, code, userId) => {
  try {
    const result = await TelegramAuth.verifyCode(code, userId);
    if (result.success && result.subscribed) {
      store.set('telegramVerified', true);
      store.set('telegramUserId', userId);
    }
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('telegram-check-subscription', async () => {
  const userId = store.get('telegramUserId');
  if (!userId) {
    return { subscribed: false };
  }
  
  try {
    return await TelegramAuth.checkSubscription(userId);
  } catch (err) {
    return { subscribed: false, error: err.message };
  }
});

ipcMain.handle('get-telegram-status', () => {
  return {
    verified: store.get('telegramVerified', false),
    userId: store.get('telegramUserId', null)
  };
});
```

---

## Задача 6: UI для Telegram авторизации

### Модальное окно в index.html
```html
<!-- Telegram Verification Modal -->
<div class="modal" id="telegramModal">
  <div class="sheet telegram-sheet">
    <h2>📱 Подтверждение доступа</h2>
    <div class="telegram-content">
      <p>Для использования лаунчера необходимо подписаться на наш Telegram канал.</p>
      
      <div class="telegram-steps">
        <div class="step">
          <span class="step-num">1</span>
          <span>Подпишитесь на канал <a href="#" id="openTelegramChannel">@channel_name</a></span>
        </div>
        <div class="step">
          <span class="step-num">2</span>
          <span>Напишите боту <a href="#" id="openTelegramBot">@bot_name</a> команду /verify</span>
        </div>
        <div class="step">
          <span class="step-num">3</span>
          <span>Введите полученный код ниже</span>
        </div>
      </div>
      
      <input type="text" id="telegramCode" placeholder="Введите код верификации">
    </div>
    <div class="actions">
      <button class="btn ghost" id="telegramCancel">Позже</button>
      <button class="btn primary" id="telegramVerify">Подтвердить</button>
    </div>
  </div>
</div>
```

### Новый скрипт: `src/scripts/telegram.js`
```javascript
const Telegram = {
  elements: {
    modal: null,
    codeInput: null,
    verifyBtn: null,
    cancelBtn: null
  },
  
  async init() {
    this.elements.modal = document.getElementById('telegramModal');
    this.elements.codeInput = document.getElementById('telegramCode');
    this.elements.verifyBtn = document.getElementById('telegramVerify');
    this.elements.cancelBtn = document.getElementById('telegramCancel');
    
    // Проверяем статус при загрузке
    if (window.electronAPI) {
      const status = await window.electronAPI.getTelegramStatus();
      if (!status.verified) {
        // Показываем модальное окно
        this.showModal();
      }
    }
    
    this.bindEvents();
  },
  
  bindEvents() {
    this.elements.verifyBtn?.addEventListener('click', () => this.verify());
    this.elements.cancelBtn?.addEventListener('click', () => this.hideModal());
    
    document.getElementById('openTelegramChannel')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.electronAPI?.openExternal('https://t.me/channel_name');
    });
    
    document.getElementById('openTelegramBot')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.electronAPI?.openExternal('https://t.me/bot_name');
    });
  },
  
  async verify() {
    const code = this.elements.codeInput.value.trim();
    if (!code) {
      Toast.show('Введите код верификации', 'error');
      return;
    }
    
    this.elements.verifyBtn.disabled = true;
    this.elements.verifyBtn.textContent = 'Проверка...';
    
    try {
      const result = await window.electronAPI.telegramVerify(code);
      
      if (result.success && result.subscribed) {
        Toast.show('Доступ подтвержден!', 'success');
        this.hideModal();
      } else {
        Toast.show(result.error || 'Неверный код или вы не подписаны на канал', 'error');
      }
    } catch (err) {
      Toast.show('Ошибка проверки', 'error');
    }
    
    this.elements.verifyBtn.disabled = false;
    this.elements.verifyBtn.textContent = 'Подтвердить';
  },
  
  showModal() {
    this.elements.modal?.classList.add('open');
  },
  
  hideModal() {
    this.elements.modal?.classList.remove('open');
  }
};

document.addEventListener('DOMContentLoaded', () => Telegram.init());
```

---

## Порядок выполнения

1. **Переименование UI** - самое простое, делаем первым
2. **Замена логотипа** - быстрая задача
3. **Создание Telegram бота** - Cloudflare Worker
4. **Интеграция в main.js** - IPC обработчики
5. **UI для Telegram** - модальное окно и скрипт
6. **Game Filter** - связываем все вместе

---

## Конфигурационные параметры

Все настройки Telegram должны быть в одном месте для легкой настройки:

**Файл:** `lib/config.js`
```javascript
module.exports = {
  telegram: {
    botUsername: '@robbob_verify_bot',
    channelUsername: '@robbob_channel',
    channelId: '-1001234567890',  // Числовой ID канала
    apiUrl: 'https://robbob-bot.workers.dev'
  }
};
```

---

## Безопасность

1. **Не хранить BOT_TOKEN в клиентском коде** - только на сервере
2. **Использовать HTTPS** для всех API запросов
3. **Валидация кодов** с временным ограничением (код действует 10 минут)
4. **Rate limiting** на API endpoints

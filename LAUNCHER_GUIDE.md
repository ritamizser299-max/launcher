# RobBob Launcher - Полное Руководство

## Содержание
1. [Что такое лаунчер](#что-такое-лаунчер)
2. [Функционал лаунчера](#функционал-лаунчера)
3. [Структура файлов](#структура-файлов)
4. [Установка и настройка](#установка-и-настройка)
5. [Telegram верификация](#telegram-верификация)
6. [Game Filter (для игр)](#game-filter-для-игр)
7. [Сборка bootstrapper](#сборка-bootstrapper)
8. [Cloudflare Worker (Telegram бот)](#cloudflare-worker-telegram-бот)

---

## Что такое лаунчер

RobBob Launcher - это Electron приложение, которое запускает zapret (winws.exe) для оптимизации сетевого соединения. Позволяет:
- Улучшить соединение с Discord, YouTube, Google
- Поддержка игр (Roblox и др.) через Game Filter
- Проверка подписки на Telegram канал

---

## Функционал лаунчера

### Главные функции:

| Функция | Описание |
|---------|----------|
| **8 вариантов подключения** | Разные методы оптимизации сети (Вариант 1-8) |
| **Game Filter** | Автоматическая поддержка игр (Roblox) |
| **Telegram верификация** | Проверка подписки на канал перед запуском |
| **Автозапуск** | Возможность запуска при старте Windows |
| **Темы оформления** | Светлая/тёмная тема |
| **Автообновление** | Проверка и загрузка обновлений |

### Варианты подключения:
- **Вариант 1** - Стандартный метод (multisplit)
- **Вариант 2** - Альтернативный (fake + fakedsplit)
- **Вариант 3** - Расширенный (multisplit с другими параметрами)
- **Вариант 4** - Адаптивный (autottl + badseq)
- **Вариант 5** - Синхронный (syndata)
- **Вариант 6** - Упрощённый (базовый fake + split2)
- **Вариант 7** - Защищённый (fake TLS)
- **Вариант 8** - Базовый (минимальный набор)

---

## Структура файлов

```
site/
├── main.js                    # Главный процесс Electron
├── preload.js                 # Мост между main и renderer
├── package.json               # Зависимости и настройки
│
├── src/                       # Интерфейс (HTML/CSS/JS)
│   ├── index.html            # Главная страница
│   ├── scripts/
│   │   ├── app.js            # Основная логика UI
│   │   ├── bypass.js         # Управление запуском
│   │   ├── telegram.js       # Telegram верификация UI
│   │   ├── navigation.js     # Навигация по страницам
│   │   ├── theme.js          # Переключение темы
│   │   └── ...
│   └── styles/
│       └── main.css          # Стили
│
├── lib/                       # Библиотеки
│   ├── bypass-configs.js     # Конфигурации запуска (8 вариантов)
│   ├── config.js             # Общие настройки (Telegram и др.)
│   ├── telegram-auth.js      # API Telegram верификации
│   └── game-filter.js        # Контроль доступа (Telegram)
│
├── resources/bypass/          # Файлы zapret
│   ├── bin/
│   │   ├── winws.exe         # ⭐ ГЛАВНЫЙ - движок zapret
│   │   ├── WinDivert.dll     # Драйвер
│   │   ├── WinDivert64.sys   # Драйвер 64-bit
│   │   ├── cygwin1.dll       # Cygwin библиотека
│   │   ├── game_filter.enabled # Флаг Game Filter
│   │   ├── quic_initial_www_google_com.bin  # QUIC данные
│   │   ├── tls_clienthello_*.bin            # TLS данные
│   │   └── ...
│   └── lists/
│       ├── list-general.txt   # Список доменов для обработки
│       ├── list-google.txt    # Домены Google
│       ├── list-exclude.txt   # Исключения
│       ├── ipset-all.txt      # IP адреса
│       └── ipset-exclude.txt  # Исключения IP
│
├── assets/                    # Иконки
│   ├── icon.ico              # Иконка для Windows
│   └── icon.png              # Иконка PNG
│
├── telegram-bot/              # Cloudflare Worker
│   ├── worker.js             # Код бота
│   └── README.md             # Инструкция по деплою
│
└── bootstrapper/              # Установщик
    ├── electron-bootstrapper/ # Electron бутстраппер
    └── RobBob-Installer.nsi   # NSIS скрипт
```

---

## Установка и настройка

### 1. Установка зависимостей

```bash
# Клонировать репозиторий
git clone https://github.com/hass39878-cyber/site.git
cd site

# Установить зависимости
npm install
```

### 2. Запуск в режиме разработки

```bash
npm start
```

### 3. Сборка для Windows

```bash
npm run build
```

Результат будет в папке `dist/`:
- `RobBob Setup 1.0.0.exe` - установщик
- `win-unpacked/` - portable версия

---

## Telegram верификация

### Как работает:
1. При первом запуске лаунчер показывает модальное окно
2. Пользователь вводит свой Telegram username
3. Лаунчер проверяет подписку на канал через Cloudflare Worker
4. Если подписан - может запускать, если нет - показывает кнопку подписки

### Настройка Telegram бота:

#### 1. Создать бота в Telegram
1. Открыть @BotFather в Telegram
2. Отправить `/newbot`
3. Задать имя и username бота
4. Скопировать токен (например: `7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

#### 2. Сделать бота администратором канала
1. Открыть ваш канал
2. Настройки → Администраторы → Добавить
3. Найти вашего бота и добавить
4. Дать права "Просмотр участников"

#### 3. Узнать ID канала
```
Если канал публичный: @channel_username
Если приватный: -1001234567890 (можно узнать через @userinfobot)
```

#### 4. Обновить конфигурацию

Отредактировать файл `lib/config.js`:

```javascript
module.exports = {
  telegram: {
    botToken: 'ВАШ_ТОКЕН_БОТА',           // Токен от @BotFather
    channelId: '@ваш_канал',               // ID или username канала
    channelLink: 'https://t.me/ваш_канал', // Ссылка для подписки
    workerUrl: 'https://ваш-worker.workers.dev' // URL Cloudflare Worker
  }
};
```

---

## Game Filter (для игр)

### Что это:
Game Filter расширяет диапазон UDP портов для поддержки игр типа Roblox.

### Как работает:
- **Включен** (файл `game_filter.enabled` существует): UDP порты = `1024-65535`
- **Выключен** (файла нет): UDP порты = `12`

### Управление:

**Включить Game Filter (для Roblox):**
```bash
# Файл уже существует по умолчанию
# resources/bypass/bin/game_filter.enabled
```

**Выключить Game Filter:**
```bash
# Просто удалить файл
rm resources/bypass/bin/game_filter.enabled
```

### Важно:
- Game Filter включен по умолчанию
- При включенном Game Filter Roblox работает автоматически
- Никаких дополнительных настроек не нужно

---

## Сборка Bootstrapper

Bootstrapper - это маленький установщик, который скачивает основной лаунчер.

### Структура bootstrapper:

```
bootstrapper/
├── electron-bootstrapper/     # Electron версия
│   ├── main.js               # Логика скачивания
│   ├── package.json          # Зависимости
│   ├── preload.js
│   └── src/
│       └── index.html        # Интерфейс прогресса
│
├── RobBob-Bootstrapper.ps1   # PowerShell скрипт
└── RobBob-Installer.nsi      # NSIS установщик
```

### Сборка Electron Bootstrapper:

```bash
cd bootstrapper/electron-bootstrapper
npm install
npm run build
```

### Сборка NSIS Installer:
1. Установить [NSIS](https://nsis.sourceforge.io/Download)
2. Открыть `RobBob-Installer.nsi` в NSIS
3. Нажать "Compile"
4. Получить `RobBob-Setup.exe`

### Что класть в bootstrapper:

| Файл | Куда класть | Формат |
|------|-------------|--------|
| `icon.ico` | `bootstrapper/electron-bootstrapper/assets/` | ICO 256x256 |
| `icon.png` | `bootstrapper/electron-bootstrapper/assets/` | PNG 512x512 |

---

## Cloudflare Worker (Telegram бот)

### Что это:
Serverless функция, которая проверяет подписку пользователя на Telegram канал.

### Деплой на Cloudflare:

#### 1. Создать аккаунт Cloudflare
Зайти на https://dash.cloudflare.com и зарегистрироваться.

#### 2. Создать Worker
1. В меню слева выбрать "Workers & Pages"
2. Нажать "Create Worker"
3. Задать имя (например: `robbob-telegram-bot`)
4. Нажать "Deploy"

#### 3. Добавить код
1. Нажать "Edit code"
2. Скопировать содержимое файла `telegram-bot/worker.js`
3. Вставить в редактор
4. Нажать "Save and deploy"

#### 4. Настроить переменные окружения
1. Перейти в Settings → Variables
2. Добавить:
   - `BOT_TOKEN` = токен вашего бота
   - `CHANNEL_ID` = ID вашего канала

#### 5. Скопировать URL Worker
URL будет выглядеть примерно так:
```
https://robbob-telegram-bot.ваш-username.workers.dev
```

#### 6. Обновить config.js
```javascript
workerUrl: 'https://robbob-telegram-bot.ваш-username.workers.dev'
```

### API Worker:

```
GET /check?username=telegram_username
```

Ответ:
```json
{
  "subscribed": true,
  "username": "user123",
  "channelLink": "https://t.me/channel"
}
```

---

## Файлы для работы zapret

### Обязательные файлы в `resources/bypass/bin/`:

| Файл | Описание | Где взять |
|------|----------|-----------|
| `winws.exe` | Движок zapret | [zapret-discord-youtube](https://github.com/Flowseal/zapret-discord-youtube) |
| `WinDivert.dll` | Драйвер | В комплекте с zapret |
| `WinDivert64.sys` | 64-bit драйвер | В комплекте с zapret |
| `cygwin1.dll` | Cygwin | В комплекте с zapret |
| `quic_initial_www_google_com.bin` | QUIC fake данные | В комплекте с zapret |
| `tls_clienthello_www_google_com.bin` | TLS fake данные | В комплекте с zapret |
| `tls_clienthello_4pda_to.bin` | TLS альтернативные | В комплекте с zapret |
| `game_filter.enabled` | Флаг Game Filter | Создать пустой файл |

### Файлы списков в `resources/bypass/lists/`:

| Файл | Описание |
|------|----------|
| `list-general.txt` | Домены для обработки (discord.com, youtube.com и т.д.) |
| `list-google.txt` | Google сервисы |
| `list-exclude.txt` | Исключения (не обрабатывать) |
| `ipset-all.txt` | IP адреса для обработки |
| `ipset-exclude.txt` | IP исключения |

### Где взять файлы zapret:

1. Скачать с https://github.com/Flowseal/zapret-discord-youtube/releases
2. Распаковать архив
3. Скопировать содержимое папки `bin/` в `resources/bypass/bin/`
4. Скопировать содержимое папки `lists/` в `resources/bypass/lists/`

---

## Чеклист перед релизом

- [ ] Настроен Telegram бот (@BotFather)
- [ ] Бот добавлен администратором в канал
- [ ] Создан и задеплоен Cloudflare Worker
- [ ] Обновлён `lib/config.js` с токеном и URL
- [ ] Все файлы zapret в `resources/bypass/`
- [ ] `game_filter.enabled` существует для поддержки игр
- [ ] Иконки в `assets/` (icon.ico и icon.png)
- [ ] Выполнен `npm run build`
- [ ] Протестирована работа на чистой Windows

---

## FAQ

**Q: Почему Roblox не работает?**
A: Проверьте что файл `game_filter.enabled` существует в `resources/bypass/bin/`

**Q: Как изменить Telegram канал?**
A: Отредактируйте `lib/config.js` и обновите переменные в Cloudflare Worker

**Q: Где логи ошибок?**
A: В консоли разработчика (Ctrl+Shift+I в лаунчере) или в терминале при запуске `npm start`

**Q: Как добавить новый домен для обработки?**
A: Добавьте его в файл `resources/bypass/lists/list-general.txt`

---

## Контакты и поддержка

- GitHub: https://github.com/hass39878-cyber/site
- PR с изменениями: https://github.com/hass39878-cyber/site/pull/9

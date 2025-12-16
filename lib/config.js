/**
 * Централизованная конфигурация лаунчера
 * Все настройки Telegram и API в одном месте
 */

module.exports = {
  // Telegram настройки
  telegram: {
    // Username бота (без @)
    botUsername: 'robloxbob_bot',
    // Username канала (без @)
    channelUsername: 'rbxbob',
    // Числовой ID канала (можно получить через @userinfobot)
    channelId: '6803526264',
    // URL API для проверки подписки (Cloudflare Worker или свой сервер)
    apiUrl: 'https://codeworker.truexieru.workers.dev',
    // Ссылки для пользователя
    botLink: 'https://t.me/robloxbob_bot',
    channelLink: 'https://t.me/rbxbob'
  },

  // Game Filter настройки
  gameFilter: {
    // Включен ли game filter по умолчанию
    enabled: true,
    // Список игровых доменов для исключения из обработки
    gameDomains: [
      'roblox.com',
      '*.roblox.com',
      'rbxcdn.com',
      '*.rbxcdn.com'
    ]
  },

  // Версия лаунчера
  version: require('../package.json').version,

  // URL для обновлений
  updates: {
    versionUrl: 'https://your-server.com/api/launcher/version.json',
    downloadUrl: 'https://your-server.com/files/RobBob-Setup.exe'
  }
};

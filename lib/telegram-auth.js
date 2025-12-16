/**
 * Telegram Authentication Module
 * Модуль для проверки подписки на Telegram канал
 */

const https = require('https');
const http = require('http');
const config = require('./config');

const TelegramAuth = {
  /**
   * Проверка кода верификации через API бота
   * @param {string} code - Код от бота
   * @returns {Promise<{success: boolean, subscribed?: boolean, userId?: number, error?: string}>}
   */
  async verifyCode(code) {
    return new Promise((resolve) => {
      const postData = JSON.stringify({ code });
      const url = new URL(config.telegram.apiUrl + '/api/verify');
      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (e) {
            resolve({ success: false, error: 'Invalid response from server' });
          }
        });
      });

      req.on('error', (err) => {
        console.error('Telegram verify error:', err);
        resolve({ success: false, error: 'Connection error' });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Request timeout' });
      });

      req.write(postData);
      req.end();
    });
  },

  /**
   * Прямая проверка подписки по userId
   * @param {number} userId - Telegram user ID
   * @returns {Promise<{subscribed: boolean, error?: string}>}
   */
  async checkSubscription(userId) {
    return new Promise((resolve) => {
      const postData = JSON.stringify({ userId });
      const url = new URL(config.telegram.apiUrl + '/api/check-subscription');
      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (e) {
            resolve({ subscribed: false, error: 'Invalid response from server' });
          }
        });
      });

      req.on('error', (err) => {
        console.error('Telegram check subscription error:', err);
        resolve({ subscribed: false, error: 'Connection error' });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ subscribed: false, error: 'Request timeout' });
      });

      req.write(postData);
      req.end();
    });
  },

  /**
   * Получить ссылки для пользователя
   */
  getLinks() {
    return {
      bot: config.telegram.botLink,
      channel: config.telegram.channelLink,
      botUsername: config.telegram.botUsername,
      channelUsername: config.telegram.channelUsername
    };
  }
};

module.exports = TelegramAuth;

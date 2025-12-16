/**
 * Game Filter Module
 * Контроль доступа к сетевому режиму на основе подписки Telegram
 * 
 * Game Filter позволяет:
 * 1. Блокировать сетевой режим до подтверждения подписки
 * 2. Кэшировать статус подписки локально
 * 3. Периодически проверять актуальность подписки
 */

const Store = require('electron-store');
const TelegramAuth = require('./telegram-auth');

const store = new Store();

const GameFilter = {
  // Статус подписки
  _isSubscribed: false,
  // ID пользователя Telegram
  _telegramUserId: null,
  // Время последней проверки
  _lastCheck: 0,
  // Интервал проверки (5 минут в мс) - более частые проверки для отслеживания выхода из канала
  CHECK_INTERVAL: 5 * 60 * 1000,
  // Таймер для периодических проверок
  _checkTimer: null,
  // Колбэк для уведомления об отзыве доступа
  _onAccessRevoked: null,

  /**
   * Инициализация модуля
   * Загружает сохраненный статус из store
   */
  init(onAccessRevoked = null) {
    this._isSubscribed = store.get('telegramVerified', false);
    this._telegramUserId = store.get('telegramUserId', null);
    this._lastCheck = store.get('telegramLastCheck', 0);
    this._onAccessRevoked = onAccessRevoked;

    console.log('GameFilter initialized:', {
      subscribed: this._isSubscribed,
      userId: this._telegramUserId
    });
    
    // Запускаем периодическую проверку подписки
    if (this._isSubscribed && this._telegramUserId) {
      this.startPeriodicCheck();
    }
  },

  /**
   * Проверка разрешен ли запуск сетевого режима
   * @returns {boolean}
   */
  canStartNetworkMode() {
    // Если не подписан - запрещаем
    if (!this._isSubscribed) {
      return false;
    }

    return true;
  },

  /**
   * Получение текущего статуса
   * @returns {{verified: boolean, userId: number|null, needsRefresh: boolean}}
   */
  getStatus() {
    const now = Date.now();
    const needsRefresh = now - this._lastCheck > this.CHECK_INTERVAL;

    return {
      verified: this._isSubscribed,
      userId: this._telegramUserId,
      needsRefresh
    };
  },

  /**
   * Верификация кода от Telegram бота
   * @param {string} code - Код верификации
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async verifyCode(code) {
    try {
      const result = await TelegramAuth.verifyCode(code);

      if (result.success && result.subscribed) {
        // Сохраняем статус
        this._isSubscribed = true;
        this._telegramUserId = result.userId;
        this._lastCheck = Date.now();

        store.set('telegramVerified', true);
        store.set('telegramUserId', result.userId);
        store.set('telegramLastCheck', this._lastCheck);

        console.log('GameFilter: User verified:', result.userId);
        
        // Запускаем периодическую проверку подписки
        this.startPeriodicCheck();

        return { success: true };
      }

      if (result.success && !result.subscribed) {
        return { success: false, error: 'Вы не подписаны на канал' };
      }

      return { success: false, error: result.error || 'Неверный код' };
    } catch (err) {
      console.error('GameFilter verify error:', err);
      return { success: false, error: 'Ошибка проверки' };
    }
  },

  /**
   * Запуск периодической проверки подписки
   */
  startPeriodicCheck() {
    // Останавливаем предыдущий таймер, если есть
    this.stopPeriodicCheck();
    
    console.log('GameFilter: Starting periodic subscription checks every 5 minutes');
    
    // Первая проверка через 1 минуту после старта
    setTimeout(() => {
      this.refreshSubscriptionStatus();
    }, 60 * 1000);
    
    // Затем каждые 5 минут
    this._checkTimer = setInterval(() => {
      this.refreshSubscriptionStatus();
    }, this.CHECK_INTERVAL);
  },
  
  /**
   * Остановка периодической проверки
   */
  stopPeriodicCheck() {
    if (this._checkTimer) {
      clearInterval(this._checkTimer);
      this._checkTimer = null;
      console.log('GameFilter: Stopped periodic checks');
    }
  },

  /**
   * Обновление статуса подписки (фоновая проверка)
   */
  async refreshSubscriptionStatus() {
    if (!this._telegramUserId) {
      return;
    }

    try {
      const result = await TelegramAuth.checkSubscription(this._telegramUserId);

      if (result.subscribed) {
        this._lastCheck = Date.now();
        store.set('telegramLastCheck', this._lastCheck);
        console.log('GameFilter: Subscription refreshed - user still subscribed');
      } else {
        // Подписка истекла - пользователь вышел из канала
        console.log('GameFilter: Subscription expired - user left channel');
        this._isSubscribed = false;
        store.set('telegramVerified', false);
        
        // Останавливаем периодические проверки
        this.stopPeriodicCheck();
        
        // Уведомляем об отзыве доступа
        if (this._onAccessRevoked) {
          this._onAccessRevoked();
        }
      }
    } catch (err) {
      console.error('GameFilter refresh error:', err);
      // При ошибке не сбрасываем статус, но логируем
    }
  },

  /**
   * Сброс верификации (выход)
   */
  reset() {
    this._isSubscribed = false;
    this._telegramUserId = null;
    this._lastCheck = 0;
    
    // Останавливаем периодические проверки
    this.stopPeriodicCheck();

    store.delete('telegramVerified');
    store.delete('telegramUserId');
    store.delete('telegramLastCheck');

    console.log('GameFilter: Reset');
  },

  /**
   * Получение ссылок для UI
   */
  getLinks() {
    return TelegramAuth.getLinks();
  }
};

module.exports = GameFilter;

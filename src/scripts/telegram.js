/**
 * Telegram Verification UI Module
 * Управление fullscreen блокирующим окном верификации Telegram
 */

const TelegramUI = {
  elements: {
    blocker: null,
    codeInput: null,
    verifyBtn: null,
    errorDiv: null,
    channelLink: null,
    botLink: null,
    channelName: null,
    botName: null
  },

  // Статус верификации
  isVerified: false,
  
  // Флаг обязательной верификации (всегда true для fullscreen blocker)
  mandatoryMode: true,

  async init() {
    // Получаем элементы нового fullscreen blocker
    this.elements.blocker = document.getElementById('telegramBlocker');
    this.elements.codeInput = document.getElementById('telegramCode');
    this.elements.verifyBtn = document.getElementById('telegramVerify');
    this.elements.errorDiv = document.getElementById('telegramError');
    this.elements.channelLink = document.getElementById('openTelegramChannel');
    this.elements.botLink = document.getElementById('openTelegramBot');
    this.elements.channelName = document.getElementById('telegramChannelName');
    this.elements.botName = document.getElementById('telegramBotName');

    // Проверяем статус при загрузке
    if (window.electronAPI) {
      await this.checkStatus();
      await this.loadLinks();
      this.setupEventListeners();
      
      // Показываем fullscreen blocker при старте, если не верифицирован
      if (!this.isVerified) {
        this.showBlocker();
      } else {
        // Если уже верифицирован, запускаем tutorial (если не пройден)
        setTimeout(() => {
          if (typeof Tutorial !== 'undefined') {
            Tutorial.start();
          }
        }, 1000);
      }
    }
  },

  /**
   * Загрузка ссылок на канал и бота
   */
  async loadLinks() {
    if (window.electronAPI && window.electronAPI.getTelegramLinks) {
      try {
        const links = await window.electronAPI.getTelegramLinks();
        
        if (this.elements.channelLink) {
          this.elements.channelLink.dataset.url = links.channel;
        }
        
        if (this.elements.channelName) {
          this.elements.channelName.textContent = '@' + links.channelUsername;
        }
        
        if (this.elements.botLink) {
          this.elements.botLink.dataset.url = links.bot;
        }
        
        if (this.elements.botName) {
          this.elements.botName.textContent = '@' + links.botUsername;
        }
      } catch (e) {
        console.log('Failed to load Telegram links:', e);
      }
    }
  },

  /**
   * Проверка статуса верификации
   */
  async checkStatus() {
    if (window.electronAPI && window.electronAPI.getTelegramStatus) {
      try {
        const status = await window.electronAPI.getTelegramStatus();
        this.isVerified = status.verified;
        
        // Если нужно обновить подписку - делаем это в фоне
        if (status.needsRefresh && status.verified) {
          window.electronAPI.telegramRefresh();
        }
      } catch (e) {
        console.log('Failed to check Telegram status:', e);
      }
    }
  },

  /**
   * Настройка обработчиков событий
   */
  setupEventListeners() {
    // Кнопка верификации
    if (this.elements.verifyBtn) {
      this.elements.verifyBtn.addEventListener('click', () => this.verify());
    }

    // Блокируем Escape в обязательном режиме (fullscreen blocker всегда обязательный)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.mandatoryMode && this.elements.blocker?.classList.contains('show')) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Ввод кода - Enter для подтверждения
    if (this.elements.codeInput) {
      this.elements.codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.verify();
        }
      });

      // Очистка ошибки при вводе
      this.elements.codeInput.addEventListener('input', () => {
        this.clearError();
      });
    }

    // Ссылка на канал
    if (this.elements.channelLink) {
      this.elements.channelLink.addEventListener('click', (e) => {
        e.preventDefault();
        const url = this.elements.channelLink.dataset.url;
        if (url && window.electronAPI && window.electronAPI.openExternal) {
          window.electronAPI.openExternal(url);
        }
      });
    }

    // Ссылка на бота
    if (this.elements.botLink) {
      this.elements.botLink.addEventListener('click', (e) => {
        e.preventDefault();
        const url = this.elements.botLink.dataset.url;
        if (url && window.electronAPI && window.electronAPI.openExternal) {
          window.electronAPI.openExternal(url);
        }
      });
    }

    // Слушаем событие от main процесса для показа блокирующего окна
    if (window.electronAPI && window.electronAPI.onShowTelegramModal) {
      window.electronAPI.onShowTelegramModal(() => {
        this.showBlocker();
      });
    }
    
    // Слушаем событие отзыва доступа (когда пользователь выходит из канала)
    if (window.electronAPI && window.electronAPI.onTelegramAccessRevoked) {
      window.electronAPI.onTelegramAccessRevoked(() => {
        this.revokeAccess();
      });
    }
  },

  /**
   * Верификация кода
   */
  async verify() {
    const code = this.elements.codeInput?.value.trim();
    
    if (!code) {
      this.showError('Введите код верификации');
      return;
    }

    // Блокируем кнопку
    if (this.elements.verifyBtn) {
      this.elements.verifyBtn.disabled = true;
      const originalHTML = this.elements.verifyBtn.innerHTML;
      this.elements.verifyBtn.innerHTML = '<span>Проверка...</span>';
    }

    this.clearError();

    try {
      const result = await window.electronAPI.telegramVerify(code);

      if (result.success) {
        this.isVerified = true;
        Toast.show('Доступ подтвержден!', 'success');
        this.hideBlocker();
        
        // Очищаем поле
        if (this.elements.codeInput) {
          this.elements.codeInput.value = '';
        }
        
        // Запускаем tutorial после успешной верификации
        setTimeout(() => {
          if (typeof Tutorial !== 'undefined') {
            Tutorial.start();
          }
        }, 500);
      } else {
        this.showError(result.error || 'Неверный код или вы не подписаны на канал');
      }
    } catch (err) {
      console.error('Verification error:', err);
      this.showError('Ошибка проверки. Попробуйте позже.');
    }

    // Разблокируем кнопку
    if (this.elements.verifyBtn) {
      this.elements.verifyBtn.disabled = false;
      this.elements.verifyBtn.innerHTML = '<span>Подтвердить подписку</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path></svg>';
    }
  },

  /**
   * Показать ошибку
   */
  showError(message) {
    if (this.elements.errorDiv) {
      this.elements.errorDiv.textContent = message;
      this.elements.errorDiv.classList.add('visible');
    }
  },

  /**
   * Очистить ошибку
   */
  clearError() {
    if (this.elements.errorDiv) {
      this.elements.errorDiv.textContent = '';
      this.elements.errorDiv.classList.remove('visible');
    }
  },

  /**
   * Показать fullscreen блокирующее окно
   */
  showBlocker() {
    if (this.elements.blocker) {
      this.elements.blocker.style.display = 'flex';
      // Небольшая задержка для анимации
      setTimeout(() => {
        this.elements.blocker.classList.add('show');
      }, 10);
      
      // Фокус на поле ввода
      setTimeout(() => {
        this.elements.codeInput?.focus();
      }, 400);
    }
  },

  /**
   * Скрыть fullscreen блокирующее окно
   * Скрывается только после успешной верификации
   */
  hideBlocker() {
    if (this.elements.blocker && this.isVerified) {
      this.elements.blocker.classList.remove('show');
      setTimeout(() => {
        this.elements.blocker.style.display = 'none';
      }, 300);
    }
  },

  /**
   * Проверить верификацию (для вызова из других модулей)
   */
  requireVerification() {
    if (!this.isVerified) {
      this.showBlocker();
      return false;
    }
    return true;
  },
  
  /**
   * Обработчик отзыва доступа (когда пользователь выходит из канала)
   */
  revokeAccess() {
    this.isVerified = false;
    this.showBlocker();
    Toast.show('Доступ отозван. Пожалуйста, подтвердите подписку.', 'error');
  }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => TelegramUI.init());

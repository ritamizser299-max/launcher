/**
 * Tutorial System
 * Интерактивное обучение для новых пользователей
 */

const Tutorial = {
  currentStep: 0,
  isActive: false,
  
  steps: [
    {
      target: '#openLogin',
      text: 'Вы можете войти в свой аккаунт Roblox для быстрого доступа к профилю',
      arrow: 'top-right'
    },
    {
      target: '#playBtn',
      text: 'Это поможет вам зайти в роблокс!',
      arrow: 'top'
    },
    {
      target: '[data-page="page-settings"]',
      text: 'Поменяйте метод соединения, если у вас не работает!',
      arrow: 'left'
    },
    {
      target: '[data-page="page-news"]',
      text: 'Различные новости о лаунчере! :3',
      arrow: 'left'
    }
  ],

  elements: {
    overlay: null,
    spotlight: null,
    arrow: null,
    tooltip: null,
    closeBtn: null
  },

  async init() {
    // Проверяем, завершен ли tutorial
    if (window.electronAPI) {
      const settings = await window.electronAPI.getSettings();
      if (settings.tutorialCompleted) {
        return; // Уже прошли tutorial
      }
    }

    // Создаем элементы
    this.createElements();
    this.setupEventListeners();
  },

  createElements() {
    // Tutorial overlay
    const overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    overlay.id = 'tutorialOverlay';
    overlay.style.display = 'none';

    overlay.innerHTML = `
      <div class="tutorial-backdrop"></div>
      <div class="tutorial-spotlight" id="tutorialSpotlight"></div>
      <svg class="tutorial-arrow" id="tutorialArrow" width="60" height="60" viewBox="0 0 60 60">
        <path d="M30 10 L30 45 M30 45 L20 35 M30 45 L40 35" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
      </svg>
      <div class="tutorial-tooltip" id="tutorialTooltip">
        <button class="tutorial-close" id="tutorialClose">✕</button>
        <div class="tutorial-content">
          <div class="tutorial-text" id="tutorialText"></div>
          <div class="tutorial-footer">
            <div class="tutorial-progress" id="tutorialProgress">1/4</div>
            <button class="tutorial-next" id="tutorialNext">Далее</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Сохраняем ссылки
    this.elements.overlay = overlay;
    this.elements.spotlight = overlay.querySelector('#tutorialSpotlight');
    this.elements.arrow = overlay.querySelector('#tutorialArrow');
    this.elements.tooltip = overlay.querySelector('#tutorialTooltip');
    this.elements.closeBtn = overlay.querySelector('#tutorialClose');
    this.elements.nextBtn = overlay.querySelector('#tutorialNext');
    this.elements.text = overlay.querySelector('#tutorialText');
    this.elements.progress = overlay.querySelector('#tutorialProgress');
  },

  setupEventListeners() {
    // Кнопка "Далее"
    if (this.elements.nextBtn) {
      this.elements.nextBtn.addEventListener('click', () => this.nextStep());
    }

    // Кнопка закрытия
    if (this.elements.closeBtn) {
      this.elements.closeBtn.addEventListener('click', () => this.close());
    }

    // ESC для закрытия
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isActive) {
        this.close();
      }
    });

    // Обработка resize
    window.addEventListener('resize', () => {
      if (this.isActive) {
        this.updatePositions();
      }
    });

    // Кнопка "Показать" в настройках
    const restartBtn = document.getElementById('tutorialRestart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.forceStart());
    }
  },

  async start() {
    // Проверяем, не завершен ли уже tutorial
    if (window.electronAPI) {
      const settings = await window.electronAPI.getSettings();
      if (settings.tutorialCompleted) {
        return;
      }
    }

    this.currentStep = 0;
    this.isActive = true;
    this.elements.overlay.style.display = 'flex';
    
    setTimeout(() => {
      this.elements.overlay.classList.add('active');
      this.showStep(0);
    }, 100);
  },

  forceStart() {
    // Принудительный запуск (из настроек)
    this.currentStep = 0;
    this.isActive = true;
    this.elements.overlay.style.display = 'flex';
    
    setTimeout(() => {
      this.elements.overlay.classList.add('active');
      this.showStep(0);
    }, 100);
  },

  showStep(index) {
    if (index >= this.steps.length) {
      this.complete();
      return;
    }

    const step = this.steps[index];
    const target = document.querySelector(step.target);

    if (!target) {
      console.error('Tutorial target not found:', step.target);
      this.nextStep();
      return;
    }

    // Обновляем текст
    this.elements.text.textContent = step.text;
    this.elements.progress.textContent = `${index + 1}/${this.steps.length}`;

    // Обновляем кнопку на последнем шаге
    if (index === this.steps.length - 1) {
      this.elements.nextBtn.textContent = 'Завершить';
    } else {
      this.elements.nextBtn.textContent = 'Далее';
    }

    // Позиционируем spotlight и стрелку
    this.updatePositions();
  },

  updatePositions() {
    const step = this.steps[this.currentStep];
    const target = document.querySelector(step.target);

    if (!target) return;

    const rect = target.getBoundingClientRect();

    // Spotlight
    const padding = 8;
    this.elements.spotlight.style.left = (rect.left - padding) + 'px';
    this.elements.spotlight.style.top = (rect.top - padding) + 'px';
    this.elements.spotlight.style.width = (rect.width + padding * 2) + 'px';
    this.elements.spotlight.style.height = (rect.height + padding * 2) + 'px';

    // Arrow positioning based on direction
    const arrow = this.elements.arrow;
    const tooltip = this.elements.tooltip;
    
    switch (step.arrow) {
      case 'top':
        arrow.style.left = (rect.left + rect.width / 2 - 30) + 'px';
        arrow.style.top = (rect.bottom + 20) + 'px';
        arrow.style.transform = 'rotate(0deg)';
        
        tooltip.style.left = (rect.left + rect.width / 2 - 160) + 'px';
        tooltip.style.top = (rect.bottom + 90) + 'px';
        break;
        
      case 'top-right':
        arrow.style.left = (rect.right - 40) + 'px';
        arrow.style.top = (rect.bottom + 20) + 'px';
        arrow.style.transform = 'rotate(-45deg)';
        
        tooltip.style.left = (rect.right - 300) + 'px';
        tooltip.style.top = (rect.bottom + 90) + 'px';
        break;
        
      case 'left':
        arrow.style.left = (rect.right + 20) + 'px';
        arrow.style.top = (rect.top + rect.height / 2 - 30) + 'px';
        arrow.style.transform = 'rotate(90deg)';
        
        tooltip.style.left = (rect.right + 90) + 'px';
        tooltip.style.top = (rect.top + rect.height / 2 - 60) + 'px';
        break;
        
      case 'right':
        arrow.style.left = (rect.left - 70) + 'px';
        arrow.style.top = (rect.top + rect.height / 2 - 30) + 'px';
        arrow.style.transform = 'rotate(-90deg)';
        
        tooltip.style.left = (rect.left - 340) + 'px';
        tooltip.style.top = (rect.top + rect.height / 2 - 60) + 'px';
        break;
    }

    // Ensure tooltip stays within viewport
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.right > window.innerWidth) {
      tooltip.style.left = (window.innerWidth - tooltipRect.width - 20) + 'px';
    }
    if (tooltipRect.left < 0) {
      tooltip.style.left = '20px';
    }
    if (tooltipRect.bottom > window.innerHeight) {
      tooltip.style.top = (window.innerHeight - tooltipRect.height - 20) + 'px';
    }
    if (tooltipRect.top < 0) {
      tooltip.style.top = '20px';
    }
  },

  nextStep() {
    this.currentStep++;
    if (this.currentStep >= this.steps.length) {
      this.complete();
    } else {
      this.showStep(this.currentStep);
    }
  },

  async complete() {
    this.isActive = false;
    this.elements.overlay.classList.remove('active');
    
    setTimeout(() => {
      this.elements.overlay.style.display = 'none';
    }, 300);

    // Сохраняем, что tutorial завершен
    if (window.electronAPI) {
      await window.electronAPI.saveSetting('tutorialCompleted', true);
    }

    // Показываем toast
    if (typeof Toast !== 'undefined') {
      Toast.show('Обучение завершено! 🎉', 'success');
    }
  },

  close() {
    this.isActive = false;
    this.elements.overlay.classList.remove('active');
    
    setTimeout(() => {
      this.elements.overlay.style.display = 'none';
    }, 300);
  }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => Tutorial.init());

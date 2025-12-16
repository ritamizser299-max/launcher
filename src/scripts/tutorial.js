/**
 * Tutorial System
 * Интерактивное обучение для новых пользователей
 */

const Tutorial = {
  currentStep: 0,
  isActive: false,
  currentTarget: null,
  
  // Направление стрелки указывает куда СМОТРЕТЬ (на target)
  // position: где находится tooltip относительно target
  steps: [
    {
      target: '#openLogin',
      text: 'Вы можете войти в свой аккаунт Roblox для быстрого доступа к профилю',
      position: 'bottom-left' // tooltip снизу-слева от кнопки
    },
    {
      target: '#playBtn',
      text: 'Нажмите, чтобы запустить Roblox!',
      position: 'bottom' // tooltip снизу от кнопки
    },
    {
      target: '[data-page="page-settings"]',
      text: 'Поменяйте метод соединения, если у вас не работает!',
      position: 'right' // tooltip справа от кнопки (в sidebar)
    },
    {
      target: '[data-page="page-news"]',
      text: 'Различные новости о лаунчере! :3',
      position: 'right' // tooltip справа от кнопки (в sidebar)
    }
  ],

  elements: {
    overlay: null,
    spotlight: null,
    arrow: null,
    tooltip: null,
    closeBtn: null
  },

  // SVG пути для стрелок в разных направлениях
  arrowPaths: {
    up: 'M30 50 L30 15 M30 15 L20 25 M30 15 L40 25',      // Стрелка вверх
    down: 'M30 10 L30 45 M30 45 L20 35 M30 45 L40 35',    // Стрелка вниз
    left: 'M50 30 L15 30 M15 30 L25 20 M15 30 L25 40',    // Стрелка влево
    right: 'M10 30 L45 30 M45 30 L35 20 M45 30 L35 40'    // Стрелка вправо
  },

  async init() {
    // Всегда создаем элементы (нужны для кнопки "Показать" в настройках)
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
        <path d="M30 50 L30 15 M30 15 L20 25 M30 15 L40 25" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
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

    // Убираем подсветку с предыдущего элемента
    if (this.currentTarget) {
      this.currentTarget.classList.remove('tutorial-target-highlight');
    }

    const step = this.steps[index];
    const target = document.querySelector(step.target);

    if (!target) {
      console.error('Tutorial target not found:', step.target);
      this.nextStep();
      return;
    }

    // Добавляем подсветку на текущий элемент
    target.classList.add('tutorial-target-highlight');
    this.currentTarget = target;

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

  // Обновить SVG стрелки для указанного направления
  updateArrowDirection(direction) {
    const arrow = this.elements.arrow;
    const path = arrow.querySelector('path');
    
    // Убираем все классы анимации
    arrow.classList.remove('arrow-up', 'arrow-down', 'arrow-left', 'arrow-right');
    
    // Устанавливаем путь и класс анимации
    if (this.arrowPaths[direction]) {
      path.setAttribute('d', this.arrowPaths[direction]);
      arrow.classList.add('arrow-' + direction);
    }
  },

  updatePositions() {
    const step = this.steps[this.currentStep];
    const target = document.querySelector(step.target);

    if (!target) return;

    const rect = target.getBoundingClientRect();

    // Spotlight - обрамляет целевой элемент
    const padding = 8;
    this.elements.spotlight.style.left = (rect.left - padding) + 'px';
    this.elements.spotlight.style.top = (rect.top - padding) + 'px';
    this.elements.spotlight.style.width = (rect.width + padding * 2) + 'px';
    this.elements.spotlight.style.height = (rect.height + padding * 2) + 'px';

    const arrow = this.elements.arrow;
    const tooltip = this.elements.tooltip;
    const arrowOffset = 15;  // Расстояние от target до стрелки
    const tooltipOffset = 80; // Расстояние от target до tooltip
    
    // Позиционирование на основе положения tooltip относительно target
    // Стрелка ВСЕГДА указывает НА target (от tooltip к target)
    switch (step.position) {
      case 'bottom': // Tooltip снизу от target, стрелка указывает ВВЕРХ
        this.updateArrowDirection('up');
        arrow.style.left = (rect.left + rect.width / 2 - 30) + 'px';
        arrow.style.top = (rect.bottom + arrowOffset) + 'px';
        
        tooltip.style.left = (rect.left + rect.width / 2 - 160) + 'px';
        tooltip.style.top = (rect.bottom + tooltipOffset) + 'px';
        break;
        
      case 'bottom-left': // Tooltip снизу-слева, стрелка указывает ВВЕРХ-ВПРАВО
        this.updateArrowDirection('up');
        arrow.style.left = (rect.left + rect.width / 2 - 30) + 'px';
        arrow.style.top = (rect.bottom + arrowOffset) + 'px';
        
        tooltip.style.left = Math.max(20, rect.left - 100) + 'px';
        tooltip.style.top = (rect.bottom + tooltipOffset) + 'px';
        break;
        
      case 'top': // Tooltip сверху от target, стрелка указывает ВНИЗ
        this.updateArrowDirection('down');
        arrow.style.left = (rect.left + rect.width / 2 - 30) + 'px';
        arrow.style.top = (rect.top - 60 - arrowOffset) + 'px';
        
        tooltip.style.left = (rect.left + rect.width / 2 - 160) + 'px';
        tooltip.style.top = (rect.top - tooltipOffset - 100) + 'px';
        break;
        
      case 'right': // Tooltip справа от target, стрелка указывает ВЛЕВО
        this.updateArrowDirection('left');
        arrow.style.left = (rect.right + arrowOffset) + 'px';
        arrow.style.top = (rect.top + rect.height / 2 - 30) + 'px';
        
        tooltip.style.left = (rect.right + tooltipOffset) + 'px';
        tooltip.style.top = (rect.top + rect.height / 2 - 60) + 'px';
        break;
        
      case 'left': // Tooltip слева от target, стрелка указывает ВПРАВО
        this.updateArrowDirection('right');
        arrow.style.left = (rect.left - 60 - arrowOffset) + 'px';
        arrow.style.top = (rect.top + rect.height / 2 - 30) + 'px';
        
        tooltip.style.left = (rect.left - tooltipOffset - 320) + 'px';
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
    
    // Убираем подсветку с текущего элемента
    if (this.currentTarget) {
      this.currentTarget.classList.remove('tutorial-target-highlight');
      this.currentTarget = null;
    }
    
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
    
    // Убираем подсветку с текущего элемента
    if (this.currentTarget) {
      this.currentTarget.classList.remove('tutorial-target-highlight');
      this.currentTarget = null;
    }
    
    setTimeout(() => {
      this.elements.overlay.style.display = 'none';
    }, 300);
  }
};

// Инициализация элементов при загрузке (не запускает tutorial автоматически)
document.addEventListener('DOMContentLoaded', () => Tutorial.init());

/**
 * Автоматическое определение интернет-провайдера
 * и выбор оптимального режима обхода
 */

const { exec } = require('child_process');
const https = require('https');

// Маппинг провайдеров на оптимальные режимы обхода
const PROVIDER_MODES = {
  // Российские провайдеры
  'rostelecom': 'ALT7',        // Ростелеком - рекомендуется ALT7 (sniext+1)
  'mts': 'ALT7',               // МТС - рекомендуется ALT7
  'beeline': 'ALT3',           // Билайн - рекомендуется ALT3 (fakedsplit+autottl)
  'megafon': 'ALT7',           // МегаФон - рекомендуется ALT7
  'tele2': 'ALT4',             // Теле2 - рекомендуется ALT4 (fake+multisplit)
  'mgts': 'general',           // МГТС - рекомендуется general
  'tattelecom': 'ALT7',        // Таттелеком - рекомендуется ALT7
  'domru': 'ALT6',             // Дом.ru - рекомендуется ALT6
  'ertelecom': 'ALT6',         // ЭР-Телеком - рекомендуется ALT6
  'skynet': 'ALT3',            // SkyNet - рекомендуется ALT3
  'netbynet': 'ALT7',          // NetByNet - рекомендуется ALT7
  
  // Казахстанские провайдеры
  'beeline_kz': 'ALT3',        // Билайн Казахстан
  'kcell': 'ALT7',             // Kcell
  'altel': 'ALT4',             // Altel
  'kazakhtelecom': 'ALT7',     // Казахтелеком
  
  // Украинские провайдеры
  'kyivstar': 'ALT7',          // Киевстар
  'vodafone_ua': 'ALT4',       // Vodafone Украина
  'lifecell': 'ALT3',          // lifecell
  
  // Белорусские провайдеры
  'byfly': 'ALT7',             // Белтелеком (ByFly)
  'mts_by': 'ALT7',            // МТС Беларусь
  'a1_by': 'ALT4',             // A1 Беларусь
  
  // Другие провайдеры СНГ
  'uznet': 'ALT7',             // Узбекистан
  'moldtelecom': 'ALT6',       // Молдтелеком
  
  // Резервный вариант - основной режим по умолчанию
  'default': 'general'
};

// Известные ASN (Autonomous System Numbers) провайдеров
const PROVIDER_ASN = {
  // Ростелеком
  '12389': 'rostelecom',
  '42610': 'rostelecom',
  '25513': 'rostelecom',
  
  // МТС
  '8359': 'mts',
  '25159': 'mts',
  '29497': 'mts',
  
  // Билайн
  '3216': 'beeline',
  '8402': 'beeline',
  '31163': 'beeline',
  
  // МегаФон
  '31133': 'megafon',
  '25159': 'megafon',
  '31224': 'megafon',
  
  // Теле2
  '41330': 'tele2',
  '48190': 'tele2',
  '43966': 'tele2',
  
  // МГТС
  '25513': 'mgts',
  '25478': 'mgts',
  
  // Дом.ru / ЭР-Телеком
  '41733': 'ertelecom',
  '50544': 'domru',
  '42668': 'ertelecom',
  
  // Казахстан
  '9198': 'kazakhtelecom',
  '48503': 'kcell',
  '43994': 'beeline_kz'
};

/**
 * Определение провайдера через публичные API
 */
async function detectProviderOnline() {
  try {
    // Используем ipinfo.io для получения информации об IP
    const ipInfo = await httpsGet('https://ipinfo.io/json');
    
    if (ipInfo && ipInfo.org) {
      const org = ipInfo.org.toLowerCase();
      const asn = ipInfo.org.match(/AS(\d+)/)?.[1];
      
      console.log('Detected ISP:', ipInfo.org);
      console.log('ASN:', asn);
      console.log('Country:', ipInfo.country);
      
      // Пытаемся определить по ASN
      if (asn && PROVIDER_ASN[asn]) {
        return PROVIDER_ASN[asn];
      }
      
      // Определение по названию провайдера
      if (org.includes('rostelecom') || org.includes('ростелеком')) return 'rostelecom';
      if (org.includes('mts') || org.includes('мтс')) return 'mts';
      if (org.includes('beeline') || org.includes('билайн')) return 'beeline';
      if (org.includes('megafon') || org.includes('мегафон')) return 'megafon';
      if (org.includes('tele2') || org.includes('теле2')) return 'tele2';
      if (org.includes('mgts') || org.includes('мгтс')) return 'mgts';
      if (org.includes('tattelecom') || org.includes('таттелеком')) return 'tattelecom';
      if (org.includes('dom.ru') || org.includes('домру') || org.includes('domru')) return 'domru';
      if (org.includes('er-telecom') || org.includes('ertelecom')) return 'ertelecom';
      if (org.includes('skynet')) return 'skynet';
      if (org.includes('netbynet')) return 'netbynet';
      
      // Казахстан
      if (org.includes('kazakhtelecom')) return 'kazakhtelecom';
      if (org.includes('kcell')) return 'kcell';
      if (org.includes('altel')) return 'altel';
      
      // Украина
      if (org.includes('kyivstar')) return 'kyivstar';
      if (org.includes('vodafone')) return 'vodafone_ua';
      if (org.includes('lifecell')) return 'lifecell';
      
      // Беларусь
      if (org.includes('byfly') || org.includes('beltelecom')) return 'byfly';
      if (org.includes('a1.by') || org.includes('velcom')) return 'a1_by';
    }
    
    return 'default';
  } catch (error) {
    console.error('Provider detection error:', error);
    return 'default';
  }
}

/**
 * Получить оптимальный режим для провайдера
 */
function getOptimalMode(provider) {
  return PROVIDER_MODES[provider] || PROVIDER_MODES['default'];
}

/**
 * Автоопределение и получение рекомендуемого режима
 */
async function getRecommendedBypassMode() {
  console.log('=== Auto-detecting ISP provider ===');
  
  const provider = await detectProviderOnline();
  const mode = getOptimalMode(provider);
  
  console.log('Detected provider:', provider);
  console.log('Recommended mode:', mode);
  
  return {
    provider,
    mode,
    autoDetected: provider !== 'default'
  };
}

/**
 * Helper для HTTPS запросов
 */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'RobBob-Launcher',
        'Accept': 'application/json'
      },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.error('HTTPS request error:', err);
      resolve(null);
    }).on('timeout', () => {
      console.error('HTTPS request timeout');
      resolve(null);
    });
  });
}

/**
 * Получить информацию о всех доступных провайдерах и их режимах
 */
function getProviderModesList() {
  return Object.entries(PROVIDER_MODES).map(([provider, mode]) => ({
    provider,
    mode,
    description: getProviderDescription(provider)
  }));
}

/**
 * Получить описание провайдера
 */
function getProviderDescription(provider) {
  const descriptions = {
    'rostelecom': 'Ростелеком',
    'mts': 'МТС',
    'beeline': 'Билайн',
    'megafon': 'МегаФон',
    'tele2': 'Теле2',
    'mgts': 'МГТС',
    'tattelecom': 'Таттелеком',
    'domru': 'Дом.ru',
    'ertelecom': 'ЭР-Телеком',
    'skynet': 'SkyNet',
    'netbynet': 'NetByNet',
    'kazakhtelecom': 'Казахтелеком',
    'kcell': 'Kcell',
    'altel': 'Altel',
    'beeline_kz': 'Билайн Казахстан',
    'kyivstar': 'Киевстар',
    'vodafone_ua': 'Vodafone Украина',
    'lifecell': 'lifecell',
    'byfly': 'ByFly',
    'mts_by': 'МТС Беларусь',
    'a1_by': 'A1 Беларусь',
    'uznet': 'UzNet',
    'moldtelecom': 'Молдтелеком',
    'default': 'Автоопределение'
  };
  return descriptions[provider] || provider;
}

module.exports = {
  detectProviderOnline,
  getOptimalMode,
  getRecommendedBypassMode,
  getProviderModesList,
  PROVIDER_MODES
};

// API配置
const API_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const MODEL = 'deepseek-r1-250120';

// 缓存配置
const CACHE_KEY = 'dailyKnowledgeCache';

// 系统提示词
const SYSTEM_PROMPT = '你是一个专业的产品经理助手，请提供一条关于产品管理、用户研究、需求分析或产品设计的实用知识或技巧。回答应简洁、具体且有实际应用价值，控制在100-250字之间。请使用Markdown格式，包括适当的加粗标题、列表和段落，适量emoji，以提高可读性。例如，可以使用**粗体**强调关键点，使用有序或无序列表展示步骤和要点，使用适当的段落划分提高内容结构性。';

// 初始化插件
chrome.runtime.onInstalled.addListener(() => {
  // 设置默认配置
  chrome.storage.local.set({
    'dailyNotification': true,
    'notificationTime': '09:00',
    'favorites': []
  });
  
  // 设置每日提醒
  setupDailyAlarm();
  
  // 重置缓存，确保首次安装后获取新知识
  resetKnowledgeCache();
});

// 重置知识缓存
function resetKnowledgeCache() {
  chrome.storage.local.set({
    [CACHE_KEY]: {
      content: '',
      timestamp: null,
      date: ''
    }
  });
}

// 设置每日提醒
function setupDailyAlarm() {
  chrome.storage.local.get(['notificationTime'], function(result) {
    const time = result.notificationTime || '09:00';
    const [hours, minutes] = time.split(':').map(Number);
    
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);
    
    // 如果今天的时间已经过了，设置为明天
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const delayInMinutes = Math.floor((scheduledTime - now) / 1000 / 60);
    
    // 先清除已有的闹钟
    chrome.alarms.clear('dailyKnowledge');
    
    // 创建闹钟
    chrome.alarms.create('dailyKnowledge', {
      delayInMinutes: delayInMinutes,
      periodInMinutes: 24 * 60 // 每24小时
    });
    
    // 添加每日0点缓存重置闹钟
    setupMidnightCacheResetAlarm();
    
    console.log(`闹钟已设置，将在${delayInMinutes}分钟后（${hours}:${minutes}）触发，之后每24小时触发一次`);
  });
}

// 设置午夜缓存重置闹钟
function setupMidnightCacheResetAlarm() {
  const now = new Date();
  const midnight = new Date();
  midnight.setDate(now.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  
  const delayInMinutes = Math.floor((midnight - now) / 1000 / 60);
  
  // 先清除已有的闹钟
  chrome.alarms.clear('midnightCacheReset');
  
  // 创建闹钟
  chrome.alarms.create('midnightCacheReset', {
    delayInMinutes: delayInMinutes,
    periodInMinutes: 24 * 60 // 每24小时
  });
  
  console.log(`缓存重置闹钟已设置，将在${delayInMinutes}分钟后触发（午夜0点），之后每24小时触发一次`);
}

// 监听闹钟
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyKnowledge') {
    chrome.storage.local.get(['dailyNotification'], function(result) {
      if (result.dailyNotification) {
        // 获取知识并强制更新缓存
        fetchPMKnowledge(true).then(knowledge => {
          showNotification(knowledge);
        });
      }
    });
  } else if (alarm.name === 'midnightCacheReset') {
    // 午夜重置缓存
    resetKnowledgeCache();
    console.log('午夜已重置知识缓存');
  }
});

// 获取当前日期字符串（YYYY-MM-DD格式）
function getCurrentDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// 显示通知
function showNotification(content) {
  // 移除markdown符号，获取纯文本用于通知
  const plainText = content.replace(/\*\*/g, '').replace(/#/g, '').replace(/\d\.\s/g, '');
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon128.png',
    title: '今日产品经理知识',
    message: plainText.substring(0, 100) + (plainText.length > 100 ? '...' : ''),
    buttons: [{ title: '查看详情' }]
  });
}

// 监听通知点击
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    chrome.tabs.create({ url: 'popup.html' });
  }
});

// 处理来自弹出窗口的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getKnowledge') {
    // 默认不强制更新
    const forceUpdate = request.forceUpdate || false;
    
    fetchPMKnowledge(forceUpdate).then(knowledge => {
      sendResponse({ knowledge: knowledge });
    });
    return true; // 表示异步响应
  } else if (request.action === 'saveKnowledge') {
    saveToFavorites(request.knowledge);
    sendResponse({ success: true });
  } else if (request.action === 'updateAlarm') {
    setupDailyAlarm();
    sendResponse({ success: true });
  } else if (request.action === 'resetKnowledgeCache') {
    resetKnowledgeCache();
    sendResponse({ success: true });
  }
  return true;
});

// 从API获取知识内容
async function fetchPMKnowledge(forceUpdate = false) {
  try {
    // 获取 API Key
    const apiKeyResult = await new Promise(resolve => {
      chrome.storage.local.get(['apiKey'], resolve);
    });
    
    const apiKey = apiKeyResult.apiKey;
    
    // 检查 API Key 是否存在
    if (!apiKey) {
      console.error('API Key 未配置');
      return "请先在设置页面配置您的 API Key";
    }
    
    // 先检查缓存
    const cache = await getCachedKnowledge();
    const currentDate = getCurrentDateString();
    
    // 如果有缓存且是今天的缓存且不强制更新，则直接返回缓存内容
    if (cache.content && cache.date === currentDate && !forceUpdate) {
      console.log('使用今日缓存的知识内容');
      return cache.content;
    }
    
    // 没有今日缓存或强制更新，则请求新内容
    console.log('获取新的知识内容');
    
    // 获取用户偏好设置
    const preferences = await getUserPreferences();
    
    // 基础提示词列表
    const basePrompts = [
      "请提供一条关于产品经理工作的实用知识或技巧",
      "分享一个产品经理常用的分析框架及应用场景",
      "介绍一个产品需求收集与分析的有效方法",
      "分享一个产品经理与开发团队协作的最佳实践",
      "推荐一个产品经理应掌握的用户研究技巧",
      "分享一个产品经理提高工作效率的方法",
      "介绍一个产品设计中常被忽视但很重要的原则"
    ];
    
    // 构建用户提示词
    let userPrompt = "";
    
    // 如果有偏好设置，生成针对性的提示词
    if (preferences.hasPreferences) {
      // 从用户偏好中随机选择一个领域
      const allPreferences = [...preferences.categories, ...preferences.customPreferences];
      if (allPreferences.length > 0) {
        const randomPreference = allPreferences[Math.floor(Math.random() * allPreferences.length)];
        userPrompt = `请提供一条关于${randomPreference}领域的产品经理知识，要具体、实用，并包括实际案例`;
      } else {
        // 如果没有特定偏好，使用基础提示词
        userPrompt = basePrompts[Math.floor(Math.random() * basePrompts.length)];
      }
    } else {
      // 没有偏好设置，使用基础提示词
      userPrompt = basePrompts[Math.floor(Math.random() * basePrompts.length)];
    }
    
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            "role": "system",
            "content": SYSTEM_PROMPT
          },
          {
            "role": "user",
            "content": userPrompt
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    const knowledge = data.choices[0].message.content;
    
    // 更新缓存
    updateKnowledgeCache(knowledge);
    
    return knowledge;
  } catch (error) {
    console.error('获取知识失败:', error);
    
    // 出错时返回最近的缓存内容作为备用
    const cache = await getCachedKnowledge();
    if (cache.content) {
      return cache.content;
    }
    
    // 如果没有缓存，返回错误消息
    return "获取知识失败，请检查网络连接后重试。";
  }
}

// 获取用户的知识偏好设置
async function getUserPreferences() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['preferences', 'customPreferences'], function(result) {
      const preferences = {
        hasPreferences: false,
        categories: [],
        customPreferences: []
      };
      
      if (result.preferences && Array.isArray(result.preferences) && result.preferences.length > 0) {
        preferences.hasPreferences = true;
        preferences.categories = result.preferences;
      }
      
      if (result.customPreferences && Array.isArray(result.customPreferences) && result.customPreferences.length > 0) {
        preferences.hasPreferences = true;
        preferences.customPreferences = result.customPreferences;
      }
      
      resolve(preferences);
    });
  });
}

// 获取缓存的知识内容
function getCachedKnowledge() {
  return new Promise(resolve => {
    chrome.storage.local.get([CACHE_KEY], function(result) {
      resolve(result[CACHE_KEY] || { content: '', timestamp: null, date: '' });
    });
  });
}

// 更新知识缓存
function updateKnowledgeCache(content) {
  return new Promise(resolve => {
    const now = new Date();
    const timestamp = now.toISOString();
    const date = getCurrentDateString();
    
    chrome.storage.local.set({
      [CACHE_KEY]: {
        content: content,
        timestamp: timestamp,
        date: date
      }
    }, function() {
      console.log('知识缓存已更新:', date);
      resolve();
    });
  });
}

// 保存到收藏夹
function saveToFavorites(knowledge) {
  chrome.storage.local.get(['favorites'], function(result) {
    const favorites = result.favorites || [];
    const timestamp = new Date().toISOString();
    
    favorites.push({
      content: knowledge,
      timestamp: timestamp
    });
    
    chrome.storage.local.set({ 'favorites': favorites });
  });
} 
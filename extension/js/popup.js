// DOM元素
const loadingElement = document.getElementById('loading');
const contentElement = document.getElementById('knowledge-content');
const knowledgeTextElement = document.getElementById('knowledge-text');
const refreshButton = document.getElementById('refresh-btn');
const saveButton = document.getElementById('save-btn');
const copyButton = document.getElementById('copy-btn');
const exportButton = document.getElementById('export-btn');
const showFavoritesLink = document.getElementById('show-favorites');
const toastElement = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// 当前显示的知识内容
let currentKnowledge = '';
let currentKnowledgeId = '';

// 配置marked.js选项
marked.setOptions({
  breaks: true,           // 支持GitHub风格的换行
  gfm: true,              // 支持GitHub风格的Markdown
  headerIds: false,       // 不自动生成header IDs
  mangle: false,          // 不自动链接邮箱地址
  sanitize: false,        // 允许HTML标签（已废弃但兼容旧版）
});

// 页面加载完成后获取知识
document.addEventListener('DOMContentLoaded', () => {
  // 显示加载状态
  showLoading(true);
  
  // 检查是否配置了 API Key
  chrome.storage.local.get(['apiKey'], function(result) {
    if (!result.apiKey) {
      // 如果没有配置 API Key，显示提示信息
      const message = "请先在设置页面配置您的 API Key，从火山引擎 ARK 控制台获取";
      displayApiKeyNotice(message);
    } else {
      // 已配置 API Key，正常获取知识
      getKnowledgeFromBackground(false);
    }
  });
  
  // 设置事件监听器
  setupEventListeners();
  
  // 初始化主题
  initTheme();
});

// 设置事件监听器
function setupEventListeners() {
  // 刷新按钮 - 强制获取新内容
  refreshButton.addEventListener('click', () => {
    showLoading(true);
    // 添加一个成功提示，告知用户新的知识偏好设置会在获取新知识时生效
    // showToast('正在获取新知识，您的最新偏好设置将被应用', 'info');
    getKnowledgeFromBackground(true); // 强制更新
  });
  
  // 收藏按钮
  saveButton.addEventListener('click', () => {
    if (currentKnowledge) {
      // 禁用按钮，防止重复点击
      saveButton.disabled = true;
      saveButton.classList.add('disabled-btn');
      saveButton.innerHTML = '<i class="fas fa-check"></i> 已收藏';
      
      // 保存知识
      saveKnowledge(currentKnowledge);
    }
  });
  
  // 复制按钮
  copyButton.addEventListener('click', () => {
    if (currentKnowledge) {
      copyToClipboard(currentKnowledge);
    }
  });
  
  // 导出PNG按钮
  exportButton.addEventListener('click', () => {
    if (currentKnowledge) {
      exportAsPng();
    }
  });
  
  // 查看收藏链接
  showFavoritesLink.addEventListener('click', (e) => {
    e.preventDefault();
    openFavoritesPage();
  });
}

// 初始化主题
function initTheme() {
  // 检查存储的主题偏好
  chrome.storage.local.get(['theme'], function(result) {
    const savedTheme = result.theme;
    
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark-mode');
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark-mode');
    } else {
      // 如果没有存储的偏好，检查系统偏好
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark-mode');
      }
    }
  });
}

// 从后台脚本获取知识
function getKnowledgeFromBackground(forceUpdate = false) {
  chrome.runtime.sendMessage(
    { 
      action: 'getKnowledge',
      forceUpdate: forceUpdate 
    }, 
    (response) => {
      if (response && response.knowledge) {
        displayKnowledge(response.knowledge);
      } else {
        displayError('获取知识失败，请重试');
      }
    }
  );
}

// 生成内容的唯一ID
function generateId(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

// 检查内容是否已收藏
function checkIfFavorited(knowledgeId) {
  chrome.storage.local.get(['favorites'], function(result) {
    const favorites = result.favorites || [];
    const isFavorited = favorites.some(f => f.id === knowledgeId);
    
    if (isFavorited) {
      saveButton.disabled = true;
      saveButton.classList.add('disabled-btn');
      saveButton.innerHTML = '<i class="fas fa-check"></i> 已收藏';
    } else {
      saveButton.disabled = false;
      saveButton.classList.remove('disabled-btn');
      saveButton.innerHTML = '<i class="far fa-bookmark"></i> 收藏';
    }
  });
}

// 显示 API Key 配置提示
function displayApiKeyNotice(message) {
  knowledgeTextElement.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <i class="fas fa-key" style="font-size: 32px; color: var(--primary-color); margin-bottom: 15px;"></i>
      <p style="margin-bottom: 15px;">${message}</p>
      <button id="go-to-settings" class="btn primary-btn" style="margin: 0 auto;">
        <i class="fas fa-cog"></i> 前往设置
      </button>
    </div>
  `;
  
  // 添加前往设置按钮点击事件
  document.getElementById('go-to-settings').addEventListener('click', openOptionsPage);
  
  showLoading(false);
}

// 打开设置页面
function openOptionsPage() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
}

// 显示知识内容
function displayKnowledge(knowledge) {
  currentKnowledge = knowledge;
  currentKnowledgeId = generateId(knowledge);
  
  // 检查是否是 API Key 配置提示
  if (knowledge.includes('请先在设置页面配置您的 API Key')) {
    displayApiKeyNotice(knowledge);
    return;
  }
  
  try {
    const htmlContent = marked.parse(knowledge);
    knowledgeTextElement.innerHTML = htmlContent;
    
    // 检查是否已收藏
    checkIfFavorited(currentKnowledgeId);
    
    // 添加外部链接的target="_blank"属性
    const links = knowledgeTextElement.querySelectorAll('a');
    links.forEach(link => {
      if (link.href.startsWith('http')) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    });
    
    showLoading(false);
  } catch (error) {
    console.error('Markdown解析错误:', error);
    knowledgeTextElement.textContent = knowledge;
    showLoading(false);
  }
}

// 显示错误信息
function displayError(message) {
  knowledgeTextElement.textContent = message;
  showLoading(false);
  showToast(message, 'error');
}

// 控制加载状态显示
function showLoading(isLoading) {
  if (isLoading) {
    loadingElement.classList.remove('hidden');
    contentElement.classList.add('hidden');
  } else {
    loadingElement.classList.add('hidden');
    contentElement.classList.remove('hidden');
  }
}

// 保存知识到收藏
function saveKnowledge(knowledge) {
  chrome.storage.local.get(['favorites'], function(result) {
    const favorites = result.favorites || [];
    const newFavorite = {
      id: currentKnowledgeId,
      content: knowledge,
      timestamp: new Date().toISOString()
    };
    
    // 检查是否已存在
    if (!favorites.some(f => f.id === newFavorite.id)) {
      favorites.push(newFavorite);
      chrome.storage.local.set({ 'favorites': favorites }, function() {
        showToast('收藏成功！', 'success');
      });
    }
  });
}

// 打开收藏页面
function openFavoritesPage() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
}

// 显示提示信息
function showToast(message, type = 'success') {
  toastMessage.textContent = message;
  toastElement.className = 'toast ' + type;
  
  if (type === 'success') {
    toastElement.querySelector('i').className = 'fas fa-check-circle';
  } else if (type === 'error') {
    toastElement.querySelector('i').className = 'fas fa-exclamation-circle';
  } else if (type === 'info') {
    toastElement.querySelector('i').className = 'fas fa-info-circle';
  }
  
  // 显示提示
  toastElement.classList.add('show');
  
  // 2秒后隐藏
  setTimeout(() => {
    toastElement.classList.remove('show');
  }, 2000);
}

// 复制到剪贴板功能
function copyToClipboard(text) {
  // 创建一个临时textarea元素
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';  // 避免影响页面布局
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    // 执行复制命令
    const successful = document.execCommand('copy');
    if (successful) {
      showToast('已复制到剪贴板', 'success');
    } else {
      showToast('复制失败，请重试', 'error');
    }
  } catch (err) {
    showToast('复制失败: ' + err, 'error');
  }
  
  // 移除临时元素
  document.body.removeChild(textarea);
}

// 导出为PNG图片
function exportAsPng() {
  // 显示加载状态
  showToast('正在生成图片...', 'success');
  
  // 创建要导出的容器
  const exportDiv = document.createElement('div');
  exportDiv.className = 'export-preview';
  exportDiv.style.padding = '20px';
  exportDiv.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--card-background');
  exportDiv.style.color = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
  exportDiv.style.width = '350px';
  exportDiv.style.borderRadius = '12px';
  exportDiv.style.position = 'absolute';
  exportDiv.style.left = '-9999px';
  
  // 添加标题
  const title = document.createElement('h2');
  title.textContent = 'PM每日知识';
  title.style.marginBottom = '15px';
  title.style.color = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
  exportDiv.appendChild(title);
  
  // 添加内容
  const content = document.createElement('div');
  content.innerHTML = marked.parse(currentKnowledge);
  content.style.fontSize = '14px';
  content.style.lineHeight = '1.6';
  content.style.maxWidth = '100%';
  
  // 确保图片内容与卡片显示一致
  const styles = document.createElement('style');
  styles.textContent = `
    h1, h2, h3, h4 {
      margin-top: 18px;
      margin-bottom: 10px;
      font-weight: 600;
      color: ${getComputedStyle(document.documentElement).getPropertyValue('--text-primary')};
    }
    h1 { font-size: 20px; }
    h2 { font-size: 18px; }
    h3 { font-size: 16px; }
    h4 { font-size: 15px; }
    p { margin-bottom: 12px; }
    ul, ol { padding-left: 22px; margin: 10px 0 14px 0; }
    li { margin-bottom: 6px; }
    blockquote {
      border-left: 3px solid ${getComputedStyle(document.documentElement).getPropertyValue('--border-color')};
      padding-left: 14px;
      color: ${getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')};
      margin: 14px 0;
    }
    code {
      background-color: ${getComputedStyle(document.documentElement).getPropertyValue('--secondary-color')};
      padding: 3px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
      font-size: 13px;
    }
    pre {
      background-color: ${getComputedStyle(document.documentElement).getPropertyValue('--secondary-color')};
      padding: 14px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 14px 0;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
    a {
      color: ${getComputedStyle(document.documentElement).getPropertyValue('--primary-color')};
      text-decoration: none;
    }
    strong, b {
      font-weight: 600;
      color: ${getComputedStyle(document.documentElement).getPropertyValue('--primary-color')};
    }
  `;
  exportDiv.appendChild(styles);
  exportDiv.appendChild(content);
  
  // 添加底部标识
  const footer = document.createElement('div');
  footer.style.marginTop = '20px';
  footer.style.fontSize = '12px';
  footer.style.color = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary');
  footer.style.textAlign = 'right';
  footer.textContent = 'From: PM智慧助手 • ' + new Date().toLocaleDateString('zh-CN');
  exportDiv.appendChild(footer);
  
  // 添加到DOM
  document.body.appendChild(exportDiv);
  
  // 使用html2canvas转换为图片
  html2canvas(exportDiv, {
    scale: 2, // 提高分辨率
    backgroundColor: null,
    logging: false,
    useCORS: true,
    allowTaint: true,
    width: exportDiv.offsetWidth,
    height: exportDiv.offsetHeight, // 确保获取完整高度
    windowWidth: exportDiv.offsetWidth,
    windowHeight: exportDiv.offsetHeight
  }).then(canvas => {
    // 移除导出容器
    document.body.removeChild(exportDiv);
    
    // 创建图片URL
    const imgData = canvas.toDataURL('image/png');
    
    // 直接下载图片，不显示预览
    const link = document.createElement('a');
    link.href = imgData;
    link.download = 'PM知识_' + new Date().toLocaleDateString('zh-CN').replace(/\//g, '-') + '.png';
    link.click();
    
    showToast('图片已保存', 'success');
    
  }).catch(error => {
    console.error('导出图片失败:', error);
    document.body.removeChild(exportDiv);
    showToast('导出图片失败，请重试', 'error');
  });
} 
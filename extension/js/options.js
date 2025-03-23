// DOM元素
const notificationToggle = document.getElementById('notification-toggle');
const notificationTime = document.getElementById('notification-time');
const favoritesContainer = document.getElementById('favorites-container');
const saveSettingsButton = document.getElementById('save-settings-btn');
const themeSwitch = document.getElementById('theme-switch');
const customPreferenceInput = document.getElementById('custom-preference');
const addCustomBtn = document.getElementById('add-custom-btn');
const customTagsContainer = document.getElementById('custom-tags-container');
const preferenceCheckboxes = document.querySelectorAll('.preference-checkbox');
const apiKeyInput = document.getElementById('api-key');

// 自定义标签数组
let customTags = [];

// 跟踪设置是否有变化
let settingsChanged = false;

// 配置marked.js选项
marked.setOptions({
  breaks: true,           // 支持GitHub风格的换行
  gfm: true,              // 支持GitHub风格的Markdown
  headerIds: false,       // 不自动生成header IDs
  mangle: false,          // 不自动链接邮箱地址
  sanitize: false,        // 允许HTML标签
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载设置
  loadSettings();
  
  // 加载收藏内容
  loadFavorites();
  
  // 设置事件监听器
  setupEventListeners();
  
  // 初始化主题
  initTheme();
});

// 设置事件监听器
function setupEventListeners() {
  // 保存设置按钮
  saveSettingsButton.addEventListener('click', saveSettings);
  
  // 主题切换按钮
  themeSwitch.addEventListener('click', toggleTheme);
  
  // 添加设置变化监听
  notificationToggle.addEventListener('change', () => {
    settingsChanged = true;
    saveSettingsButton.disabled = false;
    saveSettingsButton.classList.remove('disabled-btn');
    saveSettingsButton.innerHTML = '<i class="fas fa-save"></i> 保存设置';
  });
  
  notificationTime.addEventListener('change', () => {
    settingsChanged = true;
    saveSettingsButton.disabled = false;
    saveSettingsButton.classList.remove('disabled-btn');
    saveSettingsButton.innerHTML = '<i class="fas fa-save"></i> 保存设置';
  });
  
  apiKeyInput.addEventListener('input', () => {
    settingsChanged = true;
    saveSettingsButton.disabled = false;
    saveSettingsButton.classList.remove('disabled-btn');
    saveSettingsButton.innerHTML = '<i class="fas fa-save"></i> 保存设置';
  });
  
  // 添加知识偏好复选框变化监听
  preferenceCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      settingsChanged = true;
      saveSettingsButton.disabled = false;
      saveSettingsButton.classList.remove('disabled-btn');
      saveSettingsButton.innerHTML = '<i class="fas fa-save"></i> 保存设置';
    });
  });
  
  // 添加自定义标签按钮
  addCustomBtn.addEventListener('click', addCustomTag);
  
  // 回车键添加自定义标签
  customPreferenceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomTag();
    }
  });
}

// 初始化主题
function initTheme() {
  // 检查存储的主题偏好
  chrome.storage.local.get(['theme'], function(result) {
    const savedTheme = result.theme;
    
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark-mode');
      themeSwitch.innerHTML = '<i class="fas fa-sun"></i>';
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark-mode');
      themeSwitch.innerHTML = '<i class="fas fa-moon"></i>';
    } else {
      // 如果没有存储的偏好，检查系统偏好
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark-mode');
        themeSwitch.innerHTML = '<i class="fas fa-sun"></i>';
      }
    }
  });
}

// 切换主题
function toggleTheme() {
  const isDarkMode = document.documentElement.classList.toggle('dark-mode');
  
  // 更新图标
  if (isDarkMode) {
    themeSwitch.innerHTML = '<i class="fas fa-sun"></i>';
    chrome.storage.local.set({ 'theme': 'dark' });
  } else {
    themeSwitch.innerHTML = '<i class="fas fa-moon"></i>';
    chrome.storage.local.set({ 'theme': 'light' });
  }
}

// 加载设置
function loadSettings() {
  chrome.storage.local.get(['dailyNotification', 'notificationTime', 'preferences', 'customPreferences', 'apiKey'], function(result) {
    // 通知设置
    if (result.dailyNotification !== undefined) {
      notificationToggle.checked = result.dailyNotification;
    }
    
    if (result.notificationTime) {
      notificationTime.value = result.notificationTime;
    }
    
    // API Key设置
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
    
    // 知识偏好设置
    if (result.preferences && Array.isArray(result.preferences)) {
      preferenceCheckboxes.forEach(checkbox => {
        checkbox.checked = result.preferences.includes(checkbox.value);
      });
    }
    
    // 自定义标签
    if (result.customPreferences && Array.isArray(result.customPreferences)) {
      customTags = [...result.customPreferences];
      renderCustomTags();
    }
  });
}

// 保存设置
function saveSettings() {
  if (!settingsChanged) return;
  
  // 禁用按钮
  saveSettingsButton.disabled = true;
  saveSettingsButton.classList.add('disabled-btn');
  saveSettingsButton.innerHTML = '<i class="fas fa-check"></i> 已保存';
  
  // 收集选中的知识偏好
  const selectedPreferences = [];
  preferenceCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      selectedPreferences.push(checkbox.value);
    }
  });
  
  const settings = {
    dailyNotification: notificationToggle.checked,
    notificationTime: notificationTime.value,
    preferences: selectedPreferences,
    customPreferences: customTags,
    apiKey: apiKeyInput.value.trim()
  };
  
  chrome.storage.local.set(settings, function() {
    // 重新设置闹钟
    chrome.runtime.sendMessage({ action: 'updateAlarm' });
    
    // 重置知识缓存，使下次获取知识时考虑新的偏好设置
    chrome.runtime.sendMessage({ action: 'resetKnowledgeCache' });
    
    showToast('设置已保存！', 'success');
    settingsChanged = false;
  });
}

// 加载收藏内容
function loadFavorites() {
  chrome.storage.local.get(['favorites'], function(result) {
    const favorites = result.favorites || [];
    
    if (favorites.length === 0) {
      favoritesContainer.innerHTML = `
        <div class="empty-favorites">
          <i class="fas fa-bookmark"></i>
          暂无收藏内容
        </div>`;
      return;
    }
    
    // 清空容器
    favoritesContainer.innerHTML = '<div class="favorites-list"></div>';
    const favoritesList = favoritesContainer.querySelector('.favorites-list');
    
    // 按时间倒序排序
    favorites.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // 创建收藏项
    favorites.forEach((favorite, index) => {
      const favoriteItem = createFavoriteItem(favorite, index);
      favoritesList.appendChild(favoriteItem);
    });
  });
}

// 创建收藏项元素
function createFavoriteItem(favorite, index) {
  const item = document.createElement('div');
  item.className = 'favorite-item';
  item.dataset.id = favorite.id;
  
  const content = document.createElement('div');
  content.className = 'favorite-content markdown-content';
  
  try {
    // 使用marked解析Markdown内容
    content.innerHTML = marked.parse(favorite.content);
    
    // 添加外部链接的target="_blank"属性
    const links = content.querySelectorAll('a');
    links.forEach(link => {
      if (link.href.startsWith('http')) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    });
  } catch (error) {
    console.error('Markdown解析错误:', error);
    content.textContent = favorite.content;
  }
  
  // 添加操作按钮区域
  const actions = document.createElement('div');
  actions.className = 'favorite-actions';
  
  // 复制按钮
  const copyButton = document.createElement('button');
  copyButton.className = 'favorite-icon-btn favorite-copy-btn';
  copyButton.title = '复制内容';
  copyButton.innerHTML = '<i class="fas fa-copy"></i>';
  copyButton.addEventListener('click', () => {
    copyToClipboard(favorite.content);
  });
  
  // 导出按钮
  const exportButton = document.createElement('button');
  exportButton.className = 'favorite-icon-btn favorite-export-btn';
  exportButton.title = '导出为图片';
  exportButton.innerHTML = '<i class="fas fa-image"></i>';
  exportButton.addEventListener('click', () => {
    exportAsPng(favorite.content);
  });
  
  actions.appendChild(copyButton);
  actions.appendChild(exportButton);
  
  const meta = document.createElement('div');
  meta.className = 'favorite-meta';
  
  const time = document.createElement('span');
  time.textContent = formatDate(new Date(favorite.timestamp));
  
  const deleteButton = document.createElement('button');
  deleteButton.className = 'delete-btn';
  deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i> 删除';
  deleteButton.addEventListener('click', () => showDeleteConfirmation(favorite.id));
  
  meta.appendChild(time);
  meta.appendChild(deleteButton);
  
  item.appendChild(content);
  item.appendChild(actions);
  item.appendChild(meta);
  
  return item;
}

// 显示删除确认弹窗
function showDeleteConfirmation(favoriteId) {
  // 创建确认弹窗
  const confirmDialog = document.createElement('div');
  confirmDialog.className = 'confirm-dialog';
  confirmDialog.innerHTML = `
    <div class="confirm-dialog-content">
      <h3>确认删除</h3>
      <p>确定要删除这条收藏吗？此操作无法撤销。</p>
      <div class="confirm-dialog-actions">
        <button class="btn secondary-btn cancel-btn">取消</button>
        <button class="btn primary-btn confirm-btn">确认删除</button>
      </div>
    </div>
  `;
  
  // 添加到页面
  document.body.appendChild(confirmDialog);
  
  // 显示弹窗（添加动画效果）
  setTimeout(() => confirmDialog.classList.add('show'), 10);
  
  // 绑定按钮事件
  const cancelBtn = confirmDialog.querySelector('.cancel-btn');
  const confirmBtn = confirmDialog.querySelector('.confirm-btn');
  
  // 取消按钮
  cancelBtn.addEventListener('click', () => {
    confirmDialog.classList.remove('show');
    setTimeout(() => confirmDialog.remove(), 300);
  });
  
  // 确认按钮
  confirmBtn.addEventListener('click', () => {
    // 执行删除操作
    deleteFavorite(favoriteId);
    // 关闭弹窗
    confirmDialog.classList.remove('show');
    setTimeout(() => confirmDialog.remove(), 300);
  });
}

// 删除收藏项
function deleteFavorite(favoriteId) {
  chrome.storage.local.get(['favorites'], function(result) {
    const favorites = result.favorites || [];
    const index = favorites.findIndex(f => f.id === favoriteId);
    
    if (index !== -1) {
      favorites.splice(index, 1);
      chrome.storage.local.set({ 'favorites': favorites }, function() {
        loadFavorites();
        showToast('已删除收藏', 'success');
      });
    }
  });
}

// 格式化日期
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 显示提示信息
function showToast(message, type = 'success') {
  // 检查是否已存在toast元素，不存在则创建
  let toastElement = document.getElementById('toast');
  if (!toastElement) {
    toastElement = document.createElement('div');
    toastElement.id = 'toast';
    toastElement.className = 'toast';
    toastElement.innerHTML = `
      <i class="fas fa-check-circle"></i>
      <span id="toast-message"></span>
    `;
    document.body.appendChild(toastElement);
  }
  
  const toastMessage = document.getElementById('toast-message');
  toastMessage.textContent = message;
  toastElement.className = 'toast ' + type;
  
  if (type === 'success') {
    toastElement.querySelector('i').className = 'fas fa-check-circle';
  } else if (type === 'error') {
    toastElement.querySelector('i').className = 'fas fa-exclamation-circle';
  }
  
  // 显示提示
  toastElement.classList.add('show');
  
  // 2秒后隐藏
  setTimeout(() => {
    toastElement.classList.remove('show');
  }, 2000);
}

// 添加自定义标签
function addCustomTag() {
  const value = customPreferenceInput.value.trim();
  if (value && !customTags.includes(value)) {
    customTags.push(value);
    renderCustomTags();
    customPreferenceInput.value = '';
    
    settingsChanged = true;
    saveSettingsButton.disabled = false;
    saveSettingsButton.classList.remove('disabled-btn');
    saveSettingsButton.innerHTML = '<i class="fas fa-save"></i> 保存设置';
  }
}

// 删除自定义标签
function deleteCustomTag(tag) {
  customTags = customTags.filter(t => t !== tag);
  renderCustomTags();
  
  settingsChanged = true;
  saveSettingsButton.disabled = false;
  saveSettingsButton.classList.remove('disabled-btn');
  saveSettingsButton.innerHTML = '<i class="fas fa-save"></i> 保存设置';
}

// 渲染自定义标签
function renderCustomTags() {
  customTagsContainer.innerHTML = '';
  
  if (customTags.length === 0) {
    return;
  }
  
  customTags.forEach(tag => {
    const tagElement = document.createElement('div');
    tagElement.className = 'custom-tag';
    tagElement.innerHTML = `
      ${tag}
      <span class="custom-tag-delete" title="删除">
        <i class="fas fa-times"></i>
      </span>
    `;
    
    const deleteBtn = tagElement.querySelector('.custom-tag-delete');
    deleteBtn.addEventListener('click', () => deleteCustomTag(tag));
    
    customTagsContainer.appendChild(tagElement);
  });
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
function exportAsPng(content) {
  // 显示加载状态
  showToast('正在生成图片...', 'success');
  
  // 创建要导出的容器
  const exportDiv = document.createElement('div');
  exportDiv.className = 'export-preview';
  exportDiv.style.padding = '20px';
  exportDiv.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--card-background');
  exportDiv.style.color = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
  exportDiv.style.width = '500px';
  exportDiv.style.borderRadius = '12px';
  exportDiv.style.position = 'absolute';
  exportDiv.style.left = '-9999px';
  
  // 添加标题
  const title = document.createElement('h2');
  title.textContent = 'PM收藏知识';
  title.style.marginBottom = '15px';
  title.style.color = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
  exportDiv.appendChild(title);
  
  // 添加内容
  const contentDiv = document.createElement('div');
  contentDiv.innerHTML = marked.parse(content);
  contentDiv.style.fontSize = '14px';
  contentDiv.style.lineHeight = '1.6';
  contentDiv.style.maxWidth = '100%';
  
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
  exportDiv.appendChild(contentDiv);
  
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
    link.download = 'PM收藏知识_' + new Date().toLocaleDateString('zh-CN').replace(/\//g, '-') + '.png';
    link.click();
    
    showToast('图片已保存', 'success');
    
  }).catch(error => {
    console.error('导出图片失败:', error);
    document.body.removeChild(exportDiv);
    showToast('导出图片失败，请重试', 'error');
  });
} 
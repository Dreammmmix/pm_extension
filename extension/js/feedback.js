// 用户反馈和个性化推荐逻辑

// 反馈类型常量
const FEEDBACK_TYPES = {
  USEFUL: 'useful',
  NOT_INTERESTED: 'not_interested'
};

// DOM元素
let usefulButton;
let notInterestedButton;
let currentKnowledge;

// 初始化反馈按钮
function initFeedbackButtons() {
  usefulButton = document.getElementById('useful-btn');
  notInterestedButton = document.getElementById('not-interested-btn');
  
  if (!usefulButton || !notInterestedButton) return;
  
  // 添加点击事件
  usefulButton.addEventListener('click', () => {
    provideFeedback(FEEDBACK_TYPES.USEFUL);
    toggleButtonState(usefulButton, true);
    toggleButtonState(notInterestedButton, false);
  });
  
  notInterestedButton.addEventListener('click', () => {
    provideFeedback(FEEDBACK_TYPES.NOT_INTERESTED);
    toggleButtonState(notInterestedButton, true);
    toggleButtonState(usefulButton, false);
  });
}

// 切换按钮状态
function toggleButtonState(button, isActive) {
  if (isActive) {
    button.classList.add('active');
  } else {
    button.classList.remove('active');
  }
}

// 提供反馈
function provideFeedback(feedbackType) {
  if (!currentKnowledge) return;
  
  // 获取当前知识的主题标签
  const topics = extractTopics(currentKnowledge);
  
  // 保存反馈
  saveFeedback(currentKnowledge, feedbackType, topics);
  
  // 显示提示
  const message = feedbackType === FEEDBACK_TYPES.USEFUL ? 
    '感谢您的反馈！我们会推荐更多类似内容' : 
    '已记录您的反馈，我们会减少此类内容';
  
  if (typeof showToast === 'function') {
    showToast(message, 'success');
  }
}

// 保存反馈
function saveFeedback(content, feedbackType, topics) {
  chrome.storage.local.get(['userFeedback'], function(result) {
    const userFeedback = result.userFeedback || [];
    
    // 添加新反馈
    userFeedback.push({
      content: content,
      type: feedbackType,
      topics: topics,
      timestamp: new Date().toISOString()
    });
    
    // 限制存储数量，最多保留最近的50条反馈
    if (userFeedback.length > 50) {
      userFeedback.shift(); // 移除最旧的反馈
    }
    
    // 保存到存储
    chrome.storage.local.set({ 'userFeedback': userFeedback });
    
    // 更新用户兴趣模型
    updateUserInterestModel(feedbackType, topics);
  });
}

// 更新用户兴趣模型
function updateUserInterestModel(feedbackType, topics) {
  chrome.storage.local.get(['userInterestModel'], function(result) {
    const model = result.userInterestModel || {};
    
    // 遍历主题
    topics.forEach(topic => {
      if (!model[topic]) {
        model[topic] = 0;
      }
      
      // 根据反馈类型更新权重
      if (feedbackType === FEEDBACK_TYPES.USEFUL) {
        model[topic] += 1; // 喜欢，增加权重
      } else {
        model[topic] -= 0.5; // 不感兴趣，减少权重
      }
    });
    
    // 保存更新后的模型
    chrome.storage.local.set({ 'userInterestModel': model });
  });
}

// 从知识内容中提取主题标签
function extractTopics(content) {
  const topics = [];
  
  // 检查内容中是否包含各个领域的关键词
  if (/用户\s*研究|用户\s*访谈|用户\s*画像|用户\s*旅程|用户\s*体验|UX|用户\s*调研/i.test(content)) {
    topics.push('user_research');
  }
  
  if (/需求\s*分析|PRD|需求\s*文档|需求\s*管理|需求\s*优先级|MRD|BRD|用例/i.test(content)) {
    topics.push('requirement_analysis');
  }
  
  if (/产品\s*设计|交互\s*设计|原型|信息\s*架构|UI|界面|设计\s*系统|设计\s*规范/i.test(content)) {
    topics.push('product_design');
  }
  
  if (/数据\s*分析|指标|埋点|A\/B\s*测试|数据\s*驱动|转化率|留存|数据\s*可视化|BI/i.test(content)) {
    topics.push('data_analysis');
  }
  
  if (/项目\s*管理|敏捷|Scrum|看板|Sprint|迭代|项目\s*排期|资源\s*协调|里程碑/i.test(content)) {
    topics.push('project_management');
  }
  
  if (/市场\s*研究|竞品\s*分析|SWOT|波特五力|商业\s*模式|市场\s*趋势|行业\s*分析/i.test(content)) {
    topics.push('market_research');
  }
  
  if (/增长|用户\s*增长|留存\s*策略|转化|漏斗|获客|活跃|GMV|增长\s*黑客/i.test(content)) {
    topics.push('growth_hacking');
  }
  
  if (/产品\s*战略|路线图|战略\s*规划|商业\s*价值|愿景|使命|OKR|KPI|目标/i.test(content)) {
    topics.push('product_strategy');
  }
  
  // 如果没有匹配到任何主题，返回一个通用主题
  if (topics.length === 0) {
    topics.push('general');
  }
  
  return topics;
}

// 设置当前知识内容
function setCurrentKnowledge(knowledge) {
  currentKnowledge = knowledge;
  
  // 重置按钮状态
  if (usefulButton && notInterestedButton) {
    usefulButton.classList.remove('active');
    notInterestedButton.classList.remove('active');
  }
}

// 获取用户兴趣标签和兴趣模型的组合推荐
function getUserInterestTopics() {
  return new Promise(resolve => {
    chrome.storage.local.get(['userInterests', 'userInterestModel'], function(result) {
      const userInterests = result.userInterests || [];
      const interestModel = result.userInterestModel || {};
      
      // 如果用户没有选择任何兴趣标签，使用兴趣模型中权重最高的标签
      if (userInterests.length === 0) {
        const modelTopics = Object.entries(interestModel)
          .filter(([_, weight]) => weight > 0)
          .sort(([_, weightA], [__, weightB]) => weightB - weightA)
          .map(([topic, _]) => topic);
        
        // 如果模型中也没有正向权重的标签，返回空数组
        resolve(modelTopics.slice(0, 3));
        return;
      }
      
      // 结合用户选择的标签和兴趣模型
      // 按权重排序用户选择的标签
      const sortedInterests = [...userInterests].sort((a, b) => {
        const weightA = interestModel[a] || 0;
        const weightB = interestModel[b] || 0;
        return weightB - weightA;
      });
      
      resolve(sortedInterests);
    });
  });
}

// 导出函数
window.initFeedbackButtons = initFeedbackButtons;
window.setCurrentKnowledge = setCurrentKnowledge;
window.getUserInterestTopics = getUserInterestTopics;
// 产品经理领域兴趣标签数据
const interestTags = [
  { id: 'user_research', name: '用户研究', description: '用户访谈、用户画像、用户旅程图等' },
  { id: 'requirement_analysis', name: '需求分析', description: 'PRD编写、需求优先级排序、需求管理等' },
  { id: 'product_design', name: '产品设计', description: '交互设计、信息架构、原型设计等' },
  { id: 'data_analysis', name: '数据分析', description: '数据指标、A/B测试、数据驱动决策等' },
  { id: 'project_management', name: '项目管理', description: '敏捷开发、项目排期、资源协调等' },
  { id: 'market_research', name: '市场研究', description: '竞品分析、市场趋势、商业模式等' },
  { id: 'growth_hacking', name: '增长黑客', description: '用户增长、留存策略、转化率优化等' },
  { id: 'product_strategy', name: '产品战略', description: '产品路线图、战略规划、商业价值等' }
];

// 初始化兴趣标签选择界面
function initInterestTags() {
  const interestTagsContainer = document.getElementById('interest-tags-container');
  if (!interestTagsContainer) return;
  
  // 清空容器
  interestTagsContainer.innerHTML = '';
  
  // 获取已保存的用户兴趣
  chrome.storage.local.get(['userInterests'], function(result) {
    const userInterests = result.userInterests || [];
    
    // 创建标签元素
    interestTags.forEach(tag => {
      const tagElement = document.createElement('div');
      tagElement.className = 'interest-tag';
      if (userInterests.includes(tag.id)) {
        tagElement.classList.add('selected');
      }
      tagElement.dataset.id = tag.id;
      
      const tagName = document.createElement('div');
      tagName.className = 'tag-name';
      tagName.textContent = tag.name;
      
      const tagDescription = document.createElement('div');
      tagDescription.className = 'tag-description';
      tagDescription.textContent = tag.description;
      
      tagElement.appendChild(tagName);
      tagElement.appendChild(tagDescription);
      
      // 添加点击事件
      tagElement.addEventListener('click', function() {
        this.classList.toggle('selected');
        saveUserInterests();
      });
      
      interestTagsContainer.appendChild(tagElement);
    });
  });
}

// 保存用户兴趣标签
function saveUserInterests() {
  const selectedTags = document.querySelectorAll('.interest-tag.selected');
  const userInterests = Array.from(selectedTags).map(tag => tag.dataset.id);
  
  chrome.storage.local.set({ 'userInterests': userInterests }, function() {
    console.log('用户兴趣已保存:', userInterests);
  });
}

// 导出函数和数据
window.initInterestTags = initInterestTags;
window.interestTags = interestTags;
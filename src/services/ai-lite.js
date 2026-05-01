/**
 * AILiteService - 本地离线 AI 写作辅助
 * 100% 客户端计算，无需网络请求，无需外部库
 * 算法：关键词匹配 + 频率分析 + 规则推导
 * @version 1.0.0
 */

if (!window.AILiteService) {
class AILiteService {

  // ==========================================
  // 中文停用词 (高频无意义词)
  // ==========================================
  static STOP_WORDS = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    '自己', '这', '他', '她', '它', '们', '那', '里', '啊', '呢', '吧', '吗', '哦',
    '是', '有', '可以', '什么', '怎么', '为什么', '因为', '所以', '但是', '而且',
    '如果', '虽然', '不过', '然后', '然后呢', '就是', '这个', '那个', '这个',
    '之', '与', '及', '或', '等', '做', '被', '把', '让', '给', '从', '对', '来',
    '还', '又', '才', '吗', '吧', '呢', '啊', '呀', '哦', '嗯', '哈', '吧',
    'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to',
    'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
    'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'about',
    'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
    'she', 'her', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who',
    'this', 'that', 'these', 'those'
  ]);

  // ==========================================
  // 常见中文分类关键词
  // ==========================================
  static CATEGORY_KEYWORDS = {
    '生活': ['生活', '日常', '今天', '早上', '晚上', '周末', '天气', '吃饭', '睡觉', '上班', '下班', '逛街', '购物', '家务', '打扫', '洗衣', '做饭', '散步'],
    '工作': ['工作', '项目', '会议', '老板', '同事', '加班', '任务', '报告', '方案', '计划', '目标', '考核', '绩效', '工资', '离职', '入职', '面试', '简历', '职场', '客户', '产品', '需求', '开发', '测试', '上线', 'bug', '代码', '设计'],
    '学习': ['学习', '考试', '课程', '老师', '同学', '作业', '笔记', '复习', '预习', '成绩', '学校', '图书馆', '读书', '阅读', '知识', '论文', '毕业', '论文', '研究'],
    '旅行': ['旅行', '旅游', '出差', '风景', '酒店', '机票', '火车', '飞机', '景点', '拍照', '攻略', '民宿', '海边', '山', '公园', '门票', '行李', '出发', '到达', '目的地'],
    '美食': ['美食', '好吃', '餐厅', '菜', '火锅', '烧烤', '甜点', '奶茶', '咖啡', '做饭', '厨艺', '食材', '味道', '口感', '早餐', '午餐', '晚餐', '宵夜', '零食', '水果'],
    '心情': ['开心', '难过', '悲伤', '兴奋', '焦虑', '平静', '孤独', '温暖', '感动', '失落', '幸福', '烦恼', '压力', '放松', '希望', '梦想', '回忆', '想念', '感恩', '感谢'],
    '想法': ['想法', '思考', '感悟', '觉得', '认为', '观点', '反思', '总结', '体会', '理解', '意识', '发现', '意义', '价值', '人生', '哲学', '世界观', '价值观'],
    '计划': ['计划', '打算', '安排', '目标', '清单', 'todo', '待办', '下一步', '未来', '准备', '想要', '希望', '期待', '规划', '步骤', '时间表'],
    '回忆': ['回忆', '以前', '过去', '小时候', '记得', '那年', '曾经', '往事', '老友', '母校', '故乡', '童年', '青春', '岁月', '时光', '难忘'],
    '灵感': ['灵感', '创意', '想法', '突然', '想到', '如果', '也许', '或许', '想象', '幻想', '脑洞', '点子', '构思', '写作', '故事', '小说', '诗', '画']
  };

  // ==========================================
  // 情绪关键词词典 (含权重和极性)
  // ==========================================
  static SENTIMENT_DICT = {
    // 强烈正面 (+2)
    '太棒了': { score: 2, label: '非常积极' },
    '太好了': { score: 2, label: '非常积极' },
    '超级开心': { score: 2, label: '非常积极' },
    '幸福极了': { score: 2, label: '非常积极' },
    '无比激动': { score: 2, label: '非常积极' },
    '狂喜': { score: 2, label: '非常积极' },
    '完美': { score: 2, label: '非常积极' },
    '太幸福了': { score: 2, label: '非常积极' },
    '棒极了': { score: 2, label: '非常积极' },
    '令人振奋': { score: 2, label: '非常积极' },
    // 一般正面 (+1)
    '开心': { score: 1, label: '积极' },
    '快乐': { score: 1, label: '积极' },
    '高兴': { score: 1, label: '积极' },
    '愉快': { score: 1, label: '积极' },
    '满足': { score: 1, label: '积极' },
    '温暖': { score: 1, label: '积极' },
    '感动': { score: 1, label: '积极' },
    '喜欢': { score: 1, label: '积极' },
    '爱': { score: 1, label: '积极' },
    '美好': { score: 1, label: '积极' },
    '舒服': { score: 1, label: '积极' },
    '放松': { score: 1, label: '积极' },
    '期待': { score: 1, label: '积极' },
    '兴奋': { score: 1, label: '积极' },
    '惊喜': { score: 1, label: '积极' },
    '感恩': { score: 1, label: '积极' },
    '感谢': { score: 1, label: '积极' },
    '顺利': { score: 1, label: '积极' },
    '进步': { score: 1, label: '积极' },
    '成功': { score: 1, label: '积极' },
    '收获': { score: 1, label: '积极' },
    '希望': { score: 1, label: '积极' },
    '幸运': { score: 1, label: '积极' },
    // 强烈负面 (-2)
    '太糟糕了': { score: -2, label: '非常消极' },
    '绝望': { score: -2, label: '非常消极' },
    '崩溃': { score: -2, label: '非常消极' },
    '痛不欲生': { score: -2, label: '非常消极' },
    '愤怒至极': { score: -2, label: '非常消极' },
    '心如刀割': { score: -2, label: '非常消极' },
    '痛苦': { score: -2, label: '非常消极' },
    '受不了': { score: -2, label: '非常消极' },
    '无法忍受': { score: -2, label: '非常消极' },
    '极其': { score: -2, label: '非常消极' },
    // 一般负面 (-1)
    '难过': { score: -1, label: '消极' },
    '悲伤': { score: -1, label: '消极' },
    '失落': { score: -1, label: '消极' },
    '焦虑': { score: -1, label: '消极' },
    '烦恼': { score: -1, label: '消极' },
    '生气': { score: -1, label: '消极' },
    '愤怒': { score: -1, label: '消极' },
    '疲惫': { score: -1, label: '消极' },
    '累': { score: -1, label: '消极' },
    '孤独': { score: -1, label: '消极' },
    '寂寞': { score: -1, label: '消极' },
    '担心': { score: -1, label: '消极' },
    '害怕': { score: -1, label: '消极' },
    '迷茫': { score: -1, label: '消极' },
    '困惑': { score: -1, label: '消极' },
    '遗憾': { score: -1, label: '消极' },
    '后悔': { score: -1, label: '消极' },
    '无聊': { score: -1, label: '消极' },
    '厌倦': { score: -1, label: '消极' },
    '失望': { score: -1, label: '消极' },
    '压力': { score: -1, label: '消极' },
    '紧张': { score: -1, label: '消极' },
    '郁闷': { score: -1, label: '消极' },
    '沮丧': { score: -1, label: '消极' },
    '哭泣': { score: -1, label: '消极' },
    '哭': { score: -1, label: '消极' },
    '失败': { score: -1, label: '消极' },
    '挫折': { score: -1, label: '消极' }
  };

  // ==========================================
  // 写作问题检测规则
  // ==========================================
  static EMPTY_PHRASES = ['总而言之', '综上所述', '众所周知', '不可否认', '毫无疑问', '不可否认的是', '从古至今', '随着社会的不断发展', '在当今社会', '随着科技的进步', '在这个快节奏的时代', '每个人都知道'];

  // ==========================================
  // 写作灵感库 (50+ 条)
  // ==========================================
  static WRITING_PROMPTS = {
    '生活': [
      '描述你理想中的一天，从早晨醒来到夜晚入睡。',
      '写下最近让你感到温暖的一个小瞬间。',
      '回忆一个改变你生活习惯的决定。',
      '如果你可以给十年前的自己发一条短信，你会写什么？',
      '描述一个你最熟悉的城市角落。',
      '写一写你家附近的一条街，它的过去和现在。',
      '记录一次让你印象深刻的天气变化。',
      '写下你最喜欢的季节，以及为什么。',
      '描述一顿让你念念不忘的饭菜。',
      '记录一次你帮助陌生人或被陌生人帮助的经历。'
    ],
    '想法': [
      '你觉得"幸福"的定义是什么？',
      '写一写你对"自由"的理解。',
      '如果你可以选择一种超能力，你会选什么？为什么？',
      '你觉得科技的发展让我们的生活更好了吗？',
      '写一写你最近的一个感悟。',
      '你认为什么是"成熟"的标志？',
      '如果有机会和任何一个人对话，你想和谁聊？聊什么？',
      '你如何看待"独处"这件事？',
      '写下你对"成功"的重新定义。',
      '你觉得记忆是可以信赖的吗？为什么？'
    ],
    '回忆': [
      '写一写你小学时最要好的朋友。',
      '回忆你第一次独自旅行的经历。',
      '描述一个你至今难忘的节日。',
      '写下你童年最喜欢的一个游戏或玩具。',
      '回忆你学生时代最尴尬的一件事。',
      '写一写你的家乡，有什么只有当地人才知道的事？',
      '回忆一次让你成长的失败经历。',
      '写下你收到过的最特别的礼物。',
      '描述你第一次见到某个重要的人的场景。',
      '写一写你曾经的一个梦想，现在实现了吗？'
    ],
    '灵感': [
      '以"如果时间可以倒退"开头写一个故事。',
      '假设你是一棵树，用第一人称写一天。',
      '写一封信给你最喜欢的书中角色。',
      '如果动物会说话，你家宠物最想对你说什么？',
      '描述一个只有你能看到的颜色。',
      '用三句话写一个微型小说。',
      '如果明天是世界末日，今天你会做什么？',
      '写一个关于"门"的故事——它可以通向任何地方。',
      '描述一个你梦到过的奇怪场景。',
      '如果你的记忆可以像文件一样被删除，你会删掉哪段？'
    ],
    '工作学习': [
      '描述你第一次面试的经历。',
      '写一写你在学习/工作中遇到的最大挑战。',
      '你理想中的工作是什么样的？',
      '回忆一位对你影响最深的老师或领导。',
      '写一写你最近学到的一个新技能。',
      '描述一次团队合作中让你印象深刻的经历。',
      '如果你是校长/CEO，你最想改变的一件事是什么？',
      '写一写你对终身学习的看法。',
      '记录一次你从失败中学到的教训。',
      '描述你最喜欢的一个学习/工作方法。'
    ]
  };

  // ==========================================
  // 1. 提取式摘要 - 基于关键词频率和位置评分
  // ==========================================
  static generateSummary(text) {
    if (!text || text.length < 20) {
      return text || '';
    }

    const plainText = AILiteService._stripHTML(text);
    const sentences = AILiteService._splitSentences(plainText);

    if (sentences.length <= 3) {
      return plainText;
    }

    // 统计词频 (去除停用词)
    const wordFreq = {};
    const allWords = AILiteService._tokenize(plainText);
    allWords.forEach(w => {
      if (!AILiteService.STOP_WORDS.has(w) && w.length >= 1) {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      }
    });

    // 对每句话评分
    const scored = sentences.map((sentence, idx) => {
      const words = AILiteService._tokenize(sentence);
      let score = 0;
      words.forEach(w => {
        if (wordFreq[w]) score += wordFreq[w];
      });

      // 位置加分：开头和结尾的句子更重要
      if (idx === 0) score *= 1.5;
      else if (idx === sentences.length - 1) score *= 1.2;
      else if (idx < 3) score *= 1.3;

      // 长度惩罚：过短或过长的句子降权
      if (sentence.length < 10) score *= 0.5;
      if (sentence.length > 100) score *= 0.7;

      // 包含指示词的句子加分
      if (/[首先|总之|因此|所以|关键|重要|发现|总结]/.test(sentence)) {
        score *= 1.2;
      }

      return { sentence, score, idx };
    });

    // 取前 3 句，按原文顺序排列
    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3);
    top3.sort((a, b) => a.idx - b.idx);

    return top3.map(s => s.sentence).join('');
  }

  // ==========================================
  // 2. 标签建议 - 基于 TF-IDF 类方法 + 分类匹配
  // ==========================================
  static suggestTags(text, existingTags) {
    if (!text) return [];

    const plainText = AILiteService._stripHTML(text);
    const words = AILiteService._tokenize(plainText);

    // 计算词频
    const freq = {};
    words.forEach(w => {
      if (!AILiteService.STOP_WORDS.has(w) && w.length >= 1) {
        freq[w] = (freq[w] || 0) + 1;
      }
    });

    // 取高频词 (出现 >= 2 次，或长度 >= 2 的单次词)
    const keywords = Object.entries(freq)
      .filter(([word, count]) => count >= 2 || (count >= 1 && word.length >= 2))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);

    // 匹配常见分类
    const categories = [];
    for (const [category, keywords_list] of Object.entries(AILiteService.CATEGORY_KEYWORDS)) {
      let matchCount = 0;
      keywords_list.forEach(kw => {
        if (plainText.includes(kw)) matchCount++;
      });
      if (matchCount >= 2) {
        categories.push({ category, matchCount });
      }
    }
    categories.sort((a, b) => b.matchCount - a.matchCount);

    // 合并结果
    const existingSet = new Set((existingTags || []).map(t => t.trim()));
    const result = [];

    // 先加匹配的常见分类
    categories.forEach(c => {
      if (!existingSet.has(c.category) && !result.includes(c.category)) {
        result.push(c.category);
      }
    });

    // 再加高频关键词（不超过5个）
    keywords
      .filter(kw => !existingSet.has(kw) && !result.includes(kw))
      .slice(0, 5)
      .forEach(kw => result.push(kw));

    return result.slice(0, 8);
  }

  // ==========================================
  // 3. 情绪检测 - 基于关键词情感词典
  // ==========================================
  static detectMood(text) {
    if (!text) {
      return { mood: '中性', confidence: 0, keywords: [] };
    }

    const plainText = AILiteService._stripHTML(text);
    let totalScore = 0;
    const foundKeywords = [];

    // 扫描情绪词典
    for (const [keyword, info] of Object.entries(AILiteService.SENTIMENT_DICT)) {
      const regex = new RegExp(keyword, 'g');
      const matches = plainText.match(regex);
      if (matches) {
        totalScore += info.score * matches.length;
        foundKeywords.push(keyword);
      }
    }

    // 检测否定词 (简单规则)
    const negationWords = ['不', '没有', '没', '非', '无', '未', '别', '莫', '勿'];
    let negationCount = 0;
    negationWords.forEach(nw => {
      const regex = new RegExp(nw + '[得的]?(难过|开心|高兴|快乐|喜欢|好)', 'g');
      if (regex.test(plainText)) negationCount++;
    });

    totalScore -= negationCount * 0.5;

    // 判定情绪级别
    let mood, confidence;
    if (totalScore >= 4) {
      mood = '非常积极';
      confidence = Math.min(1, totalScore / 10);
    } else if (totalScore >= 1.5) {
      mood = '积极';
      confidence = Math.min(1, totalScore / 6);
    } else if (totalScore <= -4) {
      mood = '非常消极';
      confidence = Math.min(1, Math.abs(totalScore) / 10);
    } else if (totalScore <= -1.5) {
      mood = '消极';
      confidence = Math.min(1, Math.abs(totalScore) / 6);
    } else {
      mood = '中性';
      confidence = Math.max(0.1, 1 - Math.abs(totalScore) / 3);
    }

    confidence = Math.round(confidence * 100) / 100;

    return {
      mood,
      confidence,
      keywords: foundKeywords.slice(0, 8)
    };
  }

  // ==========================================
  // 4. 写作建议 - 检测常见写作问题
  // ==========================================
  static writingTips(text) {
    if (!text) return [];

    const plainText = AILiteService._stripHTML(text);
    const tips = [];

    // 检测重复词语 (如 "好好好"、"非常非常")
    const repeatRegex = /([一-鿿\w]+)\1{2,}/g;
    let match;
    while ((match = repeatRegex.exec(plainText)) !== null) {
      tips.push({
        type: '重复词语',
        position: match.index,
        text: match[0],
        suggestion: `检测到重复词语 "${match[0]}"，建议保留一个或两个即可`
      });
    }

    // 检测超长句子 (> 50 字)
    const sentences = plainText.split(/[。！？；\n]+/);
    let pos = 0;
    sentences.forEach(sentence => {
      if (sentence.length > 50) {
        tips.push({
          type: '句子过长',
          position: pos,
          text: sentence.substring(0, 30) + '...',
          suggestion: `该句长达 ${sentence.length} 字，建议拆分为 2-3 个短句以提升可读性`
        });
      }
      pos += sentence.length + 1;
    });

    // 检测空话套话
    AILiteService.EMPTY_PHRASES.forEach(phrase => {
      const idx = plainText.indexOf(phrase);
      if (idx >= 0) {
        tips.push({
          type: '空话套话',
          position: idx,
          text: phrase,
          suggestion: `"${phrase}" 是常见套话，建议删除或用具体内容替代`
        });
      }
    });

    // 检测过度使用感叹号
    const exclCount = (plainText.match(/！/g) || []).length + (plainText.match(/!/g) || []).length;
    if (exclCount > 5) {
      tips.push({
        type: '标点过度',
        position: -1,
        text: `${exclCount} 个感叹号`,
        suggestion: `文中使用了 ${exclCount} 个感叹号，建议适度使用以保留表达力`
      });
    }

    // 检测段落过短 (单句成段)
    const paragraphs = plainText.split(/\n+/).filter(p => p.trim());
    paragraphs.forEach((p, i) => {
      if (p.trim().length < 15 && p.length > 0) {
        tips.push({
          type: '段落过短',
          position: plainText.indexOf(p),
          text: p.trim().substring(0, 20),
          suggestion: `该段仅 ${p.trim().length} 字，建议展开更多细节或合并到其他段落`
        });
      }
    });

    return tips;
  }

  // ==========================================
  // 5. 随机写作灵感
  // ==========================================
  static generateWritingPrompt(category) {
    const allPrompts = [];

    if (category && AILiteService.WRITING_PROMPTS[category]) {
      allPrompts.push(...AILiteService.WRITING_PROMPTS[category]);
    } else {
      // 合并所有分类
      Object.values(AILiteService.WRITING_PROMPTS).forEach(list => {
        allPrompts.push(...list);
      });
    }

    if (allPrompts.length === 0) {
      return '随便写点什么吧，重要的是开始。';
    }

    return allPrompts[Math.floor(Math.random() * allPrompts.length)];
  }

  // ==========================================
  // 工具方法
  // ==========================================

  /**
   * 去除 HTML 标签
   */
  static _stripHTML(html) {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(p|div|li|tr|h[1-6]|blockquote)[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&\w+;/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  /**
   * 分句 (支持中英文标点)
   */
  static _splitSentences(text) {
    if (!text) return [];
    const sentences = text.match(/[^。！？\n]+[。！？\n]?/g);
    return sentences ? sentences.map(s => s.trim()).filter(Boolean) : [text];
  }

  /**
   * 简单分词 (基于常见中文词边界和英文单词)
   */
  static _tokenize(text) {
    if (!text) return [];
    const tokens = [];

    // 提取 2-4 字中文词组
    const chineseChars = text.replace(/[^一-鿿]/g, '');
    for (let len = 2; len <= 4; len++) {
      for (let i = 0; i <= chineseChars.length - len; i++) {
        tokens.push(chineseChars.substring(i, i + len));
      }
    }

    // 提取英文单词
    const englishWords = text.match(/[a-zA-Z]+/g);
    if (englishWords) tokens.push(...englishWords);

    return tokens;
  }
}

window.AILiteService = AILiteService;
console.log('[AILiteService] 离线 AI 写作辅助服务已定义');
} else {
  console.log('[AILiteService] 已存在，跳过加载');
}

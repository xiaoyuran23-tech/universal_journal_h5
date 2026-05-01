/**
 * StreakService - 连续记录天数追踪
 * @version 7.0.0
 */

if (!window.StreakService) {
const StreakService = {
  STORAGE_KEY: 'journal_streak_data',

  getData() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : { currentStreak: 0, longestStreak: 0, lastRecordDate: null };
    } catch { return { currentStreak: 0, longestStreak: 0, lastRecordDate: null }; }
  },

  /**
   * 记录今天的记录，更新连续天数
   * @param {string} recordDate - ISO 日期字符串 (YYYY-MM-DD)
   */
  recordToday(recordDate) {
    const data = this.getData();
    const today = new Date().toISOString().split('T')[0];
    const recordDay = recordDate || today;

    if (data.lastRecordDate === recordDay) return data; // 今天已记录过

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (data.lastRecordDate === yesterdayStr || data.lastRecordDate === null) {
      // 连续：昨天有记录 + 今天记录了 = streak +1
      data.currentStreak += 1;
    } else {
      // 断掉了：重新开始
      data.currentStreak = 1;
    }

    data.lastRecordDate = recordDay;
    if (data.currentStreak > data.longestStreak) {
      data.longestStreak = data.currentStreak;
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    return data;
  },

  /**
   * 检查今天是否已记录
   */
  isTodayRecorded() {
    const data = this.getData();
    return data.lastRecordDate === new Date().toISOString().split('T')[0];
  },

  getBadge() {
    const data = this.getData();
    if (data.currentStreak === 0) return null;
    return {
      current: data.currentStreak,
      longest: data.longestStreak,
      isToday: this.isTodayRecorded()
    };
  }
};

window.StreakService = StreakService;
console.log('[StreakService] 连续打卡服务已加载');
}

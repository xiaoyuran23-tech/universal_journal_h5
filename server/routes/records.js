/**
 * 记录 CRUD 路由
 */
import { Router } from 'express';
import JournalRecord from '../models/JournalRecord.js';
import authMiddleware from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/records
 * 获取用户的所有记录（支持分页和筛选）
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50, tags, mood, favorite, search } = req.query;
    const query = { userId: req.userId, deleted: false };

    if (tags) query.tags = { $in: tags.split(',') };
    if (mood) query.mood = mood;
    if (favorite === 'true') query.favorite = true;
    if (search) query.$text = { $search: search };

    const records = await JournalRecord.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const total = await JournalRecord.countDocuments(query);

    res.json({ records, total, page: Number(page), hasMore: total > page * limit });
  } catch (err) {
    console.error('[Records] Get all error:', err);
    res.status(500).json({ error: '获取记录失败' });
  }
});

/**
 * GET /api/records/:id
 * 获取单条记录
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const record = await JournalRecord.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!record) return res.status(404).json({ error: '记录不存在' });
    res.json({ record });
  } catch (err) {
    console.error('[Records] Get one error:', err);
    res.status(500).json({ error: '获取记录失败' });
  }
});

/**
 * POST /api/records
 * 创建记录
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    // 获取并递增 USN
    const userDoc = await import('../models/User.js').then(m => m.default.findById(req.userId));
    userDoc.userMaxUsn += 1;
    await userDoc.save();

    const record = new JournalRecord({
      ...req.body,
      userId: req.userId,
      usn: userDoc.userMaxUsn
    });
    await record.save();

    res.status(201).json({ record, usn: userDoc.userMaxUsn });
  } catch (err) {
    console.error('[Records] Create error:', err);
    res.status(500).json({ error: '创建记录失败' });
  }
});

/**
 * PUT /api/records/:id
 * 更新记录
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const record = await JournalRecord.findOne({ _id: req.params.id, userId: req.userId });
    if (!record) return res.status(404).json({ error: '记录不存在' });

    // 递增 USN
    const userDoc = await import('../models/User.js').then(m => m.default.findById(req.userId));
    userDoc.userMaxUsn += 1;
    await userDoc.save();

    Object.assign(record, req.body, { usn: userDoc.userMaxUsn });
    await record.save();

    res.json({ record, usn: userDoc.userMaxUsn });
  } catch (err) {
    console.error('[Records] Update error:', err);
    res.status(500).json({ error: '更新记录失败' });
  }
});

/**
 * DELETE /api/records/:id
 * 删除记录（软删除）
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const record = await JournalRecord.findOne({ _id: req.params.id, userId: req.userId });
    if (!record) return res.status(404).json({ error: '记录不存在' });

    // 递增 USN
    const userDoc = await import('../models/User.js').then(m => m.default.findById(req.userId));
    userDoc.userMaxUsn += 1;
    await userDoc.save();

    record.deleted = true;
    record.deletedAt = new Date();
    record.trashAt = new Date();
    record.usn = userDoc.userMaxUsn;
    await record.save();

    res.json({ message: '已删除', usn: userDoc.userMaxUsn });
  } catch (err) {
    console.error('[Records] Delete error:', err);
    res.status(500).json({ error: '删除记录失败' });
  }
});

/**
 * GET /api/records/on-this-day
 * 那年今日 - 获取历史上今天的记录
 */
router.get('/on-this-day', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const month = now.getMonth();
    const day = now.getDate();

    const records = await JournalRecord.find({
      userId: req.userId,
      deleted: false,
      $expr: {
        $and: [
          { $eq: [{ $month: '$createdAt' }, month + 1] },
          { $eq: [{ $dayOfMonth: '$createdAt' }, day] }
        ]
      }
    }).sort({ createdAt: -1 }).lean();

    res.json({ records, year: now.getFullYear() - records[0]?.createdAt?.getFullYear() || 0 });
  } catch (err) {
    console.error('[Records] On this day error:', err);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * GET /api/records/stats
 * 获取统计信息（记录总数、心情分布、连续天数等）
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const totalRecords = await JournalRecord.countDocuments({ userId: req.userId, deleted: false });
    const totalFavorites = await JournalRecord.countDocuments({ userId: req.userId, favorite: true, deleted: false });

    // 心情分布
    const moodStats = await JournalRecord.aggregate([
      { $match: { userId: req.userId, deleted: false, mood: { $ne: null } } },
      { $group: { _id: '$mood', count: { $sum: 1 } } }
    ]);

    res.json({ totalRecords, totalFavorites, moodStats });
  } catch (err) {
    console.error('[Records] Stats error:', err);
    res.status(500).json({ error: '获取统计失败' });
  }
});

export default router;

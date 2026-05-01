/**
 * 增量同步路由 - 基于 USN 的双向同步
 */
import { Router } from 'express';
import JournalRecord from '../models/JournalRecord.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/sync/pull
 * 拉取服务端变更（客户端 → 服务端请求）
 * 返回 lastSyncUsN 之后所有变更的记录
 */
router.post('/pull', authMiddleware, async (req, res) => {
  try {
    const { lastSyncUsn = 0 } = req.body;
    const userId = req.userId;

    // 获取服务端变更
    const changes = await JournalRecord.find({
      userId,
      usn: { $gt: lastSyncUsn }
    }).lean();

    // 获取用户当前 USN
    const user = await User.findById(userId);

    res.json({
      changes,
      serverUsn: user.userMaxUsn,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Sync] Pull error:', err);
    res.status(500).json({ error: '拉取同步失败' });
  }
});

/**
 * POST /api/sync/push
 * 推送本地变更到服务端
 */
router.post('/push', authMiddleware, async (req, res) => {
  try {
    const { changes } = req.body; // [{ id, action, data }]
    const userId = req.userId;
    let syncedCount = 0;

    for (const change of changes) {
      switch (change.action) {
        case 'create': {
          const userDoc = await User.findById(userId);
          userDoc.userMaxUsn += 1;
          await userDoc.save();

          await JournalRecord.create({
            ...change.data,
            userId,
            _id: change.data._id || undefined,
            usn: userDoc.userMaxUsn
          });
          syncedCount++;
          break;
        }

        case 'update': {
          const record = await JournalRecord.findOne({ _id: change.data._id, userId });
          if (record) {
            // 仅当服务端版本不更新时才覆盖（避免覆盖其他设备的新数据）
            if (record.usn <= (change.data.usn || 0)) {
              const userDoc = await User.findById(userId);
              userDoc.userMaxUsn += 1;
              await userDoc.save();

              Object.assign(record, change.data, { usn: userDoc.userMaxUsn });
              await record.save();
              syncedCount++;
            }
          }
          break;
        }

        case 'delete': {
          const record = await JournalRecord.findOne({ _id: change.data._id, userId });
          if (record && !record.deleted) {
            const userDoc = await User.findById(userId);
            userDoc.userMaxUsn += 1;
            await userDoc.save();

            record.deleted = true;
            record.deletedAt = new Date();
            record.trashAt = new Date();
            record.usn = userDoc.userMaxUsn;
            await record.save();
            syncedCount++;
          }
          break;
        }
      }
    }

    const user = await User.findById(userId);
    res.json({ syncedCount, serverUsn: user.userMaxUsn });
  } catch (err) {
    console.error('[Sync] Push error:', err);
    res.status(500).json({ error: '推送同步失败' });
  }
});

/**
 * POST /api/sync/full
 * 完整同步：先推送本地变更，再拉取服务端变更
 */
router.post('/full', authMiddleware, async (req, res) => {
  try {
    const { lastSyncUsn = 0, changes = [] } = req.body;
    const userId = req.userId;

    // 1. 推送本地变更
    let pushCount = 0;
    for (const change of changes) {
      const userDoc = await User.findById(userId);
      userDoc.userMaxUsn += 1;
      await userDoc.save();

      if (change.action === 'create') {
        await JournalRecord.create({
          ...change.data,
          userId,
          usn: userDoc.userMaxUsn
        });
      } else if (change.action === 'update') {
        const record = await JournalRecord.findOne({ _id: change.data._id, userId });
        if (record && record.usn <= (change.data.usn || 0)) {
          Object.assign(record, change.data, { usn: userDoc.userMaxUsn });
          await record.save();
        }
      } else if (change.action === 'delete') {
        const record = await JournalRecord.findOne({ _id: change.data._id, userId });
        if (record && !record.deleted) {
          record.deleted = true;
          record.deletedAt = new Date();
          record.usn = userDoc.userMaxUsn;
          await record.save();
        }
      }
      pushCount++;
    }

    // 2. 拉取服务端变更
    const serverChanges = await JournalRecord.find({
      userId,
      usn: { $gt: lastSyncUsn }
    }).lean();

    const user = await User.findById(userId);
    user.lastSyncAt = new Date();
    await user.save();

    res.json({
      pushed: pushCount,
      pulled: serverChanges.length,
      changes: serverChanges,
      serverUsn: user.userMaxUsn,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Sync] Full sync error:', err);
    res.status(500).json({ error: '完整同步失败' });
  }
});

/**
 * GET /api/sync/status
 * 获取同步状态
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('userMaxUsn lastSyncAt devices');
    const totalRecords = await JournalRecord.countDocuments({ userId: req.userId, deleted: false });

    res.json({
      serverUsn: user.userMaxUsn,
      lastSyncAt: user.lastSyncAt,
      totalRecords,
      devices: user.devices
    });
  } catch (err) {
    console.error('[Sync] Status error:', err);
    res.status(500).json({ error: '获取状态失败' });
  }
});

export default router;

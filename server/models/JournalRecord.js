/**
 * JournalRecord 模型 - 日记记录
 */
import mongoose from 'mongoose';

const recordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // 记录内容
  name: { type: String, default: '' },
  notes: { type: String, default: '' },
  title: { type: String, default: '' },
  // 元数据
  tags: [{ type: String }],
  photos: [{ type: String }],
  mood: { type: String, enum: ['great', 'good', 'neutral', 'bad', 'awful'], default: null },
  activities: [{ type: String }],
  status: { type: String, default: 'in-use' },
  date: String,
  city: String,
  location: {
    lat: Number,
    lng: Number,
    address: String
  },
  weather: String,
  temperature: Number,
  favorite: { type: Boolean, default: false },
  metadata: mongoose.Schema.Types.Mixed,
  // 软删除
  deleted: { type: Boolean, default: false },
  deletedAt: Date,
  trashAt: Date,
  // 同步相关
  usn: { type: Number, default: 0, index: true },
  // 时间
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// 复合索引：用户 + 更新时间
recordSchema.index({ userId: 1, updatedAt: -1 });
// 复合索引：用户 + USN（增量同步用）
recordSchema.index({ userId: 1, usn: 1 });
// 全文搜索索引
recordSchema.index({ name: 'text', notes: 'text', title: 'text', tags: 'text' });

export default mongoose.model('JournalRecord', recordSchema);

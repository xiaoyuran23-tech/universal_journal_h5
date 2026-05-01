/**
 * User 模型 - 用户账号
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  nickname: {
    type: String,
    default: '手札用户'
  },
  avatar: String,
  // 全局 USN（Update Sequence Number）- 用于增量同步
  userMaxUsn: {
    type: Number,
    default: 0
  },
  // 设备列表
  devices: [{
    deviceId: String,
    deviceName: String,
    lastSyncAt: Date
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// 密码加密钩子
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// 密码验证方法
userSchema.methods.verifyPassword = async function(plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// 返回不包含密码的用户信息
userSchema.methods.toSafeJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('User', userSchema);

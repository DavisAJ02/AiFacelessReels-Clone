import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    googleId: { type: String, default: null, sparse: true },
    name: { type: String, default: '' },
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    subscriptionStatus: { type: String, default: null },
    videosGeneratedThisPeriod: { type: Number, default: 0 },
    usagePeriodStart: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

export const User = mongoose.model('User', userSchema);

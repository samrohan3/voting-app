import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  mobile: string;
  hasVoted: boolean;
  role: 'voter' | 'admin';
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  mobile: { type: String, required: true, unique: true },
  hasVoted: { type: Boolean, default: false },
  role: { type: String, enum: ['voter', 'admin'], default: 'voter' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IUser>('User', UserSchema);

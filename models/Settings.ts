import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
  isVotingActive: boolean;
  startTime: string;
  endTime: string;
  enforceTimeWindow: boolean;
}

const SettingsSchema: Schema = new Schema({
  isVotingActive: { type: Boolean, default: true },
  startTime: { type: String, default: '09:00' },
  endTime: { type: String, default: '17:00' },
  enforceTimeWindow: { type: Boolean, default: true }
});

export default mongoose.model<ISettings>('Settings', SettingsSchema);

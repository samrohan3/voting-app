import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
  isVotingActive: boolean;
}

const SettingsSchema: Schema = new Schema({
  isVotingActive: { type: Boolean, default: true }
});

export default mongoose.model<ISettings>('Settings', SettingsSchema);

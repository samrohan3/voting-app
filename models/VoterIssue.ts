import mongoose, { Schema, Document } from 'mongoose';

export interface IVoterIssue extends Document {
  userId: mongoose.Types.ObjectId;
  photoBase64: string;
  status: 'pending' | 'resolved';
  createdAt: Date;
}

const VoterIssueSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  photoBase64: { type: String, required: true },
  status: { type: String, enum: ['pending', 'resolved'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IVoterIssue>('VoterIssue', VoterIssueSchema);

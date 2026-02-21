import mongoose, { Schema, Document } from 'mongoose';

export interface IBlock extends Document {
  index: number;
  timestamp: number;
  partyId: string;
  voterId: string; // Hashed mobile
  previousHash: string;
  hash: string;
  nonce: number;
}

const BlockSchema: Schema = new Schema({
  index: { type: Number, required: true },
  timestamp: { type: Number, required: true },
  partyId: { type: String, required: true },
  voterId: { type: String, required: true },
  previousHash: { type: String, required: true },
  hash: { type: String, required: true },
  nonce: { type: Number, required: true }
});

export default mongoose.model<IBlock>('Block', BlockSchema);

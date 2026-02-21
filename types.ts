
export enum AppState {
  REGISTRATION = 'REGISTRATION',
  OTP_VERIFICATION = 'OTP_VERIFICATION',
  VOTING_BOOTH = 'VOTING_BOOTH',
  VOTE_CONFIRMED = 'VOTE_CONFIRMED',
  RESULTS = 'RESULTS',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD'
}

export interface Party {
  id: string;
  name: string;
  symbol: string;
  color: string;
}

export interface Block {
  index: number;
  timestamp: number | string;
  partyId: string;
  voterId: string;
  previousHash: string;
  hash: string;
  nonce: number;
}

export const PARTIES: Party[] = [
  { id: 'p1', name: 'Liberty Alliance', symbol: '🗽', color: 'blue' },
  { id: 'p2', name: 'Green Growth', symbol: '🌿', color: 'green' },
  { id: 'p3', name: 'Digital Progress', symbol: '💻', color: 'purple' },
  { id: 'p4', name: 'Heritage Front', symbol: '🏰', color: 'amber' }
];

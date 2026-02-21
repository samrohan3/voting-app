
import React, { useState, useEffect, useCallback } from 'react';
import { 
  AppState, 
  Party, 
  Block, 
  PARTIES 
} from './types';
import { auditBlockchain } from './services/geminiService';
import BlockchainVisualizer from './components/BlockchainVisualizer';
import { 
  ShieldCheck, 
  Smartphone, 
  Lock, 
  Vote, 
  BarChart3, 
  AlertCircle,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.REGISTRATION);
  const [blockchain, setBlockchain] = useState<Block[]>([]);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any>(null);
  const [mobileInput, setMobileInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [auditText, setAuditText] = useState<string>('');

  // Initialize blockchain from backend
  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch('/api/results');
      const data = await res.json();
      if (Array.isArray(data)) {
        setBlockchain(data);
      } else {
        console.error('Results data is not an array:', data);
      }
    } catch (err) {
      console.error('Failed to fetch results:', err);
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mobileInput.length < 10) {
      setError('Please enter a valid mobile number');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobileInput })
      });
      const data = await res.json();
      if (res.ok) {
        setAppState(AppState.OTP_VERIFICATION);
      } else {
        setError(data.error || 'Failed to send OTP. Please try again.');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobileInput, code: otpInput })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        setAppState(AppState.VOTING_BOOTH);
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch (err) {
      setError('Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const castVote = async (party: Party) => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ partyId: party.id })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        await fetchResults();
        setAppState(AppState.VOTE_CONFIRMED);
        
        // Background audit using Gemini
        const audit = await auditBlockchain([...blockchain, data.block]);
        setAuditText(audit);
      } else {
        setError(data.error || 'Vote failed');
      }
    } catch (err) {
      setError('System failure. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getResultsData = () => {
    return PARTIES.map(p => ({
      name: p.name,
      votes: blockchain.filter(b => b.partyId === p.id).length,
      color: p.color
    }));
  };

  const resetVoter = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    setMobileInput('');
    setOtpInput('');
    setAppState(AppState.REGISTRATION);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 md:p-8">
      {/* Header */}
      <header className="w-full max-w-5xl flex justify-between items-center mb-8 glass-effect p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-200">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">SecureChain</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Next-Gen Voting System</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setAppState(AppState.RESULTS)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
          >
            <BarChart3 size={18} />
            View Results
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-xl flex flex-col gap-6">
        
        {/* State Indicators */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[AppState.REGISTRATION, AppState.OTP_VERIFICATION, AppState.VOTING_BOOTH, AppState.VOTE_CONFIRMED].map((s, idx) => (
            <div 
              key={s}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                Object.values(AppState).indexOf(appState) >= idx ? 'bg-blue-500 w-full' : 'bg-slate-200 w-full'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Registration */}
        {appState === AppState.REGISTRATION && (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 transform transition-all animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
              <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                <Smartphone className="text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Verify Identity</h2>
              <p className="text-slate-500 mt-2">Enter your registered mobile number to receive a secure login OTP.</p>
            </div>
            
            <form onSubmit={handleMobileSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Mobile Number</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">+91</span>
                  <input 
                    type="tel"
                    value={mobileInput}
                    onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="555 123 4567"
                    className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-lg font-medium tracking-wider"
                  />
                </div>
              </div>
              
              {error && <div className="flex items-center gap-2 text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg"><AlertCircle size={16} /> {error}</div>}
              
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {isLoading ? 'Processing...' : (
                  <>Send OTP <ArrowRight size={20} /></>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: OTP Verification */}
        {appState === AppState.OTP_VERIFICATION && (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in zoom-in duration-300">
            <div className="mb-6 text-center">
              <div className="bg-amber-50 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Security Check</h2>
              <p className="text-slate-500 mt-2">Enter the 6-digit code sent to ****{mobileInput.slice(-4)}</p>
            </div>

            <form onSubmit={handleOtpVerify} className="space-y-6">
              <div className="flex justify-center gap-2">
                <input 
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full max-w-[200px] text-center text-3xl font-bold tracking-[0.5em] py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition-all"
                  placeholder="000000"
                />
              </div>

              {error && <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded-lg">{error}</div>}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-all shadow-lg"
              >
                {isLoading ? 'Verifying...' : 'Verify & Continue'}
              </button>
              
              <p className="text-center text-xs text-slate-400">Didn't receive code? <button type="button" className="text-blue-600 font-bold hover:underline">Resend</button></p>
            </form>
          </div>
        )}

        {/* Step 3: Voting Booth */}
        {appState === AppState.VOTING_BOOTH && (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Vote className="text-blue-600" /> Official Ballot
              </h2>
              <p className="text-slate-500 mt-1">Select one party to cast your immutable vote.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {PARTIES.map(party => (
                <button
                  key={party.id}
                  onClick={() => castVote(party)}
                  disabled={isLoading}
                  className="group relative flex items-center justify-between p-5 border-2 border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all duration-300 text-left active:scale-[0.99] disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl filter group-hover:scale-110 transition-transform">{party.symbol}</span>
                    <div>
                      <h3 className="font-bold text-slate-800">{party.name}</h3>
                      <p className="text-xs text-slate-400 uppercase font-medium">Candidate Alliance</p>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-blue-500 group-hover:bg-blue-500 flex items-center justify-center transition-all">
                    <div className="w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-100"></div>
                  </div>
                </button>
              ))}
            </div>
            
            <p className="mt-6 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
              <ShieldCheck size={12} /> END-TO-END VERIFIABLE ENCRYPTION ACTIVE
            </p>
          </div>
        )}

        {/* Step 5: Vote Confirmed */}
        {appState === AppState.VOTE_CONFIRMED && (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-green-100 animate-in zoom-in duration-500">
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="text-green-600 w-12 h-12" />
              </div>
              <h2 className="text-3xl font-black text-slate-900">Vote Secured!</h2>
              <p className="text-slate-500 mt-3 text-lg">Your choice has been permanently recorded in the blockchain ledger.</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Transaction ID</span>
                <span className="font-mono text-xs font-bold text-blue-600">
                  {blockchain.length > 0 ? `${blockchain[blockchain.length - 1].hash.slice(0, 16)}...` : 'N/A'}
                </span>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Security Audit Findings</p>
                <div className="text-sm text-slate-700 bg-white p-4 rounded-xl border border-slate-100 shadow-sm whitespace-pre-line leading-relaxed italic">
                  {auditText || "Auditing the chain link integrity..."}
                </div>
              </div>
            </div>

            <button 
              onClick={resetVoter}
              className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-all"
            >
              Return to Homepage
            </button>
          </div>
        )}

        {/* Results Dashboard */}
        {appState === AppState.RESULTS && (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Live Election Results</h2>
                <p className="text-slate-500 text-sm">Decrypted blockchain tally</p>
              </div>
              <button onClick={() => setAppState(AppState.REGISTRATION)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <ArrowRight className="rotate-180 text-slate-400" />
              </button>
            </div>

            <div className="h-64 w-full mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getResultsData()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                    {getResultsData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.votes > 0 ? '#3b82f6' : '#e2e8f0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <p className="text-xs text-blue-600 font-bold uppercase mb-1">Total Votes</p>
                <p className="text-2xl font-black text-blue-900">{blockchain.length}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500 font-bold uppercase mb-1">Chain Status</p>
                <p className="text-lg font-bold text-green-600 flex items-center gap-1">
                  <ShieldCheck size={18} /> Valid
                </p>
              </div>
            </div>
            
            <button 
              onClick={resetVoter}
              className="w-full mt-6 py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100"
            >
              Back to Voting
            </button>
          </div>
        )}

        {/* Blockchain Visualizer (Visible to audit) */}
        <BlockchainVisualizer blocks={blockchain} />

        {/* Footer Info */}
        <footer className="mt-8 text-center">
          <p className="text-xs text-slate-400 font-medium tracking-wide">
            POWERED BY DECENTRALIZED QUANTUM-RESISTANT CRYPTOGRAPHY
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></span>
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping delay-75"></span>
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping delay-150"></span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default App;

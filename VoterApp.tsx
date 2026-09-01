import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Party, Block, PARTIES } from './types';
import { auditBlockchain } from './services/geminiService';
import BlockchainVisualizer from './components/BlockchainVisualizer';
import Webcam from 'react-webcam';
import { 
  ShieldCheck, Smartphone, Lock, Vote, AlertCircle, ArrowRight, CheckCircle2, Camera, Clock
} from 'lucide-react';

const VoterApp: React.FC = () => {
  const [appState, setAppState] = useState<AppState | 'SECURITY_CHECK' | 'FACE_SCAN'>(AppState.REGISTRATION);
  const [isVotingActive, setIsVotingActive] = useState<boolean | null>(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [enforceTimeWindow, setEnforceTimeWindow] = useState(true);
  const [isWithinHours, setIsWithinHours] = useState(true);
  const [blockchain, setBlockchain] = useState<Block[]>([]);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any>(null);
  const [mobileInput, setMobileInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [auditText, setAuditText] = useState<string>('');
  
  const webcamRef = useRef<Webcam>(null);
  const [photoSent, setPhotoSent] = useState(false);

  const format12Hour = (timeStr: string) => {
    if (!timeStr) return '9:00 AM';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr || '0', 10);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = m.toString().padStart(2, '0');
    return `${displayH}:${displayM} ${period}`;
  };

  useEffect(() => {
    const checkSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setIsVotingActive(data.isVotingActive);
        if (data.startTime) setStartTime(data.startTime);
        if (data.endTime) setEndTime(data.endTime);
        if (data.enforceTimeWindow !== undefined) setEnforceTimeWindow(data.enforceTimeWindow);
        if (data.isWithinHours !== undefined) setIsWithinHours(data.isWithinHours);
      } catch (e) {
        console.error(e);
      }
    };
    checkSettings();
    const interval = setInterval(checkSettings, 5000);
    return () => clearInterval(interval);
  }, []);

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
        setAppState('FACE_SCAN');
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch (err) {
      setError('Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceCapture = async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    
    setIsLoading(true);
    if (user?.hasVoted) {
      try {
        await fetch('/api/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: mobileInput, photoBase64: imageSrc })
        });
        setPhotoSent(true);
        setAppState('SECURITY_CHECK');
      } catch (err) {
        console.error(err);
      }
    } else {
      setAppState(AppState.VOTING_BOOTH);
    }
    setIsLoading(false);
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
        setAppState(AppState.VOTE_CONFIRMED);
        setBlockchain([...blockchain, data.block]);
      } else {
        if (data.error === 'User has already voted or not found') {
           setAppState('SECURITY_CHECK');
        } else {
           setError(data.error || 'Vote failed');
        }
      }
    } catch (err) {
      setError('System failure. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
        <div className="flex items-center gap-2 bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700">
          <Clock size={14} className="text-blue-600" />
          <span>Active Window: <strong className="text-slate-900">{format12Hour(startTime)} – {format12Hour(endTime)}</strong></span>
        </div>
      </header>

      <main className="w-full max-w-xl flex flex-col gap-6">
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
                    className="w-full pl-14 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-lg font-medium tracking-wider"
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
            </form>
          </div>
        )}

        {/* Face Scan Step */}
        {appState === 'FACE_SCAN' && (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-blue-100 animate-in fade-in zoom-in duration-300">
            <div className="mb-6 text-center">
              <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Camera className="text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Biometric Verification</h2>
              <p className="text-slate-500 mt-2">Please capture your face to proceed.</p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="overflow-hidden rounded-2xl border-4 border-slate-100 w-full max-w-sm">
                {React.createElement(Webcam as any, {
                  audio: false,
                  ref: webcamRef,
                  screenshotFormat: "image/jpeg",
                  className: "w-full"
                })}
              </div>
              <button 
                onClick={handleFaceCapture}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all"
              >
                {isLoading ? 'Verifying...' : 'Capture & Verify'}
              </button>
            </div>
          </div>
        )}

        {/* Security Check / Error */}
        {appState === 'SECURITY_CHECK' && (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 animate-in fade-in zoom-in duration-300">
            <div className="mb-6 text-center">
              <div className="bg-red-50 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Not Allowed to Vote</h2>
              <p className="text-slate-500 mt-2">Our records indicate you have already voted.</p>
            </div>

            <div className="text-center p-6 bg-amber-50 rounded-xl border border-amber-100">
              <CheckCircle2 className="w-12 h-12 text-amber-500 mx-auto mb-2" />
              <h3 className="font-bold text-amber-900">Photo Sent to Admin</h3>
              <p className="text-amber-700 text-sm">Your verification photo has been shared with the admin desk. Please wait for them to verify your identity.</p>
              <button onClick={resetVoter} className="mt-4 text-blue-600 font-medium underline">Return to Start</button>
            </div>
          </div>
        )}

        {/* Step 3: Voting Booth */}
        {appState === AppState.VOTING_BOOTH && (
          !isVotingActive ? (
            <div className="bg-white p-12 text-center rounded-3xl shadow-xl border border-slate-100 animate-in fade-in zoom-in">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="text-amber-600 w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Voting is currently closed</h2>
              <p className="text-slate-500">Please wait for the election admin to start the voting process. This page will automatically update.</p>
            </div>
          ) : (!isWithinHours && enforceTimeWindow) ? (
            <div className="bg-white p-12 text-center rounded-3xl shadow-xl border border-red-100 animate-in fade-in zoom-in">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="text-red-600 w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Voting Window Closed</h2>
              <p className="text-red-600 font-semibold mb-2">Voting is closed. Allowed timing is strictly between {format12Hour(startTime)} and {format12Hour(endTime)}.</p>
              <p className="text-slate-500 text-sm">Submissions outside this official window are strictly rejected by the SecureChain protocol.</p>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-8">
              <div className="mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                      <Vote className="text-blue-600" /> Official Ballot
                    </h2>
                    <p className="text-slate-500 mt-1">Select one party to cast your immutable vote.</p>
                  </div>
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold">
                    Window Open
                  </span>
                </div>
              </div>

              {error && <div className="mb-4 flex items-center gap-2 text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg"><AlertCircle size={16} /> {error}</div>}

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
            </div>
          )
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
            <button 
              onClick={resetVoter}
              className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-all"
            >
              Finish
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default VoterApp;

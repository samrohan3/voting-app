import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { 
  ShieldCheck, Play, Square, UserX, CheckCircle, RefreshCcw, Lock, 
  Clock, Calendar, AlertTriangle, Check, Sliders, ShieldAlert, Sparkles 
} from 'lucide-react';
import { PARTIES } from './types';
import BlockchainVisualizer from './components/BlockchainVisualizer';

const AdminApp: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));
  const [password, setPassword] = useState('');
  const [isVotingActive, setIsVotingActive] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [enforceTimeWindow, setEnforceTimeWindow] = useState(true);
  const [isWithinHours, setIsWithinHours] = useState(true);
  const [liveTime, setLiveTime] = useState<Date>(new Date());
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        localStorage.setItem('adminToken', data.token);
      } else {
        alert('Invalid password');
      }
    } catch (err) {
      alert('Login failed');
    }
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      const resSettings = await fetch('/api/settings');
      const settings = await resSettings.json();
      setIsVotingActive(settings.isVotingActive);
      if (settings.startTime) setStartTime(settings.startTime);
      if (settings.endTime) setEndTime(settings.endTime);
      if (settings.enforceTimeWindow !== undefined) setEnforceTimeWindow(settings.enforceTimeWindow);
      if (settings.isWithinHours !== undefined) setIsWithinHours(settings.isWithinHours);

      const resResults = await fetch('/api/results');
      const resultsData = await resResults.json();
      setResults(resultsData.blocks || []);

      const resIssues = await fetch('/api/issues', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const issuesData = await resIssues.json();
      setIssues(issuesData || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const toggleVoting = async () => {
    try {
      await fetch('/api/settings/toggle', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const saveHoursSettings = async (overrideStart?: string, overrideEnd?: string, overrideEnforce?: boolean) => {
    setIsSavingHours(true);
    setSaveSuccessMsg(null);
    try {
      const payload = {
        startTime: overrideStart ?? startTime,
        endTime: overrideEnd ?? endTime,
        enforceTimeWindow: overrideEnforce !== undefined ? overrideEnforce : enforceTimeWindow
      };
      const res = await fetch('/api/settings/hours', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setIsVotingActive(data.isVotingActive);
        setStartTime(data.startTime);
        setEndTime(data.endTime);
        setEnforceTimeWindow(data.enforceTimeWindow);
        setIsWithinHours(data.isWithinHours);
        setSaveSuccessMsg('Voting schedule saved successfully!');
        setTimeout(() => setSaveSuccessMsg(null), 3500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingHours(false);
    }
  };

  const resetToStandardHours = () => {
    setStartTime('09:00');
    setEndTime('17:00');
    setEnforceTimeWindow(true);
    saveHoursSettings('09:00', '17:00', true);
  };

  const resolveIssue = async (id: string) => {
    try {
      await fetch(`/api/issues/${id}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const getResultsData = () => {
    return PARTIES.map(p => ({
      name: p.name,
      votes: results.filter(b => b.partyId === p.id).length,
      color: p.color
    }));
  };

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

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-sm">
          <h2 className="text-white text-2xl font-bold mb-6">Admin Login</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password"
              placeholder="Enter Admin Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
            />
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">Login</button>
          </form>
        </div>
      </div>
    );
  }

  // Determine active display status
  const isEffectivelyOpen = isVotingActive && (isWithinHours || !enforceTimeWindow);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8 glass-effect p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-2.5 rounded-xl shadow-lg">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Admin Command Center</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">SecureChain Management</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-semibold text-slate-700">
            <Clock size={14} className="text-blue-600 animate-pulse" />
            <span>System: {liveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
          </div>
          <button onClick={() => { setToken(null); localStorage.removeItem('adminToken'); }} className="text-sm font-bold text-slate-500 hover:text-slate-800">
            Log Out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Controls Column */}
        <div className="md:col-span-1 space-y-6">
          
          {/* Voting Process Control Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              Voting Process Control
            </h3>
            
            <div className={`p-4 rounded-xl border mb-4 ${
              !isVotingActive 
                ? 'bg-red-50 border-red-200' 
                : isEffectivelyOpen 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-center justify-between">
                <p className={`font-bold text-lg ${
                  !isVotingActive 
                    ? 'text-red-700' 
                    : isEffectivelyOpen 
                      ? 'text-green-700' 
                      : 'text-amber-700'
                }`}>
                  Status: {!isVotingActive ? 'ENDED' : isEffectivelyOpen ? 'ACTIVE & OPEN' : 'LOCKED (OUTSIDE HOURS)'}
                </p>
                <span className={`w-3 h-3 rounded-full ${
                  !isVotingActive ? 'bg-red-500' : isEffectivelyOpen ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
                }`}></span>
              </div>
              <p className="text-sm mt-1 opacity-75">
                {!isVotingActive 
                  ? 'Voting process is closed. Results are decrypted.' 
                  : isEffectivelyOpen 
                    ? 'Voters can cast votes. System is within the allowed window.' 
                    : `Voting is paused by time restriction (${format12Hour(startTime)} – ${format12Hour(endTime)}).`}
              </p>
            </div>
            
            <button 
              onClick={toggleVoting}
              className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md ${
                isVotingActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isVotingActive ? <><Square size={20} /> End Voting</> : <><Play size={20} /> Start Voting</>}
            </button>
          </div>

          {/* Time-Based Voting Window Control Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Clock className="text-blue-600" size={18} /> Active Voting Hours
              </h3>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                enforceTimeWindow 
                  ? isWithinHours 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {enforceTimeWindow ? (isWithinHours ? 'WINDOW OPEN' : 'WINDOW CLOSED') : 'ENFORCEMENT OFF'}
              </span>
            </div>

            {/* Current Window Pill */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex justify-between items-center text-slate-600 mb-1">
                <span className="font-medium">Configured Window:</span>
                <span className="font-bold text-slate-900">{format12Hour(startTime)} – {format12Hour(endTime)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 font-mono">
                <span>System Clock:</span>
                <span className="font-semibold text-blue-700">{liveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
              </div>
            </div>

            {/* Schedule Input Form */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Start Time</label>
                  <input 
                    type="time" 
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">End Time</label>
                  <input 
                    type="time" 
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="checkbox" 
                  id="enforceTime"
                  checked={enforceTimeWindow}
                  onChange={e => setEnforceTimeWindow(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="enforceTime" className="text-xs font-medium text-slate-700 cursor-pointer select-none">
                  Strictly reject votes outside window (403 Forbidden)
                </label>
              </div>

              {saveSuccessMsg && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                  <Check size={14} /> {saveSuccessMsg}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <button 
                  onClick={() => saveHoursSettings()}
                  disabled={isSavingHours}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Check size={16} /> {isSavingHours ? 'Saving...' : 'Apply Voting Hours'}
                </button>
                <button 
                  onClick={resetToStandardHours}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1"
                >
                  <RefreshCcw size={12} /> Standard Preset (9:00 AM – 5:00 PM)
                </button>
              </div>
            </div>
          </div>

          {/* Total Votes Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">Total Votes Cast</h3>
            <div className="text-5xl font-black text-blue-600">
              {results.length}
            </div>
          </div>
        </div>

        {/* Results & Security Panel */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Security Panel */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-red-600">
              <UserX /> Security Panel: Duplicate Votes Blocked
            </h3>
            
            {issues.length === 0 ? (
              <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">No security alerts at this time.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {issues.map(issue => (
                  <div key={issue._id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <img src={issue.photoBase64} alt="Voter" className="w-full h-48 object-cover bg-slate-100" />
                    <div className="p-4 bg-white">
                      <p className="font-bold text-slate-800 mb-1">Mobile: {issue.userId?.mobile}</p>
                      <p className="text-xs text-slate-500 mb-4">{new Date(issue.createdAt).toLocaleString()}</p>
                      <button 
                        onClick={() => resolveIssue(issue._id)}
                        className="w-full py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold rounded-lg transition-colors text-sm flex justify-center items-center gap-2"
                      >
                        <CheckCircle size={16} /> Mark Innocent & Allow Vote
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Results Panel */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              Blockchain Results
            </h3>
            
            {isVotingActive ? (
              <div className="text-center p-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <Lock className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">Results are securely encrypted while voting is active.</p>
                <p className="text-xs text-slate-400 mt-2">End voting process to decrypt and view final tallies.</p>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getResultsData()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                      {getResultsData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.votes > 0 ? '#3b82f6' : '#e2e8f0'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          
          {/* Blockchain Ledger Panel */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              Blockchain Ledger (Live)
            </h3>
            <BlockchainVisualizer blocks={results} />
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminApp;

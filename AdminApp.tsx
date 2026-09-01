import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ShieldCheck, Play, Square, UserX, CheckCircle, RefreshCcw, Lock } from 'lucide-react';
import { PARTIES } from './types';
import BlockchainVisualizer from './components/BlockchainVisualizer';

const AdminApp: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));
  const [password, setPassword] = useState('');
  const [isVotingActive, setIsVotingActive] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);

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

      const resResults = await fetch('/api/results');
      const resultsData = await resResults.json();
      setResults(resultsData.blocks);

      const resIssues = await fetch('/api/issues', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const issuesData = await resIssues.json();
      setIssues(issuesData);
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
        <div>
          <button onClick={() => { setToken(null); localStorage.removeItem('adminToken'); }} className="text-sm font-bold text-slate-500 hover:text-slate-800">
            Log Out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Controls Panel */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">Voting Process Control</h3>
            <div className={`p-4 rounded-xl border ${isVotingActive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} mb-4`}>
              <p className={`font-bold text-lg ${isVotingActive ? 'text-green-700' : 'text-red-700'}`}>
                Status: {isVotingActive ? 'ACTIVE' : 'ENDED'}
              </p>
              <p className="text-sm mt-1 opacity-75">
                {isVotingActive ? 'Voters can cast votes. Results are encrypted.' : 'Voting is closed. Results are decrypted.'}
              </p>
            </div>
            
            <button 
              onClick={toggleVoting}
              className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
                isVotingActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isVotingActive ? <><Square size={20} /> End Voting</> : <><Play size={20} /> Start Voting</>}
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">Total Votes Cast</h3>
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

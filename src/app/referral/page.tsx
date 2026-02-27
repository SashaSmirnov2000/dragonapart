'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PartnerPage() {
  const [isLogged, setIsLogged] = useState(false);
  const [partner, setPartner] = useState<any>(null);
  const [stats, setStats] = useState({ refs: 0, deals: 0 });
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem('partner_session');
    if (savedId) fetchPartnerData(savedId);
  }, []);

  const fetchPartnerData = async (id: string) => {
    setLoading(true);
    const { data: partnerData } = await supabase.from('partners').select('*').eq('id', id).single();
    if (partnerData) {
      setPartner(partnerData);
      const { count: refs } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('referrer', partnerData.login);
      const { count: deals } = await supabase.from('leads').select('*, users!inner(referrer)', { count: 'exact', head: true }).eq('status', 'completed').eq('users.referrer', partnerData.login);
      setStats({ refs: refs || 0, deals: deals || 0 });
      setIsLogged(true);
    }
    setLoading(false);
  };

  const copyLink = () => {
    const link = `https://t.me/dragonapartbot?start=${partner.login}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await supabase.from('partners').select('id').eq('login', login).eq('password', password).single();
    if (data) {
      localStorage.setItem('partner_session', data.id);
      fetchPartnerData(data.id);
    } else {
      alert('Authentication failed');
    }
  };

  if (!isLogged) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F0F0F] p-6 font-sans tracking-tight">
        <div className="w-full max-w-[380px] space-y-10">
          <div className="text-center space-y-3">
            <h1 className="text-white text-3xl font-light uppercase tracking-[0.2em]">Partner</h1>
            <p className="text-gray-500 text-xs uppercase tracking-widest">Exclusive Access Only</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="text" 
              placeholder="Username" 
              className="w-full p-5 rounded-none bg-transparent border-b border-white/10 text-white outline-none focus:border-white/40 transition-all font-light" 
              onChange={e => setLogin(e.target.value)} 
            />
            <input 
              type="password" 
              placeholder="Password" 
              className="w-full p-5 rounded-none bg-transparent border-b border-white/10 text-white outline-none focus:border-white/40 transition-all font-light" 
              onChange={e => setPassword(e.target.value)} 
            />
            <button className="w-full p-5 bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-all pt-6 pb-6">
              Authenticate
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white p-6 pt-16 font-sans selection:bg-white selection:text-black">
      <div className="max-w-[440px] mx-auto space-y-12">
        
        {/* Header */}
        <header className="flex justify-between items-end border-b border-white/5 pb-8">
          <div className="space-y-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em]">Partner ID</p>
            <h2 className="text-xl font-light uppercase tracking-widest">@{partner.login}</h2>
          </div>
          <button 
            onClick={() => { localStorage.removeItem('partner_session'); setIsLogged(false); }} 
            className="text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors"
          >
            Logout
          </button>
        </header>

        {/* Link Section */}
        <div className="space-y-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] text-center">Referral Link</p>
          <div 
            onClick={copyLink}
            className="group cursor-pointer border border-white/10 p-6 flex justify-between items-center hover:bg-white/5 transition-all"
          >
            <span className="text-xs font-light tracking-wide text-gray-400 group-hover:text-white">
              t.me/dragonapartbot?start={partner.login}
            </span>
            <span className="text-[9px] uppercase tracking-widest font-bold text-gray-600 group-hover:text-white">
              {copied ? 'Copied' : 'Copy'}
            </span>
          </div>
        </div>

        {/* Balance Card */}
        <div className="text-center space-y-4 pt-4 pb-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em]">Available Balance</p>
          <div className="text-6xl font-extralight tracking-tighter">
            {partner.balance.toLocaleString()} 
            <span className="text-sm align-top ml-2 font-light text-gray-600 tracking-widest">VND</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-px bg-white/10 border border-white/10">
          <div className="bg-[#0F0F0F] p-8 text-center space-y-2">
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">Traffic</p>
            <p className="text-2xl font-light">{stats.refs}</p>
          </div>
          <div className="bg-[#0F0F0F] p-8 text-center space-y-2">
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">Successful</p>
            <p className="text-2xl font-light text-white">{stats.deals}</p>
          </div>
        </div>

        {/* Conditions & Action */}
        <div className="space-y-10 pt-8">
          <div className="grid grid-cols-2 gap-y-4 text-[10px] uppercase tracking-widest text-gray-500">
            <div className="text-left font-medium">Minimum payout</div>
            <div className="text-right text-white">200,000 VND</div>
            <div className="text-left font-medium">Payment method</div>
            <div className="text-right text-white">QR / USDT</div>
            <div className="text-left font-medium">Processing time</div>
            <div className="text-right text-white">24 Hours</div>
          </div>

          <a 
            href="https://t.me/dragonservicesupport" 
            className="block w-full p-6 bg-white text-black text-center text-[11px] font-bold uppercase tracking-[0.3em] hover:invert transition-all active:scale-[0.98]"
          >
            Request Payout
          </a>
        </div>
      </div>
    </div>
  );
}
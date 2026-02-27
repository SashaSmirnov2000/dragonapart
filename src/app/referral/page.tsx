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
    try {
      const { data: partnerData } = await supabase.from('partners').select('*').eq('id', id).single();
      if (partnerData) {
        setPartner(partnerData);
        const { count: refs } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('referrer', partnerData.login);
        const { count: deals } = await supabase.from('leads').select('*, users!inner(referrer)', { count: 'exact', head: true }).eq('status', 'completed').eq('users.referrer', partnerData.login);
        setStats({ refs: refs || 0, deals: deals || 0 });
        setIsLogged(true);
      }
    } catch (err) {
      console.error(err);
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
      alert('Ошибка авторизации');
    }
  };

  if (!isLogged) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6 font-sans antialiased text-slate-900">
        <div className="w-full max-w-[400px] space-y-10 rounded-3xl bg-white p-10 shadow-sm border border-slate-100">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 uppercase tracking-[0.1em]">Partner Login</h1>
            <p className="text-slate-400 text-xs uppercase tracking-widest">Личный кабинет партнера</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Логин</label>
              <input 
                type="text" 
                className="w-full p-4 rounded-xl bg-slate-50 border border-slate-100 text-slate-900 outline-none focus:border-slate-300 focus:bg-white transition-all text-sm" 
                onChange={e => setLogin(e.target.value)} 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Пароль</label>
              <input 
                type="password" 
                className="w-full p-4 rounded-xl bg-slate-50 border border-slate-100 text-slate-900 outline-none focus:border-slate-300 focus:bg-white transition-all text-sm" 
                onChange={e => setPassword(e.target.value)} 
              />
            </div>
            <button className="w-full p-5 bg-slate-950 text-white rounded-xl text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-slate-800 transition-colors pt-6 pb-6">
              Авторизация
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-6 pt-16 font-sans antialiased selection:bg-slate-200">
      <div className="max-w-[480px] mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex justify-between items-center border-b border-slate-200 pb-8">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Partner Account</p>
            <h2 className="text-xl font-bold tracking-tight text-slate-950">@{partner.login}</h2>
          </div>
          <button 
            onClick={() => { localStorage.removeItem('partner_session'); setIsLogged(false); }} 
            className="text-[10px] uppercase font-bold tracking-widest text-slate-400 hover:text-red-500 transition-colors"
          >
            Выход
          </button>
        </header>

        {/* Link Section */}
        <div className="space-y-3">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Реферальная ссылка</p>
          <div 
            onClick={copyLink}
            className="group cursor-pointer bg-white p-5 flex justify-between items-center rounded-2xl border border-slate-200 hover:border-slate-400 transition-all shadow-sm"
          >
            <span className="text-xs font-medium text-slate-600">
              t.me/dragonapartbot?start={partner.login}
            </span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-950">
              {copied ? 'Успешно' : 'Копировать'}
            </span>
          </div>
        </div>

        {/* Balance Card */}
        <div className="bg-slate-950 p-10 rounded-[32px] text-center space-y-3 shadow-xl shadow-slate-900/10">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Баланс к выплате</p>
          <div className="text-5xl font-bold text-white tracking-tight leading-none">
            {partner.balance.toLocaleString()} 
            <span className="text-sm align-top ml-2 font-light text-slate-400 uppercase tracking-widest">VND</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 space-y-1 shadow-sm text-center">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Переходы</p>
            <p className="text-3xl font-bold text-slate-950">{stats.refs}</p>
          </div>
          <div className="bg-white p-8 rounded-3xl border border-slate-200 space-y-1 shadow-sm text-center">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Сдано</p>
            <p className="text-3xl font-bold text-slate-950">{stats.deals}</p>
          </div>
        </div>

        {/* Info & Action */}
        <div className="space-y-8 pt-4 pb-10">
          <div className="space-y-4">
             <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest pb-3 border-b border-slate-100">
                <span className="text-slate-400">Минимум</span>
                <span className="text-slate-950">200,000 VND</span>
             </div>
             <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest pb-3 border-b border-slate-100">
                <span className="text-slate-400">Методы</span>
                <span className="text-slate-950">QR / USDT</span>
             </div>
             <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest">
                <span className="text-slate-400">Срок</span>
                <span className="text-slate-950">24 Часа</span>
             </div>
          </div>

          <a 
            href="https://t.me/dragonservicesupport" 
            className="block w-full p-6 bg-white border border-slate-950 text-slate-950 rounded-2xl text-center text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-slate-950 hover:text-white transition-all pt-7 pb-7"
          >
            Заказать выплату
          </a>
        </div>
      </div>
    </div>
  );
}
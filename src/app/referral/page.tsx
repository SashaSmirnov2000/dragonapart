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
        <div className="w-full max-w-[400px] space-y-10 rounded-[40px] bg-white p-12 shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-950 uppercase">Вход</h1>
            <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-bold">Личный кабинет партнера</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-slate-400 ml-1 tracking-widest">Логин</label>
              <input 
                type="text" 
                className="w-full p-5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-900 outline-none focus:border-slate-300 focus:bg-white transition-all text-sm font-medium" 
                onChange={e => setLogin(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-slate-400 ml-1 tracking-widest">Пароль</label>
              <input 
                type="password" 
                className="w-full p-5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-900 outline-none focus:border-slate-300 focus:bg-white transition-all text-sm font-medium" 
                onChange={e => setPassword(e.target.value)} 
              />
            </div>
            <button className="w-full p-6 bg-slate-950 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
              Авторизоваться
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-6 pt-16 font-sans antialiased selection:bg-slate-200">
      <div className="max-w-[500px] mx-auto space-y-10">
        
        {/* Шапка */}
        <header className="flex justify-between items-center pb-6 border-b border-slate-200">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Аккаунт</p>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">@{partner.login}</h2>
          </div>
          <button 
            onClick={() => { localStorage.removeItem('partner_session'); setIsLogged(false); }} 
            className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-red-600 transition-colors"
          >
            Выйти
          </button>
        </header>

        {/* Реферальная ссылка */}
        <div className="space-y-4">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Ваша партнерская ссылка</p>
          <div 
            onClick={copyLink}
            className="group cursor-pointer bg-white p-6 flex justify-between items-center rounded-3xl border border-slate-200 hover:border-slate-400 transition-all shadow-sm"
          >
            <span className="text-sm font-bold text-slate-600">
              t.me/dragonapartbot?start={partner.login}
            </span>
            <span className="text-[10px] uppercase tracking-widest font-black text-slate-950 bg-slate-100 px-4 py-2 rounded-full group-hover:bg-slate-950 group-hover:text-white transition-all">
              {copied ? 'Готово' : 'Копировать'}
            </span>
          </div>
        </div>

        {/* Баланс */}
        <div className="bg-white p-12 rounded-[48px] text-center space-y-4 shadow-xl shadow-slate-200/40 border border-slate-100">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">Доступно к выплате</p>
          <div className="text-6xl font-black text-slate-950 tracking-tighter leading-none">
            {partner.balance.toLocaleString()} 
            <span className="text-sm align-top ml-2 font-black text-slate-300 uppercase tracking-widest">VND</span>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white p-10 rounded-[32px] border border-slate-200 space-y-2 shadow-sm text-center">
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">Клиенты</p>
            <p className="text-4xl font-black text-slate-950">{stats.refs}</p>
          </div>
          <div className="bg-white p-10 rounded-[32px] border border-slate-200 space-y-2 shadow-sm text-center">
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">Сделки</p>
            <p className="text-4xl font-black text-slate-950">{stats.deals}</p>
          </div>
        </div>

        {/* Информация */}
        <div className="space-y-10 pt-4 pb-20">
          <div className="space-y-5 px-4">
             <div className="flex justify-between items-center text-[11px] uppercase font-black tracking-widest pb-4 border-b border-slate-100">
                <span className="text-slate-400">Минимальный вывод</span>
                <span className="text-slate-950 text-right">200,000 VND</span>
             </div>
             <div className="flex justify-between items-center text-[11px] uppercase font-black tracking-widest pb-4 border-b border-slate-100">
                <span className="text-slate-400">Способы</span>
                <span className="text-slate-950 text-right">Local Bank QR / USDT</span>
             </div>
             <div className="flex justify-between items-center text-[11px] uppercase font-black tracking-widest">
                <span className="text-slate-400">Срок оплаты</span>
                <span className="text-slate-950 text-right">24 Часа</span>
             </div>
          </div>

          <a 
            href="https://t.me/dragonservicesupport" 
            className="block w-full p-8 bg-slate-950 text-white rounded-3xl text-center text-[12px] font-black uppercase tracking-[0.3em] hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/20 active:scale-[0.98]"
          >
            Запросить выплату
          </a>
        </div>
      </div>
    </div>
  );
}
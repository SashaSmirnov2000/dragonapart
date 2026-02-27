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
      
      // Считаем клики (рефералов)
      const { count: refs } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('referrer', partnerData.login);
      
      // Считаем закрытые сделки (статус completed)
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
      alert('Неверный логин или пароль');
    }
  };

  if (!isLogged) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F9F9] p-6">
        <div className="w-full max-w-[400px] space-y-6">
           <h1 className="text-2xl font-bold text-center">Partner Login</h1>
           <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" placeholder="Логин" className="w-full p-5 rounded-2xl bg-white shadow-sm outline-none" onChange={e => setLogin(e.target.value)} />
              <input type="password" placeholder="Пароль" className="w-full p-5 rounded-2xl bg-white shadow-sm outline-none" onChange={e => setPassword(e.target.value)} />
              <button className="w-full p-5 rounded-2xl bg-black text-white font-bold">Войти</button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[500px] p-6 pt-12 font-sans bg-[#F9F9F9] min-h-screen">
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">@{partner.login}</h2>
        <button onClick={() => { localStorage.removeItem('partner_session'); setIsLogged(false); }} className="text-gray-400 text-sm">Выйти</button>
      </header>

      {/* Копирование ссылки */}
      <div className="mb-6 bg-orange-50 p-6 rounded-[32px] border border-orange-100">
        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-3">Твоя реферальная ссылка</p>
        <div className="flex gap-2">
          <input readOnly value={`t.me/dragonapartbot?start=${partner.login}`} className="flex-1 bg-transparent font-medium text-sm outline-none" />
          <button onClick={copyLink} className="text-xs font-bold text-orange-600 uppercase">{copied ? '✅ Ок' : 'Копировать'}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Переходы</p>
          <p className="text-3xl font-black">{stats.refs}</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Сдано</p>
          <p className="text-3xl font-black text-green-600">{stats.deals}</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 mb-6">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Баланс</p>
        <p className="text-5xl font-black">{partner.balance.toLocaleString()} <span className="text-lg text-gray-300 font-medium">VND</span></p>
      </div>

      <a href="https://t.me/dragonservicesupport" className="block w-full p-5 bg-black text-white text-center rounded-2xl font-bold">Заказать выплату</a>
    </div>
  );
}
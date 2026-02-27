'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Инициализация клиента напрямую с использованием твоих переменных окружения
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PartnerPage() {
  const [isLogged, setIsLogged] = useState(false);
  const [partner, setPartner] = useState<any>(null);
  const [refCount, setRefCount] = useState(0);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Проверка сохраненной сессии в браузере при загрузке страницы
  useEffect(() => {
    const savedId = localStorage.getItem('partner_session');
    if (savedId) {
      fetchPartnerData(savedId);
    }
  }, []);

  // Функция получения данных партнера и подсчета его рефералов
  const fetchPartnerData = async (id: string) => {
    setLoading(true);
    try {
      // 1. Получаем данные профиля партнера
      const { data: partnerData, error: pError } = await supabase
        .from('partners')
        .select('*')
        .eq('id', id)
        .single();

      if (partnerData) {
        setPartner(partnerData);

        // 2. Считаем количество пользователей, у которых referrer совпадает с логином партнера
        const { count, error: cError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('referrer', partnerData.login);
        
        setRefCount(count || 0);
        setIsLogged(true);
      } else {
        localStorage.removeItem('partner_session');
      }
    } catch (err) {
      console.error("Error fetching partner data:", err);
    }
    setLoading(false);
  };

  // Обработка формы входа
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { data, error } = await supabase
      .from('partners')
      .select('id')
      .eq('login', login)
      .eq('password', password)
      .single();

    if (data) {
      localStorage.setItem('partner_session', data.id);
      await fetchPartnerData(data.id);
    } else {
      alert('Ошибка: Неверный логин или пароль');
    }
    setLoading(false);
  };

  if (loading && !isLogged) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F9F9]">
        <div className="text-gray-400 font-light animate-pulse">Загрузка кабинета...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#1A1A1A] font-sans selection:bg-orange-100">
      {!isLogged ? (
        // --- ЭКРАН АВТОРИЗАЦИИ ---
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-[400px] space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Partner Area</h1>
              <p className="text-gray-400 font-light">Введите данные для входа в кабинет</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="text"
                placeholder="Логин"
                required
                className="w-full rounded-2xl border-none bg-white p-5 shadow-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-orange-500 transition-all"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
              <input
                type="password"
                placeholder="Пароль"
                required
                className="w-full rounded-2xl border-none bg-white p-5 shadow-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-orange-500 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="submit"
                className="w-full rounded-2xl bg-[#1A1A1A] p-5 font-semibold text-white hover:bg-black transition-colors shadow-lg active:scale-[0.98]"
              >
                Войти
              </button>
            </form>
          </div>
        </div>
      ) : (
        // --- ЭКРАН ЛИЧНОГО КАБИНЕТА ---
        <div className="mx-auto max-w-[500px] p-6 pt-12">
          <header className="flex items-center justify-between mb-10">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[2px]">Личный кабинет</p>
              <h2 className="text-2xl font-bold">@{partner?.login}</h2>
            </div>
            <button 
              onClick={() => { localStorage.removeItem('partner_session'); setIsLogged(false); }}
              className="text-xs bg-gray-200 px-4 py-2 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all"
            >
              Выйти
            </button>
          </header>

          <div className="space-y-6">
            {/* Карточка Баланса */}
            <div className="rounded-[32px] bg-white p-8 shadow-sm border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[2px] mb-2">Доступно к выплате</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black">
                  {partner?.balance?.toLocaleString() || 0}
                </span>
                <span className="text-lg font-medium text-gray-400 uppercase">vnd</span>
              </div>
            </div>

            {/* Статистика Рефералов */}
            <div className="rounded-[32px] bg-white p-8 shadow-sm border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[2px] mb-2">Статистика переходов</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black">{refCount}</span>
                <span className="text-lg font-medium text-gray-400">чел.</span>
              </div>
            </div>

            {/* Инфо-блок и Кнопка */}
            <div className="rounded-[32px] bg-[#1A1A1A] p-8 text-white shadow-2xl">
              <h3 className="text-lg font-bold mb-6 italic text-orange-400 font-serif">Информация ✨</h3>
              <div className="space-y-4 text-sm font-light text-gray-400 mb-8">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>Минимальная выплата</span>
                  <span className="text-white font-medium">200,000 VND</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>Методы</span>
                  <span className="text-white font-medium">QR / USDT</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>Срок выплат</span>
                  <span className="text-white font-medium">1 рабочий день</span>
                </div>
              </div>
              
              <a 
                href="https://t.me/dragonservicesupport"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-2xl bg-white p-5 text-center font-bold text-black hover:bg-orange-50 transition-all shadow-xl active:scale-[0.98]"
              >
                Заказать выплату
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
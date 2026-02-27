'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Apartment {
  id?: number;
  titleRu: string;
  titleEn: string;
  price: string;
  district: string;
  bedrooms: string;
  images: string | string[];
  mapUrl: string;
  descRu: string;
  descEn: string;
}

const Admin = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [apartments, setApartments] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Новые стейты для админки
  const [activeTab, setActiveTab] = useState<'apartments' | 'leads' | 'partners'>('apartments');
  const [leads, setLeads] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [rewardAmounts, setRewardAmounts] = useState<{[key: number]: string}>({});

  const [newApart, setNewApart] = useState<Apartment>({
    titleRu: '', titleEn: '', price: '', district: '', 
    bedrooms: '', images: '', mapUrl: '', descRu: '', descEn: ''
  });

  // Загрузка всех данных
  const fetchAllData = async () => {
    fetchApartments();
    fetchLeads();
    fetchPartners();
  };

  const fetchApartments = async () => {
    const { data } = await supabase.from('apartments').select('*').order('created_at', { ascending: false });
    setApartments(data || []);
  };

  const fetchLeads = async () => {
    // Тянем лидов вместе с информацией о реферере из таблицы users
    const { data } = await supabase
      .from('leads')
      .select('*, users!inner(username, referrer)')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false });
    setLeads(data || []);
  };

  const fetchPartners = async () => {
    const { data } = await supabase.from('partners').select('*').order('balance', { ascending: false });
    setPartners(data || []);
  };

  useEffect(() => {
    if (isAuthenticated) fetchAllData();
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) { 
      setIsAuthenticated(true);
    } else {
      alert('Неверный пароль');
    }
  };

  // Логика подтверждения сдачи квартиры
  const handleConfirmRent = async (lead: any) => {
    const amount = Number(rewardAmounts[lead.id]);
    if (!amount || amount <= 0) return alert('Введите корректную сумму вознаграждения');

    try {
      // 1. Находим партнера по логину реферера
      const partnerLogin = lead.users.referrer;
      const { data: partner } = await supabase.from('partners').select('id, balance').eq('login', partnerLogin).single();

      if (!partner) throw new Error('Партнер не найден');

      // 2. Обновляем баланс партнера
      const { error: balanceError } = await supabase
        .from('partners')
        .update({ balance: partner.balance + amount })
        .eq('id', partner.id);
      
      if (balanceError) throw balanceError;

      // 3. Обновляем статус лида на completed
      const { error: leadError } = await supabase
        .from('leads')
        .update({ status: 'completed' })
        .eq('id', lead.id);

      if (leadError) throw leadError;

      alert('Сделка успешно закрыта, баланс партнера обновлен');
      fetchLeads();
      fetchPartners();
    } catch (error: any) {
      alert(`Ошибка: ${error.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    const imagesArray = typeof newApart.images === 'string' 
      ? newApart.images.split(',').map(url => url.trim()).filter(url => url !== '')
      : newApart.images;
    const dataToSave = { ...newApart, images: imagesArray };

    try {
      if (editingId) {
        await supabase.from('apartments').update(dataToSave).eq('id', editingId);
      } else {
        await supabase.from('apartments').insert([dataToSave]);
      }
      setEditingId(null);
      setNewApart({ titleRu: '', titleEn: '', price: '', district: '', bedrooms: '', images: '', mapUrl: '', descRu: '', descEn: '' });
      fetchApartments();
    } finally {
      setIsUploading(false);
    }
  };

  const deleteApartment = async (id: number) => {
    if (window.confirm('Точно удалить?')) {
      await supabase.from('apartments').delete().eq('id', id);
      fetchApartments();
    }
  };

  const startEdit = (apt: any) => {
    setEditingId(apt.id);
    setNewApart({
      titleRu: apt.titleRu || '', titleEn: apt.titleEn || '', price: apt.price || '',
      district: apt.district || '', bedrooms: apt.bedrooms || '',
      images: Array.isArray(apt.images) ? apt.images.join(', ') : apt.images || '',
      mapUrl: apt.mapUrl || '', descRu: apt.descRu || '', descEn: apt.descEn || ''
    });
    setActiveTab('apartments');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-[32px] shadow-xl border border-slate-200 w-full max-w-md">
          <h2 className="text-2xl font-black mb-6 uppercase tracking-tight text-center">Admin Access</h2>
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <input 
              type="password" placeholder="Пароль" 
              className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold uppercase text-[11px] tracking-widest">Войти</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-12 px-6">
      <div className="max-w-5xl mx-auto">
        
        {/* Навигация */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div className="flex bg-white p-2 rounded-3xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setActiveTab('apartments')}
              className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'apartments' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Объекты
            </button>
            <button 
              onClick={() => setActiveTab('leads')}
              className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'leads' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Заявки {leads.length > 0 && `(${leads.length})`}
            </button>
            <button 
              onClick={() => setActiveTab('partners')}
              className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'partners' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Партнеры
            </button>
          </div>
          <button onClick={() => setIsAuthenticated(false)} className="text-slate-400 font-bold text-xs uppercase hover:text-red-500">Выйти</button>
        </div>

        {/* ВКЛАДКА: ОБЪЕКТЫ */}
        {activeTab === 'apartments' && (
          <div className="animate-in fade-in duration-500 text-left">
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-10">
              {editingId ? 'Редактировать объект' : 'Добавить объект'}
            </h1>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Название (RU)</label>
                <input type="text" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200" value={newApart.titleRu} onChange={(e) => setNewApart({...newApart, titleRu: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Title (EN)</label>
                <input type="text" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200" value={newApart.titleEn} onChange={(e) => setNewApart({...newApart, titleEn: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Цена</label>
                <input type="text" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200" value={newApart.price} onChange={(e) => setNewApart({...newApart, price: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Район</label>
                  <input type="text" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200" value={newApart.district} onChange={(e) => setNewApart({...newApart, district: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Спальни</label>
                  <input type="text" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200" value={newApart.bedrooms} onChange={(e) => setNewApart({...newApart, bedrooms: e.target.value})} />
                </div>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4 italic">Фото (через запятую)</label>
                <textarea rows={3} className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 resize-none" value={typeof newApart.images === 'string' ? newApart.images : newApart.images.join(', ')} onChange={(e) => setNewApart({...newApart, images: e.target.value})} required />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Google Maps URL</label>
                <input type="text" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200" value={newApart.mapUrl} onChange={(e) => setNewApart({...newApart, mapUrl: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Описание RU</label>
                <textarea rows={4} className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 resize-none" value={newApart.descRu} onChange={(e) => setNewApart({...newApart, descRu: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Description EN</label>
                <textarea rows={4} className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 resize-none" value={newApart.descEn} onChange={(e) => setNewApart({...newApart, descEn: e.target.value})} />
              </div>
              <div className="md:col-span-2 flex gap-4">
                <button type="submit" disabled={isUploading} className="flex-grow bg-blue-600 text-white py-5 rounded-3xl font-bold uppercase text-[12px] tracking-widest">
                  {isUploading ? 'Загрузка...' : editingId ? 'Сохранить изменения' : 'Опубликовать объект'}
                </button>
                {editingId && (
                  <button type="button" onClick={() => { setEditingId(null); setNewApart({titleRu: '', titleEn: '', price: '', district: '', bedrooms: '', images: '', mapUrl: '', descRu: '', descEn: ''}) }} className="bg-slate-200 text-slate-600 px-8 rounded-3xl font-bold uppercase text-[12px]">Отмена</button>
                )}
              </div>
            </form>

            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 mb-6 uppercase tracking-wider text-left">Управление каталогом</h2>
              {apartments.map(apt => (
                <div key={apt.id} className="bg-white p-6 rounded-[24px] border border-slate-200 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <img src={Array.isArray(apt.images) ? apt.images[0] : ''} className="w-16 h-16 rounded-xl object-cover bg-slate-100" alt="" />
                    <div className="text-left">
                      <h4 className="font-bold text-slate-900">{apt.titleRu}</h4>
                      <p className="text-xs text-slate-400">{apt.price} • {apt.district}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(apt)} className="p-3 bg-slate-100 text-blue-600 rounded-xl">✏️</button>
                    <button onClick={() => deleteApartment(apt.id)} className="p-3 bg-slate-100 text-red-600 rounded-xl">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ВКЛАДКА: ЗАЯВКИ (ЛИДЫ) */}
        {activeTab === 'leads' && (
          <div className="animate-in fade-in duration-500 text-left">
            <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-10">Просмотры (Ожидают подтверждения)</h2>
            <div className="space-y-6">
              {leads.map(lead => (
                <div key={lead.id} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">ID объекта: {lead.apartment_id}</p>
                      <h4 className="text-xl font-bold text-slate-950">Клиент: @{lead.users?.username || 'N/A'}</h4>
                      <p className="text-sm text-slate-400 font-medium">Партнер: <span className="text-slate-900">@{lead.users?.referrer || 'Прямой'}</span></p>
                    </div>
                    <div className="bg-blue-50 text-blue-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border border-blue-100">Записан на просмотр</div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-slate-100">
                    <div className="flex-grow space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Сумма партнеру (VND)</label>
                      <input 
                        type="number" 
                        placeholder="Например: 500000"
                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:bg-white transition-all font-bold"
                        value={rewardAmounts[lead.id] || ''}
                        onChange={(e) => setRewardAmounts({...rewardAmounts, [lead.id]: e.target.value})}
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={() => handleConfirmRent(lead)}
                        className="w-full md:w-auto bg-slate-900 text-white px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-lg shadow-slate-200 active:scale-[0.98] transition-all"
                      >
                        Сдана / Начислить
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {leads.length === 0 && <p className="text-center py-20 text-slate-400 font-medium italic">На данный момент новых подтвержденных просмотров нет.</p>}
            </div>
          </div>
        )}

        {/* ВКЛАДКА: ПАРТНЕРЫ */}
        {activeTab === 'partners' && (
          <div className="animate-in fade-in duration-500 text-left">
            <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-10">Партнерская сеть</h2>
            <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Логин</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Текущий баланс</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {partners.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6 font-bold text-slate-900">@{p.login}</td>
                      <td className="px-8 py-6 text-right">
                        <span className="font-black text-slate-950 text-lg">{p.balance.toLocaleString()}</span>
                        <span className="ml-2 text-[10px] font-black text-slate-300 uppercase">VND</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {partners.length === 0 && <p className="text-center py-10 text-slate-400">Список партнеров пуст.</p>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Admin;
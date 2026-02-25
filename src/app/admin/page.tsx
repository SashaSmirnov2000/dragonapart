'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Используем наш настроенный клиент

const Admin = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [apartments, setApartments] = useState<any[]>([]); // Список объектов
  const [editingId, setEditingId] = useState<number | null>(null); // ID для редактирования

  const [newApart, setNewApart] = useState({
    titleRu: '', titleEn: '', price: '', district: '', 
    bedrooms: '', images: '', mapUrl: '', descRu: '', descEn: ''
  });

  // Загрузка списка при входе в админку
  const fetchApartments = async () => {
    const { data } = await supabase
      .from('apartments')
      .select('*')
      .order('created_at', { ascending: false });
    setApartments(data || []);
  };

  useEffect(() => {
    if (isAuthenticated) fetchApartments();
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // В Next.js используем process.env вместо import.meta.env
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) { 
      setIsAuthenticated(true);
    } else {
      alert('Неверный пароль');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    
    // Обработка строк изображений в массив
    const imagesArray = typeof newApart.images === 'string' 
      ? newApart.images.split(',').map(url => url.trim()).filter(url => url !== '')
      : newApart.images;

    try {
      if (editingId) {
        // РЕДАКТИРОВАНИЕ
        const { error } = await supabase
          .from('apartments')
          .update({ ...newApart, images: imagesArray })
          .eq('id', editingId);
        if (error) throw error;
        alert('Обновлено!');
      } else {
        // СОЗДАНИЕ
        const { error } = await supabase
          .from('apartments')
          .insert([{ ...newApart, images: imagesArray }]);
        if (error) throw error;
        alert('Создано!');
      }

      setEditingId(null);
      setNewApart({ titleRu: '', titleEn: '', price: '', district: '', bedrooms: '', images: '', mapUrl: '', descRu: '', descEn: '' });
      fetchApartments();
    } catch (error: any) {
      alert(error.message);
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
      ...apt,
      images: Array.isArray(apt.images) ? apt.images.join(', ') : apt.images
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-left">
        <div className="bg-white p-10 rounded-[32px] shadow-xl border border-slate-200 w-full max-w-md">
          <h2 className="text-2xl font-black mb-6 uppercase tracking-tight text-center text-slate-900">Admin Access</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="Пароль" 
              className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-blue-500 outline-none text-slate-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold uppercase text-[11px] tracking-widest active:scale-[0.98]">Войти</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-20 px-6 text-left">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
            {editingId ? 'Редактировать объект' : 'Добавить объект'}
          </h1>
          <button onClick={() => setIsAuthenticated(false)} className="text-slate-400 font-bold text-xs uppercase hover:text-red-500">Выйти</button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Название (RU)</label>
            <input type="text" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900" value={newApart.titleRu} onChange={(e) => setNewApart({...newApart, titleRu: e.target.value})} required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Title (EN)</label>
            <input type="text" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900" value={newApart.titleEn} onChange={(e) => setNewApart({...newApart, titleEn: e.target.value})} required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Цена</label>
            <input type="text" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900" value={newApart.price} onChange={(e) => setNewApart({...newApart, price: e.target.value})} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="Район" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200" value={newApart.district} onChange={(e) => setNewApart({...newApart, district: e.target.value})} />
            <input type="text" placeholder="Спальни" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200" value={newApart.bedrooms} onChange={(e) => setNewApart({...newApart, bedrooms: e.target.value})} />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4 italic">Фото (через запятую)</label>
            <textarea rows={3} className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 resize-none text-slate-900" value={newApart.images} onChange={(e) => setNewApart({...newApart, images: e.target.value})} required />
          </div>
          <div className="md:col-span-2">
            <input type="text" placeholder="Google Maps URL" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200" value={newApart.mapUrl} onChange={(e) => setNewApart({...newApart, mapUrl: e.target.value})} />
          </div>
          <textarea rows={4} placeholder="Описание RU" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 resize-none" value={newApart.descRu} onChange={(e) => setNewApart({...newApart, descRu: e.target.value})} />
          <textarea rows={4} placeholder="Description EN" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 resize-none" value={newApart.descEn} onChange={(e) => setNewApart({...newApart, descEn: e.target.value})} />
          
          <div className="md:col-span-2 flex gap-4">
            <button type="submit" disabled={isUploading} className="flex-grow bg-blue-600 text-white py-5 rounded-3xl font-bold uppercase text-[12px] tracking-widest active:scale-[0.99]">
              {isUploading ? 'Загрузка...' : editingId ? 'Сохранить изменения' : 'Опубликовать объект'}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setNewApart({titleRu: '', titleEn: '', price: '', district: '', bedrooms: '', images: '', mapUrl: '', descRu: '', descEn: ''}) }} className="bg-slate-200 text-slate-600 px-8 rounded-3xl font-bold uppercase text-[12px]">Отмена</button>
            )}
          </div>
        </form>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 mb-6 uppercase tracking-wider">Управление каталогом</h2>
          {apartments.map(apt => (
            <div key={apt.id} className="bg-white p-6 rounded-[24px] border border-slate-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <img src={apt.images?.[0]} className="w-16 h-16 rounded-xl object-cover bg-slate-100" alt="" />
                <div>
                  <h4 className="font-bold text-slate-900">{apt.titleRu}</h4>
                  <p className="text-xs text-slate-400">{apt.price} • {apt.district}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(apt)} className="p-3 bg-slate-100 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors">✏️</button>
                <button onClick={() => deleteApartment(apt.id)} className="p-3 bg-slate-100 hover:bg-red-50 text-red-600 rounded-xl transition-colors">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Admin;
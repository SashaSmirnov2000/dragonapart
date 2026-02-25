'use client';

import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import { supabase } from '@/lib/supabase';

// Импорт стилей Swiper
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

const translations = {
  ru: {
    catalog: "Каталог",
    heroTitle: "Найди свой дом в Дананге",
    heroSubtitle: "Мы вручную проверяем каждое объявление.",
    heroHighlight: "Только свободные квартиры",
    heroSubtext: ", которые можно смотреть сегодня.",
    sectionTitle: "Актуальные предложения",
    sectionSubtitle: "Каталог обновляется в режиме реального времени",
    updated: "Обновлено 5 мин назад",
    more: "Узнать подробнее",
    onMap: "На карте",
    contactAgent: "Записаться на просмотр",
    footerLegal: "© 2026 Da Nang, Vietnam",
    bookingTitle: "Запись на просмотр",
    bookingStay: "Срок проживания",
    bookingGuests: "Кол-во человек",
    bookingPets: "Есть животные?",
    bookingTime: "Время просмотра",
    bookingSubmit: "Подтвердить запись",
    bookingSuccess: "Заявка отправлена!",
    bookingWait: "Мы уже связываемся с владельцем квартиры. Вы можете закрыть приложение, мы пришлем вам уведомление в бот.",
    workHours: "Время обработки заявок: 10:00 — 22:00"
  },
  en: {
    catalog: "Catalog",
    heroTitle: "Find your home in Da Nang",
    heroSubtitle: "We manually verify every listing.",
    heroHighlight: "Only available apartments",
    heroSubtext: " you can visit today.",
    sectionTitle: "Current Offers",
    sectionSubtitle: "The catalog is updated in real time",
    updated: "Updated 5 mins ago",
    more: "View Details",
    onMap: "On Map",
    contactAgent: "Book a Viewing",
    footerLegal: "© 2026 Da Nang, Vietnam",
    bookingTitle: "Book a Viewing",
    bookingStay: "Stay duration",
    bookingGuests: "Guests",
    bookingPets: "Any pets?",
    bookingTime: "Viewing time",
    bookingSubmit: "Confirm Booking",
    bookingSuccess: "Request sent!",
    bookingWait: "We are already contacting the landlord. You can close the app, we will notify you via the bot.",
    workHours: "Processing hours: 10:00 AM — 10:00 PM"
  }
};

export default function Home() {
  const [apartments, setApartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApart, setSelectedApart] = useState<any>(null);
  const [lang, setLang] = useState<'ru' | 'en'>('ru');
  const [showBooking, setShowBooking] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const [bookingForm, setBookingForm] = useState({
    stay: '1-3 months',
    guests: '1',
    pets: 'No',
    time: ''
  });

  const t = translations[lang];

  useEffect(() => {
    // Сохранение ID пользователя из URL (для Telegram)
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user_id');
    if (userId) {
      localStorage.setItem('tg_user_id', userId.trim());
    }

    const fetchApartments = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('apartments').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setApartments(data || []);
      } catch (err: any) {
        console.error("Error:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchApartments();
  }, []);

  const generateTimeSlots = () => {
    const slots = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const slotTime = new Date(now.getTime() + i * 60 * 60 * 1000);
      const hour = slotTime.getHours();
      if (hour >= 10 && hour <= 21) {
        const timeStr = slotTime.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        slots.push(timeStr);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const handleBookingSubmit = async () => {
    const savedId = localStorage.getItem('tg_user_id');
    try {
      const { error } = await supabase.from('leads').insert([{
        user_id: savedId ? parseInt(savedId) : null,
        apartment_id: selectedApart.id,
        stay_duration: bookingForm.stay,
        guests_count: parseInt(bookingForm.guests),
        has_pets: bookingForm.pets === 'Yes' || bookingForm.pets === 'Да',
        preferred_date: bookingForm.time,
        status: 'new'
      }]);
      if (error) throw error;
      setIsSubmitted(true);
    } catch (err: any) {
      alert("Ошибка при отправке: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans antialiased text-slate-900">
      {/* Навигация */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐉</span>
            <span className="font-bold text-xl tracking-tight uppercase">Dragon<span className="text-blue-600">Apart</span></span>
          </div>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onClick={() => setLang('ru')} className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${lang === 'ru' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>RU</button>
            <button onClick={() => setLang('en')} className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${lang === 'en' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>EN</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-16 h-[500px] flex items-center overflow-hidden text-left">
        <div className="absolute inset-0 z-0">
          <img src="https://www.shutterstock.com/image-photo/dragon-bridge-landmark-da-nang-600nw-2415130505.jpg" className="w-full h-full object-cover" alt="Da Nang"/>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/70 to-transparent"></div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-2xl">
            <h1 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight tracking-tight">{t.heroTitle}</h1>
            <p className="text-lg text-slate-200 mb-8 leading-relaxed font-light">{t.heroSubtitle} <br/><span className="text-blue-400 font-semibold border-b-2 border-blue-400/50 pb-0.5">{t.heroHighlight}</span>{t.heroSubtext}</p>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="max-w-7xl mx-auto px-6 py-16 text-left">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">{t.sectionTitle}</h2>
            <p className="text-slate-500 mt-2 font-light">{t.sectionSubtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-4 py-2 rounded-2xl border border-green-100 shadow-sm w-fit">
            <span className="text-[11px] uppercase tracking-wider">{t.updated}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400 uppercase tracking-widest font-bold animate-pulse">Загрузка каталога...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {apartments.map((apt) => (
              <div key={apt.id} onClick={() => { setSelectedApart(apt); setShowBooking(false); setIsSubmitted(false); }} className="group flex flex-col bg-white rounded-[32px] overflow-hidden border border-slate-200 hover:shadow-2xl transition-all duration-500 cursor-pointer">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img src={apt.images?.[0]} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute top-4 right-4 bg-white/95 px-4 py-2 rounded-2xl shadow-sm"><span className="font-bold text-slate-900">{apt.price}</span></div>
                </div>
                <div className="p-8 flex flex-col flex-grow">
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-blue-600 mb-4">
                    <span className="bg-blue-50 px-2 py-1 rounded border border-blue-100">{apt.district}</span>
                    <span className="text-slate-400">{apt.bedrooms}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3 line-clamp-1">{lang === 'ru' ? apt.titleRu : apt.titleEn}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-6 line-clamp-2 font-light">{lang === 'ru' ? apt.descRu : apt.descEn}</p>
                  <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold uppercase text-[11px] tracking-widest">{t.more}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Модальное окно (Selected Apartment) — Код такой же как у тебя, но с закрытием */}
      {selectedApart && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setSelectedApart(null)}></div>
          <div className="relative bg-white w-full max-w-4xl rounded-[40px] overflow-hidden shadow-2xl max-h-[95vh] flex flex-col">
             <button onClick={() => setSelectedApart(null)} className="absolute top-6 right-6 z-[110] bg-white text-slate-900 w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg">✕</button>
             <div className="flex flex-col md:flex-row h-full overflow-y-auto">
               <div className="md:w-1/2 h-64 md:h-auto bg-slate-100">
                 <Swiper navigation={true} pagination={{ clickable: true }} modules={[Navigation, Pagination]} className="h-full w-full">
                    {selectedApart.images?.map((img: string, idx: number) => (
                      <SwiperSlide key={idx}><img src={img} className="w-full h-full object-cover" alt="" /></SwiperSlide>
                    ))}
                 </Swiper>
               </div>
               <div className="md:w-1/2 p-8 md:p-12 text-left">
                  {/* ... Тут твой JSX для описания и формы бронирования ... */}
                  {/* Оставил без изменений для краткости, вставь свой блок !showBooking */}
                  {!showBooking ? (
                    <>
                      <h2 className="text-2xl font-bold mb-1">{lang === 'ru' ? selectedApart.titleRu : selectedApart.titleEn}</h2>
                      <p className="text-blue-600 text-xl font-black mb-6">{selectedApart.price}</p>
                      <button onClick={() => setShowBooking(true)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold uppercase text-[11px] tracking-widest">{t.contactAgent}</button>
                    </>
                  ) : (
                    /* Твоя форма бронирования */
                    <div>
                        <h2 className="text-xl font-black uppercase mb-6">{t.bookingTitle}</h2>
                        {/* Селекты и инпуты формы из твоего кода */}
                        <button onClick={handleBookingSubmit} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-bold mt-4 uppercase text-[11px]">
                          {isSubmitted ? t.bookingSuccess : t.bookingSubmit}
                        </button>
                    </div>
                  )}
               </div>
             </div>
          </div>
        </div>
      )}

      <footer className="bg-slate-900 text-slate-500 py-12 px-6 text-left">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-[12px] font-medium uppercase tracking-widest">
          <div className="flex items-center gap-3"><span className="text-white font-black">DragonApart</span><span>{t.footerLegal}</span></div>
        </div>
      </footer>
    </div>
  );
}
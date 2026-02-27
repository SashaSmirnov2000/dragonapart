export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const SITE_URL = "https://dragonapart.vercel.app";
    const MY_ADMIN_ID = 1920798985;
    const CHANNEL_ID = "@dragonindanang";

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Быстрая проверка подписки
    const checkSub = async (uid: number) => {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${uid}`);
      const d = await res.json();
      return d.ok && ['member', 'administrator', 'creator'].includes(d.result.status);
    };

    const sendWelcome = async (chatId: number) => {
      const welcomeText = `✨ **Устали от бесконечного поиска квартиры?**\nDragonApart — это каталог только актуального жилья. Мы обновляем базу ежедневно.\n\n🏠 **Tired of endless apartment hunting?**\nDragonApart is a catalog of only currently available listings. We update daily.\n\n👨‍💻 **Manager:** @dragonservicesupport`;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId, text: welcomeText, parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🐉 Catalog / Открыть каталог", web_app: { url: `${SITE_URL}?user_id=${chatId}` } }], [{ text: "💬 Manager / Поддержка", url: "https://t.me/dragonservicesupport" }]] }
        })
      });
    };

    // --- ОБРАБОТКА КНОПОК ---
    if (body.callback_query) {
      const data = body.callback_query.data;
      const chatId = body.callback_query.message.chat.id;
      const msgId = body.callback_query.message.message_id;

      if (data === 'check_sub') {
        if (await checkSub(chatId)) {
          await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: msgId }) });
          await sendWelcome(chatId);
        } else {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: body.callback_query.id, text: "❌ Подписка не найдена", show_alert: true }) });
        }
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith('preconf_')) {
        const id = data.split('_')[1];
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: MY_ADMIN_ID, message_id: msgId, text: `✅ **Выберите вариант подтверждения:**`,
            reply_markup: { inline_keyboard: [[{ text: "💎 Всё ок (Местоположение)", callback_data: `conf_full_${id}` }], [{ text: "⏰ Другое время", callback_data: `conf_time_${id}` }]] }
          })
        });
      }

      if (data.startsWith('predecl_')) {
        const id = data.split('_')[1];
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: MY_ADMIN_ID, message_id: msgId, text: `❌ **Выберите причину отказа:**`,
            reply_markup: { inline_keyboard: [[{ text: "🏠 Уже сдана", callback_data: `decl_rented_${id}` }], [{ text: "⏳ Короткий срок", callback_data: `decl_term_${id}` }], [{ text: "🐾 Животные", callback_data: `decl_pets_${id}` }]] }
          })
        });
      }

      if (data.startsWith('conf_') || data.startsWith('decl_')) {
        const [type, reason, id] = data.split('_');
        const { data: lead } = await supabase.from('leads').select('telegram_id').eq('id', id).single();
        let clientMsg = "";
        let kb = [];

        if (type === 'conf') {
          clientMsg = reason === 'full' 
            ? `✅ **Ваша квартира и время просмотра подтверждено, напишите пожалуйста мененджеру для получения точного местоположения квартиры и уточнее деталей.**`
            : `✅ **Собственник подвердил свободность квартиры, но хочет назначить другое время просмотра. напишите пожалуйста мененджеру**`;
          kb = [[{ text: "💬 Manager", url: "https://t.me/dragonservicesupport" }]];
        } else {
          if (reason === 'rented') clientMsg = `❌ **Собственник сообщил, что квартира только что сдана, мы ее удалили уже из каталога. Откройте каталог и продолжите поиск.**`;
          if (reason === 'term') clientMsg = `❌ **Хозяин квартиры сообщил, что его не устраивают сроки проживания. Что ищет жильцов только на долгий срок.**`;
          if (reason === 'pets') clientMsg = `❌ **Хозяин против домашних животных в квартире.**`;
          kb = [[{ text: "🐉 Catalog / Каталог", web_app: { url: `${SITE_URL}?user_id=${lead?.telegram_id}` } }]];
        }

        if (lead?.telegram_id) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: Number(lead.telegram_id), text: clientMsg, parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } })
          });
        }
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: MY_ADMIN_ID, message_id: msgId, text: `🏁 Обработано: ${reason}` })
        });
      }
      return NextResponse.json({ ok: true });
    }

    // --- ОБРАБОТКА СООБЩЕНИЙ ---
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text || "";

      // Команда /admin для просмотра последних 5 заявок
      if (text === '/admin' && chatId === MY_ADMIN_ID) {
        const { data: leads } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(5);
        if (leads) {
          for (const l of leads) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                chat_id: MY_ADMIN_ID, 
                text: `📑 Заявка #${l.id} (${l.status})\n🏠 Объект: ${l.apartment_id}\n👤 Клиент: ${l.telegram_id}`,
                reply_markup: { inline_keyboard: [[{ text: "✅ Подтвердить", callback_data: `preconf_${l.id}` }, { text: "❌ Отказать", callback_data: `predecl_${l.id}` }]] }
              })
            });
          }
        }
        return NextResponse.json({ ok: true });
      }

      if (chatId !== MY_ADMIN_ID) {
        if (text.startsWith('/start')) {
          await supabase.from('users').upsert({ telegram_id: chatId, username: body.message.from?.username || "anonymous", referrer: text.split(' ')[1] || 'direct', status: 'active' }, { onConflict: 'telegram_id' });
        }
        const isSub = await checkSub(chatId);
        if (!isSub) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId, 
              text: `🛎 **Пожалуйста, подпишитесь на наш канал.**\nЧтобы не потеряться, подпишитесь на новости и обновление каталога.\n\n🛎 **Please subscribe.**`,
              reply_markup: { inline_keyboard: [[{ text: "📢 Subscribe", url: "https://t.me/dragonindanang" }], [{ text: "🔄 Я подписался", callback_data: "check_sub" }]] }
            })
          });
          return NextResponse.json({ ok: true });
        }
        await sendWelcome(chatId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: true });
  }
}
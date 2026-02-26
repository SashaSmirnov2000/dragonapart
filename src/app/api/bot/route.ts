export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // ЛОГ ДЛЯ ОТЛАДКИ (увидишь в Vercel Logs)
    console.log("📥 Входящие данные в API:", JSON.stringify(body));

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const MY_ADMIN_ID = 1920798985;
    const SITE_URL = "https://dragonapart.vercel.app";

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // --- 1. ОБРАБОТКА CALLBACK (Кнопки админа) ---
    if (body.callback_query) {
      const callbackData = body.callback_query.data;
      const messageId = body.callback_query.message.message_id;
      const oldText = body.callback_query.message.text || "";

      if (callbackData.startsWith('confirm_')) {
        const id = callbackData.split('_')[1];
        await supabase.from('leads').update({ status: 'confirmed' }).eq('id', id);
        const { data: lead } = await supabase.from('leads').select('*').eq('id', id).single();
        
        if (lead && lead.user_id) {
          const confirmText = 
            `✅ **Ваш запрос подтвержден!**\nМенеджер свяжется с вами в ближайшее время для уточнения деталей.\n\n` +
            `✅ **Your request is confirmed!**\nThe manager will contact you shortly to clarify the details.`;

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: Number(lead.user_id),
              text: confirmText,
              parse_mode: "Markdown"
            })
          });

          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: MY_ADMIN_ID,
              message_id: messageId,
              text: oldText + "\n\n✅ **СТАТУС: ПОДТВЕРЖДЕНО / CONFIRMED**",
              parse_mode: "Markdown"
            })
          });
        }
      }
      return NextResponse.json({ ok: true });
    }

    // --- 2. КОМАНДА /START ---
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id;
      const text = body.message.text;
      const username = body.message.from?.username || "anonymous";

      if (text.startsWith('/start')) {
        const startParam = text.split(' ')[1] || 'direct';
        
        await supabase.from('users').upsert({ 
          telegram_id: chatId, 
          username: username,
          referrer: startParam
        }, { onConflict: 'telegram_id' });

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🇷🇺 **Добро пожаловать в DragonApart!**\nНайдите свою идеальную квартиру в Дананге.\n\n` +
                  `🇬🇧 **Welcome to DragonApart!**\nFind your perfect apartment in Da Nang.`,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[{ text: "🐉 Catalog / Каталог", web_app: { url: SITE_URL } }]]
            }
          })
        });
        return NextResponse.json({ ok: true });
      }
    }

    // --- 3. НОВАЯ ЗАЯВКА С САЙТА ---
    // Проверяем наличие apartment_id (это признак заявки с фронтенда)
    if (body.apartment_id) {
      console.log("🚀 Обработка заявки для пользователя:", body.user_id);

      // А. ПИШЕМ КЛИЕНТУ (если есть ID)
      if (body.user_id && body.user_id !== "null") {
        const userMessage = 
          `⏳ **Заявка принята!**\nМы уже связываемся с владельцем квартиры "${body.apartment_id}". Как только получим ответ, сразу сообщим вам.\n\n` +
          `⏳ **Request accepted!**\nWe are contacting the owner of "${body.apartment_id}". We will notify you as soon as we get an answer.`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: Number(body.user_id),
            text: userMessage,
            parse_mode: "Markdown"
          })
        });
      } else {
        console.warn("⚠️ Предупреждение: user_id отсутствует, клиент не получит уведомление.");
      }

      // Б. ПИШЕМ АДМИНУ (Всегда)
      const adminResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: MY_ADMIN_ID,
          text: `🔔 **НОВАЯ ЗАЯВКА! / NEW LEAD!**\n\n` +
                `🏠 Объект: ${body.apartment_id}\n` +
                `👤 Клиент: @${body.client_username || 'anonymous'}\n` +
                `📅 Срок: ${body.stay_duration}\n` +
                `👥 Гости: ${body.guests}\n` +
                `🐾 Животные: ${body.pets}\n` +
                `⏰ Время просмотра: ${body.preferred_date || 'не указано'}\n` +
                `🆔 UserID: ${body.user_id || 'неизвестно'}`,
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Подтвердить наличие", callback_data: `confirm_${body.id}` }
            ]]
          },
          parse_mode: "Markdown"
        })
      });

      const adminResult = await adminResponse.json();
      console.log("📤 Результат отправки админу:", adminResult);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("❌ Webhook Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const MY_ADMIN_ID = 1920798985;
    const SITE_URL = "https://dragonapart.vercel.app";

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // --- 1. КНОПКИ ПОДТВЕРЖДЕНИЯ (Для админа) ---
    if (body.callback_query) {
      const callbackData = body.callback_query.data;
      const messageId = body.callback_query.message.message_id;
      const oldText = body.callback_query.message.text || "";

      if (callbackData.startsWith('confirm_')) {
        const id = callbackData.split('_')[1];
        await supabase.from('leads').update({ status: 'confirmed' }).eq('id', id);
        const { data: lead } = await supabase.from('leads').select('*').eq('id', id).single();
        
        if (lead) {
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
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text || '';
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
      }
      return NextResponse.json({ ok: true });
    }

    // --- 3. НОВАЯ ЗАЯВКА С САЙТА ---
    if (body.apartment_id && body.user_id) {
      // Сообщение для клиента (сразу на двух языках)
      const userMessage = 
        `⏳ **Заявка принята!**\nМы уже связываемся с владельцем квартиры "${body.apartment_id}". Как только получим ответ, сразу сообщим вам.\n\n` +
        `⏳ **Request accepted!**\nWe are contacting the owner of "${body.apartment_id}". We will notify you as soon as we get an answer.`;

      // А. ПИШЕМ КЛИЕНТУ
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: Number(body.user_id),
          text: userMessage,
          parse_mode: "Markdown"
        })
      });

      // Б. ПИШЕМ АДМИНУ (Тебе)
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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
                `⏰ Время просмотра: ${body.preferred_date || 'не указано'}`,
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Подтвердить наличие", callback_data: `confirm_${body.id}` }
            ]]
          },
          parse_mode: "Markdown"
        })
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ ok: true });
  }
}
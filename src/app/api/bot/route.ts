export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET-запрос для проверки в браузере
export async function GET() {
  return NextResponse.json({ status: "API is active. Waiting for Telegram POST requests." });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const MY_ADMIN_ID = 1920798985;
    const SITE_URL = "https://dragonapart.vercel.app";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!botToken || !supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Missing Env Vars" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- 1. ЛОГИКА CALLBACK (Кнопки подтверждения) ---
    if (body.callback_query) {
      const callbackData = body.callback_query.data;
      const messageId = body.callback_query.message.message_id;
      const oldText = body.callback_query.message.text || "";

      if (callbackData.startsWith('confirm_')) {
        const id = callbackData.split('_')[1];
        await supabase.from('leads').update({ status: 'confirmed' }).eq('id', id);
        const { data: lead } = await supabase.from('leads').select('*').eq('id', id).single();
        
        if (lead) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: Number(lead.user_id),
              text: `✅ **Ваш запрос подтвержден!**\n\nМы проверили наличие квартиры. Менеджер свяжется с вами в ближайшее время.`,
              parse_mode: "Markdown"
            })
          });

          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: MY_ADMIN_ID,
              message_id: messageId,
              text: oldText + "\n\n✅ **СТАТУС: ПОДТВЕРЖДЕНО**",
              parse_mode: "Markdown"
            })
          });
        }
      }
      return NextResponse.json({ ok: true });
    }

    // --- 2. ЛОГИКА СООБЩЕНИЙ (/start) ---
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text || '';
      const username = body.message.from?.username || "anonymous";

      if (text.startsWith('/start')) {
        const startParam = text.split(' ')[1] || 'direct';
        let dbStatus = "✅ Данные сохранены";

        try {
          const { error } = await supabase.from('users').upsert({ 
            telegram_id: chatId, 
            username: username,
            referrer: startParam
          }, { onConflict: 'telegram_id' });

          if (error) dbStatus = `❌ Ошибка БД: ${error.message}`;
        } catch (e: any) {
          dbStatus = `⚠️ Сбой подключения к БД`;
        }

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🇷🇺 **Добро пожаловать в DragonApart!**\n\nСтатус системы: ${dbStatus}\n\nНайдите свою идеальную квартиру в Дананге.`,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[{ text: "🐉 Открыть каталог", web_app: { url: SITE_URL } }]]
            }
          })
        });
      }
      return NextResponse.json({ ok: true });
    }

    // --- 3. УВЕДОМЛЕНИЕ О ЗАЯВКЕ С САЙТА ---
    if (body.apartment_id && body.user_id) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: MY_ADMIN_ID,
          text: `🔔 **НОВАЯ ЗАЯВКА!**\n\nКвартира: ${body.apartment_id}\nКлиент: @${body.client_username || 'без ника'}\nСрок: ${body.stay_duration}`,
          reply_markup: {
            inline_keyboard: [[{ text: "✅ Подтвердить наличие", callback_data: `confirm_${body.id}` }]]
          }
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
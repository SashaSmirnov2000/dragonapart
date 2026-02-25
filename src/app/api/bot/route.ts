export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  return NextResponse.json({ status: "API is active. Waiting for Telegram POST requests." });
}

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

    if (!botToken) return NextResponse.json({ error: "No Token" }, { status: 500 });

    // 1. ЛОГИКА CALLBACK (Кнопки)
    if (body.callback_query) {
      const callbackData = body.callback_query.data;
      const chatId = body.callback_query.message.chat.id;
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

    // 2. ЛОГИКА СООБЩЕНИЙ (/start)
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text || '';
      const username = body.message.from?.username || "anonymous";

      if (text.startsWith('/start')) {
        const startParam = text.split(' ')[1] || 'direct';
        await supabase.from('users').upsert({ 
          telegram_id: chatId, 
          referrer: startParam, 
          username: username 
        }, { onConflict: 'telegram_id' });

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: "🇷🇺 **Добро пожаловать в DragonApart!**\nНайдите квартиру в Дананге.\n\n🇬🇧 **Welcome!** Find your apartment in Da Nang.",
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[{ text: "🐉 Открыть каталог", web_app: { url: SITE_URL } }]]
            }
          })
        });
      }
      return NextResponse.json({ ok: true });
    }

    // 3. ЛОГИКА НОВОЙ ЗАЯВКИ (С фронтенда)
    if (body.apartment_id && body.user_id) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: MY_ADMIN_ID,
          text: `🔔 **НОВАЯ ЗАЯВКА!**\n\nКвартира: ${body.apartment_id}\nКлиент: @${body.client_username || 'anonymous'}\nСрок: ${body.stay_duration}`,
          reply_markup: {
            inline_keyboard: [[{ text: "✅ Подтвердить наличие", callback_data: `confirm_${body.id}` }]]
          }
        })
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: true });
  }
}
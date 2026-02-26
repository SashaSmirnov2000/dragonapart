export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const SITE_URL = "https://dragonapart.vercel.app";

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Обработка сообщения /start
    if (body.message && body.message.text?.startsWith('/start')) {
      const chatId = body.message.chat.id;
      const username = body.message.from?.username || "anonymous";
      const startParam = body.message.text.split(' ')[1] || 'direct';

      // Сохраняем юзера в таблицу users (как на твоем скрине)
      await supabase.from('users').upsert({
        telegram_id: chatId,
        username: username,
        referrer: startParam,
        status: 'lead'
      }, { onConflict: 'telegram_id' });

      // Отправляем приветствие с кнопкой (добавляем ID в URL для надежности)
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🇷🇺 **Добро пожаловать в DragonApart!**\nНайдите свою квартиру в Дананге.`,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "🐉 Открыть каталог", web_app: { url: `${SITE_URL}?user_id=${chatId}` } }
            ]]
          }
        })
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
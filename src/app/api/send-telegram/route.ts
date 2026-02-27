export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  // Сразу отвечаем Телеграму, чтобы он не слал повторы
  const response = NextResponse.json({ ok: true });

  try {
    const body = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const MY_ADMIN_ID = 1920798985;

    if (!body.apartment_id) return response;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    const clientTgId = body.telegram_id;

    // 1. Уведомление КЛИЕНТУ
    if (clientTgId) {
      const clientText = 
        `⏳ **Заявка принята!**\n\n` +
        `✨ Мы уже связываемся с хозяином квартиры "${body.apartment_id}". Как только получим ответ, мы сразу пришлем вам уведомление.\n\n` +
        `⌚️ В рабочее время (с 10:00 до 22:00) мы стараемся обрабатывать заявки как можно скорее.\n\n` +
        `✨ We are already contacting the landlord. We will notify you as soon as we get a response.`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: Number(clientTgId),
          text: clientText,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "💬 Manager / Поддержка", url: "https://t.me/dragonservicesupport" }]]
          }
        })
      });
    }

    // 2. Сбор данных для админа
    let displayUser = body.client_username || 'anonymous';
    let referrerSource = 'не определен';

    if (clientTgId) {
      const { data: userData } = await supabase
        .from('users')
        .select('username, referrer')
        .eq('telegram_id', Number(clientTgId))
        .single();
      if (userData?.username) displayUser = userData.username;
      if (userData?.referrer) referrerSource = userData.referrer;
    }

    // 3. Уведомление АДМИНУ
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: MY_ADMIN_ID,
        text: `🔔 **НОВАЯ ЗАЯВКА!**\n\n🏠 Объект: ${body.apartment_id}\n👤 Клиент: @${displayUser}\n🔗 Источник: \`${referrerSource}\`\n📅 Срок: ${body.stay_duration}\n👥 Гости: ${body.guests}\n🐾 Животные: ${body.pets}\n⏰ Просмотр: ${body.preferred_date || 'не указано'}`,
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Подтвердить...", callback_data: `preconf_${body.id}` },
            { text: "❌ Отказать...", callback_data: `predecl_${body.id}` }
          ]]
        },
        parse_mode: "Markdown"
      })
    });

    return response;
  } catch (error: any) {
    console.error("❌ Send-Telegram Error:", error.message);
    return response; 
  }
}
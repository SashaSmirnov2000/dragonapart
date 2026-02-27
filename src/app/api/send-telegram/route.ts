export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  // 1. Сразу подготавливаем ответ для Telegram, чтобы избежать повторных запросов (дублей)
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
    
    // Выполняем запрос к базе максимально быстро
    const { data: userData } = clientTgId 
      ? await supabase.from('users').select('username, referrer').eq('telegram_id', Number(clientTgId)).single()
      : { data: null };

    const displayUser = userData?.username || body.client_username || 'anonymous';
    const referrerSource = userData?.referrer || 'не определен';

    const adminText = `🔔 **НОВАЯ ЗАЯВКА!**\n\n` +
      `🏠 Объект: ${body.apartment_id}\n` +
      `👤 Клиент: @${displayUser}\n` +
      `🔗 Источник: \`${referrerSource}\`\n` +
      `📅 Срок: ${body.stay_duration}\n` +
      `👥 Гости: ${body.guests}\n` +
      `🐾 Животные: ${body.pets}\n` +
      `⏰ Просмотр: ${body.preferred_date || 'не указано'}\n` +
      `🆔 ID: \`${clientTgId}\``;

    const clientText = `⏳ **Заявка принята!**\n\n` +
      `✨ Мы уже связываемся с хозяином квартиры "${body.apartment_id}". Как только получим ответ, мы сразу пришлем вам уведомление.\n\n` +
      `⌚️ В рабочее время (с 10:00 до 22:00) мы стараемся обрабатывать заявки как можно скорее. Ожидайте, пожалуйста.\n\n` +
      `✨ We are already contacting the landlord. We will notify you as soon as we get a response.\n\n` +
      `⌚️ During working hours (10 AM – 10 PM), we process requests as quickly as possible.`;

    // 2. Используем Promise.all без await в конце, если хотим максимально быстро ответить серверу, 
    // но в Next.js лучше подождать выполнения, чтобы процесс не убили. 
    // Однако, мы минимизировали логику ПЕРЕД отправкой.
    await Promise.all([
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: MY_ADMIN_ID,
          text: adminText,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Подтвердить...", callback_data: `preconf_${body.id}` },
              { text: "❌ Отказать...", callback_data: `predecl_${body.id}` }
            ]]
          }
        })
      }),
      clientTgId ? fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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
      }) : Promise.resolve()
    ]);

    return response;
  } catch (error: any) {
    console.error("Error:", error.message);
    return response; 
  }
}
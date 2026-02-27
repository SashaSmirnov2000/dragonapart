export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
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
    
    // Получаем данные пользователя из базы, включая username
    const { data: userData } = clientTgId 
      ? await supabase.from('users').select('username, referrer').eq('telegram_id', Number(clientTgId)).single()
      : { data: null };

    // Приоритет: username из базы -> username из запроса -> 'anonymous'
    const displayUser = userData?.username || body.client_username || 'anonymous';
    const referrerSource = userData?.referrer || 'direct';

    // Текст для Администратора
    const adminText = `🔔 **НОВАЯ ЗАЯВКА**\n\n` +
      `🏠 **Объект:** ${body.apartment_id}\n` +
      `👤 **Клиент:** @${displayUser.replace('_', '\\_')}\n` +
      `🔗 **Источник:** \`${referrerSource}\`\n` +
      `📅 **Срок:** ${body.stay_duration}\n` +
      `👥 **Гости:** ${body.guests}\n` +
      `🐾 **Животные:** ${body.pets}\n` +
      `⏰ **Просмотр:** ${body.preferred_date || 'не указано'}\n` +
      `🆔 **ID:** \`${clientTgId}\``;

    // Текст для Клиента (RU / EN)
    const clientText = `⏳ **Заявка принята! / Request received!**\n\n` +
      `🇷🇺 Мы уже связываемся с владельцем объекта "${body.apartment_id}". Как только получим ответ, мы сразу пришлем вам уведомление.\n\n` +
      `🇺🇸 We are already contacting the landlord regarding "${body.apartment_id}". We will notify you as soon as we get a response.\n\n` +
      `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n` +
      `⌚️ **10:00 — 22:00**\n` +
      `🇷🇺 В рабочее время мы обрабатываем заявки максимально быстро.\n` +
      `🇺🇸 During business hours, we process requests as quickly as possible.`;

    await Promise.all([
      // Отправка Админу
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: MY_ADMIN_ID,
          text: adminText,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Подтвердить", callback_data: `preconf_${body.id}` },
              { text: "❌ Отказать", callback_data: `predecl_${body.id}` }
            ]]
          }
        })
      }),
      // Отправка Клиенту
      clientTgId ? fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: Number(clientTgId),
          text: clientText,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "💬 Support / Поддержка", url: "https://t.me/dragonservicesupport" }
            ]]
          }
        })
      }) : Promise.resolve()
    ]);

    return response;
  } catch (error: any) {
    console.error("Error in send-telegram:", error.message);
    return response; 
  }
}
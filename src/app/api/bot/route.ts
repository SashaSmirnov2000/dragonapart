export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
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
        const leadId = callbackData.split('_')[1];
        
        // Обновляем статус в базе
        await supabase.from('leads').update({ status: 'confirmed' }).eq('id', leadId);
        
        // Берем telegram_id напрямую из таблицы leads (так как имена теперь одинаковые)
        const { data: lead } = await supabase
          .from('leads')
          .select('telegram_id')
          .eq('id', leadId)
          .single();
        
        const clientTgId = lead?.telegram_id;

        if (clientTgId) {
          const confirmText = 
            `✅ **Ваш запрос подтвержден!**\nМенеджер свяжется с вами в ближайшее время.\n\n` +
            `✅ **Your request is confirmed!**\nThe manager will contact you shortly.`;

          // Отправляем уведомление клиенту
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: Number(clientTgId),
              text: confirmText,
              parse_mode: "Markdown"
            })
          });

          // Обновляем текст сообщения у админа
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

    // --- 2. КОМАНДА /START ---
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id;
      const text = body.message.text;
      const username = body.message.from?.username || "anonymous";

      if (text.startsWith('/start')) {
        const startParam = text.split(' ')[1] || 'direct';
        
        // Сохраняем пользователя в таблицу users (используем telegram_id)
        await supabase.from('users').upsert({ 
          telegram_id: chatId.toString(), 
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
    if (body.apartment_id) {
      // Используем telegram_id из тела запроса (приходит с фронтенда)
      const clientTgId = body.telegram_id || body.user_id;

      // А. Уведомление КЛИЕНТУ
      if (clientTgId) {
        const userMessage = 
          `⏳ **Заявка принята!**\nМы проверяем доступность объекта "${body.apartment_id}".\n\n` +
          `⏳ **Request accepted!**\nChecking availability for "${body.apartment_id}".`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: Number(clientTgId),
            text: userMessage,
            parse_mode: "Markdown"
          })
        });
      }

      // Б. Уведомление АДМИНУ
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: MY_ADMIN_ID,
          text: `🔔 **НОВАЯ ЗАЯВКА!**\n\n` +
                `🏠 Объект: ${body.apartment_id}\n` +
                `👤 Клиент: @${body.client_username || 'anonymous'}\n` +
                `📅 Срок: ${body.stay_duration}\n` +
                `👥 Гости: ${body.guests}\n` +
                `🐾 Животные: ${body.pets}\n` +
                `⏰ Время: ${body.preferred_date || 'не указано'}\n` +
                `🆔 TG ID: ${clientTgId || 'неизвестно'}`,
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
  } catch (error: any) {
    console.error("❌ Webhook Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
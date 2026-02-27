export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const SITE_URL = "https://dragonapart.vercel.app";
    const MY_ADMIN_ID = 1920798985;
    const CHANNEL_ID = "@dragonindanang"; // ID твоего канала

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
        await supabase.from('leads').update({ status: 'confirmed' }).eq('id', leadId);
        const { data: lead } = await supabase.from('leads').select('telegram_id').eq('id', leadId).single();
        
        if (lead?.telegram_id) {
          const confirmText = `✅ **Ваш запрос подтвержден!**\nМенеджер свяжется с вами.\n\n✅ **Your request is confirmed!**`;
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: Number(lead.telegram_id), text: confirmText, parse_mode: "Markdown" })
          });
          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: MY_ADMIN_ID, message_id: messageId, text: oldText + "\n\n✅ **СТАТУС: ПОДТВЕРЖДЕНО**", parse_mode: "Markdown" })
          });
        }
      }
      return NextResponse.json({ ok: true });
    }

    // --- 2. ОБРАБОТКА СООБЩЕНИЙ ---
    if (body.message) {
      const chatId = body.message.chat.id;
      const username = body.message.from?.username || "anonymous";
      const text = body.message.text || "";

      // Проверка подписки на канал
      const checkSub = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${chatId}`);
      const subData = await checkSub.json();
      const isSubscribed = subData.ok && ['member', 'administrator', 'creator'].includes(subData.result.status);

      if (!isSubscribed) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🇷🇺 **Для доступа к каталогу, пожалуйста, подпишитесь на наш канал.**\nТак мы сможем оставаться на связи, если что-то случится с ботом.\n\n🇬🇧 **Please subscribe to our channel to access the catalog.**`,
            reply_markup: {
              inline_keyboard: [
                [{ text: "📢 Подписаться / Subscribe", url: "https://t.me/dragonindanang" }],
                [{ text: "🔄 Я подписался / I've subscribed", callback_data: "check_sub" }] 
              ]
            }
          })
        });
        return NextResponse.json({ ok: true });
      }

      // Сохраняем/обновляем юзера
      if (text.startsWith('/start')) {
        const startParam = text.split(' ')[1] || 'direct';
        await supabase.from('users').upsert({
          telegram_id: chatId,
          username: username,
          referrer: startParam,
          status: 'active'
        }, { onConflict: 'telegram_id' });
      }

      const welcomeText = 
        `🇷🇺 **Устали от бесконечного поиска квартиры?**\n` +
        `DragonApart — это каталог только актуального жилья. Мы обновляем базу ежедневно и удаляем занятые объекты сразу.\n\n` +
        `🇬🇧 **Tired of endless apartment hunting?**\n` +
        `DragonApart is a catalog of only currently available listings. We update daily.\n\n` +
        `👨‍💻 **Manager:** @dragonservicesupport`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: welcomeText,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🐉 Catalog / Открыть каталог", web_app: { url: `${SITE_URL}?user_id=${chatId}` } }],
              [{ text: "💬 Manager / Поддержка", url: "https://t.me/dragonservicesupport" }]
            ]
          }
        })
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const SITE_URL = "https://dragonapart.vercel.app";
    const MY_ADMIN_ID = 1920798985;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // --- 1. ОБРАБОТКА КНОПОК АДМИНА (Confirm) ---
    if (body.callback_query) {
      const callbackData = body.callback_query.data;
      const messageId = body.callback_query.message.message_id;
      const oldText = body.callback_query.message.text || "";

      if (callbackData.startsWith('confirm_')) {
        const leadId = callbackData.split('_')[1];
        
        // Обновляем статус в базе
        await supabase.from('leads').update({ status: 'confirmed' }).eq('id', leadId);
        
        // Достаем ID клиента из базы
        const { data: lead } = await supabase
          .from('leads')
          .select('telegram_id')
          .eq('id', leadId)
          .single();
        
        if (lead?.telegram_id) {
          const confirmText = 
            `✅ **Ваш запрос подтвержден!**\nМенеджер свяжется с вами в ближайшее время для уточнения деталей.\n\n` +
            `✅ **Your request is confirmed!**\nThe manager will contact you shortly.`;

          // Пишем клиенту
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: Number(lead.telegram_id),
              text: confirmText,
              parse_mode: "Markdown"
            })
          });

          // Обновляем сообщение у админа
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

    // --- 2. ОБРАБОТКА КОМАНДЫ /START ---
    if (body.message && body.message.text?.startsWith('/start')) {
      const chatId = body.message.chat.id;
      const username = body.message.from?.username || "anonymous";
      const startParam = body.message.text.split(' ')[1] || 'direct';

      await supabase.from('users').upsert({
        telegram_id: chatId,
        username: username,
        referrer: startParam,
        status: 'active'
      }, { onConflict: 'telegram_id' });

      const welcomeText = 
        `🇷🇺 **Устали от бесконечного поиска квартиры?**\n` +
        `Надоело тратить время на варианты, которые уже давно сданы? DragonApart — это каталог только актуального жилья.\n\n` +
        `✅ Мы обновляем базу ежедневно.\n` +
        `✅ Если мы узнаем, что квартира занята — она удаляется мгновенно.\n\n` +
        `--- \n\n` +
        `🇬🇧 **Tired of endless apartment hunting?**\n` +
        `Sick of visiting places that are already rented out? DragonApart is a catalog of only currently available listings.\n\n` +
        `✅ We update our database daily.\n` +
        `✅ If an apartment gets rented — we remove it immediately.`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: welcomeText,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "🐉 Catalog / Открыть каталог", web_app: { url: `${SITE_URL}?user_id=${chatId}` } }
            ]]
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
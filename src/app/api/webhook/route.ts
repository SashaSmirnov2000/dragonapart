export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const ok = NextResponse.json({ ok: true });
  try {
    const body = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const SITE_URL = "https://dragonapart.vercel.app";
    const MY_ADMIN_ID = 1920798985;
    const CHANNEL_ID = "@dragonindanang"; 

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const checkSub = async (uid: number) => {
      const r = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${uid}`);
      const d = await r.json();
      return d.ok && ['member', 'administrator', 'creator'].includes(d.result.status);
    };

    const sendWelcome = async (chatId: number) => {
      const text = `✨ **Устали от поиска?**\nDragonApart — только актуальное жилье.\n\n🏠 **Tired of hunting?**\nDragonApart — only available listings.`;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId, text, parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🐉 Catalog / Открыть каталог", web_app: { url: `${SITE_URL}?user_id=${chatId}` } }],
              [{ text: "💬 Manager / Поддержка", url: "https://t.me/dragonservicesupport" }]
            ]
          }
        })
      });
    };

    // CALLBACKS (Кнопки)
    if (body.callback_query) {
      const data = body.callback_query.data;
      const chatId = body.callback_query.message.chat.id;
      const msgId = body.callback_query.message.message_id;

      if (data === 'check_sub') {
        if (await checkSub(chatId)) {
          await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: msgId }) });
          await sendWelcome(chatId);
        } else {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: body.callback_query.id, text: "❌ Подпишитесь на канал!", show_alert: true }) });
        }
        return ok;
      }

      if (data.startsWith('preconf_')) {
        const id = data.split('_')[1];
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: MY_ADMIN_ID, message_id: msgId, reply_markup: { inline_keyboard: [[{ text: "💎 Всё ок", callback_data: `conf_full_${id}` }], [{ text: "⏰ Время", callback_data: `conf_time_${id}` }]] } })
        });
      }

      if (data.startsWith('predecl_')) {
        const id = data.split('_')[1];
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: MY_ADMIN_ID, message_id: msgId, reply_markup: { inline_keyboard: [[{ text: "🏠 Сдана", callback_data: `decl_rented_${id}` }], [{ text: "⏳ Срок", callback_data: `decl_term_${id}` }], [{ text: "🐾 Животные", callback_data: `decl_pets_${id}` }]] } })
        });
      }

      if (data.startsWith('conf_') || data.startsWith('decl_')) {
        const [type, reason, leadId] = data.split('_');
        const { data: lead } = await supabase.from('leads').select('telegram_id').eq('id', leadId).single();
        let clientMsg = "";
        let kb = [];

        if (type === 'conf') {
          clientMsg = reason === 'full' ? `✅ **Подтверждено!**\nНапишите менеджеру для получения локации.` : `✅ **Свободно!**\nСобственник просит другое время. Напишите менеджеру.`;
          kb = [[{ text: "💬 Manager", url: "https://t.me/dragonservicesupport" }]];
        } else {
          clientMsg = reason === 'rented' ? `❌ **Сдана**\nУже сдали, мы удалили её. Поищите другие!` : reason === 'term' ? `❌ **Срок**\nХозяин ищет только на долгий срок.` : `❌ **Животные**\nХозяин против питомцев.`;
          kb = [[{ text: "🐉 Catalog", web_app: { url: `${SITE_URL}?user_id=${lead?.telegram_id}` } }]];
        }

        if (lead?.telegram_id) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: Number(lead.telegram_id), text: clientMsg, parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } }) });
        }
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: MY_ADMIN_ID, message_id: msgId, text: `🏁 Обработано: ${reason}`, parse_mode: "Markdown" }) });
      }
      return ok;
    }

    // MESSAGES
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text || "";

      // КОМАНДА АДМИН
      if (text === '/admin' && chatId === MY_ADMIN_ID) {
        const { data: leads } = await supabase.from('leads').select('*').eq('status', 'new').limit(5).order('created_at', { ascending: false });
        if (!leads?.length) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: MY_ADMIN_ID, text: "🎉 Новых заявок нет!" }) });
        } else {
          for (const l of leads) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: MY_ADMIN_ID, text: `📑 Заявка #${l.id}\n🏠 Объект: ${l.apartment_id}\n👤 ID: ${l.telegram_id}`, reply_markup: { inline_keyboard: [[{ text: "✅ Подтвердить", callback_data: `preconf_${l.id}` }, { text: "❌ Отказать", callback_data: `predecl_${l.id}` }]] } })
            });
          }
        }
        return ok;
      }

      if (chatId !== MY_ADMIN_ID) {
        if (text.startsWith('/start')) {
          await supabase.from('users').upsert({ telegram_id: chatId, username: body.message.from?.username || "anonymous", referrer: text.split(' ')[1] || 'direct', status: 'active' }, { onConflict: 'telegram_id' });
        }
        if (!(await checkSub(chatId))) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId, text: `🛎 **Пожалуйста, подпишитесь на канал.**\nЭто поможет нам не потерять связь с вами.\n\n🛎 **Please subscribe.**`,
              reply_markup: { inline_keyboard: [[{ text: "📢 Subscribe", url: "https://t.me/dragonindanang" }], [{ text: "🔄 I've subscribed", callback_data: "check_sub" }]] }
            })
          });
          return ok;
        }
        await sendWelcome(chatId);
      }
    }
    return ok;
  } catch (e) { return ok; }
}
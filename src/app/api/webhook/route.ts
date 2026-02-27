export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const SITE_URL = "https://dragonapart.vercel.app";
    const MY_ADMIN_ID = 1920798985;
    const CHANNEL_ID = "@dragonindanang"; 

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const checkUserSubscription = async (userId: number) => {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`);
      const data = await resp.json();
      return data.ok && ['member', 'administrator', 'creator'].includes(data.result.status);
    };

    const sendWelcome = async (chatId: number) => {
      const welcomeText = `✨ **Устали от бесконечного поиска квартиры?**\nDragonApart — это каталог только актуального жилья. Мы обновляем базу ежедневно.\n\n🏠 **Tired of endless apartment hunting?**\nDragonApart is a catalog of only currently available listings. We update daily.\n\n👨‍💻 **Manager:** @dragonservicesupport`;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId, text: welcomeText, parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🐉 Catalog / Открыть каталог", web_app: { url: `${SITE_URL}?user_id=${chatId}` } }],
              [{ text: "💬 Manager / Поддержка", url: "https://t.me/dragonservicesupport" }]
            ]
          }
        })
      });
    };

    // --- 1. ОБРАБОТКА CALLBACK (Кнопки) ---
    if (body.callback_query) {
      const callbackData = body.callback_query.data;
      const chatId = body.callback_query.message.chat.id;
      const messageId = body.callback_query.message.message_id;

      if (callbackData === 'check_sub') {
        if (await checkUserSubscription(chatId)) {
          await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: messageId }) });
          await sendWelcome(chatId);
        } else {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: body.callback_query.id, text: "❌ Подписка не найдена", show_alert: true }) });
        }
        return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('preconf_')) {
        const leadId = callbackData.split('_')[1];
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: MY_ADMIN_ID, message_id: messageId, text: `✅ **Выберите вариант подтверждения:**`,
            reply_markup: {
              inline_keyboard: [
                [{ text: "💎 Всё ок (Местоположение)", callback_data: `conf_full_${leadId}` }],
                [{ text: "⏰ Другое время", callback_data: `conf_time_${leadId}` }]
              ]
            }
          })
        });
      }

      if (callbackData.startsWith('predecl_')) {
        const leadId = callbackData.split('_')[1];
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: MY_ADMIN_ID, message_id: messageId, text: `❌ **Выберите причину отказа:**`,
            reply_markup: {
              inline_keyboard: [
                [{ text: "🏠 Уже сдана", callback_data: `decl_rented_${leadId}` }],
                [{ text: "⏳ Короткий срок", callback_data: `decl_term_${leadId}` }],
                [{ text: "🐾 Животные", callback_data: `decl_pets_${leadId}` }]
              ]
            }
          })
        });
      }

      if (callbackData.startsWith('conf_') || callbackData.startsWith('decl_')) {
        const [type, reason, leadId] = callbackData.split('_');
        const { data: lead } = await supabase.from('leads').select('telegram_id').eq('id', leadId).single();
        
        let clientMsg = "";
        let button = [];

        if (type === 'conf') {
          clientMsg = reason === 'full' 
            ? `✅ **Подтверждено!**\nВаша квартира и время просмотра подтверждены. Напишите менеджеру для уточнения деталей.\n\n✅ **Confirmed!**\nEverything is set. Please contact manager for details.`
            : `✅ **Квартира свободна!**\nСобственник подтвердил наличие, но просит назначить другое время. Напишите менеджеру.\n\n✅ **Apartment is available!**\nOwner asks for a different viewing time. Please contact manager.`;
          button = [[{ text: "💬 Manager / Менеджер", url: "https://t.me/dragonservicesupport" }]];
        } else {
          if (reason === 'rented') clientMsg = `❌ **Квартира сдана**\nСобственник сообщил, что квартира только что сдана. Мы уже удалили ее из каталога. Пожалуйста, выберите другой вариант.\n\n❌ **Already rented**\nThis unit was just rented out. We've removed it. Please try other options.`;
          if (reason === 'term') clientMsg = `❌ **Срок проживания**\nХозяин ищет жильцов только на долгий срок. Посмотрите другие варианты в каталоге.\n\n❌ **Rental term**\nOwner accepts long-term rent only. Please check other listings.`;
          if (reason === 'pets') clientMsg = `❌ **Домашние животные**\nК сожалению, собственник против размещения с животными в этой квартире.\n\n❌ **No pets allowed**\nUnfortunately, the owner does not allow pets in this unit.`;
          button = [[{ text: "🐉 Catalog / Продолжить поиск", web_app: { url: `${SITE_URL}?user_id=${lead?.telegram_id}` } }]];
        }

        if (lead?.telegram_id) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: Number(lead.telegram_id), text: clientMsg, parse_mode: "Markdown", reply_markup: { inline_keyboard: button } })
          });
        }
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: MY_ADMIN_ID, message_id: messageId, text: `🏁 **Заявка обработана**\nРезультат: ${type === 'conf' ? 'Подтверждено' : 'Отказ'}\nПричина: ${reason}`, parse_mode: "Markdown" })
        });
      }
      return NextResponse.json({ ok: true });
    }

    // --- 2. ОБРАБОТКА ТЕКСТА (Только от обычных пользователей) ---
    if (body.message && body.message.chat.id !== MY_ADMIN_ID) {
      const chatId = body.message.chat.id;
      const text = body.message.text || "";

      if (text.startsWith('/start')) {
        await supabase.from('users').upsert({ telegram_id: chatId, username: body.message.from?.username || "anonymous", referrer: text.split(' ')[1] || 'direct', status: 'active' }, { onConflict: 'telegram_id' });
      }

      if (!(await checkUserSubscription(chatId))) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId, 
            text: `🛎 **Пожалуйста, подпишитесь на наш канал.**\nЭто поможет нам не потерять связь с вами, если с ботом что-то случится.\n\n🛎 **Please subscribe to our channel.**\nThis helps us stay in touch if anything happens to the bot.`,
            reply_markup: { inline_keyboard: [[{ text: "📢 Subscribe / Подписаться", url: "https://t.me/dragonindanang" }], [{ text: "🔄 I've subscribed / Я подписался", callback_data: "check_sub" }]] }
          })
        });
        return NextResponse.json({ ok: true });
      }
      await sendWelcome(chatId);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
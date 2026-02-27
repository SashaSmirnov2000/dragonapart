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
      const welcomeText = `✨ **Устали от бесконечного поиска квартиры?**\nDragonApart — это каталог только актуального жилья.\n\n🏠 **Tired of endless apartment hunting?**\nDragonApart is a catalog of only currently available listings.\n\n👨‍💻 **Manager:** @dragonservicesupport`;
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

    if (body.callback_query) {
      const callbackData = body.callback_query.data;
      const chatId = body.callback_query.message.chat.id;
      const messageId = body.callback_query.message.message_id;
      const oldText = body.callback_query.message.text || "";

      // 1. ПРОВЕРКА ПОДПИСКИ
      if (callbackData === 'check_sub') {
        if (await checkUserSubscription(chatId)) {
          await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: messageId }) });
          await sendWelcome(chatId);
        } else {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: body.callback_query.id, text: "❌ Вы еще не подписались", show_alert: true }) });
        }
        return NextResponse.json({ ok: true });
      }

      // 2. МЕНЮ ПОДТВЕРЖДЕНИЯ (Админ нажал "Подтвердить...")
      if (callbackData.startsWith('preconf_')) {
        const leadId = callbackData.split('_')[1];
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: MY_ADMIN_ID, message_id: messageId,
            text: `✅ **Выберите вариант подтверждения:**`,
            reply_markup: {
              inline_keyboard: [
                [{ text: "💎 Всё ок (Местоположение)", callback_data: `conf_full_${leadId}` }],
                [{ text: "⏰ Другое время", callback_data: `conf_time_${leadId}` }],
                [{ text: "⬅️ Назад", callback_data: `back_${leadId}` }]
              ]
            }
          })
        });
      }

      // 3. МЕНЮ ОТКАЗА (Админ нажал "Отказать...")
      if (callbackData.startsWith('predecl_')) {
        const leadId = callbackData.split('_')[1];
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: MY_ADMIN_ID, message_id: messageId,
            text: `❌ **Выберите причину отказа:**`,
            reply_markup: {
              inline_keyboard: [
                [{ text: "🏠 Уже сдана", callback_data: `decl_rented_${leadId}` }],
                [{ text: "⏳ Короткий срок", callback_data: `decl_term_${leadId}` }],
                [{ text: "🐾 Животные", callback_data: `decl_pets_${leadId}` }],
                [{ text: "⬅️ Назад", callback_data: `back_${leadId}` }]
              ]
            }
          })
        });
      }

      // 4. ЛОГИКА ОТПРАВКИ ФИНАЛЬНЫХ ОТВЕТОВ
      if (callbackData.startsWith('conf_') || callbackData.startsWith('decl_')) {
        const [type, reason, leadId] = callbackData.split('_');
        const { data: lead } = await supabase.from('leads').select('telegram_id, apartment_id').eq('id', leadId).single();
        
        let clientMsg = "";
        let adminStatus = "";

        if (type === 'conf') {
          await supabase.from('leads').update({ status: 'confirmed' }).eq('id', leadId);
          clientMsg = reason === 'full' 
            ? `✅ **Подтверждено!**\nВаша квартира и время просмотра подтверждены. Напишите менеджеру для получения точной геолокации.\n\n✅ **Confirmed!**\nEverything is set. Please contact manager for location details.`
            : `✅ **Квартира свободна!**\nСобственник готов показать объект, но просит назначить другое время. Напишите менеджеру для уточнения.\n\n✅ **Apartment is available!**\nOwner asks for a different viewing time. Please contact manager.`;
          adminStatus = "ПОДТВЕРЖДЕНО";
        } else {
          await supabase.from('leads').update({ status: 'declined' }).eq('id', leadId);
          if (reason === 'rented') clientMsg = `❌ **Квартира сдана**\nК сожалению, этот объект только что сдали. Мы удалили его из каталога. Продолжите поиск в нашем боте!\n\n❌ **Already rented**\nThis unit was just rented out. Feel free to check other options!`;
          if (reason === 'term') clientMsg = `❌ **Срок аренды**\nХозяин ищет жильцов только на долгий срок. Посмотрите другие варианты в каталоге.\n\n❌ **Rental term**\nOwner accepts long-term rent only. Please check other listings.`;
          if (reason === 'pets') clientMsg = `❌ **Животные**\nК сожалению, собственник против домашних животных в этой квартире.\n\n❌ **No pets allowed**\nUnfortunately, the owner does not allow pets in this unit.`;
          adminStatus = "ОТКАЗАНО";
        }

        if (lead?.telegram_id) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              chat_id: Number(lead.telegram_id), text: clientMsg, parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "🐉 Catalog / Каталог", web_app: { url: `${SITE_URL}?user_id=${lead.telegram_id}` } }]] }
            })
          });
        }

        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: MY_ADMIN_ID, message_id: messageId, text: `✅ Статус изменен: **${adminStatus}**\nПричина: ${reason}`, parse_mode: "Markdown" })
        });
      }

      return NextResponse.json({ ok: true });
    }

    // --- 5. ОБРАБОТКА ТЕКСТА ---
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text || "";
      if (text.startsWith('/start')) {
        await supabase.from('users').upsert({ telegram_id: chatId, username: body.message.from?.username || "anonymous", referrer: text.split(' ')[1] || 'direct', status: 'active' }, { onConflict: 'telegram_id' });
      }
      if (!(await checkUserSubscription(chatId))) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId, text: `🛎 **Для доступа, пожалуйста, подпишитесь на канал.**\n\n🛎 **Please subscribe to the channel.**`,
            reply_markup: { inline_keyboard: [[{ text: "📢 Subscribe", url: "https://t.me/dragonindanang" }], [{ text: "🔄 I've subscribed", callback_data: "check_sub" }]] }
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
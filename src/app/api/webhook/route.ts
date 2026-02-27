export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const processedRequests = new Set();

export async function POST(req: Request) {
  const responseOk = NextResponse.json({ ok: true });

  try {
    const body = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const SITE_URL = "https://dragonapart.vercel.app";
    const MY_ADMIN_ID = 1920798985;
    const CHANNEL_ID = "@dragonindanang";

    const updateId = body.update_id;
    if (updateId && processedRequests.has(updateId)) return responseOk;
    processedRequests.add(updateId);
    setTimeout(() => processedRequests.delete(updateId), 10000);

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const checkSub = async (uid: number) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${uid}`);
        const d = await res.json();
        return d.ok && ['member', 'administrator', 'creator'].includes(d.result.status);
      } catch { return false; }
    };

    const sendWelcome = async (chatId: number) => {
      const welcomeText = `✨ **Устали от бесконечных поисков жилья?**\n\n` +
        `🇷🇺 DragonApart — это актуальный каталог проверенных объектов. База обновляется ежедневно. Как только мы узнаем, что квартира занята, она сразу удаляется из каталога.\n\n` +
        `🇺🇸 DragonApart is a catalog of verified listings. We update daily. Once we know an apartment is rented, it is immediately removed from the catalog.\n\n` +
        `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n` +
        `👨‍💻 **Support:** @dragonservicesupport`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId, text: welcomeText, parse_mode: "Markdown",
          reply_markup: { 
            inline_keyboard: [
              [{ text: "🐉 Catalog / Открыть каталог", web_app: { url: `${SITE_URL}?user_id=${chatId}` } }],
              [{ text: "💬 Support / Поддержка", url: "https://t.me/dragonservicesupport" }]
            ] 
          }
        })
      });
    };

    // --- CALLBACK QUERIES ---
    if (body.callback_query) {
      const data = body.callback_query.data;
      const chatId = body.callback_query.message.chat.id;
      const msgId = body.callback_query.message.message_id;

      if (data === 'check_sub') {
        if (await checkSub(chatId)) {
          await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: msgId }) });
          await sendWelcome(chatId);
        } else {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              callback_query_id: body.callback_query.id, 
              text: "⚠️ Подписка не найдена / Subscription not found", 
              show_alert: true 
            }) 
          });
        }
        return responseOk;
      }

      if (data.startsWith('preconf_')) {
        const id = data.split('_')[1];
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: MY_ADMIN_ID, message_id: msgId, text: `✅ **Выберите способ подтверждения:**`,
            reply_markup: { inline_keyboard: [[{ text: "💎 Всё ок (Локация)", callback_data: `conf_full_${id}` }], [{ text: "⏰ Другое время", callback_data: `conf_time_${id}` }]] }
          })
        });
      }

      if (data.startsWith('predecl_')) {
        const id = data.split('_')[1];
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: MY_ADMIN_ID, message_id: msgId, text: `❌ **Укажите причину отказа:**`,
            reply_markup: { inline_keyboard: [[{ text: "🏠 Сдана", callback_data: `decl_rented_${id}` }], [{ text: "⏳ Срок", callback_data: `decl_term_${id}` }], [{ text: "🐾 Животные", callback_data: `decl_pets_${id}` }]] }
          })
        });
      }

      if (data.startsWith('conf_') || data.startsWith('decl_')) {
        const [type, reason, id] = data.split('_');
        const { data: lead } = await supabase.from('leads').select('telegram_id, apartment_id').eq('id', id).single();
        
        let clientMsg = "";
        let kb = [];

        if (type === 'conf') {
          clientMsg = reason === 'full' 
            ? `✅ **Заявка подтверждена! / Request confirmed!**\n\n🌐 Собственник готов к показу. Напишите менеджеру, чтобы получить локацию и время встречи.\n\n🌐 Landlord is ready. Please contact our manager for the location and meeting details.`
            : `✅ **Объект свободен! / Unit is available!**\n\n🌐 Квартира доступна, но нужно согласовать другое время. Напишите менеджеру для выбора слота.\n\n🌐 Unit is free, but we need to adjust the time. Please message our manager to pick a slot.`;
          kb = [[{ text: "💬 Manager / Менеджер", url: "https://t.me/dragonservicesupport" }]];
          await supabase.from('leads').update({ status: 'confirmed' }).eq('id', id);
        } else {
          if (reason === 'rented') clientMsg = `❌ **Объект сдан / Unit rented**\n\n🇷🇺 Собственник сообщил, что квартира уже сдана. Мы уже удалили её из каталога. Пожалуйста, выберите другой доступный вариант.\n\n🇺🇸 The landlord informed us that the apartment is already rented. We have removed it from the catalog. Please choose another available option.`;
          if (reason === 'term') clientMsg = `❌ **Срок аренды / Rental term**\n\n🌐 Собственник рассматривает жильцов на более длительный срок. Посмотрите похожие варианты в каталоге.\n\n🌐 The landlord is looking for a longer rental term. Please check similar units in the catalog.`;
          if (reason === 'pets') clientMsg = `❌ **Размещение с животными / Pets**\n\n🌐 К сожалению, в данной квартире запрещено проживание с питомцами.\n\n🌐 Unfortunately, pets are not allowed in this apartment.`;
          kb = [[{ text: "🐉 Catalog / Каталог", web_app: { url: `${SITE_URL}?user_id=${lead?.telegram_id}` } }]];
          await supabase.from('leads').delete().eq('id', id);
        }

        if (lead?.telegram_id) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: Number(lead.telegram_id), text: clientMsg, parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } })
          });
        }
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: MY_ADMIN_ID, message_id: msgId, text: `🏁 **Результат:** ${type === 'conf' ? 'Подтверждено' : 'Удалено'} (${reason})` })
        });
      }
      return responseOk;
    }

    // --- MESSAGES ---
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text || "";

      if (text === '/admin' && chatId === MY_ADMIN_ID) {
        const { data: leads } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(10);
        
        if (!leads?.length) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: MY_ADMIN_ID, text: "📭 Активных заявок нет." }) });
        } else {
          for (const l of leads) {
            const { data: u } = await supabase.from('users').select('username').eq('telegram_id', l.telegram_id).single();
            const clientDisplay = u?.username ? `@${u.username.replace('_', '\\_')}` : `ID: \`${l.telegram_id}\``;

            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                chat_id: MY_ADMIN_ID, 
                text: `📑 **Заявка #${l.id}**\n🏠 Объект: ${l.apartment_id}\n👤 Клиент: ${clientDisplay}`,
                reply_markup: { inline_keyboard: [[{ text: "✅ Подтвердить", callback_data: `preconf_${l.id}` }, { text: "❌ Отказать", callback_data: `predecl_${l.id}` }]] },
                parse_mode: "Markdown"
              })
            });
          }
        }
        return responseOk;
      }

      if (chatId !== MY_ADMIN_ID) {
        if (text.startsWith('/start')) {
          await supabase.from('users').upsert({ 
            telegram_id: chatId, 
            username: body.message.from?.username || "anonymous", 
            referrer: text.split(' ')[1] || 'direct', 
            status: 'active' 
          }, { onConflict: 'telegram_id' });
        }
        
        const isSub = await checkSub(chatId);
        if (!isSub) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId, 
              text: `🛎 **Добро пожаловать! / Welcome!**\n\n🌐 Чтобы пользоваться каталогом, пожалуйста, подпишитесь на наш канал.\n\n🌐 To use the catalog, please subscribe to our channel.`,
              reply_markup: { 
                inline_keyboard: [
                  [{ text: "📢 Subscribe / Подписаться", url: "https://t.me/dragonindanang" }], 
                  [{ text: "🔄 I subscribed / Я подписался", callback_data: "check_sub" }]
                ] 
              }
            })
          });
          return responseOk;
        }
        await sendWelcome(chatId);
      }
    }

    return responseOk;
  } catch (error: any) {
    console.error("Webhook Error:", error);
    return responseOk;
  }
}
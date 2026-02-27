export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Хранилище для предотвращения дублей (в рамках жизни лямбды)
const processedRequests = new Set();

export async function POST(req: Request) {
  // Сразу готовим ответ OK
  const responseOk = NextResponse.json({ ok: true });

  try {
    const body = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const SITE_URL = "https://dragonapart.vercel.app";
    const MY_ADMIN_ID = 1920798985;
    const CHANNEL_ID = "@dragonindanang";

    // Защита от дублей по update_id
    const updateId = body.update_id;
    if (updateId && processedRequests.has(updateId)) return responseOk;
    processedRequests.add(updateId);
    // Очистка памяти через 10 секунд
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
      const welcomeText = `✨ **Устали от бесконечных поисков жилья?**\nDragonApart — это актуальный каталог проверенных объектов. Мы обновляем базу ежедневно, чтобы вы видели только реальные предложения.\n\n🏠 **Tired of apartment hunting?**\nDragonApart is a catalog of verified listings. We update daily to ensure you see only available units.\n\n👨‍💻 **Support:** @dragonservicesupport`;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId, text: welcomeText, parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🐉 Catalog / Открыть каталог", web_app: { url: `${SITE_URL}?user_id=${chatId}` } }], [{ text: "💬 Manager / Поддержка", url: "https://t.me/dragonservicesupport" }]] }
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
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: body.callback_query.id, text: "❌ Подписка не найдена. Пожалуйста, подпишитесь на канал.", show_alert: true }) });
        }
        return responseOk;
      }

      if (data.startsWith('preconf_')) {
        const id = data.split('_')[1];
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: MY_ADMIN_ID, message_id: msgId, text: `✅ **Варианты подтверждения:**`,
            reply_markup: { inline_keyboard: [[{ text: "💎 Всё ок (Локация)", callback_data: `conf_full_${id}` }], [{ text: "⏰ Другое время", callback_data: `conf_time_${id}` }]] }
          })
        });
      }

      if (data.startsWith('predecl_')) {
        const id = data.split('_')[1];
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: MY_ADMIN_ID, message_id: msgId, text: `❌ **Причина отказа:**`,
            reply_markup: { inline_keyboard: [[{ text: "🏠 Сдана", callback_data: `decl_rented_${id}` }], [{ text: "⏳ Срок", callback_data: `decl_term_${id}` }], [{ text: "🐾 Животные", callback_data: `decl_pets_${id}` }]] }
          })
        });
      }

      if (data.startsWith('conf_') || data.startsWith('decl_')) {
        const [type, reason, id] = data.split('_');
        const { data: lead } = await supabase.from('leads').select('telegram_id').eq('id', id).single();
        
        let clientMsg = "";
        let kb = [];

        if (type === 'conf') {
          clientMsg = reason === 'full' 
            ? `✅ **Заявка подтверждена!**\nСобственник готов к показу. Пожалуйста, напишите нашему менеджеру для получения точной геолокации и уточнения деталей встречи.`
            : `✅ **Квартира свободна!**\nСобственник подтвердил объект, но просит согласовать другое время просмотра. Напишите менеджеру для выбора удобного слота.`;
          kb = [[{ text: "💬 Написать менеджеру", url: "https://t.me/dragonservicesupport" }]];
          // Обновляем статус в базе
          await supabase.from('leads').update({ status: 'confirmed' }).eq('id', id);
        } else {
          if (reason === 'rented') clientMsg = `❌ **Квартира уже сдана**\nК сожалению, этот объект только что забронировали. Мы уже удалили его из каталога. Пожалуйста, посмотрите другие доступные варианты.`;
          if (reason === 'term') clientMsg = `❌ **Ограничение по срокам**\nК сожалению, собственник рассматривает жильцов только на длительный период. Посмотрите похожие варианты в нашем каталоге.`;
          if (reason === 'pets') clientMsg = `❌ **Размещение с животными**\nК сожалению, в данной квартире собственник категорически против проживания с домашними питомцами.`;
          kb = [[{ text: "🐉 Открыть каталог", web_app: { url: `${SITE_URL}?user_id=${lead?.telegram_id}` } }]];
          
          // УДАЛЯЕМ строку из таблицы leads, чтобы не засорять базу
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
          body: JSON.stringify({ chat_id: MY_ADMIN_ID, message_id: msgId, text: `🏁 Результат: ${type === 'conf' ? 'Подтверждено' : 'Удалено (Отказ)'} (${reason})` })
        });
      }
      return responseOk;
    }

    // --- MESSAGES ---
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text || "";

      if (text === '/admin' && chatId === MY_ADMIN_ID) {
        const { data: leads } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(5);
        if (!leads?.length) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: MY_ADMIN_ID, text: "📭 Активных заявок пока нет." }) });
        } else {
          for (const l of leads) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                chat_id: MY_ADMIN_ID, 
                text: `📑 **Заявка #${l.id}**\n🏠 Объект: ${l.apartment_id}\n👤 Клиент: ${l.telegram_id}`,
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
          await supabase.from('users').upsert({ telegram_id: chatId, username: body.message.from?.username || "anonymous", referrer: text.split(' ')[1] || 'direct', status: 'active' }, { onConflict: 'telegram_id' });
        }
        const isSub = await checkSub(chatId);
        if (!isSub) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId, 
              text: `🛎 **Добро пожаловать!**\n\nЧтобы пользоваться каталогом и не потерять связь с нами при обновлении системы, пожалуйста, подпишитесь на наш канал.`,
              reply_markup: { inline_keyboard: [[{ text: "📢 Подписаться на канал", url: "https://t.me/dragonindanang" }], [{ text: "🔄 Я подписался", callback_data: "check_sub" }]] }
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
"""Bot handlers for commands, callbacks and conversations."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from telegram import Update
from telegram.ext import (
    CallbackContext,
    CallbackQueryHandler,
    CommandHandler,
    ConversationHandler,
    MessageHandler,
    filters,
)

from database import Database
from keyboards import (
    date_picker_keyboard,
    main_menu_keyboard,
    pagination_keyboard,
    repeat_type_keyboard,
    repeating_keyboard,
    task_actions_keyboard,
)

ADD_TEXT, ADD_DATE, ADD_TIME, ADD_REPEAT, EDIT_TIME = range(5)


def _db(context: CallbackContext) -> Database:
    return context.application.bot_data["db"]


async def start(update: Update, context: CallbackContext) -> None:
    user = update.effective_user
    _db(context).ensure_user(user.id)
    await update.message.reply_text(
        "Привет! Я твой бот-ежедневник. Выбери действие:",
        reply_markup=main_menu_keyboard(),
    )


async def menu_router(update: Update, context: CallbackContext) -> int | None:
    query = update.callback_query
    await query.answer()

    if query.data == "noop":
        return None
    if query.data == "menu_today":
        return await show_today(update, context)
    if query.data == "menu_add":
        await query.message.reply_text("Шаг 1/4. Напиши текст задачи:")
        return ADD_TEXT
    if query.data == "menu_all":
        return await show_all(update, context, page=1)
    if query.data == "menu_repeating":
        await query.message.reply_text("Выбери тип повторяющихся задач:", reply_markup=repeating_keyboard())
        return None
    if query.data == "menu_stats":
        return await show_stats(update, context)
    if query.data == "menu_settings":
        await query.message.reply_text("⚙ Настройки: скоро будет больше опций.")
        return None

    if query.data in {"repeating_daily", "repeating_weekly"}:
        kind = "daily" if query.data.endswith("daily") else "weekly"
        tasks = _db(context).list_repeating_tasks(query.from_user.id, kind)
        if not tasks:
            await query.message.reply_text("Нет повторяющихся задач.")
            return None
        lines = [f"🔁 {('Ежедневные' if kind == 'daily' else 'Еженедельные')} задачи:"]
        for t in tasks:
            lines.append(f"• #{t['id']} {t['date']} {t['time']} — {t['text']}")
        await query.message.reply_text("\n".join(lines))
        return None

    if query.data.startswith("all_page:"):
        page = int(query.data.split(":", 1)[1])
        return await show_all(update, context, page=page)

    if query.data.startswith("task_done:"):
        task_id = int(query.data.split(":", 1)[1])
        _db(context).mark_done(task_id, query.from_user.id)
        await query.message.reply_text("✅ Задача отмечена выполненной.")
        return None

    if query.data.startswith("task_delete:"):
        task_id = int(query.data.split(":", 1)[1])
        _db(context).delete_task(task_id, query.from_user.id)
        await query.message.reply_text("🗑 Задача удалена.")
        return None

    if query.data.startswith("task_snooze:"):
        task_id = int(query.data.split(":", 1)[1])
        _db(context).postpone_task(task_id, query.from_user.id, minutes=10)
        await query.message.reply_text("⏳ Задача отложена на 10 минут.")
        return None

    if query.data.startswith("task_edit_time:"):
        task_id = int(query.data.split(":", 1)[1])
        context.user_data["editing_task_id"] = task_id
        await query.message.reply_text("Введи новое время в формате HH:MM")
        return EDIT_TIME

    if query.data in {"date_today", "date_tomorrow", "date_week"}:
        base = date.today()
        if query.data == "date_tomorrow":
            base += timedelta(days=1)
        elif query.data == "date_week":
            base += timedelta(days=7)
        context.user_data["new_task_date"] = base.isoformat()
        await query.message.reply_text("Шаг 3/4. Введи время в формате HH:MM")
        return ADD_TIME

    if query.data.startswith("repeat_"):
        repeat_map = {
            "repeat_once": "once",
            "repeat_daily": "daily",
            "repeat_weekly": "weekly",
        }
        repeat_type = repeat_map[query.data]
        context.user_data["new_task_repeat"] = repeat_type
        db = _db(context)
        task_id = db.add_task(
            telegram_id=query.from_user.id,
            text=context.user_data["new_task_text"],
            due_date=context.user_data["new_task_date"],
            due_time=context.user_data["new_task_time"],
            repeat_type=repeat_type,
        )
        await query.message.reply_text(f"✅ Задача #{task_id} сохранена.", reply_markup=main_menu_keyboard())
        context.user_data.pop("new_task_text", None)
        context.user_data.pop("new_task_date", None)
        context.user_data.pop("new_task_time", None)
        context.user_data.pop("new_task_repeat", None)
        return ConversationHandler.END

    return None


async def add_task_text(update: Update, context: CallbackContext) -> int:
    context.user_data["new_task_text"] = update.message.text.strip()
    await update.message.reply_text("Шаг 2/4. Выбери дату:", reply_markup=date_picker_keyboard())
    return ADD_DATE


async def add_task_time(update: Update, context: CallbackContext) -> int:
    raw = update.message.text.strip()
    try:
        datetime.strptime(raw, "%H:%M")
    except ValueError:
        await update.message.reply_text("❌ Неверный формат времени. Используй HH:MM")
        return ADD_TIME

    context.user_data["new_task_time"] = raw
    await update.message.reply_text("Шаг 4/4. Выбери тип задачи:", reply_markup=repeat_type_keyboard())
    return ADD_REPEAT


async def edit_task_time(update: Update, context: CallbackContext) -> int:
    raw = update.message.text.strip()
    try:
        datetime.strptime(raw, "%H:%M")
    except ValueError:
        await update.message.reply_text("❌ Неверный формат времени. Используй HH:MM")
        return EDIT_TIME

    task_id = context.user_data.get("editing_task_id")
    if task_id is None:
        await update.message.reply_text("Не удалось определить задачу.")
        return ConversationHandler.END

    ok = _db(context).update_task_time(task_id, update.effective_user.id, raw)
    if ok:
        await update.message.reply_text("⏰ Время задачи обновлено.")
    else:
        await update.message.reply_text("Не удалось обновить задачу.")
    context.user_data.pop("editing_task_id", None)
    return ConversationHandler.END


async def show_today(update: Update, context: CallbackContext) -> int | None:
    query = update.callback_query
    user_id = query.from_user.id
    tasks = _db(context).list_tasks_for_day(user_id, date.today())

    if not tasks:
        await query.message.reply_text("Сегодня задач нет.")
        return None

    now = datetime.now().time()
    await query.message.reply_text("📅 Задачи на сегодня:")
    for task in tasks:
        task_time = datetime.strptime(task["time"], "%H:%M").time()
        if task["status"] == "done":
            emoji = "🟢"
        elif task_time < now:
            emoji = "🔴"
        else:
            emoji = "🟡"

        await query.message.reply_text(
            f"{emoji} #{task['id']} {task['time']} — {task['text']}",
            reply_markup=task_actions_keyboard(int(task["id"])),
        )
    return None


async def show_all(update: Update, context: CallbackContext, page: int = 1) -> int | None:
    query = update.callback_query
    tasks, pages = _db(context).list_tasks_paginated(query.from_user.id, page)
    if not tasks:
        await query.message.reply_text("Список задач пуст.")
        return None

    lines = ["📋 Все задачи:"]
    for task in tasks:
        lines.append(
            f"• #{task['id']} [{task['status']}] {task['date']} {task['time']} ({task['repeat_type']}) — {task['text']}"
        )

    await query.message.reply_text("\n".join(lines), reply_markup=pagination_keyboard(page, pages))
    return None


async def show_stats(update: Update, context: CallbackContext) -> int | None:
    query = update.callback_query
    s = _db(context).stats(query.from_user.id)
    await query.message.reply_text(
        "\n".join(
            [
                f"📊 Выполнено сегодня: {s['today_done']}",
                f"📊 Выполнено за неделю: {s['week_done']}",
                f"📊 Streak: {s['streak']} дн.",
            ]
        )
    )
    return None


async def cancel(update: Update, _context: CallbackContext) -> int:
    await update.message.reply_text("Действие отменено.")
    return ConversationHandler.END


def build_handlers():
    add_flow = ConversationHandler(
        entry_points=[CallbackQueryHandler(menu_router, pattern="^menu_add$")],
        states={
            ADD_TEXT: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_task_text)],
            ADD_DATE: [CallbackQueryHandler(menu_router, pattern="^(date_today|date_tomorrow|date_week)$")],
            ADD_TIME: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_task_time)],
            ADD_REPEAT: [CallbackQueryHandler(menu_router, pattern="^repeat_(once|daily|weekly)$")],
            EDIT_TIME: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_task_time)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        allow_reentry=True,
    )

    return [
        CommandHandler("start", start),
        add_flow,
        CallbackQueryHandler(menu_router),
    ]

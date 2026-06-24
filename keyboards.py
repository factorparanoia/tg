"""Inline keyboards for bot GUI."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def main_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("📅 Сегодня", callback_data="menu_today")],
            [InlineKeyboardButton("➕ Добавить задачу", callback_data="menu_add")],
            [InlineKeyboardButton("📋 Все задачи", callback_data="menu_all")],
            [InlineKeyboardButton("🔁 Повторяющиеся", callback_data="menu_repeating")],
            [InlineKeyboardButton("📊 Статистика", callback_data="menu_stats")],
            [InlineKeyboardButton("⚙ Настройки", callback_data="menu_settings")],
        ]
    )


def date_picker_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("Сегодня", callback_data="date_today")],
            [InlineKeyboardButton("Завтра", callback_data="date_tomorrow")],
            [InlineKeyboardButton("Через 7 дней", callback_data="date_week")],
        ]
    )


def repeat_type_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("Одноразовая", callback_data="repeat_once")],
            [InlineKeyboardButton("Ежедневная", callback_data="repeat_daily")],
            [InlineKeyboardButton("Еженедельная", callback_data="repeat_weekly")],
        ]
    )


def reminder_actions_keyboard(task_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("✅ Выполнено", callback_data=f"task_done:{task_id}")],
            [InlineKeyboardButton("⏳ Отложить 10 мин", callback_data=f"task_snooze:{task_id}")],
            [InlineKeyboardButton("❌ Удалить", callback_data=f"task_delete:{task_id}")],
        ]
    )


def task_actions_keyboard(task_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("✅ выполнить", callback_data=f"task_done:{task_id}")],
            [InlineKeyboardButton("🗑 удалить", callback_data=f"task_delete:{task_id}")],
            [InlineKeyboardButton("⏰ изменить время", callback_data=f"task_edit_time:{task_id}")],
        ]
    )


def pagination_keyboard(page: int, pages: int) -> InlineKeyboardMarkup:
    buttons = []
    row = []
    if page > 1:
        row.append(InlineKeyboardButton("⬅️", callback_data=f"all_page:{page - 1}"))
    row.append(InlineKeyboardButton(f"{page}/{pages}", callback_data="noop"))
    if page < pages:
        row.append(InlineKeyboardButton("➡️", callback_data=f"all_page:{page + 1}"))
    buttons.append(row)
    return InlineKeyboardMarkup(buttons)


def repeating_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("Ежедневные", callback_data="repeating_daily")],
            [InlineKeyboardButton("Еженедельные", callback_data="repeating_weekly")],
        ]
    )

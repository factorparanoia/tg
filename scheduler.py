"""Scheduler helpers based on PTB JobQueue."""

from __future__ import annotations

from datetime import datetime

from telegram.error import TelegramError
from telegram.ext import ContextTypes

from database import Database
from keyboards import reminder_actions_keyboard


async def process_due_tasks(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Periodic job: sends reminders for due tasks and rolls repeaters."""
    db: Database = context.application.bot_data["db"]
    now = datetime.utcnow()

    for task in db.due_tasks(now):
        task_id = int(task["id"])
        chat_id = int(task["telegram_id"])

        try:
            await context.bot.send_message(
                chat_id=chat_id,
                text=f"⏰ Напоминание\nТвоя задача: {task['text']}",
                reply_markup=reminder_actions_keyboard(task_id),
            )
        except TelegramError:
            continue

        if task["repeat_type"] == "once":
            db.delete_task(task_id, chat_id)
        else:
            db.roll_repeating_task(task_id, task["repeat_type"])


def setup_scheduler(application) -> None:
    """Registers repeating checks for due tasks."""
    application.job_queue.run_repeating(process_due_tasks, interval=30, first=5, name="due_tasks")

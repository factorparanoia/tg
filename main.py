"""Entry point for Telegram diary bot."""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from telegram.ext import Application

from database import Database
from handlers import build_handlers
from scheduler import setup_scheduler


logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def main() -> None:
    """Create app, init DB/scheduler and run polling."""
    load_dotenv()
    token = os.getenv("BOT_TOKEN")
    if not token:
        raise RuntimeError("BOT_TOKEN is not set in environment")

    db = Database()
    application = Application.builder().token(token).build()
    application.bot_data["db"] = db

    for handler in build_handlers():
        application.add_handler(handler)

    setup_scheduler(application)

    logger.info("Bot started in polling mode")
    application.run_polling(allowed_updates=None)


if __name__ == "__main__":
    main()

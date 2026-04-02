"""SQLite data layer for diary Telegram bot."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

DB_PATH = Path("diary_bot.db")


class Database:
    """Simple SQLite wrapper with helper methods for bot operations."""

    def __init__(self, db_path: Path | str = DB_PATH) -> None:
        self.db_path = str(db_path)
        self._init_db()

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except sqlite3.Error:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER UNIQUE NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    date TEXT NOT NULL,
                    time TEXT NOT NULL,
                    repeat_type TEXT NOT NULL CHECK(repeat_type IN ('once', 'daily', 'weekly')),
                    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'done', 'deleted')),
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );
                """
            )

    def ensure_user(self, telegram_id: int) -> int:
        with self._connect() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO users (telegram_id) VALUES (?)",
                (telegram_id,),
            )
            row = conn.execute(
                "SELECT id FROM users WHERE telegram_id = ?",
                (telegram_id,),
            ).fetchone()
            if row is None:
                raise RuntimeError("Cannot create/find user")
            return int(row["id"])

    def add_task(
        self,
        telegram_id: int,
        text: str,
        due_date: str,
        due_time: str,
        repeat_type: str,
    ) -> int:
        user_id = self.ensure_user(telegram_id)
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO tasks (user_id, text, date, time, repeat_type)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, text, due_date, due_time, repeat_type),
            )
            return int(cur.lastrowid)

    def get_task(self, task_id: int, telegram_id: int) -> sqlite3.Row | None:
        with self._connect() as conn:
            return conn.execute(
                """
                SELECT t.*
                FROM tasks t
                JOIN users u ON t.user_id = u.id
                WHERE t.id = ? AND u.telegram_id = ? AND t.status != 'deleted'
                """,
                (task_id, telegram_id),
            ).fetchone()

    def list_tasks_for_day(self, telegram_id: int, day: date) -> list[sqlite3.Row]:
        with self._connect() as conn:
            return conn.execute(
                """
                SELECT t.*
                FROM tasks t
                JOIN users u ON t.user_id = u.id
                WHERE u.telegram_id = ?
                  AND t.status != 'deleted'
                  AND t.date = ?
                ORDER BY t.time ASC
                """,
                (telegram_id, day.isoformat()),
            ).fetchall()

    def list_tasks_paginated(self, telegram_id: int, page: int = 1, page_size: int = 10) -> tuple[list[sqlite3.Row], int]:
        offset = (page - 1) * page_size
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT t.*
                FROM tasks t
                JOIN users u ON t.user_id = u.id
                WHERE u.telegram_id = ? AND t.status != 'deleted'
                ORDER BY t.date DESC, t.time DESC
                LIMIT ? OFFSET ?
                """,
                (telegram_id, page_size, offset),
            ).fetchall()
            total = conn.execute(
                """
                SELECT COUNT(*) as c
                FROM tasks t
                JOIN users u ON t.user_id = u.id
                WHERE u.telegram_id = ? AND t.status != 'deleted'
                """,
                (telegram_id,),
            ).fetchone()["c"]
        pages = max(1, (int(total) + page_size - 1) // page_size)
        return rows, pages

    def list_repeating_tasks(self, telegram_id: int, repeat_type: str) -> list[sqlite3.Row]:
        with self._connect() as conn:
            return conn.execute(
                """
                SELECT t.*
                FROM tasks t
                JOIN users u ON t.user_id = u.id
                WHERE u.telegram_id = ?
                  AND t.status != 'deleted'
                  AND t.repeat_type = ?
                ORDER BY t.date ASC, t.time ASC
                """,
                (telegram_id, repeat_type),
            ).fetchall()

    def mark_done(self, task_id: int, telegram_id: int) -> bool:
        with self._connect() as conn:
            cur = conn.execute(
                """
                UPDATE tasks
                SET status = 'done'
                WHERE id = ? AND user_id = (SELECT id FROM users WHERE telegram_id = ?)
                """,
                (task_id, telegram_id),
            )
            return cur.rowcount > 0

    def delete_task(self, task_id: int, telegram_id: int) -> bool:
        with self._connect() as conn:
            cur = conn.execute(
                """
                UPDATE tasks
                SET status = 'deleted'
                WHERE id = ? AND user_id = (SELECT id FROM users WHERE telegram_id = ?)
                """,
                (task_id, telegram_id),
            )
            return cur.rowcount > 0

    def postpone_task(self, task_id: int, telegram_id: int, minutes: int = 10) -> bool:
        task = self.get_task(task_id, telegram_id)
        if task is None:
            return False

        dt = datetime.fromisoformat(f"{task['date']} {task['time']}") + timedelta(minutes=minutes)
        with self._connect() as conn:
            cur = conn.execute(
                "UPDATE tasks SET date = ?, time = ? WHERE id = ?",
                (dt.date().isoformat(), dt.strftime("%H:%M"), task_id),
            )
            return cur.rowcount > 0

    def update_task_time(self, task_id: int, telegram_id: int, new_time: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute(
                """
                UPDATE tasks
                SET time = ?
                WHERE id = ? AND user_id = (SELECT id FROM users WHERE telegram_id = ?)
                """,
                (new_time, task_id, telegram_id),
            )
            return cur.rowcount > 0

    def due_tasks(self, now_dt: datetime) -> list[sqlite3.Row]:
        with self._connect() as conn:
            return conn.execute(
                """
                SELECT t.*, u.telegram_id
                FROM tasks t
                JOIN users u ON t.user_id = u.id
                WHERE t.status = 'active'
                  AND datetime(t.date || ' ' || t.time || ':00') <= datetime(?)
                ORDER BY t.date ASC, t.time ASC
                """,
                (now_dt.strftime("%Y-%m-%d %H:%M:%S"),),
            ).fetchall()

    def roll_repeating_task(self, task_id: int, repeat_type: str) -> None:
        if repeat_type not in {"daily", "weekly"}:
            return

        task = self.get_task_any(task_id)
        if task is None:
            return

        base = datetime.fromisoformat(f"{task['date']} {task['time']}")
        delta = timedelta(days=1 if repeat_type == "daily" else 7)
        nxt = base + delta

        with self._connect() as conn:
            conn.execute(
                "UPDATE tasks SET date = ?, time = ?, status = 'active' WHERE id = ?",
                (nxt.date().isoformat(), nxt.strftime("%H:%M"), task_id),
            )

    def get_task_any(self, task_id: int) -> sqlite3.Row | None:
        with self._connect() as conn:
            return conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()

    def stats(self, telegram_id: int) -> dict[str, Any]:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        with self._connect() as conn:
            today_done = conn.execute(
                """
                SELECT COUNT(*) c
                FROM tasks t JOIN users u ON t.user_id = u.id
                WHERE u.telegram_id = ? AND t.status = 'done' AND t.date = ?
                """,
                (telegram_id, today.isoformat()),
            ).fetchone()["c"]
            week_done = conn.execute(
                """
                SELECT COUNT(*) c
                FROM tasks t JOIN users u ON t.user_id = u.id
                WHERE u.telegram_id = ? AND t.status = 'done' AND t.date >= ? AND t.date <= ?
                """,
                (telegram_id, week_start.isoformat(), today.isoformat()),
            ).fetchone()["c"]
            done_days = conn.execute(
                """
                SELECT DISTINCT t.date d
                FROM tasks t JOIN users u ON t.user_id = u.id
                WHERE u.telegram_id = ? AND t.status = 'done'
                ORDER BY t.date DESC
                """,
                (telegram_id,),
            ).fetchall()

        streak = 0
        cursor = today
        done_set = {row["d"] for row in done_days}
        while cursor.isoformat() in done_set:
            streak += 1
            cursor -= timedelta(days=1)

        return {
            "today_done": int(today_done),
            "week_done": int(week_done),
            "streak": streak,
        }

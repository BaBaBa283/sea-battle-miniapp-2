import asyncio
import logging
import os
import threading

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from dotenv import load_dotenv
from flask import Flask

from handlers import router

load_dotenv()
logging.basicConfig(level=logging.INFO)

BOT_TOKEN = os.getenv("BOT_TOKEN")

bot = Bot(
    token=BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML)
)
dp = Dispatcher()
dp.include_router(router)

# ============ FLASK-СЕРВЕР ДЛЯ ПИНГА ============
flask_app = Flask(__name__)

@flask_app.route('/')
def ping():
    """Эндпоинт для проверки, что бот жив"""
    return "Bot is alive! 🤖", 200

@flask_app.route('/ping')
def ping2():
    """Дополнительный эндпоинт для пинга"""
    return "pong", 200

def run_flask():
    """Запуск Flask-сервера в отдельном потоке"""
    port = int(os.environ.get('PORT', 8080))
    flask_app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)

# ============ ОСНОВНАЯ ФУНКЦИЯ ============
async def main():
    # Запускаем Flask в отдельном потоке
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    logging.info("✅ Flask-сервер для пинга запущен на порту 8080")
    
    # Запускаем бота
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    logging.info("✅ Бот запущен!")
    asyncio.run(main())
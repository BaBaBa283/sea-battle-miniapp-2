from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

# ⚠️ ЭТУ ССЫЛКУ МЫ ПОЛУЧИМ ПОСЛЕ ДЕПЛОЯ НА RENDER
# Пока оставь заглушку, потом заменишь!
WEBAPP_URL = "https://sea-battle-miniapp.onrender.com"

# Клавиатура с Mini App
mini_app_keyboard = InlineKeyboardMarkup(
    inline_keyboard=[
        [InlineKeyboardButton(
            text="🎮 Открыть игру",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )],
        [InlineKeyboardButton(text="📖 Правила игры", callback_data="rules")],
    ]
)

# Главное меню (без Mini App)
main_menu = InlineKeyboardMarkup(
    inline_keyboard=[
        [InlineKeyboardButton(text="📖 Правила игры", callback_data="rules")],
        [InlineKeyboardButton(text="⬅️ Назад", callback_data="back_to_menu")],
    ]
)
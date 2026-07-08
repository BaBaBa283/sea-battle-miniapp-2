from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext

from keyboards import main_menu, mini_app_keyboard

router = Router()

@router.message(Command("start"))
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    await message.answer(
        "⚓️ Добро пожаловать в <b>Морской бой</b>!\n\n"
        "Нажмите кнопку ниже, чтобы открыть игру:",
        reply_markup=mini_app_keyboard
    )

@router.callback_query(F.data == "rules")
async def show_rules(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text(
        "📖 <b>Правила игры «Морской бой»</b>\n\n"
        "1. 🎯 Игровое поле — 10×10 клеток.\n"
        "2. 🚢 У каждого игрока по 10 кораблей.\n"
        "3. 🚫 Корабли не могут касаться друг друга.\n"
        "4. 🔫 Нажимайте на клетки поля противника.\n"
        "5. 💥 Попадание даёт дополнительный ход.\n"
        "6. 🏆 Побеждает тот, кто первым потопит все корабли!\n\n"
        "➡️ Откройте игру через кнопку ниже!",
        reply_markup=mini_app_keyboard
    )
    await callback.answer()

@router.callback_query(F.data == "back_to_menu")
async def back_to_menu(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text(
        "⚓️ Главное меню:\n\n"
        "Выберите действие:",
        reply_markup=main_menu
    )
    await callback.answer()

@router.message()
async def echo(message: Message):
    await message.answer(
        "❓ Используйте кнопки меню.",
        reply_markup=main_menu
    )
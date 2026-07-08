from aiogram.fsm.state import State, StatesGroup


class GameStates(StatesGroup):
    playing = State()  # состояние игры
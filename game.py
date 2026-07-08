import random
from typing import List, Tuple, Optional

# Размер поля
BOARD_SIZE = 10

# Корабли: {размер: количество}
SHIPS = {4: 1, 3: 2, 2: 3, 1: 4}


class Ship:
    """Класс корабля"""
    def __init__(self, row: int, col: int, size: int, horizontal: bool):
        self.row = row
        self.col = col
        self.size = size
        self.horizontal = horizontal
        self.hits = [False] * size  # попадания по палубам

    @property
    def is_sunk(self) -> bool:
        """Потоплен ли корабль"""
        return all(self.hits)

    def get_coords(self) -> List[Tuple[int, int]]:
        """Все координаты корабля"""
        coords = []
        for i in range(self.size):
            if self.horizontal:
                coords.append((self.row, self.col + i))
            else:
                coords.append((self.row + i, self.col))
        return coords


class Board:
    """Игровое поле"""
    def __init__(self):
        self.grid = [[' ' for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        self.ships: List[Ship] = []
        self.shots: List[Tuple[int, int]] = []  # куда стреляли
        self.hits: List[Tuple[int, int]] = []   # попадания
    
    def place_ship(self, row: int, col: int, size: int, horizontal: bool) -> bool:
        """Разместить корабль на поле"""
        # Проверяем, что корабль помещается на поле
        if horizontal:
            if col + size > BOARD_SIZE:
                return False
        else:
            if row + size > BOARD_SIZE:
                return False
        
        # Проверяем, что клетки свободны
        for i in range(size):
            r = row if horizontal else row + i
            c = col + i if horizontal else col
            if self.grid[r][c] != ' ':
                return False
        
        # Проверяем соседние клетки (корабли не должны касаться)
        for i in range(-1, size + 1):
            for j in range(-1, 2):
                r = row + i if horizontal else row + j
                c = col + i if horizontal else col + j
                if 0 <= r < BOARD_SIZE and 0 <= c < BOARD_SIZE:
                    if self.grid[r][c] != ' ':
                        return False
        
        # Размещаем корабль
        ship = Ship(row, col, size, horizontal)
        self.ships.append(ship)
        for r, c in ship.get_coords():
            self.grid[r][c] = '■'  # часть корабля
        
        return True
    
    def place_ships_random(self):
        """Расставить все корабли случайно"""
        for size, count in SHIPS.items():
            for _ in range(count):
                placed = False
                attempts = 0
                while not placed and attempts < 1000:
                    row = random.randint(0, BOARD_SIZE - 1)
                    col = random.randint(0, BOARD_SIZE - 1)
                    horizontal = random.choice([True, False])
                    placed = self.place_ship(row, col, size, horizontal)
                    attempts += 1
                if not placed:
                    # Если не получилось, перезапускаем расстановку
                    self.clear()
                    self.place_ships_random()
                    return
    
    def clear(self):
        """Очистить поле"""
        self.grid = [[' ' for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        self.ships = []
        self.shots = []
        self.hits = []
    
    def shoot(self, row: int, col: int) -> Tuple[bool, bool]:
        """
        Сделать выстрел по координатам
        Возвращает: (попал ли, потоплен ли корабль)
        """
        if (row, col) in self.shots:
            return False, False  # уже стреляли сюда
        
        self.shots.append((row, col))
        
        # Проверяем, есть ли корабль в этой клетке
        for ship in self.ships:
            if (row, col) in ship.get_coords():
                # Попадание!
                index = ship.get_coords().index((row, col))
                ship.hits[index] = True
                self.hits.append((row, col))
                self.grid[row][col] = 'X'
                
                # Проверяем, потоплен ли корабль
                if ship.is_sunk:
                    return True, True
                return True, False
        
        # Промах
        self.grid[row][col] = '•'
        return False, False
    
    def get_cell_symbol(self, row: int, col: int, hide_ships: bool = False) -> str:
        """Вернуть символ клетки для отображения"""
        cell = self.grid[row][col]
        
        if hide_ships and cell == '■':
            return ' '  # скрываем корабли
        return cell
    
    def display(self, hide_ships: bool = False) -> str:
        """Отобразить поле в виде текста"""
        letters = 'ABCDEFGHIJ'
        result = "   1 2 3 4 5 6 7 8 9 10\n"
        result += "   ---------------------\n"
        
        for i in range(BOARD_SIZE):
            result += f"{letters[i]} |"
            for j in range(BOARD_SIZE):
                symbol = self.get_cell_symbol(i, j, hide_ships)
                result += f"{symbol} "
            result += "|\n"
        
        result += "   ---------------------"
        return result
    
    @property
    def ships_alive(self) -> int:
        """Количество живых кораблей"""
        return sum(1 for ship in self.ships if not ship.is_sunk)
    
    @property
    def all_ships_sunk(self) -> bool:
        """Все ли корабли потоплены"""
        return self.ships_alive == 0


class SeaBattleGame:
    """Основной класс игры"""
    def __init__(self):
        self.player_board = Board()
        self.computer_board = Board()
        self.current_turn = 'player'  # 'player' или 'computer'
        self.game_over = False
        self.winner = None
    
    def setup(self):
        """Подготовка к игре"""
        self.player_board.clear()
        self.computer_board.clear()
        
        # Расставляем корабли компьютера
        self.computer_board.place_ships_random()
        
        # Для игрока пока просто ставим корабли (позже сделаем интерактивную расстановку)
        self.player_board.place_ships_random()
        
        self.current_turn = 'player'
        self.game_over = False
        self.winner = None
    
    def player_shoot(self, row: int, col: int) -> Tuple[bool, bool, bool]:
        """
        Ход игрока
        Возвращает: (попал, потопил, игра_закончена)
        """
        if self.game_over or self.current_turn != 'player':
            return False, False, False
        
        hit, sunk = self.computer_board.shoot(row, col)
        
        # Проверяем, выиграл ли игрок
        if self.computer_board.all_ships_sunk:
            self.game_over = True
            self.winner = 'player'
            return hit, sunk, True
        
        # Если не попал, ход переходит к компьютеру
        if not hit:
            self.current_turn = 'computer'
        # Если попал, игрок ходит ещё раз
        
        return hit, sunk, False
    
    def computer_shoot(self) -> Tuple[int, int, bool, bool, bool]:
        """
        Ход компьютера
        Возвращает: (row, col, попал, потопил, игра_закончена)
        """
        if self.game_over or self.current_turn != 'computer':
            return -1, -1, False, False, False
        
        # Компьютер стреляет случайно по неизбитым клеткам
        available = []
        for i in range(BOARD_SIZE):
            for j in range(BOARD_SIZE):
                if (i, j) not in self.player_board.shots:
                    available.append((i, j))
        
        if not available:
            self.game_over = True
            self.winner = 'computer'
            return -1, -1, False, False, True
        
        row, col = random.choice(available)
        hit, sunk = self.player_board.shoot(row, col)
        
        # Проверяем, выиграл ли компьютер
        if self.player_board.all_ships_sunk:
            self.game_over = True
            self.winner = 'computer'
            return row, col, hit, sunk, True
        
        # Если не попал, ход переходит к игроку
        if not hit:
            self.current_turn = 'player'
        
        return row, col, hit, sunk, False
    
    def get_game_status(self) -> str:
        """Получить статус игры в виде текста"""
        status = f"🎯 <b>Морской бой</b>\n\n"
        
        # Поле игрока
        status += "<b>Ваше поле:</b>\n"
        status += f"<pre>{self.player_board.display(hide_ships=False)}</pre>\n"
        status += f"Кораблей: {self.player_board.ships_alive}\n\n"
        
        # Поле компьютера (скрываем корабли)
        status += "<b>Поле противника:</b>\n"
        status += f"<pre>{self.computer_board.display(hide_ships=True)}</pre>\n"
        status += f"Кораблей: {self.computer_board.ships_alive}\n\n"
        
        if self.game_over:
            if self.winner == 'player':
                status += "🎉 <b>ПОБЕДА!</b> Вы потопили все корабли противника!"
            else:
                status += "💀 <b>ПОРАЖЕНИЕ!</b> Компьютер потопил ваши корабли..."
        else:
            if self.current_turn == 'player':
                status += "🔫 <b>Ваш ход!</b> Выберите клетку для выстрела.\n"
                status += "Отправьте координаты (например: А1, J10)"
            else:
                status += "💻 <b>Ход компьютера...</b>"
        
        return status
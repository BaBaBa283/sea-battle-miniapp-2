// ============ КОНСТАНТЫ ============
const BOARD_SIZE = 10;
const LETTERS = 'ABCDEFGHIJ';
const SHIP_SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

// ============ ИНИЦИАЛИЗАЦИЯ TELEGRAM ============
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// ============ СОСТОЯНИЕ ИГРЫ ============
let game = {
    playerBoard: [],
    computerBoard: [],
    playerShips: [],
    computerShips: [],
    currentTurn: 'player',
    gameOver: false
};

// ============ ФУНКЦИИ ИГРЫ ============

// Создание пустого поля
function createEmptyBoard() {
    return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
}

// Получение координат корабля
function getShipCoords(ship) {
    const coords = [];
    const { row, col, size, horizontal } = ship;
    for (let i = 0; i < size; i++) {
        if (horizontal) {
            coords.push([row, col + i]);
        } else {
            coords.push([row + i, col]);
        }
    }
    return coords;
}

// Проверка возможности размещения корабля
function canPlaceShip(board, row, col, size, horizontal) {
    if (horizontal && col + size > BOARD_SIZE) return false;
    if (!horizontal && row + size > BOARD_SIZE) return false;
    
    for (let i = 0; i < size; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        if (board[r][c] !== 0) return false;
        
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                    if (board[nr][nc] !== 0) return false;
                }
            }
        }
    }
    return true;
}

// Размещение корабля на поле
function placeShip(board, row, col, size, horizontal) {
    for (let i = 0; i < size; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        board[r][c] = 1;
    }
}

// Расстановка кораблей (рандомная)
function placeShipsRandom() {
    const board = createEmptyBoard();
    const ships = [];
    
    for (const size of SHIP_SIZES) {
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < 2000) {
            const row = Math.floor(Math.random() * BOARD_SIZE);
            const col = Math.floor(Math.random() * BOARD_SIZE);
            const horizontal = Math.random() > 0.5;
            
            if (canPlaceShip(board, row, col, size, horizontal)) {
                placeShip(board, row, col, size, horizontal);
                ships.push({ row, col, size, horizontal, hits: [] });
                placed = true;
            }
            attempts++;
        }
        
        if (!placed) {
            return placeShipsRandom();
        }
    }
    
    return { board, ships };
}

// Проверка победы
function checkWin(board, ships) {
    for (const ship of ships) {
        if (ship.hits.length < ship.size) {
            return false;
        }
    }
    return true;
}

// ============ ЗАКРАШИВАНИЕ КЛЕТОК ВОКРУГ ПОТОПЛЕННОГО КОРАБЛЯ ============

function markSurroundingCells(row, col, ship, board) {
    const coords = getShipCoords(ship);
    const markedCells = new Set();
    
    // Проходим по всем клеткам вокруг корабля
    for (const [r, c] of coords) {
        // Проверяем все 8 соседних клеток
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                
                // Проверяем, что клетка в пределах поля
                if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                    const key = `${nr},${nc}`;
                    if (!markedCells.has(key)) {
                        const value = board[nr][nc];
                        // Если клетка пустая или корабль (но не потоплена) - помечаем как промах
                        if (value === 0 || value === 1 || value === 'ship') {
                            board[nr][nc] = 'miss-around-sunk';
                            markedCells.add(key);
                        }
                    }
                }
            }
        }
    }
}

// Проверка, находится ли клетка вокруг потопленного корабля
function isCellAroundSunk(row, col, sunkShips) {
    for (const ship of sunkShips) {
        const coords = getShipCoords(ship);
        for (const [r, c] of coords) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr === row && nc === col) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

// ============ ЛОГИКА ВЫСТРЕЛА ============

function shoot(row, col, board, ships) {
    let hit = false;
    let sunk = false;
    let shipIndex = -1;
    
    for (let s = 0; s < ships.length; s++) {
        const ship = ships[s];
        const coords = getShipCoords(ship);
        const index = coords.findIndex(([r, c]) => r === row && c === col);
        
        if (index !== -1) {
            hit = true;
            ship.hits.push(index);
            board[row][col] = 'hit';
            
            if (ship.hits.length === ship.size) {
                sunk = true;
                // Помечаем все палубы как потопленные
                for (const [r, c] of coords) {
                    board[r][c] = 'sunk';
                }
                // Закрашиваем клетки вокруг корабля
                markSurroundingCells(row, col, ship, board);
            }
            shipIndex = s;
            break;
        }
    }
    
    if (!hit) {
        board[row][col] = 'miss';
    }
    
    const win = checkWin(board, ships);
    return { hit, sunk, win, shipIndex };
}

// ============ ОТРИСОВКА ПОЛЯ ============

function createGrid(boardElement, board, ships, isPlayerBoard, canClick = false) {
    boardElement.innerHTML = '';
    boardElement.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;
    
    // Собираем все потопленные корабли
    const sunkShips = ships.filter(ship => ship.hits.length === ship.size);
    
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = i;
            cell.dataset.col = j;
            
            const value = board[i][j];
            
            // Определяем состояние клетки
            if (value === 1 || value === 'ship') {
                if (isPlayerBoard) {
                    cell.classList.add('ship');
                }
            }
            
            if (value === 'hit') {
                cell.classList.add('hit');
            } else if (value === 'miss') {
                cell.classList.add('miss');
            } else if (value === 'sunk') {
                cell.classList.add('sunk');
            } else if (value === 'miss-around-sunk') {
                cell.classList.add('miss-around-sunk');
            }
            
            // Проверяем, не находится ли клетка вокруг потопленного корабля
            // (для случая, когда клетка была помечена как miss, но должна быть miss-around-sunk)
            if (value === 'miss' && !isPlayerBoard) {
                const isAroundSunk = isCellAroundSunk(i, j, sunkShips);
                if (isAroundSunk) {
                    cell.classList.remove('miss');
                    cell.classList.add('miss-around-sunk');
                }
            }
            
            // Если это поле противника и можно кликать
            if (!isPlayerBoard && canClick && !game.gameOver && game.currentTurn === 'player') {
                if (value !== 'hit' && value !== 'miss' && value !== 'sunk' && value !== 'miss-around-sunk') {
                    cell.style.cursor = 'pointer';
                    cell.addEventListener('click', () => onCellClick(i, j));
                } else {
                    cell.classList.add('disabled');
                }
            } else {
                cell.classList.add('disabled');
            }
            
            boardElement.appendChild(cell);
        }
    }
}

// ============ ОБРАБОТКА КЛИКА ============

function onCellClick(row, col) {
    if (game.gameOver || game.currentTurn !== 'player') return;
    
    const board = game.computerBoard;
    if (board[row][col] === 'hit' || board[row][col] === 'miss' || board[row][col] === 'sunk' || board[row][col] === 'miss-around-sunk') return;
    
    // Выстрел игрока
    const result = shoot(row, col, game.computerBoard, game.computerShips);
    updateBoards();
    
    if (result.win) {
        game.gameOver = true;
        game.currentTurn = 'gameover';
        updateStatus('win');
        return;
    }
    
    if (result.hit) {
        if (result.sunk) {
            updateStatus('player', '💥 Корабль потоплен! Вода вокруг закрашена! 🌊');
        } else {
            updateStatus('player', '💥 Попадание! Ещё ход!');
        }
        return;
    }
    
    // Промах - ход компьютера
    updateStatus('computer', '🌊 Промах! Ход компьютера...');
    game.currentTurn = 'computer';
    updateBoards();
    
    setTimeout(() => computerTurn(), 800);
}

// ============ ХОД КОМПЬЮТЕРА ============

function computerTurn() {
    if (game.gameOver) return;
    
    // Находим доступные клетки
    const available = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            const val = game.playerBoard[i][j];
            if (val !== 'hit' && val !== 'miss' && val !== 'sunk' && val !== 'miss-around-sunk') {
                available.push([i, j]);
            }
        }
    }
    
    if (available.length === 0) {
        game.gameOver = true;
        game.currentTurn = 'gameover';
        updateStatus('lose');
        updateBoards();
        return;
    }
    
    // Выбираем случайную клетку
    const [row, col] = available[Math.floor(Math.random() * available.length)];
    const result = shoot(row, col, game.playerBoard, game.playerShips);
    
    updateBoards();
    
    if (result.win) {
        game.gameOver = true;
        game.currentTurn = 'gameover';
        updateStatus('lose');
        return;
    }
    
    if (result.hit) {
        if (result.sunk) {
            updateStatus('computer', `💥 Компьютер потопил корабль! (${LETTERS[row]}${col+1})`);
        } else {
            updateStatus('computer', `💥 Компьютер попал! (${LETTERS[row]}${col+1})`);
        }
        setTimeout(() => computerTurn(), 600);
    } else {
        updateStatus('player', `🌊 Компьютер промахнулся! (${LETTERS[row]}${col+1})`);
        game.currentTurn = 'player';
        setTimeout(() => {
            updateStatus('player', '🎯 Ваш ход!');
            updateBoards();
        }, 300);
    }
}

// ============ ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ============

function updateStatus(turn, message) {
    const status = document.getElementById('status');
    
    if (turn === 'win') {
        status.textContent = '🎉 ПОБЕДА! Вы потопили все корабли!';
        status.className = 'game-over-win';
        return;
    } else if (turn === 'lose') {
        status.textContent = '💀 ПОРАЖЕНИЕ! Компьютер победил...';
        status.className = 'game-over-lose';
        return;
    }
    
    if (message) {
        status.textContent = message;
    } else if (turn === 'player') {
        status.textContent = '🎯 Ваш ход!';
        status.className = 'player-turn';
    } else if (turn === 'computer') {
        status.textContent = '💻 Ход компьютера...';
        status.className = 'computer-turn';
    }
}

function updateBoards() {
    const playerGrid = document.getElementById('player-grid');
    const computerGrid = document.getElementById('computer-grid');
    
    createGrid(playerGrid, game.playerBoard, game.playerShips, true, false);
    createGrid(computerGrid, game.computerBoard, game.computerShips, false, true);
}

// ============ НОВАЯ ИГРА ============

function newGame() {
    // Игрок
    const player = placeShipsRandom();
    game.playerBoard = player.board;
    game.playerShips = player.ships;
    
    // Компьютер
    const computer = placeShipsRandom();
    game.computerBoard = computer.board;
    game.computerShips = computer.ships;
    
    game.currentTurn = 'player';
    game.gameOver = false;
    
    updateStatus('player', '🎯 Ваш ход!');
    updateBoards();
}

// ============ ЗАКРЫТИЕ ============

function closeApp() {
    tg.close();
}

// ============ ИНИЦИАЛИЗАЦИЯ ============

window.onload = function() {
    newGame();
    document.getElementById('new-game-btn').addEventListener('click', newGame);
    document.getElementById('close-btn').addEventListener('click', closeApp);
};

// Обновляем размер при изменении
tg.onEvent('viewportChanged', function() {
    tg.expand();
});
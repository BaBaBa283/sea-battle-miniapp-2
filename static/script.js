// ============ КОНСТАНТЫ ============
const BOARD_SIZE = 10;
const LETTERS = 'ABCDEFGHIJ';
const SHIP_SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

// ============ ИНИЦИАЛИЗАЦИЯ TELEGRAM ============
const tg = window.Telegram?.WebApp;

function initTelegram() {
    if (!tg) return;

    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();

    // Подгоняем системные цвета шапки/фона под тему приложения,
    // если этот метод поддерживается версией клиента.
    try {
        if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
            tg.setHeaderColor(tg.themeParams.secondary_bg_color ? 'secondary_bg_color' : 'bg_color');
        }
        if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
            tg.setBackgroundColor(tg.themeParams.bg_color || '#efe7d3');
        }
    } catch (e) { /* старый клиент — просто игнорируем */ }

    // Кнопка "назад" системы Telegram дублирует нашу кнопку закрытия
    if (tg.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(closeApp);
    }

    tg.onEvent('viewportChanged', () => tg.expand());
    tg.onEvent('themeChanged', () => { /* CSS-переменные обновятся сами */ });
}

function haptic(type) {
    if (!tg?.HapticFeedback) return;
    try {
        if (type === 'hit') tg.HapticFeedback.notificationOccurred('error');
        else if (type === 'sunk') tg.HapticFeedback.impactOccurred('heavy');
        else if (type === 'miss') tg.HapticFeedback.impactOccurred('light');
        else if (type === 'win') tg.HapticFeedback.notificationOccurred('success');
        else if (type === 'lose') tg.HapticFeedback.notificationOccurred('error');
        else if (type === 'tap') tg.HapticFeedback.selectionChanged();
    } catch (e) { /* noop */ }
}

// ============ СОСТОЯНИЕ ИГРЫ ============
let game = {
    playerBoard: [],
    computerBoard: [],
    playerShips: [],
    computerShips: [],
    currentTurn: 'player',
    gameOver: false,
    // Память ИИ: клетки текущего подбитого (но не потопленного) корабля
    // и очередь клеток-кандидатов "по кресту" вокруг них.
    computerHits: [],
    computerTargetQueue: []
};

// ============ ФУНКЦИИ ИГРЫ ============

function createEmptyBoard() {
    return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
}

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

function placeShip(board, row, col, size, horizontal) {
    for (let i = 0; i < size; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        board[r][c] = 1;
    }
}

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

    for (const [r, c] of coords) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;

                if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                    const key = `${nr},${nc}`;
                    if (!markedCells.has(key)) {
                        const value = board[nr][nc];
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
                for (const [r, c] of coords) {
                    board[r][c] = 'sunk';
                }
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

// ============ ОТРИСОВКА ПОЛЯ (11x11: подписи + сетка) ============

function createGrid(boardElement, board, ships, isPlayerBoard, canClick = false) {
    boardElement.innerHTML = '';

    const sunkShips = ships.filter(ship => ship.hits.length === ship.size);
    const fragment = document.createDocumentFragment();

    // Строка 0: пустой угол + номера столбцов (1..10)
    const corner = document.createElement('div');
    corner.className = 'cell label corner';
    fragment.appendChild(corner);

    for (let c = 0; c < BOARD_SIZE; c++) {
        const colLabel = document.createElement('div');
        colLabel.className = 'cell label col-label';
        colLabel.textContent = c + 1;
        fragment.appendChild(colLabel);
    }

    // Строки 1..10: буква строки + игровые клетки
    for (let i = 0; i < BOARD_SIZE; i++) {
        const rowLabel = document.createElement('div');
        rowLabel.className = 'cell label row-label';
        rowLabel.textContent = LETTERS[i];
        fragment.appendChild(rowLabel);

        for (let j = 0; j < BOARD_SIZE; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell data';
            cell.dataset.row = i;
            cell.dataset.col = j;

            const value = board[i][j];

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

            if (value === 'miss' && !isPlayerBoard) {
                const isAroundSunk = isCellAroundSunk(i, j, sunkShips);
                if (isAroundSunk) {
                    cell.classList.remove('miss');
                    cell.classList.add('miss-around-sunk');
                }
            }

            if (!isPlayerBoard && canClick && !game.gameOver && game.currentTurn === 'player') {
                if (value !== 'hit' && value !== 'miss' && value !== 'sunk' && value !== 'miss-around-sunk') {
                    cell.setAttribute('tabindex', '0');
                    cell.setAttribute('role', 'button');
                    cell.setAttribute('aria-label', `${LETTERS[i]}${j + 1}`);
                    cell.addEventListener('click', () => onCellClick(i, j));
                    cell.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onCellClick(i, j);
                        }
                    });
                } else {
                    cell.classList.add('disabled');
                }
            } else {
                cell.classList.add('disabled');
            }

            fragment.appendChild(cell);
        }
    }

    boardElement.appendChild(fragment);
}

// ============ ОБРАБОТКА КЛИКА ============

function onCellClick(row, col) {
    if (game.gameOver || game.currentTurn !== 'player') return;

    const board = game.computerBoard;
    if (board[row][col] === 'hit' || board[row][col] === 'miss' || board[row][col] === 'sunk' || board[row][col] === 'miss-around-sunk') return;

    haptic('tap');

    const result = shoot(row, col, game.computerBoard, game.computerShips);
    updateBoards();

    if (result.win) {
        game.gameOver = true;
        game.currentTurn = 'gameover';
        haptic('win');
        updateStatus('win');
        return;
    }

    if (result.hit) {
        if (result.sunk) {
            haptic('sunk');
            updateStatus('player', '💥 Корабль потоплен! Вода вокруг закрашена! 🌊');
        } else {
            haptic('hit');
            updateStatus('player', '💥 Попадание! Ещё ход!');
        }
        return;
    }

    haptic('miss');
    updateStatus('computer', '🌊 Промах! Ход компьютера...');
    game.currentTurn = 'computer';
    updateBoards();

    setTimeout(() => computerTurn(), 800);
}

// ============ ИИ: ПОИСК КЛЕТОК "ПО КРЕСТУ" ПОСЛЕ ПОПАДАНИЯ ============

// Перемешивание массива (Fisher-Yates), чтобы порядок соседей был непредсказуем
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function isCellAvailable(board, row, col) {
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return false;
    const value = board[row][col];
    return value !== 'hit' && value !== 'miss' && value !== 'sunk' && value !== 'miss-around-sunk';
}

function getCrossNeighbors(row, col) {
    return [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1]
    ].filter(([r, c]) => isCellAvailable(game.playerBoard, r, c));
}

// После попадания обновляем очередь клеток-кандидатов для добивания корабля
function updateTargetQueueAfterHit() {
    const hits = game.computerHits;

    if (hits.length === 1) {
        // Первое попадание — пробуем все 4 клетки вокруг него
        game.computerTargetQueue = shuffle(getCrossNeighbors(hits[0][0], hits[0][1]));
        return;
    }

    // Есть 2+ попаданий — вычисляем направление корабля и продолжаем именно по нему
    const sameRow = hits.every(([r]) => r === hits[0][0]);
    const sameCol = hits.every(([, c]) => c === hits[0][1]);
    const queue = [];

    if (sameRow) {
        const row = hits[0][0];
        const cols = hits.map(([, c]) => c);
        const minC = Math.min(...cols);
        const maxC = Math.max(...cols);
        [[row, minC - 1], [row, maxC + 1]].forEach(([r, c]) => {
            if (isCellAvailable(game.playerBoard, r, c)) queue.push([r, c]);
        });
    } else if (sameCol) {
        const col = hits[0][1];
        const rows = hits.map(([r]) => r);
        const minR = Math.min(...rows);
        const maxR = Math.max(...rows);
        [[minR - 1, col], [maxR + 1, col]].forEach(([r, c]) => {
            if (isCellAvailable(game.playerBoard, r, c)) queue.push([r, c]);
        });
    } else {
        // На всякий случай (не должно происходить) — просто соседи последнего попадания
        const [r, c] = hits[hits.length - 1];
        queue.push(...getCrossNeighbors(r, c));
    }

    game.computerTargetQueue = queue;
}

// ============ ХОД КОМПЬЮТЕРА ============

function computerTurn() {
    if (game.gameOver) return;

    // Сначала пытаемся добить уже обнаруженный корабль по кресту
    let row, col;
    while (game.computerTargetQueue.length > 0) {
        const [r, c] = game.computerTargetQueue.pop();
        if (isCellAvailable(game.playerBoard, r, c)) {
            row = r;
            col = c;
            break;
        }
    }

    // Если целей на добивание нет — стреляем в случайную доступную клетку
    if (row === undefined) {
        const available = [];
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (isCellAvailable(game.playerBoard, i, j)) {
                    available.push([i, j]);
                }
            }
        }

        if (available.length === 0) {
            game.gameOver = true;
            game.currentTurn = 'gameover';
            haptic('lose');
            updateStatus('lose');
            updateBoards();
            return;
        }

        [row, col] = available[Math.floor(Math.random() * available.length)];
    }

    const result = shoot(row, col, game.playerBoard, game.playerShips);

    updateBoards();

    if (result.win) {
        game.gameOver = true;
        game.currentTurn = 'gameover';
        haptic('lose');
        updateStatus('lose');
        return;
    }

    if (result.hit) {
        if (result.sunk) {
            // Корабль потоплен — сбрасываем память ИИ, добивать больше нечего
            game.computerHits = [];
            game.computerTargetQueue = [];
            haptic('sunk');
            updateStatus('computer', `💥 Компьютер потопил корабль! (${LETTERS[row]}${col + 1})`);
        } else {
            game.computerHits.push([row, col]);
            updateTargetQueueAfterHit();
            haptic('hit');
            updateStatus('computer', `💥 Компьютер попал! (${LETTERS[row]}${col + 1})`);
        }
        setTimeout(() => computerTurn(), 600);
    } else {
        haptic('miss');
        updateStatus('player', `🌊 Компьютер промахнулся! (${LETTERS[row]}${col + 1})`);
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
    haptic('tap');

    const player = placeShipsRandom();
    game.playerBoard = player.board;
    game.playerShips = player.ships;

    const computer = placeShipsRandom();
    game.computerBoard = computer.board;
    game.computerShips = computer.ships;

    game.currentTurn = 'player';
    game.gameOver = false;
    game.computerHits = [];
    game.computerTargetQueue = [];

    updateStatus('player', '🎯 Ваш ход!');
    updateBoards();
}

// ============ ЗАКРЫТИЕ ============

function closeApp() {
    if (tg) {
        tg.close();
    } else {
        window.close();
    }
}

// ============ ИНИЦИАЛИЗАЦИЯ ============

window.onload = function () {
    initTelegram();
    newGame();
    document.getElementById('new-game-btn').addEventListener('click', newGame);
    document.getElementById('close-btn').addEventListener('click', closeApp);
};
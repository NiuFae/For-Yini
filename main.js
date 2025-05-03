const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const messageDiv = document.getElementById('message');
const bgm = document.getElementById('bgm');
const mergeSound = document.getElementById('merge-sound');

const FRUIT_COUNT = 7;
const FRUIT_IMAGES = Array.from({length: FRUIT_COUNT}, (_, i) => `${i+1}.jpg`);
const FRUIT_RADIUS = [36, 44, 54, 66, 80, 96, 120];

const ACTIVE_LEFT = canvas.width * 0.1;
const ACTIVE_RIGHT = canvas.width * 0.9;
const DEAD_LINE = canvas.height / 7;

const MESSAGES = {
    2: '宜言饮酒',
    3: '与子偕老',
    4: '琴瑟在御',
    5: '莫不静好'
};

let fruits = [];
let images = [];
let isDropping = false;
let dropFruit = null;
let dropX = (ACTIVE_LEFT + ACTIVE_RIGHT) / 2;
let gameOver = false;
let win = false;
let colorInterval = null;
let confettiList = [];
let beautifulParticles = [];
let restartReady = false;

let previewType = Math.floor(Math.random() * 2);
let previewX = getRandomPreviewX();
let showRestartTip = false;

// 0=未胜利，1=合成第七张后等待点击，2=美好特效阶段，3=祝福语和礼花阶段，4=重开提示
let winStage = 0;

function getRandomPreviewX() {
    return Math.random() * (ACTIVE_RIGHT - ACTIVE_LEFT - 2 * FRUIT_RADIUS[previewType]) + ACTIVE_LEFT + FRUIT_RADIUS[previewType];
}

function loadImages(callback) {
    let loaded = 0;
    for (let i = 0; i < FRUIT_COUNT; i++) {
        images[i] = new Image();
        images[i].src = FRUIT_IMAGES[i];
        images[i].onload = () => {
            loaded++;
            if (loaded === FRUIT_COUNT) callback();
        };
    }
}

function Fruit(x, y, type, vy = 0) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = FRUIT_RADIUS[type];
    this.vy = vy;
    this.merged = false;
}

function drawFruit(fruit, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(fruit.x, fruit.y, fruit.radius, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(images[fruit.type], fruit.x - fruit.radius, fruit.y - fruit.radius, fruit.radius * 2, fruit.radius * 2);
    ctx.restore();
}

function drawHeart(x, y, size, color = 'red') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + size / 4);
    ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + size / 4);
    ctx.bezierCurveTo(x - size / 2, y + size / 2, x, y + size / 1.2, x, y + size);
    ctx.bezierCurveTo(x, y + size / 1.2, x + size / 2, y + size / 2, x + size / 2, y + size / 4);
    ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + size / 4);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

function drawECGLine() {
    const width = ACTIVE_RIGHT - ACTIVE_LEFT;
    const baseY = DEAD_LINE;
    const points = [];
    const n = 60;
    for (let i = 0; i <= n; i++) {
        let t = i / n;
        let x = ACTIVE_LEFT + t * width;
        let y = baseY;
        if (t > 0.45 && t < 0.55) {
            if (t < 0.48) y -= 10 * (1 - (t - 0.45) / 0.03);
            else if (t < 0.50) y += 20 * ((t - 0.48) / 0.02);
            else if (t < 0.52) y -= 10 * ((t - 0.50) / 0.02);
            else y = baseY;
        } else if (t % 0.2 < 0.05) {
            y -= 5 * Math.sin((t % 0.2) * Math.PI * 10);
        }
        points.push({x, y});
    }
    ctx.save();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let p of points) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
    drawHeart(ACTIVE_LEFT + width / 2, baseY - 25, 24);
}

function drawConfetti() {
    for (let c of confettiList) {
        ctx.save();
        ctx.globalAlpha = c.alpha;
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
        c.y += c.speed;
        c.alpha -= 0.005;
    }
    confettiList = confettiList.filter(c => c.alpha > 0);
}

function drawBeautifulParticles() {
    for (let p of beautifulParticles) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
            ctx.fillStyle = p.color;
            ctx.fill();
        } else if (p.shape === 'star') {
            drawStarSimple(p.x, p.y, p.size, p.color);
        }
        ctx.restore();
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.004;
    }
    beautifulParticles = beautifulParticles.filter(p => p.alpha > 0);
}

function drawStarSimple(cx, cy, r, color) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        ctx.lineTo(
            cx + r * Math.cos((18 + i * 72) * Math.PI / 180),
            cy - r * Math.sin((18 + i * 72) * Math.PI / 180)
        );
        ctx.lineTo(
            cx + r / 2 * Math.cos((54 + i * 72) * Math.PI / 180),
            cy - r / 2 * Math.sin((54 + i * 72) * Math.PI / 180)
        );
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

function launchBeautifulParticles() {
    for (let i = 0; i < 18; i++) {
        let shape = Math.random() > 0.5 ? 'circle' : 'star';
        let color = shape === 'circle'
            ? `hsl(${Math.random() * 360},90%,70%)`
            : `hsl(${Math.random() * 360},90%,85%)`;
        beautifulParticles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 180,
            y: DEAD_LINE + 40 + Math.random() * 100,
            size: shape === 'circle' ? 8 + Math.random() * 10 : 10 + Math.random() * 8,
            color: color,
            shape: shape,
            vx: (Math.random() - 0.5) * 2,
            vy: -1.5 - Math.random() * 1.5,
            alpha: 1
        });
    }
}

function drawPreviewFruit() {
    if (!isDropping && !gameOver && !win && winStage === 0) {
        drawFruit({x: previewX, y: DEAD_LINE - FRUIT_RADIUS[previewType] - 10, type: previewType, radius: FRUIT_RADIUS[previewType]}, 0.5);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawECGLine();
    if (win && winStage === 2) drawBeautifulParticles();
    if (win && winStage === 3) drawConfetti();
    if (!win || winStage === 1 || winStage === 2) {
        for (let fruit of fruits) drawFruit(fruit, 1);
        if (dropFruit) drawFruit(dropFruit, 1);
    }
    drawPreviewFruit();
}

function update() {
    if (gameOver || (win && winStage > 3)) return;
    if (win && winStage === 2) {
        for (let fruit of fruits) {
            fruit.y += fruit.vy;
            fruit.vy += 0.3;
            if (fruit.y + fruit.radius > canvas.height) {
                fruit.y = canvas.height - fruit.radius;
                fruit.vy = 0;
            }
            if (fruit.x - fruit.radius < ACTIVE_LEFT) fruit.x = ACTIVE_LEFT + fruit.radius;
            if (fruit.x + fruit.radius > ACTIVE_RIGHT) fruit.x = ACTIVE_RIGHT - fruit.radius;
        }
        for (let i = 0; i < fruits.length; i++) {
            for (let j = i + 1; j < fruits.length; j++) {
                let a = fruits[i], b = fruits[j];
                let dx = a.x - b.x, dy = a.y - b.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < a.radius + b.radius) {
                    let overlap = a.radius + b.radius - dist;
                    let ox = dx / dist * overlap / 2;
                    let oy = dy / dist * overlap / 2;
                    a.x += ox; a.y += oy;
                    b.x -= ox; b.y -= oy;
                }
            }
        }
        if (Math.random() < 0.18) launchBeautifulParticles();
        for (let p of beautifulParticles) {
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.008;
        }
        beautifulParticles = beautifulParticles.filter(p => p.alpha > 0);
        return;
    }
    for (let fruit of fruits) {
        fruit.y += fruit.vy;
        fruit.vy += 0.3;
        if (fruit.y + fruit.radius > canvas.height) {
            fruit.y = canvas.height - fruit.radius;
            fruit.vy = 0;
        }
        if (fruit.x - fruit.radius < ACTIVE_LEFT) fruit.x = ACTIVE_LEFT + fruit.radius;
        if (fruit.x + fruit.radius > ACTIVE_RIGHT) fruit.x = ACTIVE_RIGHT - fruit.radius;
        if (fruit.y - fruit.radius <= DEAD_LINE) {
            gameOver = true;
            messageDiv.textContent = '游戏失败！请刷新页面重新开始';
            messageDiv.style.opacity = 1;
        }
    }
    for (let i = 0; i < fruits.length; i++) {
        for (let j = i + 1; j < fruits.length; j++) {
            let a = fruits[i], b = fruits[j];
            let dx = a.x - b.x, dy = a.y - b.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < a.radius + b.radius) {
                if (a.type === b.type && !a.merged && !b.merged && a.type < FRUIT_COUNT - 1) {
                    let nx = (a.x + b.x) / 2;
                    let ny = (a.y + b.y) / 2;
                    if (a.type + 1 === FRUIT_COUNT - 1) {
                        fruits.push(new Fruit(nx, ny, a.type + 1));
                        a.merged = b.merged = true;
                        showWin();
                        if (mergeSound) {
                            mergeSound.currentTime = 0;
                            mergeSound.play();
                        }
                    } else {
                        fruits.push(new Fruit(nx, ny, a.type + 1));
                        a.merged = b.merged = true;
                        showMessage(a.type + 1);
                        if (mergeSound) {
                            mergeSound.currentTime = 0;
                            mergeSound.play();
                        }
                    }
                } else {
                    let overlap = a.radius + b.radius - dist;
                    let ox = dx / dist * overlap / 2;
                    let oy = dy / dist * overlap / 2;
                    a.x += ox; a.y += oy;
                    b.x -= ox; b.y -= oy;
                }
            }
        }
    }
    fruits = fruits.filter(f => !f.merged);
}

function showMessage(type) {
    if (MESSAGES[type]) {
        messageDiv.textContent = MESSAGES[type];
        messageDiv.style.opacity = 1;
        messageDiv.style.fontSize = '';
        messageDiv.style.color = '#ff9800';
        messageDiv.style.background = '';
        messageDiv.style.position = '';
        messageDiv.style.top = '';
        messageDiv.style.left = '';
        messageDiv.style.width = '';
        messageDiv.style.padding = '';
        setTimeout(() => {
            messageDiv.style.opacity = 0;
        }, 2000);
    }
}

function showWin() {
    win = true;
    winStage = 1;
    dropFruit = null;
    restartReady = false;
    showRestartTip = false;
}

function showWinBeautiful() {
    winStage = 2;
    beautifulParticles = [];
}

function showWinBlessing() {
    winStage = 3;
    messageDiv.textContent = '祝洪漪妮、曾础铭新婚快乐，永远幸福！';
    messageDiv.style.opacity = 1;
    messageDiv.style.fontSize = '2em';
    messageDiv.style.color = '#e06666';
    messageDiv.style.background = 'rgba(255,255,255,0.9)';
    messageDiv.style.position = 'absolute';
    messageDiv.style.top = '40%';
    messageDiv.style.left = '0';
    messageDiv.style.width = '100%';
    messageDiv.style.padding = '30px 0';
    let colors = ['#e06666', '#ff9800', '#ff4081', '#4caf50', '#2196f3', '#9c27b0'];
    let i = 0;
    colorInterval = setInterval(() => {
        messageDiv.style.color = colors[i % colors.length];
        i++;
    }, 200);
    launchConfetti();
    restartReady = true;
    showRestartTip = false;
}

canvas.addEventListener('mousemove', e => {
    if (!isDropping && !gameOver && !win && winStage === 0) {
        const rect = canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        previewX = Math.max(ACTIVE_LEFT + FRUIT_RADIUS[previewType], Math.min(ACTIVE_RIGHT - FRUIT_RADIUS[previewType], x));
    }
});

canvas.addEventListener('click', e => {
    if (win && winStage === 1) {
        showWinBeautiful();
        return;
    }
    if (win && winStage === 2) {
        showWinBlessing();
        return;
    }
    if (win && winStage === 3 && restartReady && !showRestartTip) {
        clearInterval(colorInterval);
        messageDiv.textContent = '点击屏幕重新开始';
        messageDiv.style.color = '#e06666';
        showRestartTip = true;
        return;
    }
    if (win && winStage === 3 && restartReady && showRestartTip) {
        restartGame();
        return;
    }
    if (!isDropping && !gameOver && !win && winStage === 0) {
        dropFruit = new Fruit(previewX, FRUIT_RADIUS[previewType], previewType, 0);
        isDropping = true;
        previewType = Math.floor(Math.random() * 2);
        previewX = getRandomPreviewX();
    }
});

canvas.addEventListener('touchmove', e => {
    if (!isDropping && !gameOver && !win && winStage === 0) {
        const rect = canvas.getBoundingClientRect();
        let x = e.touches[0].clientX - rect.left;
        previewX = Math.max(ACTIVE_LEFT + FRUIT_RADIUS[previewType], Math.min(ACTIVE_RIGHT - FRUIT_RADIUS[previewType], x));
    }
});
canvas.addEventListener('touchend', e => {
    if (win && winStage === 1) {
        showWinBeautiful();
        return;
    }
    if (win && winStage === 2) {
        showWinBlessing();
        return;
    }
    if (win && winStage === 3 && restartReady && !showRestartTip) {
        clearInterval(colorInterval);
        messageDiv.textContent = '点击屏幕重新开始';
        messageDiv.style.color = '#e06666';
        showRestartTip = true;
        return;
    }
    if (win && winStage === 3 && restartReady && showRestartTip) {
        restartGame();
        return;
    }
    if (!isDropping && !gameOver && !win && winStage === 0) {
        dropFruit = new Fruit(previewX, FRUIT_RADIUS[previewType], previewType, 0);
        isDropping = true;
        previewType = Math.floor(Math.random() * 2);
        previewX = getRandomPreviewX();
    }
});

function restartGame() {
    fruits = [];
    isDropping = false;
    dropFruit = null;
    dropX = (ACTIVE_LEFT + ACTIVE_RIGHT) / 2;
    gameOver = false;
    win = false;
    winStage = 0;
    confettiList = [];
    beautifulParticles = [];
    messageDiv.textContent = '';
    messageDiv.style.opacity = 0;
    messageDiv.style.fontSize = '';
    messageDiv.style.color = '';
    messageDiv.style.background = '';
    messageDiv.style.position = '';
    messageDiv.style.top = '';
    messageDiv.style.left = '';
    messageDiv.style.width = '';
    messageDiv.style.padding = '';
    previewType = Math.floor(Math.random() * 2);
    previewX = getRandomPreviewX();
    showRestartTip = false;
    gameLoop();
}

function gameLoop() {
    if (!gameOver && (!win || winStage < 4)) {
        if (isDropping && dropFruit) {
            dropFruit.y += dropFruit.vy;
            dropFruit.vy += 0.3;
            if (dropFruit.y + dropFruit.radius >= canvas.height) {
                dropFruit.y = canvas.height - dropFruit.radius;
                fruits.push(dropFruit);
                dropFruit = null;
                isDropping = false;
            } else {
                for (let fruit of fruits) {
                    let dx = dropFruit.x - fruit.x;
                    let dy = dropFruit.y - fruit.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < dropFruit.radius + fruit.radius) {
                        dropFruit.y = fruit.y - dropFruit.radius - fruit.radius + 1;
                        fruits.push(dropFruit);
                        dropFruit = null;
                        isDropping = false;
                        break;
                    }
                }
            }
        }
        update();
        draw();
        requestAnimationFrame(gameLoop);
    } else if (win && winStage < 4) {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    } else {
        draw();
        if (win) requestAnimationFrame(gameLoop);
    }
}

loadImages(() => {
    gameLoop();
    if (bgm) bgm.volume = 0.4;
});

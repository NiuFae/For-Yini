const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const messageDiv = document.getElementById('message');
const bgm = document.getElementById('bgm');
const mergeSound = document.getElementById('merge-sound');

const FRUIT_COUNT = 7;
const FRUIT_IMAGES = Array.from({length: FRUIT_COUNT}, (_, i) => `${i+1}.jpg`);
const FRUIT_RADIUS = [36, 44, 54, 66, 80, 96, 120]; // 每级水果大小

const MESSAGES = {
    2: '宜言饮酒',
    3: '与子偕老',
    4: '琴瑟在御',
    5: '莫不静好',
    6: '祝洪漪妮、曾础铭新婚快乐，永远幸福！'
};

let fruits = [];
let images = [];
let isDropping = false;
let dropFruit = null;
let dropX = canvas.width / 2;
let gameOver = false;

// 加载图片
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

// 水果对象
function Fruit(x, y, type, vy = 0) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = FRUIT_RADIUS[type];
    this.vy = vy;
    this.merged = false;
}

function drawFruit(fruit) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(fruit.x, fruit.y, fruit.radius, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(images[fruit.type], fruit.x - fruit.radius, fruit.y - fruit.radius, fruit.radius * 2, fruit.radius * 2);
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let fruit of fruits) {
        drawFruit(fruit);
    }
    if (dropFruit) {
        drawFruit(dropFruit);
    }
}

function update() {
    if (gameOver) return;
    for (let fruit of fruits) {
        fruit.y += fruit.vy;
        fruit.vy += 0.3; // 重力
        if (fruit.y + fruit.radius > canvas.height) {
            fruit.y = canvas.height - fruit.radius;
            fruit.vy = 0;
        }
    }
    // 碰撞检测与合成
    for (let i = 0; i < fruits.length; i++) {
        for (let j = i + 1; j < fruits.length; j++) {
            let a = fruits[i], b = fruits[j];
            let dx = a.x - b.x, dy = a.y - b.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < a.radius + b.radius) {
                // 合成
                if (a.type === b.type && !a.merged && !b.merged && a.type < FRUIT_COUNT - 1) {
                    let nx = (a.x + b.x) / 2;
                    let ny = (a.y + b.y) / 2;
                    fruits.push(new Fruit(nx, ny, a.type + 1));
                    a.merged = b.merged = true;
                    showMessage(a.type + 1);
                    if (mergeSound) {
                        mergeSound.currentTime = 0;
                        mergeSound.play();
                    }
                } else {
                    // 简单弹开
                    let overlap = a.radius + b.radius - dist;
                    let ox = dx / dist * overlap / 2;
                    let oy = dy / dist * overlap / 2;
                    a.x += ox; a.y += oy;
                    b.x -= ox; b.y -= oy;
                }
            }
        }
    }
    // 移除已合成的
    fruits = fruits.filter(f => !f.merged);
}

function showMessage(type) {
    if (MESSAGES[type]) {
        messageDiv.textContent = MESSAGES[type];
        messageDiv.style.opacity = 1;
        if (type === 6) { // 最后一张全屏祝福
            setTimeout(() => {
                messageDiv.style.fontSize = '2em';
                messageDiv.style.color = '#e06666';
                messageDiv.style.background = 'rgba(255,255,255,0.9)';
                messageDiv.style.position = 'absolute';
                messageDiv.style.top = '40%';
                messageDiv.style.left = '0';
                messageDiv.style.width = '100%';
                messageDiv.style.padding = '30px 0';
            }, 100);
        }
        setTimeout(() => {
            if (type !== 6) {
                messageDiv.style.opacity = 0;
            }
        }, 2000);
    }
}

canvas.addEventListener('mousemove', e => {
    if (!isDropping && !gameOver) {
        const rect = canvas.getBoundingClientRect();
        dropX = e.clientX - rect.left;
    }
});

canvas.addEventListener('click', () => {
    if (!isDropping && !gameOver) {
        dropFruit = new Fruit(dropX, FRUIT_RADIUS[0], 0, 0);
        isDropping = true;
    }
});

function gameLoop() {
    if (!gameOver) {
        if (isDropping && dropFruit) {
            dropFruit.y += dropFruit.vy;
            dropFruit.vy += 0.3;
            if (dropFruit.y + dropFruit.radius >= canvas.height) {
                dropFruit.y = canvas.height - dropFruit.radius;
                fruits.push(dropFruit);
                dropFruit = null;
                isDropping = false;
            } else {
                // 与已有水果碰撞
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
    }
}

loadImages(() => {
    gameLoop();
    if (bgm) bgm.volume = 0.4;
});

// 适配移动端
canvas.addEventListener('touchmove', e => {
    if (!isDropping && !gameOver) {
        const rect = canvas.getBoundingClientRect();
        dropX = e.touches[0].clientX - rect.left;
    }
});
canvas.addEventListener('touchend', () => {
    if (!isDropping && !gameOver) {
        dropFruit = new Fruit(dropX, FRUIT_RADIUS[0], 0, 0);
        isDropping = true;
    }
});

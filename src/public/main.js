import { v4 as uuidv4 } from './uuid/index.js';

import { Physics } from './physics.js';
import { Projectile } from './projectile.js';
import { Vector2 } from './vector2.js';
import { Game } from './game.js';

Game.run();

const PLAYER_COLOURS = [
    'rgb(255, 0, 0)',
    'rgb(255, 128, 0)',
    'rgb(255, 255, 0)',
    'rgb(0, 255, 0)',
    'rgb(0, 128, 255)',
    'rgb(64, 0, 255)',
    'rgb(192, 0, 255)'
];

let playerColour = 0;
let hitsTaken = 0;

addEventListener('keydown', event => {
    if (event.repeat) return;

    switch (event.code) {
        case 'KeyW': Game.holdW = true; break;
        case 'KeyA': Game.holdA = true; break;
        case 'KeyS': Game.holdS = true; break;
        case 'KeyD': Game.holdD = true; break;
        case 'ArrowUp': Game.holdW = true; break;
        case 'ArrowLeft': Game.holdA = true; break;
        case 'ArrowDown': Game.holdS = true; break;
        case 'ArrowRight': Game.holdD = true; break;
        case 'Space': {
            ++playerColour;
            if (playerColour >= PLAYER_COLOURS.length) playerColour = 0;
            Game.socket.emit('player_change_colour', playerColour);
            break;
        }
    }
});

addEventListener('keyup', event => {
    switch (event.code) {
        case 'KeyW': Game.holdW = false; break;
        case 'KeyA': Game.holdA = false; break;
        case 'KeyS': Game.holdS = false; break;
        case 'KeyD': Game.holdD = false; break;
        case 'ArrowUp': Game.holdW = false; break;
        case 'ArrowLeft': Game.holdA = false; break;
        case 'ArrowDown': Game.holdS = false; break;
        case 'ArrowRight': Game.holdD = false; break;
    }
});

addEventListener('mousedown', event => {
    if (event.button !== 0) return;

    Game.holdAttack = true;
    Game.mousePosition.x = event.x;
    Game.mousePosition.y = event.y;
});

addEventListener('mouseup', event => { if (event.button === 0) Game.holdAttack = false; });

addEventListener('mousemove', event => {
    Game.mousePosition.x = event.x;
    Game.mousePosition.y = event.y;
});

/** @type {Player[]} */
const otherPlayers = [];

/** @type {Projectile[]} */
const projectiles = [];

Game.socket.on('player_connected', newPlayer => {
    otherPlayers.push(newPlayer);
});

Game.socket.on('player_move', (id, position) => {
    const index = otherPlayers.findIndex(player => player.id === id);
    otherPlayers[index].position = position;
});

Game.socket.on('player_change_colour', (id, colour) => {
    const index = otherPlayers.findIndex(player => player.id === id);
    otherPlayers[index].colour = colour;
});

Game.socket.on('create_projectile', projectile => {
    // TODO: Is there a better way to reconstruct these objects? Or not have to reconstruct them?
    projectiles.unshift(new Projectile(
        projectile.id,
        projectile.owner,
        projectile.origin,
        projectile.direction,
        projectile.speed,
        projectile.head,
        projectile.tail
    ));
});

Game.socket.on('projectile_hit', (projectileID, targetID) => {
    const projectileIndex = projectiles.findIndex(projectile => projectile.id === projectileID);
    projectiles[projectileIndex].destroyed = true;

    if (targetID === Game.socket.id) {
        ++hitsTaken;
    } else {
        const index = otherPlayers.findIndex(player => player.id === targetID);
        ++otherPlayers[index].hitsTaken;
    }
});

Game.socket.on('player_disconnected', id => {
    const index = otherPlayers.findIndex(player => player.id === id);
    otherPlayers.splice(index, 1);
});

const PLAYER_SPEED = 4;
let playerPrevious = new Vector2();
let playerPosition = new Vector2(
    (Math.random() * Game.CANVAS_WORLD_SPACE_WIDTH) - Game.CANVAS_WORLD_SPACE_WIDTH / 2,
    (Math.random() * Game.CANVAS_WORLD_SPACE_HEIGHT) - Game.CANVAS_WORLD_SPACE_HEIGHT / 2
);

// Set the player's initial position on the server
Game.socket.emit('player_move', playerPosition);

// TODO: Manage the deltaTime for the first frame properly (currently includes loading time)
let prev = 0;
let deltaTime;

function tick(t) {
    deltaTime = (t - prev) / 1000;
    prev = t;

    playerPrevious = structuredClone(playerPosition);

    if (Game.holdW) playerPosition.y -= PLAYER_SPEED * deltaTime;
    if (Game.holdD) playerPosition.x += PLAYER_SPEED * deltaTime;
    if (Game.holdS) playerPosition.y += PLAYER_SPEED * deltaTime;
    if (Game.holdA) playerPosition.x -= PLAYER_SPEED * deltaTime;

    if (playerPosition.y - Game.PLAYER_RADIUS < -Game.CANVAS_WORLD_SPACE_HEIGHT / 2)
        playerPosition.y = -Game.CANVAS_WORLD_SPACE_HEIGHT / 2 + Game.PLAYER_RADIUS;
    if (playerPosition.x + Game.PLAYER_RADIUS > Game.CANVAS_WORLD_SPACE_WIDTH / 2)
        playerPosition.x = Game.CANVAS_WORLD_SPACE_WIDTH / 2 - Game.PLAYER_RADIUS;
    if (playerPosition.y + Game.PLAYER_RADIUS > Game.CANVAS_WORLD_SPACE_HEIGHT / 2)
        playerPosition.y = Game.CANVAS_WORLD_SPACE_HEIGHT / 2 - Game.PLAYER_RADIUS;
    if (playerPosition.x - Game.PLAYER_RADIUS < -Game.CANVAS_WORLD_SPACE_WIDTH / 2)
        playerPosition.x = -Game.CANVAS_WORLD_SPACE_WIDTH / 2 + Game.PLAYER_RADIUS;

    if (Game.holdAttack) {
        if (Game.attackT <= 0) {
            const clickPosition = Game.screenSpacePointToWorldSpace(
                new Vector2(
                    mousePosition.x - Game.canvas.offsetLeft,
                    mousePosition.y - Game.canvas.offsetTop
                )
            );

            const direction = Vector2.subtract(clickPosition, playerPosition).normalized;

            const projectile = new Projectile(
                uuidv4(),
                Game.socket.id,
                Vector2.add(
                    structuredClone(playerPosition),
                    Vector2.multiplyScalar(direction, Game.PLAYER_RADIUS)
                ),
                direction,
                50
            );

            // TODO: CreateNetworkObject function?
            projectiles.unshift(projectile);
            Game.socket.emit('create_projectile', projectile);

            Game.attackT += Game.ATTACK_INTERVAL;
        }
    }

    if (!Vector2.equal(playerPosition, playerPrevious))
        Game.socket.emit('player_move', playerPosition);

    Game.context.clearRect(0, 0, Game.canvas.width, Game.canvas.height);

    for (let i = projectiles.length - 1; i >= 0; --i) {
        projectiles[i].update(deltaTime);

        if (projectiles[i].owner === Game.socket.id) {
            for (const player of otherPlayers) {
                if (Physics.lineCircleCollision(
                    projectiles[i].tail,
                    projectiles[i].head,
                    player.position,
                    Game.PLAYER_RADIUS
                )) {
                    Game.socket.emit('projectile_hit', projectiles[i].id, player.id);
                    projectiles[i].destroyed = true;
                    ++player.hitsTaken;
                }
            }
        }

        if (projectiles[i].destroyed) {
            projectiles.splice(i, 1);
            continue;
        }

        const lineStart = Game.worldSpacePointToScreenSpace(projectiles[i].tail);
        const lineEnd = Game.worldSpacePointToScreenSpace(projectiles[i].head);

        Game.context.beginPath();
        Game.context.strokeStyle = 'rgb(255, 255, 255)';
        Game.context.lineWidth = 2;
        Game.context.moveTo(lineStart.x, lineStart.y);
        Game.context.lineTo(lineEnd.x, lineEnd.y);
        Game.context.stroke();
    }

    for (const player of otherPlayers) {
        const playerPos = Game.worldSpacePointToScreenSpace(player.position);

        Game.context.beginPath();
        Game.context.arc(playerPos.x, playerPos.y, Game.playerRadiusScreenSpace, 0, 2 * Math.PI, false);
        Game.context.fillStyle = PLAYER_COLOURS[player.colour];
        Game.context.fill();
    }

    const playerPos = Game.worldSpacePointToScreenSpace(playerPosition);

    Game.context.beginPath();
    Game.context.arc(playerPos.x, playerPos.y, Game.playerRadiusScreenSpace, 0, 2 * Math.PI, false);
    Game.context.fillStyle = PLAYER_COLOURS[playerColour];
    Game.context.fill();

    for (const player of otherPlayers) {
        const playerPos = Game.worldSpacePointToScreenSpace(player.position);
        Game.context.fillStyle = PLAYER_COLOURS[player.colour];
        Game.context.fillText(player.hitsTaken, playerPos.x, playerPos.y - Game.playerRadiusScreenSpace - 5);
    }

    Game.context.fillStyle = PLAYER_COLOURS[playerColour];
    Game.context.fillText(hitsTaken, playerPos.x, playerPos.y - Game.playerRadiusScreenSpace - 5);

    Game.attackT -= deltaTime;
    if (Game.attackT < 0) Game.attackT = 0;

    requestAnimationFrame(tick);
}

// TODO: socket.id is undefined initially. Perhaps only start once it is defined?
requestAnimationFrame(tick);

// TODO: Untie game logic from frame rate

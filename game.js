let socket = io()
const ASSET_URL = 'assets/'
const WORLD_SIZE = { w: 1600, h: 1200 }
let keyW
let keySpace
const bulletsArray = []
let enemyPlayers = {}
const stats = []

class StartScene extends Phaser.Scene {
    constructor() {
        super('start')
    }
    preload() {
        this.load.image('bullet', ASSET_URL + 'cannon_ball.png')
        this.load.image('water', ASSET_URL + 'water_tile.png')
        for (let i = 1; i <= 6; i++) {
            this.load.image('ship' + String(i) + '_1', ASSET_URL + 'ship' + String(i) + '_1.png')
            this.load.image('ship' + String(i) + '_2', ASSET_URL + 'ship' + String(i) + '_2.png')
            this.load.image('ship' + String(i) + '_3', ASSET_URL + 'ship' + String(i) + '_3.png')
            this.load.image('ship' + String(i) + '_4', ASSET_URL + 'ship' + String(i) + '_4.png')
            this.load.atlas('boom', ASSET_URL + 'boom.png', ASSET_URL + 'boom.json')
        }
        this.load.image('gameplay', ASSET_URL + 'gameplay.gif')
        this.load.html('input', ASSET_URL + 'input.html')
    }
    create() {
        socket.disconnect()
        enemyPlayers = {}
        this.bg = this.add.sprite(0, 0, 'gameplay')
            .setOrigin(0)
            .setScale(2);
        // this.add.text(WORLD_SIZE.w / 2, WORLD_SIZE.h / 2, 'Start', { font: '66px Arial' }).setOrigin(0.5)
        let element = this.add.dom(WORLD_SIZE.w / 2, WORLD_SIZE.h / 2,).createFromCache('input').setScrollFactor(0)
        element.addListener('click')
        element.on('click', e => {
            let input = element.getChildByName('username')
            console.log(enemyPlayers)
            if (e.target.name === 'button' && input.value) {
                this.scene.start('game', input.value)
            }
        })
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super('game')
    }
    preload() { }
    create(name) {
        socket.connect()
        this.cameras.main.setBounds(0, 0, WORLD_SIZE.w, WORLD_SIZE.y)
        this.createKeysCode()
        this.createBg()
        this.showBullets()
        this.bulletsHit()
        this.player = new Player(this)
        this.client = new Client(this, this.player)
        this.client.init(name)
    }
    update() {
        this.player.update()

        for (let id in enemyPlayers) {
            if (enemyPlayers[id].sprite.alpha < 1) {
                enemyPlayers[id].sprite.alpha += 0.05
            } else {
                enemyPlayers[id].sprite.alpha = 1
            }
        }
    }
    showBullets() {
        socket.on('bulletsUpdate', bulletsArrayServer => {
            for (let i = 0; i < bulletsArrayServer.length; i++) {
                if (!bulletsArray[i]) {
                    bulletsArray[i] = this.add.sprite(bulletsArrayServer[i].x, bulletsArrayServer[i].y, 'bullet')
                } else {
                    bulletsArray[i].x = bulletsArrayServer[i].x
                    bulletsArray[i].y = bulletsArrayServer[i].y
                }
            }
            for (let i = bulletsArrayServer.length; i < bulletsArray.length; i++) {
                bulletsArray[i].destroy()
                bulletsArray.splice(i, 1)
                i--
            }
        })
    }
    bulletsHit() {
        socket.on('playerHit', data => {
            if (data.id === socket.id) {
                this.player.sprite.alpha = 0
            } else {
                enemyPlayers[data.id].sprite.alpha = 0
            }
            this.changeTextureShip(data.id, data.life)
        })
    }
    changeTextureShip(id, life) {
        const me = socket.id === id
        if (life === 15) me ? this.player.sprite.setTexture('ship3_2') : enemyPlayers[id].sprite.setTexture('ship1_2')
        else if (life === 10) me ? this.player.sprite.setTexture('ship3_3') : enemyPlayers[id].sprite.setTexture('ship1_3')
        else if (life === 5) me ? this.player.sprite.setTexture('ship3_4') : enemyPlayers[id].sprite.setTexture('ship1_4')

    }
    createKeysCode() {
        keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    }
    createBg() {
        for (let i = 0; i < WORLD_SIZE.w / 64; i++) {
            for (let j = 0; j < WORLD_SIZE.h / 64; j++) {
                let tileWater = this.add.sprite(i * 64, j * 64, 'water')
                tileWater.setOrigin(0)
            }
        }
    }
}

class Player {
    constructor(scene) {
        this.bulletsArray = []
        this.scene = scene
        this.life = 40
        this.type = 1
        this.speed = 0.10
        this.moveX = 0
        this.moveY = 0
        this.friction = 0.98
        this.sprite = this.scene.add.sprite(Math.random() * WORLD_SIZE.w / 2, Math.random() * WORLD_SIZE.h / 2, `ship3_1`)
        this.isShot = false

    }

    update() {
        this.rotationOnMouse()
        this.move()
        this.shootBullet()
        if (this.sprite.alpha < 1) {
            this.sprite.alpha += 0.05
        } else {
            this.sprite.alpha = 1
        }
    }
    rotationOnMouse() {
        let dx = (this.scene.input.mousePointer.x - this.scene.cameras.main.x) - this.sprite.x
        let dy = (this.scene.input.mousePointer.y - this.scene.cameras.main.y) - this.sprite.y
        let angle = -Math.atan2(dx, dy)
        this.sprite.rotation = angle
    }
    move() {
        if (keyW.isDown) {
            this.moveX += Math.cos(this.sprite.rotation + Math.PI / 2) * this.speed
            this.moveY += Math.sin(this.sprite.rotation + Math.PI / 2) * this.speed
        }

        this.sprite.x += this.moveX
        this.sprite.y += this.moveY

        this.moveX *= this.friction
        this.moveY *= this.friction

        socket.emit('playerMove', {
            x: this.sprite.x,
            y: this.sprite.y,
            angle: this.sprite.angle,
        })
    }
    shootBullet() {
        if (keySpace.isDown && !this.isShot) {
            this.isShot = true
            const speed = 16
            const moveX = Math.cos(this.sprite.rotation + Math.PI / 2) * speed
            const moveY = Math.sin(this.sprite.rotation + Math.PI / 2) * speed

            socket.emit('shootBullet', {
                x: this.sprite.x,
                y: this.sprite.y,
                moveX: moveX,
                moveY: moveY,
            })
        }
        if (!keySpace.isDown) this.isShot = false
    }
}

class Enemy {
    constructor(scene, x, y, angle, type) {
        this.sprite = scene.add.sprite(x, y, `ship${type}_1`)
        this.sprite.angle = angle
    }
}

class Client extends Phaser.Events.EventEmitter {
    constructor(scene, player) {
        super()
        this.scene = scene
        this.player = player
        this.scoreRecord = null
    }
    init(name) {
        socket.emit('newPlayer', {
            x: this.player.sprite.x,
            y: this.player.sprite.y,
            angle: this.player.sprite.angle,
            type: 1,
            name: name
        })
        socket.on('updatePlayers', playersData => {
            let playersFound = {}
            for (let id in playersData) {
                if (!enemyPlayers[id] && id !== socket.id) {
                    let enemyData = playersData[id]
                    let enemy = new Enemy(this.scene, enemyData.x, enemyData.y, enemyData.angle, 1)
                    enemyPlayers[id] = enemy
                    console.log('создаём нового игрока')
                }
                playersFound[id] = true
                if (socket.id !== id) {
                    enemyPlayers[id].sprite.x = playersData[id].x
                    enemyPlayers[id].sprite.y = playersData[id].y
                    enemyPlayers[id].sprite.angle = playersData[id].angle
                }
            }
            for (let id in enemyPlayers) {
                if (!playersFound[id]) {
                    enemyPlayers[id].sprite.destroy()
                    delete enemyPlayers[id]
                }
            }
        })
        socket.on('destroyPlayer', id => {
            if (id === socket.id) {
                this.player.sprite.destroy()
                new Boom(this.scene, this.player.sprite.x, this.player.sprite.y)
                enemyPlayers = {}
                this.scene.scene.start('start')
            } else {
                enemyPlayers[id].sprite.destroy()
                new Boom(this.scene, enemyPlayers[id].sprite.x, enemyPlayers[id].sprite.y)
            }
        })
        socket.on('updateStats', players => {
            const arr = Object.values(players).sort((a, b) => {
                return b.score - a.score
            })
            for(let i = 0; i < stats.length; i++){
                stats[i].destroy()
                stats.splice(i, 1)
                i--
            }
            arr.forEach((player, index) => {
                stats.push(this.scene.add.text(20, (index + 1) * 20, `${player.name}: ${player.score} очков`,
                 {color:'#956635', font:"bold 20px Arial"}))
            })
        })
        socket.on('scoreRecord', data =>{
            if(!this.scoreRecord){
                this.scoreRecord = this.scene.add.text(20, WORLD_SIZE.h - 40, `РЕКОРД ${data.name}: ${data.score}`, 
                {color:'#956635', font:"bold 20px Arial"})
            }else{
                this.scoreRecord.setText(`РЕКОРД ${data.name}: ${data.score}`) 
            }
        })
    }

}

class Boom extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'boom', 'boom1')
        this.scene.add.existing(this)
        const frames = this.scene.anims.generateFrameNames('boom', {
            prefix: 'boom', start: 1, end: 4
        })
        this.scene.anims.create({
            key: 'boom', frames: frames, frameRate: 10, repeat: 0
        })
        this.play('boom')
        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            this.destroy()
        })
    }
}










const config = {
    type: Phaser.AUTO,
    width: WORLD_SIZE.w,
    height: WORLD_SIZE.h,
    // scene: [GameScene, StartScene],
    scene: [StartScene, GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        // autoCenter: Phaser.Scale.CENTER_BOTH
    },
    dom: {
        createContainer: true
    },
    parent: 'phaser-example',
}
let game = new Phaser.Game(config)
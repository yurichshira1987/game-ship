const express = require('express')
const app = express()
const http = require('http')
const server = http.createServer(app)
const io = require('socket.io')(server)

const PORT = process.env.PORT || 3000

app.use('/assets', express.static('assets'))
app.use('/game.js', express.static('game.js'))
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html')
})

let players = {}
let bulletsArrayServer = []
const LIFE = 20
let scoreData = {name:null, score: 0}

io.on('connection', socket => {
    console.log('socket connected')
    socket.on('newPlayer', data => {
        data.life = LIFE
        data.score = 0
        players[socket.id] = data
        io.emit('updatePlayers', players)
        io.emit('updateStats', players)
        if(scoreData.name)io.emit('scoreRecord', scoreData)
    })

    socket.on('disconnect', () => {
        delete players[socket.id]
        console.log('socket disconnected')
    })
    socket.on('playerMove', data => {
        if (players[socket.id] === undefined) return
        if (data.x < 1600 && data.x > 0 && data.y > 0 && data.y < 1200) {
            players[socket.id].x = data.x
            players[socket.id].y = data.y
        }
        players[socket.id].angle = data.angle
        io.emit('updatePlayers', players)
    })

    socket.on('shootBullet', data => {
        if (!players[socket.id]) return
        let newBullet = data
        newBullet.ownerId = socket.id
        bulletsArrayServer.push(newBullet)
    })
})

const ServerGameLoop = () => {
    for (let i = 0; i < bulletsArrayServer.length; i++) {
        let bulletDelete = false
        let bullet = bulletsArrayServer[i]
        bulletsArrayServer[i].x += bullet.moveX
        bulletsArrayServer[i].y += bullet.moveY

        for (id in players) {
            if (bullet.ownerId !== id) {
                const dx = players[id].x - bullet.x
                const dy = players[id].y - bullet.y
                const distance = Math.sqrt(dx * dx + dy * dy)
                if (distance < 50) {
                    players[id].life--
                    players[bullet.ownerId].score += 10
                    bulletDelete = true
                    io.emit('playerHit', { id: id, life: players[id].life })
                    if (players[id].life === 0) {
                        players[bullet.ownerId].score += 100
                        delete players[id]
                        io.emit('destroyPlayer', id)
                    }
                    io.emit('updateStats', players)
                }
            }
            if (players[id] && scoreData.score < players[id].score) {
                scoreData.name = players[id].name
                scoreData.score = players[id].score
                io.emit('scoreRecord', scoreData)
            }
        }
        if (bullet.x < -10 || bullet.x > 1610 || bullet.y < -10 || bullet.y > 1210 || bulletDelete) {
            bulletsArrayServer.splice(i, 1)
            i--
        }
    }
    io.emit('bulletsUpdate', bulletsArrayServer)
}


setInterval(ServerGameLoop, 16)







server.listen(PORT, () => {
    console.log('server has been started')
})
const { Server } = require('socket.io')
const uuidv4 = require('uuid').v4

const io = new Server(3000, {
    cors: {
        origin: "http://localhost:8080"
    }
})

const roomsList = {};
const usersList = {};

io.on('connection', socket => {
    let roomId = null;

    socket.emit('connection', 'success')

    socket.on('user', (name, callback) => {
        userId = socket.id
        usersList[socket.id] = {name}
        callback({creating: true, name})
    })

    socket.on('users in channel', (usersId, callback) => {
        const users = {}
        usersId.forEach(userId => {
            users[userId] = {
                name: usersList[userId]?.name
            }
        });
        callback(users)
    })

    socket.on('create room', (roomName, maxPlayers, characteristicPlayer, callback) => {
        if (!usersList[socket.id]) {
            callback({error: 'You need an username'})
            return
        }

        if (!roomName) {
            callback({error: 'You need to specify a name for the room'})
            return
        }

        roomId = uuidv4().split('-')[1]
        roomsList[roomId] = {
            id: roomId,
            name: roomName,
            admin: socket.id,
            users: [
                socket.id
            ],
            players: {},
            maxPlayers,
            characteristicPlayer
        }
        socket.join(roomId)

        callback({creating: true, room: roomsList[roomId]})
    })

    socket.on('join room', (roomAndId, callback) => {
        if (!usersList[socket.id]) {
            callback({error: 'You need an username'})
            return
        }

        roomId = roomAndId.split('#')[1]

        if (!roomsList[roomId]) {
            callback({error: 'This channel doesn\'t exist'})
            return
        }

        if (roomsList[roomId].timeout) {
            clearTimeout(roomsList[roomId].timeout)
        }

        if (roomsList[roomId].maxPlayers === roomsList[roomId].users.length) {
            callback({error: 'Need more slot to join'})
            return
        }

        roomsList[roomId].users.push(socket.id)
        socket.join(roomId)

        roomsList[roomId].players[socket.id] = {}
        for (const characteristic of roomsList[roomId].characteristicPlayer) {
            if (characteristic.hasSubgroup){
                roomsList[roomId].players[socket.id][characteristic.label] = {}
                for (const subCharacteristic of characteristic.subgroup) {
                    roomsList[roomId].players[socket.id][characteristic.label][subCharacteristic.label] = subCharacteristic.type === 'Number' ? 0 : ''
                }
            } else {
                roomsList[roomId].players[socket.id][characteristic.label] = characteristic.type === 'Number' ? 0 : ''
            }
        }

        socket.to(roomId).emit('new player', {userId: socket.id, name: usersList[socket.id].name})

        callback({joinning: true, room: roomsList[roomId]})
    })

    socket.on('create or update personnage', (userId, characteristicPlayer, callback) => {
        roomsList[roomId].players[userId] = characteristicPlayer
        socket.to(roomId).emit('create or update personnage', userId, characteristicPlayer)
        callback('succes')
    })

    socket.on('roll', (diceType, broadcast, callback) => {
        const result = Math.floor(Math.random() * diceType)

        if (broadcast) {
            socket.to(roomsList[roomId]).emit('dice result', {result})
        }

        callback(result)
    })

    socket.on('cheatRoll', (result) => {
        socket.to(roomId).emit('dice result', {result})
        callback(result)
    })

    socket.on('export', (callback) => {
        callback(roomId)
    })

    // @TODO create import function
    socket.on('export', (data, callback) => {
        callback('Need to create')
    })

    socket.on('disconnect', reason => {
        if (usersList[socket.id]) {
            socket.to(roomId).emit('user leave', socket.id);
            socket.leave(roomId)
            delete usersList[socket.id]
            const userIdInRoom = roomsList[roomId].users.indexOf[socket.id]
            roomsList[roomId].users.splice(userIdInRoom, 1);
            roomId = null
            // @TODO generate delete room
            /*if (!roomsList[roomId].users.length){
                roomsList[roomId].timeout = setTimeout(() => {
                    delete roomsList[roomId]
                }, 8640000)
            }
            */
        }
    })
})
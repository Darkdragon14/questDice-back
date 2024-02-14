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
    let userId = uuidv4();

    socket.emit('connection', userId)

    socket.on('user', (name, callback) => {
        usersList[userId] = {
            name,
            isConnected: true
        }
        callback({creating: true, name, isConnected: true})
    })

    socket.on('users in channel', (usersId, callback) => {
        const users = {}
        usersId.forEach(userId => { 
            usersList[userId] ? users[userId] = usersList[userId] : null
        });
        callback(users)
    })

    socket.on('create room', (roomName, maxPlayers, characteristicPlayer, callback) => {
        if (!usersList[userId]) {
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
            admin: userId,
            users: [
                userId
            ],
            players: {},
            maxPlayers,
            characteristicPlayer,
            rollLogs: []
        }
        socket.join(roomId)

        callback({creating: true, room: roomsList[roomId]})
    })

    socket.on('join room', (roomAndId, callback) => {
        if (!usersList[userId]) {
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

        roomsList[roomId].users.push(userId)
        socket.join(roomId)

        roomsList[roomId].players[userId] = {}
        for (const characteristic of roomsList[roomId].characteristicPlayer) {
            if (characteristic.hasSubgroup){
                roomsList[roomId].players[userId][characteristic.label] = {}
                for (const subCharacteristic of characteristic.subgroup) {
                    roomsList[roomId].players[userId][characteristic.label][subCharacteristic.label] = subCharacteristic.type === 'Number' ? 0 : ''
                }
            } else {
                roomsList[roomId].players[userId][characteristic.label] = characteristic.type === 'Number' ? 0 : ''
            }
        }

        socket.to(roomId).emit('user join', {userId, ...usersList[userId]})

        callback({joinning: true, room: roomsList[roomId]})
    })

    socket.on('create or update personnage', (selectedUserId, characteristicPlayer, callback) => {
        roomsList[roomId].players[selectedUserId] = characteristicPlayer
        socket.to(roomId).emit('create or update personnage', selectedUserId, characteristicPlayer)
        callback('succes')
    })

    socket.on('roll', (dices, broadcast, callback) => {
        const result = {
            total: 0,
            userId
        }
        for (const dice of dices) {
            let resultDice = Math.floor(Math.random() * dice.split('.')[0])
            resultDice = resultDice === 0 ? 1 : resultDice
            result.total += resultDice
            result[dice] = resultDice
        }

        roomsList[roomId].rollLogs.push(result)

        if (broadcast) {
            socket.to(roomId).emit('dice result', result)
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

    socket.on('logout', reason => {
        disconnect(reason)
    })

    socket.conn.on("close", reason => {
        disconnect(reason)
    })

    socket.on('reconnect', (oldUserId, oldRoom, callback) => {
        userId = oldUserId
        if (!usersList[userId]) {
            callback({error: 'User doesn\'t exist'})
            return
        }
        usersList[userId].isConnected = true

        roomId = oldRoom.split('#')[1]
        if (!roomsList[roomId]) {
            callback({error: 'This channel doesn\'t exist'})
            return
        }
        socket.join(roomId)

        socket.to(roomId).emit('user join', {userId, ...usersList[userId]});

        callback(roomsList[roomId])
    })

    

    const disconnect = (reason) => {
        if (usersList[userId]) {
            socket.to(roomId).emit('user leave', userId, reason);
            socket.leave(roomId)
            usersList[userId].isConnected = false  
            roomId = null
            // @TODO generate delete room
            /*if (!roomsList[roomId].users.length){
                roomsList[roomId].timeout = setTimeout(() => {
                    delete roomsList[roomId]
                }, 8640000)
            }
            */
        }
    }
})
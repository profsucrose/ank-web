const functions = require('firebase-functions')
const admin = require('firebase-admin')
const express = require('express')

const serviceAccount = require('./serviceAccountKey.json')
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://hackankbot.firebaseio.com"
})

const app = express()

exports.api = functions.https.onRequest(app)

const db = admin.firestore()

app.get('/api', (req, res) => {
    return res.send('hello from ank')
})

app.get('/api/balance', async (req, res) => {
    const { id } = req.query
    if (!id)
        return res.status(400).send('id not specified')
    const snapshot = await db.doc(`accounts/${id}`).get()

    if (snapshot.exists) {
        return res.send({ value: snapshot.get('balance') })
    } else {
        const startingAmount = await db.doc(`var/starting-amount`).get()
        return res.send( { value: startingAmount.get('value') } )
    }
})

app.post('/api/transfer', async (req, res) => {
    const { payer, receiver, amount, key } = req.body
    if (!payer || !receiver || !amount) 
        return res.status(400).send('Payer, receiver or amount not specified')

    const tokenSnapshot = await db.doc(`tokens/${key}`).get()
    console.log(tokenSnapshot.exists)
    if (!tokenSnapshot.exists) return res.status(401).send('Invalid API key')

    amountNumber = Number(amount)
    const payerSnapshot = await db.doc(`accounts/${payer}`).get()
    const receiverSnapshot = await db.doc(`accounts/${receiver}`).get()

    console.log(payerSnapshot.exists)
    if (!payerSnapshot.exists 
        || payerSnapshot.get('balance') < amount)
        return res.status(400).send('insufficient balance')

    await db.doc(`accounts/${payer}`).set({ balance: payerSnapshot.get('balance') - amountNumber }, { merge: true })

    if (receiverSnapshot.get('balance')) {
        await db.doc(`accounts/${receiver}`).set({ balance: receiverSnapshot.get('balance') + amountNumber }, { merge: true })
    } else {
        const startingAmount = await db.doc(`var/starting-amount`).get()
        await db.doc(`accounts/${receiver}`).set({ balance: startingAmount.get('value') + amountNumber }, { merge: true })
    }
    
    return res.send('Transaction successful')
})

app.get('/api/users', async (req, res) => {
    const { upper, lower } = req.query
    if (!upper || !lower) 
        return res.status(400).send('upper and lower not specified')

    let users = (await db.collection('accounts').get()).docs.map(snap => ({ 
        balance: snap.get('balance'),
        userId: snap.id
    }))

    users = users.sort((a, b) => b.balance - a.balance)
    users = users.slice(lower - 1, upper)
    return res.json(users)
})

app.get('/api/starting-amount', async (req, res) => {
    const startingAmount = await db.doc(`var/starting-amount`).get()
    return res.send( { value: startingAmount.get('value') } )
})


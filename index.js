const express = require('express');
const cors = require('cors');
const app = express()
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


// ===================================================>

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d9zindd.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const userCollection = client.db('instruPlayDB').collection('users');
        const classCollection = client.db('instruPlayDB').collection('classes');
        const cartCollection = client.db('instruPlayDB').collection('carts');

        // class related apis
        app.get('/classes', async (req, res) => {
            const cursor = classCollection.find().sort({ students: -1 })
            const result = await cursor.toArray();
            res.send(result);
        })

        // user related apis
        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await userCollection.insertOne(user);
            res.send(result);

        })

        // get user
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await userCollection.findOne(query)
            res.send(result);
        })

        // instructors
        // app.get('/instructors', async (req, res => {
        //     const query = {role: 'instructor'};
        //     const result = await userCollection.find(query)
        // }))

        app.get('/instructors', async (req, res) => {
            const query = { role: 'instructor' };
            const result = await userCollection.find(query).sort({ students: -1 }).toArray();
            res.send(result);
        })

        // get selected class by email
        app.get('/carts', async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })

        // add select class
        app.post('/carts', async (req, res) => {
            const selectedClass = req.body;
            const result = await cartCollection.insertOne(selectedClass);
            res.send(result);
        })

        // delete selected class
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

// ===================================================>

app.get('/', (req, res) => {
    res.send('InstruPlay is running')
})

app.listen(port, () => {
    console.log(`InstruPlay is listening on port ${port}`)
})
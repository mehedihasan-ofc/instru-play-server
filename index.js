const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express()
require('dotenv').config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    // bearer token
    const token = authorization.split(' ')[1]

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res
                .status(401)
                .send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded
        next()
    })
}


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
        const paymentCollection = client.db('instruPlayDB').collection('payments');

        // jwt
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })

            res.send({ token })
        })

        // verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' })
            }

            next();
        }

        // verifyInstructor
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' })
            }

            next();
        }

        // class related apis
        app.get('/classes', async (req, res) => {
            const filter = { status: "approved" }
            const cursor = classCollection.find(filter).sort({ students: -1 })
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/classes/my-classes', verifyJWT, verifyInstructor, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { instructorEmail: email };
            const result = await classCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
            const newClass = req.body;
            const result = await classCollection.insertOne(newClass);
            res.send(result);
        })

        // user related apis
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

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

        // check role admin
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })

        // check role instructor
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };

            const result = await userCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await userCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        // get user
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await userCollection.findOne(query)
            res.send(result);
        })

        app.get('/instructors', async (req, res) => {
            const query = { role: 'instructor' };
            const result = await userCollection.find(query).sort({ students: -1 }).toArray();
            res.send(result);
        })

        // get selected class by email
        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })

        // 
        app.get('/my-enrolled', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await paymentCollection.find(query).toArray();
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

        //============================================>> payment related apis
        app.get('/payment/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.findOne(query);
            res.send(result);
        })

        app.get('/my-payment', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await paymentCollection.find(query).sort({ date: -1 }).toArray();
            res.send(result);
        })

        //===> create payment intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        //===> payment related api
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);

            const classQuery = { _id: new ObjectId(payment.classId) };
            const updateOptions = { $inc: { availableSeats: -1, students: 1 } };
            const updateResult = await classCollection.updateOne(classQuery, updateOptions);

            const query = { _id: new ObjectId(payment.cartId) };
            const deleteResult = await cartCollection.deleteOne(query);

            res.send({ insertResult, deleteResult, updateResult });
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
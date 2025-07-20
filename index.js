const express = require('express');
require('dotenv').config()
const jwt = require('jsonwebtoken')
const cors = require('cors');
const cookieParser = require('cookie-parser')
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://job-portal-21bfd.web.app',
        'https://job-portal-21bfd.firebaseapp.com'
    ], //server side
    credentials: true
}))

app.use(cookieParser());
const logger = (req, res, next) => {
    console.log('inside the logger');
    next();
}
const verifyToken = (req, res, next) => {
    // console.log('inside varify token midleware',req.cookies)
    const token = req?.cookies?.token;
    // console.log(token);
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    // console.log("env info:", process.env.TOKEN_JWS_SECRET)

    jwt.verify(token, process.env.TOKEN_JWS_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized access' })
        }
        req.user = decoded;
        next();
    })

}


//database connection
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster0.h2pknmg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // await client.connect();

        //job releted apis
        const jobsCollection = client.db("job_Portal").collection("jobs");
        const jobApplicationsCollection = client.db("job_Portal").collection("job-applications");


        //auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.TOKEN_JWS_SECRET, { expiresIn: '1h' });
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                   sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",

                })
                .send({ success: true });

        })

        //token logout
        app.post('/logout', (req, res) => {
            res
                .clearCookie('token', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                })
                .send({ success: true })
        })


        app.get('/jobs', logger, async (req, res) => {
            // console.log('Now inside the api callback')
            const email = req.query.email;
            let query = {};
            if (email) {
                query = { hr_email: email }
            }
            const cursor = jobsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobsCollection.findOne(query);
            res.send(result);
        })

        app.post('/jobs', async (req, res) => {
            const newJob = req.body;
            const result = await jobsCollection.insertOne(newJob);
            res.send(result);
        })

        ///job-applications specific job identify

        app.get('/job-applications/job/:job_id', async (req, res) => {
            const jobId = req.params.job_id;
            const query = { job_id: jobId };
            const result = await jobApplicationsCollection.find(query).toArray();
            res.send(result);
        })

        //application apis
        app.post('/job-applications', async (req, res) => {
            const applications = req.body;
            const result = await jobApplicationsCollection.insertOne(applications);

            const id = applications.job_id;
            const query = { _id: new ObjectId(id) };
            const job = await jobsCollection.findOne(query);

            let newCount = 1;
            if (job?.applicationCount) {
                newCount = job.applicationCount + 1;
            }
            else {
                newCount = 1;
            }

            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    applicationCount: newCount
                }
            }
            const updatedResult = await jobsCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        //updated status
        app.patch('/job-applications/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: data.status
                }
            }
            const result = await jobApplicationsCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        //user apply details
        app.get('/job-application', verifyToken, async (req, res) => {
            const email = req.query.email
            const query = { applicant_email: email }


            // console.log('cookies', req.cookies)
            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }


            const result = await jobApplicationsCollection.find(query).toArray();

            for (const application of result) {
                // console.log(application.job_id)
                const query = { _id: new ObjectId(application.job_id) }
                const job = await jobsCollection.findOne(query);
                if (job) {
                    application.title = job.title;
                    application.company = job.company;
                    application.company_logo = job.company_logo;
                }
            }
            res.send(result);
        })

        //details apply
        app.delete('/job-application/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobApplicationsCollection.deleteOne(query);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


;

app.get('/', (req, res) => {
    res.send('hello world!!!');
});


app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
var nodemailer = require('nodemailer');
var sgTransport = require('nodemailer-sendgrid-transport');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kwytb.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'UnAuthorized access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' })
    }
    req.decoded = decoded;
    next();
  });
}

const emailSenderOptions = {
  auth: {
    api_key: process.env.EMAIL_SENDER_KEY
  }
}

const emailClient = nodemailer.createTransport(sgTransport(emailSenderOptions));

function sendAppointmentEmail(booking) {
  const { patient, patientName, treatment, date, slot } = booking;

  var email = {
    from: process.env.EMAIL_SENDER,
    to: patient,
    subject: `Your Appointment for ${treatment} is on ${date} at ${slot} is Confirmed`,
    text: `Your Appointment for ${treatment} is on ${date} at ${slot} is Confirmed`,
    html: `
      <div>
        <p> Hello ${patientName}, </p>
        <h3>Your Appointment for ${treatment} is confirmed</h3>
        <p>Looking forward to seeing you on ${date} at ${slot}.</p>
        
        <h3>Our Address</h3>
        <p>Andor Killa Bandorban</p>
        <p>Bangladesh</p>
        <a href="https://web.programming-hero.com/">unsubscribe</a>
      </div>
    `
  };

  emailClient.sendMail(email, function (err, info) {
    if (err) {
      console.log(err);
    }
    else {
      console.log('Message sent: ', info);
    }
  });

}
function sendPaymentConfirmationEmail(booking) {
  const { patient, patientName, treatment, date, slot } = booking;

  var email = {
    from: process.env.EMAIL_SENDER,
    to: patient,
    subject: `We have received your payment for ${treatment} is on ${date} at ${slot} is Confirmed`,
    text: `Your payment for this Appointment ${treatment} is on ${date} at ${slot} is Confirmed`,
    html: `
      <div>
        <p> Hello ${patientName}, </p>
        <h3>Thank you for your payment . </h3>
        <h3>We have received your payment</h3>
        <p>Looking forward to seeing you on ${date} at ${slot}.</p>
        <h3>Our Address</h3>
        <p>Andor Killa Bandorban</p>
        <p>Bangladesh</p>
        <a href="https://web.programming-hero.com/">unsubscribe</a>
      </div>
    `
  };

  emailClient.sendMail(email, function (err, info) {
    if (err) {
      console.log(err);
    }
    else {
      console.log('Message sent: ', info);
    }
  });

}


async function run() {
  try {
    await client.connect();
    console.log('db connected');
    const serviceCollection = client.db('iham-computer-clinic').collection('services');
    const orderCollection = client.db('iham-computer-clinic').collection('orders');
    const userCollection = client.db('iham-computer-clinic').collection('users');
    const reviewCollection = client.db('iham-computer-clinic').collection('reviews');
    // const doctorCollection = client.db('doctors_portal').collection('doctors');
    // const paymentCollection = client.db('doctors_portal').collection('payments');

    //__________________________________/
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: requester });
      if (requesterAccount.role === 'admin') {
        next();
      }
      else {
        res.status(403).send({ message: 'forbidden' });
      }
    }


    //* * * * * * * * * * * * * * * * * * * * * * * * * * * * *  * * * * * * * * * * * * * * * * *//
    //all services
    app.get('/services', async (req, res) => {
      const query = {};
      const result = await serviceCollection.find(query).toArray();
      res.send(result)
    })

    app.post('/services', async (req, res) => {
      const product = req.body;
      const result = await serviceCollection.insertOne(product);
      res.send({ success: true })
    })

    //delete product
    app.delete('/service/:id', async (req, res) => {
      const id = req.params.id;
      const result = await serviceCollection.deleteOne({ _id: ObjectId(id) });
      res.send({ success: true })
    })

    //single service
    app.get('/purchase/:id', async (req, res) => {
      const { id } = req.params;
      const query = { _id: ObjectId(id) };
      const result = await serviceCollection.findOne(query)
      res.send(result);
    });

    //update service
    app.put('/purchase/:id', async (req, res) => {
      const { id } = req.params;
      const query = { _id: ObjectId(id) };
      const newService = req.body;
      const { available } = newService;
      const options = { upsert: true };
      const updateDoc = {
        $set: { available },
      };
      const result = await serviceCollection.updateOne(query, updateDoc, options);
      // const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET)
      // res.send({ result, token });
      res.send({ message: 'updated' });
    });

    //sending to orders db
    app.post('/orders', async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send({ success: true });
      // console.log('sending email');
      // sendAppointmentEmail(booking);
      // return 
    });

    //all orders for admin
    app.get('/all-orders', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await orderCollection.find({}).toArray();
      res.send(result);
    });
    //specific order by query 
    app.get('/orders', verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await orderCollection.find(query).toArray();
      res.send(result);
      // const decodedEmail = req.decoded.email;
      // if (email === decodedEmail) {
      //   const query = { patient: patient };
      //   const bookings = await orderCollection.find(query).toArray();
      //   return res.send(bookings);
      // }
      // else {
      //   return res.status(403).send({ message: 'forbidden access' });
      // }
    });

    //for user and setting up jwt
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET)
      res.send({ result, token });
    });

    //accessing an user
    app.get('/user', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    //adding more info of an user
    app.put('/user-update/:email', async (req, res) => {
      const email = req.params.email;
      const userInfo = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: userInfo,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      // const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET)
      res.send({ success: true });
    });

    //delete order
    app.delete('/orders/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send({ success: true, result });
    })


    //adding review
    app.post('/add-review', verifyJWT, async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send({ success: true });
    })

    //get all reviews
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find({}).toArray();
      res.send(result);
    })


    //user admin or not
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin })
    })

    //getting all users for admin
    app.get('/all-users', verifyJWT, async (req, res) => {
      const users = await userCollection.find({}).toArray();
      res.send(users);
    });



    //making admind
    app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: 'admin' },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    //* * * * * * * * * * * * * * * * * * END  * * * * * * *  * * * * * * * * * * * * * * * * *//

    // const verifyAdmin = async (req, res, next) => {
    //   const requester = req.decoded.email;
    //   const requesterAccount = await userCollection.findOne({ email: requester });
    //   if (requesterAccount.role === 'admin') {
    //     next();
    //   }
    //   else {
    //     res.status(403).send({ message: 'forbidden' });
    //   }
    // }

    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({ clientSecret: paymentIntent.client_secret })
    });





    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin })
    })

    app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: 'admin' },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })



    // Warning: This is not the proper way to query multiple collection. 
    // After learning more about mongodb. use aggregate, lookup, pipeline, match, group
    app.get('/available', async (req, res) => {
      const date = req.query.date;

      // step 1:  get all services
      const services = await serviceCollection.find().toArray();

      // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
      const query = { date: date };
      const bookings = await orderCollection.find(query).toArray();

      // step 3: for each service
      services.forEach(service => {
        // step 4: find bookings for that service. output: [{}, {}, {}, {}]
        const serviceBookings = bookings.filter(book => book.treatment === service.name);
        // step 5: select slots for the service Bookings: ['', '', '', '']
        const bookedSlots = serviceBookings.map(book => book.slot);
        // step 6: select those slots that are not in bookedSlots
        const available = service.slots.filter(slot => !bookedSlots.includes(slot));
        //step 7: set available to slots to make it easier 
        service.slots = available;
      });


      res.send(services);
    })

    /**
     * API Naming Convention
     * app.get('/booking') // get all bookings in this collection. or get more than one or by filter
     * app.get('/booking/:id') // get a specific booking 
     * app.post('/booking') // add a new booking
     * app.patch('/booking/:id) //
     * app.put('/booking/:id') // upsert ==> update (if exists) or insert (if doesn't exist)
     * app.delete('/booking/:id) //
    */



    app.get('/booking/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await orderCollection.findOne(query);
      res.send(booking);
    })

    app.patch('/booking/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }

      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await orderCollection.updateOne(filter, updatedDoc);
      res.send(updatedBooking);
    })

    app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
    })

    app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });

    app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await doctorCollection.deleteOne(filter);
      res.send(result);
    })

  }
  finally {

  }
}

run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello From Computer Clinic')
})

app.listen(port, () => {
  console.log(`Clinic listening on port ${port}`)
})
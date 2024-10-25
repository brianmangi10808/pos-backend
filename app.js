const express = require('express');
const app = express();
const cors = require('cors');
const axios = require('axios');
const port = 3000;
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const mysql = require('mysql');
const multer = require('multer');
const users = require("./routes/users");
const payment = require('./routes/payment');
const category= require('./routes/category');
const product= require('./routes/product');
const branches= require('./routes/branches');
const stock= require('./routes/stock');
const sales= require('./routes/sales');
const transactionRouter = require('./routes/transactionRouter');
const transfer= require('./routes/transfer');
const dashboard= require('./routes/dashboard');
const notification= require('./routes/notification');
const returns= require('./routes/returns');
const barcode= require('./routes/barcode');
const codelist= require('./routes/codelist');
const initialization= require('./routes/initialization');
const invoice= require('./routes/invoice');
const purchase= require('./routes/purchase');


//Middleware for parsing JSON data
app.use(express.json());



const allowedOrigins = [
 'http://localhost:5173',
  'https://pos-frontend-alpha.vercel.app'
];

// 2. Configure CORS options
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      // Allow the request if origin is allowed or not provided (like in Postman)
      callback(null, true);
    } else {
      // Block the request if origin is not in the allowed list
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Specify allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
  credentials: true,  // Allow credentials such as cookies to be sent with requests
  optionsSuccessStatus: 200,  // Some browsers choke on status 204 for OPTIONS
};

// 3. Apply CORS middleware to all routes
app.use(cors(corsOptions));

// 4. Handle preflight requests (OPTIONS)
app.options('*', cors(corsOptions));





app.use('/api', users);
app.use('/api', barcode);
app.use('/api', purchase);
app.use('/api/', payment);
app.use('/api/', codelist);
app.use('/api/', category);
app.use('/api/', invoice);
app.use('/api/', product);
app.use('/api/', dashboard);
app.use('/api/', transfer);
app.use('/api/', branches);
app.use('/api/', stock);
app.use('/api/', sales);
app.use('/api/', initialization);

initialization
app.use('/api/', notification);
app.use('/api/', returns);
app.use('/api', transactionRouter);


// Start Server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

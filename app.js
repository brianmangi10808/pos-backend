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




const corsOptions = {
  origin: 'http://localhost:5173', // Adjust this to your client’s origin
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));




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

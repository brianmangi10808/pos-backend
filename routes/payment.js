const express = require('express');
const router = express.Router();
const db = require('../db');
const axios = require('axios');

router.use(express.json());


// M-Pesa credentials
const consumerKey = 'MwMVgmtop01pZzBmaDJlONJ3MWWD4pKcRuXRGi44S1Eio32B';
const consumerSecret = 'hql5633lzIOLsDsIg3xo8qbgXgSjdqFdIt88e2ARt7eqWts8vFFd6pAIcm02cYfe';
const shortCode = '600982';
const passKey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const callbackUrl = 'https://e38a-102-217-64-50.ngrok-free.app/mpesa/callback';

// Function to get the current timestamp
const getTimestamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
  
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  };
  
  // Function to get OAuth token
  const getToken = async () => {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    try {
      const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
        headers: {
          Authorization: `Basic ${auth}`
        }
      });
      const token = response.data.access_token;
      console.log('Access Token:', token); // Print the token to the terminal
      return token;
    } catch (error) {
      console.error('Error obtaining token:', error.response ? error.response.data : error.message);
    }
  };
  
  // Function to initiate STK Push
  const initiateSTKPush = async (amount, phoneNumber, accountReference) => {
    const token = await getToken();
    const timestamp = getTimestamp();
    const password = Buffer.from(`${shortCode}${passKey}${timestamp}`).toString('base64');
  
    const data = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: parseInt(amount, 10),
      PartyA: phoneNumber,
      PartyB:shortCode ,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: 'Payment Description'
    };
  
    try {
      const response = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', data, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('STK Push Response:', response.data);
    } catch (error) {
      console.error('Error initiating STK Push:', error.response ? error.response.data : error.message);
    }
  };
  
  // Endpoint to handle M-Pesa STK Push request
router.post('/mpesa/pay', async (req, res) => {
    const { amount, phoneNumber, accountReference } = req.body;
  
    if (!amount || !phoneNumber || !accountReference) {
      return res.status(400).send('Missing required fields');
    }
  
    try {
      await initiateSTKPush(amount, phoneNumber, accountReference);
      res.send('STK Push initiated');
    } catch (error) {
      res.status(500).send('Error initiating STK Push');
    }
  });
  
  // Endpoint to handle M-Pesa callback

router.post('/callback', async (req, res) => {
  console.log('Callback received:', JSON.stringify(req.body, null, 2)); // Log full callback data

  if (req.body && req.body.Body && req.body.Body.stkCallback) {
    const callbackData = req.body.Body.stkCallback;
    const items = callbackData.CallbackMetadata.Item;

    let amount, mpesaReceiptNumber, transactionDate, phoneNumber, resultCode;

    items.forEach(item => {
      switch (item.Name) {
        case 'Amount':
          amount = item.Value;
          break;
        case 'MpesaReceiptNumber':
          mpesaReceiptNumber = item.Value;
          break;
        case 'TransactionDate':
          transactionDate = item.Value;
          break;
        case 'PhoneNumber':
          phoneNumber = item.Value;
          break;
      }
    });

    // Check the result code
    resultCode = callbackData.ResultCode;
    if (resultCode === 0) {
      // Success
      console.log(`Payment successful:
        Amount: ${amount}
        Mpesa Receipt Number: ${mpesaReceiptNumber}
        Date: ${transactionDate}
        Phone Number: ${phoneNumber}
      `);
  
    
      // Log the phone number of the user who paid
      console.log(`User Phone Number: ${phoneNumber}`);

      // Insert payment data into MySQL
      const query = 'INSERT INTO payments (amount, mpesa_receipt_number, transaction_date, phone_number) VALUES (?, ?, ?, ?)';
      const values = [amount, mpesaReceiptNumber, transactionDate, phoneNumber];

      db.query(query, values, (err, result) => {
        if (err) {
          console.error('Error inserting payment data:', err);
          res.sendStatus(500); // Internal server error
          return;
        }
        console.log('Payment data inserted:', result);
        res.sendStatus(200); // OK
      });
    } else {
      // Payment failed
      console.log('Payment failed with result code:', resultCode);
      res.sendStatus(400); // Bad request
    }
  } else {
    console.error('Unexpected callback structure:', req.body);
    res.sendStatus(400); // Bad request
  }
});

// Route to fetch all payment records
router.get('/payments', (req, res) => {
  const query = 'SELECT * FROM payments';

  db.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching payment data:', err);
          return res.status(500).send('Error fetching payment data');
      }

      res.json(results);
  });
});
// Endpoint to check the transaction status
router.post('/mpesa/transactionstatus', async (req, res) => {
  const { transactionId } = req.body;

  if (!transactionId) {
      return res.status(400).send('Transaction ID is required');
  }

  try {
      const statusResponse = await checkTransactionStatus(transactionId);
      res.json(statusResponse); // Send the response back to the client
  } catch (error) {
      res.status(500).send('Error checking transaction status');
  }
});

// Endpoint to handle the result of transaction status query
router.post('/mpesa/transactionstatus/result', (req, res) => {
  console.log('Transaction Status Result received:', JSON.stringify(req.body, null, 2));
  // Process the result as needed
  res.sendStatus(200); // Acknowledge receipt of the callback
});

// Endpoint to handle timeout of transaction status query
router.post('/mpesa/transactionstatus/timeout', (req, res) => {
  console.log('Transaction Status Timeout received:', JSON.stringify(req.body, null, 2));
  // Handle the timeout scenario as needed
  res.sendStatus(200); // Acknowledge receipt of the callback
});



  

module.exports = router;
const express = require('express');
const router = express.Router();
const axios = require('axios');
const cron = require('node-cron');
const db = require('../db');

// Route for saving transaction data and submitting it to KRA API
router.post('/saveTrnsSalesOsdc', async (req, res) => {
    try {
      console.log('Received request:', req.body);
  
      // Define headers required by the KRA API
      const headers = {
        'TIN': 'P000000040A', 
        'bhfId': '00',
        'cmcKey': '6ACBED179F9F46C4B9BDABC1429B5AAA54144A915BB24063AAE3',
        'Content-Type': 'application/json'
      };
  
      // Try sending data to the KRA API
      const response = await axios.post('https://etims-api-sbx.kra.go.ke/etims-api/saveTrnsSalesOsdc', req.body, {
        headers: headers
      });
  
      // Log and return KRA API response
      console.log('KRA API response:', response.data);
      return res.json(response.data);
  
    } catch (error) {
      console.error('Error during API request:', error.response ? error.response.data : error.message);
  
      if (!error.response || error.response.status >= 500) {
        // If KRA server is down, store the invoice locally as 'pending'
        const invoiceData = req.body;
  
        const query = `INSERT INTO invoices (invcNo, data, status) VALUES (?, ?, 'pending')`;
        db.query(query, [invoiceData.invcNo, JSON.stringify(invoiceData)], (err, result) => {
          if (err) {
            console.error('Failed to store invoice locally:', err);
            return res.status(500).json({ error: 'Failed to store invoice locally' });
          }
          console.log('Invoice stored locally with status pending.');
          return res.status(200).json({ message: 'Invoice stored locally and will be retried later' });
        });
  
      } else {
        // If it's another error, respond with the error details
        res.status(500).json({
          error: 'Error during API request',
          details: error.response ? error.response.data : error.message,
          status: error.response ? error.response.status : null
        });
      }
    }
  });
  
  // Retry logic to submit pending invoices to KRA
  cron.schedule('*/10 * * * *', async () => {
    console.log('Retrying to submit pending invoices...');
  
    // Fetch all invoices marked as 'pending'
    const query = `SELECT * FROM invoices WHERE status = 'pending'`;
    db.query(query, async (err, invoices) => {
      if (err) {
        return console.error('Failed to fetch pending invoices:', err);
      }
  
      for (const invoice of invoices) {
        try {
          // Define headers required by the KRA API
          const headers = {
            'TIN': 'P000000040A',
            'bhfId': '00',
            'cmcKey': '6ACBED179F9F46C4B9BDABC1429B5AAA54144A915BB24063AAE3',
            'Content-Type': 'application/json'
          };
  
          // Try resending the invoice to the KRA API
          const response = await axios.post('https://etims-api-sbx.kra.go.ke/etims-api/saveTrnsSalesOsdc', JSON.parse(invoice.data), {
            headers: headers
          });
  
          // If successful, update the invoice status to 'submitted'
          const updateQuery = `UPDATE invoices SET status = 'submitted' WHERE id = ?`;
          db.query(updateQuery, [invoice.id], (err, result) => {
            if (err) {
              return console.error('Failed to update invoice status:', err);
            }
            console.log(`Invoice ${invoice.invcNo} successfully submitted to KRA.`);
          });
  
        } catch (error) {
           
                // Log full error details
                console.error('Error during API request:', error.response ? error.response.data : error.message);
                console.error('Error status:', error.response ? error.response.status : null);
                console.error('Error headers:', error.response ? error.response.headers : null);
            
                // Return a 500 response with error details
                res.status(500).json({
                  error: 'Error during API request',
                  details: error.response ? error.response.data : error.message,
                  status: error.response ? error.response.status : null,
                  headers: error.response ? error.response.headers : null
                });
            
          console.error(`Failed to submit invoice ${invoice.invcNo}:`, error.message);
        }
      }
    });
  });
  
module.exports = router;

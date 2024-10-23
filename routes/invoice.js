const express = require('express');
const router = express.Router();
const db = require('../db'); 
const axios = require('axios');  

// Fetch current invoice number from the database
router.get('/invoice-number', (req, res) => {
  db.query('SELECT current_invoice_number FROM invoice_numbers LIMIT 1', (error, result) => {
    if (error) {
      return res.status(500).json({ message: 'Error fetching invoice number' });
    }

    if (result.length > 0) {
      const invoiceNumber = result[0].current_invoice_number;
      res.json({ invoiceNumber });
    } else {
      res.status(404).json({ message: 'Invoice number not found' });
    }
  });
});

// Update invoice number in the database
router.post('/invoice-number/increment', (req, res) => {
  // Increment the invoice number
  db.query('UPDATE invoice_numbers SET current_invoice_number = current_invoice_number + 1', (error) => {
    if (error) {
      return res.status(500).json({ message: 'Error updating invoice number' });
    }

    // Fetch the updated invoice number
    db.query('SELECT current_invoice_number FROM invoice_numbers LIMIT 1', (error, result) => {
      if (error) {
        return res.status(500).json({ message: 'Error fetching updated invoice number' });
      }

      const newInvoiceNumber = result[0].current_invoice_number;
      res.json({ invoiceNumber: newInvoiceNumber });
    });
  });
});




module.exports = router;

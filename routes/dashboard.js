const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/transactions-per-day', (req, res) => {
    const query = `
      SELECT DATE(transaction_date) AS transaction_day, COUNT(*) AS total_transactions
      FROM transactions
      GROUP BY transaction_day
      ORDER BY transaction_day DESC;
    `;
  
    db.query(query, (err, results) => {
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).json({ error: 'Database query failed' });
      }
  
      res.json(results);
    });
  });

  module.exports = router;
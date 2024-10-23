const express = require('express');
const router = express.Router();
const db = require('../db'); // Assuming this is your database connection module

router.get('/transaction-details', (req, res) => {
    const query = `
        SELECT 
            t.id AS transaction_id,
            t.sku,
            t.quantity,
            t.transaction_date,
            t.customer_name,
            t.total_amount,
            t.payment_method,
            p.name AS product_name,
            p.description AS product_description
        FROM 
            transactions t
        JOIN 
            products p ON t.sku = p.sku
        WHERE 
            t.customer_name IS NOT NULL
            AND t.total_amount IS NOT NULL
        ORDER BY 
            t.transaction_date DESC;
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        res.status(200).json(results);
    });
});




module.exports = router;

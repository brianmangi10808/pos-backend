
const express = require('express');
const router = express.Router();
const db = require('../db');
const async = require('async');




router.post('/return-stock', (req, res) => {
    const { items, branchId, customerName } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array is required' });
    }
    if (!branchId) {
        return res.status(400).json({ error: 'Branch ID is required' });
    }

    let updatedQuantities = [];
    
    db.beginTransaction((transactionErr) => {
        if (transactionErr) {
            console.error('Transaction start error:', transactionErr);
            return res.status(500).json({ error: 'Database transaction error' });
        }

        const processReturnItem = (item, callback) => {
            const { productId, sku, quantity } = item;

            if (!productId || !sku || !quantity) {
                return callback(new Error('Product ID, SKU, and quantity are required'));
            }

            // Query to check current stock for the specific branch and product
            const query = 'SELECT quantity FROM branch_products WHERE product_id = ? AND branch_id = ?';
            db.query(query, [productId, branchId], (err, results) => {
                if (err) {
                    return callback(err);
                }
                if (results.length === 0) {
                    return callback(new Error(`Product with ID ${productId} not found in branch ${branchId}`));
                }

                const availableQuantity = results[0].quantity;
                const newQuantity = availableQuantity + quantity;  // Adding the returned quantity back to stock

                // Update the quantity in branch_products
                const updateQuery = 'UPDATE branch_products SET quantity = ? WHERE product_id = ? AND branch_id = ?';
                db.query(updateQuery, [newQuantity, productId, branchId], (updateErr) => {
                    if (updateErr) {
                        return callback(updateErr);
                    }

                    // Log the return transaction for this branch
                    const logReturnQuery = `
                        INSERT INTO transactions 
                        (product_id, sku, quantity, transaction_date, branch_id, customer_name, transaction_type)
                        VALUES (?, ?, ?, NOW(), ?, ?, 'return')
                    `;
                    db.query(logReturnQuery, [
                        productId, 
                        sku, 
                        quantity, 
                        branchId, 
                        customerName || null  // Set to NULL if customerName is not provided
                    ], (logErr) => {
                        if (logErr) {
                            return callback(logErr);
                        }

                        // Add the updated quantity to the response
                        updatedQuantities.push({
                            productId,
                            sku,
                            newQuantity
                        });

                        callback(null);  // Proceed to the next item
                    });
                });
            });
        };

        // Process each item being returned
        async.eachSeries(items, processReturnItem, (err) => {
            if (err) {
                console.error('Error processing return items:', err);
                return db.rollback(() => res.status(500).json({ error: err.message }));
            }

            // Commit the transaction after processing all items
            db.commit((commitErr) => {
                if (commitErr) {
                    console.error('Transaction commit error:', commitErr);
                    return db.rollback(() => res.status(500).json({ error: 'Transaction commit error' }));
                }

                // Return the updated stock quantities
                res.status(200).json({
                    message: 'Stock updated successfully after return',
                    updatedQuantities
                });
            });
        });
    });
});


module.exports = router;
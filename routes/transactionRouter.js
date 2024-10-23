const express = require('express');
const router = express.Router();
const async = require('async');
const db = require('../db');
const nodemailer = require('nodemailer');

// Endpoint to update stock
const stockThreshold = 9; // Admin-defined threshold for low stock, can be dynamic

// Helper function to create a notification
// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'brianmwangi10808@gmail.com', // Your email
        pass: 'trprfvtdjrvvnyhp' // Your Gmail app password
    }
});

// Helper function to create a notification and send email
const createNotification = (productId, branchId, message, callback) => {
    const notificationQuery = `
        INSERT INTO notifications (product_id, branch_id, message) 
        VALUES (?, ?, ?)
    `;
    db.query(notificationQuery, [productId, branchId, message], (err) => {
        if (err) {
            return callback(err);
        }

        // Email options
        const mailOptions = {
            from: 'brianmwangi10808@gmail.com',
            to: 'petermwangi10808@gmail.com', // Change to the desired recipient
            subject: 'Low Stock Alert',
            text: message
        };

        // Send email
        transporter.sendMail(mailOptions, (emailErr, info) => {
            if (emailErr) {
                console.error('Error sending email:', emailErr);
                return callback(emailErr);
            } else {
                console.log('Email sent: ' + info.response);
                callback(null); // Success
            }
        });
    });
};


router.post('/update-stock', (req, res) => {
    const { items, totalAmount, branchId, customerName, paymentMethod } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array is required' });
    }
    if (totalAmount === undefined) {
        return res.status(400).json({ error: 'Total amount is required' });
    }
    if (!branchId) {
        return res.status(400).json({ error: 'Branch ID is required' });
    }
    if (!paymentMethod) {
        return res.status(400).json({ error: 'Payment method is required' });
    }

    let remainingQuantities = [];
    let lowStockNotifications = []; // To store low stock notifications

    db.beginTransaction((transactionErr) => {
        if (transactionErr) {
            console.error('Transaction start error:', transactionErr);
            return res.status(500).json({ error: 'Database transaction error' });
        }

        const processItem = (item, callback) => {
            const { productId, sku, quantity } = item;

            if (!productId || !sku || !quantity) {
                console.error('Missing productId, sku, or quantity in item:', item);
                return callback(new Error('Product ID, SKU, and quantity are required'));
            }

            // Query to check stock for the specific branch and product
            const query = 'SELECT quantity FROM branch_products WHERE product_id = ? AND branch_id = ?';
            db.query(query, [productId, branchId], (err, results) => {
                if (err) {
                    return callback(err);
                }
                if (results.length === 0) {
                    return callback(new Error(`Product with ID ${productId} not found in branch ${branchId}`));
                }

                const availableQuantity = results[0].quantity;
                const newQuantity = availableQuantity - quantity;

                if (newQuantity < 0) {
                    return callback(new Error(`Insufficient quantity available for product ID ${productId} in branch ${branchId}`));
                }

                // Update the quantity in branch_products
                const updateQuery = 'UPDATE branch_products SET quantity = ? WHERE product_id = ? AND branch_id = ?';
                db.query(updateQuery, [newQuantity, productId, branchId], (updateErr) => {
                    if (updateErr) {
                        return callback(updateErr);
                    }

                    // Log the transaction for this branch
                    const logTransactionQuery = `
                        INSERT INTO transactions 
                        (product_id, sku, quantity, transaction_date, total_amount, branch_id, customer_name, payment_method)
                        VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)
                    `;
                    db.query(logTransactionQuery, [
                        productId, 
                        sku, 
                        quantity, 
                        totalAmount, 
                        branchId, 
                        customerName || null,  // Set to NULL if customerName is not provided
                        paymentMethod
                    ], (logErr) => {
                        if (logErr) {
                            return callback(logErr);
                        }

                        // Query to get branch and product names
                        const branchProductQuery = `
                            SELECT 
                                bp.quantity, 
                                p.name AS product_name, 
                                b.name AS branch_name
                            FROM 
                                branch_products bp
                            JOIN 
                                products p ON bp.product_id = p.id
                            JOIN 
                                branches b ON bp.branch_id = b.id
                            WHERE 
                                bp.product_id = ? AND bp.branch_id = ?
                        `;
                        db.query(branchProductQuery, [productId, branchId], (infoErr, infoResults) => {
                            if (infoErr) {
                                return callback(infoErr);
                            }
                            if (infoResults.length === 0) {
                                return callback(new Error(`No branch/product info found for product ID ${productId} in branch ${branchId}`));
                            }

                            const info = infoResults[0];

                            // Add the updated quantity and product/branch names to the array for response
                            remainingQuantities.push({
                                branchName: info.branch_name,
                                productName: info.product_name,
                                remainingQuantity: newQuantity
                            });

                            // Check if stock is below the threshold
                            if (newQuantity <= stockThreshold) {
                                const lowStockMessage = `HELLO STOCK LEVER FOR PRODUCT  ${info.product_name} IN YOUR STORE IS LOW  (Remaining: ${newQuantity}).`;
                                
                                // Create a low stock notification
                                createNotification(productId, branchId, lowStockMessage, (notificationErr) => {
                                    if (notificationErr) {
                                        console.error('Error creating notification:', notificationErr);
                                    } else {
                                        console.log('Low stock notification created for product', productId);
                                    }
                                });

                                // Add the notification to the response (optional)
                                lowStockNotifications.push({
                                    productId,
                                    message: lowStockMessage
                                });
                            }

                            // Proceed to the next item
                            callback(null);
                        });
                    });
                });
            });
        };

        // Process each item in the cart
        async.eachSeries(items, processItem, (err) => {
            if (err) {
                console.error('Error processing items:', err);
                return db.rollback(() => res.status(500).json({ error: err.message }));
            }

            // Commit the transaction after processing all items
            db.commit((commitErr) => {
                if (commitErr) {
                    console.error('Transaction commit error:', commitErr);
                    return db.rollback(() => res.status(500).json({ error: 'Transaction commit error' }));
                }

                // Return the updated stock quantities and any low stock notifications
                res.status(200).json({
                    message: 'Stock updated and transactions logged successfully for branch',
                    remainingQuantities: remainingQuantities,
                    lowStockNotifications: lowStockNotifications // Optional: Send low stock notifications in the response
                });
            });
        });
    });
});

// Endpoint to record a transaction
router.post('/transactions', (req, res) => {
    const { customerName, items, totalAmount, paymentMethod } = req.body;

    // Validate required fields
    if (!items || !totalAmount || !paymentMethod) {
        return res.status(400).json({ error: 'Items, total amount, and payment method are required' });
    }

    if (!Array.isArray(items) || items.some(item => !item.sku || !item.quantity)) {
        return res.status(400).json({ error: 'Each item must have a SKU and quantity' });
    }

    // Use 'Anonymous' if customerName is not provided
    const validatedCustomerName = customerName || 'Anonymous';

    db.beginTransaction((transactionErr) => {
        if (transactionErr) {
            console.error('Transaction start error:', transactionErr);
            return res.status(500).json({ error: 'Failed to start transaction' });
        }

        const insertTransactionQuery = `
            INSERT INTO transactions (sku, quantity, transaction_date, customer_name, total_amount, payment_method) 
            VALUES (?, ?, NOW(), ?, ?, ?)
        `;

        // Initialize an array to hold promises for inserted transaction IDs
        const transactionIds = [];

        const transactionPromises = items.map(item => {
            return new Promise((resolve, reject) => {
                db.query(insertTransactionQuery, [item.sku, item.quantity, validatedCustomerName, totalAmount, paymentMethod], (err, results) => {
                    if (err) {
                        return reject(err);
                    }
                    // Store the ID of the newly inserted transaction
                    transactionIds.push(results.insertId);
                    resolve();
                });
            });
        });

        Promise.all(transactionPromises)
            .then(() => {
                db.commit((commitErr) => {
                    if (commitErr) {
                        console.error('Transaction commit error:', commitErr);
                        return db.rollback(() => {
                            return res.status(500).json({ error: 'Failed to commit transaction' });
                        });
                    }
                    // Return the IDs of the recorded transactions
                    res.status(201).json({ message: 'Transactions recorded successfully', transactionIds });
                });
            })
            .catch(insertErr => {
                console.error('Transaction insert error:', insertErr);
                db.rollback(() => {
                    return res.status(500).json({ error: 'Failed to record transactions' });
                });
            });
    });
});

module.exports = router;

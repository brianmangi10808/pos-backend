const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware to check for required fields
const checkRequiredFields = (fields, req) => {
    for (const field of fields) {
        if (!req.body[field]) {
            return `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
        }
    }
    return null;
};

// Create Product with Barcode
router.post('/prodbar', async (req, res) => {
    const { barcode, name, description, price, quantity, category_id, sku } = req.body;

    const requiredFields = ['barcode', 'name', 'price', 'quantity', 'category_id', 'sku'];
    const missingFieldError = checkRequiredFields(requiredFields, req);
    if (missingFieldError) return res.status(400).json({ error: missingFieldError });

    const skuCheckQuery = 'SELECT COUNT(*) AS count FROM products WHERE sku = ?';
    db.query(skuCheckQuery, [sku], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results[0].count > 0) return res.status(400).json({ error: 'SKU already exists' });

        const query = `
            INSERT INTO products (barcode, name, description, price, quantity, category_id, sku)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        db.query(query, [barcode, name, description, price, quantity, category_id, sku], (err, results) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.status(201).json({ message: 'Product created', id: results.insertId });
        });
    });
});

// Get Product by Barcode
router.get('/prodbar/barcode/:barcode', (req, res) => {
    const { barcode } = req.params;
    const query = 'SELECT * FROM products WHERE barcode = ?';
    db.query(query, [barcode], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(404).json({ error: 'Product not found' });
        res.status(200).json(results[0]);
    });
});

// Search Products by Barcode
router.get('/prodbar/search/barcode/:barcode', (req, res) => {
    const { barcode } = req.params;
    const query = 'SELECT * FROM products WHERE barcode LIKE ?';
    db.query(query, [`%${barcode}%`], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(200).json(results);
    });
});

// Update Product by Barcode
router.put('/prodbar/barcode/:barcode', (req, res) => {
    const { barcode } = req.params;
    const { name, description, price, quantity, category_id, sku } = req.body;

    const requiredFields = ['name', 'price', 'quantity', 'category_id', 'sku'];
    const missingFieldError = checkRequiredFields(requiredFields, req);
    if (missingFieldError) return res.status(400).json({ error: missingFieldError });

    const query = `
        UPDATE products
        SET name = ?, description = ?, price = ?, quantity = ?, category_id = ?, sku = ?
        WHERE barcode = ?
    `;
    db.query(query, [name, description, price, quantity, category_id, sku, barcode], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
        res.status(200).json({ message: 'Product updated' });
    });
});

// Transfer Product by Barcode
router.post('/prodbar/transfer/barcode', (req, res) => {
    const { barcode, targetBranchId, transferQuantity } = req.body;

    if (!barcode || !targetBranchId || !transferQuantity || transferQuantity <= 0) {
        return res.status(400).json({ error: 'Barcode, Target Branch ID, and a positive Transfer Quantity are required' });
    }

    const checkBranchQuery = 'SELECT id FROM branches WHERE id = ?';
    db.query(checkBranchQuery, [targetBranchId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error checking branch existence' });
        if (results.length === 0) return res.status(400).json({ error: 'Target branch does not exist' });

        const decreaseMainBranchQuery = `
            UPDATE branch_products bp
            JOIN branches b ON bp.branch_id = b.id
            SET bp.quantity = bp.quantity - ?
            WHERE bp.product_id = (SELECT id FROM products WHERE barcode = ?) AND b.name = 'Main Branch' AND bp.quantity >= ?;
        `;
        db.query(decreaseMainBranchQuery, [transferQuantity, barcode, transferQuantity], (err, results) => {
            if (err) return res.status(500).json({ error: 'Error decreasing quantity in Main Branch' });
            if (results.affectedRows === 0) return res.status(400).json({ error: 'Not enough quantity in Main Branch' });

            const increaseTargetBranchQuery = `
                INSERT INTO branch_products (branch_id, product_id, quantity)
                VALUES ((SELECT id FROM branches WHERE id = ?), (SELECT id FROM products WHERE barcode = ?), ?)
                ON DUPLICATE KEY UPDATE quantity = quantity + ?;
            `;
            db.query(increaseTargetBranchQuery, [targetBranchId, barcode, transferQuantity, transferQuantity], (err) => {
                if (err) return res.status(500).json({ error: 'Error increasing quantity in target branch' });
                res.status(200).json({ message: 'Product transferred successfully' });
            });
        });
    });
});

// Checkout Route
router.post('/checkout', async (req, res) => {
    const { items } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items in the cart' });
    }

    const orderItems = items.map(item => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.price,
    }));

    const orderTotal = orderItems.reduce((total, item) => total + item.price * item.quantity, 0);

    // Begin a transaction
    db.beginTransaction((err) => {
        if (err) return res.status(500).json({ error: 'Transaction error' });

        const orderQuery = 'INSERT INTO orders (total_amount) VALUES (?)';
        db.query(orderQuery, [orderTotal], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    res.status(500).json({ error: 'Error creating order' });
                });
            }

            const orderId = result.insertId; // Get the order ID

            // Prepare inventory update queries
            const inventoryUpdates = orderItems.map(item => {
                return new Promise((resolve, reject) => {
                    const updateQuery = `
                        UPDATE products 
                        SET quantity = quantity - ? 
                        WHERE id = ?
                    `;
                    db.query(updateQuery, [item.quantity, item.productId], (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
            });

            // Execute all inventory updates
            Promise.all(inventoryUpdates)
                .then(() => {
                    const orderDetailsQuery = `
                        INSERT INTO order_details (order_id, product_id, quantity, price) 
                        VALUES ?
                    `;
                    const orderDetails = orderItems.map(item => [orderId, item.productId, item.quantity, item.price]);

                    db.query(orderDetailsQuery, [orderDetails], (err) => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ error: 'Error saving order details' });
                            });
                        }

                        db.commit((err) => {
                            if (err) {
                                return db.rollback(() => {
                                    res.status(500).json({ error: 'Transaction commit error' });
                                });
                            }

                            res.status(201).json({ message: 'Order created', orderId });
                        });
                    });
                })
                .catch((err) => {
                    db.rollback(() => {
                        res.status(500).json({ error: 'Error updating inventory' });
                    });
                });
        });
    });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db');


router.get('/notifications', (req, res) => {
    // Query to join notifications with products and branches tables
    const query = `
        SELECT 
            notifications.id,
            products.name AS product_name, 
            branches.name AS branch_name, 
            notifications.message,
            notifications.created_at
        FROM notifications
        JOIN products ON notifications.product_id = products.id
        JOIN branches ON notifications.branch_id = branches.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching notifications:', err);
            return res.status(500).json({ error: 'Failed to fetch notifications' });
        }

        res.status(200).json({
            message: 'Notifications fetched successfully',
            notifications: results
        });
    });
});

// Route to mark a notification as read
router.patch('/notifications/:id/read', (req, res) => {
    const { id } = req.params;

    console.log(`Marking notification ${id} as read`);

    const query = 'UPDATE notifications SET is_read = 1 WHERE id = ?';

    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error updating notification status:', err);
            return res.status(500).json({ error: 'Failed to update notification status', details: err.message });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.status(200).json({
            message: 'Notification marked as read successfully'
        });
    });
});


// Endpoint to get branch and product details
router.get('/branch-remaining', (req, res) => {
    const query = `
        SELECT 
            b.name AS branch_name, 
            p.name AS product_name, 
            bp.quantity AS remaining_quantity
        FROM 
            branch_products bp
        JOIN 
            products p ON bp.product_id = p.id
        JOIN 
            branches b ON bp.branch_id = b.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching branch and product details:', err);
            return res.status(500).json({ error: 'Database query error' });
        }

        res.status(200).json({
            message: 'Branch and product details fetched successfully',
            data: results
        });
    });
});


module.exports = router;
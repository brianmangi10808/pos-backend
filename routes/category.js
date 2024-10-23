const express = require('express');
const router = express.Router();
const db = require('../db');



// Create a New Category
router.post('/categories', (req, res) => {
    const { name, tax_rate } = req.body;

    if (!name || tax_rate === undefined) {
        return res.status(400).json({ error: 'Category name and tax rate are required' });
    }

    const query = 'INSERT INTO categories (name, tax_rate) VALUES (?, ?)';
    db.query(query, [name, tax_rate], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ message: 'Category created', id: results.insertId });
    });
});

// Update an Existing Category

router.put('/categories/:id', (req, res) => {
    const { id } = req.params;
    const { name, tax_rate } = req.body;

    if (!name || tax_rate === undefined) {
        return res.status(400).json({ error: 'Category name and tax rate are required' });
    }

    const query = 'UPDATE categories SET name = ?, tax_rate = ? WHERE id = ?';
    db.query(query, [name, tax_rate, id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.status(200).json({ message: 'Category updated' });
    });
});


// Delete a Category
router.delete('/categories/:id', (req, res) => {
    const { id } = req.params;

    const query = 'DELETE FROM categories WHERE id = ?';
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.status(200).json({ message: 'Category deleted' });
    });
});

// Get All Categories
router.get('/categories', (req, res) => {
    const query = 'SELECT * FROM categories';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(200).json(results);
    });
});

router.get('/products/details', (req, res) => {
    const query = `
        SELECT 
            d.id,
            d.product_id,
            p.name AS product_name,
            d.branch_id,
            b.name AS branch_name,
            d.detail_type,
            d.detail_description,
            d.detail_date,
            d.created_at,
            d.updated_at
        FROM details d
        JOIN products p ON d.product_id = p.id
        JOIN branches b ON d.branch_id = b.id
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
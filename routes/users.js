const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

// List of predefined admin emails
const adminEmails = ['brian@gmail.com', 'faith@gmail.com', 'sharon@gmail.com'];

// User Signup
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const role = adminEmails.includes(email) ? 'admin' : 'user';
        const query = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
        db.query(query, [name, email, hashedPassword, role], (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            console.log('User created:', { message: 'User created', role });
            res.status(201).json({ message: 'User created', role });
        });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// User Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = results[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Fetch products for the branch assigned to the user
        const branchId = user.branch_id; // assuming the branch ID is stored in the user record

        if (!branchId) {
            return res.status(403).json({ error: 'User is not assigned to any branch' });
        }

        const productsQuery = `
            SELECT p.id, p.name, p.description, p.selling_price, bp.quantity, c.name as category_name
            FROM branch_products bp
            INNER JOIN products p ON bp.product_id = p.id
            INNER JOIN categories c ON p.category_id = c.id
            WHERE bp.branch_id = ?

        `;

        db.query(productsQuery, [branchId], (productErr, products) => {
            if (productErr) {
                console.error('Database error:', productErr);
                return res.status(500).json({ error: 'Database error' });
            }

            res.status(200).json({
                message: 'Login successful',
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    branch_id: user.branch_id,
                },
                products: products // Return products from the user's branch
            });
        });
    });
});


// Get Signup Data
router.get('/signup-data', (req, res) => {
    const query = `
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, COUNT(*) as count
        FROM users
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
        ORDER BY date
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(200).json(results);
    });
});

router.get('/users', (req, res) => {
    const query = 'SELECT * FROM users';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(200).json(results);
    });
});

router.put('/users/:id/assign-branch', (req, res) => {
    const { id } = req.params;  // User ID
    const { branch_id } = req.body;  // Branch ID to assign

    if (!branch_id) {
        return res.status(400).json({ error: 'Branch ID is required' });
    }

    const query = 'UPDATE users SET branch_id = ? WHERE id = ?';
    db.query(query, [branch_id, id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ message: 'Branch assigned successfully' });
    });
});

router.get('/users-with-branches', (req, res) => {
    const query = `
        SELECT 
            u.id AS user_id, 
            u.name AS user_name, 
            u.email AS user_email, 
            u.role AS user_role, 
            b.id AS branch_id, 
            b.name AS branch_name, 
            b.location AS branch_location
        FROM 
            users u
        LEFT JOIN 
            branches b ON u.branch_id = b.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(200).json(results);
    });
});

router.get('/category-product', async (req, res) => {
    const branchId = req.query.branch_id;
  
    if (!branchId) {
      return res.status(400).json({ error: 'Branch ID is required' });
    }
  
    try {
      const productsQuery = `
        SELECT p.id, p.name, p.sku, p.description, p.selling_price, bp.quantity, c.name as category_name, c.tax_rate
        FROM branch_products bp
        INNER JOIN products p ON bp.product_id = p.id
        INNER JOIN categories c ON p.category_id = c.id
        WHERE bp.branch_id = ?`;
  
      db.query(productsQuery, [branchId], (err, results) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
  
        // You can further modify the products if needed
        res.status(200).json({ products: results });
      });
    } catch (error) {
      console.error('Server error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  

module.exports =router;
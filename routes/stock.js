const express = require('express');
const router = express.Router();
const db = require('../db');





router.get('/allocated-stocks', (req, res) => {
    const query = `
        SELECT
            bp.branch_id,
            b.name AS branch_name,
            bp.product_id,
            p.name AS product_name,
            bp.quantity,
            bp.category_id,
            c.name AS category_name
        FROM
            branch_products bpnpm s
        JOIN
            branches b ON bp.branch_id = b.id
        JOIN
            products p ON bp.product_id = p.id
        JOIN
            categories c ON bp.category_id = c.id;
    `;

    db.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching allocated stocks:', error);
            return res.status(500).send({ success: false, error: 'Internal Server Error' });
        }
        res.status(200).json(results);
    });
});
router.get('/aggregated-quantities', (req, res) => {
    const query = `
        SELECT 
    b.name AS branch_name,
    p.name AS product_name,
    SUM(
        CAST(
            TRIM(
                LEADING ' ' FROM
                SUBSTRING_INDEX(
                    SUBSTRING_INDEX(d.detail_description, ' ', -2), 
                    ' ', 1
                )
            ) AS UNSIGNED
        )
    ) AS total_quantity
FROM 
    details d
JOIN 
    branches b ON d.branch_id = b.id
JOIN
    products p ON d.product_id = p.id
GROUP BY 
    b.name, p.name
ORDER BY 
    b.name, p.name;

    `;
  
    db.query(query, (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: 'Database query error' });
        }
        res.json(results);
    });
  });
  




module.exports = router;
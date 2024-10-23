const express = require('express');
const router = express.Router();
const db = require('../db');


// Endpoint to handle logging of details
router.post('/products/details', (req, res) => {
    const { productId, branchId, detailType, detailDescription, detailDate } = req.body;
  
    if (!productId || !branchId || !detailType || !detailDescription || !detailDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
  
    const query = `
      INSERT INTO details (product_id, branch_id, detail_type, detail_description, detail_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;
  
    db.query(query, [productId, branchId, detailType, detailDescription, detailDate], (err, result) => {
      if (err) {
        console.error('Error inserting details:', err);
        return res.status(500).json({ error: 'Database error' });
      }
  
      res.status(200).json({ message: 'Details recorded successfully' });
    });
  });
  
// Add this to your existing router file

// Endpoint to fetch details
router.get('/products/details', async (req, res) => {
  try {
    const details = await Detail.findAll(); // Adjust based on your ORM, e.g., Sequelize
    if (!details.length) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(details);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});







module.exports = router;

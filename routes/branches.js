const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/branches', (req, res) => {
    db.query('SELECT * FROM branches', (err, results) => {
      if (err) {
        return res.status(500).json(err);
      }
      res.json(results);
    });
  });
  
  router.get('/branches/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM branches WHERE id = ?', [id], (err, result) => {
      if (err) {
        return res.status(500).json(err);
      }
      res.json(result[0]);
    });
  });
  
 router.post('/branches', (req, res) => {
    const { name, location } = req.body;
    db.query('INSERT INTO branches (name, location) VALUES (?, ?)', [name, location], (err, result) => {
      if (err) {
        return res.status(500).json(err);
      }
      res.json({ id: result.insertId, name, location });
    });
  });
  
  router.put('/branches/:id', (req, res) => {
    const { id } = req.params;
    const { name, location } = req.body;
    db.query('UPDATE branches SET name = ?, location = ? WHERE id = ?', [name, location, id], (err, result) => {
      if (err) {
        return res.status(500).json(err);
      }
      res.json({ message: 'Branch updated successfully' });
    });
  });
  
  router.delete('/branches/:id', (req, res) => {
      const branchId = req.params.id;
  
      // Delete stock allocations for the branch
      const deleteStockAllocationsQuery = 'DELETE FROM branch_products WHERE branch_id = ?';
  
      // Delete the branch
      const deleteBranchQuery = 'DELETE FROM branches WHERE id = ?';
  
      db.beginTransaction((err) => {
          if (err) return res.status(500).json({ error: 'Transaction error' });
  
          db.query(deleteStockAllocationsQuery, [branchId], (err, results) => {
              if (err) {
                  return db.rollback(() => {
                      console.error('Error deleting stock allocations:', err);
                      res.status(500).json({ error: 'Error deleting stock allocations' });
                  });
              }
  
              db.query(deleteBranchQuery, [branchId], (err, results) => {
                  if (err) {
                      return db.rollback(() => {
                          console.error('Error deleting branch:', err);
                          res.status(500).json({ error: 'Error deleting branch' });
                      });
                  }
  
                  db.commit((err) => {
                      if (err) {
                          return db.rollback(() => {
                              console.error('Transaction commit error:', err);
                              res.status(500).json({ error: 'Transaction commit error' });
                          });
                      }
  
                      res.status(200).json({ message: 'Branch and associated stock allocations deleted successfully' });
                  });
              });
          });
      });
  });
  


  

module.exports = router;
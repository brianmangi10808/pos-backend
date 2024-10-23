const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db');  // Callback-based MySQL connection


// Route to initialize the device
router.post('/initialize-device', (req, res) => {
    const { tin, bhfId, deviceSerialNo } = req.body;
  
    console.log('Received request:', { tin, bhfId, deviceSerialNo });
  
    if (!tin || !bhfId || !deviceSerialNo) {
      return res.status(400).json({ status: 'error', message: 'TIN, Branch ID, and Device Serial Number are required' });
    }
  
    // Check if the device exists in the database
    db.query('SELECT * FROM devices WHERE serial_number = ?', [deviceSerialNo], (err, deviceResult) => {
      if (err) {
        console.error('Error querying database:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }
  
      // If the device doesn't exist, insert it
      if (deviceResult.length === 0) {
        console.log('Device not found, inserting new device...');
        db.query('INSERT INTO devices (serial_number, initialized) VALUES (?, false)', [deviceSerialNo], (err, insertResult) => {
          if (err) {
            console.error('Error inserting new device:', err);
            return res.status(500).json({ status: 'error', message: 'Database error during insert' });
          }
  
          // After successful insert, initialize the device
          initializeDevice(tin, bhfId, deviceSerialNo, res);
        });
      } else {
        // If device exists, proceed with initialization
        initializeDevice(tin, bhfId, deviceSerialNo, res);
      }
    });
  });
  
  
  // Function to initialize the device via eTIMS API
function initializeDevice(tin, bhfId, deviceSerialNo, res) {
    axios.post('https://etims-api-sbx.kra.go.ke/etims-api/selectInitOsdcInfo', {
      tin: tin,
      bhfId: bhfId,
      dvcSrlNo: deviceSerialNo
    }
  ,
    {
      timeout: 50000 // 5 seconds timeout
  })
    .then(response => {
      console.log('eTIMS API response:', response.data);
  
      if (response.data.resultCd === '000') {
        // Update the device status in the database after successful initialization
        db.query('UPDATE devices SET initialized = TRUE, init_timestamp = NOW() WHERE serial_number = ?', [deviceSerialNo], (err, updateResult) => {
          if (err) {
            console.error('Error updating device status:', err);
            return res.status(500).json({ status: 'error', message: 'Database error during update' });
          }
  
          return res.json({ status: 'success', message: 'Device initialized successfully' });
        });
      } else if (response.data.resultMsg === 'This device is installed') {
        // Handle case where the device is already installed
        console.log('Device is already installed');
  
        // Mark the device as initialized in the local database
        db.query('UPDATE devices SET initialized = TRUE, init_timestamp = NOW() WHERE serial_number = ?', [deviceSerialNo], (err, updateResult) => {
          if (err) {
            console.error('Error updating device status:', err);
            return res.status(500).json({ status: 'error', message: 'Database error during update' });
          }
  
          return res.json({ status: 'success', message: 'Device is already installed and marked as initialized' });
        });
      } else {
        // Handle other API response errors
        return res.status(400).json({ status: 'error', message: response.data.resultMsg });
      }
    })
    .catch(error => {
      console.error('Error during eTIMS API request:', error);
      return res.status(500).json({ status: 'error', message: 'Error during eTIMS API initialization' });
    });
  }
  


  

module.exports = router;

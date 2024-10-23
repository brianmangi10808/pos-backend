const express = require('express');
const router = express.Router();
const db = require('../db'); 
const axios = require('axios');


const apiUrl = 'https://etims-api-sbx.kra.go.ke/etims-api/selectCodeList';
const headers = {
  cmcKey: '6ACBED179F9F46C4B9BDABC1429B5AAA54144A915BB24063AAE3',  // Replace with correct cmcKey
  bhfId: '00',  // Branch ID, ensure this is correct
  TIN: 'P000000040A',  // Correct Taxpayer Identification Number (TIN)
  'Content-Type': 'application/json'
};

router.post('/fetch-and-store-tax-codes', async (req, res) => {
    try {
      const requestBody = {
        tin: 'P000000040A',
        bhfId: '00',
        dvcSrlNo: '00000040A',
        lastReqDt: '20200101000000'  // Example date
      };
  
      // Fetch data from the API
      const response = await axios.post(apiUrl, requestBody, { headers, timeout: 60000 });
  
      console.log("API Response:", response.data);
  
      if (response.data && response.data.resultCd === '000' && response.data.data && response.data.data.clsList) {
        const clsList = response.data.data.clsList;
  
        // Filter the entries where cdCls is "04" (Taxation Type)
        const filteredEntries = clsList.filter(taxCode => taxCode.cdCls === "04");
  
        if (filteredEntries.length === 0) {
          return res.status(400).json({ message: 'No valid tax codes to store in the database' });
        }
  
        // Prepare the values for insertion into `tax_codes` from `dtlList`
        filteredEntries.forEach(async (taxCode) => {
          const dtlList = taxCode.dtlList;
  
          // Extract only the required fields from dtlList
          const values = dtlList.map(detail => [
            detail.cd,           // Corresponds to 'cd' column
            detail.cdNm,         // Corresponds to 'cdNm' column
           
            detail.userDfnCd1 || ''   // Corresponds to 'userDfnCd3' column (use empty string if null)
          ]);
  
          const insertQuery = `
            INSERT INTO tax_codes (cd, cdNm, userDfnCd1)
            VALUES ?
          `;
  
          // Insert the data in a single query
          db.query(insertQuery, [values], (err, result) => {
            if (err) {
              console.error('Error storing tax codes:', err);
              return res.status(500).json({ message: 'Database error while storing tax codes', error: err.message });
            }
            console.log('Tax codes stored successfully');
          });
        });
  
        res.status(200).json({ message: 'Selected tax codes successfully fetched and stored in the database' });
      } else {
        console.error('API Response Error:', response.data);
        res.status(400).json({ message: 'Invalid API response format', error: response.data.resultMsg });
      }
    } catch (error) {
      console.error('Error fetching or storing tax codes:', error);
      res.status(500).json({ message: 'Error fetching or storing tax codes', error: error.message });
    }
  });
  
  module.exports = router;
  

module.exports = router;

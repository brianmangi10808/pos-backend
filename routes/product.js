const express = require('express');
const router = express.Router();
const db = require('../db');
const sharp = require('sharp');

const multer = require('multer');

// Configure multer for file upload
const storage = multer.memoryStorage(); 
const upload = multer({ storage });
const axios = require('axios');

// Create Product

router.post('/products', upload.single('image'), async (req, res) => {
    const { name, description, buying_price, selling_price, quantity, category_id, sku } = req.body;
    let image = null;
    let image_type = 'image/jpeg'; // Store the image type as JPEG

    if (req.file) {
        try {
            image = await sharp(req.file.buffer).jpeg().toBuffer(); // Convert to JPEG format
        } catch (error) {
            console.error('Error processing image:', error);
            return res.status(500).json({ error: 'Error processing image' });
        }
    }

    if (!name || !buying_price || !selling_price || !quantity || !category_id || !sku) {
        return res.status(400).json({ error: 'Name, SKU, buying price, selling price, quantity, and category_id are required' });
    }

    const query = 'INSERT INTO products (name, description, buying_price, selling_price, quantity, category_id, sku, image, image_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(query, [name, description, buying_price, selling_price, quantity, category_id, sku, image, image_type], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const productId = results.insertId;

        // Insert product into the Main Branch's inventory
        const mainBranchQuery = `
            INSERT INTO branch_products (branch_id, product_id, quantity, category_id)
            SELECT b.id, ?, ?, ?
            FROM branches b
            WHERE b.name = 'Main Branch';
        `;

        db.query(mainBranchQuery, [productId, quantity, category_id], async (err) => {
            if (err) {
                console.error('Error inserting product into Main Branch:', err);
                return res.status(500).json({ error: 'Error inserting product into Main Branch' });
            }

            // Prepare KRA eTIMS API request
            const etimsApiUrl = 'https://etims-api-sbx.kra.go.ke/etims-api/saveItem';
            const etimsHeaders = {
                'Content-Type': 'application/json',
                'tin': 'P000000040A', 
                'bhfId': '00',
                'cmcKey': '6ACBED179F9F46C4B9BDABC1429B5AAA54144A915BB24063AAE3' 
            };

            // Prepare payload for eTIMS API
            const itemPayload = {
                "itemCd": sku,
                "itemClsCd": category_id,
                "itemTyCd": "1",
                "itemNm": name,
                "itemStdNm": null,
                "orgnNatCd": "KE",
                "pkgUnitCd": "NT",
                "qtyUnitCd": "U",
                "taxTyCd": "B",
                "btchNo": null,
                "bcd": null,
                "dftPrc": selling_price, // Use selling price for default price
                "grpPrcL1": selling_price,
                "grpPrcL2": selling_price,
                "grpPrcL3": selling_price,
                "grpPrcL4": selling_price,
                "grpPrcL5": null,
                "addInfo": name,
                "sftyQty": null,
                "isrcAplcbYn": "N",
                "useYn": "Y",
                "regrNm": "Admin",
                "regrId": "Admin",
                "modrNm": "Admin",
                "modrId": "Admin"
            };

            console.log("Sending data to KRA eTIMS API:");
            console.log("Headers:", etimsHeaders);
            console.log("Payload:", JSON.stringify(itemPayload, null, 2));

            try {
                const etimsResponse = await axios.post(etimsApiUrl, itemPayload, { headers: etimsHeaders });

                if (etimsResponse.status === 200) {
                    console.log("KRA eTIMS API Response:", etimsResponse.data);
                    return res.status(201).json({
                        message: 'Product created, added to Main Branch, and synced with eTIMS successfully',
                        id: productId,
                        kraResponse: etimsResponse.data
                    });
                } else {
                    console.error('Error saving item to eTIMS:', etimsResponse.data);
                    return res.status(500).json({ error: 'Error saving item to eTIMS', details: etimsResponse.data });
                }
            } catch (error) {
                console.error('eTIMS API error:', error);
                return res.status(500).json({ error: 'eTIMS API integration failed', details: error.message });
            }
        });
    });
});


//serving image
router.get('/products/:id/image', (req, res) => {
    const { id } = req.params;

    const query = 'SELECT image FROM products WHERE id = ?';
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const { image } = results[0];
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        res.setHeader('Content-Type', 'image/jpeg'); // Serve as JPEG
        res.send(image);
    });
});


//update

// Update Product
router.put('/products/:id', upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { name, description, buying_price, selling_price, quantity, category_id, sku } = req.body;
    let image = null;

    if (req.file) {
        try {
            image = await sharp(req.file.buffer).jpeg().toBuffer(); // Convert to JPEG format
        } catch (error) {
            console.error('Error processing image:', error);
            return res.status(500).json({ error: 'Error processing image' });
        }
    }

    if (!name || !buying_price || !selling_price || !quantity || !category_id || !sku) {
        return res.status(400).json({ error: 'Name, SKU, buying price, selling price, quantity, and category_id are required' });
    }

    const query = `
        UPDATE products 
        SET name = ?, description = ?, buying_price = ?, selling_price = ?, 
            quantity = ?, category_id = ?, sku = ?, image = ? 
        WHERE id = ?`;
    
    db.query(query, [name, description, buying_price, selling_price, quantity, category_id, sku, image, id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Update product in the Main Branch's inventory
        const updateBranchQuery = `
            UPDATE branch_products
            JOIN branches b ON branch_products.branch_id = b.id
            SET branch_products.quantity = ?, branch_products.category_id = ?
            WHERE branch_products.product_id = ? AND b.name = 'Main Branch';
        `;

        db.query(updateBranchQuery, [quantity, category_id, id], (err) => {
            if (err) {
                console.error('Error updating product in Main Branch:', err);
                return res.status(500).json({ error: 'Error updating product in Main Branch' });
            }
            res.status(200).json({ message: 'Product updated successfully in Main Branch' });
        });
    });
});


//geting product by id

router.get('/products/:id', (req, res) => {
    const { id } = req.params;

    const query = 'SELECT * FROM products WHERE id = ?';
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.status(200).json(results[0]);
    });
});

// Delete Product
// Delete Product
// Delete Branch Route
router.delete('/branches/:id', (req, res) => {
    const { id } = req.params;

    // Query to check if the branch is protected
    const checkQuery = 'SELECT protected FROM branches WHERE id = ?';

    db.query(checkQuery, [id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Branch not found' });
        }
        if (results[0].protected === 1) {
            return res.status(403).json({ error: 'Cannot delete the Main Branch because it is protected' });
        }

        // Proceed with deletion if not protected
        const deleteQuery = 'DELETE FROM branches WHERE id = ?';
        db.query(deleteQuery, [id], (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (results.affectedRows === 0) {
                return res.status(404).json({ error: 'Branch not found' });
            }
            res.status(200).json({ message: 'Branch deleted' });
        });
    });
});

// Get All Products
router.get('/products', (req, res) => {
    const query = 'SELECT * FROM products';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(200).json(results);
    });
});


// Get Products by Category
router.get('/categories/:category_id/products', (req, res) => {
    const { category_id } = req.params;

    const query = 'SELECT * FROM products WHERE category_id = ?';
    db.query(query, [category_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(200).json(results);
    });
});

// router.post('/products', upload.single('image'), async (req, res) => {
//     const { name, description, price, quantity, category_id, sku } = req.body;
    
//     // Check if SKU already exists
//     const skuCheckQuery = 'SELECT COUNT(*) AS count FROM products WHERE sku = ?';
//     db.query(skuCheckQuery, [sku], (err, results) => {
//         if (err) {
//             console.error('Database error:', err);
//             return res.status(500).json({ error: 'Database error' });
//         }
//         if (results[0].count > 0) {
//             return res.status(400).json({ error: 'SKU already exists' });
//         }

//         // Proceed with product creation
//         let image = null;
//         let image_type = 'image/jpeg'; // Store the image type as JPEG

//         if (req.file) {
//             try {
//                 image =  sharp(req.file.buffer).jpeg().toBuffer(); // Convert to JPEG format
//             } catch (error) {
//                 console.error('Error processing image:', error);
//                 return res.status(500).json({ error: 'Error processing image' });
//             }
//         }

//         const query = 'INSERT INTO products (name, description, price, quantity, category_id, sku, image, image_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
//         db.query(query, [name, description, price, quantity, category_id, sku, image, image_type], (err, results) => {
//             if (err) {
//                 console.error('Database error:', err);
//                 return res.status(500).json({ error: 'Database error' });
//             }
//             res.status(201).json({ message: 'Product created', id: results.insertId });
//         });
//     });
// });


// Get Product Details by Name (Case-Insensitive)
router.get('/api/products/details', async (req, res) => {
    const { productName } = req.query;

    if (!productName) {
        return res.status(400).json({ error: 'Product name is required' });
    }

    try {
        // Query to find the product and its quantity in the Main Branch, case-insensitively
        const findProductQuery = `
            SELECT p.id AS productId, p.name, p.selling_price, bp.quantity AS quantityInMainBranch
            FROM products p
            JOIN branch_products bp ON p.id = bp.product_id
            JOIN branches b ON bp.branch_id = b.id
            WHERE LOWER(p.name) = LOWER(?) AND b.name = 'Main Branch'
            LIMIT 1;
        `;

        const [productDetails] = await db.promise().query(findProductQuery, [productName]);

        if (productDetails.length === 0) {
            return res.status(404).json({ error: 'Product not found in Main Branch' });
        }

        // Return the product details
        res.status(200).json(productDetails[0]);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get Products by Category and Name (Case-Insensitive)
router.get('/prodcat', (req, res) => {
    const { productName, categoryId } = req.query;

    console.log('Received productName:', productName);
    console.log('Received categoryId:', categoryId);

    if (!categoryId) {
        return res.status(400).json({ error: 'Category ID is required' });
    }

    const findProductsQuery = `
        SELECT p.id AS productId, p.name, p.selling_price, bp.quantity AS quantityInMainBranch
        FROM products p
        JOIN branch_products bp ON p.id = bp.product_id
        JOIN branches b ON bp.branch_id = b.id
        WHERE LOWER(p.name) LIKE LOWER(?) AND p.category_id = ? AND b.name = 'Main Branch'
        LIMIT 10;
    `;

    db.query(findProductsQuery, [`%${productName}%`, categoryId], (err, products) => {
        if (err) {
            console.error('Database error details:', err.message);  // Log the specific error details
            return res.status(500).json({ error: 'Database error' });
        }

        if (products.length === 0) {
            return res.status(404).json({ error: 'No products found in Main Branch for the given category' });
        }

        res.status(200).json(products);
    });
});




router.post('/products/transfer', (req, res) => {
    const { productId, targetBranchId, transferQuantity } = req.body;

    if (!productId || !targetBranchId || !transferQuantity || transferQuantity <= 0) {
        return res.status(400).json({ error: 'Product ID, Target Branch ID, and a positive Transfer Quantity are required' });
    }

    // Check if the targetBranchId exists in the branches table
    const checkBranchQuery = 'SELECT id FROM branches WHERE id = ?';
    db.query(checkBranchQuery, [targetBranchId], (err, results) => {
        if (err) {
            console.error('Error checking branch existence:', err.message);
            return res.status(500).json({ error: `Error checking branch existence: ${err.message}` });
        }

        if (results.length === 0) {
            return res.status(400).json({ error: 'Target branch does not exist' });
        }

        // Decrease quantity in the Main Branch
        const decreaseMainBranchQuery = `
            UPDATE branch_products bp
            JOIN branches b ON bp.branch_id = b.id
            SET bp.quantity = bp.quantity - ?
            WHERE bp.product_id = ? AND b.name = 'Main Branch' AND bp.quantity >= ?;
        `;
        db.query(decreaseMainBranchQuery, [transferQuantity, productId, transferQuantity], (err, results) => {
            if (err) {
                console.error('Error decreasing quantity in Main Branch:', err);
                return res.status(500).json({ error: 'Error decreasing quantity in Main Branch' });
            }
            if (results.affectedRows === 0) {
                return res.status(404).json({ error: 'Insufficient quantity in Main Branch or product not found' });
            }

            // Increase quantity in the target branch
            const increaseTargetBranchQuery = `
                INSERT INTO branch_products (branch_id, product_id, quantity, category_id)
                SELECT ?, ?, ?, p.category_id
                FROM products p
                WHERE p.id = ?
                ON DUPLICATE KEY UPDATE branch_products.quantity = branch_products.quantity + VALUES(quantity);
            `;
            
            db.query(increaseTargetBranchQuery, [targetBranchId, productId, transferQuantity, productId], (err) => {
                if (err) {
                    console.error('Error increasing quantity in target branch:', err.message);
                    return res.status(500).json({ error: `Error increasing quantity in target branch: ${err.message}` });
                }
                res.status(200).json({ message: 'Product transferred successfully' });
            });
        });
    });
});


// Get Products by Branch
router.get('/branches/:branch_id/products', (req, res) => {
    const { branch_id } = req.params;

    const query = `
        SELECT p.id, p.name, p.description, p.selling_price, bp.quantity
        FROM branch_products bp
        INNER JOIN products p ON bp.product_id = p.id
        WHERE bp.branch_id = ?
    `;
    db.query(query, [branch_id], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(200).json(results);
    });
});


module.exports = router;
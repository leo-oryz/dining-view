-- Migration: Clean up header/total rows from product_sales and product_costs
-- These rows were accidentally imported from eat365 Sales By Item reports

-- 1. Remove header and total rows from product_sales
DELETE FROM product_sales
WHERE product_name IN ('SKU Name', 'Category', 'Total', 'Grand Total', '')
   OR product_name IS NULL;

-- 2. Remove header and total rows from product_costs
DELETE FROM product_costs
WHERE product_name IN ('SKU Name', 'Category', 'Total', 'Grand Total', '')
   OR product_name IS NULL;

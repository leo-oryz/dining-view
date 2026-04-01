# CSV/Excel Format Specifications

## eat365 Reports

### Sales Summary (.xlsx)
- **Header row**: 2 (rows 0-1 are metadata/period info)
- **Columns**: Date, Sales, Service Charge, Delivery Fee, Discount Amount, Refund, Net Sales, Pre Order Deposit, Pre Order Deposit Refund, Gift Card Refund, Rounding Differences, Tips, Customers, Avg. Spending, Table Turnover Rate, Cash Quantity, Cash NT$, Credit Quantity, Credit NT$, Total Tendered
- **Target**: `daily_sales`

### Hourly Sales Report (.xls)
- **Header row**: 0
- **Columns**: Time, Total Tendered, Net Sales, Net Sales%, Transaction Count, Transaction Count %, Customers, Average Sales, Quantity, Quantity %
- **Time format**: "10:00 - 11:00" → extract start hour
- **Skip**: "Total" row at end
- **Target**: `hourly_sales`

### Sales By Item (.xls)
- **Header row**: 1 (row 0 is period label)
- **Columns**: SKU Name, Category, Product Type, Sub Product Type, Product Code, Current Dine-in Price / Takeout Price, QTY Sold, Discount Amount, Sales Amount, Total Cost, Gross Profit, Gross Margin
- **Gross Margin**: percentage string "75%" → 0.75
- **Target**: `product_sales` + `product_costs`

### Transaction Report (.csv)
- **Header row**: 0
- **42 columns** including: Order Number, Order Type, Time, Tender, No. of guest, Sub-total(TWD), Discount(TWD), Order Total(TWD), Item Name, Item Type, Product Type, Item Amount(TWD), Item Quantity, Cost, Modifier Name, Modifier Value
- **Row types**: Order header (Item Type empty), line item (Item Type = "Single Item"), modifier rows
- **Target**: `order_items`

## Ocard Reports

### 儀表板 (.xlsx)
- **Sheet**: "明細" (Details)
- **Header row**: 2
- **Columns**: 日期, 來客人次, 新客人次, 熟客人次, 總會員數, 邀請會員數, 新會員數, 新可觸及會員數
- **Target**: `daily_sales` member fields (member_visits, new_members, regular_members, total_members, invited_members, new_reachable_members)

### 會員招募分析 (.csv)
- **Format**: Key-value pairs (2 columns), NOT tabular
- **Key metrics**: 總會員數, 期間新會員數, 會員招募轉換率, gender counts, age distribution, channel breakdown
- **Target**: `ocard_member_snapshots`

### 顧客消費分析 (.csv)
- **Format**: Key-value pairs (2 columns), NOT tabular
- **Key metrics**: 期間消費額, 期間消費人數, 期間消費次數, 平均客單價, 平均消費頻率, VIP tier counts
- **Target**: `ocard_member_snapshots`

### RFM 分析 (.csv)
- **Format**: Key-value pairs (2 columns), NOT tabular
- **Key metrics**: 期間消費人數, 平均客單價, 顧客總貢獻, 平均最後到訪天數, RFM segment counts (黃金客/一般客/沉睡客)
- **Target**: `ocard_rfm_snapshots`

### 商品銷售 (.csv)
- **Format**: Tabular CSV, 16 columns
- **Columns**: 名稱(customer), 手機號碼, 名稱.1(product), 商品編號, 會員等級, 性別, 年齡, 數量, 單價, 交易時間, 交易序號, 店家, 其他(category), 小計, 交易總計, 會員卡號
- **Phone format**: `="0912345678"` → strip `="` and `"`
- **Target**: `order_items` with source='ocard'

using Microsoft.Data.Sqlite;
using Newtonsoft.Json;

namespace SalvadoreXPOS.Services;

public class DatabaseService
{
    private string _connectionString = "";
    
    public async Task InitializeAsync()
    {
        var dbPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SalvadoreXPOS", "data.db"
        );
        Directory.CreateDirectory(Path.GetDirectoryName(dbPath)!);
        _connectionString = $"Data Source={dbPath}";
        
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var createTables = @"
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                sku TEXT,
                barcode TEXT,
                price REAL NOT NULL,
                cost REAL DEFAULT 0,
                stock INTEGER DEFAULT 0,
                min_stock INTEGER DEFAULT 0,
                category_id TEXT,
                image_url TEXT,
                active INTEGER DEFAULT 1,
                available_pos INTEGER DEFAULT 1,
                available_digital INTEGER DEFAULT 1,
                need_sync INTEGER DEFAULT 1,
                created_at TEXT,
                updated_at TEXT
            );
            
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                parent_id TEXT,
                sort_order INTEGER DEFAULT 0,
                active INTEGER DEFAULT 1,
                need_sync INTEGER DEFAULT 1,
                created_at TEXT,
                updated_at TEXT
            );
            
            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                address TEXT,
                rfc TEXT,
                credit_limit REAL DEFAULT 0,
                current_credit REAL DEFAULT 0,
                loyalty_points INTEGER DEFAULT 0,
                notes TEXT,
                active INTEGER DEFAULT 1,
                need_sync INTEGER DEFAULT 1,
                created_at TEXT,
                updated_at TEXT
            );
            
            CREATE TABLE IF NOT EXISTS sales (
                id TEXT PRIMARY KEY,
                receipt_number TEXT,
                customer_id TEXT,
                customer_name TEXT,
                subtotal REAL,
                tax REAL,
                discount REAL DEFAULT 0,
                total REAL,
                payment_method TEXT,
                amount_paid REAL,
                change_amount REAL,
                status TEXT DEFAULT 'completed',
                notes TEXT,
                need_sync INTEGER DEFAULT 1,
                created_at TEXT
            );
            
            CREATE TABLE IF NOT EXISTS sale_items (
                id TEXT PRIMARY KEY,
                sale_id TEXT,
                product_id TEXT,
                product_name TEXT,
                quantity INTEGER,
                unit_price REAL,
                discount REAL DEFAULT 0,
                total REAL,
                FOREIGN KEY(sale_id) REFERENCES sales(id)
            );
            
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            
            CREATE TABLE IF NOT EXISTS licenses (
                hardware_id TEXT PRIMARY KEY,
                license_key TEXT,
                activated_at TEXT,
                expires_at TEXT,
                is_active INTEGER DEFAULT 1
            );
        ";
        
        using var command = new SqliteCommand(createTables, connection);
        await command.ExecuteNonQueryAsync();
        
        // Datos por defecto
        await SeedDefaultDataAsync(connection);
    }
    
    private async Task SeedDefaultDataAsync(SqliteConnection connection)
    {
        var checkCmd = new SqliteCommand("SELECT COUNT(*) FROM categories", connection);
        var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
        
        if (count == 0)
        {
            var categories = new[]
            {
                ("cat_1", "Bebidas", "Refrescos, jugos, agua"),
                ("cat_2", "Comidas", "Comida preparada"),
                ("cat_3", "Postres", "Dulces y postres"),
                ("cat_4", "Snacks", "Botanas"),
                ("cat_5", "Entradas", "Entradas y aperitivos")
            };
            
            foreach (var (id, name, desc) in categories)
            {
                var cmd = new SqliteCommand(
                    "INSERT INTO categories (id, name, description, created_at, updated_at) VALUES (@id, @name, @desc, @now, @now)",
                    connection
                );
                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@name", name);
                cmd.Parameters.AddWithValue("@desc", desc);
                cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.ToString("o"));
                await cmd.ExecuteNonQueryAsync();
            }
        }
        
        // Seed demo products
        var checkProducts = new SqliteCommand("SELECT COUNT(*) FROM products", connection);
        var productCount = Convert.ToInt32(await checkProducts.ExecuteScalarAsync());
        
        if (productCount == 0)
        {
            var products = new[]
            {
                ("prod_1", "Coca Cola 600ml", 25.00m, 50, "Bebidas", "COCA600"),
                ("prod_2", "Hamburguesa Clasica", 89.00m, 30, "Comidas", "HAMB001"),
                ("prod_3", "Hamburguesa con Queso", 99.00m, 25, "Comidas", "HAMB002"),
                ("prod_4", "Agua Natural 500ml", 15.00m, 100, "Bebidas", "AGUA500"),
                ("prod_5", "Tacos de Asada (3)", 75.00m, 40, "Comidas", "TACO003"),
                ("prod_6", "Flan de Caramelo", 55.00m, 20, "Postres", "FLAN001"),
                ("prod_7", "Helado Vainilla", 45.00m, 15, "Postres", "HELA001"),
                ("prod_8", "Pizza Pepperoni", 145.00m, 20, "Comidas", "PIZZ001"),
                ("prod_9", "Jugo de Naranja", 35.00m, 30, "Bebidas", "JUGO001"),
                ("prod_10", "Papas Fritas", 40.00m, 50, "Snacks", "PAPA001"),
                ("prod_11", "Café Americano", 30.00m, 100, "Bebidas", "CAFE001")
            };
            
            foreach (var (id, name, price, stock, category, sku) in products)
            {
                var cmd = new SqliteCommand(@"
                    INSERT INTO products (id, name, price, stock, category_id, sku, active, available_pos, need_sync, created_at, updated_at) 
                    VALUES (@id, @name, @price, @stock, @category, @sku, 1, 1, 1, @now, @now)",
                    connection
                );
                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@name", name);
                cmd.Parameters.AddWithValue("@price", price);
                cmd.Parameters.AddWithValue("@stock", stock);
                cmd.Parameters.AddWithValue("@category", category);
                cmd.Parameters.AddWithValue("@sku", sku);
                cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.ToString("o"));
                await cmd.ExecuteNonQueryAsync();
            }
        }
        
        checkCmd = new SqliteCommand("SELECT COUNT(*) FROM settings", connection);
        count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
        
        if (count == 0)
        {
            var settings = new[]
            {
                ("business_name", "Mi Negocio"),
                ("tax_rate", "16"),
                ("receipt_counter", "1")
            };
            
            foreach (var (key, value) in settings)
            {
                var cmd = new SqliteCommand("INSERT INTO settings (key, value) VALUES (@key, @value)", connection);
                cmd.Parameters.AddWithValue("@key", key);
                cmd.Parameters.AddWithValue("@value", value);
                await cmd.ExecuteNonQueryAsync();
            }
        }
    }
    
    public async Task<string> GetCategoriesAsync()
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("SELECT * FROM categories WHERE active = 1", connection);
        var categories = new List<Dictionary<string, object>>();
        
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            categories.Add(ReadRow(reader));
        }
        
        return JsonConvert.SerializeObject(categories);
    }
    
    public async Task SaveCategoryAsync(string json)
    {
        var category = JsonConvert.DeserializeObject<Dictionary<string, object>>(json)!;
        
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var id = category.GetValueOrDefault("id")?.ToString() ?? Guid.NewGuid().ToString();
        var now = DateTime.UtcNow.ToString("o");
        
        var cmd = new SqliteCommand(@"
            INSERT OR REPLACE INTO categories (id, name, description, parent_id, sort_order, active, need_sync, created_at, updated_at)
            VALUES (@id, @name, @description, @parent_id, @sort_order, 1, 1, @now, @now)", connection);
        
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@name", category.GetValueOrDefault("name", ""));
        cmd.Parameters.AddWithValue("@description", category.GetValueOrDefault("description") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@parent_id", category.GetValueOrDefault("parent_id") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@sort_order", Convert.ToInt32(category.GetValueOrDefault("sort_order", 0)));
        cmd.Parameters.AddWithValue("@now", now);
        
        await cmd.ExecuteNonQueryAsync();
    }
    
    public async Task<string> GetProductsAsync()
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("SELECT * FROM products WHERE active = 1", connection);
        var products = new List<Dictionary<string, object>>();
        
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            products.Add(ReadRow(reader));
        }
        
        return JsonConvert.SerializeObject(products);
    }
    
    public async Task SaveProductAsync(string json)
    {
        var product = JsonConvert.DeserializeObject<Dictionary<string, object>>(json)!;
        
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var id = product.GetValueOrDefault("id")?.ToString() ?? Guid.NewGuid().ToString();
        var now = DateTime.UtcNow.ToString("o");
        
        var cmd = new SqliteCommand(@"
            INSERT OR REPLACE INTO products 
            (id, name, description, sku, barcode, price, cost, stock, min_stock, category_id, 
             image_url, active, available_pos, available_digital, need_sync, created_at, updated_at)
            VALUES 
            (@id, @name, @description, @sku, @barcode, @price, @cost, @stock, @min_stock, @category_id,
             @image_url, 1, 1, 1, 1, @now, @now)", connection);
        
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@name", product.GetValueOrDefault("name", ""));
        cmd.Parameters.AddWithValue("@description", product.GetValueOrDefault("description") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@sku", product.GetValueOrDefault("sku") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@barcode", product.GetValueOrDefault("barcode") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@price", Convert.ToDecimal(product.GetValueOrDefault("price", 0)));
        cmd.Parameters.AddWithValue("@cost", Convert.ToDecimal(product.GetValueOrDefault("cost", 0)));
        cmd.Parameters.AddWithValue("@stock", Convert.ToInt32(product.GetValueOrDefault("stock", 0)));
        cmd.Parameters.AddWithValue("@min_stock", Convert.ToInt32(product.GetValueOrDefault("min_stock", 0)));
        cmd.Parameters.AddWithValue("@category_id", product.GetValueOrDefault("category_id") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@image_url", product.GetValueOrDefault("image_url") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@now", now);
        
        await cmd.ExecuteNonQueryAsync();
    }
    
    public async Task<string> GetCustomersAsync()
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("SELECT * FROM customers WHERE active = 1", connection);
        var customers = new List<Dictionary<string, object>>();
        
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            customers.Add(ReadRow(reader));
        }
        
        return JsonConvert.SerializeObject(customers);
    }
    
    public async Task SaveCustomerAsync(string json)
    {
        var customer = JsonConvert.DeserializeObject<Dictionary<string, object>>(json)!;
        
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var id = customer.GetValueOrDefault("id")?.ToString() ?? Guid.NewGuid().ToString();
        var now = DateTime.UtcNow.ToString("o");
        
        var cmd = new SqliteCommand(@"
            INSERT OR REPLACE INTO customers 
            (id, name, email, phone, address, rfc, credit_limit, current_credit, 
             loyalty_points, notes, active, need_sync, created_at, updated_at)
            VALUES 
            (@id, @name, @email, @phone, @address, @rfc, @credit_limit, @current_credit,
             @loyalty_points, @notes, 1, 1, @now, @now)", connection);
        
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@name", customer.GetValueOrDefault("name", ""));
        cmd.Parameters.AddWithValue("@email", customer.GetValueOrDefault("email") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@phone", customer.GetValueOrDefault("phone") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@address", customer.GetValueOrDefault("address") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@rfc", customer.GetValueOrDefault("rfc") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@credit_limit", Convert.ToDecimal(customer.GetValueOrDefault("credit_limit", 0)));
        cmd.Parameters.AddWithValue("@current_credit", Convert.ToDecimal(customer.GetValueOrDefault("current_credit", 0)));
        cmd.Parameters.AddWithValue("@loyalty_points", Convert.ToInt32(customer.GetValueOrDefault("loyalty_points", 0)));
        cmd.Parameters.AddWithValue("@notes", customer.GetValueOrDefault("notes") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@now", now);
        
        await cmd.ExecuteNonQueryAsync();
    }
    
    public async Task<string> GetSalesAsync()
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("SELECT * FROM sales ORDER BY created_at DESC LIMIT 100", connection);
        var sales = new List<Dictionary<string, object>>();
        
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            sales.Add(ReadRow(reader));
        }
        
        return JsonConvert.SerializeObject(sales);
    }
    
    public async Task SaveSaleAsync(string json)
    {
        var sale = JsonConvert.DeserializeObject<Dictionary<string, object>>(json)!;
        
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var id = sale.GetValueOrDefault("id")?.ToString() ?? Guid.NewGuid().ToString();
        var now = DateTime.UtcNow.ToString("o");
        var receiptNumber = await GenerateReceiptNumberAsync(connection);
        
        var cmd = new SqliteCommand(@"
            INSERT INTO sales 
            (id, receipt_number, customer_id, customer_name, subtotal, tax, discount, total,
             payment_method, amount_paid, change_amount, status, notes, need_sync, created_at)
            VALUES 
            (@id, @receipt_number, @customer_id, @customer_name, @subtotal, @tax, @discount, @total,
             @payment_method, @amount_paid, @change_amount, @status, @notes, 1, @now)", connection);
        
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@receipt_number", receiptNumber);
        cmd.Parameters.AddWithValue("@customer_id", sale.GetValueOrDefault("customer_id") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@customer_name", sale.GetValueOrDefault("customer_name") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@subtotal", Convert.ToDecimal(sale.GetValueOrDefault("subtotal", 0)));
        cmd.Parameters.AddWithValue("@tax", Convert.ToDecimal(sale.GetValueOrDefault("tax", 0)));
        cmd.Parameters.AddWithValue("@discount", Convert.ToDecimal(sale.GetValueOrDefault("discount", 0)));
        cmd.Parameters.AddWithValue("@total", Convert.ToDecimal(sale.GetValueOrDefault("total", 0)));
        cmd.Parameters.AddWithValue("@payment_method", sale.GetValueOrDefault("payment_method", "cash"));
        cmd.Parameters.AddWithValue("@amount_paid", Convert.ToDecimal(sale.GetValueOrDefault("amount_paid", 0)));
        cmd.Parameters.AddWithValue("@change_amount", Convert.ToDecimal(sale.GetValueOrDefault("change_amount", 0)));
        cmd.Parameters.AddWithValue("@status", sale.GetValueOrDefault("status", "completed"));
        cmd.Parameters.AddWithValue("@notes", sale.GetValueOrDefault("notes") ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@now", now);
        
        await cmd.ExecuteNonQueryAsync();
        
        // Guardar items de la venta
        if (sale.TryGetValue("items", out var itemsObj) && itemsObj is Newtonsoft.Json.Linq.JArray items)
        {
            foreach (var item in items)
            {
                var itemCmd = new SqliteCommand(@"
                    INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, discount, total)
                    VALUES (@id, @sale_id, @product_id, @product_name, @quantity, @unit_price, @discount, @total)", connection);
                
                itemCmd.Parameters.AddWithValue("@id", Guid.NewGuid().ToString());
                itemCmd.Parameters.AddWithValue("@sale_id", id);
                itemCmd.Parameters.AddWithValue("@product_id", item["product_id"]?.ToString() ?? "");
                itemCmd.Parameters.AddWithValue("@product_name", item["product_name"]?.ToString() ?? "");
                itemCmd.Parameters.AddWithValue("@quantity", item["quantity"]?.ToObject<int>() ?? 1);
                itemCmd.Parameters.AddWithValue("@unit_price", item["unit_price"]?.ToObject<decimal>() ?? 0);
                itemCmd.Parameters.AddWithValue("@discount", item["discount"]?.ToObject<decimal>() ?? 0);
                itemCmd.Parameters.AddWithValue("@total", item["total"]?.ToObject<decimal>() ?? 0);
                
                await itemCmd.ExecuteNonQueryAsync();
            }
        }
    }
    
    private async Task<string> GenerateReceiptNumberAsync(SqliteConnection connection)
    {
        var getCmd = new SqliteCommand("SELECT value FROM settings WHERE key = 'receipt_counter'", connection);
        var counter = Convert.ToInt32(await getCmd.ExecuteScalarAsync() ?? 1);
        
        var receiptNumber = $"REC-{DateTime.Now:yyyyMMdd}-{counter:D4}";
        
        var updateCmd = new SqliteCommand("UPDATE settings SET value = @value WHERE key = 'receipt_counter'", connection);
        updateCmd.Parameters.AddWithValue("@value", (counter + 1).ToString());
        await updateCmd.ExecuteNonQueryAsync();
        
        return receiptNumber;
    }
    
    public async Task<string> GetSettingAsync(string key)
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("SELECT value FROM settings WHERE key = @key", connection);
        cmd.Parameters.AddWithValue("@key", key);
        
        var result = await cmd.ExecuteScalarAsync();
        return result?.ToString() ?? "";
    }
    
    public async Task SetSettingAsync(string key, string value)
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)", connection);
        cmd.Parameters.AddWithValue("@key", key);
        cmd.Parameters.AddWithValue("@value", value);
        
        await cmd.ExecuteNonQueryAsync();
    }
    
    public async Task<List<Dictionary<string, object>>> GetPendingSyncProductsAsync()
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("SELECT * FROM products WHERE need_sync = 1", connection);
        var items = new List<Dictionary<string, object>>();
        
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            items.Add(ReadRow(reader));
        }
        
        return items;
    }
    
    public async Task MarkProductSyncedAsync(string id)
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("UPDATE products SET need_sync = 0 WHERE id = @id", connection);
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync();
    }
    
    public async Task<List<Dictionary<string, object>>> GetPendingSyncSalesAsync()
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("SELECT * FROM sales WHERE need_sync = 1", connection);
        var items = new List<Dictionary<string, object>>();
        
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            items.Add(ReadRow(reader));
        }
        
        return items;
    }
    
    public async Task MarkSaleSyncedAsync(string id)
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("UPDATE sales SET need_sync = 0 WHERE id = @id", connection);
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync();
    }
    
    public async Task<List<Dictionary<string, object>>> GetPendingSyncCustomersAsync()
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("SELECT * FROM customers WHERE need_sync = 1", connection);
        var items = new List<Dictionary<string, object>>();
        
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            items.Add(ReadRow(reader));
        }
        
        return items;
    }
    
    public async Task MarkCustomerSyncedAsync(string id)
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("UPDATE customers SET need_sync = 0 WHERE id = @id", connection);
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync();
    }
    
    public async Task<List<Dictionary<string, object>>> GetPendingSyncCategoriesAsync()
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("SELECT * FROM categories WHERE need_sync = 1", connection);
        var items = new List<Dictionary<string, object>>();
        
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            items.Add(ReadRow(reader));
        }
        
        return items;
    }
    
    public async Task MarkCategorySyncedAsync(string id)
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        
        var cmd = new SqliteCommand("UPDATE categories SET need_sync = 0 WHERE id = @id", connection);
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync();
    }
    
    private Dictionary<string, object> ReadRow(SqliteDataReader reader)
    {
        var row = new Dictionary<string, object>();
        for (int i = 0; i < reader.FieldCount; i++)
        {
            row[reader.GetName(i)] = reader.IsDBNull(i) ? null! : reader.GetValue(i);
        }
        return row;
    }
}

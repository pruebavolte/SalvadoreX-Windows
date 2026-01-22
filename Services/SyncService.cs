using System.Net.Http.Json;
using Newtonsoft.Json;

namespace SalvadoreXPOS.Services;

public class SyncService
{
    private readonly DatabaseService _db;
    private CancellationTokenSource? _cts;
    private readonly int _syncIntervalSeconds = 30;
    
    public bool IsOnline { get; private set; }
    public bool IsSyncing { get; private set; }
    public DateTime? LastSyncTime { get; private set; }
    
    public event EventHandler<string>? StatusChanged;

    public SyncService(DatabaseService db)
    {
        _db = db;
    }

    public void StartBackgroundSync()
    {
        _cts = new CancellationTokenSource();
        Task.Run(() => BackgroundSyncLoop(_cts.Token));
    }

    public void StopBackgroundSync()
    {
        _cts?.Cancel();
    }

    private async Task BackgroundSyncLoop(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                IsOnline = await CheckInternetAsync();
                
                if (IsOnline)
                {
                    StatusChanged?.Invoke(this, "• En línea");
                    await SyncPendingChangesAsync();
                }
                else
                {
                    StatusChanged?.Invoke(this, "• Sin conexión (modo offline)");
                }
            }
            catch (Exception ex)
            {
                StatusChanged?.Invoke(this, $"• Error: {ex.Message}");
            }

            await Task.Delay(TimeSpan.FromSeconds(_syncIntervalSeconds), cancellationToken);
        }
    }

    private async Task<bool> CheckInternetAsync()
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var response = await client.GetAsync("https://www.google.com/generate_204");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    public async Task SyncPendingChangesAsync()
    {
        if (IsSyncing || !IsOnline) return;
        
        IsSyncing = true;
        StatusChanged?.Invoke(this, "• Sincronizando...");

        try
        {
            var supabaseUrl = await _db.GetSettingAsync("supabase_url");
            var supabaseKey = await _db.GetSettingAsync("supabase_key");
            
            if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(supabaseKey))
            {
                StatusChanged?.Invoke(this, "• Configuración de sync pendiente");
                return;
            }

            using var client = new HttpClient();
            client.DefaultRequestHeaders.Add("apikey", supabaseKey);
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {supabaseKey}");
            client.DefaultRequestHeaders.Add("Prefer", "resolution=merge-duplicates");

            int syncedCount = 0;
            int errorCount = 0;

            // Sync products
            var pendingProducts = await _db.GetPendingSyncProductsAsync();
            foreach (var product in pendingProducts)
            {
                try
                {
                    product.Remove("need_sync");
                    var json = JsonConvert.SerializeObject(product);
                    var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
                    var response = await client.PostAsync($"{supabaseUrl}/rest/v1/products", content);
                    
                    if (response.IsSuccessStatusCode)
                    {
                        await _db.MarkProductSyncedAsync(product["id"]?.ToString()!);
                        syncedCount++;
                    }
                    else
                    {
                        errorCount++;
                        var errorBody = await response.Content.ReadAsStringAsync();
                        StatusChanged?.Invoke(this, $"• Error producto: {errorBody.Substring(0, Math.Min(50, errorBody.Length))}");
                    }
                }
                catch (Exception ex) 
                { 
                    errorCount++;
                    StatusChanged?.Invoke(this, $"• Error: {ex.Message}");
                }
            }

            // Sync sales
            var pendingSales = await _db.GetPendingSyncSalesAsync();
            foreach (var sale in pendingSales)
            {
                try
                {
                    sale.Remove("need_sync");
                    var json = JsonConvert.SerializeObject(sale);
                    var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
                    var response = await client.PostAsync($"{supabaseUrl}/rest/v1/sales", content);
                    
                    if (response.IsSuccessStatusCode)
                    {
                        await _db.MarkSaleSyncedAsync(sale["id"]?.ToString()!);
                        syncedCount++;
                    }
                    else
                    {
                        errorCount++;
                    }
                }
                catch 
                { 
                    errorCount++;
                }
            }

            // Sync customers
            var pendingCustomers = await _db.GetPendingSyncCustomersAsync();
            foreach (var customer in pendingCustomers)
            {
                try
                {
                    customer.Remove("need_sync");
                    var json = JsonConvert.SerializeObject(customer);
                    var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
                    var response = await client.PostAsync($"{supabaseUrl}/rest/v1/customers", content);
                    
                    if (response.IsSuccessStatusCode)
                    {
                        await _db.MarkCustomerSyncedAsync(customer["id"]?.ToString()!);
                        syncedCount++;
                    }
                }
                catch { errorCount++; }
            }

            // Sync categories
            var pendingCategories = await _db.GetPendingSyncCategoriesAsync();
            foreach (var category in pendingCategories)
            {
                try
                {
                    category.Remove("need_sync");
                    var json = JsonConvert.SerializeObject(category);
                    var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
                    var response = await client.PostAsync($"{supabaseUrl}/rest/v1/categories", content);
                    
                    if (response.IsSuccessStatusCode)
                    {
                        await _db.MarkCategorySyncedAsync(category["id"]?.ToString()!);
                        syncedCount++;
                    }
                }
                catch { errorCount++; }
            }

            LastSyncTime = DateTime.Now;
            var statusMessage = syncedCount > 0 
                ? $"• Sincronizado ({syncedCount} cambios) - {LastSyncTime:HH:mm}" 
                : $"• En línea - {LastSyncTime:HH:mm}";
            if (errorCount > 0)
                statusMessage += $" ({errorCount} errores)";
            StatusChanged?.Invoke(this, statusMessage);
        }
        catch (Exception ex)
        {
            StatusChanged?.Invoke(this, $"• Error sync: {ex.Message}");
        }
        finally
        {
            IsSyncing = false;
        }
    }

    public Task ForceSyncNowAsync() => SyncPendingChangesAsync();
    
    public async Task SyncNowAsync()
    {
        IsOnline = await CheckInternetAsync();
        if (IsOnline)
        {
            await SyncPendingChangesAsync();
        }
        else
        {
            StatusChanged?.Invoke(this, "• Sin conexión (no se puede sincronizar)");
        }
    }
}

using System.Runtime.InteropServices;

namespace SalvadoreXPOS.Services;

[ClassInterface(ClassInterfaceType.AutoDual)]
[ComVisible(true)]
public class NativeBridge
{
    private readonly DatabaseService _db;
    private readonly SyncService _sync;
    private readonly LicensingService _licensing;
    
    public NativeBridge(DatabaseService db, SyncService sync)
    {
        _db = db;
        _sync = sync;
        _licensing = new LicensingService();
    }
    
    public bool IsOffline => !_sync.IsOnline;
    
    public string GetProducts()
    {
        return _db.GetProductsAsync().GetAwaiter().GetResult();
    }
    
    public void SaveProduct(string json)
    {
        _db.SaveProductAsync(json).GetAwaiter().GetResult();
    }
    
    public string GetCustomers()
    {
        return _db.GetCustomersAsync().GetAwaiter().GetResult();
    }
    
    public void SaveCustomer(string json)
    {
        _db.SaveCustomerAsync(json).GetAwaiter().GetResult();
    }
    
    public string GetSales()
    {
        return _db.GetSalesAsync().GetAwaiter().GetResult();
    }
    
    public void SaveSale(string json)
    {
        _db.SaveSaleAsync(json).GetAwaiter().GetResult();
    }
    
    public string GetSetting(string key)
    {
        return _db.GetSettingAsync(key).GetAwaiter().GetResult();
    }
    
    public void SetSetting(string key, string value)
    {
        _db.SetSettingAsync(key, value).GetAwaiter().GetResult();
    }
    
    public void SyncNow()
    {
        _sync.ForceSyncNowAsync().GetAwaiter().GetResult();
    }
    
    public string GetHardwareId()
    {
        return _licensing.GetHardwareId();
    }
    
    public string GetCategories()
    {
        return _db.GetCategoriesAsync().GetAwaiter().GetResult();
    }
    
    public void SaveCategory(string json)
    {
        _db.SaveCategoryAsync(json).GetAwaiter().GetResult();
    }
}

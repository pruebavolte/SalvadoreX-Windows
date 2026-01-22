using System.Management;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.Sqlite;

namespace SalvadoreXPOS.Services;

public class LicensingService
{
    private readonly string _dbPath;
    
    public LicensingService()
    {
        _dbPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SalvadoreXPOS", "license.db"
        );
        Directory.CreateDirectory(Path.GetDirectoryName(_dbPath)!);
        InitializeDatabase();
    }
    
    private void InitializeDatabase()
    {
        using var connection = new SqliteConnection($"Data Source={_dbPath}");
        connection.Open();
        
        var cmd = new SqliteCommand(@"
            CREATE TABLE IF NOT EXISTS licenses (
                hardware_id TEXT PRIMARY KEY,
                license_key TEXT,
                activated_at TEXT,
                expires_at TEXT,
                is_active INTEGER DEFAULT 1
            )", connection);
        cmd.ExecuteNonQuery();
    }
    
    public string GetHardwareId()
    {
        var components = new StringBuilder();
        
        // CPU ID
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT ProcessorId FROM Win32_Processor");
            foreach (ManagementObject obj in searcher.Get())
            {
                components.Append(obj["ProcessorId"]?.ToString() ?? "");
                break;
            }
        }
        catch { }
        
        // Motherboard Serial
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BaseBoard");
            foreach (ManagementObject obj in searcher.Get())
            {
                components.Append(obj["SerialNumber"]?.ToString() ?? "");
                break;
            }
        }
        catch { }
        
        // BIOS Serial
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS");
            foreach (ManagementObject obj in searcher.Get())
            {
                components.Append(obj["SerialNumber"]?.ToString() ?? "");
                break;
            }
        }
        catch { }
        
        // Disk Serial
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_DiskDrive WHERE Index = 0");
            foreach (ManagementObject obj in searcher.Get())
            {
                components.Append(obj["SerialNumber"]?.ToString() ?? "");
                break;
            }
        }
        catch { }
        
        // MAC Address (first network adapter)
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT MACAddress FROM Win32_NetworkAdapter WHERE PhysicalAdapter = True");
            foreach (ManagementObject obj in searcher.Get())
            {
                var mac = obj["MACAddress"]?.ToString();
                if (!string.IsNullOrEmpty(mac))
                {
                    components.Append(mac.Replace(":", "").Replace("-", ""));
                    break;
                }
            }
        }
        catch { }
        
        // Windows Product ID
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_OperatingSystem");
            foreach (ManagementObject obj in searcher.Get())
            {
                components.Append(obj["SerialNumber"]?.ToString() ?? "");
                break;
            }
        }
        catch { }
        
        // Generar hash del fingerprint
        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(components.ToString()));
        var hardwareId = BitConverter.ToString(hash).Replace("-", "").Substring(0, 32);
        
        return $"SVDX-{hardwareId.Substring(0, 8)}-{hardwareId.Substring(8, 8)}-{hardwareId.Substring(16, 8)}-{hardwareId.Substring(24, 8)}";
    }
    
    public bool ValidateLicense()
    {
        var hardwareId = GetHardwareId();
        
        using var connection = new SqliteConnection($"Data Source={_dbPath}");
        connection.Open();
        
        var cmd = new SqliteCommand(
            "SELECT license_key, expires_at, is_active FROM licenses WHERE hardware_id = @hwid",
            connection
        );
        cmd.Parameters.AddWithValue("@hwid", hardwareId);
        
        using var reader = cmd.ExecuteReader();
        if (reader.Read())
        {
            var isActive = reader.GetInt32(2) == 1;
            var expiresAt = reader.IsDBNull(1) ? (DateTime?)null : DateTime.Parse(reader.GetString(1));
            
            if (!isActive)
                return false;
            
            if (expiresAt.HasValue && expiresAt.Value < DateTime.UtcNow)
                return false;
            
            return true;
        }
        
        // Para desarrollo: auto-activar si no existe licencia
        // En producción, esto debería retornar false
#if DEBUG
        ActivateLicense(hardwareId, GenerateDevLicenseKey(hardwareId), null);
        return true;
#else
        return false;
#endif
    }
    
    public bool ActivateLicense(string hardwareId, string licenseKey, DateTime? expiresAt)
    {
        // Validar formato de licencia
        if (!ValidateLicenseKeyFormat(licenseKey))
            return false;
        
        // Verificar que la licencia corresponde al hardware
        if (!VerifyLicenseForHardware(hardwareId, licenseKey))
            return false;
        
        using var connection = new SqliteConnection($"Data Source={_dbPath}");
        connection.Open();
        
        var cmd = new SqliteCommand(@"
            INSERT OR REPLACE INTO licenses (hardware_id, license_key, activated_at, expires_at, is_active)
            VALUES (@hwid, @key, @activated, @expires, 1)",
            connection
        );
        
        cmd.Parameters.AddWithValue("@hwid", hardwareId);
        cmd.Parameters.AddWithValue("@key", licenseKey);
        cmd.Parameters.AddWithValue("@activated", DateTime.UtcNow.ToString("o"));
        cmd.Parameters.AddWithValue("@expires", expiresAt?.ToString("o") ?? (object)DBNull.Value);
        
        cmd.ExecuteNonQuery();
        return true;
    }
    
    public void DeactivateLicense()
    {
        var hardwareId = GetHardwareId();
        
        using var connection = new SqliteConnection($"Data Source={_dbPath}");
        connection.Open();
        
        var cmd = new SqliteCommand("UPDATE licenses SET is_active = 0 WHERE hardware_id = @hwid", connection);
        cmd.Parameters.AddWithValue("@hwid", hardwareId);
        cmd.ExecuteNonQuery();
    }
    
    private bool ValidateLicenseKeyFormat(string licenseKey)
    {
        // Formato: XXXX-XXXX-XXXX-XXXX-XXXX
        if (string.IsNullOrEmpty(licenseKey))
            return false;
        
        var parts = licenseKey.Split('-');
        if (parts.Length != 5)
            return false;
        
        return parts.All(p => p.Length == 4 && p.All(c => char.IsLetterOrDigit(c)));
    }
    
    private bool VerifyLicenseForHardware(string hardwareId, string licenseKey)
    {
        // En producción, esto verificaría con un servidor de licencias
        // Por ahora, verificamos que el hash del hardwareId esté en la licencia
        
        using var sha256 = SHA256.Create();
        var expectedHash = sha256.ComputeHash(
            Encoding.UTF8.GetBytes(hardwareId + "SALVADOREX_SECRET_KEY")
        );
        var expectedChecksum = BitConverter.ToString(expectedHash).Replace("-", "").Substring(0, 4);
        
        return licenseKey.StartsWith(expectedChecksum);
    }
    
    private string GenerateDevLicenseKey(string hardwareId)
    {
        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(
            Encoding.UTF8.GetBytes(hardwareId + "SALVADOREX_SECRET_KEY")
        );
        var key = BitConverter.ToString(hash).Replace("-", "");
        
        return $"{key.Substring(0, 4)}-{key.Substring(4, 4)}-{key.Substring(8, 4)}-{key.Substring(12, 4)}-{key.Substring(16, 4)}";
    }
    
    // Validación web de licencia
    public async Task<LicenseValidationResult> ValidateLicenseOnlineAsync(string licenseKey)
    {
        var hardwareId = GetHardwareId();
        
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            
            var content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(new
                {
                    hardware_id = hardwareId,
                    license_key = licenseKey,
                    app_version = "1.0.0",
                    platform = "windows"
                }),
                Encoding.UTF8,
                "application/json"
            );
            
            // URL de validación de licencias (configurar con tu servidor)
            var response = await client.PostAsync(
                "https://api.salvadorex.com/licenses/validate",
                content
            );
            
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                var result = System.Text.Json.JsonSerializer.Deserialize<LicenseResponse>(json);
                
                if (result?.valid == true)
                {
                    // Guardar licencia localmente
                    DateTime? expiresAt = null;
                    if (!string.IsNullOrEmpty(result.expires_at))
                    {
                        expiresAt = DateTime.Parse(result.expires_at);
                    }
                    
                    ActivateLicense(hardwareId, licenseKey, expiresAt);
                    
                    return new LicenseValidationResult
                    {
                        IsValid = true,
                        Message = result.message ?? "Licencia activada correctamente",
                        ExpiresAt = expiresAt
                    };
                }
                else
                {
                    return new LicenseValidationResult
                    {
                        IsValid = false,
                        Message = result?.message ?? "Licencia inválida"
                    };
                }
            }
            else
            {
                return new LicenseValidationResult
                {
                    IsValid = false,
                    Message = "Error al validar licencia con el servidor"
                };
            }
        }
        catch (Exception ex)
        {
            // Si no hay internet, validar localmente
            var isLocalValid = ValidateLicense();
            return new LicenseValidationResult
            {
                IsValid = isLocalValid,
                Message = isLocalValid 
                    ? "Licencia válida (modo offline)" 
                    : $"No se pudo verificar la licencia: {ex.Message}"
            };
        }
    }
    
    // Activar licencia desde archivo
    public async Task<LicenseValidationResult> ActivateLicenseFromFileAsync(string filePath)
    {
        try
        {
            if (!File.Exists(filePath))
            {
                return new LicenseValidationResult
                {
                    IsValid = false,
                    Message = "Archivo de licencia no encontrado"
                };
            }
            
            var content = await File.ReadAllTextAsync(filePath);
            var licenseData = System.Text.Json.JsonSerializer.Deserialize<LicenseFileData>(content);
            
            if (licenseData == null)
            {
                return new LicenseValidationResult
                {
                    IsValid = false,
                    Message = "Formato de archivo de licencia inválido"
                };
            }
            
            var hardwareId = GetHardwareId();
            
            // Verificar que la licencia sea para este hardware
            if (!string.IsNullOrEmpty(licenseData.hardware_id) && 
                licenseData.hardware_id != hardwareId)
            {
                return new LicenseValidationResult
                {
                    IsValid = false,
                    Message = "Esta licencia no corresponde a este equipo"
                };
            }
            
            // Validar firma de la licencia
            if (!ValidateLicenseSignature(licenseData))
            {
                return new LicenseValidationResult
                {
                    IsValid = false,
                    Message = "La firma de la licencia es inválida"
                };
            }
            
            DateTime? expiresAt = null;
            if (!string.IsNullOrEmpty(licenseData.expires_at))
            {
                expiresAt = DateTime.Parse(licenseData.expires_at);
                if (expiresAt < DateTime.UtcNow)
                {
                    return new LicenseValidationResult
                    {
                        IsValid = false,
                        Message = "La licencia ha expirado"
                    };
                }
            }
            
            ActivateLicense(hardwareId, licenseData.license_key!, expiresAt);
            
            return new LicenseValidationResult
            {
                IsValid = true,
                Message = "Licencia activada correctamente desde archivo",
                ExpiresAt = expiresAt
            };
        }
        catch (Exception ex)
        {
            return new LicenseValidationResult
            {
                IsValid = false,
                Message = $"Error al leer archivo de licencia: {ex.Message}"
            };
        }
    }
    
    private bool ValidateLicenseSignature(LicenseFileData data)
    {
        if (string.IsNullOrEmpty(data.signature) || string.IsNullOrEmpty(data.license_key))
            return false;
        
        using var sha256 = SHA256.Create();
        var expectedSignature = sha256.ComputeHash(
            Encoding.UTF8.GetBytes(
                $"{data.license_key}:{data.hardware_id}:{data.expires_at}:SALVADOREX_SIGNATURE_KEY"
            )
        );
        var expectedHex = BitConverter.ToString(expectedSignature).Replace("-", "").ToLower();
        
        return data.signature.ToLower() == expectedHex;
    }
    
    public LicenseInfo? GetLicenseInfo()
    {
        var hardwareId = GetHardwareId();
        
        using var connection = new SqliteConnection($"Data Source={_dbPath}");
        connection.Open();
        
        var cmd = new SqliteCommand(
            "SELECT license_key, activated_at, expires_at, is_active FROM licenses WHERE hardware_id = @hwid",
            connection
        );
        cmd.Parameters.AddWithValue("@hwid", hardwareId);
        
        using var reader = cmd.ExecuteReader();
        if (reader.Read())
        {
            return new LicenseInfo
            {
                HardwareId = hardwareId,
                LicenseKey = reader.GetString(0),
                ActivatedAt = DateTime.Parse(reader.GetString(1)),
                ExpiresAt = reader.IsDBNull(2) ? null : DateTime.Parse(reader.GetString(2)),
                IsActive = reader.GetInt32(3) == 1
            };
        }
        
        return null;
    }
}

public class LicenseValidationResult
{
    public bool IsValid { get; set; }
    public string Message { get; set; } = "";
    public DateTime? ExpiresAt { get; set; }
}

public class LicenseInfo
{
    public string HardwareId { get; set; } = "";
    public string LicenseKey { get; set; } = "";
    public DateTime ActivatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool IsActive { get; set; }
}

public class LicenseResponse
{
    public bool valid { get; set; }
    public string? message { get; set; }
    public string? expires_at { get; set; }
}

public class LicenseFileData
{
    public string? license_key { get; set; }
    public string? hardware_id { get; set; }
    public string? expires_at { get; set; }
    public string? signature { get; set; }
}

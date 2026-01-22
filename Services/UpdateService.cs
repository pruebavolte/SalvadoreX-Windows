using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;

namespace SalvadoreXPOS.Services;

public class UpdateService
{
    // Configuración de repositorio de GitHub para actualizaciones automáticas
    private const string GITHUB_REPO = "https://api.github.com/repos/pruebavolte/SalvadoreX-Unified";
    private const string GITHUB_RAW_BASE = "https://raw.githubusercontent.com/pruebavolte/SalvadoreX-Unified/main";
    
    private readonly string _localRepoPath;
    private readonly HttpClient _httpClient;
    
    public event EventHandler<string>? StatusChanged;
    public event EventHandler<UpdateInfo>? UpdateAvailable;
    
    public UpdateService()
    {
        _localRepoPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            "Documents", "GitHub", "SalvadoreX-Unified"
        );
        
        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "SalvadoreXPOS-Updater");
    }
    
    public async Task<bool> CheckForUpdatesAsync()
    {
        try
        {
            StatusChanged?.Invoke(this, "Buscando actualizaciones...");
            
            var versionPath = Path.Combine(AppContext.BaseDirectory, "version.txt");
            var currentVersion = File.Exists(versionPath) 
                ? await File.ReadAllTextAsync(versionPath) 
                : "0.0.0";
            
            var response = await _httpClient.GetStringAsync($"{GITHUB_REPO}/releases/latest");
            var releaseInfo = JsonSerializer.Deserialize<GitHubRelease>(response);
            
            if (releaseInfo != null && CompareVersions(releaseInfo.tag_name, currentVersion) > 0)
            {
                UpdateAvailable?.Invoke(this, new UpdateInfo
                {
                    CurrentVersion = currentVersion,
                    NewVersion = releaseInfo.tag_name,
                    ReleaseNotes = releaseInfo.body,
                    DownloadUrl = releaseInfo.assets?.FirstOrDefault()?.browser_download_url ?? ""
                });
                return true;
            }
            
            StatusChanged?.Invoke(this, "Aplicación actualizada");
            return false;
        }
        catch (Exception ex)
        {
            StatusChanged?.Invoke(this, $"Error: {ex.Message}");
            return false;
        }
    }
    
    public async Task<bool> UpdateWebAppFromGitHubAsync()
    {
        try
        {
            StatusChanged?.Invoke(this, "Descargando WebApp...");
            
            var webAppPath = Path.Combine(AppContext.BaseDirectory, "WebApp");
            Directory.CreateDirectory(webAppPath);
            
            var htmlContent = await _httpClient.GetStringAsync(
                $"{GITHUB_RAW_BASE}/SalvadoreXUnified/Windows/WebApp/index.html"
            );
            await File.WriteAllTextAsync(Path.Combine(webAppPath, "index.html"), htmlContent);
            
            var jsContent = await _httpClient.GetStringAsync(
                $"{GITHUB_RAW_BASE}/SalvadoreXUnified/Windows/WebApp/app.js"
            );
            await File.WriteAllTextAsync(Path.Combine(webAppPath, "app.js"), jsContent);
            
            StatusChanged?.Invoke(this, "WebApp actualizada");
            return true;
        }
        catch (Exception ex)
        {
            StatusChanged?.Invoke(this, $"Error actualizando: {ex.Message}");
            return false;
        }
    }
    
    public async Task<bool> GitPullAsync()
    {
        try
        {
            if (!Directory.Exists(_localRepoPath))
            {
                StatusChanged?.Invoke(this, "Repositorio local no encontrado");
                return false;
            }
            
            StatusChanged?.Invoke(this, "Ejecutando git pull...");
            
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "git",
                    Arguments = "pull origin main",
                    WorkingDirectory = _localRepoPath,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            
            process.Start();
            var output = await process.StandardOutput.ReadToEndAsync();
            var error = await process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();
            
            if (process.ExitCode == 0)
            {
                StatusChanged?.Invoke(this, "Actualización completada");
                await SyncWebAppFromRepoAsync();
                return true;
            }
            else
            {
                StatusChanged?.Invoke(this, $"Error git: {error}");
                return false;
            }
        }
        catch (Exception ex)
        {
            StatusChanged?.Invoke(this, $"Error: {ex.Message}");
            return false;
        }
    }
    
    public async Task SyncWebAppFromRepoAsync()
    {
        try
        {
            var repoWebAppPath = Path.Combine(_localRepoPath, "SalvadoreXUnified", "Windows", "WebApp");
            var appWebAppPath = Path.Combine(AppContext.BaseDirectory, "WebApp");
            
            if (Directory.Exists(repoWebAppPath))
            {
                Directory.CreateDirectory(appWebAppPath);
                
                foreach (var file in Directory.GetFiles(repoWebAppPath, "*.*", SearchOption.AllDirectories))
                {
                    var relativePath = Path.GetRelativePath(repoWebAppPath, file);
                    var destPath = Path.Combine(appWebAppPath, relativePath);
                    var destDir = Path.GetDirectoryName(destPath);
                    
                    if (!string.IsNullOrEmpty(destDir))
                        Directory.CreateDirectory(destDir);
                    
                    File.Copy(file, destPath, true);
                }
                
                StatusChanged?.Invoke(this, "WebApp sincronizada desde repositorio local");
            }
        }
        catch (Exception ex)
        {
            StatusChanged?.Invoke(this, $"Error sincronizando: {ex.Message}");
        }
    }
    
    private int CompareVersions(string v1, string v2)
    {
        v1 = v1.TrimStart('v', 'V');
        v2 = v2.TrimStart('v', 'V');
        
        var parts1 = v1.Split('.').Select(p => int.TryParse(p, out int n) ? n : 0).ToArray();
        var parts2 = v2.Split('.').Select(p => int.TryParse(p, out int n) ? n : 0).ToArray();
        
        for (int i = 0; i < Math.Max(parts1.Length, parts2.Length); i++)
        {
            int p1 = i < parts1.Length ? parts1[i] : 0;
            int p2 = i < parts2.Length ? parts2[i] : 0;
            
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }
        
        return 0;
    }
}

public class UpdateInfo
{
    public string CurrentVersion { get; set; } = "";
    public string NewVersion { get; set; } = "";
    public string ReleaseNotes { get; set; } = "";
    public string DownloadUrl { get; set; } = "";
}

public class GitHubRelease
{
    public string tag_name { get; set; } = "";
    public string body { get; set; } = "";
    public List<GitHubAsset>? assets { get; set; }
}

public class GitHubAsset
{
    public string browser_download_url { get; set; } = "";
}

using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using SalvadoreXPOS.Services;

namespace SalvadoreXPOS;

public partial class MainForm : Form
{
    private WebView2 webView;
    private readonly DatabaseService _db;
    private readonly SyncService _sync;
    private readonly UpdateService _update;
    private readonly StatusStrip _statusStrip;
    private readonly ToolStripStatusLabel _statusLabel;
    private readonly ToolStripStatusLabel _syncLabel;
    private readonly ToolStripStatusLabel _updateLabel;
    private readonly MenuStrip _menuStrip;
    
    public MainForm()
    {
        InitializeComponent();
        
        _db = new DatabaseService();
        _sync = new SyncService(_db);
        _update = new UpdateService();
        
        // Configurar forma
        this.Text = "SalvadoreX POS";
        this.Size = new Size(1366, 768);
        this.MinimumSize = new Size(1024, 600);
        this.StartPosition = FormStartPosition.CenterScreen;
        this.WindowState = FormWindowState.Maximized;
        
        // Menú principal
        _menuStrip = new MenuStrip();
        var archivoMenu = new ToolStripMenuItem("Archivo");
        archivoMenu.DropDownItems.Add("Sincronizar ahora", null, async (s, e) => await _sync.SyncNowAsync());
        archivoMenu.DropDownItems.Add(new ToolStripSeparator());
        archivoMenu.DropDownItems.Add("Salir", null, (s, e) => Application.Exit());
        
        var actualizarMenu = new ToolStripMenuItem("Actualizar");
        actualizarMenu.DropDownItems.Add("Buscar actualizaciones", null, async (s, e) => await CheckForUpdatesAsync());
        actualizarMenu.DropDownItems.Add("Descargar WebApp de GitHub", null, async (s, e) => await UpdateWebAppAsync());
        actualizarMenu.DropDownItems.Add("Git Pull (repositorio local)", null, async (s, e) => await GitPullAsync());
        
        var ayudaMenu = new ToolStripMenuItem("Ayuda");
        ayudaMenu.DropDownItems.Add("Acerca de", null, (s, e) => ShowAbout());
        
        _menuStrip.Items.Add(archivoMenu);
        _menuStrip.Items.Add(actualizarMenu);
        _menuStrip.Items.Add(ayudaMenu);
        this.MainMenuStrip = _menuStrip;
        this.Controls.Add(_menuStrip);
        
        // Barra de estado
        _statusStrip = new StatusStrip();
        _statusLabel = new ToolStripStatusLabel("Listo");
        _syncLabel = new ToolStripStatusLabel("• Sin conexión") { ForeColor = Color.Gray };
        _updateLabel = new ToolStripStatusLabel("") { ForeColor = Color.Blue };
        _statusStrip.Items.AddRange(new ToolStripItem[] { _statusLabel, new ToolStripStatusLabel() { Spring = true }, _updateLabel, _syncLabel });
        this.Controls.Add(_statusStrip);
        
        // WebView2
        webView = new WebView2
        {
            Dock = DockStyle.Fill
        };
        this.Controls.Add(webView);
        
        // Configurar eventos de UpdateService
        _update.StatusChanged += (s, msg) => 
        {
            this.Invoke(() => _updateLabel.Text = msg);
        };
        
        _update.UpdateAvailable += (s, info) =>
        {
            this.Invoke(() =>
            {
                var result = MessageBox.Show(
                    $"Nueva versión disponible: {info.NewVersion}\n\nVersión actual: {info.CurrentVersion}\n\n{info.ReleaseNotes}\n\n¿Desea actualizar ahora?",
                    "Actualización disponible",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Information
                );
                
                if (result == DialogResult.Yes)
                {
                    _ = UpdateWebAppAsync();
                }
            });
        };
        
        // Inicializar
        InitializeAsync();
    }
    
    private async void InitializeAsync()
    {
        try
        {
            // Inicializar base de datos
            await _db.InitializeAsync();
            
            // Inicializar WebView2
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SalvadoreXPOS", "WebView2Data"
            );
            Directory.CreateDirectory(userDataFolder);
            
            var environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await webView.EnsureCoreWebView2Async(environment);
            
            // Configurar WebView2
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.Settings.IsZoomControlEnabled = false;
            
            // Exponer API nativa a JavaScript
            webView.CoreWebView2.AddHostObjectToScript("nativeApi", new NativeBridge(_db, _sync));
            
            // Inyectar script para API nativa (usando proxy síncrono)
            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
                (function() {
                    const api = chrome.webview.hostObjects.sync.nativeApi;
                    window.NativeAPI = {
                        isOffline: function() { 
                            try { return api.IsOffline; } 
                            catch(e) { console.error('isOffline error:', e); return true; } 
                        },
                        getProducts: function() { 
                            try { return api.GetProducts(); } 
                            catch(e) { console.error('getProducts error:', e); return '[]'; } 
                        },
                        saveProduct: function(json) { 
                            try { api.SaveProduct(json); } 
                            catch(e) { console.error('saveProduct error:', e); } 
                        },
                        getCategories: function() { 
                            try { return api.GetCategories(); } 
                            catch(e) { console.error('getCategories error:', e); return '[]'; } 
                        },
                        saveCategory: function(json) { 
                            try { api.SaveCategory(json); } 
                            catch(e) { console.error('saveCategory error:', e); } 
                        },
                        getCustomers: function() { 
                            try { return api.GetCustomers(); } 
                            catch(e) { console.error('getCustomers error:', e); return '[]'; } 
                        },
                        saveCustomer: function(json) { 
                            try { api.SaveCustomer(json); } 
                            catch(e) { console.error('saveCustomer error:', e); } 
                        },
                        getSales: function() { 
                            try { return api.GetSales(); } 
                            catch(e) { console.error('getSales error:', e); return '[]'; } 
                        },
                        saveSale: function(json) { 
                            try { api.SaveSale(json); } 
                            catch(e) { console.error('saveSale error:', e); } 
                        },
                        getSetting: function(key) { 
                            try { return api.GetSetting(key); } 
                            catch(e) { console.error('getSetting error:', e); return ''; } 
                        },
                        setSetting: function(key, value) { 
                            try { api.SetSetting(key, value); } 
                            catch(e) { console.error('setSetting error:', e); } 
                        },
                        syncNow: function() { 
                            try { api.SyncNow(); } 
                            catch(e) { console.error('syncNow error:', e); } 
                        },
                        getHardwareId: function() { 
                            try { return api.GetHardwareId(); } 
                            catch(e) { console.error('getHardwareId error:', e); return 'ERROR'; } 
                        }
                    };
                    console.log('NativeAPI initialized with sync proxy');
                })();
            ");
            
            // Cargar aplicación web
            var webAppPath = Path.Combine(AppContext.BaseDirectory, "WebApp", "index.html");
            if (File.Exists(webAppPath))
            {
                webView.CoreWebView2.Navigate($"file:///{webAppPath.Replace('\\', '/')}");
            }
            else
            {
                // Si no hay web app local, cargar desde URL remota
                webView.CoreWebView2.Navigate("https://salvadorex.replit.app/dashboard");
            }
            
            // Iniciar sincronización en segundo plano
            _sync.StatusChanged += (s, msg) => 
            {
                this.Invoke(() => 
                {
                    _syncLabel.Text = msg;
                    _syncLabel.ForeColor = _sync.IsOnline ? Color.Green : Color.Gray;
                });
            };
            _sync.StartBackgroundSync();
            
            _statusLabel.Text = "Aplicación cargada";
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Error al inicializar: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
    
    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        _sync.StopBackgroundSync();
        base.OnFormClosing(e);
    }
    
    private async Task CheckForUpdatesAsync()
    {
        try
        {
            _statusLabel.Text = "Buscando actualizaciones...";
            await _update.CheckForUpdatesAsync();
            _statusLabel.Text = "Listo";
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Error al buscar actualizaciones: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
    
    private async Task UpdateWebAppAsync()
    {
        try
        {
            _statusLabel.Text = "Descargando actualización...";
            var success = await _update.UpdateWebAppFromGitHubAsync();
            
            if (success)
            {
                var result = MessageBox.Show(
                    "WebApp actualizada correctamente.\n\n¿Desea reiniciar la aplicación ahora?",
                    "Actualización completada",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question
                );
                
                if (result == DialogResult.Yes)
                {
                    Application.Restart();
                }
            }
            else
            {
                MessageBox.Show("No se pudo descargar la actualización.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            
            _statusLabel.Text = "Listo";
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Error al actualizar: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
    
    private async Task GitPullAsync()
    {
        try
        {
            _statusLabel.Text = "Ejecutando git pull...";
            var success = await _update.GitPullAsync();
            
            if (success)
            {
                var result = MessageBox.Show(
                    "Repositorio actualizado correctamente.\n\n¿Desea reiniciar la aplicación ahora?",
                    "Git Pull completado",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question
                );
                
                if (result == DialogResult.Yes)
                {
                    Application.Restart();
                }
            }
            
            _statusLabel.Text = "Listo";
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Error en git pull: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
    
    private void ShowAbout()
    {
        var hardwareId = new LicensingService().GetHardwareId();
        MessageBox.Show(
            $"SalvadoreX POS\n\nVersión: 1.0.0\n\nHardware ID:\n{hardwareId}\n\n© 2025 SalvadoreX",
            "Acerca de",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information
        );
    }
    
    private void InitializeComponent()
    {
        this.SuspendLayout();
        this.AutoScaleDimensions = new SizeF(7F, 15F);
        this.AutoScaleMode = AutoScaleMode.Font;
        this.ClientSize = new Size(1366, 768);
        this.Name = "MainForm";
        this.ResumeLayout(false);
    }
}

namespace SalvadoreXPOS;

static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        
        // Verificar licencia al iniciar
        var licensing = new Services.LicensingService();
        if (!licensing.ValidateLicense())
        {
            var result = MessageBox.Show(
                "Esta copia no está activada.\n\n" +
                $"ID de Hardware: {licensing.GetHardwareId()}\n\n" +
                "Contacte a su proveedor para activar el producto.",
                "Activación Requerida",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning
            );
            return;
        }
        
        Application.Run(new MainForm());
    }
}

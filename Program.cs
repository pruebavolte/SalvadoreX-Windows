namespace SalvadoreXPOS;

static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        
        // Iniciar aplicación
        try 
        {
            Application.Run(new MainForm());
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Error crítico al iniciar: {ex.Message}\n\nStack Trace: {ex.StackTrace}", "Error de Sistema", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}

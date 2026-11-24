using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Sugar Ants")]
[assembly: AssemblyDescription("Sugar Ants — Meditative Pixel-Art Ant Colony Game")]
[assembly: AssemblyCompany("GrAx Studio")]
[assembly: AssemblyProduct("Sugar Ants")]
[assembly: AssemblyVersion("1.3.1.0")]
[assembly: AssemblyFileVersion("1.3.1.0")]

namespace SugarAntsDesktop
{
    public class GameWindow : Form
    {
        private const string VirtualHost = "sugarants.app";
        private readonly string _webRoot;
        private readonly bool _selfTest;
        private readonly string _logPath;
        private WebView2 _webView;
        private bool _isFullscreen = false;
        private FormBorderStyle _prevBorderStyle;
        private FormWindowState _prevWindowState;
        private Rectangle _prevBounds;

        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        private void Log(string msg)
        {
            if (string.IsNullOrEmpty(_logPath)) return;
            try { File.AppendAllText(_logPath, DateTime.Now.ToString("HH:mm:ss.fff ") + msg + Environment.NewLine); } catch { }
        }

        public GameWindow(string webRoot, bool selfTest, string logPath)
        {
            _webRoot = webRoot;
            _selfTest = selfTest;
            _logPath = logPath;
            Log("GameWindow ctor");

            Text = "Sugar Ants";
            BackColor = Color.FromArgb(5, 15, 10);
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(1280, 800);
            MinimumSize = new Size(800, 540);
            KeyPreview = true;

            try
            {
                Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch { }

            if (_selfTest)
            {
                ShowInTaskbar = false;
                Opacity = 0.01;
            }

            _webView = new WebView2
            {
                Dock = DockStyle.Fill,
                DefaultBackgroundColor = Color.FromArgb(5, 15, 10)
            };
            Controls.Add(_webView);

            Load += async (s, e) => await InitWebViewAsync();
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            try
            {
                int dark = 1;
                // DWMWA_USE_IMMERSIVE_DARK_MODE (Windows 10 20H1+ & Windows 11)
                DwmSetWindowAttribute(Handle, 20, ref dark, sizeof(int));
            }
            catch { }
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (keyData == Keys.F11 || keyData == (Keys.Alt | Keys.Enter))
            {
                ToggleFullscreen();
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        private void ToggleFullscreen()
        {
            if (!_isFullscreen)
            {
                _prevBorderStyle = FormBorderStyle;
                _prevWindowState = WindowState;
                _prevBounds = Bounds;
                FormBorderStyle = FormBorderStyle.None;
                WindowState = FormWindowState.Normal;
                Bounds = Screen.FromControl(this).Bounds;
                _isFullscreen = true;
            }
            else
            {
                FormBorderStyle = _prevBorderStyle;
                Bounds = _prevBounds;
                WindowState = _prevWindowState;
                _isFullscreen = false;
            }
        }

        private async Task InitWebViewAsync()
        {
            try
            {
                string userDataDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "GrAxStudio",
                    "SugarAnts",
                    "WebView2"
                );
                Directory.CreateDirectory(userDataDir);

                Log("Creating CoreWebView2Environment...");
                var opts = new CoreWebView2EnvironmentOptions("--autoplay-policy=no-user-gesture-required");
                var env = await CoreWebView2Environment.CreateAsync(null, userDataDir, opts);
                Log("Environment created, calling EnsureCoreWebView2Async...");
                await _webView.EnsureCoreWebView2Async(env);
                Log("CoreWebView2 ready!");

                var core = _webView.CoreWebView2;
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.IsZoomControlEnabled = false;
                core.Settings.AreBrowserAcceleratorKeysEnabled = false;

                // Map local 'web' directory to clean HTTPS virtual host — ZERO localhost port, ZERO browser popup!
                core.SetVirtualHostNameToFolderMapping(
                    VirtualHost,
                    _webRoot,
                    CoreWebView2HostResourceAccessKind.Allow
                );

                // Keep all game navigation strictly inside the standalone window; only allow explicit Telegram click externally
                core.NewWindowRequested += (sender, args) =>
                {
                    args.Handled = true;
                    OpenAllowedExternal(args.Uri);
                };

                core.NavigationStarting += (sender, args) =>
                {
                    Log("NavigationStarting: " + args.Uri);
                    Uri u;
                    if (Uri.TryCreate(args.Uri, UriKind.Absolute, out u))
                    {
                        if (string.Equals(u.Scheme, "about", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(u.Scheme, "data", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(u.Scheme, "blob", StringComparison.OrdinalIgnoreCase))
                        {
                            return;
                        }
                        if (!string.Equals(u.Host, VirtualHost, StringComparison.OrdinalIgnoreCase))
                        {
                            args.Cancel = true;
                            if (args.IsUserInitiated)
                            {
                                OpenAllowedExternal(args.Uri);
                            }
                        }
                    }
                };

                if (_selfTest)
                {
                    core.NavigationCompleted += async (sender, args) =>
                    {
                        Log("NavigationCompleted: success=" + args.IsSuccess + " status=" + args.WebErrorStatus);
                        if (!args.IsSuccess)
                        {
                            Environment.ExitCode = 4;
                            Close();
                            return;
                        }
                        await Task.Delay(700);
                        string check = await core.ExecuteScriptAsync(
                            "(function(){return JSON.stringify({title:document.title,hasCanvas:!!document.getElementById('game-canvas'),hasMenu:!!document.getElementById('main-menu'),hasSpTimer:!!document.getElementById('stat-sp-timer')});})()"
                        );
                        Log("WEBVIEW2_SELF_TEST=" + check);
                        if (check != null && check.Contains("Sugar Ants") && check.Contains("true"))
                        {
                            Environment.ExitCode = 0;
                        }
                        else
                        {
                            Environment.ExitCode = 5;
                        }
                        Close();
                    };
                }

                Log("Navigating to https://" + VirtualHost + "/index.html");
                core.Navigate("https://" + VirtualHost + "/index.html");
            }
            catch (WebView2RuntimeNotFoundException ex)
            {
                Log("WebView2RuntimeNotFoundException: " + ex.Message);
                if (_selfTest)
                {
                    Environment.ExitCode = 10;
                    Close();
                    return;
                }
                var res = MessageBox.Show(
                    "Для запуска Sugar Ants требуется компонент Microsoft Edge WebView2 Runtime (встроен в Windows 10/11).\n" +
                    "Открыть официальную страницу загрузки Microsoft WebView2?\n\n" +
                    "Microsoft Edge WebView2 Runtime is required to run Sugar Ants. Open Microsoft's download page?",
                    "Sugar Ants",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Information
                );
                if (res == DialogResult.Yes)
                {
                    try { Process.Start(new ProcessStartInfo("https://go.microsoft.com/fwlink/p/?LinkId=2124703") { UseShellExecute = true }); } catch { }
                }
                Close();
            }
            catch (Exception ex)
            {
                Log("WebView2 Init Error: " + ex);
                if (_selfTest)
                {
                    Environment.ExitCode = 11;
                    Close();
                    return;
                }
                MessageBox.Show("Ошибка запуска Sugar Ants:\n" + ex.Message, "Sugar Ants", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }

        private static void OpenAllowedExternal(string url)
        {
            Uri u;
            if (!Uri.TryCreate(url, UriKind.Absolute, out u)) return;
            if ((u.Scheme == Uri.UriSchemeHttps || u.Scheme == Uri.UriSchemeHttp) &&
                string.Equals(u.Host, "t.me", StringComparison.OrdinalIgnoreCase))
            {
                try { Process.Start(new ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true }); } catch { }
            }
        }
    }

    static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        [STAThread]
        static void Main(string[] args)
        {
            try { SetProcessDPIAware(); } catch { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            string webRoot = Path.GetFullPath(Path.Combine(exeDir, "web"));
            bool selfTest = args != null && args.Length > 0 && args[0] == "--self-test";
            string logPath = (args != null && args.Length > 1) ? args[1] : null;

            if (!Directory.Exists(webRoot) || !File.Exists(Path.Combine(webRoot, "index.html")))
            {
                if (selfTest)
                {
                    Environment.ExitCode = 2;
                    return;
                }
                MessageBox.Show(
                    "Не найдена папка 'web' рядом с Sugar Ants.exe.\nПожалуйста, распакуйте весь архив перед запуском.\n\n" +
                    "Could not find the 'web' folder next to Sugar Ants.exe. Please extract the full archive first.",
                    "Sugar Ants",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            Application.Run(new GameWindow(webRoot, selfTest, logPath));
        }
    }
}

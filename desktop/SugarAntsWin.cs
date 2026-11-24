using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Sugar Ants")]
[assembly: AssemblyDescription("Sugar Ants — Meditative Pixel-Art Ant Colony Game")]
[assembly: AssemblyCompany("GrAx Studio")]
[assembly: AssemblyProduct("Sugar Ants")]
[assembly: AssemblyVersion("1.3.2.0")]
[assembly: AssemblyFileVersion("1.3.2.0")]

namespace SugarAntsDesktop
{
    internal sealed class DisplayPrefs
    {
        public bool Fullscreen = true;
        public int Width = 1280;
        public int Height = 720;
        public bool Auto = true;
    }

    public class GameWindow : Form
    {
        private const string VirtualHost = "sugarants.app";
        private readonly string _webRoot;
        private readonly bool _selfTest;
        private readonly string _logPath;
        private readonly string _prefsPath;
        private readonly DisplayPrefs _prefs;
        private WebView2 _webView;
        private bool _isFullscreen = true;
        private int _windowedWidth = 1280;
        private int _windowedHeight = 720;

        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        private void Log(string msg)
        {
            if (string.IsNullOrEmpty(_logPath)) return;
            try { File.AppendAllText(_logPath, DateTime.Now.ToString("HH:mm:ss.fff ") + msg + Environment.NewLine); } catch { }
        }

        private static string GetPrefsFilePath()
        {
            string dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "GrAxStudio",
                "SugarAnts"
            );
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "display.json");
        }

        private static DisplayPrefs LoadPrefs(string path, bool ignoreDisk)
        {
            var prefs = new DisplayPrefs();
            if (ignoreDisk || string.IsNullOrEmpty(path) || !File.Exists(path)) return prefs;
            try
            {
                string json = File.ReadAllText(path);
                var mFs = Regex.Match(json, "\"fullscreen\"\\s*:\\s*(true|false)", RegexOptions.IgnoreCase);
                if (mFs.Success) prefs.Fullscreen = string.Equals(mFs.Groups[1].Value, "true", StringComparison.OrdinalIgnoreCase);

                var mAuto = Regex.Match(json, "\"auto\"\\s*:\\s*(true|false)", RegexOptions.IgnoreCase);
                if (mAuto.Success) prefs.Auto = string.Equals(mAuto.Groups[1].Value, "true", StringComparison.OrdinalIgnoreCase);

                var mW = Regex.Match(json, "\"width\"\\s*:\\s*(\\d+)");
                var mH = Regex.Match(json, "\"height\"\\s*:\\s*(\\d+)");
                int w, h;
                if (mW.Success && int.TryParse(mW.Groups[1].Value, out w) && w >= 800 && w <= 7680) prefs.Width = w;
                if (mH.Success && int.TryParse(mH.Groups[1].Value, out h) && h >= 540 && h <= 4320) prefs.Height = h;
            }
            catch { }
            return prefs;
        }

        private void SavePrefs()
        {
            if (_selfTest || string.IsNullOrEmpty(_prefsPath)) return;
            try
            {
                string json = string.Format(
                    "{{\"fullscreen\":{0},\"width\":{1},\"height\":{2},\"auto\":{3}}}",
                    _prefs.Fullscreen ? "true" : "false",
                    _prefs.Width,
                    _prefs.Height,
                    _prefs.Auto ? "true" : "false"
                );
                File.WriteAllText(_prefsPath, json);
            }
            catch { }
        }

        public GameWindow(string webRoot, bool selfTest, string logPath)
        {
            _webRoot = webRoot;
            _selfTest = selfTest;
            _logPath = logPath;
            _prefsPath = GetPrefsFilePath();
            _prefs = LoadPrefs(_prefsPath, selfTest);
            _windowedWidth = Math.Max(800, _prefs.Width);
            _windowedHeight = Math.Max(540, _prefs.Height);
            Log("GameWindow ctor (defaultFullscreen=" + _prefs.Fullscreen + ")");

            Text = "Sugar Ants";
            BackColor = Color.FromArgb(5, 15, 10);
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

            // Apply saved (or default Borderless Fullscreen!) display mode immediately before showing the window!
            ApplyDisplayMode(_prefs.Fullscreen, _prefs.Width, _prefs.Height, _prefs.Auto, false);

            Load += async (s, e) => await InitWebViewAsync();
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            ApplyDarkTitlebar();
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            if (_isFullscreen)
            {
                Screen scr = GetCurrentScreen();
                FormBorderStyle = FormBorderStyle.None;
                WindowState = FormWindowState.Normal;
                Bounds = scr.Bounds;
            }
        }

        private void ApplyDarkTitlebar()
        {
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
                ApplyDisplayMode(!_isFullscreen, _windowedWidth, _windowedHeight, _prefs.Auto, true);
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        private Screen GetCurrentScreen()
        {
            try
            {
                return IsHandleCreated ? Screen.FromControl(this) : Screen.PrimaryScreen;
            }
            catch
            {
                return Screen.PrimaryScreen;
            }
        }

        private void ApplyDisplayMode(bool fullscreen, int reqWidth, int reqHeight, bool autoRes, bool notifyWebView)
        {
            Screen scr = GetCurrentScreen();
            if (!autoRes && reqWidth >= 800 && reqHeight >= 540)
            {
                _windowedWidth = reqWidth;
                _windowedHeight = reqHeight;
            }
            else if (autoRes && !fullscreen)
            {
                // Auto in windowed mode: crisp 85% of screen working area
                _windowedWidth = Math.Max(800, Math.Min(1600, (int)(scr.WorkingArea.Width * 0.85)));
                _windowedHeight = Math.Max(540, Math.Min(900, (int)(scr.WorkingArea.Height * 0.85)));
            }

            SuspendLayout();
            if (fullscreen)
            {
                StartPosition = FormStartPosition.Manual;
                WindowState = FormWindowState.Normal;
                FormBorderStyle = FormBorderStyle.None;
                Bounds = scr.Bounds;
                _isFullscreen = true;
            }
            else
            {
                StartPosition = FormStartPosition.Manual;
                WindowState = FormWindowState.Normal;
                FormBorderStyle = FormBorderStyle.Sizable;
                int maxClientW = Math.Max(800, scr.WorkingArea.Width - 24);
                int maxClientH = Math.Max(540, scr.WorkingArea.Height - 48);
                int targetW = Math.Min(_windowedWidth, maxClientW);
                int targetH = Math.Min(_windowedHeight, maxClientH);
                ClientSize = new Size(targetW, targetH);
                int left = scr.WorkingArea.Left + Math.Max(0, (scr.WorkingArea.Width - Width) / 2);
                int top = scr.WorkingArea.Top + Math.Max(0, (scr.WorkingArea.Height - Height) / 2);
                Location = new Point(left, top);
                _isFullscreen = false;
                if (IsHandleCreated) ApplyDarkTitlebar();
            }
            ResumeLayout(true);

            _prefs.Fullscreen = _isFullscreen;
            _prefs.Width = _windowedWidth;
            _prefs.Height = _windowedHeight;
            _prefs.Auto = autoRes;
            SavePrefs();

            if (notifyWebView && _webView != null && _webView.CoreWebView2 != null)
            {
                try
                {
                    string stateMsg = string.Format(
                        "{{\"type\":\"displayState\",\"fullscreen\":{0},\"width\":{1},\"height\":{2}}}",
                        _isFullscreen ? "true" : "false",
                        ClientSize.Width,
                        ClientSize.Height
                    );
                    _webView.CoreWebView2.PostWebMessageAsString(stateMsg);
                }
                catch { }
            }
        }

        private void HandleWebMessage(string json)
        {
            if (string.IsNullOrEmpty(json)) return;
            if (json.IndexOf("\"setDisplay\"", StringComparison.OrdinalIgnoreCase) < 0) return;

            bool nextFs = _isFullscreen;
            var mFs = Regex.Match(json, "\"fullscreen\"\\s*:\\s*(true|false)", RegexOptions.IgnoreCase);
            if (mFs.Success) nextFs = string.Equals(mFs.Groups[1].Value, "true", StringComparison.OrdinalIgnoreCase);

            bool autoRes = false;
            var mAuto = Regex.Match(json, "\"auto\"\\s*:\\s*(true|false)", RegexOptions.IgnoreCase);
            if (mAuto.Success) autoRes = string.Equals(mAuto.Groups[1].Value, "true", StringComparison.OrdinalIgnoreCase);

            int reqW = _windowedWidth;
            int reqH = _windowedHeight;
            var mW = Regex.Match(json, "\"width\"\\s*:\\s*(\\d+)");
            var mH = Regex.Match(json, "\"height\"\\s*:\\s*(\\d+)");
            int parsed;
            if (mW.Success && int.TryParse(mW.Groups[1].Value, out parsed) && parsed > 0) reqW = parsed;
            if (mH.Success && int.TryParse(mH.Groups[1].Value, out parsed) && parsed > 0) reqH = parsed;

            Log("setDisplay: fs=" + nextFs + " w=" + reqW + " h=" + reqH + " auto=" + autoRes);
            ApplyDisplayMode(nextFs, reqW, reqH, autoRes, true);
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
                core.Settings.IsWebMessageEnabled = true;

                // Expose desktop bridge metadata before game scripts execute
                Screen scr = GetCurrentScreen();
                string initScript = string.Format(
                    "window.__sugarDesktop = {{ isDesktop: true, fullscreen: {0}, width: {1}, height: {2}, screenWidth: {3}, screenHeight: {4} }};",
                    _isFullscreen ? "true" : "false",
                    ClientSize.Width,
                    ClientSize.Height,
                    scr.Bounds.Width,
                    scr.Bounds.Height
                );
                await core.AddScriptToExecuteOnDocumentCreatedAsync(initScript);

                core.WebMessageReceived += (sender, args) =>
                {
                    try
                    {
                        string msg = args.TryGetWebMessageAsString();
                        BeginInvoke((Action)(() => HandleWebMessage(msg)));
                    }
                    catch { }
                };

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
                        bool startedFullscreen = _isFullscreen && FormBorderStyle == FormBorderStyle.None;
                        string check = await core.ExecuteScriptAsync(
                            "(function(){return JSON.stringify({title:document.title,hasCanvas:!!document.getElementById('game-canvas'),hasMenu:!!document.getElementById('main-menu'),hasSpTimer:!!document.getElementById('stat-sp-timer'),desktop:window.__sugarDesktop||null});})()"
                        );
                        Log("WEBVIEW2_SELF_TEST=" + check + " startedFullscreen=" + startedFullscreen);

                        // Test live Fullscreen -> Windowed (1280x720) -> Fullscreen switch via JS WebMessage!
                        await core.ExecuteScriptAsync(
                            "window.chrome.webview.postMessage(JSON.stringify({type:'setDisplay',fullscreen:false,width:1280,height:720,auto:false}));"
                        );
                        await Task.Delay(350);
                        bool switchedWindowed = !_isFullscreen && FormBorderStyle == FormBorderStyle.Sizable;
                        Log("WINDOWED_SWITCH=" + switchedWindowed + " clientSize=" + ClientSize.Width + "x" + ClientSize.Height);

                        await core.ExecuteScriptAsync(
                            "window.chrome.webview.postMessage(JSON.stringify({type:'setDisplay',fullscreen:true,width:0,height:0,auto:true}));"
                        );
                        await Task.Delay(350);
                        bool switchedBackFullscreen = _isFullscreen && FormBorderStyle == FormBorderStyle.None;
                        Log("FULLSCREEN_SWITCH_BACK=" + switchedBackFullscreen);

                        if (startedFullscreen && switchedWindowed && switchedBackFullscreen &&
                            check != null && check.Contains("Sugar Ants") && check.Contains("isDesktop"))
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

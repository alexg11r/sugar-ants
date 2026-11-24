using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("Sugar Ants")]
[assembly: AssemblyDescription("Sugar Ants — Meditative Pixel-Art Ant Colony Game")]
[assembly: AssemblyCompany("GrAx Studio")]
[assembly: AssemblyProduct("Sugar Ants")]
[assembly: AssemblyVersion("1.3.0.0")]
[assembly: AssemblyFileVersion("1.3.0.0")]

namespace SugarAntsDesktop
{
    static class Program
    {
        private static volatile bool _running = true;
        private static TcpListener _listener;
        private static string _webRoot;

        [STAThread]
        static void Main(string[] args)
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            _webRoot = Path.GetFullPath(Path.Combine(exeDir, "web"));

            if (!Directory.Exists(_webRoot) || !File.Exists(Path.Combine(_webRoot, "index.html")))
            {
                MessageBox.Show(
                    "Could not find game files in the 'web' folder next to Sugar Ants.exe.\n" +
                    "Please extract the entire archive before launching.",
                    "Sugar Ants",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            // Use a fixed preferred loopback port so localStorage saves persist across launches!
            int port = StartLocalServer();
            if (port <= 0)
            {
                MessageBox.Show(
                    "Could not start local game server on 127.0.0.1.",
                    "Sugar Ants",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            // Support --self-test flag for automated build verification
            if (args != null && args.Length > 0 && args[0] == "--self-test")
            {
                try
                {
                    using (var wc = new WebClient())
                    {
                        string html = wc.DownloadString("http://127.0.0.1:" + port + "/index.html");
                        if (!html.Contains("Sugar Ants")) Environment.ExitCode = 2;
                    }
                }
                catch
                {
                    Environment.ExitCode = 3;
                }
                StopServer();
                return;
            }

            string gameUrl = "http://127.0.0.1:" + port + "/index.html";
            string profileDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "GrAxStudio",
                "SugarAnts",
                "Profile"
            );
            Directory.CreateDirectory(profileDir);

            string browserExe = FindAppBrowser();
            if (browserExe != null)
            {
                var psi = new ProcessStartInfo
                {
                    FileName = browserExe,
                    Arguments = string.Format(
                        "--app=\"{0}\" --user-data-dir=\"{1}\" --window-size=1280,800 --no-first-run --no-default-browser-check --disable-features=msEdgeSidebarV2",
                        gameUrl,
                        profileDir
                    ),
                    UseShellExecute = false
                };

                try
                {
                    using (Process proc = Process.Start(psi))
                    {
                        if (proc != null)
                        {
                            proc.WaitForExit();
                        }
                    }
                }
                catch
                {
                    LaunchFallback(gameUrl);
                }
            }
            else
            {
                LaunchFallback(gameUrl);
            }

            StopServer();
        }

        private static void LaunchFallback(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                Thread.Sleep(60000);
            }
            catch { }
        }

        private static string FindAppBrowser()
        {
            string[] candidates = new[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe")
            };

            foreach (string path in candidates)
            {
                if (!string.IsNullOrEmpty(path) && File.Exists(path)) return path;
            }
            return null;
        }

        private static int StartLocalServer()
        {
            int[] preferredPorts = new[] { 47832, 47833, 47834, 47835, 0 };
            foreach (int p in preferredPorts)
            {
                try
                {
                    var listener = new TcpListener(IPAddress.Loopback, p);
                    listener.Start();
                    _listener = listener;
                    int boundPort = ((IPEndPoint)listener.LocalEndpoint).Port;

                    var acceptThread = new Thread(AcceptLoop) { IsBackground = true };
                    acceptThread.Start();
                    return boundPort;
                }
                catch { }
            }
            return -1;
        }

        private static void StopServer()
        {
            _running = false;
            try { if (_listener != null) _listener.Stop(); } catch { }
        }

        private static void AcceptLoop()
        {
            while (_running)
            {
                try
                {
                    TcpClient client = _listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(_ => HandleClient(client));
                }
                catch
                {
                    if (!_running) break;
                }
            }
        }

        private static void HandleClient(TcpClient client)
        {
            using (client)
            {
                try
                {
                    client.ReceiveTimeout = 5000;
                    client.SendTimeout = 5000;
                    using (NetworkStream stream = client.GetStream())
                    using (var reader = new StreamReader(stream, Encoding.ASCII, false, 1024, true))
                    {
                        string requestLine = reader.ReadLine();
                        if (string.IsNullOrEmpty(requestLine)) return;

                        // Drain remaining HTTP headers
                        string line;
                        while (!string.IsNullOrEmpty(line = reader.ReadLine())) { }

                        string[] parts = requestLine.Split(' ');
                        if (parts.Length < 2) return;

                        string rawUrl = Uri.UnescapeDataString(parts[1]);
                        int qIdx = rawUrl.IndexOf('?');
                        if (qIdx >= 0) rawUrl = rawUrl.Substring(0, qIdx);
                        if (string.IsNullOrEmpty(rawUrl) || rawUrl == "/") rawUrl = "/index.html";

                        string relPath = rawUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                        string fullPath = Path.GetFullPath(Path.Combine(_webRoot, relPath));

                        // Strict sandbox check inside _webRoot
                        if (!fullPath.StartsWith(_webRoot, StringComparison.OrdinalIgnoreCase) || !File.Exists(fullPath))
                        {
                            byte[] notFound = Encoding.UTF8.GetBytes("HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\nConnection: close\r\n\r\nNot Found");
                            stream.Write(notFound, 0, notFound.Length);
                            return;
                        }

                        byte[] body = File.ReadAllBytes(fullPath);
                        string mime = GuessMime(fullPath);
                        string header =
                            "HTTP/1.1 200 OK\r\n" +
                            "Content-Type: " + mime + "\r\n" +
                            "Content-Length: " + body.Length + "\r\n" +
                            "Cache-Control: no-cache\r\n" +
                            "Connection: close\r\n\r\n";
                        byte[] headerBytes = Encoding.ASCII.GetBytes(header);
                        stream.Write(headerBytes, 0, headerBytes.Length);
                        stream.Write(body, 0, body.Length);
                    }
                }
                catch { }
            }
        }

        private static string GuessMime(string filePath)
        {
            string ext = Path.GetExtension(filePath).ToLowerInvariant();
            switch (ext)
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js":
                case ".mjs": return "application/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".svg": return "image/svg+xml";
                case ".png": return "image/png";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".ico": return "image/x-icon";
                case ".json":
                case ".webmanifest": return "application/manifest+json; charset=utf-8";
                case ".wasm": return "application/wasm";
                default: return "application/octet-stream";
            }
        }
    }
}

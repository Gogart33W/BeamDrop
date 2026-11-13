using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Windows.Forms;

namespace BeamDrop
{
    static class Program
    {
        private static Process? _nodeProcess;
        private static Process? _tunnelProcess;

        [STAThread]
        static void Main()
        {
            AppDomain.CurrentDomain.ProcessExit += (s, e) => CleanupProcesses();

            try
            {
                // Find project root
                string projectRoot = AppDomain.CurrentDomain.BaseDirectory;
                while (!File.Exists(Path.Combine(projectRoot, "server", "dist", "index.js")) && Directory.GetParent(projectRoot) != null)
                {
                    projectRoot = Directory.GetParent(projectRoot)!.FullName;
                }

                // 1. Free port 4000 if occupied by any stale listening process
                FreePort(4000);
                Thread.Sleep(500);

                // 2. Locate node executable (supports bundled, system PATH, or environment)
                string localToolsNode = Path.Combine(projectRoot, "tools", "nodejs", "node.exe");
                string nodeExe = File.Exists(localToolsNode) ? localToolsNode : "node";

                string serverScript = Path.Combine(projectRoot, "server", "dist", "index.js");
                string logFile = Path.Combine(projectRoot, "server.log");

                // Start node server with output redirected to logFile
                var nodeStartInfo = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = $"\"{serverScript}\"",
                    WorkingDirectory = projectRoot,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                nodeStartInfo.Environment["PORT"] = "4000";
                nodeStartInfo.Environment["HOST"] = "0.0.0.0";
                if (File.Exists(localToolsNode))
                {
                    string nodeDir = Path.GetDirectoryName(localToolsNode)!;
                    nodeStartInfo.Environment["PATH"] = nodeDir + ";" + Environment.GetEnvironmentVariable("PATH");
                }

                _nodeProcess = new Process { StartInfo = nodeStartInfo };

                // Capture logs
                var logStream = new StreamWriter(new FileStream(logFile, FileMode.Create, FileAccess.Write, FileShare.ReadWrite)) { AutoFlush = true };
                _nodeProcess.OutputDataReceived += (s, e) => { if (e.Data != null) logStream.WriteLine(e.Data); };
                _nodeProcess.ErrorDataReceived += (s, e) => { if (e.Data != null) logStream.WriteLine($"[ERROR] {e.Data}"); };

                _nodeProcess.Start();
                _nodeProcess.BeginOutputReadLine();
                _nodeProcess.BeginErrorReadLine();

                // 3. Wait until server responds with 200 OK on http://127.0.0.1:4000/health
                bool serverReady = WaitForServerReady("http://127.0.0.1:4000/health", TimeSpan.FromSeconds(12));

                if (!serverReady)
                {
                    string errDetails = File.Exists(logFile) ? File.ReadAllText(logFile) : "Невідома помилка запуску";
                    MessageBox.Show($"Не вдалося запустити сервер BeamDrop.\n\nДеталі:\n{errDetails}", "Помилка BeamDrop", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                // 4. Launch standalone Desktop Window (no browser tabs/URL bar)
                string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
                string chromePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
                string browserPath = File.Exists(edgePath) ? edgePath : (File.Exists(chromePath) ? chromePath : "");
                string profileDir = Path.Combine(projectRoot, ".app-profile");

                if (!string.IsNullOrEmpty(browserPath))
                {
                    var windowStartInfo = new ProcessStartInfo
                    {
                        FileName = browserPath,
                        Arguments = $"--app=http://127.0.0.1:4000 --user-data-dir=\"{profileDir}\" --window-size=1180,840 --no-first-run",
                        UseShellExecute = false
                    };

                    var windowProcess = Process.Start(windowStartInfo);
                    if (windowProcess != null)
                    {
                        // Stays running while the native app window is open!
                        windowProcess.WaitForExit();
                    }
                }
                else
                {
                    Process.Start(new ProcessStartInfo("http://127.0.0.1:4000") { UseShellExecute = true });
                    MessageBox.Show("BeamDrop запущено!\nКоли закінчите, натисніть OK, щоб вийти.", "BeamDrop", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Помилка запуску BeamDrop: {ex.Message}", "BeamDrop", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                // When user closes the app window with X, EVERYTHING cleanly dies!
                CleanupProcesses();
            }
        }

        private static void FreePort(int port)
        {
            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = $"/c for /f \"tokens=5\" %a in ('netstat -ano ^| findstr /R /C:\":{port} .*LISTENING\"') do taskkill /f /pid %a",
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                var proc = Process.Start(startInfo);
                proc?.WaitForExit(3000);
            }
            catch { }
        }

        private static bool WaitForServerReady(string healthUrl, TimeSpan timeout)
        {
            var stopwatch = Stopwatch.StartNew();
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
            while (stopwatch.Elapsed < timeout)
            {
                try
                {
                    var response = client.GetAsync(healthUrl).GetAwaiter().GetResult();
                    if (response.IsSuccessStatusCode) return true;
                }
                catch
                {
                    Thread.Sleep(250);
                }
            }
            return false;
        }

        private static void CleanupProcesses()
        {
            try
            {
                if (_nodeProcess != null && !_nodeProcess.HasExited)
                {
                    _nodeProcess.Kill(true);
                    _nodeProcess.Dispose();
                    _nodeProcess = null;
                }
            }
            catch { }

            try
            {
                if (_tunnelProcess != null && !_tunnelProcess.HasExited)
                {
                    _tunnelProcess.Kill(true);
                    _tunnelProcess.Dispose();
                    _tunnelProcess = null;
                }
            }
            catch { }

            FreePort(4000);
        }
    }
}

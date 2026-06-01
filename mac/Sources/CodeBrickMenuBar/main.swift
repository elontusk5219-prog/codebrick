import AppKit
import WebKit

// Menu-bar-only app (no Dock icon).
let app = NSApplication.shared
app.setActivationPolicy(.accessory)

let env = ProcessInfo.processInfo.environment
let port = env["CODEBRICK_PORT"] ?? "4317"
let canvasURL = URL(string: env["CODEBRICK_URL"] ?? "http://localhost:\(port)")!

func log(_ s: String) {
    FileHandle.standardError.write("[codebrick-mac] \(s)\n".data(using: .utf8)!)
}

func shellQuote(_ s: String) -> String {
    "'" + s.replacingOccurrences(of: "'", with: "'\\''") + "'"
}

/// Where the bundled Node server entrypoint lives (dev layout, overridable by env).
func serverEntrypoint() -> String? {
    if let p = env["CODEBRICK_SERVER_JS"] { return p }
    let exe = Bundle.main.executableURL ?? URL(fileURLWithPath: CommandLine.arguments[0])
    // <root>/mac/.build/debug/CodeBrickMenuBar -> <root>/dist/server/index.js
    let root = exe.deletingLastPathComponent().deletingLastPathComponent()
        .deletingLastPathComponent().deletingLastPathComponent()
    let candidate = root.appendingPathComponent("dist/server/index.js").path
    return FileManager.default.fileExists(atPath: candidate) ? candidate : nil
}

/// Launches and owns the Node server child process.
final class ServerProcess {
    private var process: Process?

    func start() {
        guard let js = serverEntrypoint() else {
            log("no bundled server found — assuming an external server on :\(port)")
            return
        }
        let p = Process()
        // Login shell so `node` resolves from the user's PATH (nvm, homebrew, etc.).
        p.executableURL = URL(fileURLWithPath: "/bin/zsh")
        p.arguments = ["-lc", "exec node \(shellQuote(js))"]
        var e = env
        e["CODEBRICK_PORT"] = port
        p.environment = e
        let pipe = Pipe()
        p.standardOutput = pipe
        p.standardError = pipe
        do {
            try p.run()
            process = p
            log("spawned node server (\(js))")
        } catch {
            log("failed to spawn server: \(error)")
        }
    }

    func stop() { process?.terminate() }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var statusItem: NSStatusItem!
    let popover = NSPopover()
    var webView: WKWebView!
    var hasLoaded = false
    let server = ServerProcess()

    func applicationDidFinishLaunching(_ notification: Notification) {
        server.start()

        let rect = NSRect(x: 0, y: 0, width: 408, height: 620)
        webView = WKWebView(frame: rect)
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground") // transparent -> native glass shows through
        webView.autoresizingMask = [.width, .height]

        // Native macOS vibrancy (glass) behind the transparent web view.
        let container = NSView(frame: rect)
        let effect = NSVisualEffectView(frame: rect)
        effect.material = .popover
        effect.blendingMode = .behindWindow
        effect.state = .active
        effect.autoresizingMask = [.width, .height]
        container.addSubview(effect)
        container.addSubview(webView, positioned: .above, relativeTo: effect)

        let vc = NSViewController()
        vc.view = container
        popover.contentViewController = vc
        popover.contentSize = rect.size
        popover.behavior = .transient

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.title = "▦"
            button.target = self
            button.action = #selector(statusClick)
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }
        log("menu bar item ready")

        waitForServerThenLoad(attempts: 25)

        if let snapPath = env["CODEBRICK_SNAPSHOT"] {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { self.togglePopover() }
            DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) { self.snapshot(to: snapPath) }
        }
    }

    func waitForServerThenLoad(attempts: Int) {
        guard attempts > 0 else { loadCanvas(); return }
        var req = URLRequest(url: canvasURL)
        req.timeoutInterval = 1
        URLSession.shared.dataTask(with: req) { _, resp, _ in
            if let http = resp as? HTTPURLResponse, http.statusCode == 200 {
                DispatchQueue.main.async { self.loadCanvas() }
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.waitForServerThenLoad(attempts: attempts - 1)
                }
            }
        }.resume()
    }

    func loadCanvas() {
        if !hasLoaded { webView.load(URLRequest(url: canvasURL)) }
    }

    @objc func statusClick() {
        if let e = NSApp.currentEvent, e.type == .rightMouseUp {
            showQuitMenu()
        } else {
            togglePopover()
        }
    }

    func togglePopover() {
        guard let button = statusItem.button else { return }
        if popover.isShown {
            popover.performClose(nil)
        } else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    func showQuitMenu() {
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Quit CodeBrick", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        if let b = statusItem.button {
            menu.popUp(positioning: nil, at: NSPoint(x: 0, y: b.bounds.height + 5), in: b)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hasLoaded = true
    }

    func applicationWillTerminate(_ notification: Notification) {
        server.stop()
    }

    func snapshot(to path: String) {
        let cfg = WKSnapshotConfiguration()
        webView.takeSnapshot(with: cfg) { image, error in
            guard let image = image,
                  let tiff = image.tiffRepresentation,
                  let rep = NSBitmapImageRep(data: tiff),
                  let png = rep.representation(using: .png, properties: [:]) else {
                log("snapshot failed: \(String(describing: error))")
                return
            }
            try? png.write(to: URL(fileURLWithPath: path))
            log("snapshot written to \(path)")
        }
    }
}

let delegate = AppDelegate()
app.delegate = delegate
app.run()

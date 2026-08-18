import AppKit
import Darwin
import Foundation

private let endpoint = URL(string: "http://127.0.0.1:5511/login/")!
private let titleMarker = "<title>Portfolio CMS Lite — вход</title>"
private let configMarker = "src=\"/runtime-config.js\""
private enum Probe { case cms, foreign(Int), unavailable }

private func isCMSLiteLoginHTML(_ body: String) -> Bool { body.contains(titleMarker) && body.contains(configMarker) }

private func probe(_ url: URL, timeout: TimeInterval) -> Probe {
  var request = URLRequest(url: url); request.timeoutInterval = timeout
  let semaphore = DispatchSemaphore(value: 0); var result: Probe = .unavailable
  URLSession.shared.dataTask(with: request) { data, response, _ in
    defer { semaphore.signal() }
    guard let http = response as? HTTPURLResponse else { return }
    let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
    result = http.statusCode == 200 && isCMSLiteLoginHTML(body) ? .cms : .foreign(http.statusCode)
  }.resume()
  return semaphore.wait(timeout: .now() + timeout + 0.2) == .success ? result : .unavailable
}

private final class StartupLock {
  private let fd: Int32
  init?() {
    let library = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
    let directory = library.appendingPathComponent("Application Support/Portfolio CMS/locks", isDirectory: true)
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    fd = open(directory.appendingPathComponent("startup.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
    guard fd >= 0, flock(fd, LOCK_EX) == 0 else { if fd >= 0 { close(fd) }; return nil }
  }
  deinit { flock(fd, LOCK_UN); close(fd) }
}

private final class Logger {
  private let handle: FileHandle?
  init() {
    let library = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
    let dir = library.appendingPathComponent("Logs/Portfolio CMS", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let file = dir.appendingPathComponent("launcher.log")
    FileManager.default.createFile(atPath: file.path, contents: nil)
    handle = try? FileHandle(forWritingTo: file); _ = try? handle?.seekToEnd()
  }
  func write(_ message: String) { try? handle?.write(contentsOf: Data("\(ISO8601DateFormatter().string(from: Date())) \(message)\n".utf8)) }
  var fileHandle: FileHandle? { handle }
}

private struct Paths {
  let root: URL; let node: URL; let server: URL
  init?(bundle: Bundle = .main) {
    guard let resources = bundle.resourceURL else { return nil }
    root = resources.appendingPathComponent("runtime", isDirectory: true)
    node = resources.appendingPathComponent("node/node")
    server = root.appendingPathComponent("cms-lite/dev-server.mjs")
    guard FileManager.default.isExecutableFile(atPath: node.path), FileManager.default.fileExists(atPath: server.path) else { return nil }
  }
}

private func errorDialog(_ text: String) {
  let alert = NSAlert(); alert.messageText = "Portfolio CMS не запущен"; alert.informativeText = text; alert.alertStyle = .critical; alert.runModal()
}

private func launch() {
  if CommandLine.arguments.contains("--self-test") {
    precondition(isCMSLiteLoginHTML("<title>Portfolio CMS Lite — вход</title><script src=\"/runtime-config.js\"></script>"))
    precondition(!isCMSLiteLoginHTML("<title>Other</title>")); print("PortfolioCMSLauncher self-test passed"); return
  }
  NSApplication.shared.setActivationPolicy(.accessory)
  let logger = Logger(); logger.write("Launcher start")
  guard let lock = StartupLock() else { errorDialog("Не удалось получить startup lock."); return }
  _ = lock
  switch probe(endpoint, timeout: 1) {
  case .cms: logger.write("Existing CMS Lite endpoint reused"); NSWorkspace.shared.open(endpoint); return
  case .foreign(let status): logger.write("Foreign HTTP listener status=\(status)"); errorDialog("Порт 5511 занят другим локальным HTTP-сервисом. Он не был остановлен."); return
  case .unavailable: break
  }
  guard let paths = Paths() else { logger.write("Bundled runtime resolution failed"); errorDialog("Не найден встроенный Node runtime или CMS Lite bundle."); return }
  logger.write("Runtime=\(paths.root.path) node=\(paths.node.path)")
  let child = Process(); child.executableURL = paths.node; child.arguments = [paths.server.path]; child.currentDirectoryURL = paths.root
  var environment = ProcessInfo.processInfo.environment; environment.removeValue(forKey: "NODE_OPTIONS"); environment.removeValue(forKey: "NODE_PATH"); environment["CMS_LITE_PORT"] = "5511"; child.environment = environment
  child.standardOutput = logger.fileHandle; child.standardError = logger.fileHandle
  do { try child.run() } catch { logger.write("Server launch failed: \(error.localizedDescription)"); errorDialog("Не удалось запустить локальный CMS server."); return }
  logger.write("Server startup PID=\(child.processIdentifier)")
  let deadline = Date().addingTimeInterval(15)
  while Date() < deadline {
    if case .cms = probe(endpoint, timeout: 0.8) { logger.write("Readiness succeeded PID=\(child.processIdentifier)"); NSWorkspace.shared.open(endpoint); return }
    if !child.isRunning { break }; Thread.sleep(forTimeInterval: 0.2)
  }
  if child.isRunning { logger.write("Stopping owned child PID=\(child.processIdentifier) after failed readiness"); child.terminate() }
  logger.write("Readiness timed out or server exited")
  errorDialog("CMS Lite не стал готов за 15 секунд. Проверьте ~/Library/Logs/Portfolio CMS/launcher.log")
}

launch()

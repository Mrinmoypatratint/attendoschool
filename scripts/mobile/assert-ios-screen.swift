import AppKit
import Foundation

guard CommandLine.arguments.count == 2,
      let data = try? Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])),
      let image = NSBitmapImageRep(data: data) else {
    FileHandle.standardError.write(Data("Could not read iOS screenshot\n".utf8))
    exit(1)
}

// Ignore system status/navigation bars. A loaded login contains the burgundy
// background and school artwork; a blank WKWebView has no colored content.
var samples = 0
var colored = 0
for y in stride(from: image.pixelsHigh / 8, to: image.pixelsHigh * 7 / 8, by: 12) {
    for x in stride(from: image.pixelsWide / 12, to: image.pixelsWide * 11 / 12, by: 12) {
        guard let color = image.colorAt(x: x, y: y)?.usingColorSpace(NSColorSpace.deviceRGB) else { continue }
        let channels = [color.redComponent, color.greenComponent, color.blueComponent]
        if channels.max()! - channels.min()! > 0.15 { colored += 1 }
        samples += 1
    }
}
guard samples > 0, Double(colored) / Double(samples) > 0.05 else {
    FileHandle.standardError.write(Data("iOS app launched but its WebView is blank; inspect the startup log and screenshot.\n".utf8))
    exit(1)
}
print("iOS screenshot contains rendered application content.")

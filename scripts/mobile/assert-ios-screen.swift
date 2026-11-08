import AppKit
import Foundation

guard CommandLine.arguments.count == 2,
      let image = NSBitmapImageRep(contentsOfFile: CommandLine.arguments[1]) else {
    fputs("Could not read iOS screenshot\n", stderr)
    exit(1)
}

// Ignore system status/navigation bars. A loaded login contains the burgundy
// background and school artwork; a blank WKWebView has no colored content.
var samples = 0
var colored = 0
for y in stride(from: image.pixelsHigh / 8, to: image.pixelsHigh * 7 / 8, by: 12) {
    for x in stride(from: image.pixelsWide / 12, to: image.pixelsWide * 11 / 12, by: 12) {
        guard let color = image.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB) else { continue }
        let channels = [color.redComponent, color.greenComponent, color.blueComponent]
        if channels.max()! - channels.min()! > 0.15 { colored += 1 }
        samples += 1
    }
}
guard samples > 0, Double(colored) / Double(samples) > 0.05 else {
    fputs("iOS app launched but its WebView is blank; inspect the startup log and screenshot.\n", stderr)
    exit(1)
}
print("iOS screenshot contains rendered application content.")

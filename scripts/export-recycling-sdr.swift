import Foundation
import AVFoundation

// H.264 export applies Apple's HDR-to-SDR conversion and preserves real audio.
// See developer.apple.com/av-foundation/Incorporating-HDR-video-with-Dolby-Vision-into-your-apps.pdf
@main struct ExportSDR {
    static func main() async throws {
        let args = CommandLine.arguments
        guard (args.count == 5 || args.count == 6), let start = Double(args[3]),
              let duration = Double(args[4]), start >= 0, duration > 0 else {
            fputs("Usage: export-sdr input.mov output.mp4 start_seconds duration_seconds [720|1080]\n", stderr)
            exit(2)
        }
        let source = URL(fileURLWithPath: args[1])
        let output = URL(fileURLWithPath: args[2])
        guard !FileManager.default.fileExists(atPath: output.path) else {
            fputs("Output exists; refusing to overwrite.\n", stderr)
            exit(2)
        }
        let asset = AVURLAsset(url: source)
        let length = try await asset.load(.duration).seconds
        guard start < length, start + duration <= length + 0.1 else {
            fputs("Requested clip exceeds the source duration.\n", stderr)
            exit(2)
        }
        let preset = args.count == 6 && args[5] == "720" ? AVAssetExportPreset1280x720 : AVAssetExportPreset1920x1080
        guard let exporter = AVAssetExportSession(asset: asset, presetName: preset) else {
            fputs("Cannot create H.264 exporter.\n", stderr)
            exit(1)
        }
        exporter.timeRange = CMTimeRange(start: CMTime(seconds: start, preferredTimescale: 600),
                                        duration: CMTime(seconds: duration, preferredTimescale: 600))
        exporter.metadata = []
        exporter.shouldOptimizeForNetworkUse = true
        try await exporter.export(to: output, as: .mp4)
        print(output.path)
    }
}

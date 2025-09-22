import ExpoModulesCore
import AVFoundation

enum VideoConcatError: Error, LocalizedError {
  case badInput
  case cannotCreateTrack
  case exportSessionUnavailable
  case exportFailed(String)

  var errorDescription: String? {
    switch self {
    case .badInput: return "No valid video paths were provided."
    case .cannotCreateTrack: return "Could not create composition track."
    case .exportSessionUnavailable: return "AVAssetExportSession could not be created."
    case .exportFailed(let reason): return "Export failed: \(reason)"
    }
  }
}

public class VideoConcatenatorModule: Module {
  public func definition() -> ModuleDefinition {
    // This name MUST match what you require in JS: requireNativeModule('VideoConcatenator')
    Name("VideoConcatenator")

    /**
     * Concatenate multiple local video files into a single mp4.
     * - Parameters:
     *   - videoPaths: Array of paths or file URLs (e.g. "file:///var/mobile/.../clip.mp4" or "/var/mobile/.../clip.mp4")
     *   - outputName: Filename without extension (e.g. "dream_cinema_123")
     * - Returns: String path to the exported mp4 (e.g. "/var/mobile/.../dream_cinema_123.mp4")
     */
    AsyncFunction("concatenateVideos") { (videoPaths: [String], outputName: String) -> String in
      guard !videoPaths.isEmpty else { throw VideoConcatError.badInput }

      // Build composition
      let composition = AVMutableComposition()
      guard
        let videoTrack = composition.addMutableTrack(withMediaType: .video,
                                                     preferredTrackID: kCMPersistentTrackID_Invalid)
      else {
        throw VideoConcatError.cannotCreateTrack
      }

      // Optional audio track (if inputs contain audio)
      let audioTrack = composition.addMutableTrack(withMediaType: .audio,
                                                   preferredTrackID: kCMPersistentTrackID_Invalid)

      var insertTime = CMTime.zero
      var renderSize = CGSize.zero
      var preferredTransform: CGAffineTransform = .identity

      for path in videoPaths {
        // Accept both "file://…" and plain paths
        let cleanedPath = path.replacingOccurrences(of: "file://", with: "")
        let url = URL(fileURLWithPath: cleanedPath)

        let asset = AVURLAsset(url: url)
        let timeRange = CMTimeRange(start: .zero, duration: asset.duration)

        // Video
        if let srcVideoTrack = asset.tracks(withMediaType: .video).first {
          // Track transform keeps orientation correct
          preferredTransform = srcVideoTrack.preferredTransform
          renderSize = srcVideoTrack.naturalSize.applying(srcVideoTrack.preferredTransform).standardizedSize

          try videoTrack.insertTimeRange(timeRange, of: srcVideoTrack, at: insertTime)
        }

        // Audio (best-effort)
        if let srcAudioTrack = asset.tracks(withMediaType: .audio).first,
           let audioTrack = audioTrack {
          try? audioTrack.insertTimeRange(timeRange, of: srcAudioTrack, at: insertTime)
        }

        insertTime = CMTimeAdd(insertTime, asset.duration)
      }

      // Preserve orientation
      videoTrack.preferredTransform = preferredTransform

      // Prepare output path in tmp directory
      let outputURL = FileManager.default.temporaryDirectory
        .appendingPathComponent("\(outputName).mp4")

      if FileManager.default.fileExists(atPath: outputURL.path) {
        try? FileManager.default.removeItem(at: outputURL)
      }

      // Export
      guard let exporter = AVAssetExportSession(asset: composition,
                                                presetName: AVAssetExportPresetHighestQuality) else {
        throw VideoConcatError.exportSessionUnavailable
      }
      exporter.outputURL = outputURL
      exporter.outputFileType = .mp4
      exporter.shouldOptimizeForNetworkUse = true
      exporter.videoComposition = {
        // Ensure consistent render size if needed
        let instruction = AVMutableVideoCompositionInstruction()
        instruction.timeRange = CMTimeRange(start: .zero, duration: insertTime)

        let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
        layerInstruction.setTransform(preferredTransform, at: .zero)
        instruction.layerInstructions = [layerInstruction]

        let vc = AVMutableVideoComposition()
        vc.instructions = [instruction]
        // Use a safe render size (absolute values after transform)
        vc.renderSize = CGSize(width: abs(renderSize.width), height: abs(renderSize.height))
        vc.frameDuration = CMTime(value: 1, timescale: 30)
        return vc
      }()

      let path: String = try await withCheckedThrowingContinuation { cont in
        exporter.exportAsynchronously {
          switch exporter.status {
          case .completed:
            cont.resume(returning: outputURL.path)
          case .failed, .cancelled:
            let reason = exporter.error?.localizedDescription ?? "Unknown"
            cont.resume(throwing: VideoConcatError.exportFailed(reason))
          default:
            // Should not happen; exportAsynchronously completes only once.
            let reason = exporter.error?.localizedDescription ?? "Unexpected exporter state"
            cont.resume(throwing: VideoConcatError.exportFailed(reason))
          }
        }
      }

      return path
    }
  }
}

private extension CGSize {
  /// Make sizes positive after applying transforms with negative scales.
  var standardizedSize: CGSize {
    CGSize(width: abs(width), height: abs(height))
  }
}

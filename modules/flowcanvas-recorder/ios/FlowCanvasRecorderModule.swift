import AVFoundation
import CoreMedia
import ExpoModulesCore
import ReplayKit

public class FlowCanvasRecorderModule: Module {
  private var assetWriter: AVAssetWriter?
  private var videoInput: AVAssetWriterInput?
  private var audioInput: AVAssetWriterInput?
  private var outputURL: URL?
  private var isRecording = false
  private var isPaused = false
  private var sessionStarted = false
  private let writeQueue = DispatchQueue(label: "com.flowcanvas.recorder.write")

  public func definition() -> ModuleDefinition {
    Name("FlowCanvasRecorder")

    Function("isSupported") { () -> Bool in
      return RPScreenRecorder.shared().isAvailable
    }

    AsyncFunction("startRecording") { (options: [String: Any], promise: Promise) in
      let recorder = RPScreenRecorder.shared()
      guard recorder.isAvailable else {
        promise.reject("UNAVAILABLE", "Screen recording is not available on this device.")
        return
      }

      let width = max(320, (options["width"] as? Int) ?? 1280)
      let height = max(240, (options["height"] as? Int) ?? 720)
      let bitrate = max(500_000, (options["bitrate"] as? Int) ?? 3_500_000)
      let includeMic = (options["includeMic"] as? Bool) ?? true

      let tempURL = FileManager.default.temporaryDirectory
        .appendingPathComponent("flowcanvas-lesson-\(UUID().uuidString).mp4")
      try? FileManager.default.removeItem(at: tempURL)

      do {
        let writer = try AVAssetWriter(outputURL: tempURL, fileType: .mp4)
        let videoSettings: [String: Any] = [
          AVVideoCodecKey: AVVideoCodecType.h264,
          AVVideoWidthKey: width,
          AVVideoHeightKey: height,
          AVVideoCompressionPropertiesKey: [
            AVVideoAverageBitRateKey: bitrate,
          ],
        ]
        let vInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        vInput.expectsMediaDataInRealTime = true
        if writer.canAdd(vInput) {
          writer.add(vInput)
        }

        let audioSettings: [String: Any] = [
          AVFormatIDKey: kAudioFormatMPEG4AAC,
          AVNumberOfChannelsKey: 1,
          AVSampleRateKey: 44100,
          AVEncoderBitRateKey: 128_000,
        ]
        let aInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
        aInput.expectsMediaDataInRealTime = true
        if writer.canAdd(aInput) {
          writer.add(aInput)
        }

        self.assetWriter = writer
        self.videoInput = vInput
        self.audioInput = aInput
        self.outputURL = tempURL
        self.sessionStarted = false
        self.isPaused = false

        recorder.isMicrophoneEnabled = includeMic
        recorder.startCapture(handler: { [weak self] sampleBuffer, bufferType, error in
          guard let self = self, error == nil, self.isRecording, !self.isPaused else { return }
          self.writeQueue.async {
            guard let writer = self.assetWriter else { return }
            if !self.sessionStarted && writer.status == .unknown {
              writer.startWriting()
              writer.startSession(atSourceTime: CMSampleBufferGetPresentationTimeStamp(sampleBuffer))
              self.sessionStarted = true
            }
            guard writer.status == .writing else { return }
            if bufferType == .video, let vInput = self.videoInput, vInput.isReadyForMoreMediaData {
              vInput.append(sampleBuffer)
            } else if (bufferType == .audioMic || bufferType == .audioApp),
                      let aInput = self.audioInput,
                      aInput.isReadyForMoreMediaData {
              aInput.append(sampleBuffer)
            }
          }
        }, completionHandler: { [weak self] error in
          if let error = error {
            promise.reject("START_FAILED", error.localizedDescription)
          } else {
            self?.isRecording = true
            promise.resolve(["outputPath": tempURL.absoluteString])
          }
        })
      } catch {
        promise.reject("WRITER_ERROR", error.localizedDescription)
      }
    }

    AsyncFunction("pauseRecording") { () in
      self.isPaused = true
    }

    AsyncFunction("resumeRecording") { () in
      self.isPaused = false
    }

    AsyncFunction("stopRecording") { (promise: Promise) in
      let recorder = RPScreenRecorder.shared()
      self.isRecording = false
      self.isPaused = false

      recorder.stopCapture { [weak self] error in
        guard let self = self else {
          promise.resolve(nil)
          return
        }
        self.writeQueue.async {
          guard let writer = self.assetWriter, let url = self.outputURL else {
            promise.resolve(nil)
            return
          }
          if writer.status == .writing {
            self.videoInput?.markAsFinished()
            self.audioInput?.markAsFinished()
            writer.finishWriting {
              self.assetWriter = nil
              self.videoInput = nil
              self.audioInput = nil
              if let error = error {
                promise.reject("STOP_FAILED", error.localizedDescription)
              } else {
                promise.resolve(["videoUri": url.absoluteString, "audioUri": NSNull()])
              }
            }
          } else {
            self.assetWriter = nil
            self.videoInput = nil
            self.audioInput = nil
            promise.resolve(["videoUri": NSNull(), "audioUri": NSNull()])
          }
        }
      }
    }
  }
}

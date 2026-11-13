package expo.modules.flowcanvasrecorder

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.util.DisplayMetrics
import android.view.WindowManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID

class FlowCanvasRecorderModule : Module() {
  private var mediaProjection: MediaProjection? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var mediaRecorder: MediaRecorder? = null
  private var outputFile: File? = null

  private var pendingPromise: Promise? = null
  private var pendingWidth: Int = 1280
  private var pendingHeight: Int = 720
  private var pendingBitrate: Int = 3_500_000
  private var pendingIncludeMic: Boolean = true

  override fun definition() = ModuleDefinition {
    Name("FlowCanvasRecorder")

    Function("isSupported") {
      return@Function true
    }

    AsyncFunction("startRecording") { options: Map<String, Any?>, promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "Current activity is unavailable.", null)
        return@AsyncFunction
      }
      if (pendingPromise != null) {
        promise.reject("BUSY", "A screen capture permission request is already in progress.", null)
        return@AsyncFunction
      }

      pendingWidth = ((options["width"] as? Number)?.toInt() ?: 1280).coerceIn(320, 1920)
      pendingHeight = ((options["height"] as? Number)?.toInt() ?: 720).coerceIn(240, 1920)
      pendingBitrate = ((options["bitrate"] as? Number)?.toInt() ?: 3_500_000).coerceAtLeast(500_000)
      pendingIncludeMic = (options["includeMic"] as? Boolean) ?: true
      pendingPromise = promise

      val projectionManager =
        activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      activity.startActivityForResult(
        projectionManager.createScreenCaptureIntent(),
        SCREEN_CAPTURE_REQUEST_CODE,
      )
    }

    AsyncFunction("pauseRecording") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        try {
          mediaRecorder?.pause()
        } catch (_: Throwable) {
        }
      }
    }

    AsyncFunction("resumeRecording") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        try {
          mediaRecorder?.resume()
        } catch (_: Throwable) {
        }
      }
    }

    AsyncFunction("stopRecording") {
      val file = outputFile
      cleanupRecording()
      if (file != null && file.exists() && file.length() > 0) {
        mapOf(
          "videoUri" to Uri.fromFile(file).toString(),
          "audioUri" to null,
        )
      } else {
        mapOf(
          "videoUri" to null,
          "audioUri" to null,
        )
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != SCREEN_CAPTURE_REQUEST_CODE) return@OnActivityResult
      val promise = pendingPromise ?: return@OnActivityResult
      pendingPromise = null

      val data = payload.data
      if (payload.resultCode != Activity.RESULT_OK || data == null) {
        promise.reject("PERMISSION_DENIED", "Screen recording permission was declined.", null)
        return@OnActivityResult
      }

      val context = appContext.reactContext
      if (context == null) {
        promise.reject("NO_CONTEXT", "React context is unavailable.", null)
        return@OnActivityResult
      }

      try {
        val serviceIntent = Intent(context, FlowCanvasScreenCaptureService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(serviceIntent)
        } else {
          context.startService(serviceIntent)
        }

        val projectionManager =
          context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val projection = projectionManager.getMediaProjection(payload.resultCode, data)
        if (projection == null) {
          promise.reject("PROJECTION_NULL", "Could not initialize MediaProjection.", null)
          return@OnActivityResult
        }

        val outFile = File(context.cacheDir, "flowcanvas-lesson-${UUID.randomUUID()}.mp4")
        val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          MediaRecorder(context)
        } else {
          @Suppress("DEPRECATION")
          MediaRecorder()
        }

        val hasMicPermission =
          ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        val recordMic = pendingIncludeMic && hasMicPermission

        if (recordMic) {
          recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
        }
        recorder.setVideoSource(MediaRecorder.VideoSource.SURFACE)
        recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        recorder.setOutputFile(outFile.absolutePath)
        recorder.setVideoEncoder(MediaRecorder.VideoEncoder.H264)
        recorder.setVideoEncodingBitRate(pendingBitrate)
        recorder.setVideoFrameRate(30)
        recorder.setVideoSize(makeEven(pendingWidth), makeEven(pendingHeight))
        if (recordMic) {
          recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
          recorder.setAudioEncodingBitRate(128_000)
          recorder.setAudioSamplingRate(44_100)
        }
        recorder.prepare()

        val densityDpi = getScreenDensityDpi(context)
        val display = projection.createVirtualDisplay(
          "FlowCanvasLesson",
          makeEven(pendingWidth),
          makeEven(pendingHeight),
          densityDpi,
          DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
          recorder.surface,
          null,
          null,
        )

        recorder.start()
        mediaProjection = projection
        virtualDisplay = display
        mediaRecorder = recorder
        outputFile = outFile

        promise.resolve(mapOf("outputPath" to Uri.fromFile(outFile).toString()))
      } catch (t: Throwable) {
        cleanupRecording()
        promise.reject("START_FAILED", t.message ?: "Failed to start screen recording.", t)
      }
    }
  }

  private fun makeEven(value: Int): Int = if (value % 2 == 0) value else value + 1

  private fun getScreenDensityDpi(context: Context): Int {
    val metrics = DisplayMetrics()
    val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    @Suppress("DEPRECATION")
    wm.defaultDisplay.getRealMetrics(metrics)
    return metrics.densityDpi.coerceAtLeast(160)
  }

  private fun cleanupRecording() {
    try {
      mediaRecorder?.stop()
    } catch (_: Throwable) {
    }
    try {
      mediaRecorder?.reset()
      mediaRecorder?.release()
    } catch (_: Throwable) {
    }
    mediaRecorder = null

    try {
      virtualDisplay?.release()
    } catch (_: Throwable) {
    }
    virtualDisplay = null

    try {
      mediaProjection?.stop()
    } catch (_: Throwable) {
    }
    mediaProjection = null

    appContext.reactContext?.let { context ->
      try {
        context.stopService(Intent(context, FlowCanvasScreenCaptureService::class.java))
      } catch (_: Throwable) {
      }
    }
  }

  companion object {
    private const val SCREEN_CAPTURE_REQUEST_CODE = 9401
  }
}

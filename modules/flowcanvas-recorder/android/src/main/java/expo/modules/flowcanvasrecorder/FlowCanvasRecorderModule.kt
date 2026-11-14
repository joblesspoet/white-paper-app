package expo.modules.flowcanvasrecorder

import android.Manifest
import android.app.Activity
import android.content.ContentValues
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.media.MediaRecorder
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.HandlerThread
import android.provider.MediaStore
import android.view.PixelCopy
import android.view.Surface
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.lang.ref.WeakReference
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt

class FlowCanvasRecorderModule : Module() {
  private val stateLock = Any()
  private val muxerLock = Any()

  private var outputFile: File? = null
  private var mediaMuxer: MediaMuxer? = null
  private var muxerStarted = false
  private var videoTrackIndex = -1
  private var audioTrackIndex = -1
  private var expectingAudioTrack = false

  private var videoCodec: MediaCodec? = null
  private var audioCodec: MediaCodec? = null
  private var inputSurface: Surface? = null
  private var audioRecord: AudioRecord? = null

  private var captureThread: HandlerThread? = null
  private var captureHandler: Handler? = null
  private var audioThread: Thread? = null
  private var frameBitmap: Bitmap? = null
  private var cameraBitmap: Bitmap? = null
  private var srcRectPx: Rect = Rect()
  private var targetWidth: Int = 1280
  private var targetHeight: Int = 720
  private var activityRef: WeakReference<Activity>? = null
  private var cachedSurfaceViewRef: WeakReference<SurfaceView>? = null

  private val isRecording = AtomicBoolean(false)
  private val isPaused = AtomicBoolean(false)
  private val frameInFlight = AtomicBoolean(false)

  private var recordingStartNs: Long = 0L
  private var pauseStartNs: Long = 0L
  private var pausedAccumulatedNs: Long = 0L

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
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("NO_CONTEXT", "React context is unavailable.", null)
        return@AsyncFunction
      }
      if (isRecording.get()) {
        promise.reject("BUSY", "A canvas recording is already in progress.", null)
        return@AsyncFunction
      }

      val requestedWidth = ((options["width"] as? Number)?.toInt() ?: 1280).coerceIn(320, 1920)
      val requestedHeight = ((options["height"] as? Number)?.toInt() ?: 720).coerceIn(240, 1920)
      val bitrate = ((options["bitrate"] as? Number)?.toInt() ?: 3_500_000).coerceAtLeast(500_000)
      val includeMic = (options["includeMic"] as? Boolean) ?: true
      @Suppress("UNCHECKED_CAST")
      val cropMap = options["cropRect"] as? Map<String, Any?>

      try {
        targetWidth = makeEven(requestedWidth)
        targetHeight = makeEven(requestedHeight)
        srcRectPx = computeSourceRectPx(activity, cropMap)
        activityRef = WeakReference(activity)

        val outFile = File(context.cacheDir, "flowcanvas-lesson-${UUID.randomUUID()}.mp4")
        val muxer = MediaMuxer(outFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)

        val videoFormat = MediaFormat.createVideoFormat(
          MediaFormat.MIMETYPE_VIDEO_AVC,
          targetWidth,
          targetHeight,
        ).apply {
          setInteger(
            MediaFormat.KEY_COLOR_FORMAT,
            MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface,
          )
          setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
          setInteger(MediaFormat.KEY_FRAME_RATE, TARGET_FPS)
          setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
        }

        val vCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        vCodec.configure(videoFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        val surface = vCodec.createInputSurface()
        vCodec.start()

        val hasMicPermission =
          ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

        var aCodec: MediaCodec? = null
        var aRecord: AudioRecord? = null
        var recordMic = false

        if (includeMic && hasMicPermission) {
          val minBuf = AudioRecord.getMinBufferSize(
            AUDIO_SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
          )
          if (minBuf > 0) {
            val candidateRecord = AudioRecord(
              MediaRecorder.AudioSource.MIC,
              AUDIO_SAMPLE_RATE,
              AudioFormat.CHANNEL_IN_MONO,
              AudioFormat.ENCODING_PCM_16BIT,
              minBuf * 2,
            )
            if (candidateRecord.state == AudioRecord.STATE_INITIALIZED) {
              val audioFormat = MediaFormat.createAudioFormat(
                MediaFormat.MIMETYPE_AUDIO_AAC,
                AUDIO_SAMPLE_RATE,
                1,
              ).apply {
                setInteger(
                  MediaFormat.KEY_AAC_PROFILE,
                  MediaCodecInfo.CodecProfileLevel.AACObjectLC,
                )
                setInteger(MediaFormat.KEY_BIT_RATE, AUDIO_BITRATE)
                setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, minBuf * 2)
              }
              val candidateCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
              candidateCodec.configure(audioFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
              candidateCodec.start()
              candidateRecord.startRecording()
              aRecord = candidateRecord
              aCodec = candidateCodec
              recordMic = true
            } else {
              candidateRecord.release()
            }
          }
        }

        synchronized(muxerLock) {
          mediaMuxer = muxer
          muxerStarted = false
          videoTrackIndex = -1
          audioTrackIndex = -1
          expectingAudioTrack = recordMic
        }

        synchronized(stateLock) {
          outputFile = outFile
          videoCodec = vCodec
          audioCodec = aCodec
          inputSurface = surface
          audioRecord = aRecord
          frameBitmap = Bitmap.createBitmap(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) targetWidth else srcRectPx.width(),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) targetHeight else srcRectPx.height(),
            Bitmap.Config.ARGB_8888,
          )
        }

        recordingStartNs = System.nanoTime()
        pauseStartNs = 0L
        pausedAccumulatedNs = 0L
        isPaused.set(false)
        frameInFlight.set(false)
        isRecording.set(true)

        val thread = HandlerThread("FlowCanvasVideoCapture").apply { start() }
        val handler = Handler(thread.looper)
        captureThread = thread
        captureHandler = handler
        scheduleNextFrame(handler)

        if (recordMic && aRecord != null && aCodec != null) {
          val aThread = Thread({ runAudioLoop(aRecord, aCodec) }, "FlowCanvasAudioCapture")
          audioThread = aThread
          aThread.start()
        }

        promise.resolve(mapOf("outputPath" to Uri.fromFile(outFile).toString()))
      } catch (t: Throwable) {
        cleanupRecording()
        promise.reject("START_FAILED", t.message ?: "Failed to start canvas recording.", null)
      }
    }

    AsyncFunction("pauseRecording") {
      if (isRecording.get() && isPaused.compareAndSet(false, true)) {
        pauseStartNs = System.nanoTime()
      }
    }

    AsyncFunction("resumeRecording") {
      if (isRecording.get() && isPaused.compareAndSet(true, false)) {
        if (pauseStartNs > 0L) {
          pausedAccumulatedNs += (System.nanoTime() - pauseStartNs).coerceAtLeast(0L)
          pauseStartNs = 0L
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

    AsyncFunction("saveVideoToGallery") { videoUri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("NO_CONTEXT", "React context is unavailable.", null)
        return@AsyncFunction
      }
      val parsed = Uri.parse(videoUri)
      val sourcePath = parsed.path
      val sourceFile = if (sourcePath != null) File(sourcePath) else null
      if (sourceFile == null || !sourceFile.exists() || sourceFile.length() <= 0L) {
        promise.reject("FILE_NOT_FOUND", "Recorded video file could not be found.", null)
        return@AsyncFunction
      }

      try {
        val fileName = "FlowCanvas-Lesson-${System.currentTimeMillis()}.mp4"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val values = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, fileName)
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
            put(
              MediaStore.Video.Media.RELATIVE_PATH,
              "${Environment.DIRECTORY_MOVIES}/FlowCanvas",
            )
            put(MediaStore.Video.Media.IS_PENDING, 1)
          }
          val resolver = context.contentResolver
          val collection = MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
          val itemUri = resolver.insert(collection, values)
          if (itemUri == null) {
            promise.reject("GALLERY_INSERT_FAILED", "Could not create gallery video entry.", null)
            return@AsyncFunction
          }
          resolver.openOutputStream(itemUri)?.use { outStream ->
            FileInputStream(sourceFile).use { inStream ->
              inStream.copyTo(outStream)
            }
          } ?: run {
            promise.reject("GALLERY_WRITE_FAILED", "Could not write video to gallery.", null)
            return@AsyncFunction
          }
          values.clear()
          values.put(MediaStore.Video.Media.IS_PENDING, 0)
          resolver.update(itemUri, values, null, null)
          promise.resolve(mapOf("saved" to true, "uri" to itemUri.toString()))
        } else {
          val hasWritePerm =
            ContextCompat.checkSelfPermission(
              context,
              Manifest.permission.WRITE_EXTERNAL_STORAGE,
            ) == PackageManager.PERMISSION_GRANTED
          if (!hasWritePerm) {
            promise.reject("PERMISSION_DENIED", "Storage permission is required to save to gallery.", null)
            return@AsyncFunction
          }
          @Suppress("DEPRECATION")
          val moviesDir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES),
            "FlowCanvas",
          )
          if (!moviesDir.exists()) moviesDir.mkdirs()
          val destFile = File(moviesDir, fileName)
          FileInputStream(sourceFile).use { inStream ->
            FileOutputStream(destFile).use { outStream ->
              inStream.copyTo(outStream)
            }
          }
          MediaScannerConnection.scanFile(
            context,
            arrayOf(destFile.absolutePath),
            arrayOf("video/mp4"),
            null,
          )
          promise.resolve(mapOf("saved" to true, "uri" to Uri.fromFile(destFile).toString()))
        }
      } catch (t: Throwable) {
        promise.reject("GALLERY_SAVE_FAILED", t.message ?: "Failed to save video to gallery.", null)
      }
    }
  }

  private fun computeSourceRectPx(activity: Activity, cropMap: Map<String, Any?>?): Rect {
    val decorView = activity.window?.decorView
    val maxW = (decorView?.width ?: targetWidth).coerceAtLeast(2)
    val maxH = (decorView?.height ?: targetHeight).coerceAtLeast(2)
    if (cropMap == null) {
      return Rect(0, 0, maxW, maxH)
    }

    val density = activity.resources.displayMetrics.density
    val xDp = (cropMap["x"] as? Number)?.toDouble() ?: 0.0
    val yDp = (cropMap["y"] as? Number)?.toDouble() ?: 0.0
    val wDp = (cropMap["width"] as? Number)?.toDouble() ?: 0.0
    val hDp = (cropMap["height"] as? Number)?.toDouble() ?: 0.0

    if (wDp <= 1.0 || hDp <= 1.0) {
      return Rect(0, 0, maxW, maxH)
    }

    val expectedW = (wDp * density).roundToInt()
    val expectedH = (hDp * density).roundToInt()
    if (decorView != null) {
      val matchedView = findViewByDimensions(decorView, expectedW, expectedH)
      if (matchedView != null) {
        val loc = IntArray(2)
        matchedView.getLocationInWindow(loc)
        val left = loc[0].coerceIn(0, maxW - 2)
        val top = loc[1].coerceIn(0, maxH - 2)
        val right = (loc[0] + matchedView.width).coerceIn(left + 2, maxW)
        val bottom = (loc[1] + matchedView.height).coerceIn(top + 2, maxH)
        return Rect(left, top, right, bottom)
      }
    }

    val left = (xDp * density).roundToInt().coerceIn(0, maxW - 2)
    val top = (yDp * density).roundToInt().coerceIn(0, maxH - 2)
    val right = ((xDp + wDp) * density).roundToInt().coerceIn(left + 2, maxW)
    val bottom = ((yDp + hDp) * density).roundToInt().coerceIn(top + 2, maxH)
    return Rect(left, top, right, bottom)
  }

  private fun findViewByDimensions(root: View, targetW: Int, targetH: Int): View? {
    if (root.visibility != View.VISIBLE) return null
    if (kotlin.math.abs(root.width - targetW) <= 6 &&
      kotlin.math.abs(root.height - targetH) <= 6 &&
      root !is SurfaceView
    ) {
      return root
    }
    if (root is ViewGroup) {
      for (i in 0 until root.childCount) {
        val found = findViewByDimensions(root.getChildAt(i), targetW, targetH)
        if (found != null) return found
      }
    }
    return null
  }

  private fun scheduleNextFrame(handler: Handler, delayMs: Long = FRAME_INTERVAL_MS) {
    if (!isRecording.get()) return
    handler.postDelayed(
      {
        if (!isRecording.get()) return@postDelayed
        if (isPaused.get()) {
          scheduleNextFrame(handler, FRAME_INTERVAL_MS)
          return@postDelayed
        }
        if (frameInFlight.compareAndSet(false, true)) {
          captureVideoFrame(handler)
        } else {
          scheduleNextFrame(handler, FRAME_INTERVAL_MS)
        }
      },
      delayMs,
    )
  }

  private fun findCameraSurfaceView(root: View): SurfaceView? {
    if (root is SurfaceView &&
      root.visibility == View.VISIBLE &&
      root.width > 0 &&
      root.height > 0 &&
      root.holder?.surface?.isValid == true
    ) {
      return root
    }
    if (root is ViewGroup) {
      for (i in 0 until root.childCount) {
        val found = findCameraSurfaceView(root.getChildAt(i))
        if (found != null) return found
      }
    }
    return null
  }

  private fun findSquareBubbleContainer(surfaceView: SurfaceView): View {
    var current: View = (surfaceView.parent as? View) ?: surfaceView
    var depth = 0
    while (depth < 4) {
      if (current.width > 0 &&
        current.height > 0 &&
        kotlin.math.abs(current.width - current.height) <= 4
      ) {
        return current
      }
      val next = current.parent as? View ?: break
      current = next
      depth++
    }
    return (surfaceView.parent as? View) ?: surfaceView
  }

  private fun getOrCreateCameraBitmap(width: Int, height: Int): Bitmap {
    val existing = cameraBitmap
    if (existing != null && !existing.isRecycled && existing.width == width && existing.height == height) {
      return existing
    }
    existing?.recycle()
    val created = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    cameraBitmap = created
    return created
  }

  private fun getDisplayRotationDegrees(activity: Activity): Float {
    val rotation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      activity.display?.rotation ?: Surface.ROTATION_0
    } else {
      @Suppress("DEPRECATION")
      activity.windowManager.defaultDisplay.rotation
    }
    return when (rotation) {
      Surface.ROTATION_90 -> -90f
      Surface.ROTATION_180 -> 180f
      Surface.ROTATION_270 -> 90f
      else -> 0f
    }
  }

  private fun getActiveCameraSurfaceView(root: View): SurfaceView? {
    val cached = cachedSurfaceViewRef?.get()
    if (cached != null &&
      cached.isAttachedToWindow &&
      cached.visibility == View.VISIBLE &&
      cached.width > 0 &&
      cached.height > 0 &&
      cached.holder?.surface?.isValid == true
    ) {
      return cached
    }
    val found = findCameraSurfaceView(root)
    cachedSurfaceViewRef = if (found != null) WeakReference(found) else null
    return found
  }

  private fun captureVideoFrame(handler: Handler) {
    val activity = activityRef?.get()
    val window = activity?.window
    val bitmap = frameBitmap
    if (window == null || activity.isFinishing || bitmap == null || bitmap.isRecycled) {
      frameInFlight.set(false)
      scheduleNextFrame(handler)
      return
    }

    val frameStartMs = android.os.SystemClock.uptimeMillis()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      try {
        val surfaceView = getActiveCameraSurfaceView(window.decorView)
        var svRect: Rect? = null
        var svBitmap: Bitmap? = null
        val mirrorHorizontally = (surfaceView?.scaleX ?: 1f) < 0f
        val cameraRotationDeg = getDisplayRotationDegrees(activity)
        if (surfaceView != null) {
          val containerView = findSquareBubbleContainer(surfaceView)
          val loc = IntArray(2)
          containerView.getLocationInWindow(loc)
          val candidate = Rect(
            loc[0],
            loc[1],
            loc[0] + containerView.width,
            loc[1] + containerView.height,
          )
          if (Rect.intersects(srcRectPx, candidate)) {
            svRect = candidate
            val swapAxes = cameraRotationDeg == -90f || cameraRotationDeg == 90f
            val bmpW = if (swapAxes) surfaceView.height else surfaceView.width
            val bmpH = if (swapAxes) surfaceView.width else surfaceView.height
            svBitmap = getOrCreateCameraBitmap(bmpW, bmpH)
          }
        }

        PixelCopy.request(
          window,
          srcRectPx,
          bitmap,
          { copyResult ->
            if (copyResult != PixelCopy.SUCCESS || !isRecording.get() || isPaused.get()) {
              frameInFlight.set(false)
              scheduleNextFrame(handler)
              return@request
            }

            if (surfaceView != null &&
              svRect != null &&
              svBitmap != null &&
              surfaceView.holder?.surface?.isValid == true
            ) {
              try {
                PixelCopy.request(
                  surfaceView,
                  svBitmap,
                  { svResult ->
                    try {
                      if (isRecording.get() && !isPaused.get()) {
                        drawBitmapToEncoder(
                          bitmap,
                          if (svResult == PixelCopy.SUCCESS) svBitmap else null,
                          svRect,
                          mirrorHorizontally,
                          cameraRotationDeg,
                        )
                      }
                    } finally {
                      frameInFlight.set(false)
                      val elapsed = android.os.SystemClock.uptimeMillis() - frameStartMs
                      scheduleNextFrame(handler, (FRAME_INTERVAL_MS - elapsed).coerceAtLeast(16L))
                    }
                  },
                  handler,
                )
              } catch (_: Throwable) {
                try {
                  drawBitmapToEncoder(bitmap, null, null, false, 0f)
                } finally {
                  frameInFlight.set(false)
                  scheduleNextFrame(handler)
                }
              }
            } else {
              try {
                drawBitmapToEncoder(bitmap, null, null, false, 0f)
              } finally {
                frameInFlight.set(false)
                val elapsed = android.os.SystemClock.uptimeMillis() - frameStartMs
                scheduleNextFrame(handler, (FRAME_INTERVAL_MS - elapsed).coerceAtLeast(16L))
              }
            }
          },
          handler,
        )
      } catch (_: Throwable) {
        frameInFlight.set(false)
        scheduleNextFrame(handler)
      }
    } else {
      try {
        val decor = window.decorView
        val canvas = Canvas(bitmap)
        canvas.save()
        canvas.translate(-srcRectPx.left.toFloat(), -srcRectPx.top.toFloat())
        decor.draw(canvas)
        canvas.restore()
        drawBitmapToEncoder(bitmap, null, null, false, 0f)
      } catch (_: Throwable) {
      } finally {
        frameInFlight.set(false)
        scheduleNextFrame(handler)
      }
    }
  }

  private fun drawBitmapToEncoder(
    bitmap: Bitmap,
    camBitmap: Bitmap?,
    camRectPx: Rect?,
    mirrorHorizontally: Boolean,
    cameraRotationDeg: Float,
  ) {
    val surface = inputSurface ?: return
    val codec = videoCodec ?: return
    if (!isRecording.get() || !surface.isValid) return

    try {
      val destRect = Rect(0, 0, targetWidth, targetHeight)
      val canvas = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        surface.lockHardwareCanvas()
      } else {
        surface.lockCanvas(null)
      }
      try {
        canvas.drawBitmap(bitmap, null, destRect, null)
        if (camBitmap != null && !camBitmap.isRecycled && camRectPx != null) {
          val scaleX = targetWidth.toFloat() / srcRectPx.width().toFloat()
          val scaleY = targetHeight.toFloat() / srcRectPx.height().toFloat()
          val rawLeft = (camRectPx.left - srcRectPx.left) * scaleX
          val rawTop = (camRectPx.top - srcRectPx.top) * scaleY
          val rawRight = (camRectPx.right - srcRectPx.left) * scaleX
          val rawBottom = (camRectPx.bottom - srcRectPx.top) * scaleY
          val cx = (rawLeft + rawRight) * 0.5f
          val cy = (rawTop + rawBottom) * 0.5f
          val halfSide = minOf(rawRight - rawLeft, rawBottom - rawTop) * 0.5f
          val dstRectF = RectF(cx - halfSide, cy - halfSide, cx + halfSide, cy + halfSide)
          val radius = halfSide
          val clipPath = Path().apply {
            addRoundRect(dstRectF, radius, radius, Path.Direction.CW)
          }
          val bw = camBitmap.width
          val bh = camBitmap.height
          val side = minOf(bw, bh)
          val cropLeft = (bw - side) / 2
          val cropTop = (bh - side) / 2
          val srcCrop = Rect(cropLeft, cropTop, cropLeft + side, cropTop + side)
          canvas.save()
          canvas.clipPath(clipPath)
          if (mirrorHorizontally) {
            canvas.scale(-1f, 1f, dstRectF.centerX(), dstRectF.centerY())
          }
          if (cameraRotationDeg != 0f) {
            canvas.rotate(cameraRotationDeg, dstRectF.centerX(), dstRectF.centerY())
          }
          canvas.drawBitmap(camBitmap, srcCrop, dstRectF, null)
          canvas.restore()
        }
      } finally {
        surface.unlockCanvasAndPost(canvas)
      }
      drainEncoder(codec, isVideo = true, endOfStream = false)
    } catch (_: Throwable) {
    }
  }

  private fun runAudioLoop(record: AudioRecord, codec: MediaCodec) {
    val bufferSize = 2048
    val pcmBuffer = ByteArray(bufferSize)
    try {
      while (isRecording.get()) {
        val read = record.read(pcmBuffer, 0, pcmBuffer.size)
        if (read <= 0 || isPaused.get()) {
          continue
        }
        val inputIndex = codec.dequeueInputBuffer(10_000)
        if (inputIndex >= 0) {
          val inputBuffer = codec.getInputBuffer(inputIndex)
          if (inputBuffer != null) {
            inputBuffer.clear()
            inputBuffer.put(pcmBuffer, 0, read)
            codec.queueInputBuffer(inputIndex, 0, read, currentPtsUs(), 0)
          }
        }
        drainEncoder(codec, isVideo = false, endOfStream = false)
      }

      val eosIndex = codec.dequeueInputBuffer(10_000)
      if (eosIndex >= 0) {
        codec.queueInputBuffer(
          eosIndex,
          0,
          0,
          currentPtsUs(),
          MediaCodec.BUFFER_FLAG_END_OF_STREAM,
        )
      }
      drainEncoder(codec, isVideo = false, endOfStream = true)
    } catch (_: Throwable) {
    }
  }

  private fun currentPtsUs(): Long {
    val elapsedNs = (System.nanoTime() - recordingStartNs - pausedAccumulatedNs).coerceAtLeast(0L)
    return elapsedNs / 1000L
  }

  private fun drainEncoder(codec: MediaCodec, isVideo: Boolean, endOfStream: Boolean) {
    val bufferInfo = MediaCodec.BufferInfo()
    var attempts = 0
    while (attempts < 32) {
      attempts++
      val outputIndex = codec.dequeueOutputBuffer(bufferInfo, if (endOfStream) 10_000L else 0L)
      when {
        outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> {
          if (!endOfStream) break
        }
        outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          synchronized(muxerLock) {
            val muxer = mediaMuxer ?: return
            val trackIdx = muxer.addTrack(codec.outputFormat)
            if (isVideo) {
              videoTrackIndex = trackIdx
            } else {
              audioTrackIndex = trackIdx
            }
            if (!muxerStarted &&
              videoTrackIndex != -1 &&
              (!expectingAudioTrack || audioTrackIndex != -1)
            ) {
              muxer.start()
              muxerStarted = true
            }
          }
        }
        outputIndex >= 0 -> {
          val encodedData = codec.getOutputBuffer(outputIndex)
          if (encodedData != null) {
            if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
              bufferInfo.size = 0
            }
            if (bufferInfo.size > 0) {
              synchronized(muxerLock) {
                val muxer = mediaMuxer
                val trackIndex = if (isVideo) videoTrackIndex else audioTrackIndex
                if (muxer != null && muxerStarted && trackIndex != -1) {
                  encodedData.position(bufferInfo.offset)
                  encodedData.limit(bufferInfo.offset + bufferInfo.size)
                  if (isVideo) {
                    bufferInfo.presentationTimeUs = currentPtsUs()
                  }
                  muxer.writeSampleData(trackIndex, encodedData, bufferInfo)
                }
              }
            }
          }
          codec.releaseOutputBuffer(outputIndex, false)
          if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
            break
          }
        }
      }
    }
  }

  private fun makeEven(value: Int): Int = if (value % 2 == 0) value else value + 1

  private fun cleanupRecording() {
    isRecording.set(false)
    isPaused.set(false)

    captureHandler?.removeCallbacksAndMessages(null)
    captureThread?.quitSafely()
    try {
      captureThread?.join(500)
    } catch (_: Throwable) {
    }
    captureThread = null
    captureHandler = null

    try {
      audioThread?.join(500)
    } catch (_: Throwable) {
    }
    audioThread = null

    try {
      audioRecord?.stop()
    } catch (_: Throwable) {
    }
    try {
      audioRecord?.release()
    } catch (_: Throwable) {
    }
    audioRecord = null

    val vCodec = videoCodec
    if (vCodec != null) {
      try {
        vCodec.signalEndOfInputStream()
        drainEncoder(vCodec, isVideo = true, endOfStream = true)
      } catch (_: Throwable) {
      }
      try {
        vCodec.stop()
      } catch (_: Throwable) {
      }
      try {
        vCodec.release()
      } catch (_: Throwable) {
      }
    }
    videoCodec = null

    val aCodec = audioCodec
    if (aCodec != null) {
      try {
        aCodec.stop()
      } catch (_: Throwable) {
      }
      try {
        aCodec.release()
      } catch (_: Throwable) {
      }
    }
    audioCodec = null

    try {
      inputSurface?.release()
    } catch (_: Throwable) {
    }
    inputSurface = null

    synchronized(muxerLock) {
      try {
        if (muxerStarted) {
          mediaMuxer?.stop()
        }
      } catch (_: Throwable) {
      }
      try {
        mediaMuxer?.release()
      } catch (_: Throwable) {
      }
      mediaMuxer = null
      muxerStarted = false
      videoTrackIndex = -1
      audioTrackIndex = -1
    }

    try {
      frameBitmap?.recycle()
    } catch (_: Throwable) {
    }
    frameBitmap = null
    try {
      cameraBitmap?.recycle()
    } catch (_: Throwable) {
    }
    cameraBitmap = null
    cachedSurfaceViewRef = null
    activityRef = null
    outputFile = null
  }

  companion object {
    private const val TARGET_FPS = 16
    private const val FRAME_INTERVAL_MS = 1000L / TARGET_FPS
    private const val AUDIO_SAMPLE_RATE = 44_100
    private const val AUDIO_BITRATE = 128_000
  }
}

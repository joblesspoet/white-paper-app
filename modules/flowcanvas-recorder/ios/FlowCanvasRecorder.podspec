Pod::Spec.new do |s|
  s.name           = 'FlowCanvasRecorder'
  s.version        = '1.0.0'
  s.summary        = 'Local ReplayKit screen and audio lesson recorder for FlowCanvas'
  s.description    = 'Captures screen video and microphone audio to MP4 using ReplayKit and AVAssetWriter.'
  s.license        = 'MIT'
  s.author         = 'FlowCanvas'
  s.homepage       = 'https://flowcanvas.local'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.source_files   = '**/*.swift'
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'ReplayKit', 'AVFoundation', 'CoreMedia'
end

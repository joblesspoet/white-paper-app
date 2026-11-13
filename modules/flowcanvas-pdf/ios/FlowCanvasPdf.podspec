require 'json'

Pod::Spec.new do |s|
  s.name           = 'FlowCanvasPdf'
  s.version        = '1.0.0'
  s.summary        = 'Local PDF page rasterizer for FlowCanvas'
  s.description    = 'Renders PDF pages to PNG images using PDFKit'
  s.author         = 'FlowCanvas'
  s.homepage       = 'https://flowcanvas.local'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PDFKit', 'UIKit'
  s.source_files = '**/*.{h,m,mm,swift}'
end

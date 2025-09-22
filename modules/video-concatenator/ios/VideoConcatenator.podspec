require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name             = 'VideoConcatenator'
  s.version          = package['version'] || '1.0.0'
  s.summary          = 'Local video concatenation via AVFoundation'
  s.description      = 'Concatenate MP4 clips natively on iOS using Expo Modules'
  s.license          = 'MIT'
  s.author           = { 'DreamAI' => 'dev@dream.ai' }
  s.homepage         = 'https://example.com'
  s.platform         = :ios, '15.1'
  s.swift_version    = '5.9'
  s.source           = { :path => '.' }           # ← Local path, no git
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end

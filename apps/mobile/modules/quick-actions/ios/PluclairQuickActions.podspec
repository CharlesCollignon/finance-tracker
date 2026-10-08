Pod::Spec.new do |s|
  s.name           = 'PluclairQuickActions'
  s.version        = '1.0.0'
  s.summary        = 'The home-screen quick actions, passed on to JavaScript'
  s.description    = 'Hands a pressed home-screen quick action to the router (apps/mobile/plugins/with-quick-actions.js).'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

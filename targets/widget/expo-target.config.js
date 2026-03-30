/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: 'widget',
  name: 'NotesWidget',
  entitlements: {
    'com.apple.security.application-groups': [
      `group.${config.ios?.bundleIdentifier || 'com.obsidiannotes.app'}`
    ]
  },
  deploymentTarget: '17.0'
});

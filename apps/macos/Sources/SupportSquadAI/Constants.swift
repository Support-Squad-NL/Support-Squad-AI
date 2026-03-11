import Foundation

// Stable identifier used for both the macOS LaunchAgent label and Nix-managed defaults suite.
// nix-supportsquadai writes app defaults into this suite to survive app bundle identifier churn.
let launchdLabel = "ai.supportsquadai.mac"
let gatewayLaunchdLabel = "ai.supportsquadai.gateway"
let onboardingVersionKey = "supportsquadai.onboardingVersion"
let onboardingSeenKey = "supportsquadai.onboardingSeen"
let currentOnboardingVersion = 7
let pauseDefaultsKey = "supportsquadai.pauseEnabled"
let iconAnimationsEnabledKey = "supportsquadai.iconAnimationsEnabled"
let swabbleEnabledKey = "supportsquadai.swabbleEnabled"
let swabbleTriggersKey = "supportsquadai.swabbleTriggers"
let voiceWakeTriggerChimeKey = "supportsquadai.voiceWakeTriggerChime"
let voiceWakeSendChimeKey = "supportsquadai.voiceWakeSendChime"
let showDockIconKey = "supportsquadai.showDockIcon"
let defaultVoiceWakeTriggers = ["supportsquadai"]
let voiceWakeMaxWords = 32
let voiceWakeMaxWordLength = 64
let voiceWakeMicKey = "supportsquadai.voiceWakeMicID"
let voiceWakeMicNameKey = "supportsquadai.voiceWakeMicName"
let voiceWakeLocaleKey = "supportsquadai.voiceWakeLocaleID"
let voiceWakeAdditionalLocalesKey = "supportsquadai.voiceWakeAdditionalLocaleIDs"
let voicePushToTalkEnabledKey = "supportsquadai.voicePushToTalkEnabled"
let talkEnabledKey = "supportsquadai.talkEnabled"
let iconOverrideKey = "supportsquadai.iconOverride"
let connectionModeKey = "supportsquadai.connectionMode"
let remoteTargetKey = "supportsquadai.remoteTarget"
let remoteIdentityKey = "supportsquadai.remoteIdentity"
let remoteProjectRootKey = "supportsquadai.remoteProjectRoot"
let remoteCliPathKey = "supportsquadai.remoteCliPath"
let canvasEnabledKey = "supportsquadai.canvasEnabled"
let cameraEnabledKey = "supportsquadai.cameraEnabled"
let systemRunPolicyKey = "supportsquadai.systemRunPolicy"
let systemRunAllowlistKey = "supportsquadai.systemRunAllowlist"
let systemRunEnabledKey = "supportsquadai.systemRunEnabled"
let locationModeKey = "supportsquadai.locationMode"
let locationPreciseKey = "supportsquadai.locationPreciseEnabled"
let peekabooBridgeEnabledKey = "supportsquadai.peekabooBridgeEnabled"
let deepLinkKeyKey = "supportsquadai.deepLinkKey"
let modelCatalogPathKey = "supportsquadai.modelCatalogPath"
let modelCatalogReloadKey = "supportsquadai.modelCatalogReload"
let cliInstallPromptedVersionKey = "supportsquadai.cliInstallPromptedVersion"
let heartbeatsEnabledKey = "supportsquadai.heartbeatsEnabled"
let debugPaneEnabledKey = "supportsquadai.debugPaneEnabled"
let debugFileLogEnabledKey = "supportsquadai.debug.fileLogEnabled"
let appLogLevelKey = "supportsquadai.debug.appLogLevel"
let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26

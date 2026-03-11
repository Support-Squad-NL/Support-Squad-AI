package ai.supportsquadai.android.node

import android.os.Build
import ai.supportsquadai.android.BuildConfig
import ai.supportsquadai.android.SecurePrefs
import ai.supportsquadai.android.gateway.GatewayClientInfo
import ai.supportsquadai.android.gateway.GatewayConnectOptions
import ai.supportsquadai.android.gateway.GatewayEndpoint
import ai.supportsquadai.android.gateway.GatewayTlsParams
import ai.supportsquadai.android.protocol.SupportSquadAICanvasA2UICommand
import ai.supportsquadai.android.protocol.SupportSquadAICanvasCommand
import ai.supportsquadai.android.protocol.SupportSquadAICameraCommand
import ai.supportsquadai.android.protocol.SupportSquadAILocationCommand
import ai.supportsquadai.android.protocol.SupportSquadAIScreenCommand
import ai.supportsquadai.android.protocol.SupportSquadAISmsCommand
import ai.supportsquadai.android.protocol.SupportSquadAICapability
import ai.supportsquadai.android.LocationMode
import ai.supportsquadai.android.VoiceWakeMode

class ConnectionManager(
  private val prefs: SecurePrefs,
  private val cameraEnabled: () -> Boolean,
  private val locationMode: () -> LocationMode,
  private val voiceWakeMode: () -> VoiceWakeMode,
  private val smsAvailable: () -> Boolean,
  private val hasRecordAudioPermission: () -> Boolean,
  private val manualTls: () -> Boolean,
) {
  companion object {
    internal fun resolveTlsParamsForEndpoint(
      endpoint: GatewayEndpoint,
      storedFingerprint: String?,
      manualTlsEnabled: Boolean,
    ): GatewayTlsParams? {
      val stableId = endpoint.stableId
      val stored = storedFingerprint?.trim().takeIf { !it.isNullOrEmpty() }
      val isManual = stableId.startsWith("manual|")

      if (isManual) {
        if (!manualTlsEnabled) return null
        if (!stored.isNullOrBlank()) {
          return GatewayTlsParams(
            required = true,
            expectedFingerprint = stored,
            allowTOFU = false,
            stableId = stableId,
          )
        }
        return GatewayTlsParams(
          required = true,
          expectedFingerprint = null,
          allowTOFU = false,
          stableId = stableId,
        )
      }

      // Prefer stored pins. Never let discovery-provided TXT override a stored fingerprint.
      if (!stored.isNullOrBlank()) {
        return GatewayTlsParams(
          required = true,
          expectedFingerprint = stored,
          allowTOFU = false,
          stableId = stableId,
        )
      }

      val hinted = endpoint.tlsEnabled || !endpoint.tlsFingerprintSha256.isNullOrBlank()
      if (hinted) {
        // TXT is unauthenticated. Do not treat the advertised fingerprint as authoritative.
        return GatewayTlsParams(
          required = true,
          expectedFingerprint = null,
          allowTOFU = false,
          stableId = stableId,
        )
      }

      return null
    }
  }

  fun buildInvokeCommands(): List<String> =
    buildList {
      add(SupportSquadAICanvasCommand.Present.rawValue)
      add(SupportSquadAICanvasCommand.Hide.rawValue)
      add(SupportSquadAICanvasCommand.Navigate.rawValue)
      add(SupportSquadAICanvasCommand.Eval.rawValue)
      add(SupportSquadAICanvasCommand.Snapshot.rawValue)
      add(SupportSquadAICanvasA2UICommand.Push.rawValue)
      add(SupportSquadAICanvasA2UICommand.PushJSONL.rawValue)
      add(SupportSquadAICanvasA2UICommand.Reset.rawValue)
      add(SupportSquadAIScreenCommand.Record.rawValue)
      if (cameraEnabled()) {
        add(SupportSquadAICameraCommand.Snap.rawValue)
        add(SupportSquadAICameraCommand.Clip.rawValue)
      }
      if (locationMode() != LocationMode.Off) {
        add(SupportSquadAILocationCommand.Get.rawValue)
      }
      if (smsAvailable()) {
        add(SupportSquadAISmsCommand.Send.rawValue)
      }
      if (BuildConfig.DEBUG) {
        add("debug.logs")
        add("debug.ed25519")
      }
      add("app.update")
    }

  fun buildCapabilities(): List<String> =
    buildList {
      add(SupportSquadAICapability.Canvas.rawValue)
      add(SupportSquadAICapability.Screen.rawValue)
      if (cameraEnabled()) add(SupportSquadAICapability.Camera.rawValue)
      if (smsAvailable()) add(SupportSquadAICapability.Sms.rawValue)
      if (voiceWakeMode() != VoiceWakeMode.Off && hasRecordAudioPermission()) {
        add(SupportSquadAICapability.VoiceWake.rawValue)
      }
      if (locationMode() != LocationMode.Off) {
        add(SupportSquadAICapability.Location.rawValue)
      }
    }

  fun resolvedVersionName(): String {
    val versionName = BuildConfig.VERSION_NAME.trim().ifEmpty { "dev" }
    return if (BuildConfig.DEBUG && !versionName.contains("dev", ignoreCase = true)) {
      "$versionName-dev"
    } else {
      versionName
    }
  }

  fun resolveModelIdentifier(): String? {
    return listOfNotNull(Build.MANUFACTURER, Build.MODEL)
      .joinToString(" ")
      .trim()
      .ifEmpty { null }
  }

  fun buildUserAgent(): String {
    val version = resolvedVersionName()
    val release = Build.VERSION.RELEASE?.trim().orEmpty()
    val releaseLabel = if (release.isEmpty()) "unknown" else release
    return "SupportSquadAIAndroid/$version (Android $releaseLabel; SDK ${Build.VERSION.SDK_INT})"
  }

  fun buildClientInfo(clientId: String, clientMode: String): GatewayClientInfo {
    return GatewayClientInfo(
      id = clientId,
      displayName = prefs.displayName.value,
      version = resolvedVersionName(),
      platform = "android",
      mode = clientMode,
      instanceId = prefs.instanceId.value,
      deviceFamily = "Android",
      modelIdentifier = resolveModelIdentifier(),
    )
  }

  fun buildNodeConnectOptions(): GatewayConnectOptions {
    return GatewayConnectOptions(
      role = "node",
      scopes = emptyList(),
      caps = buildCapabilities(),
      commands = buildInvokeCommands(),
      permissions = emptyMap(),
      client = buildClientInfo(clientId = "supportsquadai-android", clientMode = "node"),
      userAgent = buildUserAgent(),
    )
  }

  fun buildOperatorConnectOptions(): GatewayConnectOptions {
    return GatewayConnectOptions(
      role = "operator",
      scopes = listOf("operator.read", "operator.write", "operator.talk.secrets"),
      caps = emptyList(),
      commands = emptyList(),
      permissions = emptyMap(),
      client = buildClientInfo(clientId = "supportsquadai-control-ui", clientMode = "ui"),
      userAgent = buildUserAgent(),
    )
  }

  fun resolveTlsParams(endpoint: GatewayEndpoint): GatewayTlsParams? {
    val stored = prefs.loadGatewayTlsFingerprint(endpoint.stableId)
    return resolveTlsParamsForEndpoint(endpoint, storedFingerprint = stored, manualTlsEnabled = manualTls())
  }
}

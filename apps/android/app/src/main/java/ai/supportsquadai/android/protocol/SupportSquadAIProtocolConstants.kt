package ai.supportsquadai.android.protocol

enum class SupportSquadAICapability(val rawValue: String) {
  Canvas("canvas"),
  Camera("camera"),
  Screen("screen"),
  Sms("sms"),
  VoiceWake("voiceWake"),
  Location("location"),
}

enum class SupportSquadAICanvasCommand(val rawValue: String) {
  Present("canvas.present"),
  Hide("canvas.hide"),
  Navigate("canvas.navigate"),
  Eval("canvas.eval"),
  Snapshot("canvas.snapshot"),
  ;

  companion object {
    const val NamespacePrefix: String = "canvas."
  }
}

enum class SupportSquadAICanvasA2UICommand(val rawValue: String) {
  Push("canvas.a2ui.push"),
  PushJSONL("canvas.a2ui.pushJSONL"),
  Reset("canvas.a2ui.reset"),
  ;

  companion object {
    const val NamespacePrefix: String = "canvas.a2ui."
  }
}

enum class SupportSquadAICameraCommand(val rawValue: String) {
  Snap("camera.snap"),
  Clip("camera.clip"),
  ;

  companion object {
    const val NamespacePrefix: String = "camera."
  }
}

enum class SupportSquadAIScreenCommand(val rawValue: String) {
  Record("screen.record"),
  ;

  companion object {
    const val NamespacePrefix: String = "screen."
  }
}

enum class SupportSquadAISmsCommand(val rawValue: String) {
  Send("sms.send"),
  ;

  companion object {
    const val NamespacePrefix: String = "sms."
  }
}

enum class SupportSquadAILocationCommand(val rawValue: String) {
  Get("location.get"),
  ;

  companion object {
    const val NamespacePrefix: String = "location."
  }
}

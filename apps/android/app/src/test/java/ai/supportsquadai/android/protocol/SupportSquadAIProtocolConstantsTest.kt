package ai.supportsquadai.android.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class SupportSquadAIProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", SupportSquadAICanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", SupportSquadAICanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", SupportSquadAICanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", SupportSquadAICanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", SupportSquadAICanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", SupportSquadAICanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", SupportSquadAICanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", SupportSquadAICanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", SupportSquadAICapability.Canvas.rawValue)
    assertEquals("camera", SupportSquadAICapability.Camera.rawValue)
    assertEquals("screen", SupportSquadAICapability.Screen.rawValue)
    assertEquals("voiceWake", SupportSquadAICapability.VoiceWake.rawValue)
  }

  @Test
  fun screenCommandsUseStableStrings() {
    assertEquals("screen.record", SupportSquadAIScreenCommand.Record.rawValue)
  }
}

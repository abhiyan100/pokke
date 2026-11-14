// Posts a double-tap of Right Option into the session's event stream, the way
// a keyboard would, so the live test can check the hotkey end to end.
//
// Right Option is used because nothing in macOS reacts to it being tapped
// twice (Command opens Siri, Control starts Dictation). The events enter where
// a keyboard's do, so for the 40 ms of each tap the system believes Option is
// held: the test that runs this waits until nobody is typing.
import CoreGraphics
import Foundation

let rightOptionKey: CGKeyCode = 61
let source = CGEventSource(stateID: .hidSystemState)

func rightOption(down: Bool) {
  guard let event = CGEvent(keyboardEventSource: source, virtualKey: rightOptionKey, keyDown: down) else { exit(1) }
  event.type = .flagsChanged
  // The flags a real keyboard sends: Option, the "right-hand Option" device bit, and the
  // bit present on every hardware event. Key hooks tell the two Option keys apart by these.
  event.flags = CGEventFlags(rawValue: down ? 0x80140 : 0x100)
  event.post(tap: .cghidEventTap)
}

for tap in 0..<2 {
  if tap > 0 { usleep(130_000) }
  rightOption(down: true)
  usleep(40_000)
  rightOption(down: false)
}

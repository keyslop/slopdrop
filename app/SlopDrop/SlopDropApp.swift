import SwiftUI

@main
struct SlopDropApp: App {
    @State private var isPaired = ServerConfig.shared.isConfigured
    @StateObject private var store = RecordingStore()
    @StateObject private var uploader = Uploader.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if isPaired {
                    ContentView(store: store, uploader: uploader, isPaired: $isPaired)
                        .onAppear {
                            AudioRecorder.recoverOrphanedRecordings(store: store, uploader: uploader)
                        }
                } else {
                    PairingView(isPaired: $isPaired)
                }
            }
            .preferredColorScheme(.dark)
        }
    }
}

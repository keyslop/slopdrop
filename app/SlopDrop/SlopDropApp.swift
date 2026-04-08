import SwiftUI

@main
struct SlopDropApp: App {
    @State private var isPaired = ServerConfig.shared.isConfigured
    @StateObject private var store = RecordingStore()
    @StateObject private var uploader = Uploader.shared
    @State private var showLaunch = true

    var body: some Scene {
        WindowGroup {
            ZStack {
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
                .opacity(showLaunch ? 0 : 1)

                if showLaunch {
                    LaunchView()
                        .transition(.opacity)
                        .zIndex(1)
                }
            }
            .preferredColorScheme(.dark)
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
                    withAnimation(.easeOut(duration: 0.4)) {
                        showLaunch = false
                    }
                }
            }
        }
    }
}

import SwiftUI

struct ContentView: View {
    @StateObject private var recorder = AudioRecorder()
    @ObservedObject var store: RecordingStore
    @ObservedObject var uploader: Uploader
    @Binding var isPaired: Bool

    @State private var showSettings = false
    @State private var connectionStatus: ConnectionStatus = .unknown

    enum ConnectionStatus {
        case unknown, checking, ok, error(String)
    }

    var body: some View {
        ZStack {
            Color.slopBlack.ignoresSafeArea()

            VStack(spacing: 0) {
                // Terminal header
                headerBar
                    .padding(.horizontal, 16)
                    .padding(.top, 4)

                // Record button — compact
                RecordButton(
                    isRecording: recorder.isRecording,
                    duration: recorder.duration
                ) {
                    recorder.toggle(store: store, uploader: uploader)
                }
                .padding(.vertical, 24)

                // Recordings log — takes remaining space
                if store.recordings.isEmpty {
                    Spacer()
                    HStack(spacing: 4) {
                        Text(">")
                            .foregroundColor(.slopDimGreen)
                        Text("tap to record your first slop")
                            .foregroundColor(.slopDimGreen)
                        BlinkingCursor()
                    }
                    .font(.slopMono(13))
                    Spacer()
                } else {
                    recordingLog
                }

                // Status bar
                statusBar
                    .padding(.horizontal, 16)
                    .padding(.bottom, 4)
            }

            ScanlineOverlay()
                .ignoresSafeArea()
        }
        .onAppear {
            checkConnection()
            uploader.retryFailed(store: store)
        }
        .sheet(isPresented: $showSettings) {
            SettingsSheet(isPaired: $isPaired, connectionStatus: connectionStatus) {
                checkConnection()
            }
        }
    }

    private var headerBar: some View {
        HStack(spacing: 0) {
            Text("> ")
                .foregroundColor(.slopDimGreen)
            Text("SLOPDROP")
                .foregroundColor(.slopGreen)
            Text(" // ")
                .foregroundColor(.slopDimGreen)

            switch connectionStatus {
            case .unknown, .checking:
                Text("connecting...")
                    .foregroundColor(.slopDimGreen)
            case .ok:
                Text(store.recordings.isEmpty ? "connected" : "\(store.recordings.count) recordings")
                    .foregroundColor(.slopCyan)
            case .error(let msg):
                Text("✗ \(msg)")
                    .foregroundColor(.slopPink)
            }

            Spacer()

            Button { showSettings = true } label: {
                Text("⚙")
                    .font(.slopMono(14))
                    .foregroundColor(.slopDimGreen)
                    .padding(8)
            }
        }
        .font(.slopMono(12))
    }

    private var recordingLog: some View {
        ScrollView {
            LazyVStack(spacing: 2) {
                ForEach(store.recordings) { recording in
                    RecordingRow(recording: recording) {
                        uploader.upload(recording: recording, store: store)
                    }
                }
            }
            .padding(.horizontal, 16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var statusBar: some View {
        HStack(spacing: 0) {
            Text("$ ")
                .foregroundColor(.slopDimGreen)

            if let endpoint = ServerConfig.shared.endpoint {
                Text(endpoint.host ?? endpoint.absoluteString)
                    .foregroundColor(.slopDimGreen)
            }

            if let token = ServerConfig.shared.token {
                Text(" // ")
                    .foregroundColor(Color(white: 0.15))
                Text(String(token.prefix(8)) + "...")
                    .foregroundColor(.slopDimGreen)
            }
        }
        .font(.slopMono(10))
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func checkConnection() {
        connectionStatus = .checking
        guard let endpoint = ServerConfig.shared.endpoint else {
            connectionStatus = .error("no endpoint")
            return
        }
        Task {
            do {
                let url = endpoint.appendingPathComponent("api/health")
                let (_, response) = try await URLSession.shared.data(from: url)
                let http = response as? HTTPURLResponse
                if (200...299).contains(http?.statusCode ?? 0) {
                    connectionStatus = .ok
                } else {
                    connectionStatus = .error("\(http?.statusCode ?? 0)")
                }
            } catch {
                connectionStatus = .error("offline")
            }
        }
    }
}

// MARK: - Settings Sheet

struct SettingsSheet: View {
    @Binding var isPaired: Bool
    let connectionStatus: ContentView.ConnectionStatus
    let onRecheck: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.slopBlack.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 16) {
                Text("> SETTINGS")
                    .font(.slopMono(16, weight: .bold))
                    .foregroundColor(.slopGreen)
                    .padding(.top, 24)

                VStack(alignment: .leading, spacing: 6) {
                    Text("$ endpoint")
                        .font(.slopMono(11))
                        .foregroundColor(.slopDimGreen)
                    Text(ServerConfig.shared.endpoint?.absoluteString ?? "(none)")
                        .font(.slopMono(13))
                        .foregroundColor(.slopGreen)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("$ token")
                        .font(.slopMono(11))
                        .foregroundColor(.slopDimGreen)
                    Text(ServerConfig.shared.token ?? "(none)")
                        .font(.slopMono(11))
                        .foregroundColor(.slopGreen.opacity(0.6))
                        .lineLimit(1)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("$ status")
                        .font(.slopMono(11))
                        .foregroundColor(.slopDimGreen)
                    switch connectionStatus {
                    case .ok:
                        Text("✓ connected")
                            .font(.slopMono(13))
                            .foregroundColor(.slopGreen)
                    case .checking:
                        Text("checking...")
                            .font(.slopMono(13))
                            .foregroundColor(.slopCyan)
                    case .error(let msg):
                        Text("✗ \(msg)")
                            .font(.slopMono(13))
                            .foregroundColor(.slopPink)
                    case .unknown:
                        Text("unknown")
                            .font(.slopMono(13))
                            .foregroundColor(.slopDimGreen)
                    }
                }

                Spacer()

                VStack(spacing: 12) {
                    Button {
                        onRecheck()
                        dismiss()
                    } label: {
                        Text("> retry connection")
                            .font(.slopMono(13))
                            .foregroundColor(.slopCyan)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button {
                        ServerConfig.shared.clear()
                        isPaired = false
                        dismiss()
                    } label: {
                        Text("> disconnect & re-pair")
                            .font(.slopMono(13))
                            .foregroundColor(.slopPink)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.bottom, 32)
            }
            .padding(.horizontal, 24)

            ScanlineOverlay()
                .ignoresSafeArea()
        }
    }
}

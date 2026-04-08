import SwiftUI

struct ContentView: View {
    @StateObject private var recorder = AudioRecorder()
    @ObservedObject var store: RecordingStore
    @ObservedObject var uploader: Uploader
    @Binding var isPaired: Bool

    @State private var showPanel = false
    @State private var connectionStatus: ConnectionStatus = .unknown
    @State private var dismissedErrors: Set<String> = []

    enum ConnectionStatus {
        case unknown, checking, ok, error(String)
    }

    /// Errors that haven't been dismissed — shown on main screen
    private var activeErrors: [Recording] {
        store.recordings.filter {
            $0.syncStatus == .failed && !dismissedErrors.contains($0.id)
        }
    }

    var body: some View {
        ZStack {
            Color.slopBlack.ignoresSafeArea()

            VStack(spacing: 0) {
                // Top bar — just settings button, right-aligned
                HStack {
                    Spacer()

                    Button { showPanel = true } label: {
                        HStack(spacing: 6) {
                            connectionDot
                            Text("⚙")
                                .font(.slopMono(14))
                                .foregroundColor(.slopDimGreen)
                        }
                        .padding(8)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.top, 4)

                Spacer()

                // Errors bubble up to main screen
                if !activeErrors.isEmpty {
                    errorBanner
                        .padding(.horizontal, 16)
                        .padding(.bottom, 16)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }

                // Record button — bottom third, thumb-friendly
                RecordButton(
                    isRecording: recorder.isRecording,
                    duration: recorder.duration
                ) {
                    recorder.toggle(store: store, uploader: uploader)
                }
                .padding(.bottom, 12)

                // Hint line
                if !recorder.isRecording && store.recordings.isEmpty {
                    HStack(spacing: 4) {
                        Text(">")
                            .foregroundColor(.slopDimGreen)
                        Text("tap to record your first slop")
                            .foregroundColor(.slopDimGreen)
                        BlinkingCursor()
                    }
                    .font(.slopMono(13))
                    .padding(.bottom, 24)
                } else if !recorder.isRecording {
                    lastSyncStatus
                        .padding(.bottom, 24)
                } else {
                    Color.clear.frame(height: 48)
                }
            }

            ScanlineOverlay()
                .ignoresSafeArea()
        }
        .animation(.easeInOut(duration: 0.3), value: activeErrors.count)
        .onAppear {
            checkConnection()
            uploader.retryFailed(store: store)
        }
        .sheet(isPresented: $showPanel) {
            ControlPanelSheet(
                isPaired: $isPaired,
                connectionStatus: connectionStatus,
                store: store,
                uploader: uploader,
                onRecheck: { checkConnection() }
            )
        }
    }

    // MARK: - Connection dot on the settings button

    @ViewBuilder
    private var connectionDot: some View {
        switch connectionStatus {
        case .ok:
            Circle()
                .fill(Color.slopGreen)
                .frame(width: 6, height: 6)
                .shadow(color: .slopGreen.opacity(0.6), radius: 3)
        case .checking, .unknown:
            Circle()
                .fill(Color.slopCyan.opacity(0.5))
                .frame(width: 6, height: 6)
        case .error:
            Circle()
                .fill(Color.slopPink)
                .frame(width: 6, height: 6)
                .shadow(color: .slopPink.opacity(0.6), radius: 3)
        }
    }

    // MARK: - Last sync one-liner below the button

    private var lastSyncStatus: some View {
        HStack(spacing: 4) {
            Text(">")
                .foregroundColor(.slopDimGreen)

            let uploading = store.recordings.filter { $0.syncStatus == .uploading }
            let pending = store.recordings.filter { $0.syncStatus == .pending }
            let synced = store.recordings.filter { $0.syncStatus == .synced }

            if !uploading.isEmpty {
                Text("▸ uploading \(uploading.count) slop\(uploading.count == 1 ? "" : "s")...")
                    .foregroundColor(.slopCyan)
            } else if !pending.isEmpty {
                Text("○ \(pending.count) pending")
                    .foregroundColor(.slopDimGreen)
            } else if let last = synced.first {
                Text("✓ last slop synced")
                    .foregroundColor(.slopGreen)
                Text(formatTime(last.createdAt))
                    .foregroundColor(.slopDimGreen)
            } else {
                Text("ready")
                    .foregroundColor(.slopDimGreen)
            }
        }
        .font(.slopMono(11))
    }

    // MARK: - Errors that bubble up

    private var errorBanner: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(activeErrors.prefix(3)) { recording in
                HStack(spacing: 0) {
                    Text("✗ ")
                        .foregroundColor(.slopPink)
                    Text("upload failed")
                        .foregroundColor(.slopPink)
                    Text(" — ")
                        .foregroundColor(.slopDimGreen)
                    Text(shortError(recording.errorDetail))
                        .foregroundColor(.slopPink.opacity(0.7))
                        .lineLimit(1)

                    Spacer()

                    // Retry
                    Button {
                        uploader.upload(recording: recording, store: store)
                    } label: {
                        Text("retry")
                            .font(.slopMono(10, weight: .bold))
                            .foregroundColor(.slopGreen)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                    }

                    // Dismiss
                    Button {
                        withAnimation { _ = dismissedErrors.insert(recording.id) }
                    } label: {
                        Text("✗")
                            .font(.slopMono(10))
                            .foregroundColor(.slopDimGreen)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 2)
                    }
                }
                .font(.slopMono(10))
            }

            if activeErrors.count > 3 {
                Text("> \(activeErrors.count - 3) more — open ⚙ to see all")
                    .font(.slopMono(10))
                    .foregroundColor(.slopDimGreen)
            }
        }
    }

    // MARK: - Helpers

    private func shortError(_ detail: String?) -> String {
        guard let detail else { return "unknown" }
        // Grab first meaningful line, trim prefixes
        let line = detail
            .split(separator: "\n")
            .first
            .map(String.init) ?? detail
        let cleaned = line
            .replacingOccurrences(of: "[ERR] ", with: "")
            .prefix(40)
        return String(cleaned)
    }

    private func formatTime(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: date)
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

// MARK: - Control Panel (everything behind ⚙)

struct ControlPanelSheet: View {
    @Binding var isPaired: Bool
    let connectionStatus: ContentView.ConnectionStatus
    @ObservedObject var store: RecordingStore
    @ObservedObject var uploader: Uploader
    let onRecheck: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.slopBlack.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("> SLOPDROP")
                        .font(.slopMono(16, weight: .bold))
                        .foregroundColor(.slopGreen)
                        .padding(.top, 24)

                    // — server status
                    sectionHeader("server")

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 0) {
                            Text("$ endpoint  ")
                                .foregroundColor(.slopDimGreen)
                            Text(ServerConfig.shared.endpoint?.host ?? "(none)")
                                .foregroundColor(.slopGreen)
                        }

                        HStack(spacing: 0) {
                            Text("$ token     ")
                                .foregroundColor(.slopDimGreen)
                            Text(tokenPreview)
                                .foregroundColor(.slopGreen.opacity(0.6))
                        }

                        HStack(spacing: 0) {
                            Text("$ status    ")
                                .foregroundColor(.slopDimGreen)
                            statusText
                        }
                    }
                    .font(.slopMono(12))

                    // — actions
                    sectionHeader("actions")

                    HStack(spacing: 16) {
                        Button {
                            onRecheck()
                        } label: {
                            Text("> retry connection")
                                .font(.slopMono(12))
                                .foregroundColor(.slopCyan)
                        }

                        Button {
                            uploader.retryFailed(store: store)
                        } label: {
                            Text("> retry all failed")
                                .font(.slopMono(12))
                                .foregroundColor(.slopCyan)
                        }
                    }

                    // — recordings log
                    sectionHeader("slop log (\(store.recordings.count))")

                    if store.recordings.isEmpty {
                        HStack(spacing: 4) {
                            Text(">")
                                .foregroundColor(.slopDimGreen)
                            Text("no slops yet")
                                .foregroundColor(.slopDimGreen)
                        }
                        .font(.slopMono(12))
                    } else {
                        LazyVStack(spacing: 2) {
                            ForEach(store.recordings) { recording in
                                RecordingRow(recording: recording) {
                                    uploader.upload(recording: recording, store: store)
                                }
                            }
                        }
                    }

                    // — stats
                    sectionHeader("stats")

                    let synced = store.recordings.filter { $0.syncStatus == .synced }.count
                    let failed = store.recordings.filter { $0.syncStatus == .failed }.count
                    let total = store.recordings.count
                    let totalDuration = store.recordings.reduce(0.0) { $0 + $1.duration }

                    VStack(alignment: .leading, spacing: 4) {
                        statsLine("total slops", "\(total)")
                        statsLine("synced", "\(synced)", color: .slopGreen)
                        if failed > 0 {
                            statsLine("failed", "\(failed)", color: .slopPink)
                        }
                        if totalDuration > 0 {
                            statsLine("total time", formatLongDuration(totalDuration))
                        }
                    }
                    .font(.slopMono(12))

                    // — danger zone
                    Spacer().frame(height: 16)

                    Button {
                        ServerConfig.shared.clear()
                        isPaired = false
                        dismiss()
                    } label: {
                        Text("> disconnect & re-pair")
                            .font(.slopMono(12))
                            .foregroundColor(.slopPink)
                    }

                    Spacer().frame(height: 32)
                }
                .padding(.horizontal, 16)
            }

            ScanlineOverlay()
                .ignoresSafeArea()
        }
    }

    // MARK: - Subviews

    private func sectionHeader(_ title: String) -> some View {
        Text("// \(title)")
            .font(.slopMono(10))
            .foregroundColor(.slopDimGreen)
            .padding(.top, 8)
    }

    private func statsLine(_ label: String, _ value: String, color: Color = .slopCyan) -> some View {
        HStack(spacing: 0) {
            Text("  \(label)")
                .foregroundColor(.slopDimGreen)
                .frame(width: 120, alignment: .leading)
            Text(value)
                .foregroundColor(color)
        }
    }

    @ViewBuilder
    private var statusText: some View {
        switch connectionStatus {
        case .ok:
            Text("✓ connected")
                .foregroundColor(.slopGreen)
        case .checking:
            Text("checking...")
                .foregroundColor(.slopCyan)
        case .error(let msg):
            Text("✗ \(msg)")
                .foregroundColor(.slopPink)
        case .unknown:
            Text("unknown")
                .foregroundColor(.slopDimGreen)
        }
    }

    private var tokenPreview: String {
        guard let token = ServerConfig.shared.token else { return "(none)" }
        return String(token.prefix(8)) + "..."
    }

    private func formatLongDuration(_ t: TimeInterval) -> String {
        let hours = Int(t) / 3600
        let minutes = (Int(t) % 3600) / 60
        let seconds = Int(t) % 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        if minutes > 0 {
            return "\(minutes)m \(seconds)s"
        }
        return "\(seconds)s"
    }
}

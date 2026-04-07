import SwiftUI

struct RecordingRow: View {
    let recording: Recording
    var onRetry: (() -> Void)?
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Main log line
            Button {
                if recording.syncStatus == .failed {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        expanded.toggle()
                    }
                }
            } label: {
                HStack(spacing: 0) {
                    Text(timestamp(recording.createdAt))
                        .foregroundColor(.slopDimGreen)

                    Text("  ")

                    Text(formatDuration(recording.duration))
                        .foregroundColor(.slopGreen.opacity(0.7))

                    Text("  ")

                    statusText

                    Spacer()
                }
                .font(.slopMono(12))
                .padding(.vertical, 4)
            }
            .buttonStyle(.plain)

            // Error detail + retry (expandable)
            if expanded, recording.syncStatus == .failed {
                VStack(alignment: .leading, spacing: 4) {
                    if let error = recording.errorDetail {
                        ForEach(error.split(separator: "\n", omittingEmptySubsequences: false), id: \.self) { line in
                            Text(String(line))
                                .font(.slopMono(10))
                                .foregroundColor(.slopPink.opacity(0.8))
                        }
                    } else {
                        Text("[ERR] upload failed — no details")
                            .font(.slopMono(10))
                            .foregroundColor(.slopPink.opacity(0.8))
                    }

                    HStack(spacing: 16) {
                        Button {
                            onRetry?()
                        } label: {
                            Text("> retry upload")
                                .font(.slopMono(10, weight: .bold))
                                .foregroundColor(.slopGreen)
                        }

                        if let error = recording.errorDetail {
                            Button {
                                UIPasteboard.general.string = error
                            } label: {
                                Text("> copy error")
                                    .font(.slopMono(10))
                                    .foregroundColor(.slopCyan.opacity(0.6))
                            }
                        }
                    }
                    .padding(.top, 2)
                }
                .padding(.leading, 16)
                .padding(.bottom, 6)
            }
        }
    }

    @ViewBuilder
    private var statusText: some View {
        switch recording.syncStatus {
        case .recording:
            HStack(spacing: 4) {
                Text("● REC")
                    .foregroundColor(.slopPink)
                Text("writing to disk")
                    .foregroundColor(.slopPink.opacity(0.6))
            }
        case .pending:
            Text("○ pending")
                .foregroundColor(.slopDimGreen)
        case .uploading:
            HStack(spacing: 4) {
                Text("▸ uploading")
                    .foregroundColor(.slopCyan)
                ProgressView()
                    .controlSize(.mini)
                    .tint(.slopCyan)
            }
        case .synced:
            HStack(spacing: 0) {
                Text("✓ synced")
                    .foregroundColor(.slopGreen)
                if let sid = recording.serverId {
                    Text("  \(sid)")
                        .foregroundColor(.slopDimGreen)
                }
            }
        case .failed:
            Text("✗ failed — tap to expand")
                .foregroundColor(.slopPink)
        }
    }

    private func timestamp(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f.string(from: date)
    }

    private func formatDuration(_ t: TimeInterval) -> String {
        let minutes = Int(t) / 60
        let seconds = Int(t) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

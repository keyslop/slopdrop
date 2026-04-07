import SwiftUI

struct RecordButton: View {
    let isRecording: Bool
    let duration: TimeInterval
    let action: () -> Void

    @State private var glowPulse = false

    var body: some View {
        Button(action: action) {
            ZStack {
                // Outer grid ring
                Circle()
                    .stroke(
                        isRecording ? Color.slopPink.opacity(0.15) : Color.slopGreen.opacity(0.08),
                        lineWidth: 1
                    )
                    .frame(width: 110, height: 110)

                // Glow ring
                Circle()
                    .stroke(
                        isRecording ? Color.slopPink : Color.slopGreen,
                        lineWidth: 2
                    )
                    .frame(width: 90, height: 90)
                    .shadow(color: isRecording ? .slopPink.opacity(0.6) : .slopGreen.opacity(0.3), radius: glowPulse ? 16 : 8)
                    .shadow(color: isRecording ? .slopPink.opacity(0.3) : .slopGreen.opacity(0.15), radius: glowPulse ? 30 : 15)

                // Main button
                Circle()
                    .fill(Color(white: 0.05))
                    .frame(width: 74, height: 74)
                    .overlay(
                        Circle()
                            .stroke(
                                isRecording ? Color.slopPink.opacity(0.4) : Color.slopGreen.opacity(0.2),
                                lineWidth: 1
                            )
                    )

                // Inner content
                if isRecording {
                    VStack(spacing: 2) {
                        Text("REC")
                            .font(.slopMono(8, weight: .bold))
                            .foregroundColor(.slopPink)

                        Text(formatDuration(duration))
                            .font(.slopMono(18, weight: .medium))
                            .foregroundColor(.slopPink)
                    }
                } else {
                    Circle()
                        .fill(Color.slopPink)
                        .frame(width: 22, height: 22)
                        .shadow(color: .slopPink.opacity(0.5), radius: 6)
                }
            }
        }
        .buttonStyle(.plain)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                glowPulse = true
            }
        }
    }

    private func formatDuration(_ t: TimeInterval) -> String {
        let minutes = Int(t) / 60
        let seconds = Int(t) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

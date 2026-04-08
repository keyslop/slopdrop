import SwiftUI

/// CRT-styled splash screen matching the CLI banner.
/// Shows the SLOPDROP branding with scanlines, then fades out.
struct LaunchView: View {
    @State private var taglineVisible = false
    @State private var cursorVisible = true
    @State private var glitchOffset: CGFloat = 0

    /// Colors from CLI: #FF6B35 (SLOP) and #FF8C42 (DROP)
    private let slopOrange = Color(red: 1.0, green: 0.42, blue: 0.21)
    private let dropOrange = Color(red: 1.0, green: 0.55, blue: 0.26)

    var body: some View {
        ZStack {
            Color.slopBlack.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Banner — two-tone like CLI
                bannerText
                    .padding(.bottom, 12)

                // Tagline
                if taglineVisible {
                    HStack(spacing: 4) {
                        Text(">")
                            .foregroundColor(.slopDimGreen)
                        Text("drop your voice slop on your own server.")
                            .foregroundColor(.slopDimGreen)
                        // Blinking cursor
                        Text("█")
                            .foregroundColor(.slopGreen)
                            .opacity(cursorVisible ? 1 : 0)
                    }
                    .font(.slopMono(11))
                    .transition(.opacity)
                }

                Spacer()

                // Version line at bottom
                Text("v1.0.0")
                    .font(.slopMono(10))
                    .foregroundColor(Color(white: 0.15))
                    .padding(.bottom, 24)
            }

            ScanlineOverlay()
                .ignoresSafeArea()
        }
        .onAppear {
            // Tagline types in after a beat
            withAnimation(.easeIn(duration: 0.3).delay(0.4)) {
                taglineVisible = true
            }
            // Cursor blink
            withAnimation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true).delay(0.5)) {
                cursorVisible = false
            }
            // Subtle glitch
            withAnimation(.easeInOut(duration: 0.08).repeatForever(autoreverses: true)) {
                glitchOffset = 1
            }
        }
    }

    private var bannerText: some View {
        ZStack {
            // Glitch layers
            Text("SLOPDROP")
                .font(.slopMono(32, weight: .bold))
                .foregroundColor(.slopPink.opacity(0.3))
                .offset(x: 2 + glitchOffset, y: -1)

            Text("SLOPDROP")
                .font(.slopMono(32, weight: .bold))
                .foregroundColor(.slopCyan.opacity(0.2))
                .offset(x: -2 - glitchOffset, y: 1)

            // Main text — two-tone
            HStack(spacing: 0) {
                Text("SLOP")
                    .foregroundColor(slopOrange)
                Text("DROP")
                    .foregroundColor(dropOrange)
            }
            .font(.slopMono(32, weight: .bold))
            .shadow(color: slopOrange.opacity(0.3), radius: 8)
        }
    }
}

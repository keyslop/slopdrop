import SwiftUI

// MARK: - Colors (from kabard.in source)

extension Color {
    static let slopGreen = Color(red: 0, green: 1, blue: 0)                    // #00FF00
    static let slopCyan = Color(red: 0, green: 1, blue: 0.62)                  // #00FF9F
    static let slopPink = Color(red: 1, green: 0, blue: 0.25)                  // #FF0040
    static let slopBlack = Color(red: 0, green: 0, blue: 0)                    // #000000
    static let slopDimGreen = Color(red: 0.1, green: 0.3, blue: 0.1)           // #1A4D1A
    static let slopFog = Color(red: 0, green: 0.03, blue: 0.016)               // #000804
}

// MARK: - Fonts

extension Font {
    static func slopMono(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }
}

// MARK: - Scanline Overlay (CRT effect from kabard.in)

struct ScanlineOverlay: View {
    var opacity: Double = 0.06

    var body: some View {
        Canvas { context, size in
            for y in stride(from: 0, to: size.height, by: 3) {
                let rect = CGRect(x: 0, y: y, width: size.width, height: 1)
                context.fill(Path(rect), with: .color(.black.opacity(opacity)))
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Glitch Text (pink/cyan offset on error)

struct GlitchText: View {
    let text: String
    let size: CGFloat
    var isGlitching: Bool = true

    @State private var offset: CGFloat = 0

    var body: some View {
        ZStack {
            if isGlitching {
                Text(text)
                    .font(.slopMono(size, weight: .bold))
                    .foregroundColor(.slopPink.opacity(0.7))
                    .offset(x: 2 + offset, y: -1)

                Text(text)
                    .font(.slopMono(size, weight: .bold))
                    .foregroundColor(.slopCyan.opacity(0.5))
                    .offset(x: -2 - offset, y: 1)
            }

            Text(text)
                .font(.slopMono(size, weight: .bold))
                .foregroundColor(.slopGreen)
        }
        .onAppear {
            if isGlitching {
                withAnimation(.easeInOut(duration: 0.1).repeatForever(autoreverses: true)) {
                    offset = 1
                }
            }
        }
    }
}

// MARK: - Blinking Cursor

struct BlinkingCursor: View {
    @State private var visible = true

    var body: some View {
        Text("█")
            .font(.slopMono(14))
            .foregroundColor(.slopGreen)
            .opacity(visible ? 1 : 0)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true)) {
                    visible = false
                }
            }
    }
}

// MARK: - Terminal Line

struct TerminalLine: View {
    let prefix: String
    let text: String
    var color: Color = .slopGreen

    var body: some View {
        HStack(spacing: 4) {
            Text(prefix)
                .foregroundColor(.slopDimGreen)
            Text(text)
                .foregroundColor(color)
        }
        .font(.slopMono(13))
    }
}

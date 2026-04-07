import SwiftUI
import AVFoundation

struct PairingView: View {
    @Binding var isPaired: Bool
    @State private var showManualEntry = false
    @State private var manualEndpoint = ""
    @State private var manualToken = ""
    @State private var errorMessage: String?
    @State private var statusLine = "waiting for QR scan"

    var body: some View {
        ZStack {
            Color.slopBlack.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Branding
                VStack(spacing: 8) {
                    GlitchText(text: "]{-SLOP", size: 28, isGlitching: false)

                    Text("SLOPDROP")
                        .font(.slopMono(14, weight: .bold))
                        .foregroundColor(.slopGreen.opacity(0.5))
                        .tracking(6)
                }
                .padding(.bottom, 32)

                // QR Scanner
                ZStack {
                    QRScannerView { code in
                        handleScanned(code)
                    }
                    .frame(width: 220, height: 220)

                    // Green border (sharp corners, terminal feel)
                    Rectangle()
                        .stroke(Color.slopGreen.opacity(0.6), lineWidth: 1)
                        .frame(width: 220, height: 220)

                    // Corner accents
                    cornerAccents
                }
                .padding(.bottom, 16)

                // Status line
                HStack(spacing: 4) {
                    Text(">")
                        .foregroundColor(.slopDimGreen)
                    Text(statusLine)
                        .foregroundColor(.slopGreen)
                    if errorMessage == nil {
                        BlinkingCursor()
                    }
                }
                .font(.slopMono(13))
                .padding(.bottom, 8)

                // Error
                if let errorMessage {
                    Text("[ERR] \(errorMessage)")
                        .font(.slopMono(11))
                        .foregroundColor(.slopPink)
                        .padding(.bottom, 8)
                }

                Spacer()

                // Manual entry
                Button {
                    showManualEntry = true
                } label: {
                    Text("$ manual entry")
                        .font(.slopMono(12))
                        .foregroundColor(.slopDimGreen)
                }
                .padding(.bottom, 40)
            }

            ScanlineOverlay()
                .ignoresSafeArea()
        }
        .sheet(isPresented: $showManualEntry) {
            ManualEntrySheet(
                endpoint: $manualEndpoint,
                token: $manualToken,
                onConnect: { endpoint, token in
                    saveAndPair(endpoint: endpoint, token: token)
                }
            )
        }
    }

    private var cornerAccents: some View {
        ZStack {
            // Top-left
            VStack { HStack { cornerL; Spacer() }; Spacer() }
            // Top-right
            VStack { HStack { Spacer(); cornerR }; Spacer() }
            // Bottom-left
            VStack { Spacer(); HStack { cornerL; Spacer() } }
            // Bottom-right
            VStack { Spacer(); HStack { Spacer(); cornerR } }
        }
        .frame(width: 230, height: 230)
    }

    private var cornerL: some View {
        Path { p in
            p.move(to: CGPoint(x: 0, y: 16))
            p.addLine(to: CGPoint(x: 0, y: 0))
            p.addLine(to: CGPoint(x: 16, y: 0))
        }
        .stroke(Color.slopGreen, lineWidth: 2)
        .frame(width: 16, height: 16)
    }

    private var cornerR: some View {
        Path { p in
            p.move(to: CGPoint(x: 0, y: 0))
            p.addLine(to: CGPoint(x: 16, y: 0))
            p.addLine(to: CGPoint(x: 16, y: 16))
        }
        .stroke(Color.slopGreen, lineWidth: 2)
        .frame(width: 16, height: 16)
    }

    private func handleScanned(_ code: String) {
        guard let data = code.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: String],
              let endpoint = json["endpoint"],
              let token = json["token"] else {
            errorMessage = "invalid QR — expected {\"endpoint\":...,\"token\":...}"
            statusLine = "scan failed"
            return
        }
        statusLine = "connecting to \(endpoint)..."
        saveAndPair(endpoint: endpoint, token: token)
    }

    private func saveAndPair(endpoint: String, token: String) {
        guard !endpoint.isEmpty, !token.isEmpty else {
            errorMessage = "endpoint and token required"
            return
        }
        ServerConfig.shared.save(endpoint: endpoint, token: token)
        statusLine = "paired ✓"
        errorMessage = nil

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            isPaired = true
        }
    }
}

// MARK: - QR Scanner

struct QRScannerView: UIViewControllerRepresentable {
    let onScanned: (String) -> Void

    func makeUIViewController(context: Context) -> QRScannerViewController {
        let vc = QRScannerViewController()
        vc.onScanned = onScanned
        return vc
    }

    func updateUIViewController(_ uiViewController: QRScannerViewController, context: Context) {}
}

class QRScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onScanned: ((String) -> Void)?
    private var captureSession: AVCaptureSession?
    private var hasScanned = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        let session = AVCaptureSession()
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device) else {
            showPlaceholder()
            return
        }

        session.addInput(input)
        let output = AVCaptureMetadataOutput()
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.frame = view.bounds
        preview.videoGravity = .resizeAspectFill
        view.layer.addSublayer(preview)

        captureSession = session
        DispatchQueue.global(qos: .userInitiated).async {
            session.startRunning()
        }
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        captureSession?.stopRunning()
    }

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard !hasScanned,
              let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              let value = object.stringValue else { return }
        hasScanned = true
        captureSession?.stopRunning()
        onScanned?(value)
    }

    private func showPlaceholder() {
        let label = UILabel()
        label.text = "> no camera\n> use $ manual entry"
        label.textColor = UIColor(red: 0, green: 1, blue: 0, alpha: 0.4)
        label.font = UIFont.monospacedSystemFont(ofSize: 13, weight: .regular)
        label.textAlignment = .center
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }
}

// MARK: - Manual Entry (terminal-styled)

struct ManualEntrySheet: View {
    @Binding var endpoint: String
    @Binding var token: String
    let onConnect: (String, String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.slopBlack.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 20) {
                Text("> MANUAL PAIRING")
                    .font(.slopMono(16, weight: .bold))
                    .foregroundColor(.slopGreen)
                    .padding(.top, 24)

                // Endpoint
                VStack(alignment: .leading, spacing: 6) {
                    Text("$ endpoint:")
                        .font(.slopMono(12))
                        .foregroundColor(.slopDimGreen)
                    TextField("https://voice.example.com", text: $endpoint)
                        .font(.slopMono(14))
                        .foregroundColor(.slopGreen)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                        .keyboardType(.URL)
                        .padding(10)
                        .background(Color(white: 0.05))
                        .overlay(Rectangle().stroke(Color.slopGreen.opacity(0.3), lineWidth: 1))
                }

                // Token
                VStack(alignment: .leading, spacing: 6) {
                    Text("$ token:")
                        .font(.slopMono(12))
                        .foregroundColor(.slopDimGreen)
                    TextField("sd_...", text: $token)
                        .font(.slopMono(14))
                        .foregroundColor(.slopGreen)
                        .autocapitalization(.none)
                        .padding(10)
                        .background(Color(white: 0.05))
                        .overlay(Rectangle().stroke(Color.slopGreen.opacity(0.3), lineWidth: 1))
                }

                Spacer()

                HStack {
                    Button {
                        dismiss()
                    } label: {
                        Text("> cancel")
                            .font(.slopMono(13))
                            .foregroundColor(.slopDimGreen)
                    }

                    Spacer()

                    Button {
                        onConnect(endpoint, token)
                        dismiss()
                    } label: {
                        Text("> connect")
                            .font(.slopMono(13, weight: .bold))
                            .foregroundColor(.slopGreen)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .overlay(Rectangle().stroke(Color.slopGreen, lineWidth: 1))
                    }
                    .disabled(endpoint.isEmpty || token.isEmpty)
                    .opacity(endpoint.isEmpty || token.isEmpty ? 0.3 : 1)
                }
                .padding(.bottom, 24)
            }
            .padding(.horizontal, 24)

            ScanlineOverlay()
                .ignoresSafeArea()
        }
    }
}

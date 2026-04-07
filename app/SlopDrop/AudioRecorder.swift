import AVFoundation
import Foundation
import UIKit

/// Meteorite-safe audio recorder.
///
/// AVAudioRecorder writes m4a/AAC directly to disk — every second is persisted
/// immediately. If the phone dies mid-recording, the file is intact up to that moment.
///
/// On start: we immediately register the recording in RecordingStore with .recording status
/// so even a crash leaves a recoverable entry pointing to the file on disk.
///
/// While recording: we stream chunks to the server every N seconds (optimistic upload).
/// The server accepts these as append operations to a session.

@MainActor
final class AudioRecorder: ObservableObject {
    @Published var isRecording = false
    @Published var duration: TimeInterval = 0

    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var startTime: Date?
    private var outputURL: URL?
    private var activeRecordingId: String?
    private var streamer: StreamUploader?

    func toggle(store: RecordingStore, uploader: Uploader) {
        if isRecording {
            stop(store: store, uploader: uploader)
        } else {
            start(store: store)
        }
    }

    func start(store: RecordingStore) {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .default)
            try session.setActive(true)
        } catch {
            print("[SlopDrop] audio session error: \(error)")
            return
        }

        switch AVAudioApplication.shared.recordPermission {
        case .undetermined:
            AVAudioApplication.requestRecordPermission { [weak self] granted in
                if granted {
                    Task { @MainActor [weak self] in self?.startRecording(store: store) }
                }
            }
        case .granted:
            startRecording(store: store)
        case .denied:
            print("[SlopDrop] mic permission denied")
        @unknown default:
            break
        }
    }

    private func startRecording(store: RecordingStore) {
        let recordingsDir = store.recordingsDirectory

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
        formatter.timeZone = TimeZone(identifier: "UTC")
        let filename = "\(formatter.string(from: Date())).m4a"
        let url = recordingsDir.appendingPathComponent(filename)
        outputURL = url

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100.0,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
        ]

        do {
            recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder?.record()
            isRecording = true
            startTime = Date()
            duration = 0

            // IMMEDIATELY register in store — if we crash, recovery finds this entry
            let recording = store.addRecording(localFilename: filename, duration: 0, status: .recording)
            activeRecordingId = recording.id
            print("[SlopDrop] ● REC → \(filename) (saved to store immediately)")

            // Start streaming upload if online
            streamer = StreamUploader(recordingId: recording.id, fileURL: url, store: store)
            streamer?.start()

            UIImpactFeedbackGenerator(style: .medium).impactOccurred()

            timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard let self, let start = self.startTime else { return }
                    self.duration = Date().timeIntervalSince(start)
                }
            }
        } catch {
            print("[SlopDrop] recording error: \(error)")
        }
    }

    func stop(store: RecordingStore, uploader: Uploader) {
        recorder?.stop()
        timer?.invalidate()
        timer = nil
        isRecording = false

        UIImpactFeedbackGenerator(style: .light).impactOccurred()

        // Stop streaming
        streamer?.stop()
        streamer = nil

        guard let url = outputURL, FileManager.default.fileExists(atPath: url.path) else { return }
        let finalDuration = duration

        // Update the recording entry that was created at start
        if let id = activeRecordingId {
            store.updateDuration(id, duration: finalDuration)
            store.updateStatus(id, status: .pending)
            // Full upload of final file
            if let recording = store.recordings.first(where: { $0.id == id }) {
                uploader.upload(recording: recording, store: store)
            }
            print("[SlopDrop] ■ STOP → \(url.lastPathComponent) (\(String(format: "%.1f", finalDuration))s)")
        }

        duration = 0
        outputURL = nil
        startTime = nil
        activeRecordingId = nil
    }

    /// Called on app launch to recover any recordings that were in .recording state
    /// (meaning the app was killed mid-recording). The file on disk is valid.
    static func recoverOrphanedRecordings(store: RecordingStore, uploader: Uploader) {
        let orphaned = store.recordings.filter { $0.syncStatus == .recording }
        for var recording in orphaned {
            let fileURL = store.fileURL(for: recording)
            if FileManager.default.fileExists(atPath: fileURL.path) {
                // File exists — get actual duration from the file
                let asset = AVURLAsset(url: fileURL)
                let duration = CMTimeGetSeconds(asset.duration)
                store.updateDuration(recording.id, duration: duration.isFinite ? duration : 0)
                store.updateStatus(recording.id, status: .pending)
                print("[SlopDrop] recovered orphan: \(recording.localFilename) (\(String(format: "%.1f", duration))s)")
                // Trigger upload
                if let updated = store.recordings.first(where: { $0.id == recording.id }) {
                    uploader.upload(recording: updated, store: store)
                }
            } else {
                // File gone — remove the entry
                store.removeRecording(recording.id)
                print("[SlopDrop] removed orphan (no file): \(recording.localFilename)")
            }
        }
    }
}

// MARK: - Stream Uploader (optimistic upload while recording)

/// Streams chunks of the recording file to the server while recording is in progress.
/// Every few seconds, reads new bytes from the file and POSTs them as an append
/// to the server's streaming session.
@MainActor
final class StreamUploader {
    private let recordingId: String
    private let fileURL: URL
    private weak var store: RecordingStore?
    private var timer: Timer?
    private var lastBytesSent: Int = 0
    private var sessionId: String?
    private var isActive = false

    init(recordingId: String, fileURL: URL, store: RecordingStore) {
        self.recordingId = recordingId
        self.fileURL = fileURL
        self.store = store
    }

    func start() {
        guard let endpoint = ServerConfig.shared.endpoint,
              let token = ServerConfig.shared.token else { return }

        isActive = true
        lastBytesSent = 0

        // Open a streaming session on the server
        Task {
            let url = endpoint.appendingPathComponent("api/stream/start")
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            let body: [String: Any] = [
                "filename": fileURL.lastPathComponent,
                "recording_id": recordingId,
            ]
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)

            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                let http = response as? HTTPURLResponse
                if (200...299).contains(http?.statusCode ?? 0),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let sid = json["session_id"] as? String {
                    sessionId = sid
                    print("[SlopDrop] stream session: \(sid)")
                    startChunkTimer()
                } else {
                    print("[SlopDrop] stream start failed: \(http?.statusCode ?? 0)")
                }
            } catch {
                print("[SlopDrop] stream start error: \(error.localizedDescription)")
            }
        }
    }

    private func startChunkTimer() {
        // Send chunks every 5 seconds
        timer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.sendChunk()
            }
        }
    }

    private func sendChunk() {
        guard isActive,
              let sessionId,
              let endpoint = ServerConfig.shared.endpoint,
              let token = ServerConfig.shared.token else { return }

        guard let fileData = try? Data(contentsOf: fileURL) else { return }
        let currentSize = fileData.count

        if currentSize <= lastBytesSent { return } // No new data

        let chunk = fileData.subdata(in: lastBytesSent..<currentSize)
        let offset = lastBytesSent
        lastBytesSent = currentSize

        Task {
            let url = endpoint.appendingPathComponent("api/stream/\(sessionId)/chunk")
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
            request.setValue("\(offset)", forHTTPHeaderField: "X-Chunk-Offset")
            request.httpBody = chunk

            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                let http = response as? HTTPURLResponse
                if !(200...299).contains(http?.statusCode ?? 0) {
                    print("[SlopDrop] chunk failed: \(http?.statusCode ?? 0) (offset=\(offset), \(chunk.count) bytes)")
                    // Rollback — will retry next cycle
                    await MainActor.run { lastBytesSent = offset }
                }
            } catch {
                // Network error — rollback
                await MainActor.run { lastBytesSent = offset }
            }
        }
    }

    func stop() {
        isActive = false
        timer?.invalidate()
        timer = nil

        // Send final chunk + finalize
        guard let sessionId,
              let endpoint = ServerConfig.shared.endpoint,
              let token = ServerConfig.shared.token else { return }

        Task {
            // Send remaining bytes
            sendChunk()

            // Finalize session
            let url = endpoint.appendingPathComponent("api/stream/\(sessionId)/end")
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

            if let (_, response) = try? await URLSession.shared.data(for: request) {
                let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                print("[SlopDrop] stream end: \(code)")
            }
        }
    }
}

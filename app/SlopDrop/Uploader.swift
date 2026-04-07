import Foundation
import UIKit

@MainActor
final class Uploader: NSObject, ObservableObject {
    static let shared = Uploader()

    private weak var currentStore: RecordingStore?

    func upload(recording: Recording, store: RecordingStore) {
        guard let endpoint = ServerConfig.shared.endpoint,
              let token = ServerConfig.shared.token else {
            store.updateStatus(recording.id, status: .failed, error: "[ERR] not configured — no endpoint/token")
            return
        }

        let fileURL = store.fileURL(for: recording)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            store.updateStatus(recording.id, status: .failed, error: "[ERR] file not found: \(fileURL.lastPathComponent)")
            return
        }

        store.updateStatus(recording.id, status: .uploading)
        currentStore = store

        let uploadURL = endpoint.appendingPathComponent("api/upload")
        let boundary = "SlopDrop-\(UUID().uuidString)"

        var request = URLRequest(url: uploadURL)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        let body: Data
        do {
            body = try buildMultipartBody(
                boundary: boundary,
                fileURL: fileURL,
                filename: recording.localFilename,
                duration: recording.duration
            )
        } catch {
            store.updateStatus(recording.id, status: .failed, error: "[ERR] body build failed: \(error.localizedDescription)")
            return
        }

        request.httpBody = body
        let recordingId = recording.id
        let byteCount = body.count

        print("[SlopDrop] POST \(uploadURL) (\(byteCount) bytes)")

        Task {
            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                let http = response as? HTTPURLResponse
                let code = http?.statusCode ?? 0

                if (200...299).contains(code) {
                    let json = try? JSONDecoder().decode(UploadResponse.self, from: data)
                    let sid = json?.id
                    print("[SlopDrop] \(code) OK — \(sid ?? "no id")")
                    store.updateStatus(recordingId, status: .synced, serverId: sid)
                } else {
                    let responseBody = String(data: data, encoding: .utf8) ?? ""
                    let detail = "[ERR] POST /api/upload → \(code)\n\(responseBody)"
                    print("[SlopDrop] \(detail)")
                    store.updateStatus(recordingId, status: .failed, error: detail)
                }
            } catch {
                let detail = "[ERR] \(error.localizedDescription)"
                print("[SlopDrop] \(detail)")
                store.updateStatus(recordingId, status: .failed, error: detail)
            }
        }
    }

    func retryFailed(store: RecordingStore) {
        let pending = store.pendingRecordings()
        for recording in pending {
            upload(recording: recording, store: store)
        }
    }

    private func buildMultipartBody(
        boundary: String,
        fileURL: URL,
        filename: String,
        duration: TimeInterval
    ) throws -> Data {
        var body = Data()
        let crlf = "\r\n"

        body.append("--\(boundary)\(crlf)")
        body.append("Content-Disposition: form-data; name=\"duration_sec\"\(crlf)\(crlf)")
        body.append("\(duration)\(crlf)")

        body.append("--\(boundary)\(crlf)")
        body.append("Content-Disposition: form-data; name=\"audio\"; filename=\"\(filename)\"\(crlf)")
        body.append("Content-Type: audio/mp4\(crlf)\(crlf)")
        body.append(try Data(contentsOf: fileURL))
        body.append("\(crlf)")

        body.append("--\(boundary)--\(crlf)")

        return body
    }
}

private extension Data {
    mutating func append(_ string: String) {
        if let data = string.data(using: .utf8) {
            append(data)
        }
    }
}

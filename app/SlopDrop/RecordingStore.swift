import Foundation

enum SyncStatus: String, Codable {
    case recording  // actively recording — file on disk, growing
    case pending    // recorded, waiting to upload
    case uploading
    case synced
    case failed
}

struct Recording: Identifiable, Codable {
    let id: String
    let localFilename: String
    var duration: TimeInterval
    let createdAt: Date
    var syncStatus: SyncStatus
    var serverId: String?
    var errorDetail: String?
}

@MainActor
final class RecordingStore: ObservableObject {
    @Published var recordings: [Recording] = []

    private let storageKey = "slopdrop.recordings"

    init() {
        load()
    }

    func addRecording(localFilename: String, duration: TimeInterval, status: SyncStatus = .pending) -> Recording {
        let recording = Recording(
            id: UUID().uuidString,
            localFilename: localFilename,
            duration: duration,
            createdAt: Date(),
            syncStatus: status,
            serverId: nil,
            errorDetail: nil
        )
        recordings.insert(recording, at: 0)
        save()
        return recording
    }

    func updateStatus(_ id: String, status: SyncStatus, serverId: String? = nil, error: String? = nil) {
        guard let index = recordings.firstIndex(where: { $0.id == id }) else { return }
        recordings[index].syncStatus = status
        if let serverId { recordings[index].serverId = serverId }
        if let error { recordings[index].errorDetail = error }
        if status == .synced { recordings[index].errorDetail = nil }
        save()
    }

    func updateDuration(_ id: String, duration: TimeInterval) {
        guard let index = recordings.firstIndex(where: { $0.id == id }) else { return }
        recordings[index].duration = duration
        save()
    }

    func removeRecording(_ id: String) {
        recordings.removeAll { $0.id == id }
        save()
    }

    func pendingRecordings() -> [Recording] {
        recordings.filter { $0.syncStatus == .pending || $0.syncStatus == .failed }
    }

    var recordingsDirectory: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = docs.appendingPathComponent("recordings")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    func fileURL(for recording: Recording) -> URL {
        recordingsDirectory.appendingPathComponent(recording.localFilename)
    }

    private func save() {
        if let data = try? JSONEncoder().encode(recordings) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([Recording].self, from: data) else { return }
        recordings = decoded
    }
}

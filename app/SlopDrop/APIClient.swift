import Foundation

struct UploadResponse: Codable {
    let id: String
    let filename: String
    let synced_at: String
}

struct ServerRecording: Codable, Identifiable {
    let id: String
    let filename: String
    let duration_sec: Double
    let size_bytes: Int
    let created_at: String
    let synced_at: String
    let processed: Bool
}

struct HealthResponse: Codable {
    let ok: Bool
    let count: Int
    let disk_free_gb: Double?
    let last_recording_at: String?
}

enum APIError: Error, LocalizedError {
    case notConfigured
    case unauthorized
    case serverError(Int)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Server not configured"
        case .unauthorized: return "Invalid token"
        case .serverError(let code): return "Server error (\(code))"
        case .networkError(let err): return err.localizedDescription
        }
    }
}

final class APIClient {
    static let shared = APIClient()

    private var config: ServerConfig { .shared }

    private func authRequest(path: String) throws -> URLRequest {
        guard let endpoint = config.endpoint, let token = config.token else {
            throw APIError.notConfigured
        }
        let url = endpoint.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return request
    }

    func listRecordings(since: Date? = nil) async throws -> [ServerRecording] {
        var request = try authRequest(path: "/api/recordings")
        if let since {
            let formatter = ISO8601DateFormatter()
            let query = "since=\(formatter.string(from: since))"
            if let url = request.url,
               var components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
                components.query = query
                request.url = components.url
            }
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        try checkResponse(response)
        return try JSONDecoder().decode([ServerRecording].self, from: data)
    }

    func healthCheck() async throws -> HealthResponse {
        guard let endpoint = config.endpoint else { throw APIError.notConfigured }
        let url = endpoint.appendingPathComponent("/api/health")
        let (data, _) = try await URLSession.shared.data(from: url)
        return try JSONDecoder().decode(HealthResponse.self, from: data)
    }

    private func checkResponse(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        switch http.statusCode {
        case 200...299: return
        case 401, 403: throw APIError.unauthorized
        default: throw APIError.serverError(http.statusCode)
        }
    }
}

import Foundation
import Security

final class ServerConfig {
    static let shared = ServerConfig()

    private let endpointKey = "com.slopdrop.endpoint"
    private let tokenKey = "com.slopdrop.token"

    var isConfigured: Bool {
        endpoint != nil && token != nil
    }

    var endpoint: URL? {
        guard let string = readKeychain(key: endpointKey) else { return nil }
        return URL(string: string)
    }

    var token: String? {
        readKeychain(key: tokenKey)
    }

    func save(endpoint: String, token: String) {
        writeKeychain(key: endpointKey, value: endpoint)
        writeKeychain(key: tokenKey, value: token)
    }

    func clear() {
        deleteKeychain(key: endpointKey)
        deleteKeychain(key: tokenKey)
    }

    // MARK: - Keychain Helpers

    private func writeKeychain(key: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)

        let attrs: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(attrs as CFDictionary, nil)
    }

    private func readKeychain(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func deleteKeychain(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

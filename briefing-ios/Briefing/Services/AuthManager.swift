import Foundation
import SwiftUI

@Observable
@MainActor
final class AuthManager {
    static let shared = AuthManager()

    private(set) var user: User?
    private(set) var isSignedIn = false
    private(set) var isLoading = true

    private let tokenKey = "com.briefing.session-token"

    var token: String? {
        KeychainHelper.read(key: tokenKey)
    }

    private init() {}

    func restoreSession() async {
        isLoading = true
        defer { isLoading = false }

        guard KeychainHelper.read(key: tokenKey) != nil else {
            isSignedIn = false
            return
        }

        // Validate token by calling subscription endpoint
        do {
            let _: SubscriptionResponse = try await APIClient.shared.request("GET", path: "/api/subscription")
            // Token is valid — restore user from stored data
            if let userData = UserDefaults.standard.data(forKey: "cached_user"),
               let cached = try? JSONDecoder().decode(User.self, from: userData) {
                user = cached
            } else {
                user = User(email: "user@briefing.app", name: nil, image: nil)
            }
            isSignedIn = true
        } catch {
            // Token invalid — clear it
            KeychainHelper.delete(key: tokenKey)
            isSignedIn = false
        }
    }

    func signIn(idToken: String) async throws {
        struct LoginBody: Encodable {
            let idToken: String
        }

        let response: LoginResponse = try await APIClient.shared.request(
            "POST",
            path: "/api/auth/mobile-login",
            body: LoginBody(idToken: idToken)
        )

        KeychainHelper.save(key: tokenKey, value: response.token)

        // Cache user data
        if let data = try? JSONEncoder().encode(response.user) {
            UserDefaults.standard.set(data, forKey: "cached_user")
        }

        user = response.user
        isSignedIn = true
    }

    func signOut() async {
        // Revoke token on server
        if token != nil {
            let _: EmptyResponse? = try? await APIClient.shared.request("POST", path: "/api/auth/mobile-logout")
        }

        KeychainHelper.delete(key: tokenKey)
        UserDefaults.standard.removeObject(forKey: "cached_user")
        user = nil
        isSignedIn = false
    }
}

private struct EmptyResponse: Codable {
    let success: Bool?
}

// MARK: - Keychain Helper

enum KeychainHelper {
    static func save(key: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)

        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    static func read(key: String) -> String? {
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

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

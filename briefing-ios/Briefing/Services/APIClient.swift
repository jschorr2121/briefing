import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case limitReached(used: Int, limit: Int, tier: String)
    case badRequest(String)
    case serverError(Int)
    case networkError(Error)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Please sign in to continue."
        case .limitReached(_, _, _):
            return "You've reached your daily briefing limit. Upgrade to Pro for unlimited access."
        case .badRequest(let msg):
            return msg
        case .serverError(let code):
            return "Server error (\(code)). Please try again."
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError:
            return "Failed to process server response."
        }
    }
}

actor APIClient {
    static let shared = APIClient()

    private let baseURL = AppConfig.baseURL
    private let session = URLSession.shared
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .useDefaultKeys
        return d
    }()

    func request<T: Decodable>(
        _ method: String,
        path: String,
        body: (any Encodable)? = nil,
        retries: Int = 2
    ) async throws -> T {
        let data = try await performRequest(method, path: path, body: body, retries: retries)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    func requestData(
        _ method: String,
        path: String,
        body: (any Encodable)? = nil,
        retries: Int = 2
    ) async throws -> Data {
        try await performRequest(method, path: path, body: body, retries: retries)
    }

    private func performRequest(
        _ method: String,
        path: String,
        body: (any Encodable)?,
        retries: Int
    ) async throws -> Data {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw APIError.badRequest("Invalid URL")
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Attach bearer token if available
        if let token = await AuthManager.shared.token {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            urlRequest.httpBody = try JSONEncoder().encode(body)
        }

        var lastError: Error?

        for attempt in 0...retries {
            do {
                let (data, response) = try await session.data(for: urlRequest)
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw APIError.serverError(0)
                }

                switch httpResponse.statusCode {
                case 200...299:
                    return data

                case 401:
                    await AuthManager.shared.signOut()
                    throw APIError.unauthorized

                case 429:
                    // Check if it's a limit reached error
                    if let errorBody = try? decoder.decode(LimitReachedError.self, from: data),
                       errorBody.code == "LIMIT_REACHED",
                       let usage = errorBody.usage {
                        throw APIError.limitReached(
                            used: usage.used,
                            limit: usage.limit,
                            tier: usage.tier
                        )
                    }
                    // Rate limited — retry with backoff
                    if attempt < retries {
                        try await Task.sleep(for: .seconds(pow(2.0, Double(attempt))))
                        continue
                    }
                    throw APIError.serverError(429)

                case 500...599:
                    if attempt < retries {
                        try await Task.sleep(for: .seconds(pow(2.0, Double(attempt))))
                        continue
                    }
                    throw APIError.serverError(httpResponse.statusCode)

                default:
                    if let errorBody = try? decoder.decode(ErrorResponse.self, from: data) {
                        throw APIError.badRequest(errorBody.error)
                    }
                    throw APIError.serverError(httpResponse.statusCode)
                }
            } catch let error as APIError {
                throw error
            } catch {
                lastError = error
                if attempt < retries {
                    try await Task.sleep(for: .seconds(pow(2.0, Double(attempt))))
                    continue
                }
            }
        }

        throw APIError.networkError(lastError ?? URLError(.unknown))
    }
}

// MARK: - Error response types

private struct ErrorResponse: Codable {
    let error: String
}

private struct LimitReachedError: Codable {
    let error: String
    let code: String?
    let usage: LimitUsage?
}

private struct LimitUsage: Codable {
    let used: Int
    let limit: Int
    let tier: String
}

import Foundation

enum BriefingService {
    struct GenerateRequest: Encodable {
        let topics: [TopicPayload]
        let settings: SettingsPayload
    }

    struct TopicPayload: Encodable {
        let id: String
        let name: String
        let emoji: String
    }

    struct SettingsPayload: Encodable {
        let briefingLength: String
        let includeLinks: Bool
        let tone: String
    }

    static func generate(topics: [Topic], settings: BriefingSettings) async throws -> [Briefing] {
        let body = GenerateRequest(
            topics: topics.map { TopicPayload(id: $0.id, name: $0.name, emoji: $0.emoji) },
            settings: SettingsPayload(
                briefingLength: settings.briefingLength.rawValue,
                includeLinks: settings.includeLinks,
                tone: settings.tone.rawValue
            )
        )
        let response: GenerateResponse = try await APIClient.shared.request(
            "POST",
            path: "/api/generate",
            body: body
        )
        return response.briefings
    }

    static func generateAudio(briefings: [Briefing], voice: String) async throws -> Data {
        struct AudioRequest: Encodable {
            let briefings: [Briefing]
            let voice: String
        }
        return try await APIClient.shared.requestData(
            "POST",
            path: "/api/audio",
            body: AudioRequest(briefings: briefings, voice: voice)
        )
    }

    static func sendEmail(briefings: [Briefing], email: String) async throws {
        struct EmailRequest: Encodable {
            let briefings: [Briefing]
            let email: String
        }
        let _: EmailResponse = try await APIClient.shared.request(
            "POST",
            path: "/api/email",
            body: EmailRequest(briefings: briefings, email: email)
        )
    }
}

private struct EmailResponse: Codable {
    let success: Bool
}

import Foundation

enum ScheduleService {
    static func fetchSchedules() async throws -> [Schedule] {
        let response: ScheduleListResponse = try await APIClient.shared.request("GET", path: "/api/schedules")
        return response.schedules
    }

    static func createSchedule(
        email: String,
        topics: [String],
        frequency: ScheduleFrequency,
        time: String,
        timezone: String
    ) async throws -> Schedule {
        struct CreateRequest: Encodable {
            let email: String
            let topics: [String]
            let frequency: String
            let time: String
            let timezone: String
        }
        struct Response: Codable {
            let schedule: Schedule
        }
        let response: Response = try await APIClient.shared.request(
            "POST",
            path: "/api/schedules",
            body: CreateRequest(
                email: email,
                topics: topics,
                frequency: frequency.rawValue,
                time: time,
                timezone: timezone
            )
        )
        return response.schedule
    }

    static func updateSchedule(_ schedule: Schedule) async throws -> Schedule {
        struct Response: Codable {
            let schedule: Schedule
        }
        let response: Response = try await APIClient.shared.request(
            "PUT",
            path: "/api/schedules",
            body: schedule
        )
        return response.schedule
    }

    static func deleteSchedule(id: String) async throws {
        struct Response: Codable {
            let success: Bool
        }
        let _: Response = try await APIClient.shared.request(
            "DELETE",
            path: "/api/schedules?id=\(id)"
        )
    }
}

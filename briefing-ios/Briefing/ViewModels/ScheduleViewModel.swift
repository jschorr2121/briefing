import Foundation

@Observable
@MainActor
final class ScheduleViewModel {
    var schedules: [Schedule] = []
    var isLoading = false
    var error: String?

    // Form state
    var showForm = false
    var editingSchedule: Schedule?
    var formEmail = ""
    var formTopics: [String] = []
    var formTopicInput = ""
    var formFrequency: ScheduleFrequency = .daily
    var formTime = "08:00"
    var formTimezone = TimeZone.current.identifier

    func loadSchedules() async {
        isLoading = true
        defer { isLoading = false }

        do {
            schedules = try await ScheduleService.fetchSchedules()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func openCreateForm() {
        editingSchedule = nil
        formEmail = AuthManager.shared.user?.email ?? ""
        formTopics = []
        formTopicInput = ""
        formFrequency = .daily
        formTime = "08:00"
        formTimezone = TimeZone.current.identifier
        showForm = true
    }

    func openEditForm(_ schedule: Schedule) {
        editingSchedule = schedule
        formEmail = schedule.email
        formTopics = schedule.topics
        formTopicInput = ""
        formFrequency = schedule.frequency
        formTime = schedule.time
        formTimezone = schedule.timezone
        showForm = true
    }

    func addFormTopic() {
        let topic = formTopicInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !topic.isEmpty, !formTopics.contains(topic) else { return }
        formTopics.append(topic)
        formTopicInput = ""
    }

    func removeFormTopic(_ topic: String) {
        formTopics.removeAll { $0 == topic }
    }

    func saveSchedule() async {
        guard !formEmail.isEmpty, !formTopics.isEmpty else { return }

        do {
            if let existing = editingSchedule {
                var updated = existing
                updated.email = formEmail
                updated.topics = formTopics
                updated.frequency = formFrequency
                updated.time = formTime
                updated.timezone = formTimezone
                let saved = try await ScheduleService.updateSchedule(updated)
                if let idx = schedules.firstIndex(where: { $0.id == saved.id }) {
                    schedules[idx] = saved
                }
            } else {
                let created = try await ScheduleService.createSchedule(
                    email: formEmail,
                    topics: formTopics,
                    frequency: formFrequency,
                    time: formTime,
                    timezone: formTimezone
                )
                schedules.append(created)
            }
            showForm = false
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.notification(.error)
        }
    }

    func deleteSchedule(_ schedule: Schedule) async {
        do {
            try await ScheduleService.deleteSchedule(id: schedule.id)
            schedules.removeAll { $0.id == schedule.id }
            HapticManager.notification(.success)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func toggleSchedule(_ schedule: Schedule) async {
        guard let idx = schedules.firstIndex(where: { $0.id == schedule.id }) else { return }
        var updated = schedule
        updated.enabled.toggle()
        do {
            let saved = try await ScheduleService.updateSchedule(updated)
            schedules[idx] = saved
        } catch {
            self.error = error.localizedDescription
        }
    }
}

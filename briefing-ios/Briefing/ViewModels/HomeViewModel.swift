import Foundation
import SwiftUI
import SwiftData

@Observable
@MainActor
final class HomeViewModel {
    // MARK: - Topics
    var topics: [Topic] = []
    var newTopicName = ""

    // MARK: - Briefings
    var briefings: [Briefing] = []
    var isGenerating = false
    var generateError: String?

    // MARK: - Audio
    var audioData: Data?
    var isLoadingAudio = false

    // MARK: - Email
    var showEmailSheet = false
    var emailAddress = ""
    var isSendingEmail = false
    var emailSent = false

    // MARK: - Settings
    var settings = BriefingSettings.default
    var showSettings = false

    // MARK: - Subscription
    var tier: String = "free"
    var usageUsed: Int = 0
    var usageLimit: Int? = 3
    var showUpgradePrompt = false

    // MARK: - History
    var showHistory = false

    // MARK: - Persistence keys
    private let topicsKey = "saved_topics"
    private let settingsKey = "saved_settings"

    var selectedTopics: [Topic] {
        topics.filter(\.enabled)
    }

    var canGenerate: Bool {
        !selectedTopics.isEmpty && !isGenerating
    }

    var hasReachedLimit: Bool {
        guard tier == "free", let limit = usageLimit else { return false }
        return usageUsed >= limit
    }

    init() {
        loadPersistedTopics()
        loadPersistedSettings()
    }

    // MARK: - Topics

    var topicLimit: Int {
        AppConfig.freeTopicLimit
    }

    var atTopicLimit: Bool {
        topics.count >= topicLimit
    }

    func addTopic() {
        let name = newTopicName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        guard !atTopicLimit else { return }
        guard !topics.contains(where: { $0.name.lowercased() == name.lowercased() }) else { return }

        let topic = Topic(name: name)
        topics.append(topic)
        newTopicName = ""
        HapticManager.selection()
        persistTopics()
    }

    func addSuggestedTopic(_ topic: Topic) {
        guard !atTopicLimit else { return }
        guard !topics.contains(where: { $0.id == topic.id }) else { return }
        topics.append(topic)
        HapticManager.selection()
        persistTopics()
    }

    func toggleTopic(_ topic: Topic) {
        guard let idx = topics.firstIndex(where: { $0.id == topic.id }) else { return }
        topics[idx].enabled.toggle()
        HapticManager.selection()
        persistTopics()
    }

    func removeTopic(_ topic: Topic) {
        topics.removeAll { $0.id == topic.id }
        persistTopics()
    }

    // MARK: - Generate

    func generate() async {
        guard canGenerate else { return }
        isGenerating = true
        generateError = nil
        HapticManager.impact(.medium)

        do {
            let enabledTopics = Array(selectedTopics.prefix(topicLimit))

            briefings = try await BriefingService.generate(topics: enabledTopics, settings: settings)
            audioData = nil // Clear old audio
            HapticManager.notification(.success)
        } catch let error as APIError {
            switch error {
            case .limitReached(let used, let limit, _):
                usageUsed = used
                usageLimit = limit
                showUpgradePrompt = true
            default:
                generateError = error.errorDescription
            }
            HapticManager.notification(.error)
        } catch {
            generateError = error.localizedDescription
            HapticManager.notification(.error)
        }

        isGenerating = false
    }

    // MARK: - Audio

    func loadAudio() async {
        guard !briefings.isEmpty else { return }
        isLoadingAudio = true
        HapticManager.impact(.light)

        do {
            let data = try await BriefingService.generateAudio(briefings: briefings, voice: settings.voice)
            audioData = data
            AudioPlayerManager.shared.loadAndPlay(data: data)
        } catch {
            generateError = "Failed to load audio: \(error.localizedDescription)"
        }

        isLoadingAudio = false
    }

    // MARK: - Email

    func sendEmail() async {
        guard !briefings.isEmpty, !emailAddress.isEmpty else { return }
        isSendingEmail = true

        do {
            try await BriefingService.sendEmail(briefings: briefings, email: emailAddress)
            emailSent = true
            HapticManager.notification(.success)
        } catch {
            generateError = "Failed to send email: \(error.localizedDescription)"
            HapticManager.notification(.error)
        }

        isSendingEmail = false
    }

    // MARK: - Subscription

    func loadSubscription() async {
        do {
            let sub = try await SubscriptionService.fetchStatus()
            tier = sub.tier
            usageUsed = sub.usage.used
            usageLimit = sub.usage.limit
        } catch {
            // Default to free on error
        }
    }

    // MARK: - History (SwiftData)

    func saveToHistory(context: ModelContext) {
        guard !briefings.isEmpty else { return }

        let entry = BriefingHistoryEntry(briefings: briefings)
        context.insert(entry)

        // Trim to max count
        let descriptor = FetchDescriptor<BriefingHistoryEntry>(
            sortBy: [SortDescriptor(\.generatedAt, order: .reverse)]
        )
        if let all = try? context.fetch(descriptor), all.count > AppConfig.maxHistoryCount {
            for old in all.dropFirst(AppConfig.maxHistoryCount) {
                context.delete(old)
            }
        }
    }

    func loadFromHistory(_ entry: BriefingHistoryEntry) {
        briefings = entry.briefings
        audioData = nil
        showHistory = false
    }

    func clearHistory(context: ModelContext) {
        let descriptor = FetchDescriptor<BriefingHistoryEntry>()
        if let all = try? context.fetch(descriptor) {
            for entry in all {
                context.delete(entry)
            }
        }
    }

    // MARK: - Export

    func exportMarkdown() -> String {
        var md = "# Briefing\n\n"
        let date = Date().formatted(date: .long, time: .omitted)
        md += "_Generated \(date)_\n\n"

        for briefing in briefings {
            md += "## \(briefing.emoji) \(briefing.topic)\n\n"
            md += "\(briefing.summary)\n\n"

            for story in briefing.storyList {
                md += "### \(story.headline)\n\n"
                for bullet in story.bullets {
                    md += "- \(bullet)\n"
                }
                if let source = story.source, let url = story.url {
                    md += "\n_Source: [\(source)](\(url))_"
                }
                if let date = story.date {
                    md += " | \(date)"
                }
                md += "\n\n"
            }
        }

        return md
    }

    // MARK: - Persistence

    private func loadPersistedTopics() {
        if let data = UserDefaults.standard.data(forKey: topicsKey),
           let saved = try? JSONDecoder().decode([Topic].self, from: data) {
            topics = saved
        } else {
            topics = AppConfig.defaultTopics
        }
    }

    private func persistTopics() {
        if let data = try? JSONEncoder().encode(topics) {
            UserDefaults.standard.set(data, forKey: topicsKey)
        }
    }

    private func loadPersistedSettings() {
        if let data = UserDefaults.standard.data(forKey: settingsKey),
           let saved = try? JSONDecoder().decode(BriefingSettings.self, from: data) {
            settings = saved
        }
    }

    func persistSettings() {
        if let data = try? JSONEncoder().encode(settings) {
            UserDefaults.standard.set(data, forKey: settingsKey)
        }
    }
}

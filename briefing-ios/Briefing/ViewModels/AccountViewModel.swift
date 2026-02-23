import Foundation

@Observable
@MainActor
final class AccountViewModel {
    var tier: String = "free"
    var subscriptionStatus: String?
    var currentPeriodEnd: String?
    var usageUsed: Int = 0
    var usageLimit: Int?
    var isLoading = false

    var isPro: Bool { tier == "pro" }

    var usagePercentage: Double {
        guard let limit = usageLimit, limit > 0 else { return 0 }
        return Double(usageUsed) / Double(limit)
    }

    var usageDisplay: String {
        if let limit = usageLimit {
            return "\(usageUsed) / \(limit)"
        }
        return "\(usageUsed) / \u{221E}"
    }

    func loadSubscription() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let sub = try await SubscriptionService.fetchStatus()
            tier = sub.tier
            subscriptionStatus = sub.subscriptionStatus
            currentPeriodEnd = sub.currentPeriodEnd
            usageUsed = sub.usage.used
            usageLimit = sub.usage.limit
        } catch {
            // Keep defaults on error
        }
    }
}

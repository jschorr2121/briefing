import Foundation

struct SubscriptionResponse: Codable {
    let tier: String
    let subscriptionStatus: String?
    let currentPeriodEnd: String?
    let hasStripeCustomer: Bool?
    let usage: UsageInfo
}

struct UsageInfo: Codable {
    let used: Int
    let limit: Int?
    let allowed: Bool
}

struct VerifyReceiptResponse: Codable {
    let tier: String
    let subscriptionStatus: String
}

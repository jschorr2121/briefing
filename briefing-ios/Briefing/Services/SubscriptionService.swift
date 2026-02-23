import Foundation

enum SubscriptionService {
    static func fetchStatus() async throws -> SubscriptionResponse {
        try await APIClient.shared.request("GET", path: "/api/subscription")
    }

    static func verifyReceipt(transactionJWS: String, productId: String) async throws -> VerifyReceiptResponse {
        struct ReceiptRequest: Encodable {
            let transactionJWS: String
            let productId: String
        }
        return try await APIClient.shared.request(
            "POST",
            path: "/api/subscription/verify-receipt",
            body: ReceiptRequest(transactionJWS: transactionJWS, productId: productId)
        )
    }
}

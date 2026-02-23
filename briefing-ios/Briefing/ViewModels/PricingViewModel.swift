import Foundation
import StoreKit

@Observable
@MainActor
final class PricingViewModel {
    var isAnnual = false
    var isPurchasing = false
    var purchaseError: String?
    var purchaseSuccess = false

    var selectedProduct: Product? {
        isAnnual ? StoreKitManager.shared.annualProduct : StoreKitManager.shared.monthlyProduct
    }

    func loadProducts() async {
        await StoreKitManager.shared.loadProducts()
    }

    func purchase() async {
        guard let product = selectedProduct else { return }
        isPurchasing = true
        purchaseError = nil

        do {
            let success = try await StoreKitManager.shared.purchase(product)
            if success {
                purchaseSuccess = true
                HapticManager.notification(.success)
            }
        } catch {
            purchaseError = error.localizedDescription
            HapticManager.notification(.error)
        }

        isPurchasing = false
    }

    func restorePurchases() async {
        isPurchasing = true
        await StoreKitManager.shared.restorePurchases()
        isPurchasing = false

        if StoreKitManager.shared.isPro {
            purchaseSuccess = true
            HapticManager.notification(.success)
        }
    }
}

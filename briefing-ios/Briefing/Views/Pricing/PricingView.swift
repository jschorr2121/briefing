import SwiftUI
import StoreKit

struct PricingView: View {
    @State private var vm = PricingViewModel()
    @State private var storeKit = StoreKitManager.shared

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                VStack(spacing: 10) {
                    KickerText("Subscription", color: .accent)

                    Text("Briefing Pro")
                        .font(.heroTitle)
                        .foregroundStyle(Color.textPrimary)

                    Text("Unlimited briefings, premium features")
                        .font(.bodyRegular)
                        .foregroundStyle(Color.textSecondary)
                }
                .padding(.top)

                // Monthly/Annual toggle
                Picker("Plan", selection: $vm.isAnnual) {
                    Text("Monthly").tag(false)
                    Text("Annual").tag(true)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                // Plan comparison
                HStack(spacing: 12) {
                    // Free plan
                    planCard(
                        title: "Free",
                        price: "$0",
                        period: "forever",
                        features: [
                            "\(AppConfig.freeDailyLimit) briefings/day",
                            "\(AppConfig.freeTopicLimit) topics/briefing",
                            "Basic voices",
                            "Email delivery",
                        ],
                        isHighlighted: false
                    )

                    // Pro plan
                    planCard(
                        title: "Pro",
                        price: vm.selectedProduct?.displayPrice ?? (vm.isAnnual ? "$49.99" : "$6.99"),
                        period: vm.isAnnual ? "/year" : "/month",
                        features: [
                            "Unlimited briefings",
                            "Unlimited topics",
                            "All 6 premium voices",
                            "Priority generation",
                            "Email delivery",
                            "Scheduled briefings",
                        ],
                        isHighlighted: true
                    )
                }
                .padding(.horizontal)

                // Purchase button
                Button {
                    Task { await vm.purchase() }
                } label: {
                    HStack {
                        if vm.isPurchasing {
                            ProgressView()
                                .tint(Color.bgPrimary)
                        } else if vm.purchaseSuccess {
                            Image(systemName: "checkmark.circle.fill")
                            Text("Subscribed!")
                        } else {
                            Text("Subscribe to Pro")
                        }
                    }
                    .font(.buttonLabel)
                    .foregroundStyle(Color.bgPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(vm.purchaseSuccess ? Color.success : Color.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .disabled(vm.isPurchasing || vm.purchaseSuccess)
                .padding(.horizontal)

                // Restore
                Button("Restore Purchases") {
                    Task { await vm.restorePurchases() }
                }
                .font(.bodySmall)
                .foregroundStyle(Color.textMuted)

                if let error = vm.purchaseError {
                    ErrorBannerView(message: error, onDismiss: { vm.purchaseError = nil })
                        .padding(.horizontal)
                }

                // FAQ
                VStack(alignment: .leading, spacing: 16) {
                    Text("Questions")
                        .font(.sectionTitle)
                        .foregroundStyle(Color.textPrimary)

                    faqItem(
                        q: "Can I cancel anytime?",
                        a: "Yes. Cancel from your Apple ID subscription settings. You'll retain access until the end of your billing period."
                    )

                    faqItem(
                        q: "What payment methods are accepted?",
                        a: "All payment methods supported by your Apple ID including credit cards, Apple Pay, and gift card balance."
                    )

                    faqItem(
                        q: "Is there a free trial?",
                        a: "The free plan gives you 3 briefings per day. Try it out, and upgrade when you're ready for unlimited access."
                    )
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.bgCard)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.borderDefault, lineWidth: 1)
                )
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .background(Color.bgPrimary)
        .navigationTitle("Pricing")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await vm.loadProducts()
        }
    }

    // MARK: - Subviews

    private func planCard(
        title: String,
        price: String,
        period: String,
        features: [String],
        isHighlighted: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            KickerText(title, color: isHighlighted ? .accent : .textMuted)

            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(price)
                    .font(.system(size: 26, weight: .bold, design: .serif))
                    .foregroundStyle(Color.textPrimary)
                Text(period)
                    .font(.bodySmall)
                    .foregroundStyle(Color.textMuted)
            }

            Rectangle()
                .fill(Color.borderDefault)
                .frame(height: 1)

            ForEach(features, id: \.self) { feature in
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "checkmark")
                        .font(.caption.bold())
                        .foregroundStyle(isHighlighted ? Color.accent : Color.textMuted)
                        .padding(.top, 2)
                    Text(feature)
                        .font(.bodySmall)
                        .foregroundStyle(Color.textSecondary)
                }
            }

            Spacer()
        }
        .padding()
        .background(Color.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(isHighlighted ? Color.textPrimary : Color.borderDefault, lineWidth: isHighlighted ? 1.5 : 1)
        )
    }

    private func faqItem(q: String, a: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(q)
                .font(.headline)
                .foregroundStyle(Color.textPrimary)
            Text(a)
                .font(.bodySmall)
                .foregroundStyle(Color.textSecondary)
                .lineSpacing(3)
        }
    }
}

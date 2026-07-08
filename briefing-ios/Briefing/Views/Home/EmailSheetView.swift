import SwiftUI

struct EmailSheetView: View {
    @Bindable var vm: HomeViewModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    KickerText("Email delivery", color: .accent)

                    Text("Send Briefing via Email")
                        .font(.sectionTitle)
                        .foregroundStyle(Color.textPrimary)

                    Text("Receive a formatted copy of your briefing")
                        .font(.bodyRegular)
                        .foregroundStyle(Color.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                TextField("Email address", text: $vm.emailAddress)
                    .font(.bodyRegular)
                    .foregroundStyle(Color.textPrimary)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .autocapitalization(.none)
                    .padding()
                    .background(Color.bgCard)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.borderLight, lineWidth: 1)
                    )

                Button {
                    Task { await vm.sendEmail() }
                } label: {
                    HStack {
                        if vm.isSendingEmail {
                            ProgressView()
                                .tint(Color.bgPrimary)
                        } else if vm.emailSent {
                            Image(systemName: "checkmark.circle.fill")
                            Text("Sent!")
                        } else {
                            Image(systemName: "envelope.fill")
                            Text("Send Email")
                        }
                    }
                    .font(.buttonLabel)
                    .foregroundStyle(Color.bgPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(vm.emailSent ? Color.success : Color.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .disabled(vm.emailAddress.isEmpty || vm.isSendingEmail)

                Spacer()
            }
            .padding(24)
            .background(Color.bgPrimary)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        vm.showEmailSheet = false
                        vm.emailSent = false
                    }
                }
            }
        }
    }
}

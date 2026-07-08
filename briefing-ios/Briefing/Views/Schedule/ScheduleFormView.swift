import SwiftUI

struct ScheduleFormView: View {
    @Bindable var vm: ScheduleViewModel

    private var isEditing: Bool { vm.editingSchedule != nil }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Email
                    VStack(alignment: .leading, spacing: 6) {
                        KickerText("Email")

                        TextField("your@email.com", text: $vm.formEmail)
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
                    }

                    // Topics
                    VStack(alignment: .leading, spacing: 6) {
                        KickerText("Topics")

                        HStack(spacing: 8) {
                            TextField("Add topic", text: $vm.formTopicInput)
                                .font(.bodyRegular)
                                .foregroundStyle(Color.textPrimary)
                                .padding()
                                .background(Color.bgCard)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.borderLight, lineWidth: 1)
                                )
                                .submitLabel(.done)
                                .onSubmit { vm.addFormTopic() }

                            Button {
                                vm.addFormTopic()
                            } label: {
                                Image(systemName: "plus")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Color.bgPrimary)
                                    .frame(width: 36, height: 36)
                                    .background(Color.textPrimary)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }

                        FlowLayout(spacing: 6) {
                            ForEach(vm.formTopics, id: \.self) { topic in
                                HStack(spacing: 6) {
                                    Text(topic)
                                        .font(.chipLabel)

                                    Button {
                                        vm.removeFormTopic(topic)
                                    } label: {
                                        Image(systemName: "xmark")
                                            .font(.caption2.bold())
                                    }
                                }
                                .foregroundStyle(Color.bgPrimary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color.textPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                        }
                    }

                    // Frequency
                    VStack(alignment: .leading, spacing: 6) {
                        KickerText("Frequency")

                        Picker("Frequency", selection: $vm.formFrequency) {
                            ForEach(ScheduleFrequency.allCases) { freq in
                                Text(freq.displayName).tag(freq)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    // Time
                    VStack(alignment: .leading, spacing: 6) {
                        KickerText("Time")

                        TextField("08:00", text: $vm.formTime)
                            .font(.bodyRegular)
                            .foregroundStyle(Color.textPrimary)
                            .padding()
                            .background(Color.bgCard)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.borderLight, lineWidth: 1)
                            )
                    }

                    // Timezone
                    VStack(alignment: .leading, spacing: 6) {
                        KickerText("Timezone")

                        Text(vm.formTimezone)
                            .font(.bodyRegular)
                            .foregroundStyle(Color.textSecondary)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.bgSecondary)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
                .padding()
            }
            .background(Color.bgPrimary)
            .navigationTitle(isEditing ? "Edit Schedule" : "New Schedule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        vm.showForm = false
                    }
                    .foregroundStyle(Color.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        Task { await vm.saveSchedule() }
                    }
                    .foregroundStyle(Color.textPrimary)
                    .disabled(vm.formEmail.isEmpty || vm.formTopics.isEmpty)
                }
            }
        }
    }
}

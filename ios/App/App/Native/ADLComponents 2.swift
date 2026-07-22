// ios/App/App/Native/ADLComponents.swift
import SwiftUI

// Shared web-parity primitives. Populated by Phase 0 tasks.
enum ADLComponentsModule {}

// MARK: - Task 0.1: ADLScreenHeader

struct ADLScreenHeader<Trailing: View>: View {
    let title: String
    var subtitle: String? = nil
    var onBack: (() -> Void)? = nil
    var dark: Bool = false
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(spacing: 8) {
            Group {
                if let onBack {
                    Button(action: onBack) {
                        Image(systemName: "arrow.left")
                            .font(.system(size: 20, weight: .regular))
                            .foregroundColor(dark ? .white : Color(hex: 0x374151))
                            .frame(width: 44, height: 44)
                    }
                } else { Color.clear.frame(width: 44, height: 44) }
            }
            VStack(spacing: 2) {
                Text(dark ? title.uppercased() : title)
                    .font(dark ? ADLFont.inter(12, .bold) : ADLFont.inter(15, .bold))
                    .tracking(dark ? 1.9 : 0)
                    .foregroundColor(dark ? .white : ADLColor.ink)
                    .lineLimit(1)
                if let subtitle {
                    Text(subtitle)
                        .font(ADLFont.inter(11))
                        .foregroundColor(dark ? .white.opacity(0.7) : Color(hex: 0x6b7280))
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity)
            trailing().frame(minWidth: 44, alignment: .trailing)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 60)
        .background(dark ? ADLColor.ink : Color.white)
        .overlay(Rectangle().fill(ADLColor.line).frame(height: 1), alignment: .bottom)
    }
}
extension ADLScreenHeader where Trailing == EmptyView {
    init(title: String, subtitle: String? = nil, onBack: (() -> Void)? = nil, dark: Bool = false) {
        self.init(title: title, subtitle: subtitle, onBack: onBack, dark: dark) { EmptyView() }
    }
}

// MARK: - Task 0.2: KpiTile

enum KpiTone { case navy, terra, forest, streak, amber, gold
    var bg: Color { switch self {
        case .navy: return ADLColor.navyWash; case .terra: return ADLColor.terraWash
        case .forest: return ADLColor.forestWash; case .streak: return ADLColor.streakWash
        case .amber: return ADLColor.amberWash; case .gold: return ADLColor.goldWash } }
    var fg: Color { switch self {
        case .navy: return ADLColor.navy; case .terra: return ADLColor.terracotta
        case .forest: return ADLColor.forestDark; case .streak: return ADLColor.streak
        case .amber, .gold: return ADLColor.amber } }
}

struct KpiTile: View {
    let label: String
    let value: String
    var delta: Int? = nil
    var tone: KpiTone = .navy
    var systemIcon: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if systemIcon != nil || delta != nil {
                HStack {
                    if let systemIcon {
                        Image(systemName: systemIcon).font(.system(size: 13, weight: .semibold))
                            .foregroundColor(tone.fg)
                            .frame(width: 28, height: 28)
                            .background(Color.white.opacity(0.7))
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    } else { Spacer().frame(height: 0) }
                    Spacer()
                    if let delta {
                        let pos = delta >= 0
                        HStack(spacing: 2) {
                            Image(systemName: pos ? "arrow.up.right" : "arrow.down.right").font(.system(size: 11, weight: .bold))
                            Text("\(pos ? "+" : "")\(delta)").font(ADLFont.inter(11, .bold))
                        }.foregroundColor(pos ? ADLColor.forestDark : ADLColor.danger)
                    }
                }.padding(.bottom, 8)
            }
            Text(value).font(ADLFont.inter(22, .heavy)).foregroundColor(tone.fg)
            Text(label.uppercased()).font(ADLFont.inter(11, .bold)).tracking(2.0)
                .foregroundColor(tone.fg).opacity(0.7).padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(tone.bg)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: - Task 0.3: ADLPill, RiskBadge, TrustBadge, SectionLabel

struct ADLPill: View {
    let text: String; let bg: Color; let fg: Color
    var body: some View {
        Text(text.uppercased()).font(ADLFont.inter(10, .bold)).tracking(1.2)
            .foregroundColor(fg).padding(.horizontal, 8).padding(.vertical, 3)
            .background(bg).clipShape(Capsule())
    }
}
enum RiskLevel { case low, medium, high }
struct RiskBadge: View {
    let level: RiskLevel
    var body: some View {
        switch level {
        case .low: ADLPill(text: "Low risk", bg: ADLColor.forestWash, fg: ADLColor.forestDark)
        case .medium: ADLPill(text: "Medium risk", bg: ADLColor.amberWash, fg: ADLColor.amber)
        case .high: ADLPill(text: "High risk", bg: Color(hex: 0xfee2e2), fg: Color(hex: 0x991b1b))
        }
    }
}
enum TrustTier { case gold, silver, bronze }
struct TrustBadge: View {
    let tier: TrustTier
    var body: some View {
        switch tier {
        case .gold: ADLPill(text: "Gold", bg: ADLColor.goldWash, fg: ADLColor.amber)
        case .silver: ADLPill(text: "Silver", bg: ADLColor.line, fg: Color(hex: 0x4b5563))
        case .bronze: ADLPill(text: "Bronze", bg: ADLColor.terraWash, fg: ADLColor.terracotta)
        }
    }
}
struct SectionLabel: View {
    let text: String; var wide: Bool = false
    var body: some View {
        Text(text.uppercased())
            .font(ADLFont.inter(wide ? 11 : 12, wide ? .bold : .semibold))
            .tracking(wide ? 2.2 : 1.6)
            .foregroundColor(Color(hex: 0x6b7280))
    }
}

// MARK: - Task 0.4: FilterChipRow + VerticalPickerBar

struct ADLChipItem: Identifiable { let id: String; let label: String }

struct FilterChipRow: View {
    let chips: [ADLChipItem]
    @Binding var selected: String
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(chips) { chip in
                    let active = chip.id == selected
                    Button { selected = chip.id } label: {
                        Text(chip.label).font(ADLFont.inter(13, .semibold))
                            .foregroundColor(active ? .white : Color(hex: 0x4b5563))
                            .padding(.horizontal, 14).frame(height: 36)
                            .background(active ? ADLColor.navy : Color.white)
                            .overlay(Capsule().stroke(active ? Color.clear : ADLColor.lineStrong, lineWidth: 1))
                            .clipShape(Capsule())
                    }
                }
            }.padding(.horizontal, 16)
        }
    }
}

struct VerticalPickerBar: View {
    let categories: [SubmissionCategory]
    @Binding var selected: SubmissionCategory
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(categories) { cat in
                    let active = cat == selected
                    Button { selected = cat } label: {
                        VStack(spacing: 6) {
                            Image(systemName: cat.systemImage).font(.system(size: 18, weight: .semibold))
                                .foregroundColor(active ? .white : cat.tint)
                                .frame(width: 44, height: 44)
                                .background(active ? cat.tint : cat.tint.opacity(0.12))
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            Text(cat.title).font(ADLFont.inter(11, .semibold))
                                .foregroundColor(active ? ADLColor.ink : Color(hex: 0x6b7280))
                                .lineLimit(1)
                        }
                    }
                }
            }.padding(.horizontal, 16)
        }
    }
}

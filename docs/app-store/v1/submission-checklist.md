# Submission Checklist — ADL Console v1

## Pre-submission
- [ ] Verify metadata limits against current Apple docs
- [ ] Run full release gate (bash Scripts/release_gate.sh)
- [ ] Verify privacy URLs accessible
- [ ] Run review smoke test with all three accounts
- [ ] Record UTC timestamp of pre-submission smoke

## App Store Connect
- [ ] Upload exact Release build
- [ ] Set distribution: Specific Countries or Regions
- [ ] English primary, French localization
- [ ] 6 screenshots per locale (1320x2868 portrait)
- [ ] Manual release (not automatic)
- [ ] No encryption declaration: YES (only HTTPS/TLS)
- [ ] Age rating: 4+ (no restricted content)

## Post-approval
- [ ] Owner decision recorded: RELEASE or HOLD
- [ ] Manual release initiated
- [ ] Phased release enabled for automatic updates
- [ ] Storefront statuses confirmed

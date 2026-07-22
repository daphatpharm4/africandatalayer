# Device Quality Protocol

## Purpose
Measure and enforce release budgets on physical devices before App Store submission.

## Requirements
- Physical iOS device (oldest supported model and current reference model)
- macOS with Instruments (Energy template)
- Xcode 16+
- ADL Console built in Release configuration

## Procedure

### 1. Setup
1. Device name/OS/battery health: record before starting
2. Install Release build via Xcode or TestFlight
3. Set device to airplane mode (for offline tests) or production network

### 2. Energy Protocol (1-hour field sequence)
1. Launch Instruments with Energy template
2. Start thermal state monitoring
3. Execute field script:
   - 5 cold launches with capture + media
   - 5 minutes continuous sync drain (75 records)
   - 5 foreground/background transitions
4. Stop Instruments trace
5. Record:
   - Battery decrease (percentage points)
   - Thermal state start/end
   - Energy impact (Very Low / Low / Medium / High)

### 3. Pass/Fail Criteria
- Battery decrease: <5 percentage points per hour
- Thermal state: no thermal state above "Fair" (NSProcessInfoThermalStateFair)

### 4. Reporting
Save Instruments trace to `docs/release/evidence/device/` with filename:
`energy-{device-model}-{OS-version}-{date}.trace`

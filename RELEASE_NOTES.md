# Release Notes - March 2026

This release introduces significant enhancements to fund intelligence, portfolio analysis, and user experience.

## Backend Enhancements

- **Advanced Fund Intelligence**: Expanded `FundEnrichment` model to include 50+ new data points including Morningstar ratings, riskometers, and debt-specific metrics.
- **Risk & Performance Analytics**: New granular tracking for Sharpe, Sortino, Beta, and Alpha ratios with automated category benchmarking.
- **Bulk Pre-warming**: Implemented batch ISIN pre-fetching to dramatically reduce wait times for large portfolio uploads.
- **Cache Management**: Automated cleanup logic for expired fund data to ensure analysis always uses the freshest available metrics.
- **Fund Manager Tracking**: New dedicated storage and API integration for fund manager history and roles.

## Frontend & UI Improvements

- **AI-Powered Insights**: Integrated "Know Before You Invest" (KBYI) highlights for instant fund analysis.
- **Interactive Enrichment View**: Complete overhaul of the fund details page with dynamic tabs for Performance, Risk, and Fundamentals.
- **Global Table Sorting**: Added sortable headers to all drilldown pages (Holdings, XIRR, Gain, etc.) for easier portfolio exploration.
- **Concentration Risk Alerts**: Visual indicators for high sector or top-holding concentration.
- **Data Verification Badges**: Clear UI indicators showing the validation status of fund data source-to-source.

---
*Private Fund Analyzer - Empowering your investment decisions.*

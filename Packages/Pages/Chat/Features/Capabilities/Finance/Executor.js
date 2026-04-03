import { createExecutor } from '../Shared/createExecutor.js';
import { fmt, safeJson } from '../Shared/Utils.js';

export const { handles, execute } = createExecutor({
    name: 'FinanceExecutor',
    tools: ['get_exchange_rate', 'get_treasury_data', 'get_fred_data'],
    handlers: {
        /* ── Exchange Rates ── */
        get_exchange_rate: async (params, onStage) => {
            const { from = 'USD', to } = params;
            const fromUpper = from.toUpperCase();
            onStage(`💱 Fetching exchange rates for ${fromUpper}…`);

            const data = await safeJson(`https://open.er-api.com/v6/latest/${fromUpper}`);
            if (data.result !== 'success') {
                throw new Error(`Exchange rate API error: ${data['error-type'] ?? 'Unknown error'}. Try a valid ISO currency code like USD, EUR, GBP, JPY, INR.`);
            }
            const rates = data.rates;
            const updated = new Date(data.time_last_update_utc).toLocaleString();

            if (to) {
                const toUpper = to.toUpperCase();
                const rate = rates[toUpper];
                if (!rate) return `Currency "${to}" not found. Use ISO codes like USD, EUR, GBP, JPY, INR, AUD, CAD, CHF, CNY, SGD.`;
                const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'CHF', 'CNY', 'SGD', 'AED'];
                const refs = MAJORS.filter(c => c !== fromUpper).slice(0, 8)
                    .map(c => `  ${c}: ${fmt(rates[c], 4)}`).join('\n');
                return [
                    `💱 Exchange Rates (1 ${fromUpper})`,
                    ``,
                    `➤ ${toUpper}: **${fmt(rate, 6)}**`,
                    `  (1 ${toUpper} = ${fmt(1 / rate, 6)} ${fromUpper})`,
                    ``,
                    `Other major rates:`,
                    refs,
                    ``,
                    `Last updated: ${updated}`,
                    `Source: open.er-api.com`,
                ].join('\n');
            }

            const DISPLAY = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'CHF', 'CNY', 'SGD', 'AED', 'BRL', 'MXN', 'KRW', 'THB'];
            const rateLines = DISPLAY.filter(c => c !== fromUpper && rates[c])
                .map(c => `  ${c}: ${fmt(rates[c], 4)}`).join('\n');
            return [`💱 Exchange Rates (1 ${fromUpper})`, ``, rateLines, ``, `Last updated: ${updated}`, `Source: open.er-api.com`].join('\n');
        },

        /* ── US Treasury ── */
        get_treasury_data: async (params, onStage) => {
            const { type = 'debt' } = params;
            onStage(`🏛️ Fetching US Treasury data (${type})…`);

            const BASE = 'https://api.fiscaldata.treasury.gov/services/API/v1';
            let url, title, formatter;

            switch (type) {
                case 'debt':
                    url = `${BASE}/debt/od/debt_to_penny/?fields=record_date,tot_pub_debt_out_amt&sort=-record_date&limit=7`;
                    title = '🏛️ US National Debt (Total Public Debt Outstanding)';
                    formatter = rows => rows.map(r => {
                        const debt = (parseFloat(r.tot_pub_debt_out_amt) / 1e12).toFixed(3);
                        return `  ${r.record_date}: $${debt} trillion`;
                    }).join('\n');
                    break;
                case 'rates':
                    url = `${BASE}/debt/od/avg_interest_rates/?fields=record_date,security_type_desc,avg_interest_rate_amt&sort=-record_date&limit=12`;
                    title = '📊 US Treasury Average Interest Rates';
                    formatter = rows => rows.map(r =>
                        `  ${r.record_date} | ${r.security_type_desc}: ${r.avg_interest_rate_amt}%`
                    ).join('\n');
                    break;
                case 'balance':
                    url = `${BASE}/accounting/dts/dts_table_1/?fields=record_date,open_today_bal,close_today_bal,open_month_bal,open_fiscal_year_bal&sort=-record_date&limit=5`;
                    title = '💰 US Treasury Daily Cash Balance';
                    formatter = rows => rows.map(r => {
                        const open = parseFloat(r.open_today_bal) / 1000;
                        const close = parseFloat(r.close_today_bal) / 1000;
                        return `  ${r.record_date}: Open $${open.toFixed(1)}B → Close $${close.toFixed(1)}B`;
                    }).join('\n');
                    break;
                default:
                    return `Unknown treasury data type "${type}". Available: "debt", "rates", "balance".\n\n- debt: National debt total\n- rates: Average interest rates on securities\n- balance: Daily Treasury cash balance`;
            }

            const data = await safeJson(url);
            if (!data.data?.length) return `No treasury data currently available for type "${type}". Try again later.`;
            return [title, ``, formatter(data.data), ``, `Source: fiscaldata.treasury.gov`].join('\n');
        },

        /* ── FRED Economic Data ── */
        get_fred_data: async (params, onStage) => {
            const { series_id, limit = 6 } = params;
            if (!series_id) {
                return [
                    'Missing required param: series_id.',
                    '',
                    'Common FRED series IDs:',
                    '  GDP       — Gross Domestic Product',
                    '  UNRATE    — Unemployment Rate',
                    '  CPIAUCSL  — Consumer Price Index (inflation)',
                    '  FEDFUNDS  — Federal Funds Rate',
                    '  DGS10     — 10-Year Treasury Yield',
                    '  DGS2      — 2-Year Treasury Yield',
                    '  SP500     — S&P 500 Index',
                    '  MORTGAGE30US — 30-Year Mortgage Rate',
                    '  DCOILWTICO — WTI Crude Oil Price',
                    '  DEXUSEU   — USD/EUR Exchange Rate',
                ].join('\n');
            }

            const sid = series_id.toUpperCase();
            onStage(`📊 Fetching FRED series ${sid}…`);

            let apiKey = 'abcdefghijklmnopqrstuvwxyz012345';
            try {
                const config = await window.electronAPI?.invoke?.('get-free-connector-config', 'fred');
                if (config?.credentials?.apiKey?.trim()) {
                    apiKey = config.credentials.apiKey.trim();
                } else {
                    onStage(`ℹ️ Using public FRED access — add a free API key for full access`);
                }
            } catch { /* optional */ }

            const FRED_BASE = 'https://api.stlouisfed.org/fred';
            const keyParam = `api_key=${apiKey}&file_type=json`;

            let seriesInfo = null;
            try {
                const infoData = await safeJson(`${FRED_BASE}/series?series_id=${sid}&${keyParam}`);
                if (infoData.error_message) throw new Error(infoData.error_message);
                seriesInfo = infoData.seriess?.[0];
            } catch (err) {
                const note = apiKey === 'abcdefghijklmnopqrstuvwxyz012345'
                    ? 'Tip: Add a free FRED API key in Settings → Connectors to unlock all series.'
                    : '';
                return `FRED error for "${sid}": ${err.message}\n\n${note}\n\nCommon IDs: GDP, UNRATE, CPIAUCSL, FEDFUNDS, DGS10, SP500`;
            }

            onStage(`📈 Loading observations for ${seriesInfo?.title ?? sid}…`);

            const obsData = await safeJson(
                `${FRED_BASE}/series/observations?series_id=${sid}&${keyParam}&limit=${limit}&sort_order=desc`
            );
            const obs = (obsData.observations ?? []).filter(o => o.value !== '.').slice(0, limit);
            if (!obs.length) return `No data available for FRED series "${sid}".`;

            const unitsShort = seriesInfo?.units_short ?? seriesInfo?.units ?? '';
            const obsLines = obs.map(o =>
                `  ${o.date}: ${parseFloat(o.value).toLocaleString('en-US', { maximumFractionDigits: 4 })}${unitsShort ? ' ' + unitsShort : ''}`
            ).join('\n');

            return [
                `📊 ${seriesInfo?.title ?? sid}`,
                `Series ID: ${sid}`,
                `Frequency: ${seriesInfo?.frequency ?? 'Unknown'}`,
                `Units: ${seriesInfo?.units ?? 'Unknown'}`,
                `Last updated: ${seriesInfo?.last_updated?.split(' ')[0] ?? 'N/A'}`,
                ``,
                `Recent values (newest first):`,
                obsLines,
                ``,
                `Source: Federal Reserve Bank of St. Louis (FRED)`,
                `More data: fred.stlouisfed.org/series/${sid}`,
            ].join('\n');
        },
    },
});

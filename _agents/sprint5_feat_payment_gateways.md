# Sprint 5 — Feature-Flagged Payment Gateways

> **Target Branch:** `feat/payment-gateways`
> **Base Branch:** `main` (assumes Phase 0 migration `20260313100000_financial_engine_phase0.sql` is already applied)
> **Priority:** P1 — Can run in parallel with `feat/subscription-core`

---

## 1. Objective

Replace the hardcoded "Online" / "Manual" payment method selection in the merchant checkout/onboarding flow with a **dynamic, feature-flagged** gateway system. Gateways are read from `platform_config` (key: `payment_gateways`), and only active gateways are presented. Each gateway renders a unique checkout UI (bank details + receipt upload, crypto wallet + TX hash, Tlync redirect stub).

---

## 2. Absolute Constraints

> [!CAUTION]
> - **DO NOT** modify `src/middleware.js`.
> - **DO NOT** modify `src/context/providers/ActiveBusinessProvider.jsx` or `src/context/TagdeerContext.jsx`.
> - **DO NOT** create new database tables. Phase 0 already added `currency`, `payment_gateway`, `gateway_reference`, `exchange_rate` columns to `transactions`.
> - **DO NOT** alter existing RLS policies.
> - Gateway IDs must match exactly: `'manual_bank'`, `'crypto_usdt'`, `'tlync_lyd'`.
> - All amounts in transactions must store the **LYD equivalent** in `amount` and the original currency in `currency`. The locked exchange rate goes in `exchange_rate`.

---

## 3. File-by-File Execution

### 3.1 — Admin Settings: Payment Gateway Management Tab

**File:** `src/app/(portals)/admin/settings/page.jsx`

#### Step 1: Add state for payment gateways (after line 28)

```jsx
const [paymentGateways, setPaymentGateways] = useState([]);
```

#### Step 2: Fetch gateway config alongside tier pricing (inside the existing `useEffect` that fetches `platform_config`, around line 50-65)

Locate the `fetchConfig` function. Add a parallel fetch for `payment_gateways`:

```jsx
// Inside fetchConfig, add after the tier_pricing fetch:
const { data: gatewaysConfig } = await supabase
    .from('platform_config')
    .select('value')
    .eq('key', 'payment_gateways')
    .maybeSingle();

if (gatewaysConfig?.value) setPaymentGateways(gatewaysConfig.value);
```

#### Step 3: Add Save handler

```jsx
const handleSaveGateways = async () => {
    setIsSaving(true);
    try {
        const { error } = await supabase
            .from('platform_config')
            .upsert({ key: 'payment_gateways', value: paymentGateways }, { onConflict: 'key' });
        if (error) throw error;
        showToast('Payment gateways saved!');
    } catch (err) {
        console.error(err);
        showToast('Failed to save gateways.', 'error');
    } finally {
        setIsSaving(false);
    }
};
```

#### Step 4: Add a "Payment Gateways" section in the settings page

Locate the existing tab navigation (look for the `Tabs` component). Add a new `TabsTrigger` and `TabsContent`:

```jsx
<TabsTrigger value="gateways" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
    💳 Payment Gateways
</TabsTrigger>
```

```jsx
<TabsContent value="gateways" className="space-y-6">
    <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Payment Gateway Configuration</h2>
        <button onClick={handleSaveGateways} disabled={isSaving} className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-4 py-2 rounded-lg disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save Gateways'}
        </button>
    </div>

    <div className="space-y-4">
        {paymentGateways.map((gw, index) => (
            <div key={gw.id} className={`border rounded-2xl p-6 transition-all ${gw.isActive ? 'border-emerald-500/30 bg-slate-800/50' : 'border-slate-700/50 bg-slate-900/30 opacity-60'}`}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="font-bold text-white text-lg">{gw.name}</h3>
                        <p className="text-sm text-slate-400">{gw.name_ar} • {gw.currency}</p>
                    </div>
                    <button
                        onClick={() => {
                            const updated = [...paymentGateways];
                            updated[index] = { ...gw, isActive: !gw.isActive };
                            setPaymentGateways(updated);
                        }}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${gw.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}
                    >
                        {gw.isActive ? '🟢 Active' : '⚫ Disabled'}
                    </button>
                </div>

                {/* Gateway-specific config fields */}
                {gw.type === 'manual' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs text-slate-500 uppercase font-bold">Bank Name</label>
                            <input
                                value={gw.config?.bank_name || ''}
                                onChange={e => {
                                    const updated = [...paymentGateways];
                                    updated[index] = { ...gw, config: { ...gw.config, bank_name: e.target.value } };
                                    setPaymentGateways(updated);
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-slate-500 uppercase font-bold">Account Number</label>
                            <input
                                value={gw.config?.account_number || ''}
                                onChange={e => {
                                    const updated = [...paymentGateways];
                                    updated[index] = { ...gw, config: { ...gw.config, account_number: e.target.value } };
                                    setPaymentGateways(updated);
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                            />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <label className="text-xs text-slate-500 uppercase font-bold">Transfer Instructions</label>
                            <textarea
                                value={gw.config?.instructions || ''}
                                onChange={e => {
                                    const updated = [...paymentGateways];
                                    updated[index] = { ...gw, config: { ...gw.config, instructions: e.target.value } };
                                    setPaymentGateways(updated);
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white min-h-[60px]"
                            />
                        </div>
                    </div>
                )}

                {gw.type === 'crypto' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs text-slate-500 uppercase font-bold">Wallet Address (TRC-20)</label>
                            <input
                                value={gw.config?.wallet_address || ''}
                                onChange={e => {
                                    const updated = [...paymentGateways];
                                    updated[index] = { ...gw, config: { ...gw.config, wallet_address: e.target.value } };
                                    setPaymentGateways(updated);
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white font-mono"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-slate-500 uppercase font-bold">Exchange Rate (LYD per USDT)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={gw.config?.exchange_rate_lyd_per_usdt || 6.2}
                                onChange={e => {
                                    const updated = [...paymentGateways];
                                    updated[index] = { ...gw, config: { ...gw.config, exchange_rate_lyd_per_usdt: parseFloat(e.target.value) || 0 } };
                                    setPaymentGateways(updated);
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                            />
                        </div>
                    </div>
                )}

                {gw.type === 'api' && (
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-center text-sm text-slate-500">
                        <p className="font-medium text-slate-400 mb-1">Tlync Integration (Stubbed)</p>
                        <p>Will be activated when API credentials are provided.</p>
                    </div>
                )}
            </div>
        ))}
    </div>
</TabsContent>
```

---

### 3.2 — Merchant Onboarding: Dynamic Gateway Checkout

**File:** `src/app/(portals)/merchant/onboarding/page.jsx`

This is the critical file. The current payment section (lines 597-628) has hardcoded "Online" and "Manual" radio buttons.

#### Step 1: Fetch active gateways (add state after the existing state declarations, ~line 40)

```jsx
const [activeGateways, setActiveGateways] = useState([]);
const [txHash, setTxHash] = useState(''); // For crypto gateway
```

#### Step 2: Fetch gateways on mount (inside the existing `useEffect` with `supabase`)

```jsx
// Inside the useEffect that runs when supabase is available:
const fetchGateways = async () => {
    const { data } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'payment_gateways')
        .maybeSingle();

    if (data?.value) {
        setActiveGateways(data.value.filter(gw => gw.isActive));
    }
};
fetchGateways();
```

#### Step 3: Replace the payment method selection UI (lines 597-628)

Replace the entire "Online" / "Manual" radio button block with dynamic gateway cards:

```jsx
<div className="space-y-4">
    <Label className="text-base font-bold text-slate-700 dark:text-slate-300 px-1 block">{t('payment_method')}</Label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {activeGateways.map(gw => (
            <div
                key={gw.id}
                onClick={() => setPaymentMethod(gw.id)}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-3 group ${paymentMethod === gw.id ? 'border-blue-600 bg-blue-50/30 dark:bg-blue-950/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}
            >
                <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${paymentMethod === gw.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                        {gw.type === 'manual' && <FileText className="w-6 h-6" />}
                        {gw.type === 'crypto' && <Wallet className="w-6 h-6" />}
                        {gw.type === 'api' && <CreditCard className="w-6 h-6" />}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 p-1 flex items-center justify-center ${paymentMethod === gw.id ? 'border-blue-600' : 'border-slate-300'}`}>
                        {paymentMethod === gw.id && <div className="w-full h-full bg-blue-600 rounded-full" />}
                    </div>
                </div>
                <div>
                    <span className={`font-bold block ${paymentMethod === gw.id ? 'text-blue-900 dark:text-blue-400' : 'text-slate-600'}`}>
                        {lang === 'ar' ? gw.name_ar : gw.name}
                    </span>
                    <span className="text-xs text-slate-400">{gw.currency}</span>
                </div>
            </div>
        ))}
    </div>
</div>
```

> **IMPORT**: Add `Wallet` to the lucide import at the top of the file if not already present. `FileText` and `CreditCard` are already imported.

#### Step 4: Add gateway-specific checkout panels (after the gateway selection, before the submit button)

```jsx
{/* Gateway-Specific Checkout Info */}
{paymentMethod === 'manual_bank' && (() => {
    const bankGw = activeGateways.find(g => g.id === 'manual_bank');
    return bankGw ? (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 space-y-3">
            <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm">Bank Transfer Details</h4>
            <div className="text-sm space-y-1">
                <p><strong>Bank:</strong> {bankGw.config?.bank_name}</p>
                <p><strong>Account:</strong> <span className="font-mono">{bankGw.config?.account_number}</span></p>
                <p className="text-xs text-amber-600 dark:text-amber-400">{bankGw.config?.instructions}</p>
            </div>
        </div>
    ) : null;
})()}

{paymentMethod === 'crypto_usdt' && (() => {
    const cryptoGw = activeGateways.find(g => g.id === 'crypto_usdt');
    const rate = cryptoGw?.config?.exchange_rate_lyd_per_usdt || 6.2;
    const usdtAmount = (total / rate).toFixed(2);
    return cryptoGw ? (
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-5 space-y-4">
            <h4 className="font-bold text-purple-800 dark:text-purple-400 text-sm">USDT Payment (TRC-20)</h4>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-purple-700 dark:text-purple-300">{usdtAmount} USDT</p>
                <p className="text-xs text-slate-500 mt-1">≈ {total} LYD @ {rate} LYD/USDT</p>
            </div>
            <div className="text-sm space-y-2">
                <p><strong>Wallet:</strong> <span className="font-mono text-xs break-all">{cryptoGw.config?.wallet_address}</span></p>
                <p><strong>Network:</strong> {cryptoGw.config?.network || 'TRC-20'}</p>
            </div>
            <div className="space-y-1">
                <label className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase">Transaction Hash</label>
                <input
                    value={txHash}
                    onChange={e => setTxHash(e.target.value)}
                    placeholder="Paste your TX hash here..."
                    className="w-full bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-lg px-4 py-2 text-sm font-mono"
                />
            </div>
        </div>
    ) : null;
})()}

{paymentMethod === 'tlync_lyd' && (
    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 text-center">
        <h4 className="font-bold text-blue-800 dark:text-blue-400 text-sm mb-2">Tlync Online Payment</h4>
        <p className="text-sm text-slate-500">You will be redirected to Tlync's secure payment page after submitting.</p>
        <p className="text-xs text-blue-500 mt-2 italic">Integration pending — gateway is not yet active.</p>
    </div>
)}
```

#### Step 5: Update the `submitOrder` function (lines 282-294)

The transaction insert must use the selected gateway data:

```jsx
// Replace the transaction insert block (lines 282-294):
if (shieldLevel > 0) {
    const amount = shieldLevel === 1 ? shieldPricing.trust : shieldPricing.fatora;
    const selectedGw = activeGateways.find(g => g.id === paymentMethod) || { id: 'manual_bank', currency: 'LYD' };
    const isCrypto = selectedGw.type === 'crypto';
    const exchangeRate = isCrypto ? (selectedGw.config?.exchange_rate_lyd_per_usdt || 6.2) : null;

    await supabase.from('transactions').insert([{
        business_id: businessId,
        owner_id: activeUser.id,
        amount: amount,
        status: 'pending', // All gateways start as pending for admin review
        payment_method: selectedGw.type,
        requested_tier: shieldLevel === 1 ? 'Trust Shield Addon' : 'Fatora Shield Addon',
        duration: '1 Month',
        currency: selectedGw.currency,
        payment_gateway: selectedGw.id,
        gateway_reference: isCrypto ? txHash : null,
        exchange_rate: exchangeRate
    }]);
}
```

#### Step 6: Default `paymentMethod` to first active gateway

Change the initial state (find the `paymentMethod` useState call):

```jsx
// Update from:
const [paymentMethod, setPaymentMethod] = useState('online');
// To:
const [paymentMethod, setPaymentMethod] = useState('manual_bank');
```

Also add a `useEffect` to set the default when gateways load:

```jsx
useEffect(() => {
    if (activeGateways.length > 0 && !activeGateways.find(g => g.id === paymentMethod)) {
        setPaymentMethod(activeGateways[0].id);
    }
}, [activeGateways]);
```

---

### 3.3 — Admin Financials: Gateway Filter (Enhancement)

**File:** `src/app/(portals)/admin/financials/page.jsx`

> The Phase 0 changes already added gateway/currency badges to the transfer queue (lines 341-360) and the verification panel (lines 381-404). No further structural changes needed.

**OPTIONAL ENHANCEMENT:** Add a gateway filter dropdown above the transfer queue:

```jsx
// After the transfer queue header, add:
const [gatewayFilter, setGatewayFilter] = useState('all');

// Filter the transfers list:
const filteredTransfers = gatewayFilter === 'all'
    ? transfers
    : transfers.filter(t => t.gateway === gatewayFilter);
```

Then render a filter bar inside the queue tab header:

```jsx
<select
    value={gatewayFilter}
    onChange={e => setGatewayFilter(e.target.value)}
    className="text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
>
    <option value="all">All Gateways</option>
    <option value="manual_bank">Bank Transfer</option>
    <option value="crypto_usdt">USDT</option>
    <option value="tlync_lyd">Tlync</option>
</select>
```

Use `filteredTransfers` instead of `transfers` in the map rendering.

---

## 4. Testing Requirements

### 4.1 — Unit Test: Gateway Config Validation

**File:** `tests/payment-gateway-config.test.js` **(NEW)**

```jsx
import { describe, it, expect } from 'vitest';

const VALID_GATEWAY_IDS = ['manual_bank', 'crypto_usdt', 'tlync_lyd'];
const VALID_TYPES = ['manual', 'crypto', 'api'];

// Mock gateway config (matches Phase 0 seed)
const mockGateways = [
    { id: 'manual_bank', name: 'Bank Transfer', type: 'manual', currency: 'LYD', isActive: true, config: { bank_name: 'Test', account_number: '123' } },
    { id: 'crypto_usdt', name: 'Crypto (USDT-TRC20)', type: 'crypto', currency: 'USDT', isActive: false, config: { wallet_address: 'TXxxx', exchange_rate_lyd_per_usdt: 6.2 } },
    { id: 'tlync_lyd', name: 'Tlync', type: 'api', currency: 'LYD', isActive: false, config: {} }
];

describe('Payment Gateway Config', () => {
    it('should have valid gateway IDs', () => {
        mockGateways.forEach(gw => {
            expect(VALID_GATEWAY_IDS).toContain(gw.id);
        });
    });

    it('should have valid types', () => {
        mockGateways.forEach(gw => {
            expect(VALID_TYPES).toContain(gw.type);
        });
    });

    it('should filter only active gateways for checkout', () => {
        const active = mockGateways.filter(gw => gw.isActive);
        expect(active.length).toBe(1);
        expect(active[0].id).toBe('manual_bank');
    });

    it('should calculate USDT amount correctly', () => {
        const rate = 6.2;
        const lydAmount = 50;
        const usdtAmount = (lydAmount / rate).toFixed(2);
        expect(usdtAmount).toBe('8.06');
    });

    it('crypto gateway should have wallet address and exchange rate', () => {
        const crypto = mockGateways.find(g => g.id === 'crypto_usdt');
        expect(crypto.config.wallet_address).toBeTruthy();
        expect(crypto.config.exchange_rate_lyd_per_usdt).toBeGreaterThan(0);
    });
});
```

Run: `npx vitest run tests/payment-gateway-config.test.js`

---

## 5. Pre-Merge Checklist

- [ ] `npx next build` exits with code 0
- [ ] Admin Settings has a "Payment Gateways" tab with toggle + config fields
- [ ] Onboarding shows only `isActive: true` gateways
- [ ] Bank Transfer shows bank details from config
- [ ] Crypto shows wallet address, calculated USDT amount, and TX hash input
- [ ] Tlync shows a "coming soon" stub
- [ ] Transaction insert includes `currency`, `payment_gateway`, `gateway_reference`, `exchange_rate`
- [ ] Default payment method falls back to first active gateway
- [ ] Unit test passes: `npx vitest run tests/payment-gateway-config.test.js`

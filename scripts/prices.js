import { DebugTopics, debugWarn } from './debug.js';
import { getEventEmitter } from './event_bus.js';
import { sleep } from './utils.js';

/**
 * @typedef {Object} Currency
 * @property {string} currency - The type of currency
 * @property {number} value - The value of the currency
 * @property {number} last_updated - The timestamp when this value was last updated
 */

/**
 * Oracle's primary instance.
 *
 * @todo Allow an array of Oracle instances for better privacy and decentralisation
 */
export const QUTRADE_BASE = 'https://qutrade.io/api/v1';

/**
 * An Oracle instance
 */
export class Oracle {
    /**
     * The currencies cache map
     * @type {Map<string, Currency>} Map to store currency objects
     */
    mapCurrencies = new Map();

    /**
     * A lock-like flag which waits until at least once successful "full fetch" of currencies has occurred.
     * This flag massively lowers bandwidth by only fetching the bulk once, falling to per-currency APIs afterwards.
     */
    #fLoadedCurrencies = false;

    /**
     * Get the cached price in a specific display currency
     * @param {string} strCurrency - The Oracle display currency
     * @return {Number}
     */
    getCachedPrice(strCurrency) {
        return this.mapCurrencies.get(strCurrency)?.value || 0;
    }

    /**
     * Get a cached list of the supported display currencies
     *
     * **Note:** This is a read-only array, use the {@link mapCurrencies} map to mutate the cache
     * @returns {Array<Currency>} - A list of Oracle-supported display currencies
     */
    getCachedCurrencies() {
        return Array.from(this.mapCurrencies.values());
    }

    /**
     * Get the price in a specific display currency with extremely low bandwidth
     * @param {string} strCurrency - The Oracle display currency
     * @return {Promise<Number>}
     */
    async getPrice(strCurrency) {
        try {
			//{"currency":"usdt","value":0.171,"last_updated":1747279894} // from Oracle 
			
			let cCurrency = { currency: strCurrency, value: 0.0, last_updated: 1747278096 };
			
            const cReq = await fetch(`${QUTRADE_BASE}/market_data/?pair=skyr_${strCurrency}`);

            // If the request fails, we'll try to fallback to cache, otherwise return a safe empty state
            if (!cReq.ok) return this.getCachedPrice(strCurrency);

            /** @type {Currency} */
            var arrRes = await cReq.json();
			cCurrency.currency = strCurrency;
			if (strCurrency=='usdt'){
				cCurrency.value = arrRes.list.skyr_usdt.ask;
				cCurrency.last_updated =  arrRes.list.skyr_usdt.timestamp;
			} else if (strCurrency=='trx'){
				cCurrency.value = arrRes.list.skyr_trx.ask;
				cCurrency.last_updated =  arrRes.list.skyr_trx.timestamp;			
			}  else if (strCurrency=='s11'){
				cCurrency.value = arrRes.list.skyr_s11.ask;
				cCurrency.last_updated =  arrRes.list.skyr_s11.timestamp;			
			}
			
            // Update it
            this.mapCurrencies.set(strCurrency, cCurrency);

            // And finally return it
            return cCurrency.value;
        } catch (e) {
            debugWarn(
                DebugTopics.NET,
                'Oracle: Failed to fetch ' +
                    strCurrency.toUpperCase() +
                    ' price!'
            ),
                debugWarn(DebugTopics.NET, e);
            return this.getCachedPrice(strCurrency);
        }
    }

    /**
     * Get a list of the supported display currencies
     *
     * This should only be used sparingly due to higher bandwidth, prefer {@link getPrice} if you need fresh data for a single, or select few currencies.
     *
     * See {@link #fLoadedCurrencies} for more info on Oracle bandwidth saving.
     * @returns {Promise<Array<Currency>>} - A list of Oracle-supported display currencies
     */

	async getCurrencies() {
        try {
            //const cReq = await fetch(`${QUTRADE_BASE}/currencies`);
			//[{"currency":"aed","value":0.63079,"last_updated":1747278096},...]

            // If the request fails, we'll try to fallback to cache, otherwise return a safe empty state
            //if (!cReq.ok) return this.getCachedCurrencies();

            /** @type {Array<Currency>} */
            //const arrCurrencies = await cReq.json();
			
			let arrCurrencies = [{ currency: 'usdt', value: 0.0, last_updated: 1747278096 }, { currency: 'trx', value: 0.0, last_updated: 1747278096 }, { currency: 's11', value: 0.0, last_updated: 1747278096 }];
			//console.log("arrCurrencies "+arrCurrencies[0].currency+" "+arrCurrencies[0].value);
			
			var cReq = await fetch('https://qutrade.io/api/v1/market_data/?pair=skyr_usdt');
			if (!cReq.ok) return this.getCachedCurrencies();;
	
			var arrRes = await cReq.json();
			arrCurrencies[0].currency = "usdt";
			arrCurrencies[0].value = arrRes.list.skyr_usdt.ask;
			arrCurrencies[0].last_updated = arrRes.list.skyr_usdt.timestamp;
	
			cReq = await fetch('https://qutrade.io/api/v1/market_data/?pair=skyr_trx');
			if (!cReq.ok) return this.getCachedCurrencies();;
	
			arrRes = await cReq.json();
			arrCurrencies[1].currency = "trx";
			arrCurrencies[1].value = arrRes.list.skyr_trx.ask;
			arrCurrencies[1].last_updated = arrRes.list.skyr_trx.timestamp;
			
			cReq = await fetch('https://qutrade.io/api/v1/market_data/?pair=skyr_s11');
			if (!cReq.ok) return this.getCachedCurrencies();;
	
			arrRes = await cReq.json();
			arrCurrencies[2].currency = "s11";
			arrCurrencies[2].value = arrRes.list.skyr_s11.ask;
			arrCurrencies[2].last_updated = arrRes.list.skyr_s11.timestamp;

            // Loop each currency and update the cache
            for (const cCurrency of arrCurrencies) {
				//console.log("cCurrency.currency, cCurrency = " + cCurrency.currency + cCurrency);
                this.mapCurrencies.set(cCurrency.currency, cCurrency);
            }
			//console.log("this.mapCurrencies = "+this.mapCurrencies);

            // Now we've loaded all currencies: we'll flag it and use the lower bandwidth price fetches in the future
            this.#fLoadedCurrencies = true;
            return arrCurrencies;
        } catch (e) {
            debugWarn(DebugTopics.NET, 'Oracle: Failed to fetch currencies!'),
                debugWarn(DebugTopics.NET, e);

            return this.getCachedCurrencies();
        }
    }
	
    async load() {
        //while (!this.#fLoadedCurrencies) {
            await this.getCurrencies();
        //    if (!this.#fLoadedCurrencies) await sleep(5000);
        //}
        // Update any listeners for the full currency list (Settings, etc)
        getEventEmitter().emit('currency-loaded', this.mapCurrencies);
        // Update the balance to render the price instantly
        getEventEmitter().emit('price-update');
    }
}

/**
 * The user-selected Price Oracle, used for all price data
 * @type {Oracle}
 */
export let cOracle = new Oracle();

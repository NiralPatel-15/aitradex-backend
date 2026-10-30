// ==========================================================
// AiTradeX - Upstox Market Data Service
// ==========================================================

const axios = require("axios");

const { UPSTOX_CONFIG } = require("./upstox.config");

const {
  getRuntimeAccessToken,
} = require("./upstox.token.store");

const LIVE_MARKET_ASSETS = {
  NIFTY: {
    name: "NIFTY 50",
    instrumentKey: "NSE_INDEX|Nifty 50",
  },

  RELIANCE: {
    name: "Reliance Industries",
    instrumentKey: "NSE_EQ|INE002A01018",
  },

  HDFCBANK: {
    name: "HDFC Bank",
    instrumentKey: "NSE_EQ|INE040A01034",
  },

  NIFTYBEES: {
    name: "NIFTYBEES",
    instrumentKey: "NSE_EQ|INF204KB14I2",
  },

  TCS: {
    name: "TCS",
    instrumentKey: "NSE_EQ|INE467B01029",
  },

  INFY: {
    name: "Infosys",
    instrumentKey: "NSE_EQ|INE009A01021",
  },

  ICICIBANK: {
    name: "ICICI Bank",
    instrumentKey: "NSE_EQ|INE090A01021",
  },

  BHARTIARTL: {
    name: "Bharti Airtel",
    instrumentKey: "NSE_EQ|INE397D01024",
  },
  ITC: {
    name: "ITC",
    instrumentKey: "NSE_EQ|INE154A01025",
  },

  SBIN: {
    name: "State Bank of India",
    instrumentKey: "NSE_EQ|INE062A01020",
  },

  LT: {
    name: "Larsen & Toubro",
    instrumentKey: "NSE_EQ|INE018A01030",
  },

  AXISBANK: {
    name: "Axis Bank",
    instrumentKey: "NSE_EQ|INE238A01034",
  },

  WIPRO: {
    name: "Wipro",
    instrumentKey: "NSE_EQ|INE075A01022",
  },
};

class UpstoxMarketService {
  // ========================================================
  // ACCESS TOKEN
  // ========================================================

  getAccessToken() {
    // Environment token is useful for server-side development,
    // scheduled jobs, and single-account deployments.
    const envToken =
      process.env.UPSTOX_ACCESS_TOKEN || process.env.UPSTOX_ANALYTICS_TOKEN;

    if (envToken && envToken.trim()) {
      return envToken.trim();
    }

    // OAuth callback stores the token in memory so the user can
    // connect Upstox and immediately request market data.
    const runtimeToken = getRuntimeAccessToken();

    if (runtimeToken) {
      return runtimeToken;
    }

    const error = new Error(
      "Upstox access token is not configured. Connect Upstox or set UPSTOX_ACCESS_TOKEN on the backend.",
    );

    // 503 is more accurate than 500: the server is running,
    // but the upstream authorization dependency is unavailable.
    error.statusCode = 503;
    error.code = "UPSTOX_TOKEN_NOT_CONFIGURED";

    throw error;
  }

  // ========================================================
  // DEFAULT INSTRUMENTS
  // ========================================================

  getDefaultInstrumentKeys() {
    return Object.values(LIVE_MARKET_ASSETS).map(
      (asset) => asset.instrumentKey,
    );
  }

  // ========================================================
  // VALIDATION
  // ========================================================

  validateInstrumentKeys(instrumentKeys) {
    if (!Array.isArray(instrumentKeys) || instrumentKeys.length === 0) {
      const error = new Error("At least one instrument_key is required.");

      error.statusCode = 400;
      error.code = "INSTRUMENT_KEY_REQUIRED";

      throw error;
    }

    const keys = [
      ...new Set(
        instrumentKeys.map((key) => String(key).trim()).filter(Boolean),
      ),
    ];

    if (keys.length === 0) {
      const error = new Error("At least one valid instrument_key is required.");

      error.statusCode = 400;
      error.code = "INSTRUMENT_KEY_REQUIRED";

      throw error;
    }

    if (keys.length > 500) {
      const error = new Error("Maximum 500 instrument keys are allowed.");

      error.statusCode = 400;
      error.code = "INSTRUMENT_KEY_LIMIT";

      throw error;
    }

    return keys;
  }

  // ========================================================
  // GET MARKET QUOTES
  // ========================================================
  //
  // Uses Upstox LTP Quotes V3.
  //
  // V3 provides:
  // - last_price
  // - instrument_token
  // - ltq
  // - volume
  // - cp (previous close)
  //
  // This lets the Flutter app calculate today's change.
  // ========================================================

  async getMarketQuotes(instrumentKeys) {
    const keys = this.validateInstrumentKeys(instrumentKeys);

    const token = this.getAccessToken();

    try {
      const response = await axios.get(
        `${UPSTOX_CONFIG.marketApiBaseUrl}/market-quote/ltp`,
        {
          params: {
            instrument_key: keys.join(","),
          },

          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          timeout: 15000,
        },
      );

      const rawData =
        response.data?.data && typeof response.data.data === "object"
          ? response.data.data
          : {};

      const data = {};

      for (const [responseKey, quote] of Object.entries(rawData)) {
        if (!quote || typeof quote !== "object") {
          continue;
        }

        const instrumentKey =
          typeof quote.instrument_token === "string" &&
          quote.instrument_token.trim()
            ? quote.instrument_token.trim()
            : responseKey;

        const lastPrice = Number(quote.last_price);

        const closePrice = Number(quote.cp);

        const ltq = Number(quote.ltq);
        const volume = Number(quote.volume);

        if (!Number.isFinite(lastPrice)) {
          continue;
        }

        const hasClose = Number.isFinite(closePrice) && closePrice > 0;

        const change = hasClose ? lastPrice - closePrice : null;

        const changePercent = hasClose ? (change / closePrice) * 100 : null;

        data[instrumentKey] = {
          instrument_key: instrumentKey,
          last_price: lastPrice,

          close_price: hasClose ? closePrice : null,

          ltq: Number.isFinite(ltq) ? ltq : null,

          volume: Number.isFinite(volume) ? volume : null,

          change,

          change_percent: Number.isFinite(changePercent) ? changePercent : null,
        };
      }

      return {
        success: true,
        source: "upstox",
        api_version: "v3",
        timestamp: new Date().toISOString(),
        data,
      };
    } catch (error) {
      const status = error.response?.status;
      const responseData = error.response?.data;

      console.error("");
      console.error("========================================");
      console.error("❌ UPSTOX MARKET DATA ERROR");
      console.error("========================================");
      console.error("Status:", status || "N/A");
      console.error("Response:", JSON.stringify(responseData || {}, null, 2));
      console.error("Message:", error.message);
      console.error("========================================");
      console.error("");

      if (status === 401 || status === 403) {
        const apiError = new Error(
          "Upstox access token is invalid or expired. Please reconnect Upstox.",
        );

        apiError.statusCode = 401;
        apiError.code = "UPSTOX_TOKEN_INVALID";

        throw apiError;
      }

      if (status === 429) {
        const apiError = new Error(
          "Upstox API rate limit reached. Please try again shortly.",
        );

        apiError.statusCode = 429;
        apiError.code = "UPSTOX_RATE_LIMIT";

        throw apiError;
      }

      const message =
        responseData?.errors?.[0]?.message ||
        responseData?.message ||
        error.message ||
        "Unable to fetch market data from Upstox.";

      const apiError = new Error(message);

      apiError.statusCode =
        Number.isInteger(status) && status >= 400 && status < 600
          ? status
          : 502;

      apiError.code = "UPSTOX_MARKET_DATA_ERROR";

      throw apiError;
    }
  }

  // ========================================================
  // GET HISTORICAL CANDLES — NIFTY 50
  // ========================================================

  async getHistoricalCandles(range = "1D") {
    const token = this.getAccessToken();

    const instrumentKey = "NSE_INDEX|Nifty 50";

    const rangeConfig = {
      "1D": { days: 1, unit: "minutes", interval: 5, intraday: true },
      "1W": { days: 7, unit: "minutes", interval: 30 },
      "1M": { days: 30, unit: "minutes", interval: 30 },
      "3M": { days: 90, unit: "days", interval: 1 },
      "6M": { days: 180, unit: "days", interval: 1 },
      "1Y": { days: 365, unit: "days", interval: 1 },
    };

    const selectedRange = String(range).toUpperCase();
    const config = rangeConfig[selectedRange];

    if (!config) {
      const error = new Error("Invalid range. Use 1D, 1W, 1M, 3M, 6M, or 1Y.");
      error.statusCode = 400;
      error.code = "INVALID_HISTORY_RANGE";
      throw error;
    }

    const formatDate = (date) => {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const toDate = new Date();
    const fromDate = new Date(toDate);
    fromDate.setUTCDate(fromDate.getUTCDate() - config.days);

    const encodedKey = encodeURIComponent(instrumentKey);

    const url = config.intraday
      ? `${UPSTOX_CONFIG.marketApiBaseUrl}/historical-candle/intraday/${encodedKey}/${config.unit}/${config.interval}`
      : `${UPSTOX_CONFIG.marketApiBaseUrl}/historical-candle/${encodedKey}/${config.unit}/${config.interval}/${formatDate(toDate)}/${formatDate(fromDate)}`;

    try {
      const response = await axios.get(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        timeout: 20000,
      });

      const rawCandles = response.data?.data?.candles;

      const candles = Array.isArray(rawCandles)
        ? rawCandles
            .map((candle) => ({
              timestamp: candle[0],
              open: Number(candle[1]),
              high: Number(candle[2]),
              low: Number(candle[3]),
              close: Number(candle[4]),
              volume: Number(candle[5] ?? 0),
            }))
            .filter(
              (candle) =>
                candle.timestamp &&
                [candle.open, candle.high, candle.low, candle.close].every(
                  Number.isFinite,
                ),
            )
            .reverse()
        : [];

      return {
        success: true,
        source: "upstox",
        instrument_key: instrumentKey,
        range: selectedRange,
        timestamp: new Date().toISOString(),
        candles,
      };
    } catch (error) {
      const status = error.response?.status;

      if (status === 401 || status === 403) {
        const apiError = new Error(
          "Upstox access token is invalid or expired. Please reconnect Upstox.",
        );
        apiError.statusCode = 401;
        apiError.code = "UPSTOX_TOKEN_INVALID";
        throw apiError;
      }

      const apiError = new Error(
        error.response?.data?.errors?.[0]?.message ||
          error.response?.data?.message ||
          error.message ||
          "Unable to fetch historical market data.",
      );

      apiError.statusCode = status >= 400 && status < 600 ? status : 502;
      apiError.code = "UPSTOX_HISTORICAL_DATA_ERROR";
      throw apiError;
    }
  }
}

module.exports = {
  UpstoxMarketService,
  LIVE_MARKET_ASSETS,
};

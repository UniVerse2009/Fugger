const fs = require('fs');
const path = require('path');

// Load OHLCV data dari JSON
function loadOhlcv(jsonPath) {
    const raw = fs.readFileSync(path.resolve(jsonPath), 'utf8');
    const parsed = JSON.parse(raw);
    let arr = parsed;
    if (Array.isArray(parsed)) arr = parsed;
    else if (Array.isArray(parsed.ohlcv)) arr = parsed.ohlcv;
    else if (Array.isArray(parsed.data)) arr = parsed.data;
    else {
        const v = Object.values(parsed).find(x => Array.isArray(x));
        if (v) arr = v;
    }
    return arr.map(item => {
        if (Array.isArray(item)) {
            const [ts, o, h, l, c, v] = item;
            return { timestamp: ts, open: o, high: h, low: l, close: c, volume: v };
        } else {
            return {
                timestamp: item.timestamp ?? item.time,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volume
            };
        }
    });
}

// Exponential Moving Average
function emaArray(values, n) {
    const out = new Array(values.length).fill(null);
    const k = 2 / (n + 1);
    let prevEma = null;

    for (let i = 0; i < values.length; i++) {
        const price = values[i];
        if (price == null) continue;

        if (i < n - 1) continue;
        if (i === n - 1) {
            const sma = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
            prevEma = sma;
            out[i] = prevEma;
        } else {
            prevEma = (price - prevEma) * k + prevEma;
            out[i] = prevEma;
        }
    }
    return out;
}

// Relative Strength Index (RSI)
function rsiArray(values, length) {
    const out = new Array(values.length).fill(null);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= length; i++) {
        const diff = values[i] - values[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    let avgGain = gains / length;
    let avgLoss = losses / length;
    out[length] = 100 - (100 / (1 + (avgGain / avgLoss)));

    for (let i = length + 1; i < values.length; i++) {
        const diff = values[i] - values[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;

        avgGain = (avgGain * (length - 1) + gain) / length;
        avgLoss = (avgLoss * (length - 1) + loss) / length;

        if (avgLoss === 0) {
            out[i] = 100;
        } else {
            const rs = avgGain / avgLoss;
            out[i] = 100 - (100 / (1 + rs));
        }
    }

    return out;
}

// MACD (returns { macd, signal, hist })
function macdArray(values, fastLen, slowLen, signalLen) {
    const emaFast = emaArray(values, fastLen);
    const emaSlow = emaArray(values, slowLen);
    const macdLine = values.map((_, i) =>
        emaFast[i] != null && emaSlow[i] != null
            ? emaFast[i] - emaSlow[i]
            : null
    );
    const signalLine = emaArray(macdLine.map(x => (x == null ? 0 : x)), signalLen);
    const hist = macdLine.map((m, i) =>
        m != null && signalLine[i] != null ? m - signalLine[i] : null
    );

    return { macd: macdLine, signal: signalLine, hist };
}

function simulateOne(data, fastLen, slowLen, rsiLen, macdFast, macdSlow, macdSignal, TP) {
    const close = data.map(d => d.close);
    const high = data.map(d => d.high);

    const emaFast = emaArray(close, fastLen);
    const emaSlow = emaArray(close, slowLen);
    const rsi = rsiArray(close, rsiLen);
    const { hist } = macdArray(close, macdFast, macdSlow, macdSignal);

    const labels = [];

    for (let i = 1; i < data.length; i++) {
        if (
            emaFast[i - 1] != null && emaSlow[i - 1] != null &&
            emaFast[i - 1] < emaSlow[i - 1] && emaFast[i] > emaSlow[i] &&
            rsi[i] > 50 && rsi[i] < 80 &&
            hist[i] > 0 // MACD histogram positif
        ) {
            const entryPrice = close[i];
            const target = entryPrice * (1 + TP);
            let success = false;

            for (let j = i + 1; j < data.length; j++) {
                if (high[j] >= target) {
                    success = true;
                    break;
                }
                if (emaFast[j - 1] > emaSlow[j - 1] && emaFast[j] < emaSlow[j]) {
                    success = false;
                    break;
                }
            }
            labels.push(success ? 1 : -1);
        }
    }

    const wins = labels.filter(x => x === 1).length;
    const losses = labels.filter(x => x === -1).length;
    const trades = labels.length;
    const score = wins - losses;
    const winrate = trades > 0 ? (wins / trades) * 100 : 0;

    return { fastLen, slowLen, rsiLen, macdFast, macdSlow, macdSignal, score, trades, wins, losses, winrate };
}

function simulate(dataPath, TP) {
    const data = loadOhlcv(dataPath);
    const results = [];
    let counter = 0;

    // Hitung total kombinasi dulu
    let totalCombos = 0;
    for (let fast = 5; fast <= 15; fast++) {
        for (let slow = 20; slow <= 40; slow++) {
            if (fast >= slow) continue;
            for (let rsiLen = 7; rsiLen <= 21; rsiLen++) {
                for (let macdFast = 5; macdFast <= 12; macdFast++) {
                    for (let macdSlow = 20; macdSlow <= 26; macdSlow++) {
                        if (macdFast >= macdSlow) continue;
                        for (let macdSignal = 5; macdSignal <= 12; macdSignal++) {
                            totalCombos++;
                        }
                    }
                }
            }
        }
    }

    // Loop utama simulasi
    for (let fast = 5; fast <= 15; fast++) {
        for (let slow = 20; slow <= 40; slow++) {
            if (fast >= slow) continue;
            for (let rsiLen = 7; rsiLen <= 21; rsiLen++) {
                for (let macdFast = 5; macdFast <= 12; macdFast++) {
                    for (let macdSlow = 20; macdSlow <= 26; macdSlow++) {
                        if (macdFast >= macdSlow) continue;
                        for (let macdSignal = 5; macdSignal <= 12; macdSignal++) {
                            const out = simulateOne(data, fast, slow, rsiLen, macdFast, macdSlow, macdSignal, TP);
                            results.push(out);
                            counter++;
                            if (counter % 1000 === 0) {
                                console.log(`udah ${counter} / ${totalCombos} kombinasi`);
                            }
                        }
                    }
                }
            }
        }
    }

    results.sort((a, b) =>
        b.winrate - a.winrate ||
        b.score - a.score ||
        b.trades - a.trades
    );

    const best = results[0];
    const top10 = results.slice(0, 10);

    console.log('--- EMA + RSI + MACD SIMULATION COMPLETE ---');
    console.log('Best combo:', best);
    console.table(top10);

    return { best, top10, all: results };
}

module.exports = { simulate };

if (require.main === module) {
    const argv = process.argv.slice(2);
    if (argv.length < 2) {
        console.error('Usage: node ema_rsi_macd_crossover.js <data.json> <TP>');
        process.exit(1);
    }
    const [dataPath, tpStr] = argv;
    const TP = parseFloat(tpStr);
    const res = simulate(dataPath, TP);
    console.log(JSON.stringify(res.best, null, 2));
}


// backtest.js
const fs = require("fs");
const { getCloses, SMA, BOLL, MACD } = require("./analyst");

// --- parameter trading ---
/*const periodBB = 20;
const multBB = 2;
const shortMACD = 12;
const longMACD = 26;
const signalMACD = 9;
const stopLoss = -0.01;   // -5%
const takeProfit = 0.01;  // +10%*/

function backtestBBMacd(ohlcv, periodBB, multBB, shortMACD, longMACD, signalMACD, stopLoss, takeProfit) {
    const closes = getCloses(ohlcv);

    // Hitung indikator
    const boll = BOLL(closes, periodBB, multBB);
    const { histogram } = MACD(closes, shortMACD, longMACD, signalMACD);

    let trades = [];
    let position = null;

    for (let i = 0; i < closes.length; i++) {
        const price = closes[i];
        const bb = boll[i];
        const hist = histogram[i];

        if (!bb || bb.lower === null || hist === null) continue;

        // --- ENTRY ---
        if (!position && price <= bb.lower && hist > 0) {
            position = { entryPrice: price, entryIndex: i };
        }

        // --- EXIT (SL/TP) ---
        if (position) {
            const change = (price - position.entryPrice) / position.entryPrice;

            if (change <= stopLoss || change >= takeProfit) {
                trades.push(change);
                position = null;
            }
        }
    }

    // --- Summary ---
    const totalTrades = trades.length;
    const wins = trades.filter(pnl => pnl > 0).length;
    const totalPnL = trades.reduce((a, b) => a + b, 0) * 100;

    return {
        totalTrades,
        wins,
        winRate: totalTrades ? (wins / totalTrades * 100).toFixed(2) + "" : "0",
        totalPnL: totalPnL.toFixed(2) + "",
	BBPeriod: periodBB,
	BBMult: multBB,
	short: shortMACD,
	long: longMACD,
	signal: signalMACD
    };
}

let res = [];

// Contoh penggunaan (dummy data)
const data = JSON.parse(fs.readFileSync("./DOGE1_8-25.json"));
//console.log(backtestBBMacd(data, 20, 2, 12, 26, 9, -0.01, 0.01));
const BBMult = [1.0, 1.5, 2.0];
for(let BBPeriod = 10; BBPeriod <= 50; BBPeriod++){
	for(let mult of BBMult){
		for(let shortMACD = 5; shortMACD <= 15; shortMACD++){
			for(let longMACD = 16; longMACD <= 35; longMACD++){
				for(let signalMACD = 5; signalMACD <= 15; signalMACD++){
					console.log(`BBPeriod=${BBPeriod} BBMult=${BBMult} short=${shortMACD} long=${longMACD} signal=${signalMACD}`);
					res.push(backtestBBMacd(data, BBPeriod, mult, shortMACD, longMACD, signalMACD, -0.01, 0.02));
				}
			}
		}
	}
}

res.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
for(let i = 0; i <= 500; i++){
	console.log(res[i]);
}
fs.writeFileSync("./dist/output.json", JSON.stringify(res, null, 2));
console.log("Artifacts telah dibuat");

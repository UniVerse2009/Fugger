require("dotenv").config({quiet: true});
const PAIRLIST = ["AURA/IDR", "AVA/IDR", "APU/IDR", "PONKE/IDR", "USELESS/IDR", "FWOG/IDR"];
const TELEGRAM_API_TOKEN = process.env.TELEGRAM_FUGGER_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_FUGGER_BOT_CHAT_ID;
let ohlcv;

function getCloses(ohlcv) {
	return ohlcv.map(candle => candle[4]);
}

function expectedPrice(A, C, B_p, k, p) {
	// Hitung M
	const M = 4 * k * k * Math.pow(B_p - 0.5, 2) - (p - 1);

	// Cek pembagi nol
	if (p === 1) {
		throw new Error("Error: p - 1 = 0, penyebut jadi nol.");
	}
	if (M === 0) {
		throw new Error("Error: M = 0, bentuk jadi indeterminate.");
	}

	// Hitung bagian dalam akar
	const inside = p * M * (A * A - C * (p - 1));
	if (inside < 0) {
		throw new Error("Error: nilai di dalam akar negatif, hasil bukan real.");
	}

	// Hitung akar
	const root = Math.sqrt(inside);

	// Bagian pertama (pusat)
	const base = A / (p - 1);

	// Bagian offset (±)
	const offset = (2 * k * (B_p - 0.5) * root) / ((p - 1) * M);

	// Return dua kemungkinan hasil
	return [base + offset, base - offset];
}

async function getData(pairList) {
	const ccxt = require("ccxt");
	const exchange = new ccxt.indodax();
	const promises = PAIRLIST.map(e => {
		return exchange.fetchOHLCV(e, "15m", undefined, 21);
	});
	const result = await Promise.all(promises);
	return result;
}

async function bestPrice(pairList) {
	const result = [];
	const data = await getData(pairList);
	ohlcv = data;
	data.forEach(e => {
		const closes = getCloses(e).slice(0, 19);
		const A = closes.reduce((acc, n) => acc + n, 0);
		const C = closes.reduce((acc, n) => acc + Math.pow(n, 2), 0);
		const expected = expectedPrice(A, C, 0, 2, 20);
		result.push(Math.min(expected[0], expected[1]));
	});
	return result;
}

async function sendMessage(text, botToken=TELEGRAM_API_TOKEN, chatId=TELEGRAM_CHAT_ID) {
	try {
		const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: chatId,
				text: text
			})
		});
		return await response.json();
	} catch (error) {
		console.error('Gagal ngirim pesan, mungkin internetmu lagi ngopi:', error);
	}
}


(async() => {
	const bestPrices = await bestPrice(PAIRLIST);
	for(let i = 0; i < PAIRLIST.length; i++){
		if(ohlcv[i][19][3] <= bestPrices[i]){
			sendMessage(`Pair: ${PAIRLIST[i]}. Expect: ${bestPrices[i]}. Got: ${ohlcv[i][19][3]}`);
		}else{

		}
	}
})();
